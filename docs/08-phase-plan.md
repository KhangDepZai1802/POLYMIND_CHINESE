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
| P16-T5 | Template thẻ học viên — mặt trước + mặt sau 5 khối | Dựng thẻ **bằng chữ**, đúng §7ter tại thời điểm 2026-07-23: mặt trước từng căn pinyin **trên từng chữ Hán**; mặt sau 5 khối có màu viền. **⚠️ Phần bố cục mặt trước đã bị yêu cầu mới `REVIEW-FRAME-7` (2026-07-27) thay thế** bằng ba dòng độc lập Hán tự → pinyin → nghĩa, rồi ảnh; phần “dựng bằng chữ, không `object-cover`” vẫn hiệu lực. Đo thật ở 360/390/430/768/1024/1280 theo `DS-038`; giữ hoạt ảnh lật `P14-T9` + `prefers-reduced-motion`; giữ player `P14-T12` (`0.5×/0.75×/1×`) | ◐ **CODE XONG, chờ xác minh độc lập** — Claude 2026-07-23 (đợt 12). Thẻ dựng bằng CHỮ; chiều cao do khối sizer grid quyết định nên chữ tự xuống dòng, không `object-cover` cắt. ✅ **Nợ đo đã đóng qua `T8`**: `flashcard-responsive` đo **6 bề rộng × 2 project 16/16**, nay nằm trong full suite `314/314` xanh (đợt 13) |
| ~~P16-T6~~ | ⛔ **HẾT HIỆU LỰC 2026-07-25** — xáo trộn + phát tự động đã BỎ HẲN (user chốt, xem §Khung một-màn-hình đợt 26). Giữ dòng này để lịch sử không hụt. ~~Xáo trộn + phát tự động~~ | Xáo trộn **chỉ buổi đang chọn**, **giữ trong bộ nhớ phiên**, đăng xuất → đăng nhập lại **trở về thứ tự gốc** (`Q6`); ⛔ không `localStorage`, không ghi DB. Phát tự động dừng được, tôn trọng `prefers-reduced-motion`. E2E **dựng lại đúng kịch bản đăng xuất/đăng nhập** để chứng minh thứ tự trở về gốc — không chỉ kiểm "có nút" | ◐ **CODE XONG, chờ xác minh độc lập** — Claude 2026-07-23 (đợt 12). Thứ tự xáo trộn giữ trong **state React**, cố ý KHÔNG dùng `sessionStorage` (nó sống qua đăng xuất/đăng nhập trong cùng tab → vi phạm đúng điều `Q6` đòi). Phát tự động luôn do người dùng bấm, luôn dừng được (WCAG 2.2.2). ✅ **Nợ E2E đã đóng qua `T8`**: kịch bản đăng xuất → đăng nhập lại bằng CONTEXT MỚI chứng minh thứ tự về gốc, nay trong full suite `314/314` xanh (đợt 13) |
| P16-T7 | ★ Đánh dấu thẻ khó | Bảng mới `(student_id, page_id)` + RLS: học viên chỉ đọc/ghi của chính mình, kiểm cả chiều **IDOR**. Unique index chống bấm hai lần (`BUG_M09_01`). ⛔ **Không** đụng mastery của Ôn câu sai (tránh hai nguồn sự thật); ⛔ **không** làm theo dõi biết/chưa biết (`Q4` hoãn). pgTAP + E2E | ◐ **CODE XONG, chờ xác minh độc lập** — Claude 2026-07-23 (đợt 12). `20260723000071_flashcard_starred_pages.sql`: khoá chính GHÉP `(student_id, page_id)` + `on conflict do nothing`, RPC `set_flashcard_star(page_id, starred)` nhận trạng thái **mong muốn** chứ không phải toggle (toggle không idempotent). pgTAP **18/18** gồm IDOR **cả hai chiều**. ✅ **Nợ E2E đã đóng qua `T8`**: ★ ghi DB rồi đọc lại, nay trong full suite `314/314` xanh (đợt 13) |
| P16-T8 | **Đóng `P15-T5b` + `P18-T7`** — pass `uiux-redesign` | Chạy đúng governance `uiux-redesign`: **baseline đo bằng trình duyệt trước khi sửa** (13 màn không áp dụng — ở đây là `/student/review` tab Flashcard + `/admin/flashcards`), 6 bề rộng × 2 project, axe. Nửa học viên theo Learning Journey Bento + palette `student-*` (`D-28`); nửa Admin theo hướng **mật độ cao** như Phase 18, **không** Bento (`DS-044`). Ràng buộc `DS-003` áp lại từ task này: **không** đổi query/action/RPC/RLS/validation/nhãn — mọi thay đổi đó phải đã xong ở `P16-T1`…`T7`. Báo cáo `uiux-redesign/module-reports/`, cập nhật QA board. Đóng `P15-T5b` và `P18-T7` | ◐ **CODE + ĐO XONG, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 12). Báo cáo `module-reports/P16_flashcard.md`, changelog, QA board cập nhật. E2E `flashcard-responsive.spec.ts` đo 6 bề rộng × 2 project: **chromium 16/16 + mobile 16/16**. `DS-003` tôn trọng (đổi DB/API đã xong ở `T1`…`T7`). Khép `P15-T5b` + `P18-T7` |
| P16-T9 | Quality gate + seed + docs | `seed.dev.sql` có **một bộ thẻ mẫu đủ 5 khối** để mọi màn không rỗng (bài học `P18-T10`: `/admin/reports` giấu lỗi ISO suốt nhiều tháng vì **seed rỗng nên bảng luôn trống**). Cập nhật `docs/10`, QA board, changelog. `npm run lint && npm run typecheck && npm test && npm run build` xanh + **full E2E một lượt trên máy rảnh** | ◐ **FIXED, chờ xác minh độc lập** — Claude đã chạy full E2E `314/314`; Codex tái dựng DB sạch và phát hiện `BUG-P16-001`: seed/E2E ghim UUID cũ của Course nên `db:reset → db:seed:dev` đỏ FK. Đã sửa bằng khóa nghiệp vụ `VCB-BANK` + test khóa; sau sửa reset→seed exit 0, Chromium `16/16`, Pixel 7 `16/16`, lint/typecheck/build exit 0, Vitest `256/256`. Vì Codex là người sửa bug mới nên **không tự ghi Verified**. Cloud dry-run còn 403/thiếu credential |

### `P16-T10` — 4 yêu cầu Admin flashcard sau nghiệm thu (user chốt 2026-07-24, `D-35`)

| Task | Nội dung | Definition of Done | Trạng thái |
| --- | --- | --- | --- |
| P16-T10a | **Xoá hẳn cột `sense_breakdown`** | Khối "Tách nghĩa" đã bỏ khỏi code ở đợt 16; nay xoá cột khỏi DB sau khi user đếm CLOUD ra `tong_the_tu_vung = 206 · co_tach_nghia = 0`. Phải sửa **cả hai** CHECK còn tham chiếu (`…_kind_order_check`, `…_sublists_array_check`) và trigger `app.sync_flashcard_media_paths()` — để `drop column` tự dọn sẽ mất luôn những vế còn cần. pgTAP + seed + `db:types` theo sau | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 17). `…074`. pgTAP `flashcard_structured_vocabulary` **29/29**. **Kiểm ngược:** dựng lại cột → đỏ **đúng 2 bài** (4 và 17) |
| P16-T10b | **Nhập hàng loạt kèm câu ví dụ + cụm từ** | Định dạng `hanzi \| pinyin \| nghĩa \| <câu ví dụ> \| <cụm từ>`; cột 4–5 **tuỳ chọn** để dòng 3 cột chạy y hệt cũ. Mục ngăn bằng `;;`, trường ngăn bằng `~`. **Lỗi phải chỉ đúng MỤC CON nào hỏng** (điều kiện Claude cam kết khi user chọn định dạng "một dòng chứa tất cả" thay vì đề xuất dòng phụ). RPC phải GHI hai cột `jsonb`. Thẻ đã tồn tại → **bỏ qua cả khối**, bảng xem trước ghi rõ | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 17). `…075`. Unit **15/15** (6 case cũ giữ nguyên trừ 1 vế tự mâu thuẫn, xem ghi chú), pgTAP `flashcard_bulk_import` **19/19**. **Kiểm ngược:** tắt bộ đọc danh sách con → **6 bài mới đỏ, 9 bài cũ vẫn xanh**; khôi phục RPC `…072` → đỏ **đúng 2 bài** ghi DB |
| P16-T10c | **Admin xem trước ĐÚNG mặt học viên thấy** | Bỏ hai ô ảnh thô + chữ "Không có ảnh". `VocabularyFront`/`VocabularyBack`/`FlashcardFaceContent` **tách ra file dùng chung** `components/flashcard-face.tsx`, **cả hai màn cùng gọi** — vẽ bản thứ hai cho Admin là tạo hai nguồn sự thật (`BUG_M10_01`). Ô thu nhỏ dùng `transform: scale` trong khung `overflow-hidden`, đặt `aria-hidden`, **bấm để phóng to** trong dialog. Khung cắt phải nằm TRONG nút, không bọc ngoài (kẻo cắt vòng focus 3px) | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 17). Thêm bài kiểm **TĨNH** `tests/unit/flashcard-face-single-source.test.ts` khoá "một nguồn sự thật". **Kiểm ngược:** rỗng hoá ô xem trước + chép lại `VocabularyBack` sang màn Admin → đỏ **đúng 2 bài** |
| P16-T10d | **Tạo nhiều buổi + xoá hàng loạt** | Tạo dải "từ buổi X đến buổi Y"; xoá tất cả buổi của bộ thẻ; xoá tất cả trang trong một buổi. **RPC kiểm `super_admin` + chỉ buổi `draft`.** "Xoá" là **xoá MỀM** — `AGENTS.md` cấm hard delete và `…066` đã cài trigger chặn xoá cứng; buổi vì thế cần cột `archived_at` và khoá số buổi phải thành **partial index**, nếu không xoá xong sẽ không tạo lại được "Buổi 1". Nút xoá đặt ở **"Vùng nguy hiểm"** tách khỏi cụm nút thường; hộp thoại xác nhận thường, không bắt gõ lại tên (`D-35` điểm 4) | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 17). `…076` + pgTAP mới `flashcard_section_bulk_ops` **22/22** (phủ 3 vế fail-closed + "buổi đã công bố không xoá được" + "số buổi được giải phóng"). Bố cục nút theo skill `ui-ux-pro-max` (`destructive-nav-separation`, `primary-action`). **Kiểm ngược:** đưa nút xoá về cụm nút thường → đỏ **đúng 2 bài** |

### `P16-T11` — Gắn ảnh mặt trước + audio HÀNG LOẠT cho cả buổi (user yêu cầu 2026-07-24)

Lời than gốc: *"thêm ghi âm cho tất cả trang trong buổi phải vào sửa từng trang, bấm lưu, đợi thoát ra, rồi vào tiếp"* — buổi 20 thẻ tốn ≈100 cú bấm. Thiết kế đầy đủ ở [`docs/11-thiet-ke-gan-media-hang-loat.md`](11-thiet-ke-gan-media-hang-loat.md) (dùng skill `ui-ux-pro-max`). **User chốt:** đặt ở tab thứ 2 của dialog "Nhập hàng loạt" (không thêm nút thứ 5) · **không làm ảnh mặt sau**.

| Task | Nội dung | Definition of Done | Trạng thái |
| --- | --- | --- | --- |
| P16-T11a | **Ghép file ↔ thẻ, fail-closed** | `domain/bulk-media.ts` thuần: 3 tầng khoá (Hán tự → pinyin bỏ dấu → **số đang hiện trên màn hình**). 🔴 Trùng khoá (行 xíng/háng, 是/事 cùng ra `shi`) → **`unmatched`, không đoán** — gắn nhầm audio là lỗi im lặng không ai thấy. 🔴 Số lấy đúng số đang hiện, **không dồn lại** cho thẻ từ vựng: dồn thì lệch một bậc trên cả buổi. Gán tay thắng ghép tự động | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 18). Unit **24/24**. **Kiểm ngược:** phá guard trùng khoá → đỏ **đúng 2 bài**, 22 bài kia vẫn xanh |
| P16-T11b | **Một lượt xin vé cho cả buổi** | 🔴 `consumeRateLimit("material_upload")` tiêu 1 đơn vị **mỗi lượt gọi**, trần **20/giờ** → gọi lặp từng thẻ thì buổi ≥21 thẻ không chạy xong và khoá admin cả tiếng. `createFlashcardBulkUploadTicketsAction` nhận cả lô, kiểm mọi `pageId` thuộc đúng buổi + `kind='vocabulary'`, giữ nguyên quy ước đường dẫn nên `isOwnedFlashcardMediaPath` và policy Storage không phải sửa | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 18). E2E đọc log máy chủ xác nhận **1 lượt gọi cho 3 file** |
| P16-T11c | **Ghi qua RPC `…077`** | `attach_flashcard_section_media` — fail-closed trong DB (super_admin + draft + trang thuộc buổi + không phải trang mở đầu, vi phạm thì **huỷ cả lượt**). ⛔ **Không** đi qua `flashcardPageSchema`: payload cả trang sẽ ghi rỗng đè `example_sentences`/`common_phrases`. `front_alt` do tầng app tính rồi truyền xuống (một chỗ sinh alt duy nhất); DB giữ vế `alt_pairing_check`. Trả `removed_paths` để dọn bucket | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 18). pgTAP mới **23/23**; catalog guard bump `70→71` sau khi **đo thật** trên DB sạch. **Kiểm ngược:** bỏ vế bắt buộc `front_alt` → đỏ **đúng bài 10** |
| P16-T11d | **Giao diện tab thứ 2** | Bảng đối chiếu từng thẻ trước khi chạy (dùng lại mô hình của tab "Danh sách chữ"). 5 trạng thái đều có **chữ**, không chỉ màu. 🔴 Ô "Ghi đè" **mặc định TẮT** vì thay = xoá hẳn file cũ, không undo được. Nguyên tử **theo từng thẻ**, không theo cả lô. Kéo–thả chỉ là bổ trợ, luôn có `<input type=file>` thật. `Progress` mới có `role="progressbar"` + số "14/38" | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-24 (đợt 18). E2E `34/34` cả hai project (32 → +2), phủ cả 3 tầng khoá trong một bài và khép vòng **"hết Thiếu audio → công bố được"** |

### `P16-T12` — Bỏ ảnh mặt sau khỏi thẻ từ vựng (user chốt 2026-07-25)

User đổi cơ chế mặt sau: nay dựng bằng CHỮ (4 khối §7ter) nên ô ảnh mặt sau thẻ từ vựng là thứ thừa — *"không cần ảnh nữa, để thì thừa"*. Thay thế hẳn quyết định `P16-T1` (2026-07-23, khi đó mặt sau còn mang được ảnh riêng).

| Task | Nội dung | Definition of Done | Trạng thái |
| --- | --- | --- | --- |
| P16-T12 | **Thẻ từ vựng không còn `back_image_path`** | ⛔ KHÔNG drop cột (dùng chung với trang mở đầu — vẫn hai ảnh). Thêm vế `kind='vocabulary' ⇒ back null` vào `flashcard_pages_image_kind_check` (`…078`). Đo cloud trước khi siết (`co_anh_mat_sau=0`). Bỏ khỏi Zod nhánh vocabulary, `pageValues`/`declaredMedia`, ô UI (giữ cho cover), `VocabularyBack`, seed. `distinct_media_check` giữ nguyên cho cover | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 19). `…078`. pgTAP `flashcard_structured_vocabulary` cập nhật (bài mới "thẻ từ vựng KHÔNG được mang ảnh mặt sau"); Vitest `299/299`, pgTAP `516/516`, E2E `34/34`. **Kiểm ngược:** làm yếu constraint → đỏ đúng bài 11. ⛔ CHƯA push cloud |

### `BUG-P16-002` — Nhập hàng loạt báo "N file tải lên không hợp lệ hoặc đã mất" (user báo 2026-07-25)

User thả 34 file (17 ảnh + 17 mp3) vào tab "Ảnh & Audio", chờ rất lâu rồi nhận `31 file tải lên không hợp lệ hoặc đã mất` và **mất sạch** công tải lên. Kèm yêu cầu thứ hai: *"load 34 ảnh và mp3 lên cùng lúc rất chậm"*.

| Task | Nội dung | Definition of Done | Trạng thái |
| --- | --- | --- | --- |
| BUG-P16-002a | **Không xoá dữ liệu vì một lỗi chưa rõ** | Bước xác minh cũ coi **mọi** lỗi (kể cả trục trặc đường truyền) là "file hỏng" rồi `removeFlashcardObjects` — client thấy lỗi lại dọn nốt phần còn lại. Nay tách hai vế: soi được mà sai → xoá; **không soi được → giữ nguyên, không ghi gì**, trả `keepUploads` để client đừng dọn. Một khe hỏng chỉ loại **khe đó**, 33 file lành vẫn được gắn | ☑ **FIXED, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 20) |
| BUG-P16-002b | **MIME lúc tải lên phải khớp bucket** | 🔴 `uploadToSignedUrl` **bỏ qua** tuỳ chọn `contentType` khi thân request là Blob/File — nó gói FormData và để trình duyệt khai theo `File.type`, mà `File.type` lấy từ registry Windows. Đo trên máy user: `.webp` **không có** mục Content Type → rỗng → bucket từ chối `mime type application/octet-stream is not supported`, dù `matchFlashcardMediaFiles` đã bảo "hợp lệ". Nay `file.slice(0, size, ticket.contentType)` ép đúng kiểu server suy từ đuôi file (không sao chép byte) | ☑ **FIXED, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 20). Dựng lại thật: cũ HỎNG, mới OK và bucket lưu `image/webp` |
| BUG-P16-002c | **Bớt round-trip** | Soi file: 34 lượt `storage.info()` → **1 lượt** RPC `flashcard_media_objects_info` (`…079`, `security invoker` nên RLS `storage.objects` vẫn áp dụng). Ký vé: nối đuôi → theo lô 8. Tải lên: 4 → 6 song song | ☑ **FIXED, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 20). Đo 5 vòng, trung vị **761 ms → 244 ms (3,1×)** cho bước soi; ký vé 616 → 496 ms trên localhost (chênh lệch lớn hơn nhiều trên cloud vì RTT chiếm phần chính) |
| BUG-P16-002d | **Lỗi phải đọc được** | Bản cũ nói "31 file hỏng" mà không nói **file nào** — chính vì vậy không truy được nguyên nhân từ ảnh chụp màn hình. Nay server trả `rejectedPaths`, client đổi ngược về tên file người soạn đã thả; nhánh lỗi không còn vứt `failedFiles` | ☑ **FIXED, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 20) |

### `BUG-P17-002` / `BUG-P17-003` — Trang QR `/t/<mã>`: mất nút ▶ và trang mở đầu TRẮNG trên điện thoại (user báo 2026-07-25)

User quét mã trên máy thật (1080px, Chrome Android) và gửi hai ảnh chụp: thẻ từ vựng **không còn nút mũi tên phải**, thẻ 1 (trang mở đầu) **trắng tinh chỉ còn một đường kẻ mảnh**. ⚠️ `BUG-P17-001` đã dùng cho lỗi chấm điểm `result_published_at` (đợt 16) — hai bug này lấy `002`/`003`.

| Task | Nội dung | Definition of Done | Trạng thái |
| --- | --- | --- | --- |
| BUG-P17-002 | **Nút ▶ phải nằm trọn trong màn 320→430px** | `StudentAudioPlayer` không phải một nút mà là khối `flex-wrap` rộng tối thiểu ~390px và **không co được** (nút phát `min-w-32` + chữ "Tốc độ" + 3 nút `min-w-16`); đặt cùng MỘT hàng `flex` với `[◀] [Lật thẻ] [▶]` thì hàng cần ~500px trong 328px có thật → phần dư bị `overflow-hidden` **cắt đứt nút ▶**. Nay **hai hàng**: audio ở trên (`density="compact"` mới — bỏ `min-w` nút phát, 3 nút tốc độ về 44px, ẩn chữ "Tốc độ" nhưng `role="group"` vẫn giữ `aria-label`), điều hướng ở dưới với CTA chính sát đáy. Mũi tên `size-12` (48px) trên điện thoại, `sm:size-14` như cũ. **Mặc định `comfortable` nên màn học viên không đổi một pixel** | ☑ **FIXED, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 24). E2E đo **toạ độ nút** ở đủ 6 bề rộng. **Kiểm ngược:** bản cũ đỏ với `x + width = 488.1875` trong màn 360px |
| BUG-P17-003 | **Trang mở đầu phải có chiều cao thật** | Trang mở đầu là mặt thẻ duy nhất còn dựng bằng ẢNH, mà `next/image fill` là `position:absolute` nên **không đẩy được chiều cao nào**; chiều cao vốn đến từ `--fc-face-min-h`, mà trang công khai **cố ý** đặt `0px` (sàn cứng 360px làm vỡ máy màn ngắn — quyết định của `P17-T1`, giữ nguyên). Nay khung ảnh mang `data-fc-image-face` và `.fc-public` cấp lại chiều cao bằng `aspect-ratio: 4/5` + trần `55dvh` (giữ chỗ sẵn ⇒ CLS = 0; trần là vế chống vỡ nằm ngang), kèm `object-contain` **chỉ trong `.fc-public`** để không cắt chữ trên trang dạy học | ☑ **FIXED, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 24). E2E đo **chiều cao mặt thẻ 1** (> 200px) và vẫn nằm trong màn. **Kiểm ngược:** bản cũ đỏ với `Received: 2` — đúng hai đường viền, đúng đường kẻ trong ảnh user gửi |

🔴 **Bài học về BÀI KIỂM, không phải về code:** bộ E2E cũ đã có bài "không tràn ngang" ở đủ 6 bề rộng và **vẫn xanh suốt** trong khi nút ▶ mất hẳn — vì khung ngoài có `overflow-hidden` nên phần tràn bị **cắt** chứ không sinh cuộn ngang, `scrollWidth == clientWidth`. Tương tự, bài "media được ký" soi `src` của `<img>` nên không thấy ảnh nằm trong một cái hộp `0px`. **Đo bố cục phải đo toạ độ/kích thước của chính phần tử** (`boundingBox()`), không đo `scrollWidth`.

📌 **Đọc kèm:** hai bug này sửa trong `.fc-public`; đợt 25 khối CSS đó đổi tên thành **`.fc-frame`** và chuyển về `globals.css` để màn Ôn tập dùng chung (xem mục ngay dưới). Nội dung luật không đổi, chỉ đổi tên và chỗ ở.

---

### Khung đọc thẻ MỘT MÀN HÌNH cho màn Ôn tập của học viên (user chốt 2026-07-25)

User: *"tôi rất thích giao diện flashcard công khai từ mã QR này, áp dụng giao diện này cho giao diện flashcard trong module ôn tập. Trang flashcard trong module ôn tập hiện tại nó không nằm trong 1 khung hình, phải lướt lên lướt xuống nhiều để tương tác — tôi muốn trong 1 khung hình phải có 3 nút xáo trộn, thứ tự gốc, phát tự động, flashcard, mũi tên trái và phải, nút lật thẻ, nút phát video, 0.5x, 0.75x, 1x."*

Đo trên bản cũ ở 360×800: trang cao **1795px** trong khung nhìn 800px — hơn hai màn hình phải lướt.

⚠️ **Không đặt ID `P17-Tx`:** repo này đang dùng `P17-T1` cho **hai** việc khác nhau (Teacher Workspace Redesign ở §Phase 17, và trang flashcard công khai ở `WORKLOG`). Thêm một cái thứ ba là làm cho ID vô nghĩa, nên ba việc dưới đây mang tiền tố riêng.

| Task | Nội dung | Definition of Done | Trạng thái |
| --- | --- | --- | --- |
| REVIEW-FRAME-1 | **Khung ba vùng dùng chung** | Trích hình học của trang QR ra `flashcard-reader-frame.tsx` (`FlashcardReaderFrame` · `FlashcardFrameHeader` · `FlashcardFrameStage` · `FlashcardFrameControls` · `FlashcardTapArea`), **cả hai** trình đọc cùng gọi. Chép JSX sang màn Ôn tập là đúng hình dạng `BUG_M10_01` — mà khối đó vừa tốn một đợt sửa (`min-h-0`, `min-h-full`, safe-area, thanh điều khiển hai hàng). CSS `.fc-public` → **`.fc-frame`** chuyển về `globals.css` (file trong `(public)/` không nạp cho `(dashboard)/`), xoá `public-flashcard.css` | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 25). Trang QR giữ nguyên hành vi: `public-flashcard` E2E vẫn `16/16` mỗi project |
| REVIEW-FRAME-2 | **Màn Ôn tập vào khung, mặc định TOÀN MÀN HÌNH** | `fixed inset-0` (che chrome ngay từ lần vẽ đầu, không nháy) + `html[data-flashcard-focus]` ẩn `[data-dashboard-chrome]`/`[data-review-chrome]` và khoá cuộn nền — cùng lối `data-exam-active` đã có. ✕ chuyển sang dạng `inline` (**không có trạng thái chết**), ⛶ vào lại. Cờ dọn ở cleanup nên đổi tab/rời trang là chrome trở lại. Giữ NGUYÊN mọi tính năng học viên: ★, mục lục buổi, xáo trộn/thứ tự gốc, phát tự động, hoạt ảnh chuyển trang, `autoPlayToken` | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 25) |
| REVIEW-FRAME-3 | **Vừa MỘT khung hình ở 360×800** | ★ thu về nút 44px ở đầu khung (giữ `aria-label` cả câu); mục lục buổi chỉ dựng khi có ≥2 buổi; `density="compact"` cho trình phát; hàng nút điều hướng `[◀][Lật thẻ][▶]` sát đáy. E2E đo **trang không cuộn dọc** + **toạ độ 12 nút** nằm trong khung nhìn + ngưỡng touch target theo đúng loại con trỏ | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 25). **Kiểm ngược:** bản cũ đỏ với `scrollHeight = 1795` trong khung nhìn 800px |

✅ **Món "còn nợ" ở trên đã XONG ở đợt 26** — user báo đúng nó là lỗi: *"phần nội dung flashcard thì phải lướt lên lướt xuống thì mới thấy đầy đủ nội dung"*. Xem mục ngay dưới.

---

### Vòng 2 của khung một-màn-hình — user phân tích tiếp 2026-07-25 (đợt 26)

User chỉ ra ba điểm còn sai trên ảnh chụp máy thật, kèm hướng đi: *"flashcard không cần cuộn lên xuống vẫn phải thấy đầy đủ nội dung. Bỏ luôn 3 nút xáo trộn, thứ tự gốc và phát tự động (bỏ hẳn 3 chức năng này). Chữ buổi 1 buổi 1 và mục lục buổi có thể đẩy lên cao nhất… chỗ mục lục buổi có thể cho nút nó lùn lại hơn xíu… bạn làm mọi cách để chừa khoảng trống cho flashcard."*

| Task | Nội dung | Definition of Done | Trạng thái |
| --- | --- | --- | --- |
| REVIEW-FRAME-4 | **Không mặt nào phải cuộn** | Gốc rễ là `FlashcardSizer`: nó đo chiều cao thẻ bằng mặt CAO HƠN, nên thẻ có mặt sau 4 khối cao gấp đôi màn và mặt trước bị đẩy lệch khỏi vùng nhìn (user: *"chỉ thấy hình ảnh và dịch tiếng Việt, phải lướt lên mới thấy pinyin và hán tự"*). Nay khung dùng `FlashcardSurface fill` — thẻ cao ĐÚNG vùng thẻ — và việc "vừa nội dung" chuyển vào từng mặt: mặt trước cho **ảnh co** (`flex-1 min-h-0`), mặt sau **thu cỡ chữ** (`FitText`, thu bằng `font-size` chứ không `transform` để chiều cao layout co theo thật). Vùng thẻ đổi sang `overflow-hidden` để không còn cửa nào lặng lẽ thành cuộn | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 26). Đo thật 360×800: `fit-scale = 0.780` (chạm sàn), hộp mặt sau `clientHeight = scrollHeight = 522` ⇒ vừa khít, cả 4 khối thấy hết. **Kiểm ngược:** đặt `MIN_SCALE = 1` (tắt thu chữ) → đỏ đúng "mặt back còn phải cuộn mới đọc hết" |
| REVIEW-FRAME-5 | **Bỏ hẳn 3 chức năng + bóp đầu khung** | Xoá xáo trộn / thứ tự gốc / phát tự động (code + state + effect + test + docs; `Q6`/`P16-T6` hết hiệu lực). Bỏ `pt-[env(safe-area-inset-top)]` cho khung trong dashboard — vỏ dashboard **không** khai `viewportFit: cover` nên chuẩn nói inset = 0, nhưng trình duyệt trong Zalo vẫn báo ~30px, thành dải trống user thấy. Padding dọc đầu khung 8→6/4px, ngang 16→12px, nút mục lục buổi `h-11`→`h-9` (36px cho chuột; cảm ứng vẫn 44px do `globals.css`) | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 26). Bài kiểm ghim chiều phủ định: "KHÔNG còn xáo trộn / thứ tự gốc / phát tự động" |
| REVIEW-FRAME-6 | **Vào module không nhảy thẳng vào flashcard** | Hai lo ngại ngược nhau của user: vào thẳng thì *"người kém công nghệ sẽ không biết sự tồn tại của Ôn Tập Câu Sai"*; không vào thẳng thì *"sợ người ta không biết cách làm rồi complain web dỏm"*. Chốt: tab Flashcard mở ra **trang mở đầu module** (tên bộ thẻ · N thẻ · M buổi + một CTA `Bắt đầu ôn thẻ` cao 56px) — hai tab vẫn thấy được — **kèm `FlashcardStartHint`**: mũi tên ↓ động chỉ vào CTA, có ✕ (tắt lượt này) và "Không nhắc lại" (ghi `localStorage`). Tôn trọng `prefers-reduced-motion`; đọc storage bằng `useSyncExternalStore` nên không nháy và không lệch hydrate | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 26) |
| REVIEW-FRAME-7 | **Dựng lại bố cục mặt trước dùng chung** | Áp cho **cả** trang QR `/t/<mã>` và Flashcard trong module Ôn tập qua đúng một `FlashcardFaceContent`: thứ tự dọc **Hán tự → pinyin → nghĩa tiếng Việt → ảnh**; pinyin lớn nhất, nghĩa lớn hơn Hán tự nhưng nhỏ hơn pinyin; Hán tự là **một chuỗi liền**, không chia cột theo âm tiết nên khoảng cách glyph không phụ thuộc độ dài pinyin; ba dòng chữ nằm ngay trên ảnh (khoảng hở ≤ 24px) và cụm chữ + ảnh ở gần tâm thẻ; vẫn vừa một màn hình, không làm mặt trước cuộn. Unit ghim chuỗi Hán tự liền; E2E đo thứ tự, cỡ chữ và hình học thật trên cả hai trình đọc; cập nhật §7ter vì quyết định cũ “pinyin căn trên từng chữ Hán” hết hiệu lực; lint/typecheck/test/build xanh | ☑ **CODE + ĐO XONG, chờ user smoke — Codex 2026-07-27.** Lint/typecheck/build xanh; Vitest 346/346; Playwright Chromium 35/35 + Mobile 35/35; đã kiểm tra ảnh chụp 360×800. |
| REVIEW-FRAME-8 | **Cỡ chữ mặt trước tự thích nghi theo độ dài nội dung** | Dùng dữ liệu thật 35 buổi trong `tuvung.md` để chọn biên; từ/cụm ngắn phải tự phóng lớn, câu dài phải tự co theo kích thước render thực tế thay vì ngưỡng ký tự cứng; ba dòng co cùng tỷ lệ để giữ **pinyin > nghĩa > Hán tự**. Áp qua component dùng chung nên cả `/student/review`, `/t/<mã>` và preview Admin nhận cùng hành vi. Không cắt chữ, không tràn ngang, không làm mặt trước cuộn; giữ thứ tự và khoảng cách sát ảnh của `REVIEW-FRAME-7`. Có unit test cho cấu hình co chữ và E2E đo đối chứng thẻ ngắn lớn hơn thẻ dài ở mobile lẫn desktop; lint/typecheck/test/build xanh. | ☑ **CODE + ĐO XONG, chờ user smoke — Codex 2026-07-27.** Đã phân tích 564 thẻ (559 từ/cụm + 5 câu); từ/cụm tăng đúng 5px; câu co theo tải ba dòng + overflow thật. Lint/typecheck/build xanh; Vitest 74 file / 349 test; Playwright Chromium 37/37 + Mobile 37/37; đã xem ảnh 360×800 của từ ngắn và câu dài. |

**Thứ tự bắt buộc:** `T0` → `T1` → `T2` → (`T3` ∥ `T5`) → (`T4` ∥ `T6` ∥ `T7`) → `T8` → `T9` → `T10` → `T11` → `T12`.
`T3` và `T5` chạy song song được vì một bên soạn, một bên đọc — nhưng **cả hai đều phải đợi `T2`**, nếu không sẽ có hai cách hiểu khác nhau về cùng một bản ghi, đúng mẫu hỏng `UX-UIUX-M25-010`.

---

### Mã QR CỐ ĐỊNH cho 35 buổi — `QRLINK-1` (user chốt 2026-07-27, `D-39`)

User: *"trang flashcard qr công khai hiện tại cần phải công bố mới có được, nhưng bây giờ sếp tôi muốn có ngay link của 35 buổi… không cần link random nữa, hãy cho tôi link cố định luôn của 35."*

Yêu cầu này va vào **hai** vế của `D-36` cùng lúc, và cả hai đều cố ý chứ không phải sơ suất — nên đây là đổi **quyết định**, không phải sửa lỗi:

| Vế của `D-36` | Vì sao nó chặn | Xử lý ở `D-39` |
| --- | --- | --- |
| Mã **ngẫu nhiên 60 bit** (`app.new_flashcard_link_token`) | Chỉ biết mã sau khi bấm tạo → không đưa trước cho bên dàn trang được | Mã sinh theo công thức `slug(mã khoá)-<số buổi 2 chữ số>`. Hàm cũ **giữ nguyên**, không xoá |
| `create_flashcard_public_link` **từ chối buổi chưa công bố** | `VCB-BANK` mới công bố 1/35 buổi (đo cloud 2026-07-25) → 34 buổi không có mã để in | Bỏ vế `published` ở đường **TẠO**; đường **ĐỌC** giữ nguyên, thêm trạng thái `coming_soon` |

| Task | Nội dung | Definition of Done | Trạng thái |
| --- | --- | --- | --- |
| QRLINK-1a | **Mã cố định, đoán trước được** | `app.flashcard_fixed_link_token(section_id)` (`stable`) + nới `flashcard_public_links_token_shape_check` sang slug `^[a-z0-9]+(-[a-z0-9]+)*$` dài 3–48. 🔴 **Mã ngẫu nhiên đã in PHẢI lọt hình dạng mới** — có bài kiểm riêng, vì nới sai chiều là giết hàng loạt QR đã nằm trên giấy. Bản sao công thức ở TS (`flashcardFixedPublicToken`) chỉ để **hiện trước** địa chỉ, có bài ghim cùng cặp vào/ra với bản SQL | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-27. pgTAP ghim **chuỗi cụ thể** `kh-qr-01`, không ghim hình dạng: bài `matches(...)` vẫn xanh kể cả khi mã quay về ngẫu nhiên |
| QRLINK-1b | **"Có link" tách khỏi "đã công bố"** | Đường TẠO chỉ còn chặn buổi đã xoá mềm. Đường ĐỌC trả `state = coming_soon` **không kèm một chữ nội dung nào** (không tiêu đề, không Hán tự, không đường dẫn media) → trang "Buổi N sắp mở" thay cho 404. ⛔ `share.can_read_public_flashcard_media` **giữ nguyên** vế `published`: nới theo là rò media chưa duyệt trong khi giao diện vẫn nói "sắp mở" | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-27. **Kiểm ngược:** bỏ vế `published` khỏi helper media → đỏ đúng bài 29 *"buổi NHÁP tuy đã có liên kết nhưng media vẫn KÍN"* |
| QRLINK-1c | **Một lượt cho cả bộ thẻ + danh sách chép được** | `create_flashcard_public_links_for_deck(deck_id, replace_legacy)` chạy trọn trong MỘT transaction (đứt mạng giữa chừng không để lại trạng thái nửa vời), idempotent theo `BUG_M09_01`. Cả RPC lẻ lẫn RPC hàng loạt đi qua **một** đường ghi `app.upsert_flashcard_public_link` (`BUG_M10_01`). Màn Admin hiện trước đủ 35 địa chỉ kể cả buổi chưa có mã + nút chép cả danh sách dạng `Buổi N⇥URL` | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-27. Buổi đang mang mã ngẫu nhiên cũ **không bị thay lặng lẽ**: RPC ném lỗi trừ khi `replace_legacy`, UI bắt xác nhận trước |

**Hệ quả bắt buộc của mã cố định:** thu hồi rồi tạo lại là **bật lại chính hàng cũ** (`row_status = 'reactivated'`), vì công thức chỉ cho ra đúng một chuỗi mà unique index trên `token` phủ cả hàng đã thu hồi. Câu cảnh báo cũ trong hộp thoại thu hồi (*"tạo mới sẽ ra mã khác"*) đã sai từ `D-39` và đã được sửa.

⚠️ **Giới hạn của mô hình:** mã đoán được, nên chỉ dùng cho nội dung mà **cả bộ mã được in trong cùng một ấn phẩm**. Khoá bán lẻ theo từng buổi phải quay về mã ngẫu nhiên.

---

### Tốc độ tải ảnh flashcard — `PERF-IMG-1` (user báo 2026-07-27)

User: *"tốc độ load hình của flashcard quá chậm (cả flashcard QR và flashcard trong module ôn tập của tài khoản học viên). bấm qua trang mới rồi mà hình vẫn chưa load và phải đợi rất lâu"*.

**Bốn nguyên nhân cộng dồn, đọc từ source:**

1. **Ảnh phục vụ nguyên bản gốc.** Không có một bước nén/resize nào trong cả repo — admin upload thẳng file gốc (trần 8MB), rồi mọi `<Image>` đều gắn `unoptimized` nên Next cũng bị tắt khâu tối ưu. Máy học viên tải ảnh 3000px về để vẽ vào ô rộng 320px.
2. **Không tải trước thẻ nào.** Chỉ thẻ đang xem nằm trong DOM, nên request ảnh N+1 chỉ bắt đầu **sau khi** bấm sang. URL của cả buổi thì đã nằm sẵn ở client từ lượt tải trang — tức chữa được mà không tốn thêm request server nào.
3. **Chữ ký đổi mỗi lượt render** ⇒ URL khác ⇒ cache trình duyệt vô hiệu; mở lại trang là tải lại 100%.
4. **`cacheControl` mặc định 1 giờ.**

**Phạm vi đã chốt (user chọn `A1+A3+B1+C2`; Supabase gói Free nên KHÔNG dùng Image Transformation):**

| ID | Việc | Definition of Done | Trạng thái |
|---|---|---|---|
| PERF-IMG-1a | **Nén ở trình duyệt trước khi tải lên** | Luật thuần ở `domain/image-compression.ts` (cạnh dài ≤1280, WebP q82) có unit test; phần chạm DOM ở `client/compress-image.ts` **fail-open** về file gốc khi giải mã/mã hoá hỏng — nén là việc tăng tốc, không được chặn đường đăng bài của admin. Giữ cờ xoay EXIF (`imageOrientation: "from-image"`), nếu không ảnh chụp dọc sẽ **nằm ngang** trên thẻ. Đọc `blob.type` THẬT thay vì tin định dạng mình xin (`toBlob` lặng lẽ trả PNG khi trình duyệt không hỗ trợ WebP). Nén **trước khi xin vé tải lên**, vì server dựng đường dẫn từ `fileName`/`mimeType` và bước soi sau đó đối chiếu đuôi file với `contentType` thật | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-28. Đo trong Chromium: ảnh camera 5,00MB → **302KB WebP (−94%)** |
| PERF-IMG-1b | **Tải trước thẻ lân cận** | Cửa sổ tiến 3 / lùi 1, dùng CHUNG cho cả hai trình đọc (chép hai bản là đúng hình dạng `BUG_M10_01`). **Không** tải trước file audio. 🔴 **Phải nhường đường truyền cho thẻ đang xem**: chờ ảnh thẻ hiện tại xong rồi mới bắt đầu, và tải **tuần tự** | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-28. Đo ở 4G giả lập: chờ sau mỗi lần bấm **19.712ms → 163ms** |
| PERF-IMG-1c | **Backfill ảnh cũ** | `scripts/compress-flashcard-media.mjs`, **mặc định chạy khô** (chỉ đo, không ghi). Ghi đè tại chỗ và **giữ nguyên định dạng** nên `flashcard_pages` không phải sửa dòng nào. Nén ra to hơn thì giữ bản gốc | ☑ Script xong + chạy thật trên bucket local (**11,49MB → 3,01MB, −74%**) — 🔴 **chưa chạy trên cloud** (Claude không có credential production) |
| PERF-IMG-1d | **`cache-control` 1 năm** | `FLASHCARD_MEDIA_CACHE_CONTROL` áp cho mọi đường tải lên. An toàn vì đổi ảnh là đổi đường dẫn (`slot-<uuid>.<ext>`) | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-28 |

🔴 **Bài học từ chính đợt này — tải trước mà làm ẩu thì phản tác dụng.** Bản đầu bắn 3–4 ảnh cùng lúc ngay khi đổi thẻ. Đo ở 4G (1,6 Mbps) với ảnh chưa nén: thẻ **đang xem** quá 30 giây vẫn chưa hiện, vì mấy ảnh tải trước chia nhau đúng cái băng thông nó đang cần. `fetchPriority: "low"` **không cứu được** — nó chỉ xếp hạng trong một kết nối, không ngăn việc chia băng thông. Trần chờ 5s cũng sai nốt: nó biến "nhường đường" thành "chen ngang sau 5 giây". Đây là lý do thứ tự `A trước, B sau` là bắt buộc chứ không phải sở thích.

⚠️ **Còn nợ, chưa làm (chờ số đo cloud):** ảnh cũ dạng **PNG** chỉ giảm ~74% (còn ~1MB/ảnh) vì PNG vốn dở với ảnh chụp — muốn sâu hơn phải đổi PNG→WebP kèm sửa đường dẫn ở DB, **task riêng**. Tầng **C1** (ổn định hoá chữ ký để cache trình duyệt dùng lại được giữa các lượt mở trang) và **B2** (màn hình chờ tải cả buổi kèm thanh tiến độ) chưa làm.

> ✅ **Cái "task riêng" ở trên đã thành `PERF-IMG-2` ngay bên dưới** — user báo lại rằng `PERF-IMG-1` "nhanh hơn nhưng không đáng kể", và số đo production giải thích vì sao.

---

### Ảnh flashcard sang WebP — `PERF-IMG-2` (user báo lại 2026-07-28)

User: *"hình load vẫn chậm, có nhanh hơn nhưng ko đáng kể… tốc độ load hình phải bằng tốc độ load chữ, người dùng vuốt tới đâu hình theo tới đó"*.

**Số đo trên ảnh production thật** (lấy về từ trang QR công khai, không cần đăng nhập):

| | Kích thước | |
|---|---|---|
| PNG gốc trong bucket | 3.770 KB | 1728×2496 |
| Giữ PNG, thu về 1280px (`PERF-IMG-1`) | 748 KB | −80% |
| **WebP 1280px q82** | **27 KB** | **−99,3%** |

Ảnh của khoá này là **đồ hoạ phẳng**, không phải ảnh chụp — PNG lưu loại nội dung đó cực kỳ lãng phí, còn WebP thì cực kỳ hiệu quả. Quyết định "giữ nguyên định dạng để khỏi đụng DB" của `PERF-IMG-1` vì thế chỉ lấy được **1/28** phần thắng. Đó chính xác là khoảng cách giữa "đỡ chậm" và "hiện ra ngay".

| ID | Việc | Definition of Done | Trạng thái |
|---|---|---|---|
| PERF-IMG-2a | **RPC đổi đuôi đường dẫn** (`…082`) | `trg_flashcard_pages_guard_history` chặn mọi sửa đổi trang của buổi đã công bố, kể cả `service_role`. RPC tự hạ buổi về nháp → sửa → công bố lại **đúng mốc `published_at` cũ**, trọn trong MỘT transaction (đứt giữa chừng không để lại buổi ở trạng thái nháp — mã QR in trong sách sẽ hiện "Buổi N sắp mở"). Khoá cứng phạm vi: **chỉ đổi được phần đuôi**, bỏ đuôi ra thì đường dẫn cũ/mới phải trùng khít. Chỉ `service_role`. pgTAP ghim cả chiều thuận lẫn chiều phủ định | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-28. pgTAP **580/580** (+15) |
| PERF-IMG-2b | **Script chuyển đổi** (`npm run media:webp`) | Mặc định chạy khô. Thứ tự an toàn: nén → **tải file mới lên** → gọi RPC → **chỉ xoá file cũ mà RPC xác nhận đã đổi**. Idempotent | ☑ **DONE** — chạy thật trên bucket local: **11,49MB → 0,07MB**. 🔴 Chưa chạy cloud |
| PERF-IMG-2c | **Tải trước cả buổi** | Bỏ trần 3 thẻ (con số của thời ảnh 3,8MB). Phanh chuyển sang **ngân sách thời gian 8 giây** | ☑ **DONE** — Claude 2026-07-28 |

🔴 **Hai bài học, cả hai đều do phép đo ép ra chứ không phải chọn trước:**

1. **Đừng suy `section_id` từ đường dẫn.** Bản đầu của RPC nhận `section_id` và bắt script tự cắt từ `actor/deck/section/page/file`. Quy ước đó đúng với ảnh do app tạo nhưng **sai với mọi đường dẫn có sẵn từ trước hoặc nhập tay** — và khi sai thì hàm báo "không tìm thấy buổi" trong khi ảnh vẫn nằm đó, vẫn đang được một trang dùng. Nay DB tự tra ngược từ `media_paths`: không còn giả định nào để mà sai.
2. **Ngân sách phanh phải tính bằng THỜI GIAN, không phải BYTE.** Ảnh nằm ở tên miền Supabase, khác tên miền trang. Thiếu `Timing-Allow-Origin` thì `transferSize`/`encodedBodySize` **luôn trả 0** cho tài nguyên khác tên miền — một ngân sách tính bằng byte sẽ không bao giờ giảm, tức không bao giờ phanh.

**Đo thật ở 4G giả lập (1,6 Mbps · RTT 150ms), ảnh 3,83MB → WebP:**

| | Bản gốc | Sau `PERF-IMG-1` | Sau `PERF-IMG-2` |
|---|---|---|---|
| Chờ ảnh sau khi bấm sang thẻ | 19.712 ms | 163 ms | **207 ms** |
| Thẻ 1 (mở trang → thấy ảnh) | 44,5 s | 15,7 s | **2,3 s** |
| Tổng byte ảnh của buổi | 11,49 MB | 3,01 MB | **0,07 MB** |

---

### Một khoá — NHIỀU bộ flashcard + dựng lại màn Admin — `MULTIDECK-1` (user chốt 2026-07-29)

User: *"mỗi khóa chỉ tạo được 1 bộ flash card, tôi muốn mỗi khóa có thể tạo nhìu bộ flashcard… thiết kế lại trang thiết kế flashcard này của admin nhìn cho gọn vì Địa chỉ QR của cả bộ thẻ đang chiếm hết màn hình… phải kéo qua khỏi qr thứ 35 mới thấy được bộ flashcard này"*.

**Hai ràng buộc cứng đọc từ source, không phải suy đoán:**

1. [`20260721000066_flashcards.sql:8`](../supabase/migrations/20260721000066_flashcards.sql#L8) — `course_id uuid not null **unique**` là chỗ chặn "mỗi khoá một bộ". Không phải luật nghiệp vụ ghi ở đâu cả, chỉ là ràng buộc DB.
2. `app.flashcard_fixed_link_token()` ([`…081`](../supabase/migrations/20260727000081_flashcard_fixed_public_links.sql)) sinh mã từ **mã KHOÁ** + số buổi. Một khoá hai bộ ⇒ buổi 1 của cả hai bộ cùng đòi `vcb-bank-01` ⇒ RPC ném lỗi *"Mã cố định … đã thuộc một buổi khác"*. **Đây là vế bắt buộc phải đổi, không né được.**

**4 điểm user đã chốt (`AskUserQuestion` 2026-07-29):**

| # | Chốt | Hệ quả |
|---|---|---|
| 1 | **Mã bộ thay chỗ mã khoá** trong công thức: `<mã bộ>-<số buổi>` | Bộ đang có được backfill mã bộ = slug mã khoá ⇒ **35 địa chỉ đã in không đổi một ký tự**. Bộ mới đặt mã khác ⇒ dải địa chỉ riêng, không va nhau |
| 2 | **KHÔNG làm link cấp cả bộ thẻ** (user bỏ yêu cầu ban đầu) | ✅ Bề mặt `anon` của `D-36` giữ **nguyên vẹn**: vẫn đúng 1 RPC + 1 policy Storage, `rls_catalog_matrix` không phải nới danh sách trắng |
| 3 | **Admin: cột trái điều hướng + ngăn kéo QR** | Khu soạn thẻ lên đầu màn; QR là việc của kỳ in, không phải việc mỗi ngày |
| 4 | **Học viên chọn bộ trước rồi vào buổi** | `getStudentFlashcardDeck` (`.maybeSingle()`) sẽ **vỡ** khi khoá có 2 bộ — phải sửa cùng đợt, không hoãn được |

| ID | Việc | Definition of Done | Trạng thái |
|---|---|---|---|
| MULTIDECK-1a | **Bỏ `unique(course_id)` + thêm `flashcard_decks.code`** (`…083`) | Mã bộ là slug `^[a-z0-9]+(-[a-z0-9]+)*$`, **unique toàn bảng**, dài 2–40 (trần 40 vì mã liên kết = `mã bộ` + `-NN` phải lọt CHECK 48 ký tự của `…081`). Backfill = slug mã khoá cho mọi bộ đang có. `not null` ngay trong cùng migration, không để cột nullable làm đường ghi thứ hai | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-29. Backfill có **3 cửa chặn riêng** (slug rỗng / trùng slug / quá dài), mỗi cửa một thông báo nêu đúng mã khoá phải đi sửa. ✅ **ĐÃ PUSH CLOUD 2026-07-29** — xác minh bằng `psql`: đỉnh `20260729000083`, `unique(course_id)` = 0, backfill ra `vcb-bank`/`vcb-exec`, và **0/70** mã đã phát hành bị lệch |
| MULTIDECK-1b | **`app.flashcard_fixed_link_token()` đọc `d.code` thay `c.code`** | pgTAP ghim **chuỗi cụ thể**: bộ có mã `vcb-bank` ⇒ buổi 35 ra đúng `vcb-bank-35` (bằng chứng mã đã in vẫn sống), và hai bộ khác mã trong **cùng một khoá** ra hai mã khác nhau. Bản sao TS `flashcardFixedPublicToken` đổi tham số theo, có bài ghim cùng cặp vào/ra | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-29. pgTAP ghim `md-bank-35` (chuỗi) **và** một bài phát biểu thẳng tính chất: bộ có `code = slug(mã khoá)` cho ra Y HỆT công thức cũ của `…081` |
| MULTIDECK-1c | **Khoá đổi mã bộ khi đã phát hành liên kết** | Đổi `code` của bộ đang có liên kết **chưa thu hồi** ⇒ **từ chối ở DB** (trigger), không chỉ ở app. Lý do: đổi mã bộ làm mọi mã tương lai lệch khỏi mã đã in, mà `…081` thì không bao giờ trỏ một mã đã in sang buổi khác — im lặng cho qua là đúng hình dạng `BUG_M10_01` | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-29. `trg_flashcard_decks_guard_code`. **Kiểm ngược có sẵn:** bài 22/23 chứng minh bộ chưa phát hành thì đổi mã tự do, và thu hồi hết liên kết là mở lại cửa |
| MULTIDECK-1d | **Tầng server đọc/ghi theo bộ** | `getAdminFlashcardDecks(courseId)` trả danh sách; trang chọn bộ **qua URL** (`?course=&deck=&session=`) để chia sẻ link và nút Back hoạt động. `saveFlashcardDeckAction` làm cả tạo lẫn sửa | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-29. `?course=&deck=&session=`; đổi **buổi** cố ý KHÔNG điều hướng (dữ liệu đã ở client — `PERF-NAV-1` đo ~443ms/lượt), chỉ `history.replaceState` |
| MULTIDECK-1e | **Dựng lại bố cục Admin** | Cột trái: danh sách Bộ thẻ + mục lục buổi **DỌC** có ô nhảy nhanh và chấm trạng thái. Bảng địa chỉ QR vào **ngăn kéo** (`Sheet`). Điện thoại: cột trái thành ngăn kéo. Không còn dải 35 nút kéo ngang | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-29. E2E `19/19` cả hai project, axe sạch ở 1280, `horizontalOverflow = 0` ở 360/768/1280 |
| MULTIDECK-1f | **Học viên chọn bộ** | Khoá nhiều bộ ⇒ hiện thẻ chọn bộ; khoá **một** bộ ⇒ vào thẳng như cũ (không bắt bấm thừa một bước cho ca phổ biến nhất) | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-29. 4 bài Vitest mới ghim: một bộ → vào thẳng; nhiều bộ chưa chọn → **không tải bộ nào**; mã bộ lạ trong URL → không kéo được bộ của khoá khác |

---

### Trang mở đầu MỘT ảnh + nhập hàng loạt ảnh mở đầu cấp bộ — `COVER-1` (user chốt 2026-07-29 → `D-41`)

Hai yêu cầu đi cùng một lượt: *"ở mỗi bộ flashcard thêm chức năng nhập hàng loạt hình … của trang mở đầu cho tất cả các buổi"* và *"đổi lại cơ chế upload ảnh của trang mở đầu, vẫn có mặt trước mặt sau nhưng chỉ dùng đúng 1 ảnh được up lên để làm cả mặt trước và sau"*.

| ID | Việc | Definition of Done | Trạng thái |
|---|---|---|---|
| COVER-1a | **Trang mở đầu chỉ còn MỘT ảnh** (`…084`) | `back_image_path` của `session_cover` về null, `flashcard_pages_image_kind_check` siết thành *"session_cover ⇒ có front, back null"*. Zod bỏ hẳn khe `back` khỏi nhánh cover (payload cũ bị strip, không lặng lẽ ghi). Renderer vẽ `frontUrl` cho **cả hai** mặt và **không** đọc `backUrl` — kể cả để dự phòng. Cột giữ lại, KHÔNG drop: RPC công khai và helper media của `anon` còn đọc nó (drop = đụng bề mặt `D-36`) | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-29. **Kiểm ngược:** đổi renderer sang `backUrl ?? frontUrl` → đỏ đúng bài *"mặt sau vẽ ĐÚNG ảnh đó"* (fixture cố ý mang `backUrl` khác, vì trên DB đã migrate thì hai nhánh cho kết quả y hệt) |
| COVER-1b | **Dữ liệu cũ bị ÉP về một ảnh** | User chốt sau khi Claude nêu rủi ro. Migration null hoá tham chiếu cho **mọi** trang mở đầu và `raise notice` số hàng. ⛔ **KHÔNG xoá file** — object nằm lại bucket, đó là cửa khôi phục duy nhất; dọn bằng `npm run media:prune-cover-back` (mặc định chạy khô, in danh sách + dung lượng) | ☑ **DONE (local), chờ chạy trên cloud** — Claude 2026-07-29. Script nhận diện mồ côi bằng **ba vế** (tên `back-…` · `pageId` là cover đang sống · không nằm trong `media_paths`) chứ không phải "mọi object không được tham chiếu" — bộ dọn rộng như vậy sẽ xoá đúng file người soạn đang chờ tải xong |
| COVER-1c | **RPC `attach_flashcard_deck_covers`** | Gắn ảnh mở đầu cho nhiều buổi trong MỘT transaction; tạo trang mới ở `order_index = 0` nếu buổi chưa có bìa. Buổi **đã công bố** trả `row_status = skipped_published`, **không ném lỗi**; buổi thuộc **bộ khác** thì huỷ CẢ LƯỢT (vế an ninh). `front_alt` do tầng app tính, RPC không dựng bản SQL thứ hai | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-29. pgTAP `flashcard_deck_covers.test.sql` **23 bài**. **Kiểm ngược:** đổi nhánh `skipped_published` thành `raise exception` → file chết ở **bài 9**, 14 bài sau không chạy — đúng hệ quả "một buổi đã công bố kéo sập cả lượt 35 buổi" |
| COVER-1d | **Bộ ghép file ↔ buổi** | Thuần, unit test phủ. Tên file phải chứa **đúng MỘT dãy số** = số buổi; 0 dãy hoặc ≥2 dãy thì **từ chối, không đoán**. Gán tay thắng ghép tự động và được xử trước. Hai file tranh một buổi → bỏ file sau ra bằng chữ | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-29. 20 bài Vitest. Luật "đúng một dãy số" là để chặn **lệch im lặng**: `05-2026-bia.png` mà lấy dãy đầu sẽ ra buổi 5 rất thuyết phục và SAI |
| COVER-1f | **Forward-fix `…085`: `media_paths` phải tính lại** | `…084` dùng `disable trigger user` để đi vòng qua trigger actor/guard, nhưng nó tắt **MỌI** trigger — kể cả `trg_flashcard_pages_media_paths`. Hệ quả: `back_image_path` về null mà `media_paths` vẫn ôm đường dẫn cũ, mà `share.can_read_public_flashcard_media` xét bằng `media_paths @> array[path]` ⇒ **ảnh mặt sau vẫn đọc được công khai**. `…085` tắt **đích danh** hai trigger cản đường, giữ trigger tổng hợp bật, chạm hàng cho nó tự tính lại, kèm cổng fail-closed đếm đường dẫn không thuộc trang nào | ☑ **DONE + ĐÃ ÁP CLOUD** — Claude 2026-07-29. Đo cloud: 15 → **0** đường dẫn mồ côi; HTML production từ 3 → **0** tham chiếu `back-…`. **Kiểm ngược:** nhét 3 đường dẫn rác vào chỗ bước `update` không chạm ⇒ migration đỏ đúng câu *"còn 3 đường dẫn … không thuộc trang nào"* |
| COVER-1e | **Giao diện cấp bộ** | Nút *Ảnh mở đầu hàng loạt* ở **hàng nút cấp bộ** (cạnh `Thêm buổi`), không nhét vào thanh chọn khoá (trộn hai tầng) và không nhét vào cột trái (vùng điều hướng thuần). Bảng đối chiếu **một hàng mỗi buổi**, nói trước cả kết cục "Đã công bố"; ô Ghi đè mặc định TẮT; xác nhận trước khi xoá ảnh cũ | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-07-29. E2E `20/20` **cả hai project** (19 → +1), axe sạch ở 1280. Ô soạn một trang cũng còn **một** ô ảnh, kèm câu giải thích bền dưới ô |

---

### Role thứ 4 "Giáo vụ" (`academic_manager`) — `GIAOVU-1` (user chốt 2026-08-03 → `D-2`)

User: *"tôi muốn có thêm 1 role là giáo vụ, role này có thể quản lí/phân bổ các giáo viên về các lớp (kể cả bản thân)… có mọi quyền của admin và giáo viên cộng lại chỉ là không có các quyền quản trị như tạo/quản lí tài khoản hay đọc audit"*.

⚠️ **Đổi tên:** ý này từng được ghi ngày 2026-07-18 dưới tên `head_teacher` / "Giáo viên trưởng" và **chưa từng viết một dòng code nào**. Tên đó nay **bỏ hẳn** — dùng `academic_manager`, hiển thị **"Giáo vụ"**. Không để hai tên cùng tồn tại.

**Ba chỗ kiến trúc sẽ vướng, đọc từ source chứ không phải suy đoán:**

1. [`routes.ts:5`](../src/lib/permissions/routes.ts#L5) — *"Mỗi role có đúng một cây route. Không chồng lấn."* Giáo vụ cần **cả hai** cây. `isRoleAllowedOnPath` hiện suy ra quyền từ đúng một prefix, không diễn đạt nổi role này.
2. [`navigation.ts:36`](../src/lib/permissions/navigation.ts#L36) — `Record<UserRole, NavItem[]>` là **danh sách phẳng**, không có khái niệm nhóm. Menu 2 nhánh đòi đổi kiểu dữ liệu, kéo theo `sidebar-nav` + `mobile-nav`.
3. [`app_helpers.sql:70`](../supabase/migrations/20260713000010_app_helpers.sql#L70) — `app.my_teacher_id()` đòi `p.role = 'teacher'`. Không nới thì giáo vụ được phân lớp vẫn bị **mọi** policy giáo viên chặn: menu nhánh 2 hiện ra nhưng trang nào cũng rỗng.

**Bốn điểm user chốt** — xem `D-2` trong [`WORKLOG.md`](../WORKLOG.md) để có cả phần đánh đổi.

| ID | Việc | Definition of Done | Trạng thái |
|---|---|---|---|
| GIAOVU-1a | **Enum + hai helper** | `alter type public.user_role add value 'academic_manager'` (⚠️ Postgres cấm dùng giá trị enum mới trong **cùng** transaction tạo ra nó ⇒ **migration riêng**, không gộp với 1b). `app.is_manager()` = role ∈ {`super_admin`, `academic_manager`} — `security definer`, `set search_path=''`, **không có nhánh `return true`**. `app.my_teacher_id()` nới thành `p.role in ('teacher','academic_manager')`. `app.is_super_admin()` **giữ nguyên nghĩa cũ**, không đổi thành "quản lý" — nó là thứ duy nhất còn canh `audit_logs` và đường ghi `profiles` |☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. `…086` (enum) + `…087` (helper). Enum tách file riêng vì Postgres cấm dùng giá trị enum mới trong cùng transaction tạo ra nó.  ✅ **ĐÃ ÁP CLOUD 2026-08-03** — xác minh bằng `psql`: đỉnh `20260803000088`, `db push --dry-run` = "Remote database is up to date". |
| GIAOVU-1b | **Viết lại RLS quản lý** | Mọi policy `"admin toàn quyền <bảng>"` trong [`…011_rls_policies.sql`](../supabase/migrations/20260713000011_rls_policies.sql) đổi `is_super_admin()` → `is_manager()`, **trừ 2 ngoại lệ giữ nguyên**: `audit_logs` (`:610`) và `profiles` (`:56`). `profiles` được thêm policy **SELECT** riêng cho manager (giáo vụ phải đọc được tên người để dựng danh sách) nhưng **không** có đường ghi nào. `teachers`: manager được SELECT + UPDATE, **INSERT/DELETE vẫn `is_super_admin()`** — đó là chỗ cưỡng chế điểm (4) ở tầng DB chứ không chỉ ẩn nút |☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. Danh sách **đo từ `pg_policies`, không grep**: grep ra danh sách SAI vì đếm cả policy trên `assignments`/`submissions`/`assessments` đã bị Phase 12 xoá. Kết quả: **73 policy** → 42 sang `is_manager()` + 3 policy mới, **31 giữ**. Cổng fail-closed trong migration đối chiếu TRÙNG KHÍT danh sách giữ lại, lệch chiều nào cũng ném lỗi.  ✅ **ĐÃ ÁP CLOUD 2026-08-03** — xác minh bằng `psql`: đỉnh `20260803000088`, `db push --dry-run` = "Remote database is up to date". |
| GIAOVU-1c | **Quét hết 37 file migration còn lại** | `is_super_admin()` nằm rải ở **37 file** (RPC, trigger, storage, các đợt flashcard/assessment/tuition). Mỗi chỗ phải tự quyết định "quản lý" hay "quản trị" — **không** `sed` thay hàng loạt. Kết thúc task phải trả lời được bằng con số: còn bao nhiêu chỗ `is_super_admin()`, và **từng chỗ** vì sao giữ |☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. `…088`, **26/49 hàm** đổi cổng, 23 hàm flashcard/câu hỏi giữ nguyên. Thân hàm là bản **sinh từ `pg_get_functiondef()`** rồi thay đúng một chuỗi — chứng minh được không có thay đổi nào khác lọt vào, điều bản gõ tay 1.530 dòng không chứng minh nổi. Kèm sửa 4 câu lỗi đang nói "Chỉ super admin…".  ✅ **ĐÃ ÁP CLOUD 2026-08-03** — xác minh bằng `psql`: đỉnh `20260803000088`, `db push --dry-run` = "Remote database is up to date". |
| GIAOVU-1d | **Storage policies** | [`…014_storage.sql`](../supabase/migrations/20260713000014_storage.sql) có 16 chỗ. Giáo vụ phải tải lên/xuống được tài liệu khóa–lớp; bucket flashcard thì **không** (điểm 3). ⛔ Không đụng `flashcard_media_public_link_read` — bề mặt `anon` của `D-36` phải giữ nguyên, `rls_catalog_matrix` không được nới |☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03 (làm trong `…087`). 7 policy storage sang `is_manager()` (tài liệu khoá · hồ sơ HV · bài nói), 9 giữ (avatar · flashcard_media · question_media). ⚠️ Bản viết tay đầu tiên **sai bucket và sai tên cột** (`student-docs` vs `student-documents`, `storage_path` vs `object_path`) — phải chép lại từ `pg_policies` đang chạy. `rls_catalog_matrix` vẫn xanh: bề mặt `anon` của `D-36` không bị nới.  ✅ **ĐÃ ÁP CLOUD 2026-08-03** — xác minh bằng `psql`: đỉnh `20260803000088`, `db push --dry-run` = "Remote database is up to date". |
| GIAOVU-1e | **Tầng route** | `types/roles.ts` thêm role + nhãn "Giáo vụ" (xóa luôn comment *"Ba role cố định"* đang sai). `routes.ts` đổi từ **một prefix** sang **nhiều prefix + danh sách chặn**, vẫn fail-closed: path không thuộc prefix nào → từ chối; path thuộc danh sách chặn → từ chối. `homePathForRole('academic_manager')` = `/admin`. Có bài kiểm ghim: giáo vụ vào `/admin/system`, `/admin/flashcards`, `/admin/question-bank-review`, `/student` đều **bị chặn** |☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. `routes.ts` thành nhiều prefix + danh sách chặn, xét CẤM trước CHO PHÉP sau. Thêm `requireManager()` — chốt chặn thật là hàm này ở đầu từng page/action, không phải `isRoleAllowedOnPath` (hàm đó trước nay **chỉ có test gọi**). |
| GIAOVU-1f | **Menu 2 nhánh** | `NavItem[]` thành nhóm có nhãn; `sidebar-nav` + `mobile-nav` render được nhóm. Nhánh *Quản lý* đúng **9 mục** (không Flashcard, không Duyệt câu hỏi, không Quản trị & Audit). Nhánh *Lớp được phân công* **chỉ render khi giáo vụ thật sự có hàng trong `class_teachers`** — đếm từ DB, không suy từ role. Ba role cũ giữ nguyên menu phẳng, không đổi một pixel |☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. `NavGroup` + `getNavigationGroups()`; ba role cũ trả **một nhóm không tiêu đề** nên giao diện không đổi. `hasAssignedClasses` đếm từ `class_teachers`, chỉ tốn round-trip với giáo vụ. |
| GIAOVU-1g | **Server action** | Mọi action quản lý (students/classes/courses/schedules/enrollments/tuition/announcements/reports) nhận thêm giáo vụ. Bốn action tài khoản **chặn thẳng**: `provisionStudentAccountAction`, `createTeacherAction`, `resetTeacherPasswordAction`, `toggleTeacherActiveAction` + cả `accounts/server/actions.ts`. Chặn ở **server action**, không chỉ ẩn nút — RLS là lưới thứ hai, không phải lưới duy nhất |☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. 60 lời gọi `requireRole("super_admin")`: 32 sang `requireManager()`, 28 giữ (accounts · flashcards · public-link · question-bank · invite · 3 action tài khoản của teacher/student). 4 action tài liệu khoá học `("super_admin","teacher")` thêm `academic_manager`. |
| GIAOVU-1h | **Tạo tài khoản giáo vụ** | Trang Quản trị (super admin) tạo được tài khoản role Giáo vụ, và **cùng lúc tạo hàng `teachers`** trong **một** transaction/RPC — điểm (2). Nửa chừng lỗi thì không được để lại profile không có hàng teachers (giáo vụ không tự phân công được cho mình mà không ai hiểu vì sao). Trang Giáo viên phân biệt rõ hàng nào là giáo vụ |☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. Chọn vai trò ngay trên form Giáo viên ⇒ hàng `teachers` được tạo trong CÙNG luồng, điểm (2) đúng theo cấu trúc chứ không nhờ ai nhớ làm thêm bước. 🔴 **Tìm ra và sửa một bug thật cùng lúc:** `resetTeacherPasswordAction` đóng cứng `role:"teacher"` khi gọi `provisionPasswordAccount` (hàm này upsert thẳng cột `role`) ⇒ đổi mật khẩu cho giáo vụ sẽ **hạ họ xuống giáo viên, im lặng**. Có 4 bài Vitest ghim, đã kiểm ngược. |
| GIAOVU-1i | **Bộ kiểm** | pgTAP file mới: giáo vụ **đọc được** dữ liệu quản lý · **KHÔNG** đọc được `audit_logs` · **KHÔNG** ghi được `profiles` · **KHÔNG** insert được `teachers` · tự thêm mình vào `class_teachers` thì được, và sau đó đọc được lớp đó như giáo viên. `rls_catalog_matrix` chạy lại **phải vẫn xanh** (không nới bề mặt `anon`). Cập nhật `seed.dev.sql` thêm 1 giáo vụ demo. Sửa `docs/01` §5, `docs/02` §6, `docs/04` — đang ghi 3 role |☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. pgTAP `academic_manager_role.test.sql` **24 bài**; Vitest +14 (`routes` 10, `navigation` 11, parity 4, teacher-account-role 4). Seed dev thêm `gv.vu@polymind.test` (đăng nhập thật: đúng mk **200**, sai **400**, admin không bị giẫm). Docs 01 §2, 02 §2 + §helper, 04 §cây route đã sửa. |

#### Kết quả xác minh độc lập — Codex 2026-08-03

| ID | Verification | Bằng chứng tự dựng lại |
| --- | --- | --- |
| GIAOVU-1a | **Partially Verified** | Local sạch: enum/helper đúng; `my_teacher_id()` trả `GV000`, `teaches_class()` thành `true`. Kiểm ngược thu helper về role teacher làm đỏ đúng 2/24. Production chưa đo lại do thiếu credential psql hiện hành. |
| GIAOVU-1b | **Failed** | Catalog local đúng 45 policy manager / 31 super admin và các đường audit/profile/teacher cấm đúng; nhưng giáo vụ vẫn đọc câu hỏi `global` và tự tạo `question_sets` qua policy teacher permissive (`GIAOVU-RLS-001`). |
| GIAOVU-1c | **Partially Verified** | 26 thân hàm sinh lại khớp migration tuyệt đối 1.555 dòng/cùng SHA-256; 0 hàm nghiệp vụ còn `is_super_admin`, 23 hàm flashcard/câu hỏi giữ. Header đếm sai 48/22 và 7 lỗi quyền còn nói “Chỉ quản trị viên” (`GIAOVU-MIG-005`). |
| GIAOVU-1d | **Partially Verified** | Catalog local đo đúng storage 7 policy manager / 9 super admin; full pgTAP sạch 651/651. Production chưa đo lại. |
| GIAOVU-1e | **Failed** | Chromium xác nhận ba URL admin bị chặn; nhưng prefix `/teacher` được route layer cho qua trong khi page thật redirect manager về `/admin` (`GIAOVU-ROUTE-002`). |
| GIAOVU-1f | **Failed** | Menu đúng 9 mục quản lý và chỉ hiện nhánh 2 sau assignment, nhưng toàn bộ page trong nhánh 2 không render được cho manager. |
| GIAOVU-1g | **Failed** | Action quản lý chính khớp và JWT ghi được học viên/giáo viên-update/khóa/lớp/lịch/học phí/thông báo; action teacher vẫn chặn manager, report export route trả 403 dù UI bày nút. |
| GIAOVU-1h | **Partially Verified** | Seed tạo giáo vụ có hàng `teachers`, tự phân công được; UI phân biệt và account controls đã xác minh/fault-inject. Chưa tự chạy lại transaction tạo tài khoản mới từ đầu. |
| GIAOVU-1i | **Failed** | Suite sạch đúng 651/651 và app gate 498/498, nhưng test câu hỏi là false negative: chỉ dựng private question và không thử ghi `question_sets`. |

🔴 **Thứ tự release (`D-37`):** đây là thay đổi **mở rộng** quyền ⇒ `db push` **TRƯỚC**, `git push` code sau. Đảo lại thì code mới gọi `app.is_manager()` chưa tồn tại trên cloud ⇒ mọi trang quản lý ném lỗi hàm-không-tồn-tại cho **cả super admin đang dùng thật**.

⚠️ **Việc này chạm RLS của gần như mọi bảng.** `AGENTS.md` cấm ghi "pass" khi chưa chạy — riêng task này, "chạy" nghĩa là chạy đủ bộ pgTAP cũ chứ không chỉ file mới: nới một helper dùng ở 37 chỗ mà chỉ kiểm chỗ mới là bỏ sót đúng phần nguy hiểm.

---

### Thẻ học viên ở trang chi tiết lớp phải gọn lại — `UX-ENROLL-1` (user báo 2026-08-03, kèm 2 ảnh)

**Nguyên văn:** *"ở trang chi tiết lớp học, phần card học viên quá dài, phải roll rất nhìu xuống mới thấy"*.

**Đo được trước khi sửa** (`/admin/classes/12f6221e-…`, lớp 31 học viên đang học): mỗi hàng dựng sẵn 3–4 nút đổi trạng thái + *Chuyển lớp* + nút lịch sử **thẳng trong hàng**. Cột phải rộng `minmax(21rem, .8fr)` không đủ chỗ ⇒ nhóm nút luôn xuống 2–3 dòng ⇒ **~130px/hàng**, cả thẻ **hơn 4.000px** trong khi cột trái đã hết nội dung từ khoảng 900px. Đây là hình dạng lỗi họ hàng với `UX-UIUX-M16-002` (nhóm nút `shrink-0` rộng 516px trong khung 360px), lần này không tràn ngang nhưng tràn **dọc**.

| ID | Việc | Definition of Done | Trạng thái |
|---|---|---|---|
| UX-ENROLL-1a | **Hàng gọn + thao tác vào menu** | Hàng còn 2 dòng (~52px): tên · badge trạng thái đứng đầu dòng 2 để mọi hàng thẳng một cột · mã + ngày. Toàn bộ thao tác vào **một** menu `⋯`; *Rút học* tách sau `Separator` và mang `variant="destructive"`. Hộp thoại dựng **theo yêu cầu** — bản cũ mount ~5 `Dialog`/hàng, mỗi `TransferDialog` còn kèm `Select` liệt kê toàn bộ lớp đích | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03 |
| UX-ENROLL-1b | **Chặn chiều dài, không dùng vùng cuộn lồng** | Hiện sẵn tối đa **8 hàng**, phần còn lại sau nút *Xem thêm N học viên*, mở rồi **thu lại được**. ⛔ Không dùng `max-h` + `overflow-y-auto`: trên điện thoại vùng cuộn lồng nuốt cú vuốt của trang. Đổi bộ lọc / gõ tìm kiếm thì tự thu gọn lại | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03 |
| UX-ENROLL-1c | **Lọc + tìm để khỏi cuộn tay** | Chip *Đang học* / *Đã đóng* (kèm số, `aria-pressed` chứ không chỉ đổi màu nền), mặc định *Đang học* ⇒ ghi danh đã đóng không chen vào danh sách nữa. Ô tìm hiện khi lớp > 8 học viên, **bỏ dấu** để gõ "ngoc dung" ra "Phạm Thị Ngọc Dũng". Thanh sức chứa `aria-hidden` vì con số `31/40` ngay trên đã mang thông tin | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. 3 bài Vitest, **kiểm ngược**: bỏ chặn 8 hàng ⇒ đỏ đúng 2 bài, bài menu vẫn xanh |

⚠️ **Không đụng nghiệp vụ:** `allowedEnrollmentTransitions` · `canTransferEnrollment` · 3 server action giữ nguyên. Đây thuần là đổi chỗ đặt nút và chặn số hàng hiện sẵn.

📏 **Đo thật ở phiên 92** (Chromium, lớp 26 học viên): trang **5.078px → 1.237px** ở 1280×900 (5,6 → **1,4 màn**), thẻ học viên **639px**; ở 375×800 **6.350px → 2.509px** (7,9 → **3,1 màn**). `horizontalOverflow = 0` cả bốn phép đo. Con số "hơn 4.000px" ghi lúc chưa đo là **ước lượng thấp**.

---

### Trang Học viên gom theo lớp + ô tìm — `UX-STUDENTS-1` (user báo 2026-08-03, kèm ảnh)

**Nguyên văn:** *"học viên mà quá nhiều sẽ bị loạn, chia ra thành thành nhiều lớp (mục) để dễ xem, có thanh tìm kiếm, nói chung thiết kế lại cho đẹp, và tiện xem hơn"*.

**Đo được trước khi sửa** (`/admin/students`, 57 học viên): 57 hàng đổ thẳng vào **một** bảng phẳng — **3.802px** ở 1280×900 (4,2 màn) và **3.838px** ở 375×800 (4,8 màn). Không có ô tìm; muốn biết ai thuộc lớp nào phải dò từng dòng cột *Lớp đang học*; hồ sơ đã lưu trữ bị lọc thẳng ở page nên **không có đường nào xem lại**.

| ID | Việc | Definition of Done | Trạng thái |
|---|---|---|---|
| UX-STUDENTS-1a | **Gom theo lớp, thu gọn sẵn** | Mỗi lớp một mục có tiêu đề bấm được (`aria-expanded` + `aria-controls`), hiện mã lớp · tên lớp · số học viên · số người chưa có tài khoản. Mục cuối *Cần xếp lớp* gom người không có ghi danh `active` — **phải hiện ra**, đó chính là việc còn tồn. Nút *Mở rộng / Thu gọn tất cả* | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. Đo thật: **3.802px → 900px** ở 1280 (4,2 → **1,0 màn**) |
| UX-STUDENTS-1b | **Ô tìm bỏ dấu, lọc tại chỗ** | Gõ tới đâu lọc tới đó, **tự mở** mục có kết quả (giấu kết quả sau mục thu gọn là bắt tìm hai lần). Khớp mã · họ tên · SĐT · email · **tên và SĐT người giám hộ** · tên đăng nhập. Không khớp gì thì nói rõ + nút xoá từ khoá. `aria-live` báo số kết quả cho trình đọc màn hình | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. ⚠️ Lọc ở **trình duyệt** vì `getStudents()` không phân trang; lên hàng nghìn học viên thì chuyển sang `getStudents({ search })` — hàm đó đã nhận sẵn tham số |
| UX-STUDENTS-1c | **Ba ô số liệu + chip lưu trữ** | Đang hoạt động (kèm số lớp) · Chưa xếp lớp · Chưa có tài khoản. Số lớp đếm trên **toàn bộ** phạm vi chứ không trên kết quả tìm — hai con số cạnh nhau phải cùng một phạm vi. Chip *Đã lưu trữ* mở lại đường xem hồ sơ đã ẩn | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. 5 bài Vitest, **kiểm ngược 2/2**: `isOpen` luôn `true` ⇒ đỏ 2 bài; bỏ `fold()` ⇒ đỏ bài tìm không dấu |
| UX-STUDENTS-1d | **Sửa hai lỗi bố cục chỉ trình duyệt mới thấy** | (1) Ba ô số liệu xếp dọc dưới 640px chiếm ~340px, đẩy ô tìm xuống dưới mép màn ⇒ `grid-cols-3` từ 0px, ẩn dòng gợi ý. (2) Ở 375px chuỗi "25 học viên · 23 chưa có tài khoản" là `shrink-0` nên **tên lớp bị cắt còn 0 ký tự** ⇒ đưa con số xuống dòng dưới tên khi hẹp | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. Đo lại sau khi sửa: 375px **1.078px → 896px**. 🔴 Lỗi (2) là lần **thứ ba** cùng một hình dạng (`UX-UIUX-M16-002`, `UX-ENROLL-1`): `shrink-0` cạnh `min-w-0 flex-1` thì khối co được sẽ co tới 0 |

⚠️ **Không đụng nghiệp vụ:** `getStudents()` · `StudentRowActions` · cờ `canManageAccounts` giữ nguyên. Page rút còn 34 dòng: lấy dữ liệu + gác quyền, không tự dựng bảng.

---

### Nút Hủy/Xóa buổi tràn ra ngoài thẻ ở lưới tuần — `UX-SCHED-1` (user báo 2026-08-03, kèm 3 ảnh)

**Nguyên văn:** *"ở trang lịch học của tài khoản admin, càng zoom web nút hủy buổi và xóa buổi càng lệch… dao diện laptop đến điện thoại đều bị lỗi này, nhưng giao diện pc không sao"*.

**Đo được trước khi sửa** (`/admin/schedule`, kiểu xem *Tuần*): không phải "lệch" mà là **tràn**. Chân thẻ `WeekSessionCard` là một hàng cứng `flex items-end justify-between` mà **cả hai con đều không co được** — badge trạng thái `w-fit shrink-0 whitespace-nowrap` (~101px) và cụm nút `shrink-0` (84px chuột / 96px cảm ứng). Cần ~189px, trong khi lòng thẻ chỉ có `cột − 34px` ⇒ **chỉ vừa khi cột ≥223px ⇔ lưới ≥1561px**, đúng một mình màn PC rộng. Tràn phải đo bằng Chromium: **1440px `-9` · 1280px `+10` · 1024px `+46` · 768/430/360px `+68` · Pixel 7 `+76`** — khớp chính xác ảnh user gửi (nút xóa nằm hẳn sang cột bên cạnh).

| ID | Việc | Definition of Done | Trạng thái |
|---|---|---|---|
| UX-SCHED-1a | **Chân thẻ cho xuống hàng** | `flex-wrap` + `justify-end` + `mr-auto` trên badge: cột rộng thì badge trái / nút phải như cũ, cột hẹp thì cụm nút **xuống hàng dưới** và vẫn canh phải. ⛔ Không dùng `justify-between` — nó chỉ chia chỗ thừa, không cứu được khi thiếu chỗ | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. Tràn phải **`-9px` ở cả 6 bề rộng + Pixel 7** (`-9` = đúng mép padding của thẻ) |
| UX-SCHED-1b | **Cột tuần đủ rộng cho một thẻ** | `min-w-[840px]` → `min-w-[1050px]` (120px/cột → **150px/cột** ⇒ lòng thẻ 116px). Con số lấy từ phần rộng nhất của thẻ chứ không làm tròn cho đẹp: badge 101px và cụm nút 96px (cảm ứng) đều phải nằm lọt | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. Ở 840px cũ lòng thẻ chỉ 86px ⇒ **badge cũng tràn** (`-20px` mới là vừa, đo được `+68`) |
| UX-SCHED-1c | **Giãn hai nút phá hủy** | `gap-1` → `gap-2`: *Hủy buổi* và *Xóa buổi* nằm sát nhau, 4px là khoảng cách bấm nhầm — WCAG/HIG đòi ≥8px giữa hai touch target | ☑ **DONE, chờ xác minh độc lập** — Claude 2026-08-03. Pixel 7: nút **44×44**, cách nhau **8px** |

⚠️ **Không đụng nghiệp vụ:** `cancelSessionAction` · `deleteSessionAction` · điều kiện `canDelete`/`canCancel` giữ nguyên — chỉ đổi class CSS. `SessionCalendar` dùng chung cho cả ba mode `admin|teacher|student` nên thay đổi có mặt ở cả trang giáo viên và học viên.

⚠️ **Cách đo, ghi cho đúng:** không đăng nhập được vào app local (**`auth.users` rỗng**) và `next dev` chết vì máy hết paging file, nên số đo lấy trên **trang tĩnh dựng từ chính `src/app/globals.css` đã biên dịch** + đúng chuỗi class của component, chạy Chromium/Playwright ở 1440/1280/1024/768/430/360 và Pixel 7. Đây là bằng chứng về **bố cục CSS**, chưa phải ảnh chụp trên app thật — người xác minh nên seed lại DB local rồi chụp trên `/admin/schedule`.

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
