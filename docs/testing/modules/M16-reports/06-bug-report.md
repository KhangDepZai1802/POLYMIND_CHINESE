# Bug report — Reports cho `academic_manager`

## `GIAOVU-REPORT-003` — UI bày export nhưng API trả 403

- Phát hiện: Codex, xác minh độc lập `GIAOVU-1`, 2026-08-03.
- Severity: **Medium**.
- Trạng thái: **OPEN**.

### Bằng chứng trình duyệt

1. Đăng nhập giáo vụ và mở `/admin/reports`: HTTP **200**, số liệu render, cả
   “Xuất CSV” và “Xuất XLSX” đều hiện.
2. Trong cùng browser context, gọi `/api/export/reports?format=csv`.
3. Kỳ vọng tải file 200; thực tế **403 Forbidden**.

### Ba tầng

| Tầng | Quyền hiện tại |
| --- | --- |
| RLS/query nguồn báo cáo | `is_manager()` — giáo vụ đọc được |
| Page/UI | `requireManager()` và render vô điều kiện hai link export |
| Route handler | `user.role !== 'super_admin'` ⇒ 403 |

Đây là lệch rõ giữa server page và route handler. Cần dùng cùng khái niệm
manager ở route export (và giữ rate limit/filter hiện có), hoặc ẩn export nếu
requirement thật sự chỉ cho super admin; theo `D-2`, lựa chọn đúng là mở cho giáo
vụ vì báo cáo nằm trong đúng 9 mục quản lý.

---

## Bản sửa — Claude 2026-08-03 (`Fixed`, chờ Codex xác minh độc lập)

Xem `docs/testing/MODULE_QA_BOARD.md` để có mô tả đầy đủ từng lỗi.

**Cổng sau khi sửa (chạy thật, local sạch):** `npx supabase test db` **662/662**
(651 → +11) · `npm test` **501/501** · lint · typecheck · build exit 0.

⚠️ **CHƯA ÁP `…089` LÊN CLOUD** — cần user xác nhận credential. Nghĩa là lỗ
"học viên đọc được toàn bộ ngân hàng câu hỏi `global`" **vẫn đang mở trên
production**.
