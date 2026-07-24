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

| ID    | Task              | Definition of Done                                                                                                                                                          | Trạng thái |
| ----- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P1-T1 | Scaffold Next.js  | App Router, TS `strict`, npm, ESLint + Prettier. `npm run build` xanh                                                                                                       | ☑          |
| P1-T2 | UI stack          | Tailwind + shadcn/ui + Lucide + font Be Vietnam Pro (fallback CJK). Theme POLYMIND (primary xanh, đỏ chỉ là accent)                                                         | ☑          |
| P1-T3 | Test stack        | Vitest + RTL + Playwright config. 1 smoke test mỗi loại chạy được                                                                                                           | ☑          |
| P1-T4 | Supabase local    | `supabase init` + `config.toml` + `npx supabase start` chạy được trên Docker                                                                                                | ☑          |
| P1-T5 | 3 Supabase client | `lib/supabase/{client,server,admin}.ts`. `admin.ts` có `import 'server-only'`                                                                                               | ☑          |
| P1-T6 | Auth SSR          | login / forgot-password / reset-password / accept-invite + `middleware.ts` (ES256 `getClaims()`, **không** `getSession()`; role/active vẫn từ `profiles`) + guard theo role | ☑          |
| P1-T7 | App shell 3 role  | Sidebar desktop + bottom nav mobile (4–5 mục), menu đúng đặc tả §16                                                                                                         | ☑          |
| P1-T8 | CI                | GitHub Actions: lint + typecheck + unit test + build                                                                                                                        | ☑          |

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

| ID     | Task                            | Definition of Done                                                                                                                                                                                                                                                                                                                                                                                                              | Trạng thái |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P7-T1  | Security review                 | IDOR, upload abuse, rate limit, path traversal                                                                                                                                                                                                                                                                                                                                                                                  | ☑          |
| P7-T2  | pgTAP full matrix               | Đủ SELECT/INSERT/UPDATE/DELETE + RPC + Storage cho 3 role                                                                                                                                                                                                                                                                                                                                                                       | ☑          |
| P7-T3  | E2E 3 role                      | 6 kịch bản ở `05-testing-strategy.md`                                                                                                                                                                                                                                                                                                                                                                                           | ☑          |
| P7-T4  | A11y + responsive               | WCAG AA, touch target 44px, keyboard nav                                                                                                                                                                                                                                                                                                                                                                                        | ☑          |
| P7-T5  | Production build                | `npm run build` với env hợp lệ                                                                                                                                                                                                                                                                                                                                                                                                  | ☑          |
| P7-T6  | Deploy docs                     | Backup/restore + rollback + migration rehearsal                                                                                                                                                                                                                                                                                                                                                                                 | ☑          |
| P7-T7  | Deploy cloud                    | Supabase migration trước app; cấu hình Auth/Storage/env; smoke test URL thật                                                                                                                                                                                                                                                                                                                                                    | ☑          |
| P7-T8  | Admin cấp tài khoản trực tiếp   | Super Admin tạo tên đăng nhập + mật khẩu cho giáo viên/học viên tại trang quản trị; không bắt buộc email; đăng nhập và đặt lại mật khẩu vẫn fail-closed. **P7-T8b (2026-07-17):** `/admin/system` thành 2 tab Quản trị \| Nhật ký audit; tab Quản trị liệt kê MỌI tài khoản theo role kèm tên đăng nhập, đổi username/mật khẩu và khóa/mở tại chỗ (chặn tự khóa mình; mật khẩu cũ không hiển thị lại được). Chưa smoke runtime. | ☑          |
| P7-T9  | Bỏ vai trò trợ giảng            | Một giáo viên được làm giáo viên chính của nhiều lớp; mỗi lớp chỉ có một giáo viên phụ trách; loại `assistant` khỏi schema/enum, dữ liệu phân công, UI, RLS, seed, types và docs bằng forward migration có test; xử lý dữ liệu trợ giảng hiện hữu mà không làm mất lịch sử âm thầm                                                                                                                                              | ☑          |
| P7-T10 | Tối ưu độ trễ + loading UX      | Loại request xác thực/hồ sơ trùng trong một lần render, tránh chuỗi chờ không cần thiết mà không nới quyền/cache dữ liệu user; có loading overlay giữa màn hình, hỗ trợ reduced motion và screen reader; lint/typecheck/unit/build xanh                                                                                                                                                                                         | ☑          |
| P7-T11 | Phân dòng khóa học + tự sinh mã | Course có dropdown Chương trình `core/business`; Loại chỉ xuất hiện và bắt buộc với `core`, `business` lưu Loại rỗng; bỏ mọi ô nhập mã nghiệp vụ trên web và tự sinh mã ở server/DB với UNIQUE + test; cập nhật docs/types/UI                                                                                                                                                                                                   | ☑          |
| P7-T12 | Thời khóa biểu tuần/tháng       | Card Buổi học ở lịch admin mặc định là thời khóa biểu tuần, có lùi/tiến và mốc hôm nay; chuyển được giữa Tối giản/Tuần/Tháng, giữ mutation hủy/xóa đúng quyền, responsive và có unit/component test; lint/typecheck/unit/build xanh                                                                                                                                                                                             | ☑          |

---

## Phase 8 — Chốt đặc tả assessment engine

**Gate:** quyết định EX-01…EX-20, schema, RLS và impact map đồng bộ trước khi thêm schema mới.

| ID    | Task                | Definition of Done                                            | Trạng thái |
| ----- | ------------------- | ------------------------------------------------------------- | ---------- |
| P8-T1 | Đồng bộ quyết định  | Thêm EX-01…EX-20 vào docs/WORKLOG; không code                 | ☑          |
| P8-T2 | Schema design final | ERD + enum + table + FK + state machine được review           | ☑          |
| P8-T3 | RLS matrix final    | Ma trận 3 role + giáo viên phụ trách + answer key             | ☑          |
| P8-T4 | Migration inventory | Count thật bảng/bucket cũ; backup; báo cáo không có data thật | ☑          |
| P8-T5 | Source impact map   | Liệt kê route/component/query/RPC/test cũ cần thay            | ☑          |

---

## Phase 9 — Question Bank & Builder

**Gate:** giáo viên dựng, version, chia sẻ, preview và import được bộ có đủ 11 dạng câu; answer key fail-closed.

| ID     | Task                       | Definition of Done                                           | Trạng thái |
| ------ | -------------------------- | ------------------------------------------------------------ | ---------- |
| P9-T1  | Migration question core    | questions, versions, options, answer_keys, tags, collections | ☑          |
| P9-T2  | Migration sharing/review   | shares + global review + RLS                                 | ☑          |
| P9-T3  | Migration set core         | sets, versions, sections, items + immutable rule             | ☑          |
| P9-T4  | Storage question-media     | Bucket private + policy/path/upload validation               | ☑          |
| P9-T5  | Domain schemas             | Zod schema 11 question type                                  | ☑          |
| P9-T6  | Question Bank list         | Search/filter/pagination/scope                               | ☑          |
| P9-T7  | Question CRUD              | Create/edit/version/archive/clone                            | ☑          |
| P9-T8  | Sharing flow               | Share teacher + submit/approve/reject global                 | ☑          |
| P9-T9  | Builder shell              | Section/item reorder + score summary                         | ☑          |
| P9-T10 | Editor objective types     | Q1–Q7                                                        | ☑          |
| P9-T11 | Editor passage/audio types | Q8–Q10 + media                                               | ☑          |
| P9-T12 | Editor essay               | Q11 + rubric                                                 | ☑          |
| P9-T13 | Preview/render registry    | Cùng renderer với student                                    | ☑          |
| P9-T14 | Excel template/import      | Dry-run + error report + transaction                         | ☑          |
| P9-T15 | Tests gate                 | pgTAP/RLS/unit/component xanh                                | ☑          |

---

## Phase 10 — Module Bài tập mới

**Gate:** teacher giao đúng lớp; student autosave/resume/submit; auto + manual grade và release đúng rule.

| ID      | Task                         | Definition of Done                                | Trạng thái |
| ------- | ---------------------------- | ------------------------------------------------- | ---------- |
| P10-T1  | Migration exercise           | deliveries, attempts, answers, enum/index         | ☑          |
| P10-T2  | Exercise RPC/RLS             | publish/start/save/submit/grade/release           | ☑          |
| P10-T3  | Teacher sidebar/routes       | Module riêng, không quản lý chính trong class tab | ☑          |
| P10-T4  | Set list/create              | Bộ bài tập                                        | ☑          |
| P10-T5  | Assign to managed classes    | Multi-class creates separate deliveries           | ☑          |
| P10-T6  | Teacher delivery list/detail | KPI/filter/progress                               | ☑          |
| P10-T7  | Student exercise list        | 5 tab + dashboard counts                          | ☑          |
| P10-T8  | Student attempt renderer     | 11 type + autosave                                | ☑          |
| P10-T9  | Submit/multiple attempts     | limit + grading method + late                     | ☑          |
| P10-T10 | Teacher grading              | theo student/theo question/rubric                 | ☑          |
| P10-T11 | Result/answer release        | đúng mode, notification dedupe                    | ☑          |
| P10-T12 | Progress/report update       | view/dashboard/export dùng schema mới             | ☑          |
| P10-T13 | Tests gate                   | E2E exercise + RLS + scoring pass                 | ☑          |

---

## Phase 11 — Module Kiểm tra/Thi mới

**Gate:** same-day window, timer DB, autosave/finalizer, clipboard/IME, chấm/khóa/công bố và IDOR đều pass.

| ID      | Task                           | Definition of Done                                | Trạng thái |
| ------- | ------------------------------ | ------------------------------------------------- | ---------- |
| P11-T1  | Migration exam                 | deliveries, attempts, answers, integrity, regrade | ☑          |
| P11-T2  | Same-day time rules            | Trigger/domain test Asia/Ho_Chi_Minh              | ☑          |
| P11-T3  | Exam RPC/RLS                   | start/save/submit/finalize/grade/publish          | ☑          |
| P11-T4  | Teacher sidebar/routes         | Module riêng                                      | ☑          |
| P11-T5  | Exam set workflow              | Fixed order, no shuffle/random/access code        | ☑          |
| P11-T6  | Schedule exam                  | Window same day + duration + validation           | ☑          |
| P11-T7  | Student exam list/waiting room | Eligibility + audio check                         | ☑          |
| P11-T8  | Student exam attempt UI        | Timer/autosave/warnings                           | ☑          |
| P11-T9  | Clipboard protection           | Copy/cut/paste/drop block, IME safe               | ☑          |
| P11-T10 | Integrity events               | Log allowlist, no automatic accusation            | ☑          |
| P11-T11 | Auto-submit/finalizer          | Browser close vẫn finalize                        | ☑          |
| P11-T12 | Grading/lock/publish           | 0–100 + classification                            | ☑          |
| P11-T13 | Regrade                        | audit before/after                                | ☑          |
| P11-T14 | Monitor/analytics/export       | Scope lớp giáo viên phụ trách                     | ☑          |
| P11-T15 | Tests gate                     | E2E exam/time/clipboard/IDOR pass                 | ☑          |

---

## Phase 12 — Cutover & cleanup module cũ

**Gate:** app không còn query/schema/source cũ; sáu bảng và bucket cũ chỉ bị xóa sau backup/smoke.

| ID     | Task                           | Definition of Done                   | Trạng thái |
| ------ | ------------------------------ | ------------------------------------ | ---------- |
| P12-T1 | Verify new app no old query    | grep + runtime smoke                 | ☑          |
| P12-T2 | Drop old RPC/policies/views    | Migration forward-only               | ☑          |
| P12-T3 | Drop old tables                | 6 bảng cũ removed                    | ☑          |
| P12-T4 | Cleanup old buckets            | Object count 0, delete policy/bucket | ☑          |
| P12-T5 | Remove old source/routes/tests | Không còn UI luồng cũ                | ☑          |
| P12-T6 | Regenerate types/docs          | build/typecheck xanh                 | ☑          |

---

## Phase 13 — QA, rehearsal & production

**Gate:** có số kiểm thử thật, rehearsal additive → app → cleanup, production smoke và monitoring.

| ID     | Task                   | Definition of Done                                 | Trạng thái |
| ------ | ---------------------- | -------------------------------------------------- | ---------- |
| P13-T1 | Full pgTAP matrix      | Mọi bảng/RPC/Storage mới                           | ☐          |
| P13-T2 | Full Playwright 3 role | Exercise + exam + negative                         | ☐          |
| P13-T3 | A11y/mobile/IME        | 44px, keyboard, Chinese input real devices         | ◐          |
| P13-T4 | Performance test       | Có số thật, không đoán                             | ◐          |
| P13-T5 | Security review        | Answer key/XSS/IDOR/rate limit/import              | ☐          |
| P13-T6 | Staging rehearsal      | Migration A → app → cleanup                        | ☐          |
| P13-T7 | Production deploy      | DB additive trước app, smoke, cleanup sau sign-off | ☐          |
| P13-T8 | Post-deploy monitoring | Error/query/storage/job/notification               | ☐          |

> `PERF-M20-001` (2026-07-20): production và local đều dùng ES256; thay các lần `getUser()` trên critical path bằng helper `getClaims()` fail-closed, vẫn query role/`is_active` từ `profiles`, giữ RLS và giữ `getUser()` cho thao tác Auth nhạy cảm. Có unit test token lỗi/claims sai/tài khoản khóa/role giả và middleware không gọi `getUser()`.
>
> `BUG-M11-M12-005/006/007/008` (2026-07-20): đã sửa luồng persist MP3 khi tạo/chỉnh sửa câu hỏi, direct upload bản ghi Nói, RLS nhận audio đề đúng lượt/kết quả, và đồng bộ audio đề + bản ghi Nói ở màn giáo viên chấm/kết quả học viên cho cả Bài tập/Thi; `P13-T3` giữ `◐` cho tới khi smoke file/micro thật sau redeploy trên trình duyệt/thiết bị.
>
> `UX-M11-M12-005` (2026-07-20): nút bắt đầu Bài tập/Thi hiện spinner + nhãn đang mở và tự khóa trong lúc Server Action tạo attempt/redirect; có component test chống tái phát cho cả hai luồng.

---

## Phase 14 — Cổng lớp học & ôn tập học viên

**Gate:** học viên xem lớp hiện tại ở một nơi duy nhất; Super Admin quản trị flashcard theo khóa/buổi; học viên học flashcard và làm lại câu máy chấm từng sai mà không đọc được answer key ngoài RPC; RLS/Storage/IDOR, animation bàn phím/mobile và migration cloud đều được kiểm chứng.

| ID      | Task                                           | Definition of Done                                                                                                                                                                                                                                                                                                                                                                                     | Trạng thái |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| P14-T1  | Chốt đặc tả & impact map                       | Docs 01–04 có business rule, schema/RLS/Storage, workflow + failure path, kiến trúc; chốt rõ loại câu được ôn, vòng đời mastery, cấu trúc trang/mặt flashcard và source impact                                                                                                                                                                                                                         | ☑          |
| P14-T2  | Học viên — Lớp của tôi                         | `/student/class` gộp lịch/tài liệu/chuyên cần và bổ sung tổng quan, bài tập, kiểm tra, tiến độ ở chế độ chỉ đọc; `/student/schedule` redirect tương thích; không lộ roster; typecheck + component/server test xanh                                                                                                                                                                                     | ☑          |
| P14-T3  | Migration Flashcard                            | Deck theo course; section theo số buổi; page mở đầu/thẻ từ vựng có thứ tự, 2 ảnh + audio; bucket private, RLS fail-closed, constraint/index/idempotency + pgTAP; dry-run → push cloud → remote up-to-date                                                                                                                                                                                              | ☑          |
| P14-T4  | Super Admin — Flashcard CRUD                   | Chọn khóa/buổi, tạo/sắp xếp/archive trang; signed direct upload 2 ảnh + audio; server xác minh path/MIME/size và ghi audit; responsive + validation/test                                                                                                                                                                                                                                               | ☑          |
| P14-T5  | Học viên — Flashcard                           | Chỉ thấy deck khóa đang học; trang mở đầu + bookmark buổi không dùng dropdown; lật trang phải↔trái và lật mặt dưới↔trên độc lập; audio, phím/touch, focus/ARIA, reduced-motion + test                                                                                                                                                                                                                  | ☑          |
| P14-T6  | Migration Ôn câu sai                           | Snapshot sai từ exercise/exam đã nộp, chỉ dạng `manual_required = false`; bảng tiến độ theo student + question version; RPC lấy câu đến hạn và chấm lại atomic, đúng thì rời danh sách; RLS/answer-key fail-closed + pgTAP; áp cloud                                                                                                                                                                   | ☑          |
| P14-T7  | Học viên — Ôn câu sai                          | Tab thứ hai của `/student/review`; renderer objective dùng chung, submit/loading/error rõ ràng, lưu lịch sử; đúng rời hàng đợi, sai lên lịch lại; empty state + component/server test                                                                                                                                                                                                                  | ☑          |
| P14-T8  | Quality gate & docs                            | Generate types; cập nhật nav/docs/QA/WORKLOG; lint + typecheck + Vitest + pgTAP + build xanh; smoke 3 role/IDOR/signed URL ở local, ghi rõ phần production còn chờ redeploy                                                                                                                                                                                                                            | ☑          |
| P14-T9  | Hiệu chỉnh chuyển động Flashcard               | Chuyển trang là cú lật toàn bộ flashcard quanh tâm theo phải→trái/trái→phải, không phải hiệu ứng trang sách; click lật mặt dưới↔trên độc lập, giữ mặt riêng theo từng trang; reduced-motion + component test xanh                                                                                                                                                                                      | ☑          |
| P14-T10 | Rút gọn form trang & trải nghiệm đọc Flashcard | Form theo loại trang: trang mở đầu chỉ 2 ảnh, trang từ vựng chỉ từ/cụm từ + audio + 2 ảnh, bỏ ô mô tả ảnh (server sinh alt); reader bỏ overlay nhãn/từ trên thẻ, desktop hiện trọn ảnh còn mobile giữ nguyên, rời trang là reset trang đó về mặt trước, audio thành một nút mang tiêu đề trang; migration `audio_path` nullable + check theo `kind`; lint/typecheck/test/build + pgTAP flashcards xanh | ☑          |
| P14-T11 | Xóa được trang mở đầu Flashcard                | Trang mở đầu có nút lưu trữ như trang từ vựng; bỏ cover không dồn `order_index` của trang từ vựng; reorder vẫn chạy khi buổi tạm thiếu cover; publish vẫn bị chặn tới khi thêm lại cover; pgTAP + unit test + lint/typecheck/test/build xanh                                                                                                                                                           | ☑          |
| P14-T12 | Tốc độ audio cho học viên                      | Tạo player học viên dùng chung cho mọi audio do giáo viên/Super Admin upload trong Bài tập, Kiểm tra/Thi và Ôn tập (Flashcard + câu sai), gồm lượt làm và kết quả; mặc định `1×`, chỉ có `0.5× · 0.75× · 1×`, giữ cao độ nếu browser hỗ trợ, không xử lý lại file/server và không áp dụng cho bản ghi Nói của học viên; keyboard/touch/ARIA + component test, lint/typecheck/test/build xanh           | ☑          |

---

## Phase 15 — Student Experience Redesign

> **Phạm vi đã chốt:** chỉ thiết kế lại khu vực Học viên theo `uiux-redesign` M20→M27. Đây là ID audit UI/UX, không phải M20 Security trong bảng QA kỹ thuật. Phong cách `Learning Journey Bento`: hiện đại, tạo động lực, mobile-first, không trẻ con; xanh `#1A5FA8` và cam/đỏ thương hiệu vẫn chủ đạo, được bổ sung họ sky/cyan và amber/coral gần màu gốc qua semantic token đạt WCAG. Giữ Be Vietnam Pro; gamification nhẹ chỉ dùng dữ liệu thật, không tự sinh streak/huy hiệu/tính năng mới.

| ID     | Task                                             | Definition of Done                                                                                                                                                                                                                                            | Trạng thái |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P15-T1 | Nền tảng giao diện học viên + UIUX-M20 Tổng quan | Audit/proposal theo governance; chốt semantic token hỗ trợ gần màu thương hiệu; thiết kế lại `/student` theo Learning Journey Bento với ưu tiên học tiếp, lịch gần nhất và tiến độ thật; không đổi query/nghiệp vụ/phân quyền; responsive/a11y/test/gate xanh | ☑          |
| P15-T2 | UIUX-M21 Lớp của tôi                             | Thiết kế lại 7 tab của `/student/class` để dễ định hướng và khuyến khích học tiếp; giữ read-only, route tương thích, dữ liệu và phân quyền; responsive/a11y/test/gate xanh                                                                                    | ☑          |
| P15-T3 | UIUX-M22 Bài tập                                 | Thiết kế lại danh sách, lượt làm và kết quả Bài tập; tích hợp player P14-T12 nhất quán; giữ scoring/submission/anti-leak; responsive/a11y/test/gate xanh                                                                                                      | ☑          |
| P15-T4 | UIUX-M23 Kiểm tra / Thi                          | Thiết kế lại danh sách, phòng chờ/lượt thi và kết quả; giữ chế độ tập trung, timer, fullscreen, chống lộ đáp án và player P14-T12; responsive/a11y/test/gate xanh                                                                                             | ☑          |
| P15-T5a | UIUX-M24 Ôn tập — nửa Ôn câu sai                | Thiết kế lại tab Ôn câu sai của `/student/review` thành hành trình ôn tập rõ ràng; giữ mastery/RPC/renderer và player P14-T12; responsive/a11y/test/gate xanh                                                                                                 | ☑          |
| P15-T5b | UIUX-M24 Ôn tập — nửa Flashcard                 | ⏸ **VẪN HOÃN (`DS-028` + `DS-029`).** `Q1`–`Q6` đã có trả lời nhưng lý do hoãn không mất: Phase 16 sẽ viết lại chính `student-flashcard-reader.tsx` theo mô hình dữ liệu mới, redesign bây giờ vẫn phải làm lại lần hai cả UI, test lẫn E2E. **Nay đã có chỗ đóng cụ thể: `P16-T8`** (chia task 2026-07-23 đợt 10)                                        | ⏸ → `P16-T8` |
| P15-T6 | UIUX-M25 Kết quả                                 | Thiết kế lại tổng hợp điểm/tiến độ để dễ hiểu, tích cực nhưng trung thực với dữ liệu; không đổi công thức hay quyền xem; responsive/a11y/test/gate xanh                                                                                                       | ☑          |
| P15-T7 | UIUX-M26 Học phí                                 | Thiết kế lại hóa đơn cá nhân rõ số tiền, hạn và trạng thái; giữ dữ liệu tài chính/RLS, không biến thành module công nợ; responsive/a11y/test/gate xanh                                                                                                        | ☑          |
| P15-T8 | UIUX-M27 Hồ sơ                                   | Thiết kế lại hồ sơ cá nhân dễ đọc/sửa; giữ validation, mutation và phân quyền; responsive/a11y/test/gate xanh                                                                                                                                                 | ☑          |
| P15-T9 | Quality gate liên module học viên                | Soát nhất quán M20–M27, responsive 360/390/430/768/1024/1280+, keyboard/focus/reduced-motion/contrast; cập nhật report/board/changelog/QA; lint/typecheck/test/build xanh                                                                                     | ☑          |

---

## Phase 17 — Teacher Workspace Redesign (M16 → M19)

> **Phạm vi mở lại theo `DS-031`** (user chốt 2026-07-22 đợt 3, đảo phần "tạm dừng M16–M19" của `D-27`/`DS-026`). Bốn module giáo viên còn lại, đúng thứ tự board: M16 → M17 → M18 → M19.
>
> ⚠️ **`D-28`/`DS-027` KHÔNG áp cho phase này.** Learning Journey Bento và palette `student-sky/cyan/amber/coral` là **student-only**. Màn giáo viên là công cụ làm việc dùng hằng ngày: giữ token dùng chung hiện có, ưu tiên mật độ thông tin, quét nhanh và thao tác bàn phím — không "tạo động lực", không hero trang trí.
>
> Ràng buộc chung như Phase 15: **không đổi** query · server action · RPC · RLS · Storage · route · phân quyền · validation · công thức · nhãn nghiệp vụ. Phát hiện lỗi nghiệp vụ thì ghi vào `07_UIUX_ISSUES_LOG.md` và hỏi user, không tự sửa (`DS-003`).

| ID     | Task                                | Definition of Done                                                                                                                                                                                                                                             | Trạng thái |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P17-T1 | UIUX-M16 Bài tập (Teacher)          | Audit + thiết kế lại `/teacher/exercises` (giao cho lớp), `/teacher/exercises/sets`, `/teacher/exercises/question-bank` và màn chấm; giữ scoring/publish/anti-leak và `AssessmentTabs` dùng chung; responsive 360/390/430/768/1024/1280 + a11y/test/gate xanh | ☑          |
| P17-T2 | UIUX-M17 Kiểm tra / Thi (Teacher)   | Thiết kế lại `/teacher/exams` + `sets` + `question-bank` + màn chấm thi; giữ khung mở/đóng nhiều ngày (`EX-12`), deadline `EX-13`, integrity và chống lộ đáp án; responsive/a11y/test/gate xanh. **Bắt buộc:** sửa `exam-dashboard.tsx:245` — chỗ múi giờ `D-12` **cuối cùng** còn lại trong `src/`; và chạy lại `teacher-exercises-responsive.spec.ts` vì `question-bank-page.tsx` dùng chung với M16                                                               | ☑          |
| P17-T3 | UIUX-M18 Đánh giá & Ghi chú         | Thiết kế lại màn đánh giá học viên và ghi chú; giữ `grading_scale_rules`, `learning_evaluations`, `student_notes` và quyền xem của học viên; responsive/a11y/test/gate xanh                                                                                   | ☑ DONE — chờ xác minh độc lập (2026-07-22 đợt 6, Claude). 7 lỗi có bằng chứng; E2E mới **16/16**, `evaluation.smoke` **2/2** (trước đó hỏng sẵn), Vitest **220/220**, lint/typecheck/build xanh. Báo cáo: `uiux-redesign/module-reports/M18_teacher-evaluations.md` |
| P17-T4 | UIUX-M19 Báo cáo lớp                | Thiết kế lại báo cáo/tiến độ lớp cho giáo viên; giữ công thức, filter và export đúng date range đang chọn (bài học `BUG_M16_01`); responsive/a11y/test/gate xanh                                                                                              | ☑ DONE — chờ xác minh độc lập (2026-07-22 đợt 6, Claude). ⚠️ Vế **export + date range là N/A có bằng chứng**: màn này chưa từng có export lẫn bộ lọc thời gian (`reports/export.ts` chỉ phục vụ học phí Admin); user chốt không thêm (`DS-037`). Thêm 1 biểu đồ từ dữ liệu đã truy vấn sẵn. E2E **16/16** (32/32 với `--repeat-each=2`), lint/typecheck/build xanh; Vitest **218–220/220** flaky do timeout ở file không liên quan (`UX-UIUX-M19-008`). Báo cáo: `uiux-redesign/module-reports/M19_teacher-progress.md` |
| P17-T5 | Quality gate liên module giáo viên  | Soát nhất quán M13–M19, responsive đủ bậc thang, keyboard/focus/contrast; cập nhật report/board/changelog/QA; lint/typecheck/test/build xanh. **Đã đo cả M14** (đóng nợ `IMPLEMENTED — chờ đo`) theo quyết định user 2026-07-23. Tìm 5 lỗi thật, xem `uiux-redesign/module-reports/P17-T5_teacher-quality-gate.md` | ☑          |

---

## Phase 18 — Auth & Admin Redesign (M28 → M01…M12)

> **Phạm vi mở theo `DS-043`** (user chốt 2026-07-23, đảo nốt phần "tạm dừng Auth và Admin" của `D-27`/`DS-026`). Yêu cầu nguyên văn: làm M28 trước, xong thì **chạy tiếp Admin không dừng hỏi giữa chừng**.
>
> ⚠️ **`D-28`/`DS-027` KHÔNG áp cho phase này.** Learning Journey Bento và palette `student-*` là **student-only**. Màn quản trị là công cụ vận hành hằng ngày: ưu tiên mật độ thông tin, quét nhanh, thao tác bàn phím — không hero trang trí.
>
> Ràng buộc chung như Phase 15/17: **không đổi** query · server action · RPC · RLS · Storage · route · phân quyền · validation · công thức · nhãn nghiệp vụ. Phát hiện lỗi nghiệp vụ thì ghi `07_UIUX_ISSUES_LOG.md` và hỏi user (`DS-003`).

| ID | Task | Definition of Done | Trạng thái |
| --- | --- | --- | --- |
| P18-T1 | UIUX-M28 Xác thực & trang gốc | Audit + thiết kế lại `/login`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/`; giữ nguyên `GENERIC_LOGIN_ERROR` và luồng không lộ tài khoản; responsive 6 bề rộng + a11y/test/gate xanh | ☑ DONE — chờ xác minh độc lập (2026-07-23 đợt 8, Claude). 7 lỗi có bằng chứng; E2E **32/32**; `/` là **N/A có bằng chứng** (chỉ `redirect`, 11 dòng). Báo cáo: `uiux-redesign/module-reports/M28_auth.md` |
| P18-T2 | UIUX-M01 Tổng quan (Admin) | Thiết kế lại `/admin` (KPI + cảnh báo); giữ công thức và quyền xem; responsive/a11y/test/gate xanh | ☑ |
| P18-T3 | UIUX-M02 Học viên | `/admin/students` — danh sách + form/dialog; giữ validation và mã tự sinh (`D-23`); responsive/a11y/test/gate xanh | ☑ |
| P18-T4 | UIUX-M03 Giáo viên | `/admin/teachers`; giữ `D-22` (một giáo viên chính mỗi lớp, không trợ giảng) | ☑ |
| P18-T5 | UIUX-M04 Khóa học | `/admin/courses`; giữ `D-8`/`D-23` (hai dòng chương trình, mã tự sinh) | ☑ |
| P18-T6 | UIUX-M05 Lớp học | `/admin/classes`; giữ `D-9` (Course ≠ Class ≠ Session), `D-11`, `D-18`/`D-19` | ☑ |
| P18-T7 | UIUX-M06 Flashcard (Admin) | ⏸ **HOÃN tới sau Phase 16** — Phase 16 sẽ viết lại mô hình dữ liệu flashcard, redesign bây giờ là làm hai lần (cùng lý do `DS-028` hoãn `P15-T5b`). **Nay đã có chỗ đóng cụ thể: `P16-T8`** (chia task 2026-07-23 đợt 10) | ⏸ → `P16-T8` |
| P18-T8 | UIUX-M07 Lịch học | `/admin/schedule`; giữ `D-24` (thời khóa biểu tuần mặc định) và `D-12` (múi giờ) | ☑ |
| P18-T9 | UIUX-M08 Học phí (Admin) | `/admin/tuition`; giữ `D-6` (không phải module công nợ) và `DS-030` | ☑ |
| P18-T10 | UIUX-M09 Báo cáo | `/admin/reports`; **giữ export đúng filter/date range đang chọn** (bài học `BUG_M16_01`) — khác M19, màn này export THẬT (`reports/export.ts`) | ☑ |
| P18-T11 | UIUX-M10 Duyệt câu hỏi | `/admin/question-bank-review`; giữ `EX-04`/`EX-05` | ☑ |
| P18-T12 | UIUX-M11 Thông báo | `/admin/notifications`; giữ `D-5` (một chiều, không chat) | ☑ |
| P18-T13 | UIUX-M12 Quản trị & Audit | `/admin/system`; giữ `D-21` (admin cấp tài khoản trực tiếp) và không đụng audit log | ☑ |
| P18-T14 | Quality gate liên module Admin | Soát nhất quán M01–M12 + M28, responsive đủ bậc thang, keyboard/focus/contrast; cập nhật report/board/changelog/QA; lint/typecheck/test/build xanh | ☑ |

---

## Phase 16 — Flashcard dạng văn bản có cấu trúc (✅ YÊU CẦU ĐÃ RÕ, ✅ ĐÃ CHIA TASK 2026-07-23 đợt 10)

> **`Q1`–`Q6` đã có câu trả lời của user (2026-07-22 đợt 2) → hết chặn.** Toàn văn câu trả lời + đặc tả thẻ mẫu tại [`docs/10-yeu-cau-flashcard-quizlet.md`](10-yeu-cau-flashcard-quizlet.md) §7bis và §7ter; quyết định `DS-029`.
>
> Đây là **phần duy nhất còn lại của `uiux-redesign`**: nó gom cả `P15-T5b` (M24 nửa Flashcard) và `P18-T7` (M06 Flashcard Admin) — hai task ⏸ duy nhất trên board.
>
> **Xác minh độc lập Codex 2026-07-24:** catalog/RLS/RPC, media IDOR, ★, import, wrapping/shuffle và spec hai project đều khớp; nhưng phát hiện `BUG-P16-001` ở `T9` (seed/E2E ghim UUID Course sinh động). Codex đã sửa nên **không tự ghi Verified**; Phase 16 chờ agent khác xác minh bản sửa. Cloud dry-run còn bị 403/thiếu `SUPABASE_DB_PASSWORD`.

**Phạm vi đã chốt:**

| Hạng mục | Chốt |
| --- | --- |
| Quyền tạo | **Chỉ Super Admin** — giữ nguyên. ⛔ Không đổi RLS, không mở nav cho giáo viên |
| Trang `session_cover` | **Giữ nguyên 2 file ảnh**, không nhập chữ, không mp3 |
| Trang `vocabulary` | Chuyển sang **bản ghi có cấu trúc**: Hán tự · Pinyin (trường riêng, dạng tách âm tiết) · Nghĩa tiếng Việt · Ảnh (tuỳ chọn) · Audio người thật, **cộng 3 danh sách con**: Tách nghĩa · Câu ví dụ · Cụm từ thường dùng |
| Dữ liệu cũ | Xoá làm lại — **bắt buộc đếm dữ liệu thật trước**; có bộ thẻ người soạn thì **dừng và báo** |
| Tính năng mới | ★ đánh dấu thẻ khó · nhập hàng loạt · xáo trộn (chỉ buổi đang chọn, **không bền qua đăng xuất**) · phát tự động |
| **Không** làm | Theo dõi tiến độ biết/chưa biết · đảo mặt trước-sau · TTS · gợi ý tự động · sơ đồ · AI |

**Ràng buộc kỹ thuật rút ra, phải tôn trọng khi chia task:**

- Hai loại trang có **hai mô hình dữ liệu khác nhau** → `NOT NULL` của `front_image_path`/`back_image_path` phải thành **CHECK theo `kind`**, tuyệt đối không drop vô điều kiện.
- Pinyin lưu **dạng tách âm tiết** (`"hú luó bo"`); mặt sau bỏ dấu cách để ra `húluóbo`. Chiều ngược lại không tự động hoá được.
- Ba danh sách con: ✅ **user chốt 3 cột `jsonb` + Zod** (2026-07-23, `DS-050`). Kèm theo đó là một trách nhiệm: `jsonb` **không có FK và không có CHECK ở tầng DB**, nên **Zod là chỗ DUY NHẤT** cưỡng chế hình dạng — mọi đường ghi phải đi qua nó (`BUG_M10_01`: một hành động, một đường ghi).
- Giữ nguyên: audio người thật (`DS-019`), cấp "buổi", luồng `draft→published→archived`, RLS + signed URL.
- ✅ **Dấu thanh ở ảnh mẫu — user chốt KHÔNG xét (2026-07-23, `DS-050`):** hai ảnh `胡萝卜` chỉ là **mẫu bố cục**, dùng thật sẽ thay ảnh khác, nên không xử lý chuyện `bǔ` vs `bo`. ⛔ Hệ quả: ảnh mẫu là chuẩn cho **cách dựng thẻ**, **không** phải chuẩn cho **nội dung thẻ** — không được nhân bản nội dung của nó vào `seed.dev.sql` ở `P16-T9`.

### Ba ràng buộc MỚI, đọc từ source ngày 2026-07-23 — chưa từng ghi ở đâu

Ba thứ dưới đây là **chặn cứng ở tầng dữ liệu/bảo mật**, không phải chi tiết UI. Nếu chia task mà bỏ qua thì đến lúc code sẽ vỡ giữa chừng.

1. 🔴 **Ảnh nằm trong danh sách con sẽ bị RLS chặn — chính sách hiện tại không thấy chúng.**
   `app.can_student_read_flashcard_media()` cho phép đọc bằng một phép so sánh **liệt kê cứng đúng 3 cột**:

   ```sql
   and p_object_path in (p.front_image_path, p.back_image_path, p.audio_path)
   ```

   §7ter khối 4 (Câu ví dụ) có **ảnh kèm mỗi câu**. Ảnh đó nằm trong `jsonb` → **không** khớp bất kỳ cột nào ở trên → học viên tải ảnh sẽ nhận **403**, trong khi admin xem vẫn thấy bình thường (policy admin đi nhánh khác). Đây đúng dạng lỗi "mỗi bên đều đúng theo tiêu chí của chính nó" nên **không spec nào báo đỏ**.
   → **Đề xuất chốt ở `P16-T0`:** thêm cột `media_paths text[]` trên `flashcard_pages`, do **trigger** tổng hợp từ *mọi* nguồn (front/back/illustration/audio + mọi ảnh trong 3 `jsonb`), có index GIN, và policy dùng `p.media_paths @> array[p_object_path]`. Phép này cùng nghĩa với `p_object_path = any(p.media_paths)` cho một path nhưng dùng được GIN. Một cơ chế duy nhất, một đường ghi duy nhất — đúng luật `BUG_M10_01` trong `CLAUDE.md`, và thêm ảnh mới về sau không phải sửa lại policy lần nữa.

2. 🔴 **Quy ước đường dẫn file chỉ chấp nhận đúng 3 khe.**
   `isOwnedFlashcardMediaPath()` khoá cứng bằng regex `^(front|back|audio)-<uuid>\.(jpg|png|webp|mp3|m4a)$`, và `FLASHCARD_MEDIA_SLOTS = ["front","back","audio"]`. Ảnh minh hoạ của thẻ từ vựng + ảnh của từng câu ví dụ là **khe mới** → phải mở rộng cả hằng số, regex, `flashcardUploadRequestSchema` (đang `.max(3)` file/lượt) và policy Storage. Ảnh câu ví dụ còn cần **chỉ số** trong tên (`example-<n>-<uuid>`) vì một trang có nhiều câu.

3. ✅ **ĐÃ CHỐT 2026-07-23 (đợt 11, `DS-050`): GIỮ 2 cột `front_image_path`/`back_image_path`.**
   Đề xuất ban đầu là `illustration_path` (1 ảnh, tuỳ chọn) cho `vocabulary`; **user chọn giữ 2 cột**, đã biết đánh đổi. Hệ quả phải xử lý ở `P16-T1`, **không được lặng lẽ bỏ qua**: CHECK `flashcard_pages_distinct_media_check` ép hai mặt **phải khác file nhau**, trong khi §7ter của [`docs/10-yeu-cau-flashcard-quizlet.md`](10-yeu-cau-flashcard-quizlet.md) mô tả mặt sau **dùng lại chính ảnh mặt trước**. Hai điều này **không thể cùng đúng**. → `P16-T1` phải hỏi user chọn một trong hai: (a) mặt sau dùng **ảnh khác** và sửa §7ter cho khớp, hay (b) **nới CHECK** cho `vocabulary` để hai mặt được trỏ cùng một file. Trước khi có câu trả lời thì **chưa dựng được template `P16-T5`**.

**Bảng task**

> ⚠️ `P16-T0` là **cổng chặn**: không viết một dòng migration nào trước khi nó xong. Lý do là điều kiện chính user đã chấp nhận khi chốt `Q2` ("xoá làm lại") — phải **đếm dữ liệu thật trước**, và **đếm ở CLOUD**, vì local bị `db reset` liên tục nên số 0 ở local **không chứng minh được gì** (đã đếm local 2026-07-23: `decks=0 · sections=0 · pages=0`).

| ID | Task | Definition of Done | Trạng thái |
| --- | --- | --- | --- |
| P16-T0 | **Cổng chặn — đếm dữ liệu thật + chốt 4 điểm mô hình** | Đếm `flashcard_decks/_sections/_pages` **trên cloud** (local đã đếm = 0, chưa đủ kết luận); có bộ thẻ do người thật soạn → **dừng và báo user**, không tự xoá. Chốt bằng văn bản: (1) 3 danh sách con lưu `jsonb` hay bảng con; (2) cơ chế cho học viên đọc ảnh trong danh sách con (đề xuất `media_paths text[]` + trigger + GIN); (3) `vocabulary` dùng `illustration_path` 1 ảnh hay giữ 2 cột; (4) user xác nhận lỗi dấu thanh `bǔ`→`bo` ở ảnh mẫu. **Không sửa code, không viết migration.** | 🟡 **4/5 XONG** — user chốt 2026-07-23 (đợt 11, `DS-050`): (1) **3 cột `jsonb` + Zod**; (2) **`media_paths text[]` + trigger + GIN**, policy thực thi bằng `@>` tương đương `= any(...)` nhưng ăn GIN; (3) **GIỮ 2 cột `front_image_path`/`back_image_path`** (không dùng `illustration_path`) → `flashcard_pages_distinct_media_check` **giữ nguyên**, tức mỗi thẻ từ vựng vẫn cần **2 file ảnh KHÁC NHAU`**; (4) ảnh thẻ mẫu **chỉ là mẫu** — không xét đúng/sai nội dung, dùng thật sẽ thay ảnh khác, nên **không có việc sửa `bǔ`→`bo`**. ✅ **CỔNG ĐÃ MỞ 2026-07-23 (đợt 12): user chạy 2 câu SQL trên CLOUD, kết quả `decks/sections/pages = 0` ở mọi cột, câu liệt kê không ra dòng nào** → không có bộ thẻ do người thật soạn, điều kiện "xoá làm lại" của `Q2` được thoả. Đồng thời user chốt vế `P16-T1`: **giữ nguyên `flashcard_pages_distinct_media_check`, sửa §7ter** — thẻ từ vựng có ảnh thì hai mặt là hai file KHÁC nhau. ☑ **DONE** |
| P16-T1 | Migration mô hình thẻ từ vựng | Cột mới cho `vocabulary`: `hanzi`, `pinyin_syllables` (dạng tách âm tiết), `meaning_vi` + 3 cột danh sách con theo chốt `P16-T0`; `term` được thay hoàn toàn bằng `hanzi`. **Giữ** `front_image_path`/`back_image_path`, ảnh vocabulary tuỳ chọn nhưng hai file phải khác nhau khi cùng có mặt; `session_cover` vẫn bắt buộc hai ảnh. `audio_path` được thiếu ở draft để import, nhưng publish gate bắt buộc. Cơ chế `media_paths` + trigger + GIN và policy Storage dùng `@>`; xoá dữ liệu cũ **chỉ khi `P16-T0` cho phép**. **pgTAP bắt buộc**, gồm bài kiểm ngược: học viên đọc được ảnh câu ví dụ, và **không** đọc được khi buổi chưa `published`. Không đổi RLS của deck/section (`Q1` — chỉ Super Admin) | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-23 (đợt 12). `20260723000070_flashcard_structured_vocabulary.sql`. pgTAP mới **28/28** + pgTAP cũ **33/33**. **Đã kiểm ngược:** khôi phục hàm cũ (liệt kê 3 cột) → đỏ đúng 2 bài (24, 26), hai bài chiều phủ định vẫn xanh |
| P16-T2 | Schema + action + query theo mô hình mới | `schema.ts` tách hai nhánh theo `kind` (`session_cover` giữ nguyên 2 ảnh/không chữ/không mp3 — `Q5`); Zod cho 3 danh sách con; mở rộng `FLASHCARD_MEDIA_SLOTS` + `isOwnedFlashcardMediaPath` + `flashcardUploadRequestSchema` (`.max(3)` không còn đủ); `flashcardAltText` sinh alt từ `hanzi`/`meaning_vi` thay vì `term`. Unit test cho **cắt pinyin tách → viết liền** (`"hú luó bo"` → `húluóbo`) và cho từng nhánh `kind`. `npm run gen:types` chạy lại | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-23 (đợt 12). Thêm `domain/pinyin.ts`, `domain/sublists.ts`; `media.ts` mở khe `example-<n>`; unit **21/21** ở 3 file |
| P16-T3 | Màn soạn thẻ (Admin) — nhập dạng bảng | Viết lại `flashcard-admin-manager.tsx` (919 dòng): form **theo `kind`**, nhiều thẻ trên một màn kiểu Quizlet, 3 trình soạn danh sách con thêm/xoá/sắp xếp được. Giữ `draft→published→archived`, giữ `reorder_flashcard_pages`, giữ quy tắc "buổi phải có trang mở đầu mới publish được" (`P14-T11`). Component test + E2E soạn một thẻ thật rồi **đọc DB** xác nhận | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 12). Component test xanh + E2E "soạn một thẻ thật đọc DB" xanh. 🔴 **E2E bắt được lỗi sản phẩm:** thẻ chữ thuần không sinh `pageId` → đã sửa |
| P16-T4 | Nhập hàng loạt ("+ Nhập") | Dán nhiều dòng → xem trước → tạo hàng loạt (`Q6`). Phải **idempotent ở tầng DB** (`BUG_M09_01`: unique index + `ON CONFLICT`, không chỉ chặn ở app). Báo lỗi theo **từng dòng**, không nuốt lỗi cả lô. Không nhập được ảnh/audio qua đường này — nêu rõ trên giao diện | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 12). `…072`: unique `(section_id, hanzi, pinyin_syllables)` + `ON CONFLICT DO NOTHING`; parser `bulk-import.ts` báo từng dòng; pgTAP **15/15** (gồm ghi thẳng bảng vẫn bị chặn) + parser unit **6/6** + E2E. **Chuyển luật audio hàng→công bố** vì đường này không nhập audio |
| P16-T5 | Template thẻ học viên — mặt trước + mặt sau 5 khối | Dựng thẻ **bằng chữ**, đúng §7ter: mặt trước (pinyin căn thẳng **trên từng chữ Hán**, Hán tự, nghĩa màu cam, ảnh tuỳ chọn); mặt sau 5 khối có màu viền. **Đây là chỗ sửa đúng lời than gốc của user**: chữ tự xuống dòng/tự co, **không** `object-cover` cắt mất nội dung. Đo thật ở 360/390/430/768/1024/1280 theo `DS-038`; giữ hoạt ảnh lật `P14-T9` + `prefers-reduced-motion`; giữ player `P14-T12` (`0.5×/0.75×/1×`) | ◐ **CODE XONG, chờ xác minh độc lập** — Claude 2026-07-23 (đợt 12). Thẻ dựng bằng CHỮ; chiều cao do khối sizer grid quyết định nên chữ tự xuống dòng, không `object-cover` cắt. ✅ **Nợ đo đã đóng qua `T8`**: `flashcard-responsive` đo **6 bề rộng × 2 project 16/16**, nay nằm trong full suite `314/314` xanh (đợt 13) |
| P16-T6 | Xáo trộn + phát tự động | Xáo trộn **chỉ buổi đang chọn**, **giữ trong bộ nhớ phiên**, đăng xuất → đăng nhập lại **trở về thứ tự gốc** (`Q6`); ⛔ không `localStorage`, không ghi DB. Phát tự động dừng được, tôn trọng `prefers-reduced-motion`. E2E **dựng lại đúng kịch bản đăng xuất/đăng nhập** để chứng minh thứ tự trở về gốc — không chỉ kiểm "có nút" | ◐ **CODE XONG, chờ xác minh độc lập** — Claude 2026-07-23 (đợt 12). Thứ tự xáo trộn giữ trong **state React**, cố ý KHÔNG dùng `sessionStorage` (nó sống qua đăng xuất/đăng nhập trong cùng tab → vi phạm đúng điều `Q6` đòi). Phát tự động luôn do người dùng bấm, luôn dừng được (WCAG 2.2.2). ✅ **Nợ E2E đã đóng qua `T8`**: kịch bản đăng xuất → đăng nhập lại bằng CONTEXT MỚI chứng minh thứ tự về gốc, nay trong full suite `314/314` xanh (đợt 13) |
| P16-T7 | ★ Đánh dấu thẻ khó | Bảng mới `(student_id, page_id)` + RLS: học viên chỉ đọc/ghi của chính mình, kiểm cả chiều **IDOR**. Unique index chống bấm hai lần (`BUG_M09_01`). ⛔ **Không** đụng mastery của Ôn câu sai (tránh hai nguồn sự thật); ⛔ **không** làm theo dõi biết/chưa biết (`Q4` hoãn). pgTAP + E2E | ◐ **CODE XONG, chờ xác minh độc lập** — Claude 2026-07-23 (đợt 12). `20260723000071_flashcard_starred_pages.sql`: khoá chính GHÉP `(student_id, page_id)` + `on conflict do nothing`, RPC `set_flashcard_star(page_id, starred)` nhận trạng thái **mong muốn** chứ không phải toggle (toggle không idempotent). pgTAP **18/18** gồm IDOR **cả hai chiều**. ✅ **Nợ E2E đã đóng qua `T8`**: ★ ghi DB rồi đọc lại, nay trong full suite `314/314` xanh (đợt 13) |
| P16-T8 | **Đóng `P15-T5b` + `P18-T7`** — pass `uiux-redesign` | Chạy đúng governance `uiux-redesign`: **baseline đo bằng trình duyệt trước khi sửa** (13 màn không áp dụng — ở đây là `/student/review` tab Flashcard + `/admin/flashcards`), 6 bề rộng × 2 project, axe. Nửa học viên theo Learning Journey Bento + palette `student-*` (`D-28`); nửa Admin theo hướng **mật độ cao** như Phase 18, **không** Bento (`DS-044`). Ràng buộc `DS-003` áp lại từ task này: **không** đổi query/action/RPC/RLS/validation/nhãn — mọi thay đổi đó phải đã xong ở `P16-T1`…`T7`. Báo cáo `uiux-redesign/module-reports/`, cập nhật QA board. Đóng `P15-T5b` và `P18-T7` | ◐ **CODE + ĐO XONG, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 12). Báo cáo `module-reports/P16_flashcard.md`, changelog, QA board cập nhật. E2E `flashcard-responsive.spec.ts` đo 6 bề rộng × 2 project: **chromium 16/16 + mobile 16/16**. `DS-003` tôn trọng (đổi DB/API đã xong ở `T1`…`T7`). Khép `P15-T5b` + `P18-T7` |
| P16-T9 | Quality gate + seed + docs | `seed.dev.sql` có **một bộ thẻ mẫu đủ 5 khối** để mọi màn không rỗng (bài học `P18-T10`: `/admin/reports` giấu lỗi ISO suốt nhiều tháng vì **seed rỗng nên bảng luôn trống**). Cập nhật `docs/10`, QA board, changelog. `npm run lint && npm run typecheck && npm test && npm run build` xanh + **full E2E một lượt trên máy rảnh** | ◐ **FIXED, chờ xác minh độc lập** — Claude đã chạy full E2E `314/314`; Codex tái dựng DB sạch và phát hiện `BUG-P16-001`: seed/E2E ghim UUID cũ của Course nên `db:reset → db:seed:dev` đỏ FK. Đã sửa bằng khóa nghiệp vụ `VCB-BANK` + test khóa; sau sửa reset→seed exit 0, Chromium `16/16`, Pixel 7 `16/16`, lint/typecheck/build exit 0, Vitest `256/256`. Vì Codex là người sửa bug mới nên **không tự ghi Verified**. Cloud dry-run còn 403/thiếu credential |

**Thứ tự bắt buộc:** `T0` → `T1` → `T2` → (`T3` ∥ `T5`) → (`T4` ∥ `T6` ∥ `T7`) → `T8` → `T9`.
`T3` và `T5` chạy song song được vì một bên soạn, một bên đọc — nhưng **cả hai đều phải đợi `T2`**, nếu không sẽ có hai cách hiểu khác nhau về cùng một bản ghi, đúng mẫu hỏng `UX-UIUX-M25-010`.

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
