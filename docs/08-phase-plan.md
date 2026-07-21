# 08 — Phase Plan & Task Ledger

> **Sổ cái công việc — nguồn sự thật về "còn phải làm gì".**
> File này **gần như bất biến**: task chỉ được thêm, không xóa. Trạng thái động (ai đang làm, làm tới đâu) nằm ở [`WORKLOG.md`](../WORKLOG.md).
>
> **Claude và Codex dùng chung file này.** Không chia cứng "Claude làm phase nào, Codex làm phase nào" — session nào hết token thì session sau đọc `WORKLOG.md` → thấy task ID tiếp theo → làm tiếp. Task được thiết kế đủ nhỏ để **một session làm xong một task**.

---

## Cách dùng (bắt buộc — cả Claude lẫn Codex)

1. Đọc `WORKLOG.md` → mục **VIỆC TIẾP THEO** → lấy task ID (vd `P2-T11`).
2. **Claim task**: ghi vào `WORKLOG.md` → `TRẠNG THÁI HIỆN TẠI`: `P2-T11 — đang làm — Claude — <ngày>`.
3. Làm **đúng phạm vi task đó**. Không đụng file ngoài scope. Không "tiện tay sửa luôn" thứ khác — sẽ giẫm chân agent kia.
4. Xong: chạy đủ **Definition of Done** của task → cập nhật `WORKLOG.md` (trạng thái, nhật ký, next action) → bàn giao thay đổi để **user tự review và commit**. Agent không tự chạy `git commit`.
5. Không xong: ghi **blocker thật** vào `WORKLOG.md`, để task ở trạng thái `đang dở`, mô tả chính xác đang dở ở đâu.

**Ba điều tuyệt đối không được làm:**

- ❌ Ghi "pass / done / verified / deployed" khi **chưa chạy thật**.
- ❌ Sửa test cho nó xanh thay vì sửa code.
- ❌ Ghi đè thay đổi của agent kia ở file ngoài scope task của mình.

**Ký hiệu trạng thái:** `☐` chưa làm · `◐` đang dở · `☑` xong (đã chạy DoD) · `⛔` blocked

---

## Phase 0 — Khảo sát & đặc tả

**Gate:** docs không mâu thuẫn; phân biệt đúng Course / Class / Session.

| ID    | Task                           | Definition of Done                                                                      | Trạng thái |
| ----- | ------------------------------ | --------------------------------------------------------------------------------------- | ---------- |
| P0-T1 | Khảo sát repo XKLĐ (read-only) | Đã đọc source, QA board, docs, WORKLOG cũ. Repo cũ **không bị sửa** (`git status` sạch) | ☑          |
| P0-T2 | Tạo repo mới + git init        | `Documents\Polymind Chinese`, branch `main`, `.gitignore`                               | ☑          |
| P0-T3 | docs 01–04                     | BA, DB design (ERD + RLS matrix), workflow, architecture                                | ☑          |
| P0-T4 | docs 05–07 + QA board          | testing strategy, deployment, backlog, `docs/testing/MODULE_QA_BOARD.md`                | ☑          |
| P0-T5 | Bộ phối hợp AI                 | `WORKLOG.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `.env.example`, file này           | ☑          |
| P0-T6 | Commit Phase 0                 | Commit đầu tiên trên `main`                                                             | ☑          |

---

## Phase 1 — Scaffold & nền tảng

**Gate:** 3 role login → redirect đúng khu vực; anonymous bị chặn; CI xanh.

| ID    | Task              | Definition of Done                                                                                                                        | Trạng thái |
| ----- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P1-T1 | Scaffold Next.js  | App Router, TS `strict`, npm, ESLint + Prettier. `npm run build` xanh                                                                     | ☑          |
| P1-T2 | UI stack          | Tailwind + shadcn/ui + Lucide + font Be Vietnam Pro (fallback CJK). Theme POLYMIND (primary xanh, đỏ chỉ là accent)                       | ☑          |
| P1-T3 | Test stack        | Vitest + RTL + Playwright config. 1 smoke test mỗi loại chạy được                                                                         | ☑          |
| P1-T4 | Supabase local    | `supabase init` + `config.toml` + `npx supabase start` chạy được trên Docker                                                              | ☑          |
| P1-T5 | 3 Supabase client | `lib/supabase/{client,server,admin}.ts`. `admin.ts` có `import 'server-only'`                                                             | ☑          |
| P1-T6 | Auth SSR          | login / forgot-password / reset-password / accept-invite + `middleware.ts` (ES256 `getClaims()`, **không** `getSession()`; role/active vẫn từ `profiles`) + guard theo role | ☑          |
| P1-T7 | App shell 3 role  | Sidebar desktop + bottom nav mobile (4–5 mục), menu đúng đặc tả §16                                                                       | ☑          |
| P1-T8 | CI                | GitHub Actions: lint + typecheck + unit test + build                                                                                      | ☑          |

---

## Phase 2 — Schema, RLS & seed

**Gate:** `supabase db reset` sạch · seed idempotent (chạy 2 lần không nhân đôi) · **pgTAP RLS tests pass**.

| ID     | Task                           | Definition of Done                                                                                                                                                | Trạng thái |
| ------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P2-T1  | Migration: enum + danh tính    | Toàn bộ enum type; `profiles`, `teachers`, `students`; trigger `set_updated_at()`                                                                                 | ☑          |
| P2-T2  | Migration: chương trình        | `levels`, `courses`, `course_modules`, `lessons`, `course_materials`                                                                                              | ☑          |
| P2-T3  | Migration: lớp & lịch          | `classes`, `class_teachers` (+ partial unique 1 primary), `class_schedules`, `class_sessions`                                                                     | ☑          |
| P2-T4  | Migration: ghi danh            | `enrollments` (UNIQUE `student_id,class_id`), `enrollment_status_history` (append-only)                                                                           | ☑          |
| P2-T5  | Migration: điểm danh & tiến độ | `attendance_records` (UNIQUE `session_id,enrollment_id`) + trigger class-match; `lesson_progress`                                                                 | ☑          |
| P2-T6  | Migration: bài tập             | `assignments`, `assignment_attachments`, `submissions`, `submission_files` + trigger `score ≤ max_score`                                                          | ☑          |
| P2-T7  | Migration: kiểm tra & đánh giá | `assessments`, `assessment_results`, `grading_scale_rules` (EXCLUDE chống chồng ngưỡng), `learning_evaluations`, `student_notes`                                  | ☑          |
| P2-T8  | Migration: học phí             | `tuition_invoices`, `tuition_invoice_items`, `tuition_payments`, `tuition_receipts` (**UNIQUE `payment_id`**)                                                     | ☑          |
| P2-T9  | Migration: thông báo & audit   | `announcements`, `notifications` (partial unique dedupe), `notification_preferences`, `audit_logs`                                                                | ☑          |
| P2-T10 | Helper functions schema `app`  | 9 hàm RLS, `SECURITY DEFINER`, `SET search_path=''`, **fail-closed** (không nhánh `return true`)                                                                  | ☑          |
| P2-T11 | RLS policies                   | **Mọi bảng** `ENABLE RLS`. Đúng ma trận docs/02 §6. `anon` deny toàn bộ                                                                                           | ☑          |
| P2-T12 | Views                          | 5 view, `security_invoker = true`                                                                                                                                 | ☑          |
| P2-T13 | RPC                            | 8 RPC transaction (docs/02 §8), kiểm quyền ở dòng đầu, revoke `PUBLIC`/`anon`                                                                                     | ☑          |
| P2-T14 | Storage                        | 5 private bucket + policy soi đúng class/student                                                                                                                  | ☑          |
| P2-T15 | Seed                           | `seed.sql`: HSK 1–6, grading scale, catalog cốt lõi, 2 chương trình VCB, `LOP-01/02/03` (LOP-01 **không** có lịch lặp). `seed.dev.sql`: user demo (danh tính giả) | ☑          |
| P2-T16 | pgTAP RLS/IDOR tests           | Anonymous deny · Student A ≠ Student B · teacher ngoài lớp · teacher đọc tuition/audit · student sửa điểm                                                         | ☑          |
| P2-T17 | Generate types                 | `types/database.ts` từ `supabase gen types`                                                                                                                       | ☑          |

---

## Phase 3 — Academic admin core

**Gate:** super admin đi trọn Course → Class → Schedule → sinh buổi → gán GV → Enrollment.

| ID     | Task                                  | Definition of Done                                                             | Trạng thái |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------ | ---------- |
| P3-T1  | Layout admin + dashboard skeleton     | 10 mục menu §16                                                                | ☑          |
| P3-T2  | CRUD Level + Course + Module + Lesson | List/detail/form, validate Zod                                                 | ☑          |
| P3-T3  | Course materials                      | Upload private bucket, signed URL, `visibility`                                | ☑          |
| P3-T4  | CRUD Teacher + invite                 | Hồ sơ + gửi invite (admin client, server-only)                                 | ☑          |
| P3-T5  | CRUD Student + invite                 | Hồ sơ (tạo trước, invite sau), guardian là **field**, không phải role          | ☑          |
| P3-T6  | CRUD Class + phân công GV             | Sĩ số, hình thức, địa điểm tự do, một giáo viên phụ trách mỗi lớp              | ☑          |
| P3-T7  | Schedule + sinh buổi học              | UI lịch lặp + nút sinh buổi (idempotent) + hỗ trợ **lớp linh hoạt không lịch** | ☑          |
| P3-T8  | Enrollment lifecycle                  | Ghi danh / tạm dừng / chuyển lớp / rút / hoàn thành — qua RPC, giữ history     | ☑          |
| P3-T9  | Admin dashboard                       | KPI thật từ view (§15)                                                         | ☑          |
| P3-T10 | Unit test domain                      | Recurrence 35 buổi · capacity · enrollment transitions                         | ☑          |

---

## Phase 4 — Teacher operations ✅ **XONG (2026-07-14)**

**Gate:** teacher **không** truy cập được lớp ngoài scope qua UI, direct URL, server action **và** Supabase client trực tiếp.

> **Gate ĐÃ KIỂM CHỨNG THẬT, cả 4 đường:**
>
> - **UI** — GV A không thấy LOP-03 ở dashboard, danh sách lớp, class picker của bài tập / bài KT / đánh giá / báo cáo.
> - **Direct URL** — đoán URL buổi học, assignment, bài KT, hồ sơ đánh giá của lớp GV B đều trả **404**, không lộ một dòng dữ liệu. URL không phải uuid cũng **404** (không phải 500 kèm stack).
> - **Server action / RPC** — GV A gọi thẳng `bulk_mark_attendance`, `save_session_log`, `save_assessment_result`, `publish_assessment_results`, `publish_evaluation` cho lớp ngoài scope → bị **từ chối**, dữ liệu không đổi.
> - **Supabase client trực tiếp** — dùng chính JWT của GV A/học viên quét thẳng bảng: teacher lớp khác nhận **0 dòng**; học viên **không** đọc được ghi chú `staff_only`, kết quả/đánh giá chưa công bố.
>
> Bằng chứng: pgTAP **151/151** (`assessment_integrity`, `evaluation_notes`, `session_log`, `assignment_integrity`, `submission_grading`) · Playwright gate **3/3** + route-param regression **1/1** · Vitest **43/43**.

| ID     | Task                  | Definition of Done                                                                             | Trạng thái |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| P4-T1  | Dashboard "Hôm nay"   | Lịch dạy, buổi chưa điểm danh, bài chờ chấm, HV cần chú ý. Vào lớp/buổi trong **1–2 thao tác** | ☑          |
| P4-T2  | Class detail (tabs)   | Tổng quan · Lịch/Buổi · Học viên · Điểm danh · Bài tập · Kiểm tra · Tiến độ · Tài liệu         | ☑          |
| P4-T3  | Session log           | Mở/hoàn tất buổi, nội dung thực dạy, lesson progress                                           | ☑          |
| P4-T4  | **Attendance roster** | Một màn hình, nút lớn, chọn hàng loạt, nút Lưu **sticky**. Bấm 2 lần không sinh trùng          | ☑          |
| P4-T5  | Assignment            | CRUD + attachment + publish (draft ≠ publish)                                                  | ☑          |
| P4-T6  | Chấm bài              | Xem bài nộp (text/file) + điểm + feedback                                                      | ☑          |
| P4-T7  | Assessment            | Tạo bài KT, nhập điểm tổng + 6 kỹ năng, draft → publish (RPC)                                  | ☑          |
| P4-T8  | Đánh giá & ghi chú    | `learning_evaluations` + `student_notes` (`staff_only` HV **không đọc được**)                  | ☑          |
| P4-T9  | Teacher reports       | Chỉ lớp mình dạy                                                                               | ☑          |
| P4-T10 | Tests                 | Component + RLS negative (teacher lớp khác)                                                    | ☑          |

---

## Phase 5 — Student portal ✅ **XONG (2026-07-14)**

**Gate:** student **không** thấy bất kỳ dữ liệu học viên khác; submission end-to-end pass.

> **Gate ĐÃ KIỂM CHỨNG THẬT:**
>
> - **Không thấy dữ liệu HV khác** — pgTAP `student_isolation.test.sql` dựng **HV-A và HV-B CÙNG MỘT LỚP** (ca khó nhất: mọi điều kiện theo `class_id` đều đúng cho cả hai) rồi quét thẳng bảng bằng **JWT của A**: `students` 1 dòng (của A) · `enrollments` 1 dòng · `submissions` **0** (không đọc được bài của B) · `assessment_results` **0** (không đọc được điểm của B dù đã công bố cho B) · `attendance_records` chỉ của A. A cũng **không** nộp bài được dưới danh nghĩa ghi danh của B, **không** tự sửa điểm, **không** tự nâng `role`.
> - **Submission end-to-end** — Playwright: HV1 nộp text → DB `enrollment_id` đúng, `status=submitted`, `submitted_at` do DB đặt, điểm tự khai bị **xóa sạch** → upload file private (path đúng `{class_id}/{submission_id}/…`) → GV chấm bằng RPC → HV thấy **88,5** + nhận xét, và bài **bị khóa sửa**.
> - **Direct URL** — bài tập lớp khác → **404**; URL không phải uuid → **404** (không phải 500).
>
> Bằng chứng: pgTAP **167/167** · Playwright **5/5** · Vitest **43/43**.

| ID    | Task                             | Definition of Done                                            | Trạng thái |
| ----- | -------------------------------- | ------------------------------------------------------------- | ---------- |
| P5-T1 | Dashboard                        | Buổi kế tiếp, deadline, chuyên cần, điểm mới, học phí sắp hạn | ☑          |
| P5-T2 | Lịch học + tài liệu              | Buổi học + tài liệu đã publish                                | ☑          |
| P5-T3 | Chuyên cần cá nhân               | Chỉ của mình                                                  | ☑          |
| P5-T4 | Nộp bài                          | Text + file upload, trạng thái đúng hạn/muộn                  | ☑          |
| P5-T5 | Kết quả & tiến độ                | Chỉ bản **đã publish** + đánh giá `visible_to_student`        | ☑          |
| P5-T6 | Hồ sơ + đổi mật khẩu + thông báo | Không sửa được `role`/`is_active`                             | ☑          |
| P5-T7 | Tests                            | E2E nộp bài; negative: xem lớp/HV khác                        | ☑          |

---

## Phase 6 — Tuition, notifications & reports

**Gate:** finance self-scope đúng · **teacher không đọc được tuition** · export giữ đúng filter.

| ID    | Task                   | Definition of Done                                       | Trạng thái |
| ----- | ---------------------- | -------------------------------------------------------- | ---------- |
| P6-T1 | Invoice                | CRUD + items + phát hành                                 | ☑          |
| P6-T2 | Payment + Receipt      | Qua RPC `record_tuition_payment` → **đúng 1 receipt**    | ☑          |
| P6-T3 | Học phí (student view) | Chỉ của mình; **không** tự ghi nhận thanh toán           | ☑          |
| P6-T4 | Notifications in-app   | Chuông + danh sách + preferences + link có authorization | ☑          |
| P6-T5 | Announcements          | Toàn hệ thống / theo lớp, một chiều                      | ☑          |
| P6-T6 | Cron                   | 3 route + `CRON_SECRET` + `dedupe_key`                   | ☑          |
| P6-T7 | Reports + Export       | CSV/XLSX **giữ đúng filter/date range đang chọn**        | ☑          |
| P6-T8 | Audit log viewer       | Chỉ super admin                                          | ☑          |
| P6-T9 | Tests                  | Integration: payment → 1 receipt (kể cả gọi đồng thời)   | ☑          |

---

## Phase 7 — Hardening & deploy

**Gate:** đạt toàn bộ Definition of Done ở đặc tả §21.

| ID     | Task                            | Definition of Done                                                                                                                                                                                                                                                                 | Trạng thái |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P7-T1  | Security review                 | IDOR, upload abuse, rate limit, path traversal                                                                                                                                                                                                                                     | ☑          |
| P7-T2  | pgTAP full matrix               | Đủ SELECT/INSERT/UPDATE/DELETE + RPC + Storage cho 3 role                                                                                                                                                                                                                          | ☑          |
| P7-T3  | E2E 3 role                      | 6 kịch bản ở `05-testing-strategy.md`                                                                                                                                                                                                                                              | ☑          |
| P7-T4  | A11y + responsive               | WCAG AA, touch target 44px, keyboard nav                                                                                                                                                                                                                                           | ☑          |
| P7-T5  | Production build                | `npm run build` với env hợp lệ                                                                                                                                                                                                                                                     | ☑          |
| P7-T6  | Deploy docs                     | Backup/restore + rollback + migration rehearsal                                                                                                                                                                                                                                    | ☑          |
| P7-T7  | Deploy cloud                    | Supabase migration trước app; cấu hình Auth/Storage/env; smoke test URL thật                                                                                                                                                                                                       | ☑          |
| P7-T8  | Admin cấp tài khoản trực tiếp   | Super Admin tạo tên đăng nhập + mật khẩu cho giáo viên/học viên tại trang quản trị; không bắt buộc email; đăng nhập và đặt lại mật khẩu vẫn fail-closed. **P7-T8b (2026-07-17):** `/admin/system` thành 2 tab Quản trị \| Nhật ký audit; tab Quản trị liệt kê MỌI tài khoản theo role kèm tên đăng nhập, đổi username/mật khẩu và khóa/mở tại chỗ (chặn tự khóa mình; mật khẩu cũ không hiển thị lại được). Chưa smoke runtime. | ☑          |
| P7-T9  | Bỏ vai trò trợ giảng            | Một giáo viên được làm giáo viên chính của nhiều lớp; mỗi lớp chỉ có một giáo viên phụ trách; loại `assistant` khỏi schema/enum, dữ liệu phân công, UI, RLS, seed, types và docs bằng forward migration có test; xử lý dữ liệu trợ giảng hiện hữu mà không làm mất lịch sử âm thầm | ☑          |
| P7-T10 | Tối ưu độ trễ + loading UX      | Loại request xác thực/hồ sơ trùng trong một lần render, tránh chuỗi chờ không cần thiết mà không nới quyền/cache dữ liệu user; có loading overlay giữa màn hình, hỗ trợ reduced motion và screen reader; lint/typecheck/unit/build xanh                                            | ☑          |
| P7-T11 | Phân dòng khóa học + tự sinh mã | Course có dropdown Chương trình `core/business`; Loại chỉ xuất hiện và bắt buộc với `core`, `business` lưu Loại rỗng; bỏ mọi ô nhập mã nghiệp vụ trên web và tự sinh mã ở server/DB với UNIQUE + test; cập nhật docs/types/UI                                                      | ☑          |
| P7-T12 | Thời khóa biểu tuần/tháng       | Card Buổi học ở lịch admin mặc định là thời khóa biểu tuần, có lùi/tiến và mốc hôm nay; chuyển được giữa Tối giản/Tuần/Tháng, giữ mutation hủy/xóa đúng quyền, responsive và có unit/component test; lint/typecheck/unit/build xanh | ☑ |

---

## Phase 8 — Chốt đặc tả assessment engine

**Gate:** quyết định EX-01…EX-20, schema, RLS và impact map đồng bộ trước khi thêm schema mới.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P8-T1 | Đồng bộ quyết định | Thêm EX-01…EX-20 vào docs/WORKLOG; không code | ☑ |
| P8-T2 | Schema design final | ERD + enum + table + FK + state machine được review | ☑ |
| P8-T3 | RLS matrix final | Ma trận 3 role + giáo viên phụ trách + answer key | ☑ |
| P8-T4 | Migration inventory | Count thật bảng/bucket cũ; backup; báo cáo không có data thật | ☑ |
| P8-T5 | Source impact map | Liệt kê route/component/query/RPC/test cũ cần thay | ☑ |

---

## Phase 9 — Question Bank & Builder

**Gate:** giáo viên dựng, version, chia sẻ, preview và import được bộ có đủ 11 dạng câu; answer key fail-closed.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P9-T1 | Migration question core | questions, versions, options, answer_keys, tags, collections | ☑ |
| P9-T2 | Migration sharing/review | shares + global review + RLS | ☑ |
| P9-T3 | Migration set core | sets, versions, sections, items + immutable rule | ☑ |
| P9-T4 | Storage question-media | Bucket private + policy/path/upload validation | ☑ |
| P9-T5 | Domain schemas | Zod schema 11 question type | ☑ |
| P9-T6 | Question Bank list | Search/filter/pagination/scope | ☑ |
| P9-T7 | Question CRUD | Create/edit/version/archive/clone | ☑ |
| P9-T8 | Sharing flow | Share teacher + submit/approve/reject global | ☑ |
| P9-T9 | Builder shell | Section/item reorder + score summary | ☑ |
| P9-T10 | Editor objective types | Q1–Q7 | ☑ |
| P9-T11 | Editor passage/audio types | Q8–Q10 + media | ☑ |
| P9-T12 | Editor essay | Q11 + rubric | ☑ |
| P9-T13 | Preview/render registry | Cùng renderer với student | ☑ |
| P9-T14 | Excel template/import | Dry-run + error report + transaction | ☑ |
| P9-T15 | Tests gate | pgTAP/RLS/unit/component xanh | ☑ |

---

## Phase 10 — Module Bài tập mới

**Gate:** teacher giao đúng lớp; student autosave/resume/submit; auto + manual grade và release đúng rule.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P10-T1 | Migration exercise | deliveries, attempts, answers, enum/index | ☑ |
| P10-T2 | Exercise RPC/RLS | publish/start/save/submit/grade/release | ☑ |
| P10-T3 | Teacher sidebar/routes | Module riêng, không quản lý chính trong class tab | ☑ |
| P10-T4 | Set list/create | Bộ bài tập | ☑ |
| P10-T5 | Assign to managed classes | Multi-class creates separate deliveries | ☑ |
| P10-T6 | Teacher delivery list/detail | KPI/filter/progress | ☑ |
| P10-T7 | Student exercise list | 5 tab + dashboard counts | ☑ |
| P10-T8 | Student attempt renderer | 11 type + autosave | ☑ |
| P10-T9 | Submit/multiple attempts | limit + grading method + late | ☑ |
| P10-T10 | Teacher grading | theo student/theo question/rubric | ☑ |
| P10-T11 | Result/answer release | đúng mode, notification dedupe | ☑ |
| P10-T12 | Progress/report update | view/dashboard/export dùng schema mới | ☑ |
| P10-T13 | Tests gate | E2E exercise + RLS + scoring pass | ☑ |

---

## Phase 11 — Module Kiểm tra/Thi mới

**Gate:** same-day window, timer DB, autosave/finalizer, clipboard/IME, chấm/khóa/công bố và IDOR đều pass.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P11-T1 | Migration exam | deliveries, attempts, answers, integrity, regrade | ☑ |
| P11-T2 | Same-day time rules | Trigger/domain test Asia/Ho_Chi_Minh | ☑ |
| P11-T3 | Exam RPC/RLS | start/save/submit/finalize/grade/publish | ☑ |
| P11-T4 | Teacher sidebar/routes | Module riêng | ☑ |
| P11-T5 | Exam set workflow | Fixed order, no shuffle/random/access code | ☑ |
| P11-T6 | Schedule exam | Window same day + duration + validation | ☑ |
| P11-T7 | Student exam list/waiting room | Eligibility + audio check | ☑ |
| P11-T8 | Student exam attempt UI | Timer/autosave/warnings | ☑ |
| P11-T9 | Clipboard protection | Copy/cut/paste/drop block, IME safe | ☑ |
| P11-T10 | Integrity events | Log allowlist, no automatic accusation | ☑ |
| P11-T11 | Auto-submit/finalizer | Browser close vẫn finalize | ☑ |
| P11-T12 | Grading/lock/publish | 0–100 + classification | ☑ |
| P11-T13 | Regrade | audit before/after | ☑ |
| P11-T14 | Monitor/analytics/export | Scope lớp giáo viên phụ trách | ☑ |
| P11-T15 | Tests gate | E2E exam/time/clipboard/IDOR pass | ☑ |

---

## Phase 12 — Cutover & cleanup module cũ

**Gate:** app không còn query/schema/source cũ; sáu bảng và bucket cũ chỉ bị xóa sau backup/smoke.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P12-T1 | Verify new app no old query | grep + runtime smoke | ☑ |
| P12-T2 | Drop old RPC/policies/views | Migration forward-only | ☑ |
| P12-T3 | Drop old tables | 6 bảng cũ removed | ☑ |
| P12-T4 | Cleanup old buckets | Object count 0, delete policy/bucket | ☑ |
| P12-T5 | Remove old source/routes/tests | Không còn UI luồng cũ | ☑ |
| P12-T6 | Regenerate types/docs | build/typecheck xanh | ☑ |

---

## Phase 13 — QA, rehearsal & production

**Gate:** có số kiểm thử thật, rehearsal additive → app → cleanup, production smoke và monitoring.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P13-T1 | Full pgTAP matrix | Mọi bảng/RPC/Storage mới | ☐ |
| P13-T2 | Full Playwright 3 role | Exercise + exam + negative | ☐ |
| P13-T3 | A11y/mobile/IME | 44px, keyboard, Chinese input real devices | ◐ |
| P13-T4 | Performance test | Có số thật, không đoán | ◐ |
| P13-T5 | Security review | Answer key/XSS/IDOR/rate limit/import | ☐ |
| P13-T6 | Staging rehearsal | Migration A → app → cleanup | ☐ |
| P13-T7 | Production deploy | DB additive trước app, smoke, cleanup sau sign-off | ☐ |
| P13-T8 | Post-deploy monitoring | Error/query/storage/job/notification | ☐ |

> `PERF-M20-001` (2026-07-20): production và local đều dùng ES256; thay các lần `getUser()` trên critical path bằng helper `getClaims()` fail-closed, vẫn query role/`is_active` từ `profiles`, giữ RLS và giữ `getUser()` cho thao tác Auth nhạy cảm. Có unit test token lỗi/claims sai/tài khoản khóa/role giả và middleware không gọi `getUser()`.
>
> `BUG-M11-M12-005/006/007/008` (2026-07-20): đã sửa luồng persist MP3 khi tạo/chỉnh sửa câu hỏi, direct upload bản ghi Nói, RLS nhận audio đề đúng lượt/kết quả, và đồng bộ audio đề + bản ghi Nói ở màn giáo viên chấm/kết quả học viên cho cả Bài tập/Thi; `P13-T3` giữ `◐` cho tới khi smoke file/micro thật sau redeploy trên trình duyệt/thiết bị.
>
> `UX-M11-M12-005` (2026-07-20): nút bắt đầu Bài tập/Thi hiện spinner + nhãn đang mở và tự khóa trong lúc Server Action tạo attempt/redirect; có component test chống tái phát cho cả hai luồng.

---

## Phase 14 — Cổng lớp học & ôn tập học viên

**Gate:** học viên xem lớp hiện tại ở một nơi duy nhất; Super Admin quản trị flashcard theo khóa/buổi; học viên học flashcard và làm lại câu máy chấm từng sai mà không đọc được answer key ngoài RPC; RLS/Storage/IDOR, animation bàn phím/mobile và migration cloud đều được kiểm chứng.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P14-T1 | Chốt đặc tả & impact map | Docs 01–04 có business rule, schema/RLS/Storage, workflow + failure path, kiến trúc; chốt rõ loại câu được ôn, vòng đời mastery, cấu trúc trang/mặt flashcard và source impact | ☑ |
| P14-T2 | Học viên — Lớp của tôi | `/student/class` gộp lịch/tài liệu/chuyên cần và bổ sung tổng quan, bài tập, kiểm tra, tiến độ ở chế độ chỉ đọc; `/student/schedule` redirect tương thích; không lộ roster; typecheck + component/server test xanh | ☑ |
| P14-T3 | Migration Flashcard | Deck theo course; section theo số buổi; page mở đầu/thẻ từ vựng có thứ tự, 2 ảnh + audio; bucket private, RLS fail-closed, constraint/index/idempotency + pgTAP; dry-run → push cloud → remote up-to-date | ☑ |
| P14-T4 | Super Admin — Flashcard CRUD | Chọn khóa/buổi, tạo/sắp xếp/archive trang; signed direct upload 2 ảnh + audio; server xác minh path/MIME/size và ghi audit; responsive + validation/test | ☑ |
| P14-T5 | Học viên — Flashcard | Chỉ thấy deck khóa đang học; trang mở đầu + bookmark buổi không dùng dropdown; lật trang phải↔trái và lật mặt dưới↔trên độc lập; audio, phím/touch, focus/ARIA, reduced-motion + test | ☑ |
| P14-T6 | Migration Ôn câu sai | Snapshot sai từ exercise/exam đã nộp, chỉ dạng `manual_required = false`; bảng tiến độ theo student + question version; RPC lấy câu đến hạn và chấm lại atomic, đúng thì rời danh sách; RLS/answer-key fail-closed + pgTAP; áp cloud | ☑ |
| P14-T7 | Học viên — Ôn câu sai | Tab thứ hai của `/student/review`; renderer objective dùng chung, submit/loading/error rõ ràng, lưu lịch sử; đúng rời hàng đợi, sai lên lịch lại; empty state + component/server test | ☑ |
| P14-T8 | Quality gate & docs | Generate types; cập nhật nav/docs/QA/WORKLOG; lint + typecheck + Vitest + pgTAP + build xanh; smoke 3 role/IDOR/signed URL ở local, ghi rõ phần production còn chờ redeploy | ☑ |

---

## Bản đồ module ↔ phase (dùng cho QA board)

| Module | Tên                                | Sinh ra ở phase |
| ------ | ---------------------------------- | --------------- |
| M01    | Authentication & Session           | P1              |
| M02    | Authorization & RLS                | P2              |
| M03    | User & Account Management (invite) | P1, P3          |
| M04    | Students                           | P3              |
| M05    | Teachers                           | P3              |
| M06    | Courses & Curriculum               | P3              |
| M07    | Classes                            | P3              |
| M08    | Schedules & Sessions               | P3, P4          |
| M09    | Enrollments                        | P3              |
| M10    | Attendance                         | P4              |
| M11    | Assignments & Submissions          | P4, P5          |
| M12    | Assessments & Evaluations          | P4              |
| M13    | Progress & Completion              | P4, P5          |
| M14    | Tuition                            | P6              |
| M15    | Notifications & Announcements      | P6              |
| M16    | Reports & Export                   | P6              |
| M17    | Dashboards                         | P3, P4, P5      |
| M18    | Storage & Files                    | P2, P4, P5      |
| M19    | Audit Log                          | P6              |
| M20    | Security & Deployment              | P7              |
| M21    | Student Class Portal               | P14             |
| M22    | Flashcards & Wrong-answer Review   | P14             |
