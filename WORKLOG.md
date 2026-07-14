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

> Cập nhật: **2026-07-14** — Claude — P5-T7

- **Phase 0 · 1 · 2 · 3 · 4 XONG** · 🎉 **PHASE 5 XONG** (T1→T7 đủ 7 task).
- **Gate Phase 5 ĐẠT, kiểm chứng thật:** học viên **không** thấy dữ liệu của học viên khác — kiểm bằng chính JWT học viên, với **HV-A và HV-B CÙNG MỘT LỚP** (ca khó nhất). Luồng **nộp bài end-to-end** chạy thật trên trình duyệt: text + file private + GV chấm + HV thấy điểm + bài bị khóa sửa. Bằng chứng ở `docs/08-phase-plan.md` §Phase 5.
- **P5-T1…T7 — xong — Claude — 2026-07-14.** Cả 5 trang học viên bỏ ComingSoon: `/student` (dashboard) · `/student/schedule` (lịch + tài liệu + chuyên cần) · `/student/assignments` + `/student/assignments/[id]` (nộp bài) · `/student/results` (điểm + đánh giá + tiến độ) · `/student/profile` (hồ sơ + đổi mật khẩu + thông báo). Thêm `/student/evaluations` (redirect) để link trong notification không còn 404.
- **Gate Phase 4 ĐẠT** (UI · direct URL · server action/RPC · Supabase client gọi thẳng) — xem `docs/08-phase-plan.md` §Phase 4.
- **QA:** Verification Queue **trống**. Cả 4 bug (`BUG-M06-001`, `BUG-M11-001`, `BUG-M08-001`, `BUG-M11-002`) đã được Claude **xác minh độc lập**.
- **DB:** 28 migration · 33 bảng · 0 bảng thiếu RLS · 97 policy public + 16 policy Storage · 5 view `security_invoker` · 13 RPC nghiệp vụ (+ `log_audit`) · 5 private bucket. **Phase 5 không thêm migration nào** — RLS nền đã đủ.
- **Kiểm tra gần nhất (THẬT):** lint/typecheck sạch · Vitest **43/43** · pgTAP **167/167** · Playwright **5/5** · build xanh.

---

## ➡️ VIỆC TIẾP THEO

**`P6-T1` — Tuition, notifications & reports — chưa claim.** Phase 5 đã đóng; mở [`docs/08-phase-plan.md`](docs/08-phase-plan.md) → Phase 6 để lấy task ID và Definition of Done.

⚠️ **Gate của Phase 6** (đọc kỹ trước khi code): **giáo viên KHÔNG được đọc học phí** — đây là ranh giới quyền quan trọng nhất của phase này. Bài học `BUG_M16_01` ở hệ cũ: **export phải giữ đúng filter/date range đang chọn**, nếu không file xuất ra luôn là toàn kỳ.

Nền đã có sẵn để dùng ngay:
- RPC `record_tuition_payment` — sinh **đúng 1** phiếu thu (UNIQUE `tuition_receipts.payment_id` là chốt chặn cuối, không phải check ở app).
- View `v_tuition_balance` (`security_invoker`) — số dư là **tính ra**, không phải cột nhập tay.
- Bảng `notifications` có partial unique `(user_id, dedupe_key)` → cron/RPC gọi lại **không sinh thông báo trùng**.
- Cổng học viên đã đọc `v_tuition_balance` (KPI "Còn phải đóng" + cảnh báo quá hạn ở `/student`) — Phase 6 chỉ cần làm phía admin.

✅ **Verification Queue TRỐNG.** Cả 4 bug đã được Claude xác minh độc lập: `BUG-M06-001`, `BUG-M11-001` (phiên 14) · `BUG-M08-001`, `BUG-M11-002` (phiên 18). Xem `docs/testing/MODULE_QA_BOARD.md`.

Nền đã sẵn sàng để dùng ngay:
- 11 RPC nghiệp vụ: `enroll_student` (khóa hàng chống vượt sĩ số) · `transfer_enrollment` · `change_enrollment_status` · `generate_class_sessions` (idempotent) · `bulk_mark_attendance` (upsert) · `save_session_log` (session + progress nguyên tử) · `publish_assignment` + `close_assignment` · `grade_submission` · `publish_assessment_results` · `record_tuition_payment` (sinh đúng 1 phiếu thu).
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
| D-20 | **USER TỰ COMMIT** *(user chốt 2026-07-14)*. Claude Code và Codex **không được tự chạy `git commit` hoặc `git commit --amend`**. Agent để thay đổi trong working tree, báo file đã sửa + kết quả kiểm tra để user tự review và commit. Chỉ ngoại lệ khi user yêu cầu commit rõ ràng trong chính lượt làm việc đó. |

---

## 📖 NHẬT KÝ SESSION (mới nhất ở trên, giữ 6 entry)

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

### [2026-07-14] Phiên 17 — Claude — P4-T10 (Tests) — 🎉 ĐÓNG PHASE 4
- **Làm được:** repo có **component test** đầu tiên (Testing Library đã cài từ lâu nhưng chưa dùng). 6 test mới nhắm đúng những chỗ hỏng là **hỏng âm thầm**, không phải chỗ dễ test:
  1. **`AttendanceRoster` — chưa chọn ≠ vắng.** Render roster, không chọn ai, đọc đúng `FormData` mà trình duyệt sẽ POST → **không có field `status_*` nào**. Nếu component mặc định `absent`, cả lớp bị đánh vắng oan chỉ vì một cú bấm Lưu — và không có lỗi nào bật lên. Test thứ hai: "Tất cả có mặt" rồi sửa 1 người thành Vắng → gửi đúng `present/absent/present`.
  2. **`AssessmentScoreBoard` — ô trống ≠ 0 điểm.** Chấm 3/6 kỹ năng (90, 80, 70) → *Tính TB* ra **80** (TB của 3 ô đã nhập), không phải **40** (nếu coi 3 ô trống là 0 → học viên mất 40 điểm).
  3. **Schema:** ô điểm rỗng → `null` chứ không phải `0`, nhưng **0 do giáo viên cố ý cho vẫn là 0** (phân biệt được "chưa chấm" với "0 điểm"); rating bỏ trống → `null`, **không phải `weak`** (vu oan học viên).
- **RLS negative (phần còn lại của DoD) đã có sẵn từ T7/T8** — không viết trùng: `assessment_integrity.test.sql` (GV lớp khác đọc 0 dòng · gọi thẳng RPC nhập điểm/công bố đều bị từ chối) và `evaluation_notes.test.sql` (học viên quét toàn bảng chỉ thấy ghi chú `student_visible`; đánh giá chưa gửi → 0 dòng; học viên không tạo/sửa được ghi chú).
- **Sửa hạ tầng test:** 3 smoke chạy song song thì evaluation smoke **đỏ vì hết giờ** (30s mặc định), chạy riêng thì xanh — test đỏ vì *timeout*, không phải vì sai. Smoke chạy trên `next dev` (biên dịch route theo yêu cầu) và đụng DB thật, nên nâng `timeout` của Playwright lên **90s**. Đây là sửa đúng nguyên nhân, không phải nới assertion cho nó xanh.
- **File thay đổi:** `tests/unit/components/{attendance-roster,assessment-score-board}.test.tsx` (mới), `tests/unit/domain/score-schema.test.ts` (mới), `tests/unit/components/…` fixture, `playwright.config.ts` (timeout), `docs/08-phase-plan.md`, `WORKLOG.md`.
- **Migration/data impact:** không có.
- **Đã test (THẬT, có số):** `npm run lint` sạch · `npm run typecheck` sạch (bắt được 2 lỗi `noUncheckedIndexedAccess` trong chính fixture test của tôi, đã sửa) · `npm test` **43/43** (32 → 43) · `npx supabase test db` **151/151** · `npm run build` xanh · `npx playwright test` **3/3 PASS chạy song song**.
- **🎉 GATE PHASE 4 — ĐẠT, kiểm chứng thật cả 4 đường** (UI · direct URL · server action/RPC · Supabase client gọi thẳng bằng JWT thật). Đã ghi bằng chứng cụ thể vào `docs/08-phase-plan.md` §Phase 4 để phiên sau không phải tin lời.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** không có blocker Phase 4. BLK-1/BLK-2 vẫn **chỉ** chặn deploy cloud. Nợ kỹ thuật ngoài scope (đề nghị Codex): `/teacher/assignments/[id]` và `/teacher/sessions/[id]` nhiều khả năng vẫn trả **500** với URL không phải uuid — các trang tôi viết (T7/T8) đã có guard uuid → 404.
- **Next action:** **Phase 5 — Student portal.** Lưu ý: notification do RPC sinh đã trỏ sẵn `/student/results`, `/student/evaluations`, `/student/assignments/[id]` — **3 route đó chưa tồn tại**, Phase 5 phải tạo đúng đường dẫn này nếu không thông báo dẫn tới 404.

### [2026-07-14] Phiên 16 — Claude — P4-T9 (Teacher reports)
- **Làm được:** `/teacher/progress` từ ComingSoon thành **Báo cáo lớp** thật: chọn lớp → 4 KPI (học viên đang học · chuyên cần TB · điểm TB · tiến độ TB), khối **Học viên cần chú ý** kèm lý do rủi ro và nút *Ghi nhận xét* nhảy thẳng sang hồ sơ đánh giá (P4-T8), và bảng chi tiết từng học viên (chuyên cần, có mặt/muộn/vắng, bài đã nộp, điểm TB, tiến độ, đủ điều kiện hoàn thành).
- **Không viết SQL mới:** dùng đúng 4 view có sẵn (`v_class_progress`, `v_enrollment_progress`, `v_student_attendance_summary`, `v_at_risk_students`). View là `security_invoker` → RLS chạy dưới danh nghĩa người gọi và tự khoanh về `class_teachers`. Vì vậy **không có một dòng `where teacher_id` nào** trong query: cùng câu đó, admin thấy mọi lớp, giáo viên chỉ thấy lớp mình. Tự lọc thêm ở app là tạo nguồn sự thật thứ hai về quyền — và cái ở app là cái sẽ quên cập nhật.
- **Học viên đã rút/chuyển lớp không nằm trong báo cáo** — giữ mẫu số chuyên cần đúng (cùng luật với P4-T1/T4).
- **Đổi nhãn menu:** "Đánh giá tiến độ" → **"Báo cáo lớp"**. Sau khi P4-T8 thêm "Đánh giá & Ghi chú", hai mục cùng chữ "đánh giá" nhưng khác hẳn nội dung là mời gọi bấm nhầm.
- **File thay đổi:** `src/features/reports/server/teacher-queries.ts` (mới), `src/app/(dashboard)/teacher/progress/page.tsx`, `src/lib/permissions/navigation.ts`, `tests/e2e/report.smoke.spec.ts` (mới), `docs/08-phase-plan.md`, `WORKLOG.md`.
- **Migration/data impact:** **không có migration** — task này chỉ đọc.
- **Đã test (THẬT, có số):** `npm run lint` sạch · `npm run typecheck` sạch · `npm test` **32/32** · `npm run build` xanh, `/teacher/progress` là `ƒ`. **Playwright Chromium 1/1 PASS**: KPI "Học viên đang học" và số dòng bảng chi tiết **khớp đúng số enrollment đang mở đọc thẳng từ DB bằng postgres** (không phải tin vào chính UI). **Gate Phase 4:** GV A không thấy LOP-03 ở đâu trên trang; gõ thẳng `?class=<LOP-03>` cũng **không** mở được báo cáo lớp đó — RLS trả 0 dòng nên trang rơi về lớp GV A thực sự dạy, không lộ một dòng dữ liệu nào.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** không có blocker P4-T9. BLK-1/BLK-2 vẫn chỉ chặn deploy cloud.
- **Next action:** **P4-T10** — Tests (component + RLS negative) → đóng Phase 4.

### [2026-07-14] Phiên 15 — Claude — P4-T8 (Đánh giá & ghi chú)
- **Làm được:** `/teacher/evaluations` (chọn lớp → roster học viên, hiện số đánh giá đã gửi + số ghi chú nội bộ) và `/teacher/evaluations/[enrollmentId]`: **đánh giá học tập** (ngày + kỳ, 7 mức rating: chung + 6 kỹ năng, điểm mạnh / cần cải thiện / kế hoạch / nhận xét) lưu **nháp**, rồi *Gửi cho học viên* là hành động riêng; **ghi chú** về học viên với hai phạm vi rõ ràng. Ghi chú nội bộ có viền cảnh báo + dòng chữ "Học viên không đọc được ghi chú này" ngay dưới mỗi ghi chú — người dùng không phải đoán.
- **🔒 Ranh giới cốt lõi của task (DoD):** học viên **KHÔNG** đọc được ghi chú `staff_only`. Đây là **RLS ở DB**, không phải ẩn UI: pgTAP dùng **chính JWT của học viên** quét toàn bảng `student_notes` → chỉ trả về đúng ghi chú `student_visible`; đánh giá chưa gửi → **0 dòng**. Học viên cũng không tạo/sửa được ghi chú trong hồ sơ của mình (INSERT bị RLS chặn; UPDATE chạy nhưng lọc 0 row).
- **Bẫy hai cột đã bịt (migration 28):** `learning_evaluations` có **hai** cột cùng quyết định "học viên có thấy không" — `published_at` và `visible_to_student`. Bật một, quên cột kia → giáo viên tin là đã gửi đánh giá mà học viên không thấy gì (hoặc ngược lại, tưởng còn nháp mà học viên đã đọc). Đã REVOKE cả hai khỏi `GRANT UPDATE` của `authenticated` và chỉ cho RPC `publish_evaluation` đặt **cùng lúc**. Không còn đường nào bật lệch.
- **Cùng bộ luật với P4-T7:** `created_by` ép về `auth.uid()` (client khai giả bị bỏ qua) và bất biến · `enrollment_id` bất biến (đổi = chuyển ghi chú/đánh giá sang hồ sơ người khác, không phải "sửa") · đánh giá đã gửi **không hard delete** · rating bỏ trống = *chưa đánh giá*, không phải `weak`.
- **File thay đổi:** `supabase/migrations/20260714000028_evaluation_notes_integrity.sql`, `supabase/tests/database/evaluation_notes.test.sql`, `src/features/evaluations/*` (schema, queries, actions, `evaluation-profile.tsx`), `src/app/(dashboard)/teacher/evaluations/{page.tsx,[id]/page.tsx}`, `src/lib/permissions/navigation.ts`, `src/types/database.ts`, `tests/e2e/evaluation.smoke.spec.ts` (mới), `docs/{02,04,08}`, `WORKLOG.md`.
- **Migration/data impact:** migration 28 không xóa dữ liệu, không đổi cột. Thêm 1 RPC (`publish_evaluation`), 5 trigger (attribution + initial state + chặn xóa bản đã gửi), thu hẹp GRANT UPDATE `learning_evaluations`. Reset sạch áp đủ **28 migration**; seed dev nạp lại bằng `npm run db:seed:dev`, kiểm mắt UTF-8 đúng.
- **Đã test (THẬT, có số):** `npm run lint` sạch · `npm run typecheck` sạch · `npm test` **32/32** · `npx supabase test db` **151/151** (23 assertion riêng đánh giá/ghi chú) · `npm run build` xanh, `/teacher/evaluations` + `/teacher/evaluations/[id]` đều là `ƒ`. **Playwright Chromium 2/2 PASS** (chạy song song cả P4-T7 + P4-T8): GV A ghi chú nội bộ → DB `staff_only`, `created_by` = GV A → ghi chú chia sẻ → `student_visible` → đánh giá nháp: DB xác nhận `published_at IS NULL` **và** `visible_to_student = false`, **0 notification** → bấm Gửi → **cả hai cột bật cùng lúc**, đúng **1** notification. **IDOR: GV A mở hồ sơ học viên của LOP-03 → 404**; URL rác (`/teacher/evaluations/khong-phai-uuid`) → **404, không phải 500**.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** không có blocker P4-T8. BLK-1/BLK-2 vẫn chỉ chặn deploy cloud. Nhắc lại từ phiên 14: `/teacher/assignments/[id]` và `/teacher/sessions/[id]` (file Codex) **nhiều khả năng vẫn trả 500 với URL không phải uuid** — ngoài scope nên chưa sửa.
- **Next action:** **P4-T9** — Teacher reports (chỉ lớp mình dạy; dùng lại 5 view `security_invoker`).

### [2026-07-14] Phiên 14 — Claude — P4-T7 (Assessment)
- **Làm được:** `/teacher/assessments` (chọn lớp → tạo/sửa/xóa bài KT) và `/teacher/assessments/[id]` (bảng nhập điểm). Mỗi học viên một form: **điểm tổng + 6 kỹ năng** (nghe/nói/đọc/viết/từ vựng/ngữ pháp) + nhận xét, kèm nút *Tính TB 6 kỹ năng* điền hộ ô điểm tổng. Thanh trên cùng đếm "đã chấm x/y · đã công bố z" và nút **Công bố** riêng biệt. Tab Kiểm tra ở chi tiết lớp và menu trái đã nối thẳng vào.
- **Ba chỗ dễ sai đã xử lý có chủ ý:**
  1. **Ô điểm để trống ≠ 0 điểm.** `z.coerce.number()` biến chuỗi rỗng thành **0** — nghĩa là kỹ năng chưa chấm sẽ bị ghi 0 vào học bạ học viên. Schema map rỗng → `null`.
  2. **Công bố là hành động riêng, không phải một cột form.** `published_at` bị REVOKE khỏi `GRANT UPDATE` của `authenticated` → không có đường nào set nó bằng UPDATE trực tiếp, chỉ qua RPC.
  3. **Sửa điểm sau khi công bố không âm thầm thu hồi kết quả** học viên đã nhìn thấy (`published_at` không nằm trong nhánh `DO UPDATE` của upsert).
- **🔒 Phân quyền/toàn vẹn (migration 27):** INSERT ép `published_at = null` + `created_by = auth.uid()` cho **mọi** user flow có JWT (kể cả super admin, đúng bài học `BUG-M11-001`). `INSERT`/`UPDATE` trực tiếp vào `assessment_results` bị **REVOKE** — mọi lần nhập điểm đi qua `save_assessment_result` (một hành động = một đường ghi). Trigger kiểm: enrollment cùng lớp với bài KT · HV đã rút/chuyển lớp **không** nhận điểm · điểm trong `0..max_score` · `graded_by` = actor thật. Bài KT/kết quả **đã công bố không hard delete**. `publish_assessment_results` khóa hàng, **từ chối công bố khi chưa có điểm nào**, và chỉ công bố dòng đã có điểm tổng — HV chưa chấm không bị báo "đã có kết quả" rồi mở ra thấy ô trống.
- **Chốt thang điểm 0..100 ở DB:** `grading_scale_rules` và các CHECK của `assessment_results` đều chạy trên 0..100, nhưng `assessments.max_score` trước đó cho phép mọi số > 0. Đặt `max_score = 300` sẽ tạo ra bài KT **không bao giờ nhập nổi điểm đúng thang** — bẫy im lặng. Đã thêm CHECK `max_score ≤ 100`.
- **Bug tự bắt được khi smoke:** URL `/teacher/assessments/<chuỗi-không-phải-uuid>` trả **500 kèm stack** thay vì 404 (chuỗi rác đi thẳng xuống Postgres). Đã chặn bằng guard uuid ở query → trả `null` → `notFound()`. ⚠️ **Cùng lỗi này nhiều khả năng còn ở `/teacher/assignments/[id]` và `/teacher/sessions/[id]`** (file của Codex, ngoài scope task này nên **không sửa** — đề nghị Codex kiểm).
- **File thay đổi:** `supabase/migrations/20260714000027_assessment_integrity.sql`, `supabase/tests/database/assessment_integrity.test.sql`, `src/features/assessments/*` (schema, queries, actions, `assessment-manager.tsx`, `assessment-score-board.tsx`), `src/app/(dashboard)/teacher/assessments/{page.tsx,[id]/page.tsx}`, `src/app/(dashboard)/teacher/classes/[id]/page.tsx` (tab Kiểm tra), `src/lib/permissions/navigation.ts`, `src/types/database.ts`, `tests/e2e/assessment.smoke.spec.ts` (mới), `docs/{02,04,08}`, `WORKLOG.md`.
- **Migration/data impact:** migration 27 không xóa dữ liệu (bảng `assessments` đang rỗng). Thêm 1 RPC (`save_assessment_result`), sửa `publish_assessment_results`, 5 trigger toàn vẹn, 1 CHECK, thu hẹp GRANT UPDATE `assessments` và REVOKE INSERT/UPDATE `assessment_results`. Reset sạch áp đủ **27 migration**. Seed dev nạp bằng `npm run db:seed:dev` (byte thô) và kiểm mắt UTF-8 đúng (`Quản trị viên Demo`, không mojibake).
- **Đã test (THẬT, có số):** `npm run lint` sạch · `npm run typecheck` sạch · `npm test` **28/28** · `npx supabase test db` **128/128** (28 assertion riêng assessment) · `npm run build` xanh, `/teacher/assessments` và `/teacher/assessments/[id]` đều là `ƒ`. **Playwright Chromium 1/1 PASS** (`tests/e2e/assessment.smoke.spec.ts`, tự dọn dữ liệu, cần seed dev): GV A tạo bài KT → DB xác nhận `published_at IS NULL` + `created_by` = GV A (không phải giá trị client khai) → nhập 6 kỹ năng → *Tính TB* ra đúng 85 → lưu → DB `85.00|90.00|Giỏi|graded_by=GV A|chưa công bố` (**xếp loại do DB tính**) → **0 notification khi chưa công bố** → Công bố → đúng **1** notification cho đúng học viên đã có điểm, nút Công bố tự tắt. **IDOR: GV A mở bài KT của LOP-03 (lớp GV B, GV A không có cả vai trợ giảng) → 404**, class picker không hề có LOP-03.
- **🔍 QA — xác minh độc lập 2 fix của Codex (vai Claude = verify):** cả hai **PASS**, dựng kịch bản riêng chứ không chạy lại test của Codex. `BUG-M11-001`: super admin JWT thật (`app.is_super_admin() = true`) INSERT submission tự khai `status='graded'`, `score=100`, `graded_by=<chính mình>` → DB ép về `submitted` / `score=NULL` / `graded_by=NULL` → **nhánh admin thật sự bị chặn**. `BUG-M06-001`: schema nhận payload **thiếu hẳn** `module_id`/`lesson_id` (ca "Cả khóa học") → `null`, uuid rác vẫn từ chối (4/4 vitest, giữ lại `tests/unit/domain/material-schema.verify.test.ts` làm test hồi quy); và vì action đã mở cho teacher nên kiểm luôn chốt chặn thật: GV A ghi tài liệu vào khóa **HSK3 không dạy** → `new row violates row-level security policy`, **0 dòng**. Verification Queue giờ **trống**.
- **Quyết định mới:** không có.
- **Blocker/rủi ro:** không có blocker P4-T7. BLK-1/BLK-2 vẫn chỉ chặn deploy cloud.
- **Next action:** **P4-T8** — Đánh giá & ghi chú (`learning_evaluations` + `student_notes`, `staff_only` HV không đọc được).
