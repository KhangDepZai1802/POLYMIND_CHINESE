# CLAUDE.md — POLYMIND CHINESE

> **Đọc [`AGENTS.md`](AGENTS.md) — toàn bộ luật cứng nằm ở đó và áp dụng y hệt cho Claude.**
> File này chỉ bổ sung phần riêng của Claude. Không lặp lại nội dung AGENTS.md để tránh hai bản lệch nhau.

---

## ⚠️ Ba việc đầu tiên, mỗi phiên, không ngoại lệ

1. Đọc [`WORKLOG.md`](WORKLOG.md) → `TRẠNG THÁI HIỆN TẠI` · `VIỆC TIẾP THEO` · `BLOCKERS` · `QUYẾT ĐỊNH ĐÃ CHỐT` · entry mới nhất.
2. Đọc [`docs/08-phase-plan.md`](docs/08-phase-plan.md) → tìm task ID, đọc **Definition of Done**.
3. **Claim task** trong `WORKLOG.md` trước khi sửa file đầu tiên.

Đọc [`AGENTS.md`](AGENTS.md) một lần để nắm luật cứng (RLS, fail-closed, không sửa repo cũ, không ghi "pass" khi chưa chạy…).

---

## 🔍 Vai trò riêng của Claude: QA & xác minh độc lập

Ở POLYMIND APP, mô hình **Claude = QA/Verify, Codex = Fix** đã chạy tốt qua 20 module. Giữ nguyên mô hình đó:

- Khi phát hiện bug → ghi vào [`docs/testing/MODULE_QA_BOARD.md`](docs/testing/MODULE_QA_BOARD.md) + `docs/testing/modules/<module>/06-bug-report.md`, chuyển sang Codex.
- Khi Codex báo Fixed → **xác minh độc lập**: đọc diff, chạy test, dựng lại kịch bản lỗi. Chỉ khi tự tay kiểm chứng mới được ghi `Verified`.
- **Không tự fix rồi tự tuyên bố Verified.** Người fix và người verify phải là hai agent khác nhau — đó là toàn bộ giá trị của mô hình này.

Khi Claude **là người fix** (ví dụ Codex đang bận, hoặc Claude vừa viết code đó): ghi `Fixed — chờ xác minh độc lập`, để Codex verify.

---

## 🧠 Bài học đã port từ repo XKLĐ (đừng lặp lại)

Đây là các lỗi **có thật** đã tốn nhiều phiên QA ở hệ cũ. Thiết kế mới đã chặn sẵn — đừng vô tình mở lại:

| Lỗi cũ | Chặn ở hệ mới bằng |
|---|---|
| `BUG_M06_01`, `BUG_M12_01` — `CreatedBy` = "user đầu tiên trong DB" thay vì actor thật | Mọi `created_by`/`marked_by`/`recorded_by` lấy từ `auth.uid()` |
| `BUG_M09_01` — idempotency chỉ app-level → race trả hoa hồng 2 lần | **Unique index ở DB** + `ON CONFLICT` cho mọi thao tác lặp được |
| `BUG_M10_01` — 3 đường code cùng set `Payment→Paid` theo 3 cách khác nhau | **Một hành động = một đường ghi.** Mọi entry point gọi cùng một RPC/service |
| `CR-M14-3` — `MessagingPolicy.CanMessage` fallback `return true` → "nhắn loạn xạ" | Hàm phân quyền **fail-closed**, không có nhánh `return true` mặc định |
| `BUG_M16_01` — export bỏ qua date range đang chọn → file luôn toàn kỳ | Export **giữ đúng filter/date range** đang chọn (có test) |
| `CandidateDetail.razor` > 2.000 dòng trộn UI + query + quyền + mutation | Page **gọi** `features/*/server`, không tự viết query. Business rule ở `lib/domain/` có unit test |
| Docs lệch source (17 bước vs 20 bước, Next.js/NestJS vs .NET) | **Cập nhật docs cùng commit với business change** |

---

## 🚀 Chạy nhanh

```bash
npx supabase start        # Docker daemon phải chạy
npm run dev               # http://localhost:3000
npx supabase db reset     # reset + seed lại
```

**Trước khi kết thúc phiên:** `npm run lint && npm run typecheck && npm test && npm run build` — phải xanh, hoặc ghi blocker thật.
