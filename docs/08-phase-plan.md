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
4. Xong: chạy đủ **Definition of Done** của task → cập nhật `WORKLOG.md` (trạng thái, nhật ký, next action) → commit.
5. Không xong: ghi **blocker thật** vào `WORKLOG.md`, để task ở trạng thái `đang dở`, mô tả chính xác đang dở ở đâu.

**Ba điều tuyệt đối không được làm:**
- ❌ Ghi "pass / done / verified / deployed" khi **chưa chạy thật**.
- ❌ Sửa test cho nó xanh thay vì sửa code.
- ❌ Ghi đè thay đổi của agent kia ở file ngoài scope task của mình.

**Ký hiệu trạng thái:** `☐` chưa làm · `◐` đang dở · `☑` xong (đã chạy DoD) · `⛔` blocked

---

## Phase 0 — Khảo sát & đặc tả

**Gate:** docs không mâu thuẫn; phân biệt đúng Course / Class / Session.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P0-T1 | Khảo sát repo XKLĐ (read-only) | Đã đọc source, QA board, docs, WORKLOG cũ. Repo cũ **không bị sửa** (`git status` sạch) | ☑ |
| P0-T2 | Tạo repo mới + git init | `Documents\Polymind Chinese`, branch `main`, `.gitignore` | ☑ |
| P0-T3 | docs 01–04 | BA, DB design (ERD + RLS matrix), workflow, architecture | ☑ |
| P0-T4 | docs 05–07 + QA board | testing strategy, deployment, backlog, `docs/testing/MODULE_QA_BOARD.md` | ☑ |
| P0-T5 | Bộ phối hợp AI | `WORKLOG.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `.env.example`, file này | ☑ |
| P0-T6 | Commit Phase 0 | Commit đầu tiên trên `main` | ☑ |

---

## Phase 1 — Scaffold & nền tảng

**Gate:** 3 role login → redirect đúng khu vực; anonymous bị chặn; CI xanh.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P1-T1 | Scaffold Next.js | App Router, TS `strict`, npm, ESLint + Prettier. `npm run build` xanh | ☐ |
| P1-T2 | UI stack | Tailwind + shadcn/ui + Lucide + font Be Vietnam Pro (fallback CJK). Theme POLYMIND (primary xanh, đỏ chỉ là accent) | ☐ |
| P1-T3 | Test stack | Vitest + RTL + Playwright config. 1 smoke test mỗi loại chạy được | ☐ |
| P1-T4 | Supabase local | `supabase init` + `config.toml` + `npx supabase start` chạy được trên Docker | ☐ |
| P1-T5 | 3 Supabase client | `lib/supabase/{client,server,admin}.ts`. `admin.ts` có `import 'server-only'` | ☐ |
| P1-T6 | Auth SSR | login / forgot-password / reset-password / accept-invite + `middleware.ts` (dùng `getUser()`, **không** `getSession()`) + guard theo role | ☐ |
| P1-T7 | App shell 3 role | Sidebar desktop + bottom nav mobile (4–5 mục), menu đúng đặc tả §16 | ☐ |
| P1-T8 | CI | GitHub Actions: lint + typecheck + unit test + build | ☐ |

---

## Phase 2 — Schema, RLS & seed

**Gate:** `supabase db reset` sạch · seed idempotent (chạy 2 lần không nhân đôi) · **pgTAP RLS tests pass**.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P2-T1 | Migration: enum + danh tính | Toàn bộ enum type; `profiles`, `teachers`, `students`; trigger `set_updated_at()` | ☐ |
| P2-T2 | Migration: chương trình | `levels`, `courses`, `course_modules`, `lessons`, `course_materials` | ☐ |
| P2-T3 | Migration: lớp & lịch | `classes`, `class_teachers` (+ partial unique 1 primary), `class_schedules`, `class_sessions` | ☐ |
| P2-T4 | Migration: ghi danh | `enrollments` (UNIQUE `student_id,class_id`), `enrollment_status_history` (append-only) | ☐ |
| P2-T5 | Migration: điểm danh & tiến độ | `attendance_records` (UNIQUE `session_id,enrollment_id`) + trigger class-match; `lesson_progress` | ☐ |
| P2-T6 | Migration: bài tập | `assignments`, `assignment_attachments`, `submissions`, `submission_files` + trigger `score ≤ max_score` | ☐ |
| P2-T7 | Migration: kiểm tra & đánh giá | `assessments`, `assessment_results`, `grading_scale_rules` (EXCLUDE chống chồng ngưỡng), `learning_evaluations`, `student_notes` | ☐ |
| P2-T8 | Migration: học phí | `tuition_invoices`, `tuition_invoice_items`, `tuition_payments`, `tuition_receipts` (**UNIQUE `payment_id`**) | ☐ |
| P2-T9 | Migration: thông báo & audit | `announcements`, `notifications` (partial unique dedupe), `notification_preferences`, `audit_logs` | ☐ |
| P2-T10 | Helper functions schema `app` | 9 hàm RLS, `SECURITY DEFINER`, `SET search_path=''`, **fail-closed** (không nhánh `return true`) | ☐ |
| P2-T11 | RLS policies | **Mọi bảng** `ENABLE RLS`. Đúng ma trận docs/02 §6. `anon` deny toàn bộ | ☐ |
| P2-T12 | Views | 5 view, `security_invoker = true` | ☐ |
| P2-T13 | RPC | 8 RPC transaction (docs/02 §8), kiểm quyền ở dòng đầu, revoke `PUBLIC`/`anon` | ☐ |
| P2-T14 | Storage | 5 private bucket + policy soi đúng class/student | ☐ |
| P2-T15 | Seed | `seed.sql`: HSK 1–6, grading scale, catalog cốt lõi, 2 chương trình VCB, `LOP-01/02/03` (LOP-01 **không** có lịch lặp). `seed.dev.sql`: user demo (danh tính giả) | ☐ |
| P2-T16 | pgTAP RLS/IDOR tests | Anonymous deny · Student A ≠ Student B · teacher ngoài lớp · teacher đọc tuition/audit · student sửa điểm | ☐ |
| P2-T17 | Generate types | `types/database.ts` từ `supabase gen types` | ☐ |

---

## Phase 3 — Academic admin core

**Gate:** super admin đi trọn Course → Class → Schedule → sinh buổi → gán GV → Enrollment.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P3-T1 | Layout admin + dashboard skeleton | 10 mục menu §16 | ☐ |
| P3-T2 | CRUD Level + Course + Module + Lesson | List/detail/form, validate Zod | ☐ |
| P3-T3 | Course materials | Upload private bucket, signed URL, `visibility` | ☐ |
| P3-T4 | CRUD Teacher + invite | Hồ sơ + gửi invite (admin client, server-only) | ☐ |
| P3-T5 | CRUD Student + invite | Hồ sơ (tạo trước, invite sau), guardian là **field**, không phải role | ☐ |
| P3-T6 | CRUD Class + phân công GV | Sĩ số, hình thức, địa điểm tự do, GV chính/trợ giảng | ☐ |
| P3-T7 | Schedule + sinh buổi học | UI lịch lặp + nút sinh buổi (idempotent) + hỗ trợ **lớp linh hoạt không lịch** | ☐ |
| P3-T8 | Enrollment lifecycle | Ghi danh / tạm dừng / chuyển lớp / rút / hoàn thành — qua RPC, giữ history | ☐ |
| P3-T9 | Admin dashboard | KPI thật từ view (§15) | ☐ |
| P3-T10 | Unit test domain | Recurrence 35 buổi · capacity · enrollment transitions | ☐ |

---

## Phase 4 — Teacher operations

**Gate:** teacher **không** truy cập được lớp ngoài scope qua UI, direct URL, server action **và** Supabase client trực tiếp.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P4-T1 | Dashboard "Hôm nay" | Lịch dạy, buổi chưa điểm danh, bài chờ chấm, HV cần chú ý. Vào lớp/buổi trong **1–2 thao tác** | ☐ |
| P4-T2 | Class detail (tabs) | Tổng quan · Lịch/Buổi · Học viên · Điểm danh · Bài tập · Kiểm tra · Tiến độ · Tài liệu | ☐ |
| P4-T3 | Session log | Mở/hoàn tất buổi, nội dung thực dạy, lesson progress | ☐ |
| P4-T4 | **Attendance roster** | Một màn hình, nút lớn, chọn hàng loạt, nút Lưu **sticky**. Bấm 2 lần không sinh trùng | ☐ |
| P4-T5 | Assignment | CRUD + attachment + publish (draft ≠ publish) | ☐ |
| P4-T6 | Chấm bài | Xem bài nộp (text/file) + điểm + feedback | ☐ |
| P4-T7 | Assessment | Tạo bài KT, nhập điểm tổng + 6 kỹ năng, draft → publish (RPC) | ☐ |
| P4-T8 | Đánh giá & ghi chú | `learning_evaluations` + `student_notes` (`staff_only` HV **không đọc được**) | ☐ |
| P4-T9 | Teacher reports | Chỉ lớp mình dạy | ☐ |
| P4-T10 | Tests | Component + RLS negative (teacher lớp khác) | ☐ |

---

## Phase 5 — Student portal

**Gate:** student **không** thấy bất kỳ dữ liệu học viên khác; submission end-to-end pass.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P5-T1 | Dashboard | Buổi kế tiếp, deadline, chuyên cần, điểm mới, học phí sắp hạn | ☐ |
| P5-T2 | Lịch học + tài liệu | Buổi học + tài liệu đã publish | ☐ |
| P5-T3 | Chuyên cần cá nhân | Chỉ của mình | ☐ |
| P5-T4 | Nộp bài | Text + file upload, trạng thái đúng hạn/muộn | ☐ |
| P5-T5 | Kết quả & tiến độ | Chỉ bản **đã publish** + đánh giá `visible_to_student` | ☐ |
| P5-T6 | Hồ sơ + đổi mật khẩu + thông báo | Không sửa được `role`/`is_active` | ☐ |
| P5-T7 | Tests | E2E nộp bài; negative: xem lớp/HV khác | ☐ |

---

## Phase 6 — Tuition, notifications & reports

**Gate:** finance self-scope đúng · **teacher không đọc được tuition** · export giữ đúng filter.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P6-T1 | Invoice | CRUD + items + phát hành | ☐ |
| P6-T2 | Payment + Receipt | Qua RPC `record_tuition_payment` → **đúng 1 receipt** | ☐ |
| P6-T3 | Học phí (student view) | Chỉ của mình; **không** tự ghi nhận thanh toán | ☐ |
| P6-T4 | Notifications in-app | Chuông + danh sách + preferences + link có authorization | ☐ |
| P6-T5 | Announcements | Toàn hệ thống / theo lớp, một chiều | ☐ |
| P6-T6 | Cron | 3 route + `CRON_SECRET` + `dedupe_key` | ☐ |
| P6-T7 | Reports + Export | CSV/XLSX **giữ đúng filter/date range đang chọn** | ☐ |
| P6-T8 | Audit log viewer | Chỉ super admin | ☐ |
| P6-T9 | Tests | Integration: payment → 1 receipt (kể cả gọi đồng thời) | ☐ |

---

## Phase 7 — Hardening & deploy

**Gate:** đạt toàn bộ Definition of Done ở đặc tả §21.

| ID | Task | Definition of Done | Trạng thái |
|---|---|---|---|
| P7-T1 | Security review | IDOR, upload abuse, rate limit, path traversal | ☐ |
| P7-T2 | pgTAP full matrix | Đủ SELECT/INSERT/UPDATE/DELETE + RPC + Storage cho 3 role | ☐ |
| P7-T3 | E2E 3 role | 6 kịch bản ở `05-testing-strategy.md` | ☐ |
| P7-T4 | A11y + responsive | WCAG AA, touch target 44px, keyboard nav | ☐ |
| P7-T5 | Production build | `npm run build` với env hợp lệ | ☐ |
| P7-T6 | Deploy docs | Backup/restore + rollback + migration rehearsal | ☐ |
| P7-T7 | Deploy cloud | ⛔ **BLOCKED — chưa có credential Supabase/Vercel.** Không được ghi "đã deploy" khi chưa deploy | ⛔ |

---

## Bản đồ module ↔ phase (dùng cho QA board)

| Module | Tên | Sinh ra ở phase |
|---|---|---|
| M01 | Authentication & Session | P1 |
| M02 | Authorization & RLS | P2 |
| M03 | User & Account Management (invite) | P1, P3 |
| M04 | Students | P3 |
| M05 | Teachers | P3 |
| M06 | Courses & Curriculum | P3 |
| M07 | Classes | P3 |
| M08 | Schedules & Sessions | P3, P4 |
| M09 | Enrollments | P3 |
| M10 | Attendance | P4 |
| M11 | Assignments & Submissions | P4, P5 |
| M12 | Assessments & Evaluations | P4 |
| M13 | Progress & Completion | P4, P5 |
| M14 | Tuition | P6 |
| M15 | Notifications & Announcements | P6 |
| M16 | Reports & Export | P6 |
| M17 | Dashboards | P3, P4, P5 |
| M18 | Storage & Files | P2, P4, P5 |
| M19 | Audit Log | P6 |
| M20 | Security & Deployment | P7 |
