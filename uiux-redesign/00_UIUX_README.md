# UI/UX Redesign Management

## Mục đích

Thư mục này là nguồn sự thật duy nhất để quản lý việc audit và cải thiện UI/UX toàn bộ dự án theo từng module.

Mục tiêu:

- Chia toàn bộ công việc thành từng task theo module.
- Mỗi thời điểm chỉ xử lý một module.
- Giữ nguyên kiến trúc, nghiệp vụ, database, API, route và phân quyền.
- Giữ nguyên màu chủ đạo và nhận diện hiện tại.
- Cho phép AI hoặc session khác tiếp tục đúng vị trí mà không phải audit lại toàn bộ dự án.
- Ghi lại đầy đủ file đã sửa, màn hình đã hoàn thành, kiểm tra responsive và kết quả lint/type-check/build.

## Thứ tự đọc bắt buộc

AI phải đọc theo thứ tự sau trước khi sửa code:

1. `00_UIUX_README.md`
2. `01_UIUX_GOVERNANCE.md`
3. `02_UIUX_DESIGN_SYSTEM.md`
4. `03_UIUX_MODULE_INVENTORY.md`
5. `04_UIUX_MODULE_BOARD.md`
6. `05_UIUX_SESSION_CHECKPOINT.md`
7. Báo cáo module hiện tại trong `module-reports/`
8. `06_UIUX_CHANGELOG.md`
9. `07_UIUX_ISSUES_LOG.md`
10. `08_UIUX_DECISIONS.md`

Không đọc lại toàn bộ source code nếu các file quản lý đã có đủ thông tin. Chỉ khảo sát lại source liên quan trực tiếp đến module đang làm hoặc khi checkpoint ghi rõ dữ liệu cũ không còn chính xác.

## Vai trò của từng file

| File | Vai trò |
|---|---|
| `01_UIUX_GOVERNANCE.md` | Luật bắt buộc, giới hạn phạm vi và quy trình |
| `02_UIUX_DESIGN_SYSTEM.md` | Design token, component rule và màu chủ đạo đã xác nhận |
| `03_UIUX_MODULE_INVENTORY.md` | Danh sách module, route, màn hình và source liên quan |
| `04_UIUX_MODULE_BOARD.md` | Trạng thái toàn bộ module và task đang hoạt động |
| `05_UIUX_SESSION_CHECKPOINT.md` | Điểm tiếp tục của session kế tiếp |
| `06_UIUX_CHANGELOG.md` | Nhật ký thay đổi đã triển khai |
| `07_UIUX_ISSUES_LOG.md` | Vấn đề UI/UX, accessibility và vấn đề nghiệp vụ chỉ ghi nhận |
| `08_UIUX_DECISIONS.md` | Các quyết định thiết kế đã chốt |
| `templates/UIUX_MODULE_TASK_TEMPLATE.md` | Mẫu tạo báo cáo cho mỗi module |
| `prompts/UIUX_MASTER_PROMPT.md` | Prompt dùng cho phiên đầu tiên |
| `prompts/UIUX_NEXT_SESSION_PROMPT.md` | Prompt dùng cho các phiên tiếp theo |

## Quy tắc nguồn sự thật

Khi thông tin mâu thuẫn, ưu tiên theo thứ tự:

1. Source code hiện tại.
2. `08_UIUX_DECISIONS.md`.
3. `02_UIUX_DESIGN_SYSTEM.md`.
4. Báo cáo module mới nhất.
5. `05_UIUX_SESSION_CHECKPOINT.md`.
6. Các file còn lại.

## Quy tắc một module mỗi task

- Một task chính chỉ được gắn với một `Module ID`.
- Không sửa UI của module khác trong cùng task.
- Component dùng chung chỉ được sửa khi thật sự cần cho module hiện tại.
- Nếu sửa component dùng chung, phải đánh giá ảnh hưởng và ghi vào báo cáo module.
- Không chuyển sang module kế tiếp khi chưa cập nhật đầy đủ board, checkpoint, changelog và báo cáo module.
