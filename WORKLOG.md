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

> Cập nhật: **2026-07-14** — Claude — P3-T10 (đóng Phase 3)

- **Phase 0 XONG** · **Phase 1 XONG** · **Phase 2 XONG**. Repo: `Documents\Polymind Chinese`, git `main`, đã push GitHub.
- 🎉 **PHASE 3 XONG** (P3-T1 → P3-T10). Super admin đi trọn được **Course → Class → Schedule → sinh buổi → gán GV → Enrollment**.
- **P3-T10 — xong — Claude — 2026-07-14.** Test domain: recurrence 35 buổi + capacity (pgTAP, gọi đúng RPC production) + enrollment transitions (Vitest).
- **D-19 — xong — Claude — 2026-07-14.** Học viên rớt **được học lại** chính lớp đó (migration 23). D-18 không bị phá.
- **P3-T9 — xong — Claude — 2026-07-14.** Admin dashboard KPI thật, đọc từ view (bỏ ComingSoon).
- **P3-T8 — xong — Claude — 2026-07-14.** Vòng đời ghi danh qua RPC (ghi danh / tạm dừng / học lại / hoàn thành / rút / chuyển lớp), giữ history, tôn trọng D-18.
- **P3-T7 — xong — Claude — 2026-07-14.** Lịch lặp + sinh buổi học (idempotent) + lớp linh hoạt không lịch. Trang `/admin/schedule` đã thật (bỏ ComingSoon). Migration 22 chốt attribution + chặn xóa buổi đã có lịch sử.
- **P3-T3 — xong — Claude — 2026-07-14.** Tài liệu khóa học: upload thẳng lên private bucket (signed upload URL), signed URL tải xuống, `visibility`. Migration 21 chốt attribution ở DB.
- **P3-T6 — xong — Codex — 2026-07-13.** CRUD lớp + phân công GV, có chốt chặn DB giữ điều kiện lớp `active`.
- **DB: 23 migration.** pgTAP **31/31 pass** (5 file). Unit test **28/28 pass**.
- **GitHub:** https://github.com/KhangDepZai1802/POLYMIND_CHINESE
- App chạy được: Next.js 16 + TS strict + Tailwind v4 + shadcn/ui. Auth SSR (login/forgot/reset/invite), app shell 3 role, logo PolyMind, footer bản quyền.
- **Schema:** 33 bảng, **0 bảng thiếu RLS**, 98 policy, 5 view (`security_invoker`), 7 RPC, 5 private bucket. `db reset` + seed chạy sạch.
- **RLS đã kiểm chứng THẬT qua HTTP API** (Supabase Auth → JWT → PostgREST): GV A chỉ thấy LOP-01/02 + HV001–004 (không thấy HV005), học phí 0 dòng, audit 0 dòng; HV5 chỉ thấy LOP-03 + chính mình; anonymous bị chặn ở tầng GRANT.
- ⚠️ **Test suite đang HOÃN theo yêu cầu user** (2026-07-13): ưu tiên build web hoàn chỉnh trước. RLS/bảo mật vẫn làm đầy đủ — đó là tính năng, không phải test.
- Môi trường: Node 22.20 · npm 10.9 · Docker 28.4 · Supabase local **port 553xx** (543xx bị Windows reserve).

---

## ➡️ VIỆC TIẾP THEO

**PHASE 3 ĐÃ XONG.** Bắt đầu **Phase 4 — Teacher operations**.

**`P4-T1` — Dashboard "Hôm nay" của giáo viên**: lịch dạy hôm nay, buổi chưa điểm danh, bài chờ chấm, HV cần chú ý. DoD: vào được lớp/buổi trong **1–2 thao tác**.

Sau đó ưu tiên **`P4-T4` — Attendance roster** (việc giáo viên dùng nhiều nhất): một màn hình, nút lớn, chọn hàng loạt, nút Lưu **sticky**. Dùng RPC `bulk_mark_attendance` (đã upsert theo `(session_id, enrollment_id)` → bấm Lưu 2 lần vẫn 1 bản ghi/HV).

⚠️ **Gate của Phase 4 (đọc kỹ trước khi code):** giáo viên **không** được truy cập lớp ngoài phạm vi qua UI, direct URL, server action **và** Supabase client gọi thẳng. Mọi query giáo viên đều quy về bảng `class_teachers` — RLS đã lo, đừng tự viết `if role ===` ở app.

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
| D-19 | **HỌC VIÊN RỚT ĐƯỢC HỌC LẠI CHÍNH LỚP ĐÓ** *(user chốt 2026-07-14)*. Gỡ `uq_enrollments_student_class` (migration 23) — ràng buộc cũ cấm ghi danh lại vào một lớp đã từng học, kể cả sau khi rút/hoàn thành. **Không phá D-18:** `ux_enrollments_one_open_per_student` vẫn bảo đảm tối đa MỘT ghi danh đang mở trên toàn hệ thống → không thể có hai ghi danh mở trong cùng lớp. Mỗi lần học là **một enrollment riêng**; điểm danh/điểm/bài nộp treo vào `enrollment_id` nên lịch sử lần trước **không bị trộn** với lần học lại. |
| D-18 | **MỘT HỌC VIÊN CHỈ HỌC MỘT LỚP TẠI MỘT THỜI ĐIỂM** *(user chốt 2026-07-13 — **đảo ngược D-10** và §4.13 của đặc tả gốc)*. "Một thời điểm" = tối đa **một** enrollment đang mở (`pending`/`active`/`paused`). Enrollment đã đóng (`completed`/`withdrawn`/`transferred`) **không tính** → học xong HSK 1 vẫn đăng ký được HSK 2, và chuyển lớp vẫn chạy. Cưỡng chế bằng partial unique index `ux_enrollments_one_open_per_student` (migration 19) — **không** chỉ kiểm ở app. |

---

## 📖 NHẬT KÝ SESSION (mới nhất ở trên, giữ 6 entry)

### [2026-07-14] Phiên 7 — Claude — D-19 (học lại) + P3-T10 → **ĐÓNG PHASE 3**
- **Làm được:**
  - **D-19 (thay đổi nghiệp vụ, user chốt):** học viên **rớt được học lại chính lớp đó**. Migration 23 gỡ `uq_enrollments_student_class` (ràng buộc cũ cấm ghi danh lại vào một lớp đã từng học, kể cả sau khi rút/hoàn thành).
  - **P3-T10 (task cuối Phase 3):** test domain cho recurrence + capacity.
- **Vì sao gỡ ràng buộc đó KHÔNG phá D-18:** `ux_enrollments_one_open_per_student` vẫn bảo đảm tối đa **một** ghi danh đang mở trên toàn hệ thống → đương nhiên không thể có hai ghi danh mở trong cùng một lớp. Cái bị gỡ chỉ chặn thêm các ghi danh **đã đóng** — tức đúng phần lịch sử ta muốn giữ. Mỗi lần học là **một enrollment riêng**, và vì điểm danh/điểm/bài nộp treo vào `enrollment_id` chứ không phải `student_id`, lịch sử lần trước **không bị trộn** với lần học lại.
- **P3-T10 viết bằng pgTAP, KHÔNG phải Vitest** — có chủ ý: logic thật nằm **trong RPC** (`generate_class_sessions`, `enroll_student`). Port công thức sang TS rồi test bản sao thì test xanh cả khi RPC thật sai; nó chỉ chứng minh bản sao đúng với chính nó. pgTAP gọi **đúng hàm mà production gọi**.
- **File thay đổi:** `supabase/migrations/20260713000023_allow_retake_same_class.sql` (mới), `supabase/tests/database/retake_same_class.test.sql` (mới), `supabase/tests/database/generate_sessions_and_capacity.test.sql` (mới), `supabase/seed.dev.sql`, `src/features/enrollments/server/actions.ts`, `docs/02-database-design.md`, `docs/08-phase-plan.md`.
- **Migration/data impact:** migration 23 chỉ **DROP CONSTRAINT** — không đụng một dòng dữ liệu nào, không mất lịch sử. **Đã làm hỏng `seed.dev.sql` và đã sửa:** seed dùng `ON CONFLICT (student_id, class_id)` — chính ràng buộc vừa gỡ → seed chết ngay. Đổi sang `WHERE NOT EXISTS`. Đã chạy seed **hai lần** kiểm idempotent (lần 2: `INSERT 0 0`) và kiểm mắt tiếng Việt không mojibake.
- **Đã test (THẬT, có số):** `lint` · `typecheck` sạch · `npm test` **28/28** · `npx supabase test db` **31/31** (5 file) · `build` xanh. **Retake qua RPC thật: 6/6 PASS** — ghi danh LOP-02 → rút học (rớt) → **ghi danh LẠI LOP-02 thành công** → hai enrollment riêng biệt → D-18 vẫn chặn ghi danh lớp khác → vẫn đúng 1 ghi danh mở. **pgTAP P3-T10:** sinh **đúng 35 buổi**, gọi lại sinh **0** (idempotent), buổi chỉ rơi Thứ Ba + Thứ Năm, buổi 1 = 18:00 giờ VN **lưu thành 11:00 UTC**, lớp linh hoạt → 0 buổi không lỗi, capacity chặn HV thứ 3 với đúng thông điệp "Lớp đã đủ sĩ số (2 / 2)".
- **Quyết định mới:** **D-19** (học viên rớt được học lại).
- **Blocker/rủi ro:** BLK-1/BLK-2 vẫn chỉ chặn deploy cloud. Không còn câu hỏi nghiệp vụ nào treo.
- **Next action:** **P4-T1** — Dashboard "Hôm nay" của giáo viên. Đọc kỹ **gate của Phase 4** ở mục VIỆC TIẾP THEO.

### [2026-07-14] Phiên 6 — Claude — P3-T9 (Admin dashboard)
- **Làm được:** `/admin` thành dashboard thật (bỏ ComingSoon): 4 thẻ KPI (học viên đang học · lớp đang hoạt động · buổi học hôm nay · giáo viên) bấm được sang từng mục; bảng **tiến độ các lớp** (sĩ số / chuyên cần / tiến độ); **học viên cần chú ý** kèm lý do rủi ro; **buổi học hôm nay** theo giờ VN; thẻ **học phí** (còn phải thu / số hóa đơn / quá hạn).
- **Nguyên tắc:** mọi con số **đọc từ view** (`v_class_progress`, `v_at_risk_students`, `v_tuition_balance`), **không tự tính lại** ở tầng app. View đã là nguồn sự thật của công thức; viết lại phép tính ở app là tạo nguồn sự thật thứ hai, sớm muộn hai chỗ lệch nhau. Toàn bộ view đều `security_invoker` → RLS của người gọi vẫn áp dụng.
- **File thay đổi:** `src/features/dashboard/server/queries.ts` (mới), `src/app/(dashboard)/admin/page.tsx`, `docs/08-phase-plan.md`.
- **Migration/data impact:** không có.
- **Đã test (THẬT, có số):** `lint` · `typecheck` sạch · `npm test` **28/28** · `build` xanh, `/admin` vẫn `ƒ` (dynamic — không cache session giữa user). **Smoke Chrome headless: 9/9 PASS** — từng KPI được **đối chiếu với truy vấn DB thật**: học viên đang học **5**, lớp đang hoạt động **3**, giáo viên **2**, khóa học đang mở **11**, buổi học hôm nay **0**, cần chú ý **0**; bảng tiến độ liệt kê đủ LOP-01/02/03.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** Dashboard hiện nhiều **empty state** — đúng thực tế, không phải lỗi: seed chưa có điểm danh, chưa có hóa đơn (Phase 6), và buổi học đầu tiên rơi vào 20/07 (hôm nay 14/07) nên "buổi học hôm nay = 0". Khi Phase 4/6 có dữ liệu thật thì các thẻ này tự có số.
- **Next action:** **P3-T10** — unit test domain (recurrence + capacity nên viết bằng **pgTAP**, xem VIỆC TIẾP THEO).

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
