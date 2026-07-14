# 04 — Kiến trúc hệ thống

> Mô tả kiến trúc **thật** của POLYMIND CHINESE. Không copy tài liệu legacy: ở đây **không có** .NET, Blazor, EF Core, NestJS, Hangfire, MinIO hay Docker Compose production.

---

## 1. Tổng quan

```text
┌──────────────────────────────────────────────────────────┐
│  Trình duyệt (mobile-first, tiếng Việt)                   │
│  React Server Components + Client Components (Tailwind)   │
└───────────────┬──────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼──────────────────────────────────────────┐
│  VERCEL — Next.js App Router (Node runtime)               │
│                                                           │
│  • RSC (read path)      → Supabase server client (RLS)    │
│  • Server Actions       → mutation nội bộ (RLS)           │
│  • Route Handlers       → export, health, cron            │
│  • middleware.ts        → refresh session + guard route   │
│                                                           │
│  Chỉ ở đây mới có SUPABASE_SERVICE_ROLE_KEY               │
│  (admin client: invite user, khóa tài khoản, đổi role)    │
└───────────────┬──────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────┐
│  SUPABASE                                                 │
│  • Auth (email/password, invite, reset)                   │
│  • PostgreSQL + RLS trên MỌI bảng  ← chốt chặn cuối       │
│  • Storage (5 private bucket, signed URL)                 │
│  • Cron (nhắc lịch, đánh dấu hóa đơn quá hạn)             │
└──────────────────────────────────────────────────────────┘
```

**Nguyên tắc kiến trúc số 1:** RLS ở database là **chốt chặn cuối cùng**, không phải lớp trang trí. Nếu server có bug, RLS vẫn phải chặn. Mọi tính năng đều được thiết kế với giả định "server sẽ có lúc sai".

---

## 2. Stack

| Lớp             | Công nghệ                                                           | Ghi chú                                   |
| --------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| Framework       | **Next.js (App Router)**                                            | RSC cho read, Server Actions cho mutation |
| Ngôn ngữ        | **TypeScript `strict`**                                             | `strict: true`, không `any` tùy tiện      |
| UI              | **Tailwind CSS + shadcn/ui + Lucide**                               |                                           |
| Form            | **React Hook Form + Zod**                                           | Zod schema dùng chung client ↔ server     |
| Bảng            | **TanStack Table**                                                  | Danh sách lớn (roster, học viên)          |
| Chart           | **Recharts**                                                        | Dashboard/report                          |
| Ngày giờ        | **date-fns** (+ `date-fns-tz`)                                      | Quy đổi UTC ↔ `Asia/Ho_Chi_Minh`          |
| Auth/DB/Storage | **Supabase** (`@supabase/ssr`)                                      |                                           |
| Test            | **Vitest + React Testing Library + Playwright + pgTAP**             |                                           |
| Package manager | **npm** (lockfile commit)                                           |                                           |
| Deploy          | **Vercel** (frontend + serverless) · **Supabase** (Auth/DB/Storage) |                                           |

**Không có backend riêng.** Không NestJS, không Express, không worker luôn chạy. Việc định kỳ dùng Supabase Cron hoặc Vercel Cron gọi Route Handler có `CRON_SECRET`.

**Runtime:** Node (không ép Edge). Middleware chạy Edge nhưng chỉ làm refresh session + guard route — không đụng nghiệp vụ.

---

## 3. Ba Supabase client — không được dùng lẫn

| Client      | File                     | Dùng ở đâu                        | Key                        | RLS               |
| ----------- | ------------------------ | --------------------------------- | -------------------------- | ----------------- |
| **Browser** | `lib/supabase/client.ts` | Client Component                  | publishable                | ✅ áp dụng        |
| **Server**  | `lib/supabase/server.ts` | RSC, Server Action, Route Handler | publishable + cookie phiên | ✅ áp dụng        |
| **Admin**   | `lib/supabase/admin.ts`  | **Chỉ** server action admin-only  | **service role**           | ❌ **bypass RLS** |

Quy tắc sống còn:

1. `lib/supabase/admin.ts` bắt đầu bằng `import 'server-only'`. Import nhầm vào Client Component → **build fail** (đúng như mong muốn).
2. **Không bao giờ** dùng admin client để phục vụ request thường của teacher/student. Làm vậy là vô hiệu hóa toàn bộ RLS — đúng cái bẫy đã sập ở hệ cũ.
3. Admin client chỉ cho: mời user, khóa/mở tài khoản, đổi role, seed. Đếm được trên đầu ngón tay.
4. `SUPABASE_SERVICE_ROLE_KEY` **không bao giờ** có tiền tố `NEXT_PUBLIC_`.

---

## 4. Auth SSR

Theo hướng dẫn chính thức của `@supabase/ssr` (cookie-based, không localStorage).

```text
middleware.ts
  → supabase.auth.getUser()      ← LUÔN dùng getUser(), KHÔNG dùng getSession()
                                    (getSession đọc cookie chưa verify — không tin được)
  → chưa đăng nhập → redirect /login
  → is_active = false → sign out + redirect /login?disabled=1
  → đọc role từ profiles → guard prefix route:
        /admin/*    → super_admin
        /teacher/*  → teacher
        /student/*  → student
```

**Middleware chỉ là lớp UX.** Mỗi Server Action và Route Handler **vẫn phải tự kiểm quyền**, và RLS **vẫn** chặn ở DB. Ba lớp, không lớp nào được coi là đủ một mình.

**Nguồn phân quyền là bảng `profiles`**, không phải `user_metadata` (client sửa được).

**Cache:** trang authenticated **không** ISR/`force-static`. Dùng `export const dynamic = 'force-dynamic'` (hoặc `revalidate = 0`) cho mọi trang trong `(dashboard)` — tránh rò session giữa các user qua cache.

---

## 5. Cấu trúc source

```text
src/
├─ app/
│  ├─ (auth)/                    login, forgot-password, reset-password, accept-invite
│  ├─ (dashboard)/
│  │  ├─ admin/                  super_admin
│  │  ├─ teacher/                teacher
│  │  └─ student/                student
│  ├─ api/
│  │  ├─ health/                 GET — không lộ secret/schema
│  │  ├─ cron/                   yêu cầu CRON_SECRET
│  │  └─ export/                 CSV/XLSX — giữ đúng filter đang chọn
│  └─ auth/                      callback, confirm (Supabase Auth)
├─ features/                     ★ nghiệp vụ nằm ở đây
│  └─ <feature>/
│     ├─ server/                 queries.ts · actions.ts · service.ts  ('server-only')
│     ├─ components/             UI của feature
│     └─ schema.ts               Zod — dùng chung client ↔ server
├─ components/  ui/ · layout/ · shared/
├─ lib/         supabase/ · auth/ · permissions/ · validation/ · dates/ · domain/
└─ types/       database.ts (generate từ Supabase — KHÔNG viết tay)
```

`features/*`: `users · students · teachers · courses · classes · schedules · enrollments · attendance · assignments · assessments · progress · tuition · notifications · reports · audit`

### Quy tắc code (rút từ sai lầm của hệ cũ)

1. **Page/Component không chứa query + mutation dài hàng trăm dòng.** Hệ cũ có `CandidateDetail.razor` > 2.000 dòng trộn UI, query, quyền, mutation — không ai bảo trì nổi. Ở đây: page **gọi** `features/*/server`, không tự viết SQL.
2. **Business rule thuần nằm ở `lib/domain/`** (tính chuyên cần, sinh recurrence, xếp loại, số dư hóa đơn) — hàm thuần, **có unit test**, không phụ thuộc DB.
3. **Mutation nhiều bảng → RPC PostgreSQL**, không phải nhiều lệnh insert tuần tự ở JS (không có transaction, hỏng giữa chừng là dữ liệu rác).
4. **Một hành động = một đường ghi.** Đừng để 3 chỗ cùng set trạng thái theo 3 cách khác nhau (hệ cũ: 3 đường set `Payment → Paid`, lệch nhau → thiếu hoa hồng). Mọi đường vào phải gọi **cùng một service**.
5. **`types/database.ts` generate từ Supabase** (`supabase gen types typescript`). Không tự bảo trì type DB bằng tay.
6. **Attribution = actor thật.** `created_by`/`marked_by`/`recorded_by` lấy từ `auth.uid()` của người đang đăng nhập, **không** lấy "user đầu tiên tìm thấy".

---

## 6. Data flow

**Read (RSC):**

```text
Page (RSC, async)
  → features/x/server/queries.ts  → createServerClient() → PostgREST → RLS lọc
  → trả về data đã được RLS lọc sẵn
  → render
```

RLS đã lọc → không cần `WHERE user_id = ...` thủ công. Nhưng **vẫn thêm** filter tường minh cho rõ ý và cho index — RLS là chốt chặn, không phải cái cớ để viết query mơ hồ.

**Mutation (Server Action):**

```text
'use server'
  1. Xác thực: getUser() → chưa login → throw
  2. Kiểm quyền ở server (lib/permissions) — KHÔNG tin UI đã ẩn nút
  3. Validate input bằng Zod (cùng schema với client)
  4. Gọi RPC (nếu nhiều bảng) hoặc query (nếu một bảng)
     → RLS vẫn chặn ở DB nếu bước 2 có lỗ
  5. Ghi audit_logs
  6. revalidatePath() / revalidateTag()
```

**Kiểm quyền 3 lớp** — mỗi lớp đều giả định lớp trước có thể sai:

| Lớp              | Chặn cái gì                      | Nếu chỉ có lớp này  |
| ---------------- | -------------------------------- | ------------------- |
| UI (ẩn menu/nút) | Người dùng bình thường bấm nhầm  | ❌ Gõ URL là vào    |
| Server Action    | Request giả mạo, URL trực tiếp   | ⚠️ Bug logic là lọt |
| **RLS (DB)**     | **Mọi thứ, kể cả server có bug** | ✅ Chốt chặn cuối   |

---

## 7. Transaction & idempotency

Mutation nhiều bảng **phải** là RPC PostgreSQL (`SECURITY DEFINER`, `SET search_path = ''`, kiểm quyền ở dòng đầu):

`enroll_student` · `transfer_enrollment` · `change_enrollment_status` · `bulk_mark_attendance` · `generate_class_sessions` · `save_session_log` · `publish_assignment` · `close_assignment` · `grade_submission` · `save_assessment_result` · `publish_assessment_results` · `publish_evaluation` · `record_tuition_payment` · `admin_invite_user`

**Idempotency được cưỡng chế ở DB, không ở app** (app-level check luôn thua race condition — bài học từ lỗi trả hoa hồng 2 lần ở hệ cũ):

| Thao tác            | Chốt chặn ở DB                                                 |
| ------------------- | -------------------------------------------------------------- |
| Điểm danh hàng loạt | UNIQUE `(session_id, enrollment_id)` + `ON CONFLICT DO UPDATE` |
| Sinh buổi học       | UNIQUE `(class_id, session_number)` + `ON CONFLICT DO NOTHING` |
| Ghi nhận thanh toán | UNIQUE `tuition_receipts.payment_id` → **đúng 1 phiếu thu**    |
| Ghi danh vượt sĩ số | `SELECT ... FOR UPDATE` trên `classes` trong transaction       |
| Cron sinh thông báo | UNIQUE partial `(user_id, dedupe_key)`                         |
| Nhập điểm bài KT    | UNIQUE `(assessment_id, enrollment_id)` + `ON CONFLICT DO UPDATE` |

---

## 8. Storage

5 bucket **private**: `avatars` · `course-materials` · `assignment-files` · `submissions` · `student-documents`.

```text
Upload:   client → server action (validate MIME/size/ext)
          → server SINH object_path: {class_id}/{entity_id}/{uuid}.{ext}
          → upload qua server client
          → lưu metadata vào DB (cùng transaction với entity)

Download: server action kiểm quyền → tạo signed URL (TTL ≤ 5 phút) → trả về client
```

- **`object_path` do server sinh.** Không tin path client gửi lên (path traversal).
- Storage policy soi **cùng điều kiện class/student như DB**, không chỉ `auth.uid() IS NOT NULL`.
- File đề bài draft không chỉ ẩn metadata: policy `assignment-files` bắt buộc metadata trỏ đúng object và assignment đã `published_at`; đoán object path cũng không đọc được.
- **Không log signed URL đầy đủ** (nó là credential tạm thời).

---

## 9. Cron

Vercel Cron gọi Route Handler; xác thực bằng header `Authorization: Bearer ${CRON_SECRET}` — thiếu/sai → **401**.

| Route                         | Tần suất  | Việc                                              |
| ----------------------------- | --------- | ------------------------------------------------- |
| `/api/cron/session-reminders` | Hằng ngày | Nhắc buổi học sắp tới                             |
| `/api/cron/assignment-due`    | Hằng ngày | Nhắc bài tập sắp hết hạn (chỉ người **chưa nộp**) |
| `/api/cron/invoice-overdue`   | Hằng ngày | Đánh dấu hóa đơn quá hạn + thông báo              |

Mọi job dùng `dedupe_key` → chạy lại không spam. **Không worker luôn chạy trong process** (không Hangfire).

---

## 10. Logs & observability

- Dùng **Vercel logs** + **Supabase logs**. **Không ghi rolling file** trong production.
- **Không log:** PII, token, mật khẩu, signed URL đầy đủ, nội dung bài nộp.
- `/api/health` tối giản: `{ status, timestamp }` — **không lộ** version, schema, biến môi trường.

---

## 11. Deploy

```text
Pull Request  → Vercel Preview  (env Preview riêng)
merge → main  → Vercel Production
```

**Migration chạy qua Supabase CLI trong CI, TRƯỚC khi deploy app.** Không migration lúc app startup.

| Môi trường | Supabase                      | Vercel                        |
| ---------- | ----------------------------- | ----------------------------- |
| Local      | `npx supabase start` (Docker) | `npm run dev`                 |
| Preview    | Supabase staging (khi có)     | Vercel Preview                |
| Production | Supabase production           | Vercel Production (từ `main`) |

Vercel Function region đặt **gần Supabase region** (ưu tiên Singapore `sin1` cho user Việt Nam).

**Trạng thái hiện tại:** chưa có credential Supabase/Vercel → **local-first**. Xem `BLOCKERS` trong `WORKLOG.md`. Không được ghi "đã deploy" khi chưa deploy.

---

## 12. Backup & rollback

**Backup DB và backup Storage là HAI phạm vi riêng.** Backup PostgreSQL **không** bao gồm object trong Storage. Phải sao lưu riêng, tài liệu phải nói rõ điều này.

| Rủi ro                      | Cách xử lý                                                                    |
| --------------------------- | ----------------------------------------------------------------------------- |
| Migration hỏng ở production | **Forward-fix**: viết migration mới sửa lại. **Không** sửa migration đã chạy. |
| Deploy app hỏng             | Vercel Instant Rollback về deployment trước                                   |
| Mất dữ liệu                 | Supabase PITR (bản trả phí) hoặc `pg_dump` định kỳ                            |
| Mất file                    | Backup Storage riêng — **DB backup không cứu được**                           |

Chi tiết: [`06-deployment-vercel-supabase.md`](06-deployment-vercel-supabase.md).
