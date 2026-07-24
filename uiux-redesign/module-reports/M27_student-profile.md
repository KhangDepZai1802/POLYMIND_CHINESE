# M27 — Hồ sơ (Học viên)

| Field | Value |
| --- | --- |
| Module ID | `UIUX-M27` |
| Task | `P15-T8` |
| Route | `/student/profile` |
| Agent | Claude |
| Ngày | 2026-07-22 |
| Trạng thái | **DONE — chờ xác minh độc lập** |

---

## 1. Phạm vi

| File | Vai trò | Được sửa? |
| --- | --- | --- |
| `src/app/(dashboard)/student/profile/page.tsx` | Khối "Thông tin học viên" (chỉ đọc) | ✅ trình bày |
| `src/features/student/components/profile-panel.tsx` | Hai form: liên hệ + đổi mật khẩu | ✅ trình bày + ARIA |
| `src/features/student/server/profile-actions.ts` | Server action + Zod schema | ⛔ **không sửa một dòng nào** — đọc để lấy đúng giới hạn cần phản chiếu |

Đây là màn **duy nhất trong M20–M27 có thao tác ghi của học viên**, nên trọng tâm là ARIA của lỗi form chứ không phải trang trí.

---

## 2. Bằng chứng audit

| ID | Mức | Vấn đề | Bằng chứng (trước khi sửa) |
| --- | --- | --- | --- |
| `UX-M27-001` | **High** | **Lỗi field không được trình đọc màn hình đọc lên.** `FieldError` render một `<p>` trơn: không `role="alert"`, không `id`; ô nhập không có `aria-invalid`, không có `aria-describedby`. Người dùng bàn phím/đọc màn hình submit xong **không biết vì sao form không đi** | `profile-panel.tsx:16-18` và cả 4 ô nhập ở `:47-62`, `:92-115`. Đúng mẫu đã sửa ở `M14-S03` (`DS-025`) — lặp lại ở module khác |
| `UX-M27-002` | High | **Yêu cầu mật khẩu không được nói ra.** `minLength={8}` chỉ tồn tại dưới dạng thuộc tính HTML → người dùng gõ 5 ký tự, bị trình duyệt chặn bằng thông báo mặc định, không có dòng nào trên trang cho biết luật là gì trước khi gõ | `:99` |
| `UX-M27-003` | Medium | `text-xs` (12px) cho **thông báo lỗi** — đúng chỗ cần đọc rõ nhất lại là chữ nhỏ nhất | `:17` — mẫu `UX-M00-004` |
| `UX-M27-004` | Medium | **Không có heading cấp 2 nào.** Ba khối lớn của trang đều dùng `CardTitle` mặc định `<div>` | `page.tsx:45`, `profile-panel.tsx:33,78`; `ui/card.tsx:44` |
| `UX-M27-005` | Medium | Khối "Thông tin học viên" là 8 cặp nhãn–giá trị nhưng dùng hai `<span>` cạnh nhau — quan hệ nhãn ↔ giá trị chỉ tồn tại **bằng vị trí trên màn hình**, không có ngữ nghĩa | `page.tsx:71-78` |
| `UX-M27-006` | Low | Client không phản chiếu giới hạn độ dài của server (`full_name` 120, `phone` 20, `password` 72) → gõ quá dài mới biết khi submit | `profile-actions.ts:15-37` có giới hạn; form không có `maxLength` nào |
| `UX-M27-007` | Low | Không có semantic palette; ba thẻ trắng giống hệt nhau, lệch M20–M26 | `page.tsx:44`, `profile-panel.tsx:31,76` |

### Mục **không phải lỗi** — ghi rõ

**Không có phản hồi khi lưu thành công?** — **Có.** `useFormAction` gọi `toast.success(result.success)` (`lib/use-form-action.ts:50`) và `profile-actions.ts` trả `"Đã cập nhật thông tin liên hệ."` / `"Đã đổi mật khẩu."`. Không thiếu, **không sửa**.

---

## 3. Đã làm

| # | Thay đổi | Đóng issue |
| --- | --- | --- |
| S01 | **`FieldError` có `role="alert"` + `id`**; cả 4 ô nhập có `aria-invalid` và `aria-describedby` — **chỉ khi thật sự có lỗi**, để không ô nào bị đọc là "không hợp lệ" ngay lúc mở trang | `-001` |
| S02 | **Dòng "Tối thiểu 8 ký tự." hiện trên trang**, và ô mật khẩu `aria-describedby` **luôn** trỏ tới nó; khi có lỗi thì trỏ tới **cả hai** (`"password-hint password-error"`) | `-002` |
| S03 | Lỗi từ `text-xs` → `text-sm` | `-003` |
| S04 | `CardTitle asChild` → `<h2>` cho cả ba khối | `-004` |
| S05 | Khối thông tin học viên thành `<dl>` với `<dt>`/`<dd>` | `-005` |
| S06 | `maxLength` phản chiếu **đúng** `contactSchema`/`passwordSchema`: 120 · 20 · 72. **Không đặt số nào khác**, không tạo luật validation mới — nguyên tắc đã chốt ở `DS-021` | `-006` |
| S07 | Icon có nền semantic: sky (liên hệ) · cyan (thông tin học viên) · amber (đổi mật khẩu) | `-007` |

---

## 4. Impact map

`profile-panel.tsx` và `student/profile/page.tsx` **chỉ phục vụ khu vực học viên**; không component dùng chung nào bị sửa trong M27. Không thêm token. Không đổi `profile-actions.ts`, schema, route, RLS hay chữ của bất kỳ thông báo nào.

---

## 5. Completion gate

| Mục | Lệnh / cách đo | Kết quả |
| --- | --- | --- |
| Tất cả màn trong phạm vi | 3 khối của `/student/profile` | ✅ |
| Component test M27 | `tests/unit/components/student-profile-panel.test.tsx` | ✅ **5/5 PASS** |
| E2E responsive/a11y | Chromium + Pixel 7, 360/768/1280, axe `wcag2a/2aa/21a/21aa`, không overflow | ✅ **6/6 PASS** |
| **E2E trạng thái lỗi** | Submit tên 1 ký tự → axe vẫn sạch, `role="alert"` đúng `id`, ô nhập `aria-invalid` + `aria-describedby` | ✅ |
| **E2E bàn phím** | Tab đi đúng thứ tự Họ tên → SĐT → Lưu → Mật khẩu mới | ✅ |
| Visual inspection | 3 ảnh Chromium | ✅ |
| Loading/empty/error | Trường trống hiện `—`; lỗi form có ARIA; error boundary `DS-018` | ✅ |
| Không đổi nghiệp vụ | Không sửa action/schema/route/RLS; không đổi chữ thông báo nào | ✅ |
| Sửa shared component | Không có | ➖ |
| Lint | `npm run lint` | ✅ PASS |
| Type-check | `npm run typecheck` | ✅ PASS |
| Test | `npm test -- --maxWorkers=4` | ✅ **204/204 PASS** (59 file) |
| Build | `npm run build` | ✅ PASS |
| Changelog | `06_UIUX_CHANGELOG.md` | ✅ |
| Checkpoint | trỏ sang `P15-T9` | ✅ |

**E2E không cần fixture** và **không ghi gì vào DB**: kịch bản lỗi dùng tên 1 ký tự, bị `contactSchema` chặn ở server trước khi có `update` nào chạy.

> **Claude là người viết code này** → **không tự ghi Verified**. Cần Codex/user xác minh độc lập.

### Cần xác minh độc lập

1. **Đọc màn hình** — bật NVDA/VoiceOver, submit form với tên 1 ký tự: phải **nghe** được câu lỗi, và khi focus lại ô Họ tên phải nghe cả nhãn lẫn lỗi.
2. **Ô mật khẩu** — focus vào phải nghe "Mật khẩu mới, Tối thiểu 8 ký tự."
3. **Lưu thành công thật** — đổi số điện thoại rồi Lưu: phải thấy toast "Đã cập nhật thông tin liên hệ." và số mới còn nguyên sau khi F5.
4. **Đổi mật khẩu thật** — cần làm trên tài khoản thử, không phải tài khoản đang dùng để test tiếp.

---

## 6. Hai kỹ thuật E2E rút ra ở M27

1. **Đừng gọi `.focus()` ngay sau `domcontentloaded`.** React hydrate xong sẽ lấy mất focus vừa đặt và test fail với `Received: inactive`. Đợi một control đã hydrate (`toBeEnabled()`) rồi `.click()` — vừa ổn định vừa giống thao tác thật.
2. **`getByLabel` khớp theo chuỗi con.** `getByLabel("Mật khẩu mới")` khớp cả `"Nhập lại mật khẩu mới"` → strict mode violation. Nhãn nào là tiền tố của nhãn khác thì phải `{ exact: true }`.
