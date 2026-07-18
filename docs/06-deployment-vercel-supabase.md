# 06 — Deploy: Vercel + Supabase

> **Trạng thái hiện tại (2026-07-18): đã deploy production.** Supabase migration 1–59 đã áp lên cloud; alias Vercel `https://polymind-chinese-one.vercel.app` đã qua health/anonymous/cron-secret smoke; backup trước cleanup nằm ngoài repo tại `C:\tmp\polymind-chinese-backup-20260716`.
> Cho tới khi có credential, trạng thái đúng là **"ready to deploy, blocked by credentials"** — **không được gọi là "đã deploy"**.

---

## 1. Môi trường

| Môi trường | Supabase | Vercel | Dùng khi nào |
|---|---|---|---|
| **Local** | `npx supabase start` (Docker) | `npm run dev` | Phát triển hằng ngày — **đang dùng** |
| **Preview** | Supabase staging | Vercel Preview (mỗi PR) | Review PR |
| **Production** | Supabase production | Vercel Production (từ `main`) | Khách hàng dùng thật |

Tách Supabase dev / staging / production khi có điều kiện. Tách env Vercel Preview / Production — **không dùng chung key**.

---

## 2. Chạy local (không cần credential cloud)

```bash
# 1. Bật Supabase local — cần Docker daemon đang chạy
npx supabase start
#    → in ra API URL, anon/publishable key, service_role key

# 2. Tạo .env.local từ .env.example, điền các giá trị vừa in ra
cp .env.example .env.local

# 3. Áp migration + seed
npx supabase db reset

# 4. Generate types
npx supabase gen types typescript --local > src/types/database.ts

# 5. Chạy app
npm run dev     # http://localhost:3000
```

Dừng: `npx supabase stop`. Supabase Studio local: http://localhost:55323

---

## 3. Deploy Supabase (khi có credential)

**Cần từ user:** Project ref · Database password · Project URL · Publishable (anon) key · Service role key.

```bash
npx supabase login
npx supabase link --project-ref <project-ref>

# Đẩy migration lên cloud — KHÔNG chạy migration lúc app startup
npx supabase db push

# Seed dữ liệu nghiệp vụ (KHÔNG chạy seed.dev.sql lên production)
psql "$DATABASE_URL" -f supabase/seed.sql
```

**Bắt buộc kiểm sau khi push:**
- [ ] Mọi bảng đã `ENABLE ROW LEVEL SECURITY` (Dashboard → Database → Tables, cột RLS)
- [x] 4 bucket Storage đều **private**
- [ ] Auth: **tắt public sign-up** (Dashboard → Authentication → Providers → Email → Enable signup = **off**)
- [ ] Auth: cấu hình Site URL + Redirect URLs trỏ về domain Vercel
- [ ] Email invite/reset hoạt động (Supabase SMTP mặc định có rate limit thấp — production nên gắn SMTP riêng)
- [ ] **Không có user demo, không có mật khẩu mặc định**

---

## 4. Deploy Vercel (khi có credential)

1. Import repo vào Vercel.
2. Framework preset: **Next.js**. Build: `npm run build`.
3. **Region:** đặt gần Supabase region — ưu tiên **Singapore (`sin1`)** cho user Việt Nam. Function region xa DB → mỗi query cộng thêm hàng trăm ms.
4. Env vars (đặt riêng cho **Preview** và **Production**):

| Biến | Preview | Production | Ghi chú |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | URL preview | URL production | |
| `NEXT_PUBLIC_SUPABASE_URL` | staging | production | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | staging | production | |
| `SUPABASE_SERVICE_ROLE_KEY` | staging | production | 🔴 **KHÔNG** `NEXT_PUBLIC_`. Chỉ server. |
| `CRON_SECRET` | random | random khác | |

5. Cron (`vercel.json`):

```json
{
  "crons": [
    { "path": "/api/cron/session-reminders", "schedule": "0 1 * * *" },
    { "path": "/api/cron/invoice-overdue",   "schedule": "0 2 * * *" }
  ]
}
```
*(Giờ UTC. `0 1 * * *` UTC = 08:00 giờ Việt Nam.)*

Route cron HTTP xác thực bằng `Authorization: Bearer ${CRON_SECRET}` — thiếu/sai → **401**. Assessment finalizer cần chạy mỗi phút nên dùng Supabase `pg_cron` (`assessment-attempt-finalizer`), tránh giới hạn cron hằng ngày của Vercel Hobby.

---

## 5. Thứ tự deploy (bắt buộc)

```text
1. Migration lên Supabase   (npx supabase db push)
2. Kiểm RLS + bucket + auth settings
3. MỚI deploy app lên Vercel
4. Smoke test trên URL thật
```

**Migration luôn đi trước app.** Deploy app trước khi có schema → app gọi bảng chưa tồn tại → lỗi hàng loạt.

---

## 6. Smoke test sau deploy

- [ ] `/api/health` → 200
- [ ] Trang login hiển thị đúng
- [ ] Anonymous vào `/admin` → redirect `/login`
- [ ] Đăng nhập 3 role → về đúng khu vực
- [ ] Teacher gõ URL lớp không thuộc scope → bị chặn
- [ ] Upload + download file qua signed URL
- [ ] Cron route không có secret → **401**

---

## 7. Backup & restore

> ⚠️ **Backup Database và backup Storage là HAI phạm vi RIÊNG BIỆT.**
> `pg_dump` **không** sao lưu file trong Storage. Có bản backup DB mà mất file bài nộp thì vẫn là mất dữ liệu.

| Phạm vi | Cách backup | Cách restore |
|---|---|---|
| **Database** | Supabase PITR (bản trả phí) hoặc CLI dump định kỳ | PITR hoặc restore ba file `roles/schema/data` vào project đích |
| **Storage** | Script định kỳ liệt kê + tải object từng bucket (Supabase **không** tự backup binary object ở bản free) | Upload lại object theo đúng bucket + `object_path` |

Restore đủ nghĩa = **DB + Storage khớp nhau**. Restore DB về mốc T mà Storage ở mốc T+1 → metadata trỏ tới object không tồn tại.

### 7.1. Quy trình backup database

Chạy từ máy vận hành có Docker + Supabase CLI. `<backup-dir>` phải nằm **ngoài repo**, được mã hóa và chỉ operator có quyền đọc. Không ghi connection string vào file hay shell history.

```bash
# Dùng Session Pooler URL lấy từ Dashboard → Connect.
supabase db dump --db-url "$DATABASE_URL" -f <backup-dir>/roles.sql --role-only
supabase db dump --db-url "$DATABASE_URL" -f <backup-dir>/schema.sql
supabase db dump --db-url "$DATABASE_URL" -f <backup-dir>/data.sql --use-copy --data-only \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"

# Lưu checksum cùng bản backup; dùng certutil -hashfile <file> SHA256 trên Windows.
sha256sum <backup-dir>/roles.sql <backup-dir>/schema.sql <backup-dir>/data.sql \
  > <backup-dir>/SHA256SUMS
```

Giữ cùng một `backup_id`/timestamp cho database và Storage. Mỗi backup phải có manifest: project ref, UTC bắt đầu/kết thúc, migration mới nhất, số object từng bucket, checksum và người thực hiện. Tham chiếu lệnh hiện hành: [Supabase CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

### 7.2. Backup Storage

Bốn bucket hiện tại: `avatars`, `course-materials`, `student-documents`, `question-media`; tất cả phải private. Với từng bucket:

1. Liệt kê toàn bộ object thành manifest gồm `bucket_id`, `name/object_path`, `size`, `updated_at`, checksum nếu có.
2. Tải **byte thô** từng object vào `<backup-dir>/storage/<bucket>/<object_path>`; không pipe qua PowerShell (xem luật UTF-8 trong `AGENTS.md`).
3. So sánh số object + tổng byte giữa manifest và thư mục backup.
4. Mã hóa, giới hạn quyền, và áp retention giống backup DB.

### 7.3. Restore rehearsal — chỉ staging/project rỗng

> ⛔ Không chạy restore thử vào production hoặc project staging đang dùng chung. Tạo project đích rỗng/disposable.

```bash
# Xác minh checksum trước khi restore.
sha256sum -c <backup-dir>/SHA256SUMS

psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file <backup-dir>/roles.sql \
  --file <backup-dir>/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file <backup-dir>/data.sql \
  --dbname "$RESTORE_DATABASE_URL"
```

Sau DB, upload lại Storage đúng bucket/path rồi mới mở app. Kiểm bắt buộc: migration history, 50 bảng public đều bật RLS, 4 bucket private, số row các bảng trọng yếu, số object/tổng byte, signed download và một file UTF-8 mở đúng. Chỉ coi backup dùng được khi một restore rehearsal gần nhất đã hoàn tất và kết quả được ghi vào nhật ký vận hành.

---

## 8. Rollback

| Sự cố | Xử lý |
|---|---|
| App deploy hỏng | `vercel rollback` hoặc **Vercel Instant Rollback** về deployment trước; sau đó `vercel rollback status` và smoke test |
| Migration hỏng ở production | **Forward-fix:** viết migration mới sửa lại. **KHÔNG sửa migration đã chạy** (Supabase đã ghi nhận nó vào bảng lịch sử; sửa file cũ làm lệch trạng thái) |
| Migration làm mất dữ liệu | Restore từ PITR/dump. Đây là lý do phải **rehearsal migration trên staging trước** |
| Rò secret | Rotate key ở Supabase Dashboard → cập nhật env Vercel → redeploy |

Rollback app **không rollback database**. Vì vậy migration production phải tương thích ít nhất với deployment app liền trước (ưu tiên expand → deploy app → backfill/contract ở release sau). Nếu app cũ không tương thích schema mới thì không Instant Rollback mù quáng: bật maintenance/read-only nếu cần và phát hành forward-fix.

Sau Instant Rollback, Vercel tắt auto-assignment production domain cho deployment mới. Khi fix đã qua smoke, dùng `vercel promote <deployment-url>` để mở lại luồng production. Chi tiết: [Vercel rollback](https://vercel.com/docs/deployments/rollback-production-deployment).

### 8.1. Migration rehearsal (bắt buộc trước production)

```bash
# Cổng 1 — local sạch: áp từ migration đầu tiên và chạy toàn bộ pgTAP.
npm run db:reset
npm run db:test

# Cổng 2 — xem đúng migration còn thiếu trên project staging đã link.
npx supabase db push --dry-run

# Cổng 3 — backup staging rồi áp thật; TUYỆT ĐỐI không dùng seed.dev.sql.
npx supabase db push
npm run db:seed:dev       # chỉ local/staging disposable; không bao giờ production
npm run test:e2e
```

Trước khi lên production, operator phải lưu: output dry-run, danh sách/timestamp migration, backup ID staging, kết quả pgTAP/E2E/build, deployment app sẽ phát hành và người phê duyệt. Sau đó lặp lại `db push --dry-run` với project production; danh sách ngoài release plan → **dừng**.

Thứ tự release production:

1. Xác nhận backup DB + Storage gần nhất và restore rehearsal còn hiệu lực.
2. `db push --dry-run` → so với release plan.
3. `db push` production; kiểm RLS/RPC/health ở DB.
4. Deploy/promote app; chạy checklist §6.
5. Theo dõi 5xx, Auth, Postgres và cron; ghi deployment URL + migration cuối vào nhật ký.

### 8.2. Tiêu chí dừng và xử lý sự cố

- Dry-run có migration lạ, backup thiếu checksum, hoặc test đỏ → **không deploy**.
- App 5xx nhưng DB an toàn/tương thích → rollback app ngay, rồi điều tra.
- Migration lỗi nhưng chưa mất dữ liệu → giữ app cũ/maintenance, viết migration forward-fix mới.
- Có dấu hiệu mất/corrupt dữ liệu → chặn mutation, ghi mốc UTC, chọn PITR/backup trước sự cố và thực hiện restore theo §7.3.

---

## 9. Bảo mật vận hành

- **Không commit** `.env.local`, token, service role key, database password.
- **Không log** PII, token, mật khẩu, signed URL đầy đủ, nội dung bài nộp.
- Dùng **Vercel logs + Supabase logs**. Không ghi rolling file trong production.
- `/api/health` tối giản — **không lộ** version, schema, biến môi trường.
- **Production không có user demo, không có mật khẩu mặc định.**
- Rate limit ở Supabase Auth (chống brute force login).

---

## 10. Credential cần user cung cấp (đang thiếu)

| # | Cần gì | Lấy ở đâu | Gỡ blocker nào |
|---|---|---|---|
| 1 | Supabase Project URL | Dashboard → Settings → API | BLK-1 |
| 2 | Publishable (anon) key | Dashboard → Settings → API | BLK-1 |
| 3 | Service role key | Dashboard → Settings → API (🔴 giữ bí mật) | BLK-1 |
| 4 | Database password | Lúc tạo project | BLK-1 |
| 5 | Project ref | Trong URL dashboard | BLK-1 |
| 6 | Tài khoản Vercel + quyền link repo | vercel.com | BLK-2 |

Có đủ 6 mục này → release/deploy lại được an toàn; lần gần nhất hoàn tất ngày 2026-07-16.
