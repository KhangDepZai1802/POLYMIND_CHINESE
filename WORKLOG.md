# 📓 WORKLOG — POLYMIND CHINESE

> **File phối hợp giữa các session AI (Claude ⇄ Codex).** Đọc TRƯỚC khi làm, cập nhật SAU khi làm.
> Đây là nguồn sự thật về **trạng thái**. Nguồn sự thật về **việc cần làm** là [`docs/08-phase-plan.md`](docs/08-phase-plan.md).

---

## ⚠️ QUY TẮC BẮT BUỘC (đọc mỗi phiên)

1. **TRƯỚC khi làm gì:** đọc `TRẠNG THÁI HIỆN TẠI` + `VIỆC TIẾP THEO` + `BLOCKERS` + `QUYẾT ĐỊNH ĐÃ CHỐT` + entry mới nhất trong `NHẬT KÝ`.
2. **Claim task trước khi code:** lấy task ID từ `VIỆC TIẾP THEO` → ghi vào `TRẠNG THÁI HIỆN TẠI` dạng `P2-T11 — đang làm — <Claude|Codex> — <ngày>`. Làm vậy để agent kia biết chỗ nào đang có người.
3. **Làm đúng phạm vi task.** Không "tiện tay sửa luôn" file ngoài scope — sẽ ghi đè việc của agent kia.
4. **SAU khi làm xong (hoặc trước khi hết phiên):**
   - Cập nhật `TRẠNG THÁI HIỆN TẠI` (≤ 6 dòng).
   - Cập nhật `VIỆC TIẾP THEO` (task ID kế tiếp — càng cụ thể càng tốt).
   - Thêm **1 entry** vào đầu `NHẬT KÝ SESSION`.
   - Cập nhật ô trạng thái trong `docs/08-phase-plan.md` (`☐` → `☑`/`◐`).
   - Có blocker → ghi vào `BLOCKERS`.
   - **GIỮ GỌN:** chỉ giữ **6 entry gần nhất** ở `NHẬT KÝ`. Thêm mới → xóa cũ nhất (file phình = tốn token mỗi phiên).
5. **Trước khi kết thúc phiên:** `npm run lint && npm run typecheck && npm test && npm run build` phải **xanh**. Không xanh → ghi blocker thật, ghi rõ "đang dở, chưa build".
6. **KHÔNG ĐƯỢC:** ghi "pass/done/verified/deployed" khi chưa chạy thật · sửa test cho nó xanh thay vì sửa code · tự đổi quyết định đã chốt · commit secret · tự chạy `git commit` (user tự commit; xem D-20).

**Format 1 entry nhật ký:**

```
### [YYYY-MM-DD] Phiên N — <Claude|Codex> — <task ID>
- **Làm được:** ...
- **File thay đổi:** ...
- **Migration/data impact:** ... (hoặc "không có")
- **Đã test:** ... (lệnh gì, kết quả THẬT: pass/fail bao nhiêu)
- **Quyết định mới:** ... (hoặc "không có")
- **Blocker/rủi ro:** ...
- **Next action:** <task ID tiếp theo + việc cụ thể>
```

---

## 🚦 TRẠNG THÁI HIỆN TẠI

> Cập nhật: **2026-07-16** — Codex — tiếp tục toàn bộ backlog từ P7-T8

- **P7-T12 — hoàn thành — Codex — 2026-07-16.** Card Buổi học mặc định dạng tuần, có lùi/tiến/Hôm nay và chuyển Tối giản/Tuần/Tháng; giữ thao tác hủy/xóa ở tuần và tối giản.
- **P7-T11 — hoàn thành — Codex — 2026-07-16.** Course tách `core/business`; Loại chỉ còn cho `core`; mã khóa/lớp/GV/HV do DB tự sinh, có migration + pgTAP.
- **P7-T10 — hoàn thành — Codex — 2026-07-16.** Khử request auth/profile trùng trong một render, bỏ profile round-trip ở middleware protected route, song song hóa critical path dashboard và thêm loading overlay accessible.
- **P7-T9 — chưa triển khai — user chốt 2026-07-16.** Một giáo viên được làm giáo viên chính của nhiều lớp; mỗi lớp chỉ có một giáo viên phụ trách; bỏ hoàn toàn vai trò trợ giảng khỏi hệ thống.
- **P7-T8 — đang làm — Codex — 2026-07-16.** Thay luồng mời email bằng Super Admin cấp tên đăng nhập + mật khẩu trực tiếp cho giáo viên/học viên trong trang quản trị; email không bắt buộc.
- **P7-T7 — đang làm — Codex — 2026-07-15.** Supabase cloud đã áp 34 migration + production seed; Vercel project/GitHub đã link.
- **Baseline đã kiểm gần nhất:** 35 migration · 33 bảng public đều RLS · pgTAP **333/333** · lint/typecheck sạch · Vitest **82/82** · production build xanh; Playwright gần nhất **20/20**; Verification Queue trống.
- **Deploy cloud:** URL production đã chạy và anonymous guard đúng; P7-T7 chưa đóng vì còn migrate/redeploy các task mới và smoke authenticated đủ 3 role.

---

## ➡️ VIỆC TIẾP THEO

**`P7-T8` — Admin cấp tài khoản trực tiếp.** Hoàn thiện username/login/form admin tạo hoặc reset mật khẩu; tiếp theo `P7-T9`, rồi migrate 35+ lên cloud, redeploy và smoke `P7-T7`.

✅ **Verification Queue TRỐNG.** Cả 4 bug đã được Claude xác minh độc lập: `BUG-M06-001`, `BUG-M11-001` (phiên 14) · `BUG-M08-001`, `BUG-M11-002` (phiên 18). Xem `docs/testing/MODULE_QA_BOARD.md`.

Xem chi tiết task ở [`docs/08-phase-plan.md`](docs/08-phase-plan.md).

**Tài khoản demo (chỉ local):** `admin@polymind.test` · `gv.a@polymind.test` · `gv.b@polymind.test` · `hv1..hv5@polymind.test` — mật khẩu `Polymind@2026`.
Chạy: `npx supabase start` → `npx supabase db reset` → nạp `supabase/seed.dev.sql` → `npm run dev`.

---

## ⛔ BLOCKERS

| ID    | Blocker                                                                                                         | Ảnh hưởng                    | Cần gì để gỡ                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| BLK-3 | Smoke test Production có đăng nhập chưa chạy đủ 3 role; luồng mời email không phù hợp người dùng không có Gmail | Chưa được đánh dấu P7-T7 `☑` | Hoàn thành P7-T8, migrate/redeploy rồi smoke 3 role + IDOR + signed URL |

> App đã deploy và qua smoke public/anonymous; **P7-T7 vẫn chưa hoàn thành** cho tới khi smoke có đăng nhập qua đủ Definition of Done.

---

## 🔒 QUYẾT ĐỊNH ĐÃ CHỐT (không tự đổi — vướng thì hỏi user)

Nguồn gốc: [`POLYMIND_CHINESE_BUILD_PROMPT.md`](POLYMIND_CHINESE_BUILD_PROMPT.md) §4, và các câu hỏi đã hỏi user 2026-07-13.

| #    | Quyết định                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | **Greenfield.** Next.js + Supabase. Repo XKLĐ chỉ để tham chiếu **bài học**, không port code. Không quay lại .NET/Blazor.                                                                                                                                                                                                                                                                                                                                                                                                          |
| D-2  | **Đúng 3 role:** `super_admin`, `teacher`, `student`. **Không có role phụ huynh** (guardian chỉ là field liên hệ trên hồ sơ HV).                                                                                                                                                                                                                                                                                                                                                                                                   |
| D-3  | **Không CRM tuyển sinh.** Không Lead. Luồng bắt đầu từ tạo hồ sơ học viên.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D-4  | **Không public sign-up.** Super admin invite qua Supabase Auth.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D-5  | **Thông báo một chiều.** Không chat/tin nhắn hai chiều.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D-6  | **Học phí cơ bản** (invoice / payment / receipt). **Không** vay, nợ, thu nợ, khoản chi, kế toán tổng quát. "Còn phải thu" = số dư hóa đơn, **không phải module công nợ**.                                                                                                                                                                                                                                                                                                                                                          |
| D-7  | **AI không thuộc v1.** Backlog phase 2. Không mang Gemini/OCR của web XKLĐ sang.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D-8  | **Hai dòng khóa học song song:** cốt lõi (HSK 1–6, giao tiếp, thiếu nhi, luyện thi) **và** B2B tùy chỉnh (2 chương trình Vietcombank). Lớp VCB **không phải** toàn bộ catalog.                                                                                                                                                                                                                                                                                                                                                     |
| D-9  | **Course ≠ Class ≠ Session.** Ba khái niệm tách bạch. Đây là ranh giới thiết kế quan trọng nhất.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D-10 | ~~Một HV học **nhiều lớp** đồng thời.~~ → **ĐÃ ĐẢO NGƯỢC, xem D-18.** ~~Một lớp có **1 GV chính + n trợ giảng**.~~ → **ĐÃ ĐẢO NGƯỢC, xem D-22.**                                                                                                                                                                                                                                                                                                                                                                                   |
| D-11 | Lớp hỗ trợ `offline / online / hybrid / in_house` + **địa điểm mô tả tự do**. `LOP-01` **lịch linh hoạt, không có recurrence** — đúng nghiệp vụ, không phải thiếu dữ liệu.                                                                                                                                                                                                                                                                                                                                                         |
| D-12 | UI **tiếng Việt**, ngày `dd/MM/yyyy`, hiển thị `Asia/Ho_Chi_Minh`, **DB lưu UTC**.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D-13 | **RLS bật trên mọi bảng, fail-closed.** Ẩn menu ≠ phân quyền. Service role **không bao giờ** dùng cho user flow thường.                                                                                                                                                                                                                                                                                                                                                                                                            |
| D-14 | Repo mới đặt tại `C:\Users\khang\OneDrive\Documents\Polymind Chinese` — **sibling** của POLYMIND APP, không lồng vào repo cũ _(user chốt 2026-07-13)_.                                                                                                                                                                                                                                                                                                                                                                             |
| D-15 | **Local-first.** Chưa có credential cloud → build + test đầy đủ ở local, deploy sau _(user chốt 2026-07-13)_.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-16 | **Hoãn viết test suite** (pgTAP/E2E/unit) — ưu tiên build web hoàn chỉnh trước _(user chốt 2026-07-13)_. **RLS và bảo mật VẪN phải làm đầy đủ** — đó là tính năng, không phải test. Test suite quay lại ở Phase 7.                                                                                                                                                                                                                                                                                                                 |
| D-17 | Footer bản quyền dưới **mọi** trang: `© <năm> Bản quyền thuộc về POLYMIND` + `POLYMIND — Đồng Hành Cùng Bạn Vươn Xa` _(user chốt 2026-07-13)_.                                                                                                                                                                                                                                                                                                                                                                                     |
| D-19 | **HỌC VIÊN RỚT ĐƯỢC HỌC LẠI CHÍNH LỚP ĐÓ** _(user chốt 2026-07-14)_. Gỡ `uq_enrollments_student_class` (migration 23) — ràng buộc cũ cấm ghi danh lại vào một lớp đã từng học, kể cả sau khi rút/hoàn thành. **Không phá D-18:** `ux_enrollments_one_open_per_student` vẫn bảo đảm tối đa MỘT ghi danh đang mở trên toàn hệ thống → không thể có hai ghi danh mở trong cùng lớp. Mỗi lần học là **một enrollment riêng**; điểm danh/điểm/bài nộp treo vào `enrollment_id` nên lịch sử lần trước **không bị trộn** với lần học lại. |
| D-18 | **MỘT HỌC VIÊN CHỈ HỌC MỘT LỚP TẠI MỘT THỜI ĐIỂM** _(user chốt 2026-07-13 — **đảo ngược D-10** và §4.13 của đặc tả gốc)_. "Một thời điểm" = tối đa **một** enrollment đang mở (`pending`/`active`/`paused`). Enrollment đã đóng (`completed`/`withdrawn`/`transferred`) **không tính** → học xong HSK 1 vẫn đăng ký được HSK 2, và chuyển lớp vẫn chạy. Cưỡng chế bằng partial unique index `ux_enrollments_one_open_per_student` (migration 19) — **không** chỉ kiểm ở app.                                                       |
| D-20 | **USER TỰ COMMIT** _(user chốt 2026-07-14)_. Claude Code và Codex **không được tự chạy `git commit` hoặc `git commit --amend`**. Agent để thay đổi trong working tree, báo file đã sửa + kết quả kiểm tra để user tự review và commit. Chỉ ngoại lệ khi user yêu cầu commit rõ ràng trong chính lượt làm việc đó.                                                                                                                                                                                                                  |
| D-21 | **SUPER ADMIN CẤP TÀI KHOẢN TRỰC TIẾP TẠI TRANG QUẢN TRỊ** _(user chốt 2026-07-15)_. Giáo viên/học viên dùng tên đăng nhập + mật khẩu do admin tạo; không bắt buộc Gmail/email và không phụ thuộc email invite. Email thật, nếu có, chỉ là thông tin liên hệ/phục hồi tùy chọn.                                                                                                                                                                                                                                                    |
| D-22 | **BỎ HOÀN TOÀN TRỢ GIẢNG** _(user chốt 2026-07-16 — đảo ngược phần phân công giáo viên của D-10)_. Mỗi lớp chỉ có một giáo viên phụ trách chính; một giáo viên được làm giáo viên chính của nhiều lớp. Phải loại vai trò `assistant` khỏi DB, code, UI, RLS, seed, types, docs và test trong `P7-T9`; chưa được coi hành vi hiện tại đã đổi trước khi forward migration và bộ kiểm tra hoàn tất.                                                                                                                                   |
| D-23 | **TÁCH DÒNG CHƯƠNG TRÌNH VÀ TỰ SINH MÃ** _(user chốt 2026-07-16)_. Course chọn `core` hoặc `business`; chỉ `core` có Loại (`hsk`, `communication`, `kids`, `exam_prep`, `custom`), còn `business` không có Loại. Người dùng không nhập tay mã khóa học, lớp học, giáo viên hoặc học viên; DB tự sinh mã UNIQUE.                                                                                                                                                                                                  |
| D-24 | **LỊCH HỌC DỄ ĐỌC CHO GIÁO VIÊN** _(user chốt 2026-07-16)_. Card Buổi học dùng thời khóa biểu tuần làm mặc định, có nút lùi/tiến tuần và chuyển qua lại giữa `Tối giản`, `Tuần`, `Tháng`; danh sách đánh số buổi hiện tại chỉ nằm trong chế độ Tối giản.                                                                                                                                                                                                                                                                  |
| EX-01 | Thay hoàn toàn luồng bài tập cũ bằng assessment engine; không giữ form nộp text/file chung. |
| EX-02 | Chưa có dữ liệu sử dụng thật; chỉ cleanup dữ liệu demo sau backup/count/smoke. |
| EX-03 | Bài tập và Thi dùng chung Question Bank + Builder nhưng tách module, delivery và attempt. |
| EX-04 | Super Admin quản lý toàn bộ và duyệt câu hỏi global. |
| EX-05 | Câu hỏi mặc định private; hỗ trợ share teacher hoặc gửi duyệt global. |
| EX-06 | Giáo viên chỉ giao/tổ chức cho lớp mình phụ trách theo D-22; DB/RLS cưỡng chế. |
| EX-07 | Bài tập và Kiểm tra/Thi là hai menu riêng, không quản lý chính trong class detail. |
| EX-08 | Học viên làm trực tiếp trên web desktop/mobile. |
| EX-09 | Bài tập v1 không có hint. |
| EX-10 | Thi v1 không access code, shuffle, random, nhiều mã đề; mọi học viên cùng thứ tự. |
| EX-11 | Không có extra-time override theo học viên ở v1. |
| EX-12 | Khung thi bắt buộc cùng ngày `Asia/Ho_Chi_Minh`. |
| EX-13 | Deadline attempt = `min(started_at + duration, closes_at)`. |
| EX-14 | Trang thi chặn copy/cut/paste/drop nhưng không phá Chinese IME. |
| EX-15 | Không webcam, ảnh định kỳ, IP lockdown, locked browser hoặc AI detector. |
| EX-16 | Question Bank hỗ trợ import Excel mẫu, dry-run và all-or-nothing. |
| EX-17 | Unicode/IME/CJK + thanh chèn dấu Pinyin; không tự xây Pinyin-to-Hanzi. |
| EX-18 | Điểm thô quy đổi bài tập về `max_score`, bài thi về thang 100. |
| EX-19 | AI authoring/grading/speaking/fraud detection ngoài phạm vi. |
| EX-20 | Giữ nguyên `grading_scale_rules`, `learning_evaluations`, `student_notes`; thay sáu bảng assignment/assessment cũ. |

---

## 📖 NHẬT KÝ SESSION (mới nhất ở trên, giữ 6 entry)

### [2026-07-16] Phiên 27 — Codex — P7-T11 + P7-T12

- **Làm được:** tách Course thành Chương trình cốt lõi/doanh nghiệp, chỉ cốt lõi có dropdown Loại; loại hẳn `business_custom`; gỡ ô nhập mã khóa/lớp/GV/HV và chuyển sang sequence/default DB. Đổi card Buổi học thành thời khóa biểu Tuần mặc định, có trước/sau/Hôm nay và chuyển Tối giản/Tuần/Tháng; lịch mở ở buổi sắp tới gần nhất. Song song hóa request danh sách lớp + lịch đang chọn; giữ loading overlay giữa màn hình từ P7-T10 và kiểm chung trong build.
- **File thay đổi:** migration 35 + pgTAP; seed/types; course/class/teacher/student form-schema-action; course list/detail; schedule calendar/manager/date helper; unit/component test; docs 01–04/08 và `WORKLOG.md`.
- **Migration/data impact:** migration 35 backfill Course B2B sang `program = business`, `course_type = null`, thay enum để bỏ `business_custom`, thêm constraint và bốn sequence sinh mã. Mã lịch sử/seed giữ nguyên; không hard-delete dữ liệu. Cloud chưa áp migration này.
- **Đã test:** `npm run db:reset` áp sạch 35 migration + production seed · pgTAP **333/333** · dev seed bằng `docker cp`, truy vấn UTF-8 đúng · lint sạch · typecheck sạch · Vitest **82/82** · production build xanh · `git diff --check` sạch.
- **Quyết định mới:** D-23, D-24.
- **Blocker/rủi ro:** phải chạy migration 35 trước khi deploy app; Playwright không chạy lại trong phiên này (mốc gần nhất 20/20). Tháng là màn tổng quan, thao tác hủy/xóa thực hiện ở Tuần hoặc Tối giản.
- **Next action:** P7-T8 → P7-T9 → migrate/redeploy → smoke authenticated P7-T7.

### [2026-07-16] Phiên 26 — Codex — P7-T10

- **Làm được:** memoize `getCurrentUser` trong phạm vi request để layout/page không gọi lặp Auth + profiles; middleware protected route chỉ xác minh JWT và giao role/is_active cho server guard + RLS; song song hóa auth, notification và dữ liệu ở ba dashboard. Thêm loading overlay glass giữa màn hình cho initial load/chuyển route, có reduced-motion và screen-reader status.
- **File thay đổi:** auth/middleware; dashboard layout + 3 dashboard page; `src/app/{loading,(dashboard)/loading}.tsx`; component/test loading; docs 03/04/08 và `WORKLOG.md`.
- **Migration/data impact:** không có migration, không cache dữ liệu authenticated giữa các request/user, không dùng service role và không nới RLS.
- **Đã test:** `npm run lint` sạch · `npm run typecheck` sạch · Vitest **68/68** · production build xanh. `git diff --check` sạch. Playwright không chạy vì Docker Desktop daemon đang tắt; không phải DoD của task không đổi DB này.
- **Quyết định mới:** không có; P7-T10 là tối ưu implementation/UX theo yêu cầu user.
- **Blocker/rủi ro:** mức giảm latency thật trên Production chỉ đo được sau redeploy; middleware vẫn xác minh `getUser()`, mọi Page/Action/Route và RLS vẫn fail-closed. File untracked `docs/09-ke-hoach-trien-khai-module-bai-tap-kiem-tra-thi.md` có sẵn ngoài scope và không bị sửa.
- **Next action:** quay lại P7-T8 → P7-T9 → migrate/redeploy → đo/smoke authenticated P7-T7.

### [2026-07-16] Phiên 25 — Codex — ghi nhận P7-T9

- **Làm được:** ghi nhận yêu cầu mới thành quyết định D-22 và task P7-T9: một giáo viên được phụ trách chính nhiều lớp, mỗi lớp chỉ có một giáo viên, bỏ hoàn toàn trợ giảng.
- **File thay đổi:** `WORKLOG.md`, `docs/08-phase-plan.md`.
- **Migration/data impact:** không có; đây chỉ là ghi chú yêu cầu và kế hoạch. Hệ thống hiện tại vẫn còn `assistant` cho tới khi P7-T9 được triển khai.
- **Đã test:** không chạy lint/typecheck/test/build vì chưa sửa code, schema hay cấu hình.
- **Quyết định mới:** D-22; D-10 được giữ lại dưới dạng lịch sử và đánh dấu phần phân công giáo viên đã bị đảo ngược.
- **Next action:** hoàn thành P7-T8 → triển khai P7-T9 với forward migration + test → migrate/redeploy → smoke P7-T7.

### [2026-07-15] Phiên 24 — Codex — P7-T7 deploy smoke (partial)

- **Làm được:** xác minh URL Production thật trả HTTP 200 cho `/api/health` và `/login`; đọc Auth settings công khai thấy `disable_signup=true`; anonymous vào `/admin`, `/teacher`, `/student` đều 307 về `/login`; cron không có Authorization trả 401. Trước đó cloud đã kiểm đủ 33/33 bảng public bật RLS, 5 bucket private và 16 Storage policy.
- **File thay đổi:** chỉ `WORKLOG.md`; phase plan giữ P7-T7 `◐` vì chưa đủ smoke có đăng nhập.
- **Migration/data impact:** không có migration, không sửa dữ liệu Production.
- **Đã test:** HTTP thật trên `https://polymind-chinese-one.vercel.app`: health 200 · login 200 · ba role route anonymous 307 đúng · cron thiếu secret 401; Auth `/auth/v1/settings` trả `disable_signup=true`.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** phải xác nhận Vercel `NEXT_PUBLIC_APP_URL` khớp domain thật và chạy login 3 role + teacher IDOR + signed upload/download; agent không nhận mật khẩu Production.
- **Next action:** user cập nhật env/redeploy, chạy checklist authenticated smoke và báo kết quả; chỉ khi pass mới đổi P7-T7 sang `☑`.

### [2026-07-15] Phiên 23 — Codex — P6-T6 → P7-T6 (10 task)

- **Làm được:** hoàn thành đúng 10 task: ba cron route/RPC idempotent; báo cáo học phí thực + CSV/XLSX giữ filter; audit viewer read-only; runner payment concurrency; security review + rate limit DB-backed; pgTAP catalog full matrix; E2E sáu kịch bản/ba role; WCAG AA + responsive/touch/keyboard; production build; runbook backup/restore/rollback/migration rehearsal.
- **File thay đổi:** migrations 33–34 + pgTAP; `src/app/api/{cron,export}`, `src/features/{reports,audit,tuition}`, security helpers/headers; admin reports/system; shared a11y controls/layout; Playwright critical-flow + accessibility specs; `docs/testing/{SECURITY_REVIEW,RLS_MATRIX_COVERAGE}.md`, `docs/06-deployment-vercel-supabase.md`, phase plan và WORKLOG.
- **Migration/data impact:** migration 33 thêm 3 RPC cron service-only và notification dedupe; migration 34 thêm bảng private rate-limit + RPC authenticated allowlist. Reset áp sạch đủ 34 migration; seed dev nạp bằng `docker cp`, kiểm UTF-8 hiển thị đúng. Không hard-delete dữ liệu lịch sử, không sửa migration cũ.
- **Đã test:** `npm run lint` sạch · `npm run typecheck` sạch · Vitest **67/67** · `npm run db:reset` xanh · pgTAP **319/319** · payment concurrency thật đạt 1 payment/1 receipt · Playwright **20/20** Chromium desktop + Pixel 7 · `npm run build` xanh với Next 16.2.10.
- **Quyết định mới:** không có; giữ local-first và không deploy khi thiếu credential.
- **Blocker/rủi ro:** P7-T7 vẫn bị BLK-1/BLK-2; npm audit production còn 4 moderate đã phân tích, không có high/critical. Cảnh báo Next `middleware` → `proxy` là deprecation không chặn build.
- **Next action:** **P7-T7** — user cung cấp credential Supabase/Vercel rồi mới rehearsal staging và deploy cloud.

### [2026-07-15] Phiên 22 — Codex — P6-T3 → P6-T5

- **Làm được:** P6-T3 thêm `/student/tuition` chỉ đọc qua RLS, hiển thị khoản mục/số dư/payment/receipt và không có mutation thu tiền. P6-T4 thêm chuông unread ở header, notification center + đánh dấu một/tất cả đã đọc + preferences dùng chung cả ba role; link chỉ render khi là route nội bộ đúng khu vực role. P6-T5 thêm quản lý announcement draft → publish → kết thúc hiệu lực, phạm vi toàn hệ thống/theo lớp, feed cho giáo viên/học viên và phân phối notification đúng audience; không reply/thread/chat, không hard-delete lịch sử.
- **File thay đổi:** `src/features/{tuition,notifications,announcements}/*`, `src/app/(dashboard)/{layout,admin/notifications,teacher/notifications,student/{tuition,notifications,profile}}/*`, `src/components/layout/user-menu.tsx`, `src/lib/permissions/navigation.ts`, `src/types/database.ts`, migrations 31–32, pgTAP notification/announcement, unit test notification link, `docs/{01,02,03,04,08-phase-plan.md}`, `WORKLOG.md`.
- **Migration/data impact:** migration 31 áp preference bằng trigger DB, ép actor thật và thu hẹp UPDATE notification còn `read_at`; migration 32 thêm 3 RPC announcement, khóa direct mutation, thay policy expiry dùng thời gian thực. Không thêm/xóa bảng/cột, không xóa dữ liệu lịch sử. `npm run db:reset` áp sạch đủ 32 migration.
- **Đã test:** lint sạch · typecheck sạch · Vitest **55/55** · pgTAP **284/284** (**16** assertion notification center + **32** announcement workflow/RLS) · build production xanh; `/student/tuition`, `/admin/notifications`, `/teacher/notifications`, `/student/notifications` đều là route động `ƒ`.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** không có blocker P6-T3→T5. BLK-1/BLK-2 vẫn chỉ chặn deploy cloud.
- **Next action:** **P6-T6** — ba cron route + `CRON_SECRET` + `dedupe_key`, kiểm chạy lại không sinh thông báo trùng.
