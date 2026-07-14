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
6. **KHÔNG ĐƯỢC:** ghi "pass/done/verified/deployed" khi chưa chạy thật · sửa test cho nó xanh thay vì sửa code · tự đổi quyết định đã chốt · commit secret.

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

> Cập nhật: **2026-07-14** — Claude — P3-T3

- **Phase 0 XONG** · **Phase 1 XONG** · **Phase 2 XONG**. Repo: `Documents\Polymind Chinese`, git `main`, đã push GitHub.
- **P3-T8 — xong — Claude — 2026-07-14.** Vòng đời ghi danh qua RPC (ghi danh / tạm dừng / học lại / hoàn thành / rút / chuyển lớp), giữ history, tôn trọng D-18.
- **P3-T7 — xong — Claude — 2026-07-14.** Lịch lặp + sinh buổi học (idempotent) + lớp linh hoạt không lịch. Trang `/admin/schedule` đã thật (bỏ ComingSoon). Migration 22 chốt attribution + chặn xóa buổi đã có lịch sử.
- **P3-T3 — xong — Claude — 2026-07-14.** Tài liệu khóa học: upload thẳng lên private bucket (signed upload URL), signed URL tải xuống, `visibility`. Migration 21 chốt attribution ở DB.
- **P3-T6 — xong — Codex — 2026-07-13.** CRUD lớp + phân công GV, có chốt chặn DB giữ điều kiện lớp `active`.
- **DB: 22 migration.** pgTAP **16/16 pass** (3 file). Unit test **28/28 pass**.
- **Phase 3 còn: P3-T9 (Admin dashboard KPI) · P3-T10 (unit test domain — phần enrollment transitions đã làm ở P3-T8).**
- **GitHub:** https://github.com/KhangDepZai1802/POLYMIND_CHINESE
- App chạy được: Next.js 16 + TS strict + Tailwind v4 + shadcn/ui. Auth SSR (login/forgot/reset/invite), app shell 3 role, logo PolyMind, footer bản quyền.
- **DB: 20 migration + seed chạy sạch.** 33 bảng, **0 bảng thiếu RLS**, 98 policy, 5 view, 7 RPC, 5 private bucket.
- **RLS đã kiểm chứng THẬT qua HTTP API** (Supabase Auth → JWT → PostgREST): GV A chỉ thấy LOP-01/02 + HV001–004 (không thấy HV005), học phí 0 dòng, audit 0 dòng; HV5 chỉ thấy LOP-03 + chính mình; anonymous bị chặn ở tầng GRANT.
- ⚠️ **Test suite đang HOÃN theo yêu cầu user** (2026-07-13): ưu tiên build web hoàn chỉnh trước. RLS/bảo mật vẫn làm đầy đủ — đó là tính năng, không phải test.
- Môi trường: Node 22.20 · npm 10.9 · Docker 28.4 · Supabase local **port 553xx** (543xx bị Windows reserve).

---

## ➡️ VIỆC TIẾP THEO

**`P3-T9` — Admin dashboard**: KPI thật lấy từ 5 view có sẵn (`v_enrollment_progress` · `v_class_progress` · `v_student_attendance_summary` · `v_at_risk_students` · `v_tuition_balance`) — **không tự viết lại phép tính** ở tầng app, view đã là nguồn sự thật. Xem `docs/01` §15 để biết KPI nào phải hiện.

Sau P3-T9: **P3-T10** (unit test domain còn thiếu: recurrence 35 buổi · capacity. Phần **enrollment transitions đã có** `tests/unit/domain/enrollment.test.ts` từ P3-T8).

⚠️ **Câu hỏi nghiệp vụ cần user chốt (không tự quyết):** `uq_enrollments_student_class` (migration 04) cấm một học viên ghi danh **lại vào chính lớp cũ** — kể cả sau khi đã rút hoặc hoàn thành. Nghĩa là **học lại đúng lớp đó (retake) là không thể**; phải mở lớp mới. Nếu trung tâm có nghiệp vụ học lại thì cần forward-fix ràng buộc này. Hiện app báo lỗi rõ ràng chứ không ném lỗi DB thô.

Mục tiêu Phase 3: super admin đi trọn được **Course → Class → Schedule → sinh buổi → gán GV → Enrollment**.

Nền đã sẵn sàng để dùng ngay:
- 7 RPC: `enroll_student` (khóa hàng chống vượt sĩ số) · `transfer_enrollment` · `change_enrollment_status` · `generate_class_sessions` (idempotent) · `bulk_mark_attendance` (upsert) · `publish_assessment_results` · `record_tuition_payment` (sinh đúng 1 phiếu thu).
- 5 view: `v_enrollment_progress` · `v_class_progress` · `v_student_attendance_summary` · `v_at_risk_students` · `v_tuition_balance`.
- Types: `src/types/database.ts` đã generate từ schema thật (`npm run db:types`).

Xem chi tiết task ở [`docs/08-phase-plan.md`](docs/08-phase-plan.md).

**Tài khoản demo (chỉ local):** `admin@polymind.test` · `gv.a@polymind.test` · `gv.b@polymind.test` · `hv1..hv5@polymind.test` — mật khẩu `Polymind@2026`.
Chạy: `npx supabase start` → `npx supabase db reset` → nạp `supabase/seed.dev.sql` → `npm run dev`.

---

## ⛔ BLOCKERS

| ID | Blocker | Ảnh hưởng | Cần gì để gỡ |
|---|---|---|---|
| BLK-1 | **Chưa có credential Supabase cloud** (project URL, publishable key, service role key, DB password) | `P7-T7` deploy không làm được. Phase 1–6 **không** bị chặn — dev bằng Supabase local trên Docker | User tạo project trên supabase.com → đưa 4 giá trị vào `.env.local` |
| BLK-2 | **Chưa có tài khoản Vercel** | `P7-T7` deploy không làm được | User tạo tài khoản Vercel + link repo |

> **Hệ quả:** cho tới khi BLK-1/BLK-2 được gỡ, trạng thái dự án là **"ready to deploy, blocked by credentials"** — **KHÔNG** được gọi là "đã deploy".

---

## 🔒 QUYẾT ĐỊNH ĐÃ CHỐT (không tự đổi — vướng thì hỏi user)

Nguồn gốc: [`POLYMIND_CHINESE_BUILD_PROMPT.md`](POLYMIND_CHINESE_BUILD_PROMPT.md) §4, và các câu hỏi đã hỏi user 2026-07-13.

| # | Quyết định |
|---|---|
| D-1 | **Greenfield.** Next.js + Supabase. Repo XKLĐ chỉ để tham chiếu **bài học**, không port code. Không quay lại .NET/Blazor. |
| D-2 | **Đúng 3 role:** `super_admin`, `teacher`, `student`. **Không có role phụ huynh** (guardian chỉ là field liên hệ trên hồ sơ HV). |
| D-3 | **Không CRM tuyển sinh.** Không Lead. Luồng bắt đầu từ tạo hồ sơ học viên. |
| D-4 | **Không public sign-up.** Super admin invite qua Supabase Auth. |
| D-5 | **Thông báo một chiều.** Không chat/tin nhắn hai chiều. |
| D-6 | **Học phí cơ bản** (invoice / payment / receipt). **Không** vay, nợ, thu nợ, khoản chi, kế toán tổng quát. "Còn phải thu" = số dư hóa đơn, **không phải module công nợ**. |
| D-7 | **AI không thuộc v1.** Backlog phase 2. Không mang Gemini/OCR của web XKLĐ sang. |
| D-8 | **Hai dòng khóa học song song:** cốt lõi (HSK 1–6, giao tiếp, thiếu nhi, luyện thi) **và** B2B tùy chỉnh (2 chương trình Vietcombank). Lớp VCB **không phải** toàn bộ catalog. |
| D-9 | **Course ≠ Class ≠ Session.** Ba khái niệm tách bạch. Đây là ranh giới thiết kế quan trọng nhất. |
| D-10 | ~~Một HV học **nhiều lớp** đồng thời.~~ → **ĐÃ ĐẢO NGƯỢC, xem D-18.** Một lớp có **1 GV chính + n trợ giảng** *(phần này không đổi)*. |
| D-11 | Lớp hỗ trợ `offline / online / hybrid / in_house` + **địa điểm mô tả tự do**. `LOP-01` **lịch linh hoạt, không có recurrence** — đúng nghiệp vụ, không phải thiếu dữ liệu. |
| D-12 | UI **tiếng Việt**, ngày `dd/MM/yyyy`, hiển thị `Asia/Ho_Chi_Minh`, **DB lưu UTC**. |
| D-13 | **RLS bật trên mọi bảng, fail-closed.** Ẩn menu ≠ phân quyền. Service role **không bao giờ** dùng cho user flow thường. |
| D-14 | Repo mới đặt tại `C:\Users\khang\OneDrive\Documents\Polymind Chinese` — **sibling** của POLYMIND APP, không lồng vào repo cũ *(user chốt 2026-07-13)*. |
| D-15 | **Local-first.** Chưa có credential cloud → build + test đầy đủ ở local, deploy sau *(user chốt 2026-07-13)*. |
| D-16 | **Hoãn viết test suite** (pgTAP/E2E/unit) — ưu tiên build web hoàn chỉnh trước *(user chốt 2026-07-13)*. **RLS và bảo mật VẪN phải làm đầy đủ** — đó là tính năng, không phải test. Test suite quay lại ở Phase 7. |
| D-17 | Footer bản quyền dưới **mọi** trang: `© <năm> Bản quyền thuộc về POLYMIND` + `POLYMIND — Đồng Hành Cùng Bạn Vươn Xa` *(user chốt 2026-07-13)*. |
| D-18 | **MỘT HỌC VIÊN CHỈ HỌC MỘT LỚP TẠI MỘT THỜI ĐIỂM** *(user chốt 2026-07-13 — **đảo ngược D-10** và §4.13 của đặc tả gốc)*. "Một thời điểm" = tối đa **một** enrollment đang mở (`pending`/`active`/`paused`). Enrollment đã đóng (`completed`/`withdrawn`/`transferred`) **không tính** → học xong HSK 1 vẫn đăng ký được HSK 2, và chuyển lớp vẫn chạy. Cưỡng chế bằng partial unique index `ux_enrollments_one_open_per_student` (migration 19) — **không** chỉ kiểm ở app. |

---

## 📖 NHẬT KÝ SESSION (mới nhất ở trên, giữ 6 entry)

### [2026-07-14] Phiên 5 — Claude — P3-T8 (Enrollment lifecycle)
- **Làm được:** Thẻ "Học viên" ở trang chi tiết lớp thành `EnrollmentPanel` thật: ghi danh, tạm dừng, cho học lại, xác nhận hoàn thành, rút học, **chuyển lớp**, xem **lịch sử** đổi trạng thái. Mọi thao tác **đi qua RPC**, không có đường `update()` thẳng nào. Mỗi lần đổi trạng thái đều hỏi **lý do** → ghi vào `enrollment_status_history` (append-only) trong cùng transaction.
- **Luật vòng đời tách ra `lib/domain/enrollment.ts`** (thuần, có unit test, **fail-closed**: trạng thái lạ → không cho làm gì). UI chỉ hiện nút theo `allowedEnrollmentTransitions()`; không ai đi thẳng sang `transferred` (chỉ RPC chuyển lớp được đặt).
- **File thay đổi:** `src/lib/domain/enrollment.ts` (mới), `src/features/enrollments/*` (mới: schema, queries, actions, `enrollment-panel.tsx`), `src/app/(dashboard)/admin/classes/[id]/page.tsx` (thay thẻ Học viên tĩnh của Codex bằng panel; bỏ bản sao `OPEN_ENROLLMENT_STATUSES` trùng lặp), `tests/unit/domain/enrollment.test.ts` (mới), `docs/08-phase-plan.md`.
- **Migration/data impact:** **không có migration mới.** Dùng đúng 3 RPC + partial unique index đã có từ Phase 2 / migration 19.
- **Đã test (THẬT, có số):** `lint` sạch · `typecheck` sạch · `npm test` **28/28** (thêm 8 test enrollment) · `build` xanh. **Smoke Chrome headless qua UI thật: 14/14 PASS** — ghi danh → `started_on`/`created_by` do RPC đặt → lịch sử ghi ngay → **D-18: RPC từ chối ghi danh lớp thứ hai** ("Học viên đang học lớp LOP-01…") → **sĩ số: RPC từ chối khi lớp đầy** ("Lớp đã đủ sĩ số (2/2)") → tạm dừng → học lại → rút học (`ended_on` được đặt) → lịch sử đủ **4 chặng, có lý do** → trạng thái cuối không đổi tiếp được → ghi danh đã đóng **không** tính vào D-18 nên HV học được lớp mới. **Chuyển lớp qua UI: 4/4 PASS** — ghi danh cũ thành `transferred` (**không** bị xóa), mở ghi danh mới ở lớp đích, vẫn đúng 1 ghi danh mở, history ghi 2 dòng, audit có `enrollment.transfer`.
- **Quyết định mới:** không có.
- **Bài học khi test (ghi lại cho phiên sau):** seed **đã ghi danh sẵn** HV001–HV005 vào LOP-01/02/03. Script smoke ban đầu dùng `.first()` để bấm nút nên **bấm nhầm vào hàng HV004 của seed** và làm hỏng dữ liệu seed (phải `db reset` khôi phục). Khi viết smoke: **luôn neo thao tác vào đúng hàng của học viên thử** (dùng `aria-label` "Lịch sử của <tên>"), đừng dùng `.first()`.
- **Blocker/rủi ro:** BLK-1/BLK-2 vẫn chỉ chặn deploy cloud. **Câu hỏi nghiệp vụ cần user chốt:** `uq_enrollments_student_class` cấm ghi danh lại vào **chính lớp cũ** → không hỗ trợ "học lại đúng lớp đó" (xem mục VIỆC TIẾP THEO).
- **Next action:** **P3-T9** — Admin dashboard KPI từ 5 view.

### [2026-07-14] Phiên 4 — Claude — P3-T7 (Schedule + sinh buổi học)
- **Làm được:** `/admin/schedule` thành trang thật (trước là ComingSoon): chọn lớp qua URL (`?class=`), CRUD lịch lặp (thứ + khung giờ + khoảng áp dụng), nút **Sinh buổi học** gọi RPC `generate_class_sessions`, danh sách buổi học (giờ VN), thêm buổi thủ công, hủy buổi, xóa buổi sinh nhầm. Link "Quản lý lịch" mà Codex đặt sẵn ở trang chi tiết lớp giờ đã trỏ tới trang có thật.
- **Lớp linh hoạt (D-11):** lớp không có lịch lặp hiện thông báo rõ "đây là trạng thái hợp lệ, không phải thiếu dữ liệu", khóa nút sinh buổi và chỉ đường sang "Thêm buổi" thủ công. RPC trả 0 buổi — UI **không** coi đó là lỗi.
- **File thay đổi:** `src/features/schedules/*` (mới: schema, queries, actions, `schedule-manager.tsx`, `class-picker.tsx`), `src/app/(dashboard)/admin/schedule/page.tsx`, `src/components/shared/submit-button.tsx` (thêm prop `disabled`, thuần cộng thêm), `supabase/migrations/20260713000022_session_integrity.sql` (mới), `supabase/tests/database/session_integrity.test.sql` (mới), `docs/02-database-design.md`, `docs/08-phase-plan.md`.
- **Migration/data impact:** migration 22 — (a) `class_sessions.created_by` = `auth.uid()` khi INSERT (chỉ ghi đè khi có JWT, để seed chạy bằng `postgres` giữ nguyên giá trị), bất biến khi UPDATE; (b) trigger chặn **xóa** buổi đã dạy hoặc đã có điểm danh. Không đụng dữ liệu cũ. `db reset` 22/22 sạch.
- **Đã test (THẬT, có số):** `lint` sạch · `typecheck` sạch · `npm test` **20/20** · `npx supabase test db` **16/16** (3 file) · `build` xanh, `/admin/schedule` là `ƒ`. **Smoke Chrome headless qua UI thật: 9/9 PASS** — thêm lịch lặp → sinh đúng **5/5 buổi** → **bấm sinh lần 2 vẫn 5 buổi** (idempotent, báo "đã đủ" chứ không phải lỗi) → mọi buổi rơi đúng Thứ Ba → **18:00 giờ VN lưu thành 11:00 UTC** → LOP-01 linh hoạt khóa nút sinh + thêm buổi tay được → xóa được buổi chưa điểm danh.
- **Quyết định mới:** không có.
- **1 LỖ HỔNG ĐÃ TỰ BẮT VÀ VÁ:** `attendance_records.session_id` là **ON DELETE CASCADE** → xóa một buổi học sẽ **âm thầm xóa sạch điểm danh** của buổi đó. Đúng thứ luật cứng "không hard delete dữ liệu lịch sử" cấm, mà lại nằm sẵn trong schema từ migration 05. Không sửa FK cũ (forward-fix) → migration 22 chặn ở trigger: buổi đã dạy / đã điểm danh thì **không xóa được**, phải **hủy** (`cancelled`) để giữ vết. Có pgTAP xác nhận điểm danh còn nguyên sau khi lệnh xóa bị từ chối.
- **Blocker/rủi ro:** BLK-1/BLK-2 vẫn chỉ chặn deploy cloud. Sửa lịch lặp **không** tự dời các buổi đã sinh — đây là chủ ý (nếu tự dời thì mọi thay đổi lịch sẽ âm thầm dời cả buổi giáo viên đã dạy xong); muốn áp lịch mới thì xóa buổi chưa dạy rồi sinh lại.
- **Next action:** **P3-T8** — Enrollment lifecycle qua RPC, tôn trọng D-18 (một HV chỉ một enrollment đang mở).

### [2026-07-14] Phiên 3 — Claude — P3-T3 (Course materials)
- **Làm được:** Tab "Tài liệu" ở trang chi tiết khóa học: tải lên (gắn vào cả khóa / một chương / một bài học), đổi tên + `visibility`, tải xuống qua signed URL, xóa. Nhãn/định dạng file dùng chung ở `lib/domain/files.ts` (allowlist đuôi file, 50 MB, TTL 120s).
- **Kiến trúc — upload đi THẲNG trình duyệt → Storage, không qua Next server:** 3 bước (server ký `createSignedUploadUrl` → browser `uploadToSignedUrl` → server ghi metadata sau khi `info()` xác minh file có thật). Lý do: server action mặc định chặn body > 1 MB và **Vercel giới hạn cứng 4,5 MB** cho serverless function, trong khi bucket cho phép 50 MB → nếu nhận `File` trong server action thì PDF 20 MB chạy ngon ở local rồi **chết ở production**.
- **File thay đổi:** `src/lib/domain/files.ts` (mới), `src/features/courses/{schema.ts,server/actions.ts,server/queries.ts}`, `src/features/courses/components/materials-manager.tsx` (mới), `src/app/(dashboard)/admin/courses/[id]/page.tsx`, `supabase/migrations/20260713000021_material_uploader_attribution.sql` (mới), `supabase/tests/database/material_uploader_attribution.test.sql` (mới), `tests/unit/domain/files.test.ts` (mới), `docs/02-database-design.md`, `docs/08-phase-plan.md`.
- **Migration/data impact:** migration 21 — trigger `force_material_uploader`: `uploaded_by` **luôn** = `auth.uid()` khi INSERT, **bất biến** khi UPDATE. Không đụng dữ liệu cũ (seed không chèn `course_materials`). `db reset` 21/21 migration sạch.
- **Đã test (THẬT, có số):** `npm run lint` sạch · `npm run typecheck` sạch · `npm test` **20/20 pass** (thêm 10 test mới cho `files.ts`) · `npx supabase test db` **10/10 pass** (2 file) · `npm run build` xanh, `/admin/courses/[id]` vẫn `ƒ` (dynamic). **Kiểm chứng RLS qua HTTP API thật: 17/17 PASS** (login → JWT → PostgREST/Storage) — HV **không** xin được vé upload (`new row violates row-level security policy`), **không** ký được URL tài liệu `staff_only` dù biết đúng path, `staff_only` vô hình trong metadata; GV chỉ thao tác được trong course mình dạy; bucket private (URL không ký → 400); mạo danh `uploaded_by` qua PostgREST bị DB ghi đè. **Smoke Chrome headless qua UI thật: 8/8 PASS** (đăng nhập → tab Tài liệu → upload → DB nhận đúng `lesson_id` + `module_id` cha → tải xuống → xóa).
- **Quyết định mới:** không có (không đổi quyết định đã chốt nào).
- **2 BUG ĐÃ TỰ BẮT VÀ SỬA TRONG PHIÊN:**
  1. **Attribution không được cưỡng chế ở DB.** `uploaded_by` chỉ trông chờ app nhớ gán, mà RLS lại cho admin/GV INSERT thẳng qua PostgREST → client khai `uploaded_by` là ai cũng được, hoặc bỏ trống (kiểm chứng: NULL). Đúng lớp bug `BUG_M06_01`/`BUG_M12_01` của hệ XKLĐ cũ mà CLAUDE.md đã dặn. → migration 21 + pgTAP.
  2. **Tên file tải về bị mojibake.** Supabase Storage percent-encode **hai lần** phần non-ASCII của `Content-Disposition` → người dùng nhận file tên `Gi%C3%A1o tr%C3%ACnh.pdf`. → `sanitizeDownloadName()` ASCII hóa (bỏ dấu tiếng Việt, bỏ chữ Hán); tiêu đề hiển thị trên web vẫn giữ nguyên tiếng Việt/chữ Hán. Có unit test.
- **Blocker/rủi ro:** BLK-1/BLK-2 vẫn chỉ chặn deploy cloud. Upload cho **giáo viên** chưa có UI (server action đang giới hạn `super_admin`) — RLS đã cho phép GV dạy course đó, UI sẽ mở ở **P4-T2**; không phải lỗ hổng, chỉ là chưa lộ giao diện.
- **Next action:** **P3-T7** — Schedule + sinh buổi học (RPC `generate_class_sessions`, hỗ trợ lớp linh hoạt không recurrence).

### [2026-07-13] Phiên 2 — Codex — P3-T6
- **Làm được:** Hoàn tất CRUD lớp: danh sách responsive, tạo/sửa, trang chi tiết, sĩ số mở, hình thức và địa điểm tự do; phân công/gỡ GV chính và trợ giảng. Chặn hạ/gỡ GV chính khi lớp đang hoạt động ở server và DB; chỉ hiện giáo viên có cả hồ sơ lẫn tài khoản đang hoạt động.
- **File thay đổi:** `src/app/(dashboard)/admin/classes/*`, `src/features/classes/*`, `src/features/teachers/server/queries.ts`, migration 20, pgTAP `active_class_integrity.test.sql`, `docs/03-workflow.md`, phase plan và WORKLOG.
- **Migration/data impact:** migration `20260713000020_active_class_integrity.sql` thêm 2 trigger fail-closed cho điều kiện lớp `active`; không xóa/chuyển đổi dữ liệu. `supabase db reset` áp dụng sạch 20/20 migration; seed dev nạp lại đúng UTF-8.
- **Đã test:** `npm run lint` sạch · `npm run typecheck` sạch · `npm test` **10/10 pass** · `npm run db:test` **6/6 pass** (lần đầu fixture dùng sai enum nên 0 assertion, đã sửa fixture và chạy lại xanh) · `npm run build` xanh, route `/admin/classes/[id]` dynamic · Chrome headless smoke: login admin → list lớp → chi tiết `LOP-01` → dialog sửa lớp đều OK.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** BLK-1/BLK-2 vẫn chỉ chặn deploy cloud; cảnh báo Next.js về convention `middleware` deprecated chưa chặn build.
- **Next action:** **P3-T3** — Course materials: upload private bucket, signed URL, `visibility`; sau đó P3-T7.

### [2026-07-13] Phiên 1 — Claude — P1 + P2 (Scaffold + Schema/RLS/Seed)
- **Làm được:** Hoàn tất Phase 1 và Phase 2.
  - **P1:** scaffold Next.js 16 (App Router, TS strict + `noUncheckedIndexedAccess`), Tailwind v4 + shadcn/ui (13 component), theme POLYMIND (primary `#1A5FA8` lấy từ repo cũ; đỏ Trung Hoa tách riêng thành `--brand-red`, **không** ghi đè `--accent` của shadcn — nếu ghi đè thì mọi hover menu sẽ hóa đỏ). Logo PolyMind bo góc. Footer bản quyền mọi trang. 3 Supabase client tách bạch (browser/server/**admin có `server-only`**). Auth SSR + middleware fail-closed. App shell 3 role (sidebar desktop + bottom nav mobile ≥44px). CI GitHub Actions.
  - **P2:** 15 migration + seed. 33 bảng, 98 RLS policy, 5 view (`security_invoker`), 7 RPC transaction, 5 private bucket, 9 helper `app.*` fail-closed. Seed: HSK 1–6, 9 khóa cốt lõi, 2 chương trình VCB, 3 lớp (**LOP-01 cố tình KHÔNG có lịch lặp** — lịch linh hoạt theo Ban Giám đốc).
- **File thay đổi:** `supabase/migrations/*` (15 file), `supabase/seed.sql`, `supabase/seed.dev.sql`, `supabase/config.toml`, `src/lib/{env,supabase,auth,permissions}/*`, `src/features/auth/*`, `src/app/(auth)|(dashboard)|api|auth/*`, `src/components/{layout,shared,ui}/*`, `src/types/{database,roles}.ts`, `.github/workflows/ci.yml`, configs.
- **Migration/data impact:** Schema mới hoàn toàn (chưa có production → không có rủi ro dữ liệu). `supabase db reset` chạy sạch từ migration đầu, seed idempotent.
- **Đã test (THẬT, có số):** `npx tsc --noEmit` → sạch. `npx eslint` → 0 lỗi. `npx vitest run` → **10/10 pass**. `npx next build` → xanh, 27 route, mọi trang authenticated đều `ƒ` (dynamic, không cache session). `npx supabase db reset` → 15/15 migration + seed OK. **RLS kiểm chứng qua HTTP API thật** (login → JWT → PostgREST): GV A thấy đúng LOP-01/02 + HV001–004, **không** thấy HV005, tuition **0 dòng**, audit **0 dòng**; HV5 chỉ thấy LOP-03 + chính mình; anonymous `permission denied`. Smoke: `/api/health` 200, anonymous vào `/admin` → 307 `/login`.
- **Quyết định mới:** D-16 — **hoãn viết test suite** (user chốt 2026-07-13), ưu tiên build web hoàn chỉnh; RLS/bảo mật vẫn làm đủ.
- **Blocker/rủi ro:** BLK-1/BLK-2 (chưa có credential cloud) — không chặn Phase 3–6.
- **3 BẪY ĐÃ SẬP VÀ CÁCH TRÁNH (quan trọng cho phiên sau):**
  1. **Port Supabase:** 543xx nằm trong dải Windows/Hyper-V reserve `54289–54388` → `supabase start` chết. Đã dời sang **553xx** trong `config.toml`.
  2. **`[auth.email].enable_signup`:** tên nghe như "chặn đăng ký" nhưng CLI map nó sang `EXTERNAL_EMAIL_ENABLED` — đặt `false` là **tắt luôn ĐĂNG NHẬP** (`email_provider_disabled`). Chặn sign-up đúng cách là `[auth].enable_signup = false`.
  3. **Supabase bản mới KHÔNG tự GRANT** quyền bảng cho `anon`/`authenticated` → RLS policy viết đủ nhưng mọi role vẫn nhận `permission denied`. Phải có migration `..._grants.sql` tường minh.
  4. **Seed `auth.users`:** các cột `confirmation_token`, `recovery_token`, … phải là `''` chứ **không** được NULL, nếu không GoTrue crash khi login (`converting NULL to string`).
- **Next action:** **`P3-T1`** — layout admin + dashboard skeleton, rồi P3-T2 (CRUD Level/Course/Module/Lesson).

### [2026-07-13] Phiên 1 — Claude — P0-T1 → P0-T6 (Phase 0)
- **Làm được:** Hoàn tất Phase 0. Khảo sát read-only repo XKLĐ (source, 20 module QA board, docs 01–04, WORKLOG, AI/AGENTS.md). Dời folder `Polymind Chinese` ra khỏi repo cũ → sibling. `git init` repo mới trên `main`. Viết toàn bộ docs nền + bộ phối hợp AI.
- **File thay đổi:** `docs/01-business-analysis.md`, `docs/02-database-design.md`, `docs/03-workflow.md`, `docs/04-system-architecture.md`, `docs/05-testing-strategy.md`, `docs/06-deployment-vercel-supabase.md`, `docs/07-product-backlog.md`, `docs/08-phase-plan.md`, `docs/testing/MODULE_QA_BOARD.md`, `WORKLOG.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `.env.example`, `.gitignore`.
- **Migration/data impact:** Không có (chưa có schema).
- **Đã test:** Không có test để chạy (chưa có code). Đã xác minh môi trường: `node -v` → v22.20.0 · `npm -v` → 10.9.3 · `docker info` → daemon 28.4.0 chạy được · Supabase CLI và Vercel CLI **chưa cài** (sẽ dùng `npx`).
- **Quyết định mới:** D-14 (vị trí repo — sibling, user chốt), D-15 (local-first, user chốt).
- **Blocker/rủi ro:** BLK-1 (chưa có Supabase cloud), BLK-2 (chưa có Vercel). **Không chặn Phase 1–6.**
- **Bài học đã port từ repo XKLĐ (áp vào thiết kế mới):** (a) attribution phải là **actor thật**, không phải "user đầu tiên" — hệ cũ dính `BUG_M06_01`/`BUG_M12_01`; (b) idempotency phải cưỡng chế bằng **unique index ở DB**, app-level check thua race — hệ cũ trả hoa hồng 2 lần (`BUG_M09_01`); (c) một hành động = **một đường ghi** — hệ cũ có 3 đường set `Payment→Paid` lệch nhau (`BUG_M10_01`); (d) **không có nhánh `return true` mặc định** trong hàm phân quyền — hệ cũ dính `MessagingPolicy.CanMessage` fallback `true` (`CR-M14-3`); (e) export phải **giữ filter đang chọn** (`BUG_M16_01`); (f) không tạo trang monolith > 2.000 dòng như `CandidateDetail.razor`.
- **Next action:** **`P1-T1`** — scaffold Next.js (App Router + TS strict + npm), bật script lint/typecheck/test/build. DoD: `npm run build` + `npm run typecheck` xanh.
