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

> Cập nhật: **2026-07-15** — Codex — P7-T6 hoàn thành

- **Phase 0 → 6 XONG; P7-T1 → P7-T6 XONG.** Mười task P6-T6, P6-T7, P6-T8, P6-T9, P7-T1…P7-T6 đã hoàn thành trong phiên 23.
- **Vận hành:** cron idempotent, báo cáo CSV/XLSX, audit viewer, payment concurrency, security/rate limit, RLS catalog, E2E 3 role, WCAG/responsive và deploy runbook đã có.
- **DB:** 34 migration áp sạch · 33 bảng public đều RLS · catalog khóa 24 RPC · 5 bucket private/16 policy Storage · pgTAP **319/319**.
- **Kiểm tra gần nhất (THẬT):** lint sạch · typecheck sạch · Vitest **67/67** · Playwright **20/20** desktop/mobile · production build xanh.
- **QA:** Verification Queue trống; residual dependency audit còn **4 moderate**, không có high/critical, đã ghi trong `docs/testing/SECURITY_REVIEW.md`.
- **Deploy cloud:** chưa deploy; P7-T7 vẫn bị chặn bởi BLK-1/BLK-2. Trạng thái đúng: **ready to deploy, blocked by credentials**.

---

## ➡️ VIỆC TIẾP THEO

**`P7-T7` — Deploy cloud — ⛔ BLOCKED.** Chỉ bắt đầu khi user cung cấp đủ credential Supabase cloud và tài khoản/quyền Vercel; không được gọi là đã deploy trước thời điểm đó.

✅ **Verification Queue TRỐNG.** Cả 4 bug đã được Claude xác minh độc lập: `BUG-M06-001`, `BUG-M11-001` (phiên 14) · `BUG-M08-001`, `BUG-M11-002` (phiên 18). Xem `docs/testing/MODULE_QA_BOARD.md`.

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
| D-20 | **USER TỰ COMMIT** *(user chốt 2026-07-14)*. Claude Code và Codex **không được tự chạy `git commit` hoặc `git commit --amend`**. Agent để thay đổi trong working tree, báo file đã sửa + kết quả kiểm tra để user tự review và commit. Chỉ ngoại lệ khi user yêu cầu commit rõ ràng trong chính lượt làm việc đó. |

---

## 📖 NHẬT KÝ SESSION (mới nhất ở trên, giữ 6 entry)

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

### [2026-07-15] Phiên 21 — Codex — P6-T2
- **Làm được:** hoàn thiện luồng Payment + Receipt trên `/admin/tuition`: chỉ hiện hành động thu cho hóa đơn `issued/partial/overdue`, form ghi nhận số tiền/phương thức/thời điểm/tham chiếu/ghi chú, lịch sử payment và mã phiếu thu. Server action gọi duy nhất RPC `record_tuition_payment`; RPC forward-fix khóa hóa đơn, từ chối trạng thái không hợp lệ và tạo payment + receipt trong cùng transaction.
- **File thay đổi:** `src/features/tuition/{schema,types,server/actions,server/queries,components/invoice-manager}.ts(x)`, `supabase/migrations/20260715000030_tuition_payment_integrity.sql`, `supabase/tests/database/tuition_payment_workflow.test.sql`, `tests/unit/domain/tuition-invoice-schema.test.ts`, `docs/{01-business-analysis,02-database-design,03-workflow,08-phase-plan}.md`, `WORKLOG.md`.
- **Migration/data impact:** migration 30 forward-fix RPC hiện hữu, không thêm/xóa bảng hay cột; chặn thu trên `draft/paid/cancelled/refunded`, giữ attribution theo `auth.uid()` và quyền thực thi chỉ cho `authenticated`. `npm run db:reset` áp sạch đủ 30 migration.
- **Đã test:** lint sạch · typecheck sạch · Vitest **51/51** · pgTAP **236/236** (**32** assertion riêng payment/receipt/RLS) · build production xanh, `/admin/tuition` là route động `ƒ`.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** không có blocker P6-T2. BLK-1/BLK-2 vẫn chỉ chặn deploy cloud.
- **Next action:** **P6-T3** — màn hình học phí cho học viên, chỉ dữ liệu của mình và không có mutation ghi nhận thanh toán.

### [2026-07-15] Phiên 20 — Codex — P6-T1
- **Làm được:** thay ComingSoon `/admin/tuition` bằng module hóa đơn thật: KPI, danh sách chi tiết, form nhiều khoản mục, tạo/sửa/xóa draft và phát hành riêng. Thêm RPC transaction `save_tuition_invoice` (DB tự tính `line_total/subtotal/total`, kiểm enrollment thuộc học viên), `issue_tuition_invoice` (notification idempotent + audit), `delete_tuition_invoice_draft`; khóa mutation trực tiếp trên 4 bảng tuition. Học viên không thấy draft ở tầng RLS; hóa đơn đã phát hành không sửa/hard-delete.
- **File thay đổi:** `src/features/tuition/*`, `src/app/(dashboard)/admin/tuition/page.tsx`, `src/components/shared/submit-button.tsx`, `src/types/database.ts`, `supabase/migrations/20260715000029_tuition_invoice_workflow.sql`, `supabase/tests/database/tuition_invoice_workflow.test.sql`, `tests/unit/domain/tuition-invoice-schema.test.ts`, `docs/{01,02,03,04,08-phase-plan.md}`, `WORKLOG.md`.
- **Migration/data impact:** migration 29 thêm 1 sequence + 3 RPC, thu hẹp GRANT mutation tuition về RPC-only, thay 2 RLS policy để draft vô hình với học viên; không xóa dữ liệu production. `npm run db:reset` áp sạch đủ 29 migration.
- **Đã test:** lint sạch · typecheck sạch · Vitest **48/48** · pgTAP **204/204** (**37** assertion riêng invoice workflow/RLS) · build production xanh, `/admin/tuition` là route động `ƒ`.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** không có blocker P6-T1. BLK-1/BLK-2 vẫn chỉ chặn deploy cloud. P6-T2 cần chặn payment trên invoice draft trước khi nối UI.
- **Next action:** **P6-T2** — Payment + Receipt qua `record_tuition_payment`; hiển thị payment/receipt trên hóa đơn và giữ invariant đúng 1 receipt.

### [2026-07-14] Phiên 19 — Claude — P5-T1…T7 — 🎉 ĐÓNG PHASE 5
- **Làm được:** toàn bộ **cổng học viên** (5 trang ComingSoon → thật). `/student`: buổi kế tiếp, bài chưa nộp, chuyên cần, còn phải đóng + cảnh báo hóa đơn quá hạn. `/student/schedule`: 3 tab — buổi học (kèm điểm danh của mình), tài liệu (tải bằng signed URL ngắn hạn), chuyên cần. `/student/assignments` + `[id]`: **nộp bài text + file**, xem đề bài đính kèm, thấy điểm/nhận xét sau khi chấm. `/student/results`: 3 tab — điểm (tổng + 6 kỹ năng), đánh giá học tập + lời nhắn, tiến độ. `/student/profile`: hồ sơ, sửa liên hệ, **đổi mật khẩu**, danh sách thông báo + đánh dấu đã đọc.
- **Link trong notification là hợp đồng, không phải trang trí:** RPC `publish_evaluation` sinh link `/student/evaluations` — route đó **chưa tồn tại**, mọi thông báo "Đánh giá học tập mới" sẽ dẫn tới **404**. Đã thêm route redirect sang `/student/results?tab=evaluations`. `/student/results` và `/student/assignments/[id]` cũng đã có đủ.
- **🔒 `enrollment_id` lấy ở SERVER, không nhận từ form.** Nếu để client gửi lên thì HV A nộp bài được dưới danh nghĩa HV B. RLS (`app.owns_enrollment`) vẫn chặn, nhưng không có lý do gì mở một tham số nguy hiểm rồi trông cậy vào lưới sau cùng.
- **Không viết thêm migration nào.** RLS nền (24 policy phía học viên) đã đủ; việc của Phase 5 là **không phá** nó, không phải thêm luật mới. Đã kiểm chứng chứ không tin: thử cho HV tự nâng quyền `update profiles set role='super_admin'` → trigger `app.prevent_self_privilege_escalation` từ chối (*"Không được tự đổi vai trò tài khoản"*), role vẫn `student`. Cột `role`/`is_active` tuy có GRANT UPDATE rộng nhưng trigger là chốt fail-closed.
- **🎉 GATE PHASE 5 — ĐẠT, kiểm chứng thật:** pgTAP `student_isolation.test.sql` dựng **HV-A và HV-B CÙNG MỘT LỚP** (ca khó nhất — cùng lớp thì mọi điều kiện theo `class_id` đều đúng cho cả hai) rồi quét thẳng bảng bằng **JWT của A**: `submissions` **0 dòng** (không đọc được bài của B), `assessment_results` **0** (không đọc được điểm của B dù B đã được công bố), `students`/`enrollments`/`attendance_records` chỉ của A. A **không** nộp được bài dưới danh nghĩa ghi danh của B (42501), **không** nộp được vào bài còn nháp, tự khai `score=100` lúc nộp thì DB **xóa sạch về NULL**, và **không** tự sửa được điểm.
- **Đã test (THẬT, có số):** `npm run lint` sạch · `npm run typecheck` sạch · `npm test` **43/43** · `npx supabase test db` **167/167** (16 assertion riêng student isolation) · `npm run build` xanh, cả 7 route `/student/*` đều là `ƒ`. **Playwright 5/5 PASS** (chạy song song). E2E nộp bài đi trọn vòng: HV1 nộp text → DB `enrollment_id` đúng HV1, `status=submitted`, `submitted_at` do DB đặt, `score` **NULL** → upload file UTF-8, path đúng `{class_id}/{submission_id}/…` → GV A chấm bằng RPC (JWT thật) → HV1 thấy **88,5** + nhận xét, nút *Cập nhật bài làm* **biến mất** (bài khóa sửa). Negative: bài tập LOP-03 → **404**; URL không phải uuid → **404**.
- **🔍 QA — xác minh độc lập 2 fix của Codex:** `BUG-M08-001` + `BUG-M11-002` (guard UUID) → cả hai **PASS**. Góc soi riêng, không chạy lại test của Codex: rủi ro thật của một guard **không phải** "URL rác còn 500" mà là **guard chặn nhầm đường đi đúng**. Nên kiểm đủ 3 ca: 4 URL rác → 404 · UUID hợp lệ **của lớp GV B** → vẫn 404 (không nới IDOR) · **REGRESSION: buổi học/bài tập của chính GV A → 200**, render đúng. Verification Queue giờ **trống**.
- **File thay đổi:** `src/features/student/*` (queries, result-queries, profile-actions, `material-list.tsx`, `profile-panel.tsx`), `src/features/submissions/*` (schema, queries, actions, `submission-form.tsx`), `src/features/dashboard/server/student-queries.ts`, `src/app/(dashboard)/student/{page,schedule/page,assignments/page,assignments/[id]/page,results/page,evaluations/page,profile/page}.tsx`, `supabase/tests/database/student_isolation.test.sql` (mới), `tests/e2e/{student-submission.smoke,verify-codex-guards}.spec.ts` (mới), `docs/{08-phase-plan.md,testing/MODULE_QA_BOARD.md}`, `WORKLOG.md`.
- **Migration/data impact:** **không có migration.** Fixture e2e tự dọn; đã xác nhận DB sạch sau khi chạy.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** không có blocker Phase 5. BLK-1/BLK-2 vẫn **chỉ** chặn deploy cloud.
- **Next action:** **Phase 6** — Tuition, notifications & reports. Gate: **giáo viên KHÔNG đọc được học phí**; export phải giữ đúng filter đang chọn (bài học `BUG_M16_01`).

### [2026-07-14] Phiên 18 — Codex — BUG-M08-001 + BUG-M11-002
- **Làm được:** xác nhận hai route động gửi thẳng chuỗi URL vào cột UUID của Postgres, khiến URL rác có thể trả 500; thêm guard UUID fail-fast trong query của session log và bảng chấm bài để page đi qua `notFound()` và trả 404.
- **File thay đổi:** `src/features/sessions/server/queries.ts`, `src/features/assignments/server/queries.ts`, `tests/e2e/teacher-route-params.smoke.spec.ts`, `docs/08-phase-plan.md`, `docs/testing/MODULE_QA_BOARD.md`, `WORKLOG.md`.
- **Migration/data impact:** không có; không đổi schema hay dữ liệu.
- **Đã test (THẬT, có số):** `npm run lint` sạch · `npm run typecheck` sạch · `npm test` **43/43** · `npm run build` xanh · Playwright Chromium route-param **1/1 PASS**: cả `/teacher/assignments/khong-phai-uuid` và `/teacher/sessions/khong-phai-uuid` trả **404**. Không đổi DB nên không chạy lại pgTAP.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** không có blocker; hai fix chờ Claude xác minh độc lập, Codex không tự ghi Verified.
- **Next action:** Claude xác minh `BUG-M08-001` + `BUG-M11-002`; Codex dừng, không làm tiếp Phase 5.
