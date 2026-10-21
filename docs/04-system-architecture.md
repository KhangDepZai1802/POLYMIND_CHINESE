# 04 — Kiến trúc hệ thống

## B2C save visibility (2026-10-21)

`revalidateB2CViews()` invalidates hai layout `/admin/b2c` và `/teacher` sau RPC ghi thành công. Dùng chung cho workspace, hồ sơ/lớp, sinh lịch, chấm công, học phí/phiếu thu, điểm kiểm tra và nhận xét tháng; lỗi validate/DB không invalidation hoặc báo thành công. Nhờ đó các trang tổng hợp/lớp/lịch sử của admin và giáo viên được đọc mới khi truy cập, tránh chỉ invalidation một trang giáo viên. Không thêm bảng/kho dữ liệu riêng/trạng thái gửi hay service-role user flow; không tự refresh browser admin đang mở trên máy khác.

## Check-in time window (2026-10-21)

CheckinWindow client tự cập nhật mỗi giây, khóa controls ngoài cửa sổ theo giờ VN; đây chỉ là hướng dẫn giao diện. RPC check_b2c_teaching_session kiểm lại theo clock_timestamp trong DB sau khi khóa session. Weekly RPC không nhận giờ từ client, tự đọc lịch và phân công hiện tại; permissionRpc khai báo endpoint mới. Thẻ không tạo bản ghi khi render; chỉ thao tác Mở check-in mới materialize buổi. Giao diện và máy chủ cùng quy tắc [start−15 phút,end), trong ngày dạy.

## B2C certificate marketing data (2026-10-17)

Route/admin/b2c/certificates manager-only; panel client đọc filters via manager serveraction → typed permissionRpc. Student picker query/paging và generation guard bỏ responsecũ. Editor UUIDretry, fieldvalidation, class-independent studentlink; archive dialog xác nhận. History business riêng append-only. ExcelJS lazy-load trên client sau manager exportaction đọc snapshot5000bản, ép approvedactive và projection6cột. Workbook ghi cell dạngstring, không công thức từ input; file không bao gồm liên hệ/ghi chú. MenuB2C và icontrên bảngHV liên kết route; không thay menuB2B hoặc teacher.

## Monthly comments B2C (2026-10-17)

MonthlyCommentsPanel trong ClassWorkspaceContent dùng chung popup/admin/teacher. Editor6fields/save draft-ready; detailpreview/history/contact picker/copy/mailto/manual-confirm. Server requireTeaching(super_admin) → Zod → permissionRpc, DB enforce scope/version/idempotency/atomic history. React effects bỏ stale/unmounted responses. Clipboard/mailto chỉ do user click; không gọi dịch vụ gửi hoặc connectors. Xác nhận gửi độc lập, hiển thị rõ manual. ParentDialog/action dùng wrapper RPC atomic có email; không dùng email học viên fallback.

## B2C assessments (2026-10-17)

ClassWorkspaceContent dùng AssessmentsPanel chung popup/admin/teacher. Tab assessment không chuyển payload sang RPC workspace cũ; panel gọi read RPC riêng có kiểm capability. Teacher loader dùng context lớp theo quyền xem học viên, page/nav kiểm view_assessments; read/write assessment RPC luôn tự kiểm quyền/lớp. React effect bỏ response sau unmount/thay bộ lọc. Editors giữ UUID và form khi lỗi, khóa đóng/lưu trong pending, parent tải lại sau lưu. History dialog bỏ response cũ, diễn giải before/after tiếng Việt. Server requireTeaching(super_admin) → Zod → typed forward RPC, không service role; revalidate B2C layout và lớp teacher.

## B2C enrollment lifecycle (2026-10-17)

EnrollmentLifecycleDialog dùng chung bảng học viên Tổng quan và chương trình, đọc context/lịch sử khi mở, form có trạng thái chờ/lỗi/thành công. Server action requireManager → Zod → permissionRpc → RPC manager-only. DB enforce idempotency, khóa, stale-check và lịch sử atomic; không service role. Sau lưu refresh B2C layout và lớp/điểm danh teacher. Domain status/nhắc tái phí và Tổng quan hiểu trạng thái transferred; form sửa ghi danh thường không cung cấp bảo lưu/đi học lại thay cho workflow có lý do. Lịch sử ghi danh cũ và học phí giữ nguyên, ghi danh mới chưa tạo gói học phí.

## B2C-STUDENT-SESSIONS-1 (2026-10-16)

Shared ClassWorkspaceContent hiển thị session_summary của từng ghi danh ở tab students trong popup/trang lớp admin và teacher. Hai RPC tổng hợp từ attendance join meetings, loại tương lai và hủy, không nối thêm ở client hoặc thay đổi gói học phí. Teacher cần quyền mark_attendance để xem số liệu.

## B2C class end date (2026-10-16)

Form thêm lớp và editor dùng chung truyền end_date qua schema/server/RPC. Các truy vấn danh sách, chi tiết và workspace cùng đọc cột này; popup lấy bản ghi mới sau refresh. Validation Zod và DB thống nhất thứ tự ngày; manager sửa theo quyền hiện có, teacher theo permission. Kiểm tra: lint/typecheck/build đạt; 150 files, 900/900 unit tests và 20 DB assertions. Chưa QA browser độc lập.

## Add student to B2C class (2026-10-16)

ClassStudentAddDialog dùng chung popup lớp/trang lớp, chỉ render manager khi không có teacher permissions. FormData → manager server action → Zod → typed forward RPC, không service role. Hai chế độ new/existing; selector tìm/phân trang riêng, generation token bỏ phản hồi cũ, Enter tìm không submit ghi danh. Lỗi lưu giữ giá trị/request; đang lưu chặn đóng/gửi trùng. Sau thành công refresh parent và workspace callback, revalidate B2C layout/teacher classes/detail pattern; popup roster mặc định chuyển sang model server mới để thấy người vừa thêm. Không suy học phí hay tạo tài khoản từ ghi danh.

## Teacher account management (2026-10-16)

TeacherAccountDialog dùng chung B2C/generic; account-schema xác thực kind/id/expected_user_id/password/confirm. account-actions kiểm requireRole(super_admin) trước truy vấn, resolve B2C/source và teachers/profile qua server client/RLS, chỉ chấp nhận teacher/academic_manager. Auth admin.getUserById đọc login tài khoản cũ, updateUserById chỉ truyền password; không provision/upsert profile và không đổi role/is_active. expected_user_id chống thay liên kết sau khi mở; audit teacher.password_reset chỉ ghi user_id/username/source, không secret. Gửi mật khẩu bằng FormData thay vì object để dev action trace không serialize các giá trị password. UI generation token bỏ kết quả tải cũ, khóa thao tác khi đang lưu và xóa password khi unmount. Không schema/migration; không đổi quyền quản lý tài khoản D-2.

## B2C tuition corrections (2026-10-16)

TuitionCorrectionsDialog tại trang manager Học phí gọi manager-only server actions → typed forward RPC helper → guarded DB transaction; không service role. UI đọc phiếu/lịch sử phân trang riêng, bỏ phản hồi tải cũ bằng generation token, khóa đóng/lưu khi đang ghi, giữ retry UUID khi lỗi, preview số dư và refresh khi thành công. TuitionPackageDialog truyền expected due/paid và lý do vào save_b2c_tuition_package_with_reason; DB vẫn enforce capability theo lớp. Read phiếu dùng projection mới, teacher metrics alias amount:effective_amount. Revalidate học phí/lịch sử/học viên/tổng quan/giáo viên và cả class route patterns manager/teacher.

## B2C attendance mobile (2026-10-15)

ClassWorkspaceContent dùng thẻ điểm danh dưới breakpoint md, bảng ở desktop; cùng ClassAttendanceDialog/action/schema/RPC cho cả hai. Vùng chạm nút/select tối thiểu 44px, trạng thái và ghi chú nằm trên thẻ. Permission mark_attendance kết hợp ngày VN/trạng thái buổi để hiện nút; RPC tiếp tục xác thực phân công, chống stale/retry và audit. makeup là text status riêng B2C; không thay enum B2B. Migration20261015000002 mở CHECK và thống kê ở hai read RPC.

## Capability giáo viên B2C (2026-10-15)

Catalog/dependency/schema tại domain/teacher-permissions.ts. Admin dialog đọc/lưu qua manager-only actions/RPC với optimistic version; server không dùng service role. Teacher ClassWorkspaceContent nhận permissions để hiện tab/thao tác, nhưng enforcement nằm tại DB helper (capability AND lớp phân công), RPC đọc projection và mutation. Không thay app.is_manager hoặc role middleware toàn hệ thống. Teacher management actions quản lý lớp/hồ sơ qua RPC scoped; ClassWorkspaceContent dùng chung admin/teacher. User đã xác nhận; migration production đã áp/history và verify bằng kết nối mới với integration rollback. Code chưa phát hành online.

## Nút trở lại chi tiết lớp (2026-10-14)

Shared BackLink dùng Next Link (giữ semantic điều hướng), đích href tường minh. Icon ArrowLeft trong ô44×44px rounded-xl có nền/viền xanh, hover tương phản, focus outline và aria-label/title; nhãn điểm đến nằm cạnh nút. Dùng tại teacher B2C/B2B và admin B2C class detail. Không đổi quyền/dữ liệu hoặc thay bằng history.back không kiểm soát đích.


## Dashboard giáo viên theo ảnh (2026-10-14)

/teacher giữ server queries/requireTeaching/RLS và quy tắc actual meeting override weekly. Tách giao diện TeacherHomeDashboard server component nhận dữ liệu typed + now snapshot, định dạng ngày VN trên server tránh hydration mismatch. Bốn KPI đếm dữ liệu truy vấn hiện có (today buổi B2B/B2C; attendance/pending/risk là danh sách B2B có giới hạn, hiển thị scope rõ); không thêm so sánh hôm qua chưa có nguồn. Thẻ B2C compact4 cột desktop/2 tablet/1 phone; actual/cancelled/weekly vẫn giữ metadata và links.

TeacherHeaderSearch client island dựa pathname, chỉ hiện desktop /teacher; GET /teacher/classes?q= lọc mã/tên trên dữ liệu được phân công đã đọc qua RLS, tối đa200 ký tự; form tại trang lớp hỗ trợ mobile. Route khác giữ header cũ. Nav teacher active xanh gradient; sidebar/mobile dùng chung. Không đổi Logo component hoặc /logopolymind.png, không thêm asset ngoài. UI nền sáng, pastel, bo góc/bóng nhẹ, dark variants/focus states và không tràn ở360/390.


## Màu icon B2C/giáo viên (2026-10-14)

NavLinks dùng cùng palette cho sidebar và mobile drawer, chỉ trong /admin/b2c và /teacher: xanh dương (lớp/tổng quan), ngọc (học viên/phụ huynh/học phí), tím (giáo viên/thi), cam (tuyển sinh/điểm danh). Ô icon nền pastel32px, SVG18px; active trắng/nền trắng15% trên primary. Có dark variant. KPI Tổng quan và thẻ lớp giáo viên có ô icon40–44px; các thao tác tìm/xem xanh, sửa amber, lịch sử tím. Giữ icon trắng ở nút/quick-action màu để tương phản. Không thay menu/quyền của B2B hoặc XKLĐ.

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
│  • Storage (6 bucket nghiệp vụ private, signed URL)       │
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
3. Admin client chỉ cho: mời user, khóa/mở tài khoản, đổi role, seed; system cron đã xác thực chỉ được gọi ba RPC nền bị revoke khỏi user role. Đếm được trên đầu ngón tay.
4. `SUPABASE_SERVICE_ROLE_KEY` **không bao giờ** có tiền tố `NEXT_PUBLIC_`.

---

## 4. Auth SSR

Theo hướng dẫn chính thức của `@supabase/ssr` (cookie-based, không localStorage).

```text
middleware.ts
  → supabase.auth.getClaims()    ← verify JWT bằng ES256/JWKS cache
                                    KHÔNG dùng getSession() để phân quyền
  → chưa đăng nhập → redirect /login
  → / hoặc /login khi đã đăng nhập: đọc profiles để redirect đúng trang chủ
  → route protected: không query profiles lặp lại ở middleware

Server Component / Server Action / Route Handler
  → getClaims() lấy `sub` đã verify; requireUser/requireRole đọc role + is_active
    từ profiles (request-memoized), không tin role/user_metadata trong JWT
  → sai role / tài khoản bị khóa → fail-closed
  → RLS tiếp tục chặn ở DB
```

**Middleware chỉ là lớp UX.** Nó không query `profiles` trên mọi navigation vì việc đó lặp lại kiểm tra của server và thêm một network round-trip tuần tự. Mỗi Page/Server Action/Route Handler **phải tự kiểm quyền**, và RLS **vẫn** chặn ở DB. Cache request chỉ khử lời gọi trùng trong cùng một render, không cache chéo user/request.

Production Supabase dùng signing key bất đối xứng ES256. Helper `getVerifiedIdentity()` gọi `getClaims()` và fail-closed khi SDK báo lỗi, thiếu claims hoặc `sub` không phải UUID; public JWKS chỉ dùng xác minh, không thể ký token. `getUser()` chỉ giữ cho thao tác thật sự cần user/session mới nhất từ Auth. Khóa tài khoản và đổi role vẫn có hiệu lực ngay vì server tiếp tục đọc `profiles.is_active`/`role`, còn DB tiếp tục kiểm `app.is_active()` + RLS.

**Nguồn phân quyền là bảng `profiles`**, không phải `user_metadata` (client sửa được).

**Cache:** trang authenticated **không** ISR/`force-static`. Dùng `export const dynamic = 'force-dynamic'` (hoặc `revalidate = 0`) cho mọi trang trong `(dashboard)` — tránh rò session giữa các user qua cache.

---

## 5. Cấu trúc source

```text
src/
├─ app/
│  ├─ (auth)/                    login, forgot-password, reset-password, accept-invite
│  ├─ (dashboard)/
│  │  ├─ admin/                  super_admin · academic_manager (trừ system/flashcards/question-bank-review)
│  │  ├─ teacher/                teacher · academic_manager (khi được phân lớp)
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

`features/*`: `users · students · teachers · courses · classes · schedules · enrollments · attendance · question-bank · question-builder · exercises · exams · assessment-results · flashcards · wrong-answer-review · progress · tuition · notifications · announcements · reports · audit`

### Quy tắc code (rút từ sai lầm của hệ cũ)

1. **Page/Component không chứa query + mutation dài hàng trăm dòng.** Hệ cũ có `CandidateDetail.razor` > 2.000 dòng trộn UI, query, quyền, mutation — không ai bảo trì nổi. Ở đây: page **gọi** `features/*/server`, không tự viết SQL.
2. **Business rule thuần nằm ở `lib/domain/`** (tính chuyên cần, sinh recurrence, xếp loại, số dư hóa đơn) — hàm thuần, **có unit test**, không phụ thuộc DB.
3. **Mã nghiệp vụ do DB tự sinh** bằng sequence/default, không nhận từ form. UNIQUE ở DB là chốt chống trùng; client chỉ hiển thị mã sau khi tạo.
4. **Mutation nhiều bảng → RPC PostgreSQL**, không phải nhiều lệnh insert tuần tự ở JS (không có transaction, hỏng giữa chừng là dữ liệu rác).
5. **Một hành động = một đường ghi.** Đừng để 3 chỗ cùng set trạng thái theo 3 cách khác nhau (hệ cũ: 3 đường set `Payment → Paid`, lệch nhau → thiếu hoa hồng). Mọi đường vào phải gọi **cùng một service**.
6. **`types/database.ts` generate từ Supabase** (`supabase gen types typescript`). Không tự bảo trì type DB bằng tay.
7. **Attribution = actor thật.** `created_by`/`marked_by`/`recorded_by` lấy từ `auth.uid()` của người đang đăng nhập, **không** lấy "user đầu tiên tìm thấy".

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
  1. Xác thực: getClaims() + profiles.is_active/role → sai/thiếu → deny
  2. Kiểm quyền ở server (lib/permissions) — KHÔNG tin UI đã ẩn nút
  3. Validate input bằng Zod (cùng schema với client)
  4. Gọi RPC (nếu nhiều bảng) hoặc query (nếu một bảng)
     → RLS vẫn chặn ở DB nếu bước 2 có lỗ
  5. Ghi audit_logs
  6. revalidatePath() / revalidateTag()
```

Form bắt đầu lượt Bài tập/Thi dùng `SubmitButton` + `useFormStatus`: trạng thái pending phải hiện ngay trên nút, đổi nhãn theo nghiệp vụ và khóa double-submit trong lúc Server Action tạo attempt/redirect. Đây là phản hồi UX; idempotency thật vẫn do RPC/constraint ở DB bảo đảm.

“Lớp của tôi” chỉ compose các read query hiện hữu; Bài tập/Kiểm tra vẫn có đúng một write path ở feature nguồn. Flashcard admin dùng signed direct upload ba slot rồi finalize metadata; browser không gửi blob qua Server Action. Ôn câu sai lấy/chấm qua RPC để student không cần SELECT Question Bank/answer key.

**Kiểm quyền 3 lớp** — mỗi lớp đều giả định lớp trước có thể sai:

| Lớp              | Chặn cái gì                      | Nếu chỉ có lớp này  |
| ---------------- | -------------------------------- | ------------------- |
| UI (ẩn menu/nút) | Người dùng bình thường bấm nhầm  | ❌ Gõ URL là vào    |
| Server Action    | Request giả mạo, URL trực tiếp   | ⚠️ Bug logic là lọt |
| **RLS (DB)**     | **Mọi thứ, kể cả server có bug** | ✅ Chốt chặn cuối   |

---

## 7. Transaction & idempotency

Mutation nhiều bảng **phải** là RPC PostgreSQL (`SECURITY DEFINER`, `SET search_path = ''`, kiểm quyền ở dòng đầu):

`enroll_student` · `transfer_enrollment` · `change_enrollment_status` · `bulk_mark_attendance` · `generate_class_sessions` · `save_session_log` · `reschedule_class_session_with_makeup` · assessment engine RPC (`create/version/share/import`, `publish/start/save/submit/grade/release/regrade/finalize`) · `publish_evaluation` · `save_tuition_invoice` · `issue_tuition_invoice` · `delete_tuition_invoice_draft` · `record_tuition_payment` · `save_announcement` · `publish_announcement` · `expire_announcement`

**Idempotency được cưỡng chế ở DB, không ở app** (app-level check luôn thua race condition — bài học từ lỗi trả hoa hồng 2 lần ở hệ cũ):

| Thao tác            | Chốt chặn ở DB                                                    |
| ------------------- | ----------------------------------------------------------------- |
| Điểm danh hàng loạt | UNIQUE `(session_id, enrollment_id)` + `ON CONFLICT DO UPDATE`    |
| Sinh buổi học       | UNIQUE `(class_id, session_number)` + `ON CONFLICT DO NOTHING`    |
| Nghỉ/học bù         | `request_id` UNIQUE + khóa lớp/session + giữ row/ID/số buổi; trigger chặn số ngoài `1..planned_session_count` |
| Ghi nhận thanh toán | UNIQUE `tuition_receipts.payment_id` → **đúng 1 phiếu thu**       |
| Ghi danh vượt sĩ số | `SELECT ... FOR UPDATE` trên `classes` trong transaction          |
| Cron sinh thông báo | UNIQUE partial `(user_id, dedupe_key)`                            |
| Nhập điểm bài KT    | UNIQUE `(assessment_id, enrollment_id)` + `ON CONFLICT DO UPDATE` |
| Một câu sai/học viên | UNIQUE `(student_id, question_version_id)` + trigger UPSERT       |
| Trang flashcard/buổi | UNIQUE `(section_id, order_index)` + reorder RPC atomic            |

---

## 8. Storage

Mọi bucket đều **private**. Media assessment dùng `question-media` cho audio đề và `answer-media` cho bản ghi câu Nói; hai bucket legacy `assignment-files`/`submissions` chỉ chờ cleanup sau cutover.

```text
Upload nhỏ: client → server action (validate MIME/size/ext)
              → server SINH object_path và upload bằng user client

Audio câu hỏi: client gửi metadata → server kiểm auth/quota/MIME/size và SINH path
               → server ký vé upload bằng user client (Storage RLS vẫn chạy)
               → browser upload thẳng Storage, không đưa blob qua Server Action
               → server kiểm path + metadata thật từ Storage → lưu `question_media`

Audio câu Nói: client gửi metadata → server kiểm đúng student/attempt/item đang mở và SINH path
              → browser upload Blob thẳng `answer-media` bằng vé ký
              → server kiểm namespace + metadata thật → RPC gắn `answer_media` và `answer_payload`

Download: server action kiểm quyền → tạo signed URL (TTL ≤ 5 phút) → trả về client
```

- **`object_path` do server sinh.** Không tin path client gửi lên (path traversal). Audio câu hỏi dùng `{owner_uid}/{uuid}.{mp3|m4a}`; lúc finalize server buộc path đúng actor rồi kiểm lại object trong Storage.
- Storage policy soi **cùng điều kiện class/student như DB**, không chỉ `auth.uid() IS NOT NULL`.
- Media câu hỏi không chỉ ẩn metadata: policy `question-media` kiểm owner/share/delivery; giáo viên phụ trách chỉ đọc audio của bộ đã giao cho lớp mình; answer key không bao giờ nằm trong object metadata hay payload học viên trước release.
- Student chỉ ký được audio đề thuộc lượt Bài tập/Thi đang mở hoặc kết quả đã công bố của chính mình. RPC kết quả trả `question_version_id`, server tra metadata qua RLS rồi ký URL; không trả object path. `answer-media` cho student owner và giáo viên phụ trách lớp đọc qua RLS; bảng metadata có `SELECT` cho authenticated nhưng RLS vẫn fail-closed.
- Một pipeline ký URL dùng chung bao phủ ma trận: audio đề ở lượt làm/chấm/kết quả và audio câu Nói ở lượt làm/chấm/kết quả; hai module Bài tập/Thi không tự triển khai lệch nhau.
- Audio nguồn do giáo viên/Super Admin tải lên và hiển thị cho học viên phải đi qua **một player client dùng chung** tại Bài tập, Thi, kết quả, Flashcard và Ôn câu sai. Player chỉ cho `0.5 | 0.75 | 1`, mặc định `1`, gán `HTMLMediaElement.playbackRate` và bật `preservesPitch` khi trình duyệt hỗ trợ. Đây là presentation state: không thêm cột DB, không đổi Storage/RLS/signed URL và không tạo file audio dẫn xuất. Bản ghi Nói do học viên tự thu không thuộc phạm vi.
- **Không log signed URL đầy đủ** (nó là credential tạm thời).
- `flashcard-media` cũng private. Upload theo `{admin_uid}/{deck_id}/{section_id}/{page_id}/{slot}-{uuid}.{ext}`; `slot` gồm `front`/`back`/`audio` và `example-<n>` cho ảnh câu ví dụ. Server kiểm lại namespace/MIME/size theo loại slot. Trigger DB tổng hợp mọi nguồn vào `flashcard_pages.media_paths`; helper dùng `media_paths @> array[path]` để GIN index phục vụ lookup. Student chỉ được `createSignedUrls` khi page/section/deck đã publish, path có trong `media_paths` và Course khớp enrollment qua Storage RLS.

### Animation Flashcard

- `FlashcardReader` là Client Component tách khỏi RSC query. Page turn và face flip là hai state độc lập; dùng semantic `button`, phím mũi tên cho page, `Enter/Space` cho face, `aria-live` thông báo “Buổi N, trang X/Y, mặt trước/sau”.
- CSS 3D dùng `perspective`, `transform-style: preserve-3d` và hai trục khác nhau; không phụ thuộc thư viện animation runtime. `motion-reduce:transition-none` giữ toàn bộ chức năng khi người dùng giảm chuyển động.
- UI mobile-first, control tối thiểu 44×44 px; bookmark buổi cuộn ngang thay vì dropdown để giữ đúng mô hình đánh dấu trang sách.

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

---

## 13. Impact map Phase 14

| Phạm vi | Source chính |
|---|---|
| Route học viên | `app/(dashboard)/student/{class,review,schedule}`; schedule chỉ redirect |
| Route Super Admin | `app/(dashboard)/admin/flashcards` |
| Read lớp học viên | `features/student/server/queries.ts`; compose query assessment hiện hữu, không tạo write path mới |
| Flashcard | `features/flashcards/{schema,domain,server,components}` + bucket `flashcard-media` |
| Ôn câu sai | `features/wrong-answer-review/{schema,server,components}`; renderer dùng `features/question-builder/renderers` |
| DB | migration 66 `flashcards` + 67 `wrong_answer_review`; tables/RPC/trigger/RLS/Storage policy + pgTAP riêng |
| Điều hướng | `lib/permissions/navigation.ts`; menu chỉ là UX, route/server/RLS vẫn tự chặn |
| Test | `tests/unit/components`, `tests/unit/server`, `supabase/tests/database`, Playwright 3 role/IDOR |


### B2C-PARENT-NPS-1 — Khảo sát hài lòng phụ huynh

Route quản lý /admin/b2c/nps dùng requireManager và RPC guard/RLS; nav chỉ B2C. Route /nps/[token] nằm ngoài dashboard, middleware bỏ session đúng prefix /nps/, client Supabase riêng publishable key không cookie/persist/refresh; không service-role. Public page force-dynamic/no-store, noindex/nofollow/no-referrer; không log token/PII. Token raw chỉ giữ trong popup lấy link, đóng là bỏ; DB chỉ hash. Link lấy origin hiện tại; localhost phải triển khai online trước khi phụ huynh mở ngoài máy. Không triển khai hoặc gửi tin tự động trong task.


### B2C-OVERVIEW-COLOR-1 — Màu sắc Tổng quan

KPI có nền chuyển sắc nhẹ xanh ngọc/xanh dương/tím/xanh lá và viền nhấn; thẻ lớp dưới ngưỡng giữ đỏ. Các vùng hòa vốn/nguồn khách/kết quả tháng/lớp có điểm nhấn vàng/xanh/lá/xanh dương. Khung Tổng hợp theo chương trình dùng nền và viền trung tính, bỏ viền/nền tím theo phản hồi người dùng. Nguồn khách có nền theo kênh; màu chỉ trang trí, số/nhãn/cách mở popup giữ nguyên. Có biến thể dark mode, không đổi dữ liệu/DB hoặc theme toàn hệ thống.


B2C-PROGRAM-COLOR-1: Bảng Tổng hợp theo chương trình bổ sung chấm màu xanh dương/vàng/xanh lá/tím/hồng theo chương trình, cột Tỷ lệ lấp đầy có thanh chuyển sắc xanh/lá/hồng và phần trăm. Tính bằng ghi danh chia sức chứa hiện có, không sao chép phần trăm minh họa trong ảnh; thanh giới hạn100, số thực giữ nếu vượt. Khung giữ trung tính, không viền tím.


B2C-OVERVIEW-BORDER-3: Theo ảnh khoanh đỏ, bỏ viền trên dày màu vàng ở hòa vốn, xanh ở nguồn khách và danh sách lớp; giữ nền chuyển sắc, viền mảnh, KPI/chấm màu/thanh tỷ lệ và viền xanh lá kết quả tháng.


B2C-OVERVIEW-NO-TOP-BORDERS: User chốt bỏ toàn bộ viền nhấn phía trên trang Tổng quan, gồm KPI và kết quả tháng. Giữ viền mảnh đồng đều, nền màu nhẹ và chấm màu/thanh tỷ lệ; thay thế mô tả viền màu trước đó.


### B2C-DISPLAY-LABELS-1

B2C là phạm vi kỹ thuật, không thêm vào tiêu đề/nhãn/nút/mô tả/thông báo trong module trung tâm và giao diện giáo viên liên quan. Nhãn riêng B2C đổi Trung tâm; giữ mã hồ sơ có sẵn, URL, tên hàm/bảng/quyền, bộ chọn module và phân biệt phạm vi dữ liệu.


### B2C-TUITION-DESIGN-1

Giao diện theo ảnh: thẻ trắng icon màu/nền cong nhẹ, bảng avatar chữ cái/badge lớp/nợ đỏ/Chưa có gói xám, dark mode và cuộn ngang mobile; không viền trên dày, không đổi logo/sidebar toàn hệ thống. Server read bảo vệ manager, dùng effective-balance RPC; client lọc/sort/tổng hợp từ đầy đủ danh sách cùng quyền, trang25 và popup20. Không dùng số giả trong ảnh hoặc thêm nút chưa hoạt động.


### B2C-PARENT-DESIGN-1

B2C-PARENT-DESIGN-1: ParentDashboard client nhận đầy đủ parents từ manager serverloader, không public API mới. Trang dynamic/no-store; avatar chữ cái, bảng contact missing/chip quan hệ, thẻ icon màu/nền cong nhẹ, không viền trên dày; dark mode/mobile cuộn ngang. Form ParentDialog thêm showLabel tùy chọn để hiện Sửa, giữ defaulticon cho chỗ cũ. Không thay logo/sidebar/header chung.


B2C-PARENT-CARD-POPUPS: Cả4KPI mở popup danh sách đúng nhóm theo tổng toàn bộ hồ sơ, không thay trạng thái bảng ngoài. Popup có tìm kiếm,20/trang, trạng thái rỗng kể cả0hồsơ, Xem/Sửa; Xem đóng danh sách rồi mở chi tiết. Không API/DB/quyền mới. Thay hành vi KPI lọc bảng trong mô tả trước.


B2C-TEACHER-DESIGN-2: Giữ dashboard/charts/lọc/thống kê/export/print/KPIpopup hiện có; đồng bộ ảnh với4màuKPI và nềncong, viền mảnh/bo16, link thời khóa biểu cùngheader, avatar chữcái màu trong bảng và action cùnghàng. Giá trị chuyên môn cũ chỉ ghi B2C hiển thị Chưa cập nhật thay vì lộ nhãn phạm vi; không sửaDB hoặc dựng chuyên môn giả. Không đổi sidebar/logo hoặc quyền tài khoản.


B2C-TUITION-CARD-POPUPS: Cả4KPI học phí là button mở popup. Tổng phải thu liệt kê ghi danh có gói; Đã thu là thu ròng dương (gồm trả một phần); Còn phải thu là số dư dương; Cần xử lý giữ nợ/tái phí. Popup theo bộ lọc ngoài, tìm/page20/empty/gói-phiếu thu, đóng không đổi bảng; không API/DB/quyền mới.


### B2C-REPORT-DESIGN-1

Trang Báo cáo theo ảnh: bộ chọn kỳ có icon lịch,4thẻKPI xanh lá/xanh dương/cam/hồng và nền trang trí không biểu diễn dữ liệu, chương trình avatar/màu cột/sort thật, chi phí icon từng dòng/tổng nền xanh/lương cũ màucam, thanh sửa có icon và chevron. Giữ số liệu tổng hợp thủ công/cách tính cũ/ghi chú/nhập lưu tháng/quyền; không tự dựng lịch sử giao dịch hoặc dùng số mẫu. Không đổi sidebar/logo; không viền trên dày.
