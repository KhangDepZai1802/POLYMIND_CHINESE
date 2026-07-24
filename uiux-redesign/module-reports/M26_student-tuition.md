# M26 — Học phí (Học viên)

| Field | Value |
| --- | --- |
| Module ID | `UIUX-M26` |
| Task | `P15-T7` |
| Route | `/student/tuition` |
| Agent | Claude |
| Ngày | 2026-07-22 |
| Trạng thái | **DONE — chờ xác minh độc lập** |

---

## 1. Phạm vi

| File | Vai trò | Được sửa? |
| --- | --- | --- |
| `src/features/tuition/components/student-tuition-overview.tsx` | Toàn bộ giao diện M26 | ✅ viết lại phần trình bày |
| `src/app/(dashboard)/student/tuition/page.tsx` | Wrapper, `requireRole` + query | ⛔ không sửa |
| `src/features/tuition/server/queries.ts` | `getTuitionInvoices` | ⛔ không sửa; đọc để biết trường nào đang bị bỏ không |
| `src/components/ui/alert.tsx` · `src/components/shared/status-badge.tsx` · `globals.css` | **Dùng chung** | ✅ sửa theo `DS-030` — xem §4 |

`student-tuition-overview.tsx` nằm trong `features/tuition/components/` nhưng **chỉ có đúng một consumer** (`grep -rn "StudentTuitionOverview" src/` → 1 import). Màn quản trị dùng `invoice-manager.tsx` riêng, không dùng chung component này.

---

## 2. Bằng chứng audit

| ID | Mức | Vấn đề | Bằng chứng (trước khi sửa) |
| --- | --- | --- | --- |
| `UX-M26-001` | High | **`subtotal` và `discount` được truy vấn nhưng không hiển thị ở đâu.** Học viên được giảm trừ mà **không thấy mình được giảm bao nhiêu** — trên một màn về tiền, đây là thiếu sót nghiêm trọng hơn thẩm mỹ | `queries.ts:16` select có `subtotal, discount`; `types.ts:53-54` có trong record; component chỉ dùng `total`/`paid_amount`/`balance`. Cùng loại với `attendance_rate` ở M25 |
| `UX-M26-002` | High | `text-xs` (12px) cho **thông tin tài chính then chốt**: hạn đóng, ngày lập, mã phiếu thu, phương thức + thời điểm thanh toán, số tham chiếu, đơn giá × số lượng | `student-tuition-overview.tsx:113,124-127,147,188,192-198,200` — mẫu `UX-M00-004` |
| `UX-M26-003` | High | **Không có heading cấp 2 nào**; `<h3>` ở `:175` nhảy thẳng từ `<h1>` của `PageHeader` | `:105` `CardTitle` mặc định `<div>` (`ui/card.tsx:44`); `:175` `<h3>` không có `<h2>` cha |
| `UX-M26-004` | Medium | **Không có thanh tiến độ đóng học phí.** Tỉ lệ đã đóng / tổng là con số hữu ích nhất trên màn này mà lại phải tự tính | `:34-37` tính sẵn `total`/`paid` rồi chỉ in ra chữ |
| `UX-M26-005` | Medium | Ô "Hóa đơn quá hạn" **dùng màu làm kênh thông tin duy nhất** — chỉ đổi chữ sang `text-destructive`, không có chữ nào nói tình trạng | `:84-89` — vi phạm WCAG 1.4.1 |
| `UX-M26-006` | Medium | Bốn ô tóm tắt là `Card` trắng trơn, không icon, không semantic palette — lệch hẳn M20–M25 | `:41-50`, `:81-95` |
| `UX-M26-007` | Medium | Khối tiền dùng `div` thuần cho các cặp nhãn–số tiền, không có ngữ nghĩa danh sách mô tả | `:161-165`, `:218-237` |
| `UX-M26-008` | Low | `bg-muted/30` — opacity modifier trên token, mẫu đã bị gỡ ở M14 (`primary/10` → `primary-50`) | `:161` |
| `UX-M26-009` | Low | Icon `WalletCards` ở góc header không mang thông tin; ở 360px bị `flex-wrap` đẩy xuống một dòng riêng thành icon lạc lõng | `:119` — **phát hiện bằng ảnh chụp mobile**, không phải bằng đọc code |
| `UX-M26-010` | Low | Empty state không có lối đi tiếp | `:24-28` |

---

## 3. Đã làm

| # | Thay đổi | Đóng issue |
| --- | --- | --- |
| S01 | **Bento tóm tắt 4 ô** có icon + semantic palette: Tổng hóa đơn (sky) · Đã thanh toán (cyan) · Còn phải đóng (amber) · Hóa đơn quá hạn (coral khi >0, sky khi =0). Ô quá hạn có **dòng chữ** "Không có hóa đơn quá hạn." / "Cần xử lý sớm." nên màu không còn là kênh duy nhất | `-005`, `-006` |
| S02 | **Thanh tiến độ đóng học phí** với `aria-valuetext` đọc bằng **tiền thật** chứ không chỉ phần trăm; chặn chia cho 0 khi `total ≤ 0` | `-004` |
| S03 | **Hiện `Tạm tính` và `Giảm trừ`** — nhưng **chỉ khi `discount > 0`**, để hóa đơn thường không bị thêm nhiễu. Chữ lấy **đúng như màn quản trị đang dùng** (`invoice-manager.tsx:244-245`), không đặt từ mới | `-001` |
| S04 | `<h2>` "Tổng quan học phí" / "Hóa đơn của bạn (N)"; `CardTitle asChild` → `<h3>` cho mã hóa đơn; `<h4>` cho "Thanh toán & phiếu thu" — hết nhảy cấp | `-003` |
| S05 | Gỡ **toàn bộ** `text-xs` cho nội dung tài chính → `text-sm` + `text-text-secondary` + `leading-6`. Mã phiếu thu từ `font-mono text-xs` → `font-mono text-sm` | `-002` |
| S06 | Khối tiền thành `<dl>` với `<dt>`/`<dd>` | `-007` |
| S07 | `bg-muted/30` → `bg-surface-sunken` (token đặc, đã có sẵn) | `-008` |
| S08 | Gỡ icon `WalletCards` trang trí ở header hóa đơn | `-009` |

`-010` **để mở**: trang học phí không có hành động nào học viên tự làm được (không có cổng thanh toán), nên "lối đi tiếp" duy nhất là liên hệ trung tâm — mà đó là thêm nội dung nghiệp vụ mới, ngoài phạm vi. Ghi lại thay vì bịa một nút.

---

## 4. Sửa hai lỗi contrast ở tầng dùng chung — `DS-030`

E2E axe **fail ngay lần chạy đầu** với hai vi phạm `color-contrast`. Cả hai **có sẵn từ trước**, không do đợt này sinh ra; fixture hóa đơn quá hạn chỉ làm chúng lộ ra.

| Chỗ | Trước | Đo | Sau | Đo |
| --- | --- | --- | --- | --- |
| `ui/alert.tsx:15` — mô tả trong `Alert` đỏ | `text-destructive/90` → `#E03C3C` trên trắng | **4.30:1** ❌ | `text-destructive` → `#DC2626` | **4.83:1** ✅ |
| `shared/status-badge.tsx:9` — badge `danger`, chữ 12px | `#DC2626` trên `#FBE5E5` | **4.01:1** ❌ | `--danger-ink: #B91C1C`, nền giữ nguyên | **5.37:1** ✅ |

**Đã đo cả 5 tone để không phải quay lại lần hai:** `success` 5.95 · `warning` 5.88 · `info` 5.58 — **đều đạt**; chỉ `danger` hỏng.

**Nguyên nhân chung, đáng nhớ:** *opacity modifier phá đúng cái contrast mà token được chọn để đạt*. `--destructive: #DC2626` được chọn vì nó đạt 4.83:1 trên trắng; `/90` kéo nó xuống 4.30. Cùng họ với `UX-M00-002`.

**Impact map** ghi đầy đủ trong `DS-030`: `Alert variant="destructive"` có **27 file** consumer; `StatusBadge tone="danger"` phủ `cancelled` ×3, `withdrawn`, `absent`, `overdue`. Tất cả **chỉ đậm màu chữ lên** — không đổi hình dáng, kích thước hay bố cục, nên không có module nào cần dựng lại.

> ⚠️ Đây là thay đổi chạm Admin/Teacher. **User đã duyệt trước khi viết code** (`DS-030`), không phải sửa xong mới báo.

---

## 5. Completion gate

| Mục | Lệnh / cách đo | Kết quả |
| --- | --- | --- |
| Tất cả màn trong phạm vi | `/student/tuition` — tóm tắt, danh sách hóa đơn, phiếu thu, empty | ✅ |
| Component test M26 | `tests/unit/components/student-tuition-overview.test.tsx` | ✅ **8/8 PASS** |
| E2E responsive/a11y | Chromium + Pixel 7, 360/768/1280, axe `wcag2a/2aa/21a/21aa`, không overflow | ✅ **4/4 PASS** |
| Visual inspection | 3 ảnh Chromium | ✅ — bắt được `UX-M26-009` |
| Loading/empty/error | Empty: chưa có hóa đơn · chưa có thanh toán. Error: `error.tsx` của `(dashboard)` (`DS-018`) | ✅ |
| Keyboard focus | Trang chỉ-đọc, không có control tương tác mới | ➖ |
| Không đổi nghiệp vụ | Không sửa query/action/RPC/RLS/route. **Không đặt nhãn mới** — "Tạm tính"/"Giảm trừ" lấy nguyên từ màn quản trị | ✅ |
| Sửa shared component | **Có** — `alert.tsx`, `status-badge.tsx`, `globals.css`. Impact map ở `DS-030` | ✅ đã duyệt trước |
| Lint | `npm run lint` | ✅ PASS |
| Type-check | `npm run typecheck` | ✅ PASS |
| Test | `npm test -- --maxWorkers=4` | ✅ **199/199 PASS** (58 file, +8 so với 191 sau M25) |
| Build | `npm run build` | ✅ PASS |
| Changelog | `06_UIUX_CHANGELOG.md` | ✅ |
| Checkpoint | trỏ sang `P15-T8` / M27 | ✅ |

**Fixture E2E tự dọn:** 2 hóa đơn (một có giảm trừ + thu một phần, một quá hạn chưa thu), 2 dòng khoản mục, 1 phiếu thu. Không đụng dữ liệu seed.

> **Claude là người viết code này** → **không tự ghi Verified**. Cần Codex/user xác minh độc lập.

### Cần xác minh độc lập, ưu tiên theo thứ tự

1. **`DS-030` không làm hỏng chỗ khác** — mở vài màn Admin/Teacher có `Alert` lỗi đỏ (đăng nhập sai mật khẩu, form thiếu trường) và badge `Đã hủy`/`Vắng`/`Quá hạn`: chữ phải **đậm hơn một chút**, mọi thứ khác y nguyên.
2. **Số tiền** — đối chiếu Tổng / Đã thanh toán / Còn phải đóng / % tiến độ với `select total, discount from tuition_invoices` và `select * from v_tuition_balance` của chính học viên đó.
3. **Giảm trừ** — hóa đơn có `discount > 0` phải hiện đủ cặp Tạm tính/Giảm trừ; hóa đơn `discount = 0` **không được** hiện.
4. **Không hóa đơn nào quá hạn** → ô thứ tư phải nói "Không có hóa đơn quá hạn." và **không** hiện `Alert` đỏ ở đầu trang.
