# 01 — Phân tích nghiệp vụ (Business Analysis)

> **POLYMIND CHINESE — Hệ thống quản lý học viên tiếng Trung.**
> Nguồn sự thật về **yêu cầu**. Khi code/migration khác tài liệu này → hoặc code sai, hoặc tài liệu phải được cập nhật cùng lúc với business change. Không để lệch âm thầm.

---

## 1. Mục tiêu

Xây dựng web app quản lý toàn bộ vòng đời học tập tại trung tâm tiếng Trung: từ thiết lập chương trình đào tạo, mở lớp, ghi danh học viên, vận hành từng buổi học (điểm danh, nhật ký giảng dạy), giao và chấm bài tập, kiểm tra – đánh giá tiến độ, cho đến quản lý học phí cơ bản, thông báo và báo cáo.

Ưu tiên thiết kế:

1. **Giáo viên dùng được trên điện thoại giữa buổi dạy.** Điểm danh phải xong trong vài chạm.
2. **Dữ liệu học viên được bảo vệ ở tầng database (RLS)**, không chỉ ẩn nút trên UI.
3. **Lịch sử không bị ghi đè.** Chuyển lớp, rút học, sửa điểm đều để lại vết.

Đây **không** phải hệ thống CRM tuyển sinh, không phải hệ thống kế toán tổng quát, và không liên quan gì tới xuất khẩu lao động.

---

## 2. Actors

| Actor                           | Mô tả                                                                                     | Cách có tài khoản                               |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Super Admin** (`super_admin`) | Chủ trung tâm / quản lý đào tạo. Toàn quyền nghiệp vụ, quản lý tài khoản, học phí, audit. | Seed lúc khởi tạo hệ thống                      |
| **Giáo viên** (`teacher`)       | Dạy các lớp được phân công. Chỉ thấy lớp mình và học viên trong lớp đó.                   | Super admin tạo hồ sơ → gửi invite email        |
| **Học viên** (`student`)        | Người học. Chỉ thấy dữ liệu của chính mình.                                               | Super admin tạo hồ sơ → gửi invite email        |
| **Khách vãng lai** (anonymous)  | Chưa đăng nhập.                                                                           | Không đọc/ghi được bất kỳ dữ liệu nghiệp vụ nào |

**Không có role phụ huynh.** Thông tin người giám hộ (`guardian_name`, `guardian_phone`, `guardian_relation`) chỉ là **trường liên hệ** trên hồ sơ học viên — không phải tài khoản đăng nhập. Đây là bài học rút từ hệ cũ, nơi phụ huynh là một role thật và kéo theo cả một ma trận phân quyền phức tạp.

**Không có public sign-up.** Mọi tài khoản đều do super admin khởi tạo và mời.

---

## 3. Glossary — phân biệt 3 khái niệm hay bị gộp

Đây là ranh giới quan trọng nhất của toàn hệ thống. Gộp nhầm ba khái niệm này là lỗi thiết kế phổ biến nhất của phần mềm quản lý đào tạo.

| Thuật ngữ                                        | Là gì                                                                                                                                                                                                 | Ví dụ                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Level** (`levels`)                             | Bậc năng lực, dùng để phân loại. Danh mục cấu hình được.                                                                                                                                              | HSK 1, HSK 2, … HSK 6                                                        |
| **Course** — Khóa học / chương trình (`courses`) | **Bản thiết kế** của một chương trình đào tạo: mục tiêu, đối tượng, giáo trình (module → bài học), điều kiện hoàn thành. Tồn tại độc lập với thời gian, **không có ngày bắt đầu, không có học viên**. | "Tiếng Trung Đàm Phán Tài Chính Chiến Lược"                                  |
| **Class** — Lớp triển khai (`classes`)           | **Một lần mở lớp cụ thể** từ một Course: có mã lớp, sĩ số tối đa, giáo viên, ngày bắt đầu, hình thức học, địa điểm, lịch học. Học viên ghi danh vào **Class**, không phải vào Course.                 | `LOP-02` — mở từ chương trình "Tiếng Trung ngân hàng", khai giảng 20/07/2026 |
| **Session** — Buổi học (`class_sessions`)        | **Một buổi học có thật** trên trục thời gian của một Class. Điểm danh gắn vào Session.                                                                                                                | Buổi số 5 của `LOP-02`, 08:00–09:30 ngày 03/08/2026                          |

Quan hệ: `Level ← Course → Module → Lesson` và `Course → Class → Session`, với `Student → Enrollment → Class`.

Hệ quả thiết kế bắt buộc:

- Một Course có thể mở **nhiều** Class (khóa "Tiếng Trung ngân hàng" mở cả `LOP-02` lẫn `LOP-03`).
- Điểm danh, bài nộp, điểm số đều gắn vào **Enrollment**, không gắn thẳng vào Student — vì một học viên qua nhiều lớp theo thời gian (HSK 1 → HSK 2 → …), và mỗi lớp có dữ liệu học tập riêng.
- Số buổi ở Course chỉ là **mặc định gợi ý** (`default_session_count`, có thể null). Số buổi thật chốt ở Class (`planned_session_count`) và phải có giá trị trước khi kích hoạt lớp.

Các thuật ngữ khác:

- **Enrollment** — bản ghi ghi danh, nối một Student vào một Class. Là "hộ chiếu" để học viên đó tồn tại trong lớp: mọi điểm danh, bài nộp, điểm số, đánh giá đều treo vào `enrollment_id`.
- **Assignment** — bài tập giáo viên giao cho lớp. **Submission** — bài nộp của học viên.
- **Assessment** — bài kiểm tra (quiz/giữa kỳ/cuối kỳ/thi thử HSK). **Assessment result** — kết quả của một học viên trong bài kiểm tra đó.
- **Learning evaluation** — nhận xét định kỳ (tuần/tháng) theo 6 mặt: nghe, nói, đọc, viết, từ vựng, ngữ pháp.
- **Publish** — hành động công bố. Dữ liệu chưa publish là **draft**, học viên không thấy. Áp dụng cho assignment, assessment result và learning evaluation.

---

## 4. Phạm vi v1

### 4.1 Trong phạm vi (in scope)

| #   | Module                 | Nội dung                                                                                |
| --- | ---------------------- | --------------------------------------------------------------------------------------- |
| 1   | Tài khoản & phân quyền | 3 role cố định, invite qua email, khóa/mở tài khoản, reset mật khẩu                     |
| 2   | Hồ sơ giáo viên        | CRUD, mã giáo viên, chuyên môn                                                          |
| 3   | Hồ sơ học viên         | CRUD, mã học viên, người giám hộ (thông tin liên hệ), level hiện tại/mục tiêu           |
| 4   | Chương trình đào tạo   | Level, Course, Module/Chương, Lesson/Bài học, tài liệu khóa học                         |
| 5   | Lớp học                | Mở lớp, sĩ số, hình thức, địa điểm, phân công một giáo viên phụ trách                   |
| 6   | Lịch & buổi học        | Lịch lặp theo thứ, sinh buổi học tự động, nghỉ/đổi lịch/học bù                          |
| 7   | Ghi danh               | Ghi danh, tạm dừng, chuyển lớp, rút học, hoàn thành khóa (giữ lịch sử)                  |
| 8   | Điểm danh              | Có mặt / Đi muộn / Vắng / Có phép; thao tác hàng loạt theo roster                       |
| 9   | Bài tập                | Ngân hàng câu hỏi, bộ có version, làm trực tiếp/autosave, chấm auto + thủ công, release |
| 10  | Kiểm tra & đánh giá    | Thi cùng ngày có timer/finalizer, điểm 0–100, xếp loại; nhận xét định kỳ giữ riêng       |
| 11  | Tiến độ                | Tổng hợp từ bài học hoàn thành + chuyên cần + bài tập + điểm; điều kiện hoàn thành khóa |
| 12  | Học phí cơ bản         | Hóa đơn, khoản mục, thanh toán, phiếu thu, số dư còn phải thu                           |
| 13  | Thông báo              | In-app một chiều + announcement toàn hệ thống/lớp                                       |
| 14  | Báo cáo & export       | Dashboard 3 role, báo cáo, export CSV/XLSX theo đúng filter đang chọn                   |
| 15  | Audit                  | Nhật ký mutation nhạy cảm, append-only, chỉ super admin đọc                             |

### 4.2 Ngoài phạm vi (out of scope) — không tạo route/table/enum/menu/code chết

Xóa hoàn toàn, không "để dành":

- **CRM tuyển sinh:** Lead, nguồn lead, timeline chăm sóc, convert lead. Luồng bắt đầu thẳng từ tạo hồ sơ học viên.
- **Toàn bộ domain xuất khẩu lao động:** ứng viên XKLĐ, đơn hàng tuyển dụng, workflow 20 bước, COE, visa, phỏng vấn, chuyến bay, xuất cảnh, hộ chiếu, nghiệp đoàn, quốc gia đến, phí xuất cảnh.
- **Đại lý & hoa hồng:** đại lý, cộng tác viên, cây đại lý, bảng thi đua, cấu hình/tính/duyệt/chi hoa hồng.
- **Vay & thu nợ:** hỗ trợ vay, vay ngân hàng, nợ công ty, lịch trả góp, thu nợ.
- **Kế toán tổng quát:** khoản chi, duyệt chi, báo cáo lợi nhuận.
- **Chat/tin nhắn hai chiều:** messaging 1-1, audio message, thu hồi tin. Thông báo là **một chiều**.
- **Role phụ huynh** như một tài khoản đăng nhập.
- **AI** (Gemini, OCR CV/hộ chiếu, phân tích hồ sơ) — chuyển sang backlog phase 2.

**Ranh giới dễ trượt:** "Còn phải thu học phí" là **số dư của hóa đơn** (`total − đã thanh toán`), tính từ `tuition_invoices` và `tuition_payments`. Nó **không** được phép mọc thành module vay/nợ/thu hồi nợ như hệ cũ. Không có bảng "công nợ" riêng.

### 4.3 Backlog phase 2

AI hỗ trợ soạn bài và nhận xét · Email notification nghiệp vụ · Chứng chỉ hoàn thành · CSV import dữ liệu học viên cũ · Đa cơ sở/đa tenant · PWA.

---

## 5. Role matrix

Ký hiệu: **C** tạo · **R** đọc · **U** sửa · **D** xóa/hủy · **—** không truy cập · **(own)** chỉ dữ liệu của chính mình · **(assigned)** chỉ lớp được phân công.

| Tài nguyên                               | Super Admin        | Teacher                               | Student                                                            |
| ---------------------------------------- | ------------------ | ------------------------------------- | ------------------------------------------------------------------ |
| Tài khoản, role, invite, khóa/mở         | CRUD               | —                                     | —                                                                  |
| Hồ sơ giáo viên                          | CRUD               | R (own)                               | —                                                                  |
| Hồ sơ học viên                           | CRUD               | R (assigned: học viên trong lớp mình) | R (own)                                                            |
| Level, Course, Module, Lesson            | CRUD               | R (assigned: course của lớp mình)     | R (course của lớp mình)                                            |
| Tài liệu khóa học                        | CRUD               | R (assigned)                          | R (assigned + đã publish)                                          |
| Lớp học                                  | CRUD               | R (assigned)                          | R (lớp mình học)                                                   |
| Phân công giáo viên vào lớp              | CRUD               | — (không tự gán mình vào lớp)         | —                                                                  |
| Lịch lặp                                 | CRUD               | R (assigned)                          | R (lớp mình học)                                                   |
| Buổi học                                 | CRUD               | R + U (assigned: nhật ký, trạng thái) | R (lớp mình học)                                                   |
| Ghi danh / chuyển lớp / rút học          | CRUD               | R (assigned)                          | R (own)                                                            |
| Điểm danh                                | CRUD               | CRU (assigned)                        | R (own)                                                            |
| Tiến độ bài học                          | CRUD               | CRU (assigned)                        | R (own)                                                            |
| Câu hỏi/bộ bài tập/bộ đề                 | CRUD + duyệt global | CRUD own/share                        | DENY                                                               |
| Delivery/attempt/answer bài tập           | CRUD + chấm         | CRUD + chấm (assigned)                | Làm/nộp own; không sửa điểm/feedback                               |
| Kỳ thi/attempt/kết quả                   | CRUD + regrade      | CRUD + chấm (assigned)                | Làm own; chỉ xem kết quả đã công bố                                |
| Thang xếp loại                           | CRUD               | R                                     | R                                                                  |
| Đánh giá định kỳ                         | CRUD               | CRUD (assigned)                       | R (own + đã publish + `visible_to_student`)                        |
| Ghi chú học viên                         | CRUD               | CRUD (assigned)                       | R (own + `student_visible`) — **tuyệt đối không đọc `staff_only`** |
| Học phí (hóa đơn, thanh toán, phiếu thu) | CRUD               | **—** (không đọc)                     | R (own); **không** tự ghi nhận thanh toán                          |
| Thông báo                                | CRUD               | R (own)                               | R (own)                                                            |
| Announcement                             | CRUD               | R                                     | R                                                                  |
| Báo cáo                                  | R (toàn trung tâm) | R (assigned)                          | R (own)                                                            |
| Audit log                                | R                  | **—**                                 | **—**                                                              |

Nguyên tắc bất di bất dịch:

1. **Fail-closed.** Thiếu mapping (giáo viên chưa được gán lớp, học viên chưa có enrollment) → **từ chối**, không phải "cho qua".
2. **Ẩn menu không phải là phân quyền.** Mỗi mutation phải kiểm quyền ở server **và** được RLS chặn ở database. Đổi UUID trên URL hoặc gọi thẳng Supabase client từ trình duyệt đều không được vượt scope.
3. **Service role chỉ dùng cho admin flow server-only** (invite, khóa tài khoản, đổi role). Không bao giờ dùng service role để phục vụ request thường của teacher/student — làm vậy là vô hiệu hóa toàn bộ RLS.
4. **Không tin `user_metadata`.** Client sửa được nó. Role đọc từ bảng `profiles`.

---

## 6. Business rules

### BR-1 — Danh mục khóa học

- Trung tâm có **hai dòng chương trình song song**:
  - **Dòng cốt lõi** (luôn giảng dạy): HSK 1–6, Tiếng Trung giao tiếp, Tiếng Trung thiếu nhi, Luyện thi HSK.
  - **Dòng tùy chỉnh/B2B**: chương trình thiết kế riêng theo đối tác (hiện có 2 chương trình cho Vietcombank).
- Khi tạo Course, Super admin chọn `program = core | business`. Chỉ `core` mới có và bắt buộc chọn `course_type = hsk | communication | kids | exam_prep | custom`; `business` luôn có `course_type = null`.
- Các lớp Vietcombank **không phải** toàn bộ danh mục của trung tâm. Đừng nhầm dữ liệu đối tác thành catalog.
- Super admin tạo được biến thể mới (giao tiếp cơ bản/nâng cao, thiếu nhi theo độ tuổi, luyện thi theo target level) **mà không cần sửa code** → `course_type` phải đủ mở và level là bảng danh mục, không phải enum cứng.
- Mã khóa học, lớp, giáo viên và học viên là mã hệ thống: người dùng **không nhập tay**; DB tự sinh tuần tự và UNIQUE để an toàn khi tạo đồng thời. Mã hóa đơn, thanh toán và phiếu thu tiếp tục do RPC tự sinh. Mã tham chiếu giao dịch ngân hàng là dữ liệu bên ngoài nên vẫn được phép nhập nếu có.
- Trường chưa có nguồn dữ liệu (học phí, số buổi, giáo trình) để **nullable**. Không bịa số.

### BR-2 — Lớp học

- `capacity > 0`. Kiểm tra sĩ số **trong transaction** khi kích hoạt enrollment, không kiểm ở tầng UI (2 người đăng ký đồng thời sẽ lọt).
- Mỗi lớp **tối đa 1 giáo viên phụ trách**; một giáo viên được phụ trách nhiều lớp. Ràng buộc bằng UNIQUE `class_teachers.class_id` ở DB.
- Hình thức: `offline | online | hybrid | in_house`. Địa điểm phải cho phép **mô tả tự do** (`location_note`) — lớp `in_house` của Ban Giám đốc VCB có thể học ở bất kỳ đâu khách hàng chỉ định, không được ép chọn một cơ sở cố định.
- Trước khi chuyển lớp sang `active`: phải có đủ `planned_session_count`, `session_duration_minutes` và giáo viên chính.

### BR-3 — Lịch và buổi học

- Lịch lặp theo thứ trong tuần (ISO 1–7 = Thứ Hai → Chủ Nhật), có `start_time`/`end_time` với `end > start`.
- **Lớp linh hoạt được phép không có lịch lặp** (`LOP-01` — theo lịch Ban Giám đốc). Không ép mọi lớp phải có recurrence.
- Sinh buổi học từ lịch lặp phải **idempotent**: chạy lại không tạo buổi trùng, và dừng đúng ở `planned_session_count`.
- Nghỉ/đổi lịch/học bù là **override trên session** (`status` + `original_session_id`), không xóa hay sửa đè làm mất lịch sử.
- Mọi thời điểm lưu **UTC**. Hiển thị và sinh recurrence theo `Asia/Ho_Chi_Minh`.
- Card Buổi học mặc định hiển thị **thời khóa biểu tuần** (Thứ Hai → Chủ Nhật), có lùi/tiến tuần và về hôm nay. Người dùng chuyển được giữa `Tối giản` (danh sách đánh số buổi), `Tuần` và `Tháng`; tuần/tháng gom buổi theo ngày Việt Nam, không theo múi giờ máy người dùng.

### BR-4 — Ghi danh

- **Một học viên chỉ học MỘT lớp tại một thời điểm** _(user chốt 2026-07-13 — đảo ngược yêu cầu ban đầu trong đặc tả gốc §4.13)_.
  - "Một thời điểm" = tối đa **một** enrollment đang mở (`pending` / `active` / `paused`).
  - Enrollment đã đóng (`completed` / `withdrawn` / `transferred`) **không tính** → học xong HSK 1 vẫn đăng ký được HSK 2, và lịch sử lớp cũ giữ nguyên.
  - Chuyển lớp vẫn hoạt động: lớp cũ thành `transferred` (đã đóng), lớp mới `active` → vẫn chỉ một lớp đang mở.
  - Cưỡng chế bằng **partial unique index** ở DB (`ux_enrollments_one_open_per_student`), không phải bằng `if` ở tầng app — hai admin ghi danh đồng thời sẽ cùng đọc thấy "học viên chưa có lớp" rồi cùng insert.
- Vòng đời: `pending → active → (paused) → completed | withdrawn | transferred`.
- **Không bao giờ xóa enrollment.** Chuyển lớp = đánh dấu enrollment cũ `transferred` + tạo enrollment mới, **trong cùng một transaction**, ghi `enrollment_status_history` + audit.
- Chuyển lớp **không** tự động mang điểm/điểm danh sang lớp mới. Nếu cần quy đổi thì đó là một thao tác riêng, có audit.

### BR-5 — Điểm danh

- Trạng thái: `present | late | absent | excused`.
- UNIQUE `(session_id, enrollment_id)` → điểm danh hàng loạt phải **upsert theo key này**, chạy 2 lần không sinh bản ghi trùng.
- Chỉ tạo được điểm danh cho enrollment **thuộc đúng lớp của session đó** (chặn ở DB, không chỉ ở app).
- `marked_by` phải là **actor đang đăng nhập thật**, không phải "user đầu tiên tìm thấy" (lỗi attribution đã gặp ở hệ cũ).

### BR-6 — Bài tập

- Câu hỏi và bộ dùng version; version đã khóa/được giao là bất biến. Có đủ 11 dạng Q1–Q11, không có hint ở v1.
- Một bộ giao nhiều lớp tạo delivery riêng; giáo viên chỉ giao lớp mình phụ trách.
- Học viên chỉ start/save/submit attempt cho enrollment của chính mình, trong window và còn lượt; autosave/submit idempotent.
- Điểm objective do DB chấm, essay/rubric chờ giáo viên; late penalty, grading method và release mode được cưỡng chế ở DB.
- Answer key không xuất hiện trong client payload hoặc quyền student trước thời điểm release.

### BR-7 — Kiểm tra, xếp loại và đánh giá

- Khung thi bắt buộc cùng ngày `Asia/Ho_Chi_Minh`; deadline = `min(started_at + duration, closes_at)`. `pg_cron` finalize attempt hết hạn kể cả browser đóng.
- Điểm thi thang **0–100**; kết quả chỉ hiện sau khóa/công bố. Copy/cut/paste/drop bị chặn nhưng không phá Chinese IME.
- **Xếp loại được tính từ `grading_scale_rules`**, không hard-code label rải rác trong UI và không cho client tự gửi lên. Các ngưỡng **không chồng lấn** và phủ kín 0–100.
- Lưu draft và **publish là hai hành động tách biệt**. Học viên chỉ thấy bản ghi có `published_at IS NOT NULL`.
- Đánh giá định kỳ có thêm cờ `visible_to_student` — giáo viên chủ động chọn nhận xét nào cho học viên xem.
- **Không có tiêu chí "tài chính" trong đánh giá học tập.** Học phí và học lực là hai chuyện tách rời.

### BR-8 — Học phí

- Số dư = `invoice.total − SUM(payments)`. Là **giá trị tính ra**, không lưu thành cột "công nợ" rời (sẽ lệch).
- Trạng thái hóa đơn: `draft | issued | partial | paid | overdue | cancelled | refunded`.
- `amount > 0` cho mọi payment. Tổng thanh toán hợp lệ **không vượt** số phải thu, trừ khi đi qua flow hoàn tiền/điều chỉnh rõ ràng.
- Chỉ ghi nhận payment cho hóa đơn đã phát hành (`issued | partial | overdue`); draft, paid, cancelled, refunded đều bị từ chối ở RPC.
- Mỗi payment sinh **đúng một** receipt — ràng buộc bằng UNIQUE trên `tuition_receipts.payment_id`, không dựa vào app-level check (bài học từ lỗi thu-trùng ở hệ cũ).
- **Giáo viên không đọc được bảng học phí.** Học viên chỉ đọc hóa đơn **đã phát hành**/thanh toán của chính mình, không thấy draft và **không tự ghi nhận thanh toán**.
- Hóa đơn + khoản mục được lưu nguyên tử; `subtotal`, `line_total`, `total` do DB tính. Hóa đơn đã phát hành không sửa hoặc hard-delete.

### BR-9 — Hoàn thành khóa

- Hệ thống **tính** readiness từ: chuyên cần, tiến độ bài học, bài tập và điểm kiểm tra, theo rule cấu hình trên Course.
- Mặc định đề xuất: **chuyên cần ≥ 80%**, **điểm tổng ≥ 50/100**. Super admin chỉnh được **trước khi lớp bắt đầu**; không sửa hồi tố âm thầm cho lớp đang chạy.
- Hệ thống chỉ hiển thị "đủ / chưa đủ điều kiện". **Người xác nhận hoàn thành là super admin hoặc giáo viên được phân công**, có audit. Máy không tự động tốt nghiệp học viên.

### BR-10 — Thông báo

- Một chiều, không reply, không thread.
- Mỗi notification có link nội bộ hợp lệ; **kiểm authorization khi click** (link không phải là quyền).
- Người nhận chỉ được đổi `read_at`; không được sửa tiêu đề, nội dung, link hay chủ sở hữu notification. Tùy chọn `in_app_enabled` được trigger DB áp dụng cho **mọi** nguồn sinh notification; thiếu preference = mặc định bật.
- Announcement có hai phạm vi: toàn hệ thống (`class_id = null`) hoặc một lớp. Super admin soạn draft → publish riêng; sau publish khóa nội dung, chỉ được kết thúc hiệu lực. Giáo viên/học viên chỉ đọc bản đã publish, còn hiệu lực và thuộc audience của mình.
- Cron sinh nhắc lịch phải dùng `dedupe_key` để chạy lại không tạo thông báo trùng.

### BR-11 — Audit

- Append-only. Role app **không** update/delete được. **Chỉ super admin đọc.**
- Bắt buộc audit: đổi role/khóa tài khoản, sửa hồ sơ, sửa khóa/lớp/lịch, ghi danh/chuyển lớp, điểm danh, publish điểm, học phí/thanh toán, đổi visibility file.

---

## 7. Dữ liệu thực tế phải có trong seed

### 7.1 Level

HSK 1 → HSK 6 (framework `HSK`, `order_index` 1–6).

### 7.2 Course catalog — dòng cốt lõi (`status = active`)

| Code          | Tên                   | `program` | `course_type`   | Level                                 |
| ------------- | --------------------- | --------- | --------------- | ------------------------------------- |
| `HSK1`…`HSK6` | Tiếng Trung HSK 1…6   | `core`    | `hsk`           | HSK 1…6                               |
| `GT`          | Tiếng Trung giao tiếp | `core`    | `communication` | null                                  |
| `TN`          | Tiếng Trung thiếu nhi | `core`    | `kids`          | null                                  |
| `LT-HSK`      | Luyện thi HSK         | `core`    | `exam_prep`     | null (cấu hình target level theo lớp) |

Số buổi / thời lượng / học phí: **để null** ở catalog (trung tâm chưa cung cấp). Chốt ở từng Class.

### 7.3 Chương trình B2B — Vietcombank (2 chương trình, 3 lớp)

**Chương trình A — Tiếng Trung Đàm Phán Tài Chính Chiến Lược** (`Business Chinese for Executives`)

- Đối tượng: Ban Giám đốc · Chương trình: `business` · Loại: `null` · 35 buổi × 90 phút.

| Lớp      | Sĩ số | Khai giảng | Hình thức  | Địa điểm                                                 | Lịch                                                                                 |
| -------- | ----- | ---------- | ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `LOP-01` | 3     | 20/07/2026 | `in_house` | Trụ sở VCB hoặc địa điểm riêng tư do khách hàng chỉ định | **Linh hoạt** theo lịch Ban Giám đốc — chưa sinh lịch lặp cho tới khi admin cấu hình |

**Chương trình B — Tiếng Trung ngân hàng**

- Đối tượng: Lãnh đạo phòng / Cán bộ nhân viên · Chương trình: `business` · Loại: `null` · 35 buổi × 90 phút · Sĩ số tối đa 26 · `offline` tại `108 Tây Thạnh, Phường Tây Thạnh, TP. HCM`.

| Lớp      | Khai giảng | Lịch                                        |
| -------- | ---------- | ------------------------------------------- |
| `LOP-02` | 20/07/2026 | 08:00–09:30, **Thứ Hai & Thứ Tư** hằng tuần |
| `LOP-03` | 21/07/2026 | 08:00–09:30, **Thứ Ba & Thứ Năm** hằng tuần |

### 7.4 Quy tắc dữ liệu demo

- **Không bịa tên thật** của giáo viên hoặc học viên. Danh tính demo phải rõ ràng là giả (ví dụ `gv.demo1@polymind.test`, "Giáo viên Demo A").
- **Production không có user demo và không có mật khẩu mặc định.**
- Seed phải **idempotent**: chạy lại không nhân đôi dữ liệu.

---

## 8. Acceptance criteria (v1)

| #     | Tiêu chí                                                                                                                          | Cách nghiệm thu               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| AC-1  | 3 role đăng nhập và về đúng khu vực của mình; anonymous bị chặn                                                                   | E2E Playwright                |
| AC-2  | Super admin đi trọn: Course → Class → Schedule → sinh buổi → phân công GV → ghi danh → kích hoạt                                  | E2E                           |
| AC-3  | Giáo viên chỉ thấy lớp được phân công — kể cả khi gõ thẳng UUID lớp khác lên URL, gọi server action, hay query trực tiếp Supabase | pgTAP + E2E negative          |
| AC-4  | Học viên không thấy bất kỳ dữ liệu nào của học viên khác (roster, điểm, bài nộp, hóa đơn, ghi chú `staff_only`)                   | pgTAP + E2E negative          |
| AC-5  | Giáo viên **không đọc được** bảng học phí và audit log                                                                            | pgTAP                         |
| AC-6  | Điểm danh hàng loạt chạy 2 lần → không sinh bản ghi trùng                                                                         | Integration test              |
| AC-7  | Sinh buổi học chạy 2 lần → không sinh buổi trùng, dừng đúng `planned_session_count`                                               | Unit + integration            |
| AC-8  | Ghi nhận 1 payment → sinh đúng **1** receipt (kể cả gọi đồng thời)                                                                | Integration test              |
| AC-9  | Điểm chưa publish → học viên **không** thấy; publish xong mới thấy                                                                | pgTAP + E2E                   |
| AC-10 | Chuyển lớp giữ nguyên enrollment cũ (`transferred`) + tạo enrollment mới + ghi history                                            | Integration + E2E             |
| AC-11 | Ghi danh đồng thời không vượt `capacity`                                                                                          | Integration test (concurrent) |
| AC-12 | Export giữ đúng filter/date range đang chọn                                                                                       | Integration test              |
| AC-13 | Seed: HSK 1–6 + catalog cốt lõi + 2 chương trình B2B + 3 lớp VCB; `supabase db reset` sạch                                        | `supabase db reset`           |
| AC-14 | Không còn bất kỳ thuật ngữ/route/table XKLĐ nào                                                                                   | grep + review                 |

---

## 9. Tham chiếu

- Đặc tả gốc: [`POLYMIND_CHINESE_BUILD_PROMPT.md`](../POLYMIND_CHINESE_BUILD_PROMPT.md)
- Thiết kế DB + RLS matrix: [`02-database-design.md`](02-database-design.md)
- Workflow: [`03-workflow.md`](03-workflow.md)
- Kiến trúc: [`04-system-architecture.md`](04-system-architecture.md)
