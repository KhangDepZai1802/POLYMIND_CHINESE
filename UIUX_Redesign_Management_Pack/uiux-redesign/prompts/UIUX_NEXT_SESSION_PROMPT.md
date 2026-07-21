# Prompt cho session tiếp theo

Tiếp tục quy trình audit và cải thiện UI/UX từ checkpoint hiện tại.

## Bắt buộc

1. Đọc đầy đủ skill `ui-ux-pro-max`.
2. Đọc theo thứ tự:
   - `uiux-redesign/00_UIUX_README.md`
   - `uiux-redesign/01_UIUX_GOVERNANCE.md`
   - `uiux-redesign/02_UIUX_DESIGN_SYSTEM.md`
   - `uiux-redesign/03_UIUX_MODULE_INVENTORY.md`
   - `uiux-redesign/04_UIUX_MODULE_BOARD.md`
   - `uiux-redesign/05_UIUX_SESSION_CHECKPOINT.md`
   - Báo cáo module active trong `uiux-redesign/module-reports/`
3. Không audit lại toàn bộ dự án.
4. Chỉ đọc source được liệt kê trong checkpoint và source liên quan trực tiếp đến module active.
5. Tiếp tục đúng mục `Next Exact Action`.
6. Chỉ xử lý một module.
7. Không bắt đầu module khác.
8. Không thay business logic, database, API, route, permission, validation hoặc nội dung.
9. Sau mỗi màn hình/subtask phải cập nhật ngay:
   - Báo cáo module.
   - Module board.
   - Session checkpoint.
   - Changelog nếu đã triển khai code.
   - Issues log nếu phát hiện vấn đề.
10. Sau khi hoàn tất module phải chạy lint, type-check và build.
11. Không dùng ignore, disable rule hoặc làm yếu cấu hình.
12. Nếu có lỗi ngoài phạm vi, ghi bằng chứng và đánh dấu `BLOCKED`.
13. Kết thúc bằng báo cáo ngắn:
    - Đã làm gì.
    - File nào thay đổi.
    - Responsive.
    - Kết quả kiểm tra.
    - Hành động tiếp theo chính xác.
