# Bug report — Xác minh độc lập `GIAOVU-1`

> Người xác minh: Codex · 2026-08-03. Đây là kết quả tự dựng lại trên Supabase
> local sạch và trình duyệt Chromium; không dùng số “pass” của người triển khai
> làm bằng chứng.

## `GIAOVU-RLS-001` — Giáo vụ vẫn vào được một phần ngân hàng câu hỏi bằng RLS

- Severity: **High** — trái trực tiếp `D-2` điểm (3); có thể gọi PostgREST thẳng,
  không cần menu hay server action.
- Trạng thái: **OPEN**.
- Phạm vi: `questions`, `question_sets` và các policy teacher của assessment
  engine.

### Tái hiện độc lập

1. Reset DB sạch, nạp `seed.dev.sql`, đăng nhập
   `gv.vu@polymind.test / Polymind@2026` để lấy JWT thật.
2. Dưới role `postgres`, tạo một câu hỏi của giáo viên với
   `visibility = 'global'`.
3. `GET /rest/v1/questions?...` bằng JWT giáo vụ trả **HTTP 200 và đúng 1 hàng**.
4. `POST /rest/v1/question_sets` với `owner_id` bằng chính `auth.uid()` của giáo
   vụ trả thành công; đọc lại thấy đúng hàng vừa tạo.
5. Cùng JWT đó đọc `audit_logs` và `flashcard_decks` đều trả mảng rỗng; đây là
   bằng chứng JWT/RLS đang hoạt động, không phải request vô tình chạy bằng
   service role.

### Nguyên nhân

- `questions_teacher_read` cho mọi authenticated user đọc
  `visibility = 'global'`; policy không có vế
  `app.current_role() = 'teacher'`.
- `question_sets_teacher_write` chỉ kiểm `owner_id = auth.uid()`; giáo vụ luôn
  có `auth.uid()` nên tự tạo bộ đề được.
- Nhiều policy con (`question_versions`, options, answer keys, set versions,
  sections, items) suy quyền qua hai bảng cha, nên phạm vi ảnh hưởng không dừng
  ở đúng hai policy trên.

### Vì sao pgTAP `651/651` vẫn xanh

`academic_manager_role.test.sql` chỉ tạo một câu hỏi **private** do giáo viên
khác sở hữu rồi đếm `questions = 0`; nó không tạo câu hỏi `global` và không thử
ghi `question_sets`. Vì vậy bài 24 xanh nhưng không canh đầy đủ câu “giáo vụ
KHÔNG đọc câu hỏi”. Cần thêm hai ca hồi quy đúng hai phép đo trên.

---

## `GIAOVU-ROUTE-002` — Menu nhánh giáo viên hiện nhưng page/action từ chối giáo vụ

- Severity: **High** — nhánh thứ hai của role không sử dụng được dù phân công
  và RLS đều thành công.
- Trạng thái: **OPEN**.

### Tái hiện độc lập

1. Bằng JWT giáo vụ, tạo một lớp `planned` local và tự thêm hàng
   `class_teachers`.
2. Trong transaction mang cùng `sub` JWT:
   `app.my_teacher_id()` trả `GV000` và `app.teaches_class(<class>) = true`.
3. Sidebar Chromium hiện nhóm **Lớp được phân công** đủ 7 mục.
4. Gõ `/teacher/classes`: URL ban đầu được middleware cho qua, nhưng Server
   Component gọi `requireRole('teacher')` rồi redirect về `/admin`; heading
   “Lớp của tôi” và lớp vừa phân công không render.

### Phạm vi quét tĩnh

Toàn bộ 17 page dưới `/teacher` vẫn chỉ nhận `teacher` (một số trang thêm
`super_admin`), không page nào nhận `academic_manager`: dashboard, lớp/danh sách
và chi tiết, điểm danh, bài tập cùng delivery/question-bank/sets, thi cùng
delivery/question-bank/sets, đánh giá cùng chi tiết, báo cáo lớp, thông báo và
session detail.

Các action tương ứng cũng lệch: attendance, sessions, evaluations, exercises,
exams, question bank và question builder vẫn gọi `requireRole('teacher',
'super_admin')` hoặc chỉ `teacher`. Riêng assessment còn một chốt DB nữa:
`app.require_assessment_author()` chỉ nhận `teacher/super_admin`.

Kết quả là ba tầng nói ba chuyện: RLS/helper và menu nói “được”, page/action
nói “không”, còn một phần assessment DB cũng nói “không”.

---

## `GIAOVU-MIG-005` — Migration `088` đúng thân hàm nhưng mô tả và lỗi trả về sai

- Severity: **Low** về phân quyền, **Medium** về khả năng chẩn đoán vận hành.
- Trạng thái: **OPEN**.

### Phần đã chứng minh đúng

Reset local tới migration `087`, sinh lại 26 `pg_get_functiondef()` theo thứ tự
ổn định rồi chỉ thay `app.is_super_admin()` → `app.is_manager()` và bốn thông
báo đã nêu. Khối 26 hàm sinh lại và migration khớp **1.555/1.555 dòng**, cùng
SHA-256:

`ce8feb6c0a6f8e59b35bb56350bed0c9255b1a082daf8d71ff21d67eb70971c3`

Không có thay đổi thân hàm thứ ba lọt vào.

### Phần sai còn lại

- Header nói `48 hàm` và `22 hàm` giữ lại; catalog sạch đo được **49 hàm**, gồm
  **26 nghiệp vụ + 23 flashcard/câu hỏi**. Gate cuối file đã dùng đúng số 23,
  nên chính một file tự mâu thuẫn.
- Đúng **4** câu chứa “super admin” đã đổi sang “quản trị viên hoặc giáo vụ”.
- Tuy nhiên còn **7** hàm đã mở cho `is_manager()` nhưng vẫn ném “Chỉ quản trị
  viên…”: `delete_tuition_invoice_draft`, `enroll_student`,
  `generate_class_sessions`, `issue_tuition_invoice`,
  `record_tuition_payment`, `save_tuition_invoice`, `transfer_enrollment`.
  Giáo vụ gây lỗi validation/nghiệp vụ sẽ nhận thông báo sai về quyền của mình.

---

## Ma trận RLS ↔ server ↔ UI đã đối chiếu

| Thao tác/bề mặt | RLS | Server/page | UI | Kết luận tự đo |
| --- | --- | --- | --- | --- |
| Đọc audit | `is_super_admin()` | `/admin/system` chỉ super admin | Không có menu | **Khớp**, JWT thấy 0 hàng; URL bị chặn |
| Ghi profile người khác / tự nâng role | Chỉ super admin; trigger chặn tự nâng | Action tài khoản chỉ super admin | Không bày control | **Khớp**, update người khác 0 hàng; tự nâng lỗi `P0001` |
| Thêm/xóa giáo viên, reset/khóa tài khoản | INSERT/DELETE teachers và ghi profile chỉ super admin | 4 action gác super admin | Nút đã ẩn theo `canManageAccounts` | **Khớp**, JWT insert 403/delete 0 hàng; UI Chromium đúng |
| Sửa giáo viên | SELECT/UPDATE `is_manager()` | `updateTeacherAction` dùng `requireManager()` | “Sửa hồ sơ” hiện | **Khớp**, JWT sửa rồi khôi phục được |
| Học viên | Policy quản lý | create/update/archive dùng `requireManager()` | CRUD hiện, account control ẩn | **Khớp**, JWT đọc/sửa rồi khôi phục được |
| Khóa học/chương trình | Policy quản lý; tài liệu nhận manager/teacher đúng scope | Các action quản lý dùng `requireManager()` | `/admin/courses` và dialog hiện | **Khớp**, trang 200; JWT sửa rồi khôi phục được |
| Lớp/phân công/ghi danh | Policy quản lý | Actions dùng `requireManager()` | `/admin/classes` và dialog hiện | **Khớp ở nhánh quản lý**, tự tạo lớp và tự phân công thành công |
| Lịch/buổi học | Policy quản lý | Schedule actions dùng `requireManager()` | `/admin/schedule` hiện đủ control | **Khớp**, trang 200; JWT sửa lịch rồi khôi phục được |
| Học phí | Policy + RPC dùng `is_manager()` | Actions dùng `requireManager()` | `/admin/tuition` hiện | **Khớp**, JWT tạo/đọc/xóa invoice draft thành công |
| Báo cáo | Bảng/view nguồn cho manager đọc | Page nhận manager; API export chỉ super admin | Hai nút export hiện | **Lệch**, xem `GIAOVU-REPORT-003` |
| Thông báo/announcement | Policy + 3 RPC dùng manager | Page/action nhận manager | Mục menu đúng, chuông/deep-link sai | **Lệch**, xem `GIAOVU-NOTIFY-004` |
| Tổng quan | Các bảng KPI cho manager đọc | `/admin` dùng `requireManager()` | Mục Tổng quan hiện | **Khớp**, trang 200 và dữ liệu seed render |
| Nhánh lớp được phân công | `my_teacher_id`/`teaches_class` nhận manager | 17 page + action teacher không nhận manager | Menu hiện khi có assignment | **Lệch**, `GIAOVU-ROUTE-002` |
| Flashcard | Policy/RPC giữ super admin | Page/action giữ super admin | Không có menu; URL chặn | **Khớp**, JWT thấy 0 bộ |
| Câu hỏi/bộ đề | Admin policy giữ super admin nhưng teacher policy permissive không khóa role | Admin review bị chặn; action teacher chặn manager | Không có menu | **Lệch bảo mật**, `GIAOVU-RLS-001` |

## Cổng và giới hạn xác minh

- DB sạch trước seed: pgTAP **651/651**. Kiểm ngược `my_teacher_id()` về chỉ
  role teacher làm file giáo vụ đỏ đúng **2/24**, khôi phục lại **24/24**.
- Sau seed: đăng nhập JWT đúng mật khẩu trả 200; UTF-8 đọc lại đúng “Giáo vụ
  Demo”, không có dấu `?` hỏng.
- App: lint 0 · typecheck 0 · Vitest **498/498** · build 0.
- Production: **BLOCKED, chưa Verified**. CLI linked bị 403 ở login-role; môi
  trường hiện không có `SUPABASE_DB_PASSWORD`. Không dùng lại số Claude và không
  ghi gì lên cloud.

---

## Bản sửa — Claude 2026-08-03 (`Fixed`, chờ Codex xác minh độc lập)

Xem `docs/testing/MODULE_QA_BOARD.md` để có mô tả đầy đủ từng lỗi.

**Cổng sau khi sửa (chạy thật, local sạch):** `npx supabase test db` **662/662**
(651 → +11) · `npm test` **501/501** · lint · typecheck · build exit 0.

⚠️ **CHƯA ÁP `…089` LÊN CLOUD** — cần user xác nhận credential. Nghĩa là lỗ
"học viên đọc được toàn bộ ngân hàng câu hỏi `global`" **vẫn đang mở trên
production**.

🔴 **Phát hiện phát sinh, nghiêm trọng hơn lỗi được báo, KHÔNG do `GIAOVU-1`:**
ba policy `questions_teacher_read`, `question_sets_teacher_read` và
`question_sets_teacher_write` (có từ `…038`, 2026-07-16) **không kiểm role một
chữ nào** — vị ngữ chỉ là `visibility = 'global'` hoặc `owner_id = auth.uid()`.
Hệ quả: **học viên** đọc được toàn bộ ngân hàng câu hỏi `global` và tạo được
`question_sets` mang tên mình. Role giáo vụ chỉ làm lỗ này lộ ra chứ không tạo
ra nó. `…089` vá cả hai vế; pgTAP bài 29–32 ghim đúng phần học viên.

⚠️ **Vế do `GIAOVU-1` gây ra thì hẹp hơn nhiều:** `…087` nới
`app.my_teacher_id()` để nhận `academic_manager` (bắt buộc, nếu không nhánh menu
"Lớp được phân công" hiện ra mà mọi trang bên trong đều rỗng), việc đó mở kèm
nhánh `shared_with_teacher_id` ở ba policy trên.
