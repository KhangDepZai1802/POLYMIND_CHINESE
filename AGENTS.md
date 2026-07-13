# AGENTS.md — POLYMIND CHINESE

> Dành cho **mọi AI agent** làm việc trên repo này (Codex, Claude, hoặc bất kỳ agent nào khác).
> Claude đọc thêm [`CLAUDE.md`](CLAUDE.md) — nội dung cốt lõi giống hệt file này.

---

## ⚠️ BẮT BUỘC — TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

**1. Đọc [`WORKLOG.md`](WORKLOG.md).** Đó là file phối hợp chung giữa các phiên AI. Đọc:
- `TRẠNG THÁI HIỆN TẠI` — đang ở đâu, ai đang làm gì
- `VIỆC TIẾP THEO` — **task ID** bạn phải làm
- `BLOCKERS` — cái gì đang chặn
- `QUYẾT ĐỊNH ĐÃ CHỐT` — **không được tự đổi**
- entry mới nhất trong `NHẬT KÝ SESSION`

**2. Đọc [`docs/08-phase-plan.md`](docs/08-phase-plan.md)** — tìm task ID đó, đọc **Definition of Done** của nó.

**3. Claim task**: ghi vào `WORKLOG.md` → `TRẠNG THÁI HIỆN TẠI`:
```
P2-T11 — đang làm — Codex — 2026-07-15
```

**4. Đọc docs nền liên quan tới task** (một lần là đủ, không cần đọc lại mỗi phiên):
- [`docs/01-business-analysis.md`](docs/01-business-analysis.md) — nghiệp vụ, role matrix, business rules
- [`docs/02-database-design.md`](docs/02-database-design.md) — schema, **RLS matrix**, RPC, Storage
- [`docs/03-workflow.md`](docs/03-workflow.md) — luồng nghiệp vụ + failure path
- [`docs/04-system-architecture.md`](docs/04-system-architecture.md) — kiến trúc, quy tắc code

---

## 🔒 LUẬT CỨNG — vi phạm là hỏng sản phẩm

### Nguồn sự thật
- **Docs = nguồn sự thật về YÊU CẦU.** Migration + source = nguồn sự thật về **IMPLEMENTATION**.
- Lệch nhau → sửa cho khớp và **cập nhật docs trong cùng commit**. Không để lệch âm thầm.
- **Không tự đổi quyết định đã chốt** (`WORKLOG.md` → `QUYẾT ĐỊNH ĐÃ CHỐT`). Vướng thì **hỏi user**.

### Bảo mật (không thương lượng)
- **Mọi bảng `public` phải `ENABLE ROW LEVEL SECURITY`.** Không có ngoại lệ.
- **Không bypass RLS bằng service role cho user flow.** Admin client (`lib/supabase/admin.ts`) chỉ dùng cho: invite user, khóa/mở tài khoản, đổi role, seed. Đếm được trên đầu ngón tay.
- **Fail-closed.** Hàm phân quyền **không được có nhánh `return true` mặc định**. Thiếu mapping → **deny**.
- **Ẩn menu/nút KHÔNG PHẢI phân quyền.** Mọi mutation kiểm quyền ở server **và** được RLS chặn ở DB.
- **Không dùng `user_metadata`** làm nguồn phân quyền (client sửa được). Role đọc từ bảng `profiles`.
- **Không commit secret.** `SUPABASE_SERVICE_ROLE_KEY` không bao giờ có tiền tố `NEXT_PUBLIC_`.
- Dùng `supabase.auth.getUser()`, **không** dùng `getSession()` ở server (cookie chưa verify).

### Dữ liệu
- **Migration phải có test.** Đổi schema mà không có pgTAP/integration test → chưa xong.
- **Không sửa migration đã chạy production.** Sai thì viết migration mới (forward-fix).
- **Không migration lúc app startup.**
- **Không hard delete dữ liệu lịch sử.** Dùng status/archive.
- **Idempotency cưỡng chế ở DB** (unique index + `ON CONFLICT`), không phải app-level check.
- **Attribution = actor thật** (`auth.uid()`), không bao giờ là "user đầu tiên tìm thấy".

### Repo
- **KHÔNG BAO GIỜ sửa repo XKLĐ** (`C:\Users\khang\OneDrive\Documents\POLYMIND APP`). Chỉ đọc. Không sửa, không format, không ghi WORKLOG của nó.
- **Không ghi đè thay đổi ngoài scope task của mình.** Agent kia có thể đang làm ở đó.
- **Không tạo module/route/table/enum/menu cho domain XKLĐ** (lead, ứng viên, đơn hàng, visa, chuyến bay, đại lý, hoa hồng, vay, nợ, chat). Xem `docs/01` §4.2.

### Trước khi kết thúc phiên
```bash
npm run lint && npm run typecheck && npm test && npm run build
```
**Phải xanh.** Không xanh → ghi **blocker thật** vào `WORKLOG.md`, ghi rõ "đang dở, chưa build". **Không được ghi "pass" khi chưa chạy.**

### Ba điều tuyệt đối cấm
- ❌ Ghi **"pass / done / verified / deployed"** khi chưa chạy/kiểm chứng thật.
- ❌ **Sửa test cho nó xanh** thay vì sửa code.
- ❌ Báo "hoàn thành" khi chưa đạt Definition of Done của task.

---

## 📋 KẾT THÚC PHIÊN — checklist

- [ ] Cập nhật `TRẠNG THÁI HIỆN TẠI` trong `WORKLOG.md`
- [ ] Cập nhật `VIỆC TIẾP THEO` (task ID kế tiếp, cụ thể)
- [ ] Thêm 1 entry vào `NHẬT KÝ SESSION` (giữ tối đa 6 entry — xóa cũ nhất)
- [ ] Đánh dấu ô trạng thái trong `docs/08-phase-plan.md` (`☐` → `☑` / `◐` / `⛔`)
- [ ] Có bug/QA → cập nhật `docs/testing/MODULE_QA_BOARD.md`
- [ ] Có blocker → ghi vào `BLOCKERS`
- [ ] Lint / typecheck / test / build xanh (hoặc blocker được ghi rõ)
- [ ] Commit

---

## 🤝 PHÂN VAI Claude ⇄ Codex

**Không chia cứng theo phase** — session nào hết token thì session sau đọc `WORKLOG.md` và làm tiếp task ID kế tiếp. Task được thiết kế đủ nhỏ để một phiên làm xong một task.

Riêng ở giai đoạn QA (Phase 7 và bất cứ khi nào phát hiện bug), theo mô hình đã chạy tốt ở POLYMIND APP:

| Vai | Ai | Việc |
|---|---|---|
| **QA / Verify** | Claude | Phân tích module, viết test case, tìm bug, **xác minh độc lập** fix của Codex |
| **Fix** | Codex | Sửa bug trong `docs/testing/MODULE_QA_BOARD.md` → cột *Codex Status* |

Bảng QA: [`docs/testing/MODULE_QA_BOARD.md`](docs/testing/MODULE_QA_BOARD.md). Người fix **không** tự tuyên bố "Verified" — phải để agent kia xác minh độc lập.

---

## 🚀 Tóm tắt kỹ thuật

- **Stack:** Next.js (App Router) + TypeScript strict + Tailwind + shadcn/ui + Supabase (Auth/Postgres/Storage) + Vercel. Package manager: **npm**.
- **Chạy local:**
  ```bash
  npx supabase start      # cần Docker daemon
  npm run dev             # http://localhost:3000
  ```
- **Reset DB + seed:** `npx supabase db reset`
- **Generate types:** `npx supabase gen types typescript --local > src/types/database.ts`
- **3 role:** `super_admin` · `teacher` · `student`
- **Bẫy quan trọng:** DB lưu **UTC**; hiển thị và sinh recurrence theo `Asia/Ho_Chi_Minh`. Trang authenticated **không** cache/ISR.
