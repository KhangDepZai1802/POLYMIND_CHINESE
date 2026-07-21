# UI/UX Module Inventory

> AI phải tạo danh sách này từ route, sidebar, navigation, page folders và phân quyền thực tế. Không tự nghĩ thêm module.

## Quy tắc xác định module

Một module thường được xác định bởi một hoặc nhiều tín hiệu:

- Mục cấp cao trong sidebar/navigation.
- Nhóm route có cùng nghiệp vụ.
- Nhóm page có chung layout và permission scope.
- Nhóm chức năng người dùng nhận biết như một khu vực độc lập.

Không tách một modal hoặc component nhỏ thành module riêng. Không gộp nhiều khu vực nghiệp vụ độc lập vào một module.

## Danh sách module

| Order | Module ID | Tên module | Route chính | Màn hình | Role/phạm vi | Source liên quan | Phụ thuộc | Trạng thái |
|---:|---|---|---|---|---|---|---|---|
| 1 | M01 | TBD | TBD | TBD | TBD | TBD | TBD | NOT_STARTED |

## Shared UI Foundation

| Shared ID | Thành phần | Source | Module sử dụng | Ghi chú |
|---|---|---|---|---|
| SH01 | App shell/layout | TBD | TBD | Chỉ sửa khi cần |
| SH02 | Sidebar/navigation | TBD | TBD | Giữ route/permission |
| SH03 | Button primitives | TBD | TBD | Không đổi behavior |
| SH04 | Form primitives | TBD | TBD | Giữ validation |
| SH05 | Table primitives | TBD | TBD | Kiểm tra ảnh hưởng chéo |
| SH06 | Modal/dialog | TBD | TBD | Giữ interaction logic |
| SH07 | Feedback states | TBD | TBD | Loading/empty/error/success |

## Cách đặt thứ tự ưu tiên

Ưu tiên trước:

1. App shell và navigation nếu đang gây lỗi thao tác trên nhiều module.
2. Module có tần suất sử dụng cao.
3. Module có rủi ro nhầm lẫn cao.
4. Module có component dùng chung cho nhiều nơi.
5. Module ít dùng hoặc báo cáo cuối cùng.

Không tự thay đổi thứ tự sau khi đã chốt nếu chưa ghi lý do vào `08_UIUX_DECISIONS.md`.
