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

> Cập nhật: **2026-07-13** — Claude — Phiên 1

- **Phase 0 XONG** · **Phase 1 XONG** · **Phase 2 XONG**. Repo: `Documents\Polymind Chinese`, git `main`, đã push GitHub.
- **GitHub:** https://github.com/KhangDepZai1802/POLYMIND_CHINESE
- App chạy được: Next.js 16 + TS strict + Tailwind v4 + shadcn/ui. Auth SSR (login/forgot/reset/invite), app shell 3 role, logo PolyMind, footer bản quyền.
- **DB: 15 migration + seed chạy sạch.** 33 bảng, **0 bảng thiếu RLS**, 98 policy, 5 view, 7 RPC, 5 private bucket.
- **RLS đã kiểm chứng THẬT qua HTTP API** (Supabase Auth → JWT → PostgREST): GV A chỉ thấy LOP-01/02 + HV001–004 (không thấy HV005), học phí 0 dòng, audit 0 dòng; HV5 chỉ thấy LOP-03 + chính mình; anonymous bị chặn ở tầng GRANT.
- ⚠️ **Test suite đang HOÃN theo yêu cầu user** (2026-07-13): ưu tiên build web hoàn chỉnh trước. RLS/bảo mật vẫn làm đầy đủ — đó là tính năng, không phải test.
- Môi trường: Node 22.20 · npm 10.9 · Docker 28.4 · Supabase local **port 553xx** (543xx bị Windows reserve).

---

## ➡️ VIỆC TIẾP THEO

**`P3-T1` — Layout admin + dashboard skeleton**, rồi đi tiếp P3-T2 → P3-T10 (Academic admin core).

Mục tiêu Phase 3: super admin đi trọn được **Course → Class → Schedule → sinh buổi → gán GV → Enrollment**.

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
| D-10 | Một HV học **nhiều lớp** đồng thời. Một lớp có **1 GV chính + n trợ giảng**. |
| D-11 | Lớp hỗ trợ `offline / online / hybrid / in_house` + **địa điểm mô tả tự do**. `LOP-01` **lịch linh hoạt, không có recurrence** — đúng nghiệp vụ, không phải thiếu dữ liệu. |
| D-12 | UI **tiếng Việt**, ngày `dd/MM/yyyy`, hiển thị `Asia/Ho_Chi_Minh`, **DB lưu UTC**. |
| D-13 | **RLS bật trên mọi bảng, fail-closed.** Ẩn menu ≠ phân quyền. Service role **không bao giờ** dùng cho user flow thường. |
| D-14 | Repo mới đặt tại `C:\Users\khang\OneDrive\Documents\Polymind Chinese` — **sibling** của POLYMIND APP, không lồng vào repo cũ *(user chốt 2026-07-13)*. |
| D-15 | **Local-first.** Chưa có credential cloud → build + test đầy đủ ở local, deploy sau *(user chốt 2026-07-13)*. |
| D-16 | **Hoãn viết test suite** (pgTAP/E2E/unit) — ưu tiên build web hoàn chỉnh trước *(user chốt 2026-07-13)*. **RLS và bảo mật VẪN phải làm đầy đủ** — đó là tính năng, không phải test. Test suite quay lại ở Phase 7. |
| D-17 | Footer bản quyền dưới **mọi** trang: `© <năm> Bản quyền thuộc về POLYMIND` + `POLYMIND — Đồng Hành Cùng Bạn Vươn Xa` *(user chốt 2026-07-13)*. |

---

## 📖 NHẬT KÝ SESSION (mới nhất ở trên, giữ 6 entry)

### [2026-07-13] Phiên 1 — Claude — P1 + P2 (Scaffold + Schema/RLS/Seed)
- **Làm được:** Hoàn tất Phase 1 và Phase 2.
  - **P1:** scaffold Next.js 16 (App Router, TS strict + `noUncheckedIndexedAccess`), Tailwind v4 + shadcn/ui (13 component), theme POLYMIND (primary `#1A5FA8` lấy từ repo cũ; đỏ Trung Hoa tách riêng thành `--brand-red`, **không** ghi đè `--accent` của shadcn — nếu ghi đè thì mọi hover menu sẽ hóa đỏ). Logo PolyMind bo góc. Footer bản quyền mọi trang. 3 Supabase client tách bạch (browser/server/**admin có `server-only`**). Auth SSR + middleware fail-closed. App shell 3 role (sidebar desktop + bottom nav mobile ≥44px). CI GitHub Actions.
  - **P2:** 15 migration + seed. 33 bảng, 98 RLS policy, 5 view (`security_invoker`), 7 RPC transaction, 5 private bucket, 9 helper `app.*` fail-closed. Seed: HSK 1–6, 9 khóa cốt lõi, 2 chương trình VCB, 3 lớp (**LOP-01 cố tình KHÔNG có lịch lặp** — lịch linh hoạt theo Ban Giám đốc).
- **File thay đổi:** `supabase/migrations/*` (15 file), `supabase/seed.sql`, `supabase/seed.dev.sql`, `supabase/config.toml`, `src/lib/{env,supabase,auth,permissions}/*`, `src/features/auth/*`, `src/app/(auth)|(dashboard)|api|auth/*`, `src/components/{layout,shared,ui}/*`, `src/types/{database,roles}.ts`, `.github/workflows/ci.yml`, configs.
- **Migration/data impact:** Schema mới hoàn toàn (chưa có production → không có rủi ro dữ liệu). `supabase db reset` chạy sạch từ migration đầu, seed idempotent.
- **Đã test (THẬT, có số):** `npx tsc --noEmit` → sạch. `npx eslint` → 0 lỗi. `npx vitest run` → **10/10 pass**. `npx next build` → xanh, 27 route, mọi trang authenticated đều `ƒ` (dynamic, không cache session). `npx supabase db reset` → 15/15 migration + seed OK. **RLS kiểm chứng qua HTTP API thật** (login → JWT → PostgREST): GV A thấy đúng LOP-01/02 + HV001–004, **không** thấy HV005, tuition **0 dòng**, audit **0 dòng**; HV5 chỉ thấy LOP-03 + chính mình; anonymous `permission denied`. Smoke: `/api/health` 200, anonymous vào `/admin` → 307 `/login`.
- **Quyết định mới:** D-16 — **hoãn viết test suite** (user chốt 2026-07-13), ưu tiên build web hoàn chỉnh; RLS/bảo mật vẫn làm đủ.
- **Blocker/rủi ro:** BLK-1/BLK-2 (chưa có credential cloud) — không chặn Phase 3–6.
- **3 BẪY ĐÃ SẬP VÀ CÁCH TRÁNH (quan trọng cho phiên sau):**
  1. **Port Supabase:** 543xx nằm trong dải Windows/Hyper-V reserve `54289–54388` → `supabase start` chết. Đã dời sang **553xx** trong `config.toml`.
  2. **`[auth.email].enable_signup`:** tên nghe như "chặn đăng ký" nhưng CLI map nó sang `EXTERNAL_EMAIL_ENABLED` — đặt `false` là **tắt luôn ĐĂNG NHẬP** (`email_provider_disabled`). Chặn sign-up đúng cách là `[auth].enable_signup = false`.
  3. **Supabase bản mới KHÔNG tự GRANT** quyền bảng cho `anon`/`authenticated` → RLS policy viết đủ nhưng mọi role vẫn nhận `permission denied`. Phải có migration `..._grants.sql` tường minh.
  4. **Seed `auth.users`:** các cột `confirmation_token`, `recovery_token`, … phải là `''` chứ **không** được NULL, nếu không GoTrue crash khi login (`converting NULL to string`).
- **Next action:** **`P3-T1`** — layout admin + dashboard skeleton, rồi P3-T2 (CRUD Level/Course/Module/Lesson).

### [2026-07-13] Phiên 1 — Claude — P0-T1 → P0-T6 (Phase 0)
- **Làm được:** Hoàn tất Phase 0. Khảo sát read-only repo XKLĐ (source, 20 module QA board, docs 01–04, WORKLOG, AI/AGENTS.md). Dời folder `Polymind Chinese` ra khỏi repo cũ → sibling. `git init` repo mới trên `main`. Viết toàn bộ docs nền + bộ phối hợp AI.
- **File thay đổi:** `docs/01-business-analysis.md`, `docs/02-database-design.md`, `docs/03-workflow.md`, `docs/04-system-architecture.md`, `docs/05-testing-strategy.md`, `docs/06-deployment-vercel-supabase.md`, `docs/07-product-backlog.md`, `docs/08-phase-plan.md`, `docs/testing/MODULE_QA_BOARD.md`, `WORKLOG.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `.env.example`, `.gitignore`.
- **Migration/data impact:** Không có (chưa có schema).
- **Đã test:** Không có test để chạy (chưa có code). Đã xác minh môi trường: `node -v` → v22.20.0 · `npm -v` → 10.9.3 · `docker info` → daemon 28.4.0 chạy được · Supabase CLI và Vercel CLI **chưa cài** (sẽ dùng `npx`).
- **Quyết định mới:** D-14 (vị trí repo — sibling, user chốt), D-15 (local-first, user chốt).
- **Blocker/rủi ro:** BLK-1 (chưa có Supabase cloud), BLK-2 (chưa có Vercel). **Không chặn Phase 1–6.**
- **Bài học đã port từ repo XKLĐ (áp vào thiết kế mới):** (a) attribution phải là **actor thật**, không phải "user đầu tiên" — hệ cũ dính `BUG_M06_01`/`BUG_M12_01`; (b) idempotency phải cưỡng chế bằng **unique index ở DB**, app-level check thua race — hệ cũ trả hoa hồng 2 lần (`BUG_M09_01`); (c) một hành động = **một đường ghi** — hệ cũ có 3 đường set `Payment→Paid` lệch nhau (`BUG_M10_01`); (d) **không có nhánh `return true` mặc định** trong hàm phân quyền — hệ cũ dính `MessagingPolicy.CanMessage` fallback `true` (`CR-M14-3`); (e) export phải **giữ filter đang chọn** (`BUG_M16_01`); (f) không tạo trang monolith > 2.000 dòng như `CandidateDetail.razor`.
- **Next action:** **`P1-T1`** — scaffold Next.js (App Router + TS strict + npm), bật script lint/typecheck/test/build. DoD: `npm run build` + `npm run typecheck` xanh.
