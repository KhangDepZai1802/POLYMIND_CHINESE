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

- **Phase 0 — XONG** (☑ P0-T1 → P0-T6). Repo mới dựng tại `Documents\Polymind Chinese`, git `main`.
- Docs nền đã đủ: `01-business-analysis` · `02-database-design` (ERD + RLS matrix) · `03-workflow` · `04-system-architecture` · `05-testing-strategy` · `06-deployment` · `07-backlog` · `08-phase-plan`.
- Bộ phối hợp AI đã dựng: `WORKLOG.md` (file này) · `AGENTS.md` · `CLAUDE.md` · `docs/testing/MODULE_QA_BOARD.md`.
- Repo XKLĐ (`POLYMIND APP`) **không bị sửa** — chỉ đọc. `git status` của repo cũ sạch.
- **Chưa có code app.** Phase 1 chưa bắt đầu.
- Môi trường máy: Node 22.20 ✅ · npm 10.9 ✅ · Docker 28.4 (daemon đang chạy) ✅ · Supabase CLI ❌ (dùng `npx supabase`) · Vercel CLI ❌.

---

## ➡️ VIỆC TIẾP THEO

**`P1-T1` — Scaffold Next.js.**

Cụ thể:
1. `npx create-next-app@latest` trong thư mục repo — App Router, TypeScript, ESLint, Tailwind, `src/`, alias `@/*`. Package manager **npm**.
2. Bật `strict: true` trong `tsconfig.json` (mặc định đã có — xác nhận lại).
3. Thêm Prettier + config.
4. Thêm script: `lint`, `typecheck`, `test`, `build`.
5. **DoD:** `npm run build` xanh, `npm run typecheck` xanh.

Sau đó theo thứ tự: `P1-T2` (UI stack) → `P1-T3` (test stack) → `P1-T4` (Supabase local) → … xem [`docs/08-phase-plan.md`](docs/08-phase-plan.md).

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

---

## 📖 NHẬT KÝ SESSION (mới nhất ở trên, giữ 6 entry)

### [2026-07-13] Phiên 1 — Claude — P0-T1 → P0-T6 (Phase 0)
- **Làm được:** Hoàn tất Phase 0. Khảo sát read-only repo XKLĐ (source, 20 module QA board, docs 01–04, WORKLOG, AI/AGENTS.md). Dời folder `Polymind Chinese` ra khỏi repo cũ → sibling. `git init` repo mới trên `main`. Viết toàn bộ docs nền + bộ phối hợp AI.
- **File thay đổi:** `docs/01-business-analysis.md`, `docs/02-database-design.md`, `docs/03-workflow.md`, `docs/04-system-architecture.md`, `docs/05-testing-strategy.md`, `docs/06-deployment-vercel-supabase.md`, `docs/07-product-backlog.md`, `docs/08-phase-plan.md`, `docs/testing/MODULE_QA_BOARD.md`, `WORKLOG.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `.env.example`, `.gitignore`.
- **Migration/data impact:** Không có (chưa có schema).
- **Đã test:** Không có test để chạy (chưa có code). Đã xác minh môi trường: `node -v` → v22.20.0 · `npm -v` → 10.9.3 · `docker info` → daemon 28.4.0 chạy được · Supabase CLI và Vercel CLI **chưa cài** (sẽ dùng `npx`).
- **Quyết định mới:** D-14 (vị trí repo — sibling, user chốt), D-15 (local-first, user chốt).
- **Blocker/rủi ro:** BLK-1 (chưa có Supabase cloud), BLK-2 (chưa có Vercel). **Không chặn Phase 1–6.**
- **Bài học đã port từ repo XKLĐ (áp vào thiết kế mới):** (a) attribution phải là **actor thật**, không phải "user đầu tiên" — hệ cũ dính `BUG_M06_01`/`BUG_M12_01`; (b) idempotency phải cưỡng chế bằng **unique index ở DB**, app-level check thua race — hệ cũ trả hoa hồng 2 lần (`BUG_M09_01`); (c) một hành động = **một đường ghi** — hệ cũ có 3 đường set `Payment→Paid` lệch nhau (`BUG_M10_01`); (d) **không có nhánh `return true` mặc định** trong hàm phân quyền — hệ cũ dính `MessagingPolicy.CanMessage` fallback `true` (`CR-M14-3`); (e) export phải **giữ filter đang chọn** (`BUG_M16_01`); (f) không tạo trang monolith > 2.000 dòng như `CandidateDetail.razor`.
- **Next action:** **`P1-T1`** — scaffold Next.js (App Router + TS strict + npm), bật script lint/typecheck/test/build. DoD: `npm run build` + `npm run typecheck` xanh.
