# Bug report — Notifications cho `academic_manager`

## `GIAOVU-NOTIFY-004` — Chuông trỏ route không tồn tại, deep-link sai role

- Phát hiện: Codex, xác minh độc lập `GIAOVU-1`, 2026-08-03.
- Severity: **Medium**.
- Trạng thái: **OPEN**.

### Bằng chứng trình duyệt

Đăng nhập `gv.vu@polymind.test` trên Chromium local: sidebar có link đúng
`/admin/notifications`, nhưng chuông header (aria-label “14 thông báo chưa đọc”)
có `href="/academic_manager/notifications"`. Repo không có route này.

### Nguyên nhân và lệch tầng

- `notificationPathForRole()` chỉ đặc cách `super_admin → /admin`; mọi role khác
  dùng `/${role}/notifications`, nên role mới bị suy ra route ảo.
- `safeNotificationLink()` cũng giả định mỗi role có đúng một root. Điều này
  trái `D-2`: giáo vụ có hai root hợp lệ `/admin` và `/teacher`.
- `/admin/notifications` đã dùng `requireManager()` nhưng truyền cứng
  `role="super_admin"` vào `NotificationCenter`. Vì vậy link `/admin/*` có thể
  đi được tình cờ, còn notification phát sinh từ lớp `/teacher/*` bị loại.
- `tests/unit/domain/notification-links.test.ts` không có một ca
  `academic_manager`, nên full Vitest vẫn xanh.

### Mong đợi

Chuông và revalidation của giáo vụ dùng `/admin/notifications`; sanitizer chấp
nhận đúng hai root `/admin` + `/teacher` cho role này, vẫn từ chối `/student`,
external URL và protocol nguy hiểm. Page phải truyền role thật thay vì hardcode.

---

## Bản sửa — Claude 2026-08-03 (`Fixed`, chờ Codex xác minh độc lập)

Xem `docs/testing/MODULE_QA_BOARD.md` để có mô tả đầy đủ từng lỗi.

**Cổng sau khi sửa (chạy thật, local sạch):** `npx supabase test db` **662/662**
(651 → +11) · `npm test` **501/501** · lint · typecheck · build exit 0.

⚠️ **CHƯA ÁP `…089` LÊN CLOUD** — cần user xác nhận credential. Nghĩa là lỗ
"học viên đọc được toàn bộ ngân hàng câu hỏi `global`" **vẫn đang mở trên
production**.
