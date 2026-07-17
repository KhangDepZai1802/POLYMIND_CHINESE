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

> Cập nhật: **2026-07-17** — Claude — P-C Kỹ năng Nói hoàn thành (chưa smoke runtime), lint/typecheck/Vitest 100/build xanh (Phiên 32)

- **P-C — hoàn thành (chưa smoke runtime) — Claude — 2026-07-17.** Kỹ năng Nói: thêm question type `speaking` (đề bằng chữ, HV thu âm trả lời, GV chấm tay điểm tự do). Migration 54 (enum `speaking`) + 55 (auto_score coi speaking là chấm tay; bucket private `answer-media`; bảng `answer_media` + RLS + storage policies; RPC `attach_answer_media`/`clear_answer_media`). Recorder web (MediaRecorder, không giới hạn thời lượng — chỉ hiển thị đồng hồ/độ dài bản ghi): thu âm → nghe lại → **nộp** hoặc **xóa & thu lại** (xóa cả file storage + reset payload). Ký signed URL cho `question_media` prompt_audio (trả nợ P-B — HV nghe được audio Nghe/Chép) và cho audio bài Nói ở màn làm bài/chấm. Wizard mở kỹ năng Nói. Lint/typecheck sạch · Vitest **100/100** · build xanh. **CHƯA smoke** (Docker/dev tắt) — cần chạy migration 54–55 rồi kiểm mic/upload/nghe lại/xóa/chấm thật.
- **P-B — hoàn thành (chưa smoke runtime) — Claude — 2026-07-17.** Thay dialog "Tạo câu hỏi" bằng wizard nhiều bước kiểu Kahoot: chọn kỹ năng (Nghe/Đọc/Viết/Từ vựng/Ngữ pháp — **hoãn Nói sang P-C**) → chọn dạng câu hợp kỹ năng → editor riêng từng dạng (option đánh dấu đúng, partial-credit cho multi, đáp án chấp nhận, token, rubric) + upload/player audio cho Nghe/Chép + thanh chèn dấu Pinyin → xem trước bằng renderer thật → lưu & công bố. Backend module (migration 38–53) không đổi; chỉ redesign UI authoring + wiring question_media. Lint/typecheck sạch · Vitest **98/98** · build xanh. **Gap đã biết:** `get_*_attempt_payload` chưa ký signed URL cho question_media nên học viên chưa nghe được audio (thuộc delivery/P-C); wizard tạm loại `matching` + `reading_group` vì renderer chưa render được (cần nâng renderer sau).
- **Điều hướng đánh giá — hoàn thành (chưa smoke runtime) — Claude — 2026-07-17.** Thanh tab dùng chung cho 3 màn của cả Bài tập và Thi (hết cảnh "kẹt" ở Ngân hàng câu hỏi/Bộ); gỡ hẳn import Excel (đảo EX-16). Lint/typecheck/Vitest 91/build xanh. Redesign soạn câu hỏi theo kỹ năng đã bàn nhưng hoãn theo yêu cầu user.
- **P7-T8b — hoàn thành (chưa smoke runtime) — Claude — 2026-07-17.** `/admin/system` thành 2 tab Quản trị | Nhật ký audit; tab Quản trị liệt kê mọi tài khoản theo role (super_admin/teacher/student) kèm tên đăng nhập + mã + trạng thái, đổi username + mật khẩu và khóa/mở ngay tại đó (dùng lại `provisionPasswordAccount`/`setUserActive`, không migration). Lint/typecheck/test 91/91/build xanh; **chưa smoke bằng trình duyệt** vì Docker/dev server đang tắt.
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

**Smoke P-C + migrate/redeploy.** P-C đã code xong (chưa smoke). Bước tiếp: bật Docker → `npx supabase db reset` (áp migration 54–55) → `npm run dev` → smoke Nói đủ luồng: soạn câu Nói (wizard), HV thu âm/nghe lại/xóa & thu lại/nộp, GV nghe + chấm điểm tự do, công bố; đồng thời xác minh HV **nghe được audio Nghe/Chép** (signed URL). Sau đó migrate cloud + redeploy. Song song: `P7-T8` (admin cấp tài khoản) → `P7-T9` → smoke `P7-T7`.

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
| EX-16 | ~~Question Bank hỗ trợ import Excel mẫu, dry-run và all-or-nothing.~~ **ĐÃ ĐẢO (user chốt 2026-07-17):** gỡ hẳn import Excel khỏi UI; RPC DB `import_questions` để nguyên nhưng không còn lối vào. |
| EX-17 | Unicode/IME/CJK + thanh chèn dấu Pinyin; không tự xây Pinyin-to-Hanzi. |
| EX-18 | Điểm thô quy đổi bài tập về `max_score`, bài thi về thang 100. |
| EX-19 | AI authoring/grading/speaking/fraud detection ngoài phạm vi. |
| EX-20 | Giữ nguyên `grading_scale_rules`, `learning_evaluations`, `student_notes`; thay sáu bảng assignment/assessment cũ. |

---

## 📖 NHẬT KÝ SESSION (mới nhất ở trên, giữ 6 entry)

### [2026-07-17] Phiên 32 — Claude — P-C Kỹ năng Nói (speaking + recorder + chấm + signed URL)

- **Làm được:** Mở kỹ năng **Nói** (`speaking`) end-to-end. (1) Dạng câu `speaking`: đề bằng chữ, HV thu âm trả lời, GV **chấm tay điểm tự do** (auto_score coi như essay → `pending_manual_grading`). (2) Recorder web (MediaRecorder, ưu tiên webm/opus, rơi về mp4): thu âm hiển thị đồng hồ đếm lên, **không giới hạn/không auto-dừng** (HV tự bấm Dừng) → **nghe lại** (kèm độ dài bản ghi) → **Nộp** hoặc **Xóa & thu lại** (xóa cả object storage + reset answer_payload qua RPC). (3) Bucket private `answer-media` + bảng `answer_media` (ánh xạ object_path→lượt→lớp) + RLS (HV sở hữu, GV dạy lớp/super_admin đọc) + storage policies; RPC `attach_answer_media` (tái dùng `save_*` để kiểm chủ lượt/hạn giờ, fail-closed) và `clear_answer_media`. (4) **Trả nợ P-B:** ký signed URL cho `question_media` prompt_audio trong payload lượt làm/thi → HV **nghe được** audio Nghe/Chép; ký cả audio bài Nói ở màn làm bài (nghe lại) và màn chấm (GV nghe). Wizard: mở thẻ Nói (bỏ nhãn "Sắp có").
- **File thay đổi:** migration `20260717000054_question_type_speaking.sql`, `20260717000055_speaking_answer_media.sql`; thêm `src/features/question-builder/renderers/speaking-recorder.tsx`, `src/features/assessment-results/server/{speaking-upload,audio-signing}.ts`; sửa `question-builder/domain/questions.ts`, `question-builder/renderers/question-renderer.tsx`, `question-bank/components/question-wizard.tsx`, `exercises/server/{actions,queries}.ts`, `exams/server/{actions,queries}.ts`, `exercises/student/exercise-attempt.tsx`, `exams/student/exam-attempt.tsx`, `assessment-results/components/grading-workspace.tsx`, `src/types/database.ts`; test `tests/unit/domain/assessment-engine.test.ts`; `WORKLOG.md`, `docs/09-*.md`.
- **Migration/data impact:** 2 migration mới (54 enum tách riêng để commit trước; 55 phần còn lại). Bucket mới `answer-media` (25 MB, private). Không đụng dữ liệu cũ; module assessment (38–53) giữ nguyên, chỉ mở rộng.
- **Đã test:** `npm run lint` sạch · `npm run typecheck` sạch · Vitest **100/100** (thêm 2, sửa 2 test P-B cũ) · `npm run build` xanh. **CHƯA** smoke trình duyệt (Docker/dev tắt) → chưa áp migration 54–55, chưa kiểm mic/upload/nghe lại/xóa/chấm/signed-URL thật.
- **Quyết định mới:** không đổi quyết định đã chốt. Phạm vi P-C do user chốt 2026-07-17: câu Nói = đề chữ (không audio mẫu), chấm tay điểm tự do; recorder phải có nghe lại + xóa & thu lại.
- **Hotfix prod (cùng phiên):** Deploy đầu tiên sau Phiên 29–32 làm **mọi trang dashboard 500** với `Error: Functions cannot be passed directly to Client Components` (digest 1621801304, thấy ở Vercel runtime log `/teacher`, `/teacher/exercises`). Nguyên nhân: `sidebar-nav.tsx` là **Server Component** truyền `items` (mỗi item có `icon` là component Lucide/forwardRef) sang client `NavLinks` → RSC không serialize được (chỉ lộ ở prod, `next build` không bắt vì route động render theo request). **Không liên quan P-C** — là hồi quy từ refactor nav Phiên 29. Sửa: thêm `"use client"` vào `sidebar-nav.tsx` (giống `mobile-nav.tsx` vốn đã an toàn). Lint/typecheck/Vitest/build vẫn xanh. **Cần commit + push để Vercel redeploy.**
- **Blocker/rủi ro:** (1) Chưa smoke runtime — cần bật Docker, `db reset`, kiểm quyền micro trên trình duyệt thật. (2) `matching` + `reading_group` vẫn tạm loại khỏi wizard (nợ từ P-B, renderer chưa render câu con/nối cặp).
- **Next action:** smoke P-C đủ luồng → migrate/redeploy cloud; song song P7-T8 → P7-T9 → smoke P7-T7.

### [2026-07-17] Phiên 31 — Claude — P-B wizard soạn câu hỏi theo kỹ năng

- **Làm được:** Thay dialog "Tạo câu hỏi" một-ô bằng **wizard nhiều bước theo kỹ năng** (Kahoot-style): Bước 1 chọn kỹ năng (Nghe/Đọc/Viết/Từ vựng/Ngữ pháp — **hoãn Nói sang P-C**, hiện nhãn "Sắp có") → Bước 2 chọn dạng câu hợp kỹ năng → Bước 3 editor riêng từng dạng (lựa chọn có radio/checkbox đánh dấu đúng, partial-credit cho multi, đáp án chấp nhận, token thứ tự, rubric tự luận) + **upload + player audio ngay trong editor** cho Nghe/Chép + **thanh chèn dấu Pinyin** (拼) trên mọi ô chữ → Bước 4 xem trước bằng `QuestionRenderer` thật rồi lưu & công bố. Một server action `saveQuestionAction` lo cả tạo mới lẫn tạo version mới: tạo question → `create_question_version` (trả version id) → upload audio vào bucket `question-media` + ghi `question_media` cho version → `publish_question_version`. Sửa bug tiềm ẩn: `true_false` lưu answer_key dạng **chuỗi** `"true"/"false"` để khớp renderer (code cũ lưu boolean → không bao giờ chấm đúng).
- **File thay đổi:** thêm `src/features/question-bank/components/{question-wizard,pinyin-tone-bar}.tsx`; sửa `src/features/question-builder/domain/questions.ts` (SKILL map + `structuredContentSchema` + `buildStructuredPayload`), `src/features/question-bank/server/actions.ts` (thay `createQuestionAction`/`createQuestionVersionAction` bằng `saveQuestionAction`), `src/features/question-bank/components/question-bank-page.tsx`; xóa `question-form.tsx`, `question-version-form.tsx`, `question-media-upload.tsx`; thêm test ở `tests/unit/domain/assessment-engine.test.ts`; `WORKLOG.md`, `docs/09-*.md`.
- **Migration/data impact:** KHÔNG có migration. Chỉ redesign UI authoring trên module đã ship (migration 38–53); dữ liệu/RPC/RLS không đổi. Audio upload dùng đúng policy `question_media_owner_insert` + `question_media_owner_write` sẵn có (path folder = `auth.uid()`).
- **Đã test:** `npm run lint` sạch · `npm run typecheck` sạch · Vitest **98/98** (thêm 7) · `npm run build` xanh (đủ route question-bank 2 module). **CHƯA** smoke trình duyệt (Docker/dev server tắt).
- **Quyết định mới:** không đổi quyết định đã chốt. Phạm vi P-B do user chốt 2026-07-17: hoãn Nói sang P-C, thay hẳn dialog bằng wizard.
- **Blocker/rủi ro:** (1) **Audio chưa tới học viên** — `get_exercise_attempt_payload`/`get_exam_attempt_payload` trả `prompt_content` thô, chưa ký signed URL cho `question_media` → player chỉ chạy trong editor GV; cần nâng payload RPC/query (gộp vào P-C). (2) Wizard tạm **loại `matching` + `reading_group`** vì renderer chưa render câu con/nối cặp đáng tin — cần nâng renderer rồi mở lại.
- **Next action:** P-C (Nói: enum + bucket + recorder + chấm) kèm ký signed URL audio cho payload; song song P7-T8 → P7-T9 → migrate/redeploy → smoke P7-T7.

### [2026-07-17] Phiên 30 — Claude — tab điều hướng Bài tập & Thi + gỡ import Excel

- **Làm được:** (1) Thêm thanh tab dùng chung `AssessmentTabs` cho **cả hai** module: Bài tập (Giao bài tập · Ngân hàng câu hỏi · Bộ bài tập) và Kiểm tra/Thi (Lên lịch thi · Ngân hàng câu hỏi · Bộ đề). Trước đây vào Ngân hàng câu hỏi / Bộ là "kẹt", không có đường qua tab khác; nay 3 màn của mỗi module đều có thanh tab, active theo tiền tố route dài nhất nên trang chi tiết `[deliveryId]` vẫn sáng tab gốc. Gỡ 2 nút link trùng trong exercise-dashboard + exam-dashboard. (2) **Gỡ hẳn import Excel** khỏi Ngân hàng câu hỏi (xóa `question-import.tsx`, `importQuestionsAction`, route `/api/question-import-template`) theo yêu cầu user — đảo EX-16.
- **File thay đổi:** thêm `src/components/shared/assessment-tabs.tsx`; sửa `src/app/(dashboard)/teacher/{exercises,exams}/page.tsx`, `src/features/{exercises,exams}/teacher/{exercise,exam}-dashboard.tsx`, `src/features/question-bank/components/question-bank-page.tsx`, `src/features/question-builder/components/sets-page.tsx`, `src/features/question-bank/server/actions.ts`; xóa `src/features/question-bank/components/question-import.tsx` + `src/app/api/question-import-template/`.
- **Migration/data impact:** KHÔNG có migration. RPC DB `import_questions` để nguyên (chỉ gỡ lối vào UI) nên pgTAP không đổi; `exceljs` vẫn dùng ở reports/export nên giữ dependency.
- **Đã test:** `npm run lint` sạch · `npm run typecheck` sạch (sau khi xóa `.next` cache stale) · Vitest **91/91** · `npm run build` xanh, đủ 6 route `/teacher/{exercises,exams}/{,question-bank,sets}`. **CHƯA** smoke trình duyệt.
- **Quyết định mới:** đảo EX-16 — Ngân hàng câu hỏi không còn import Excel (user chốt 2026-07-17). Redesign soạn câu hỏi theo kỹ năng (Nghe/Nói/Đọc/Viết, wizard kiểu Kahoot, player audio trong editor) đã bàn nhưng **hoãn**: user chỉ chốt làm tab lần này; các lựa chọn cho lần sau: Nói = ghi âm web + upload, chỉ audio (không video mp4).
- **Blocker/rủi ro:** không có blocker mới; chờ smoke runtime 2 module.
- **Next action:** khi user duyệt → làm P-B (wizard soạn câu hỏi theo kỹ năng + upload/player trong editor) rồi P-C (kỹ năng Nói: enum + bucket bài nộp + RLS + recorder + chấm).

### [2026-07-17] Phiên 29 — Claude — sửa điều hướng (sidebar sticky + menu mobile đủ module)

- **Làm được:** (1) Sidebar desktop nay **dính theo cuộn** (`sticky top-0 h-svh self-start`), cuộn sâu vẫn thấy menu; menu dài (super_admin 11 mục) tự cuộn trong khung. (2) **Bỏ bottom nav mobile** vốn chỉ hiện ≤5 mục (super_admin thiếu còn 4, teacher còn 5) — thay bằng **nút hamburger** ở header mở drawer (Sheet trái) liệt kê **TOÀN BỘ** module đúng theo role (super_admin 11 · teacher 7 · student 7). Tách `NavLinks` dùng chung cho sidebar + drawer để không lệch hai nơi.
- **File thay đổi:** thêm `src/components/layout/{nav-links,mobile-nav}.tsx`; sửa `src/components/layout/sidebar-nav.tsx` (bỏ "use client", sticky, dùng NavLinks); xóa `src/components/layout/bottom-nav.tsx`; sửa `src/app/(dashboard)/layout.tsx` (gắn hamburger vào header, bỏ BottomNav, footer `pb-6`); gọn `src/lib/permissions/navigation.ts` (bỏ cờ `mobile`/`getMobileNavigation`); cập nhật `tests/unit/permissions/navigation.test.ts` và `tests/e2e/accessibility-responsive.spec.ts` (mobile mở drawer mới kiểm nav).
- **Migration/data impact:** KHÔNG có — thuần UI điều hướng. Menu chỉ là hiển thị; phân quyền thật vẫn ở middleware + server action + RLS (không đụng).
- **Đã test:** `npm run lint` sạch · `npm run typecheck` sạch · Vitest **91/91** · `npm run build` xanh. Nút hamburger `size-11` = 44px đạt touch target. **CHƯA** smoke trình duyệt (Docker/dev server tắt); cần user mở app kiểm mắt drawer 3 role và sidebar sticky.
- **Quyết định mới:** đảo quyết định cũ "bottom nav tối đa 5 mục" theo yêu cầu user 2026-07-17 (mobile phải truy cập đủ module qua drawer hamburger).
- **Blocker/rủi ro:** không có blocker mới; chờ smoke runtime.
- **Next action:** smoke runtime menu mới; sau đó quay lại P7-T8b/P7-T8 → P7-T9.

### [2026-07-17] Phiên 28 — Claude — P7-T8b (trang Quản trị tài khoản)

- **Làm được:** Biến `/admin/system` thành 2 tab "Quản trị | Nhật ký audit". Tab Quản trị liệt kê MỌI tài khoản của cả 3 role, mỗi role một bảng, có ô tìm theo tên/tên đăng nhập/email; mỗi dòng hiện họ tên, **tên đăng nhập**, mã GV/HV, liên hệ, trạng thái và menu "Đổi đăng nhập / mật khẩu" + "Khóa/Mở". Chặn tự khóa chính mình; khóa GV đồng bộ `teachers.is_active`. Làm rõ với user: mật khẩu cũ KHÔNG hiển thị lại được (hash một chiều) — chỉ đặt mới.
- **File thay đổi:** thêm `src/features/accounts/{schema.ts, server/queries.ts, server/actions.ts, components/{account-row-actions,accounts-view,system-tabs}.tsx}`; thêm `src/features/audit/components/audit-log-view.tsx`; viết lại `src/app/(dashboard)/admin/system/page.tsx`; thêm `tests/unit/domain/account-management.test.ts`; `WORKLOG.md`, `docs/08-phase-plan.md`.
- **Migration/data impact:** KHÔNG có migration. Dùng lại `provisionPasswordAccount` và `setUserActive` sẵn có; đọc `profiles` qua RLS `for all` của super_admin (không service role cho user flow ngoài phần Auth Admin vốn có).
- **Đã test:** `npm run lint` sạch · `npm run typecheck` sạch · Vitest **91/91** (thêm 4) · `npm run build` xanh, `/admin/system` là route động `ƒ`. **CHƯA** smoke trình duyệt: Docker Desktop tắt, `supabase start`/`npm run dev` chưa chạy.
- **Quyết định mới:** không có (bám D-21; mật khẩu không lưu dạng đọc-được theo luật bảo mật).
- **Blocker/rủi ro:** cần user bật Docker → `npx supabase start` → `npm run dev`, đăng nhập admin, mở `/admin/system` để xác minh hiển thị đúng tên đăng nhập GV Quách Duy Khang và thao tác đổi mật khẩu/khóa chạy thật.
- **Next action:** smoke runtime P7-T8b; sau đó P7-T9 → migrate/redeploy → smoke authenticated P7-T7.

### [2026-07-16] Phiên 27 — Codex — P7-T11 + P7-T12

- **Làm được:** tách Course thành Chương trình cốt lõi/doanh nghiệp, chỉ cốt lõi có dropdown Loại; loại hẳn `business_custom`; gỡ ô nhập mã khóa/lớp/GV/HV và chuyển sang sequence/default DB. Đổi card Buổi học thành thời khóa biểu Tuần mặc định, có trước/sau/Hôm nay và chuyển Tối giản/Tuần/Tháng; lịch mở ở buổi sắp tới gần nhất. Song song hóa request danh sách lớp + lịch đang chọn; giữ loading overlay giữa màn hình từ P7-T10 và kiểm chung trong build.
- **File thay đổi:** migration 35 + pgTAP; seed/types; course/class/teacher/student form-schema-action; course list/detail; schedule calendar/manager/date helper; unit/component test; docs 01–04/08 và `WORKLOG.md`.
- **Migration/data impact:** migration 35 backfill Course B2B sang `program = business`, `course_type = null`, thay enum để bỏ `business_custom`, thêm constraint và bốn sequence sinh mã. Mã lịch sử/seed giữ nguyên; không hard-delete dữ liệu. Cloud chưa áp migration này.
- **Đã test:** `npm run db:reset` áp sạch 35 migration + production seed · pgTAP **333/333** · dev seed bằng `docker cp`, truy vấn UTF-8 đúng · lint sạch · typecheck sạch · Vitest **82/82** · production build xanh · `git diff --check` sạch.
- **Quyết định mới:** D-23, D-24.
- **Blocker/rủi ro:** phải chạy migration 35 trước khi deploy app; Playwright không chạy lại trong phiên này (mốc gần nhất 20/20). Tháng là màn tổng quan, thao tác hủy/xóa thực hiện ở Tuần hoặc Tối giản.
- **Next action:** P7-T8 → P7-T9 → migrate/redeploy → smoke authenticated P7-T7.

