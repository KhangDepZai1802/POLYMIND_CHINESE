# UI/UX Design System

> File này phải được điền từ source code thực tế. Không đoán màu thương hiệu.

## 1. Technology Audit

| Hạng mục | Kết quả | Bằng chứng source |
|---|---|---|
| Frontend framework | TBD | TBD |
| UI library | TBD | TBD |
| CSS framework | TBD | TBD |
| Icon library | TBD | TBD |
| Form library | TBD | TBD |
| Table library | TBD | TBD |
| Theme location | TBD | TBD |
| Design token location | TBD | TBD |

## 2. Màu chủ đạo hiện tại

| Thuộc tính | Giá trị |
|---|---|
| Primary hex/rgb/hsl | TBD |
| Nguồn xác định | TBD |
| Đang dùng tại | TBD |
| Sidebar/navigation | TBD |
| Primary button | TBD |
| Link/accent | TBD |

### Quy tắc

- Không đổi màu chủ đạo.
- Chỉ mở rộng sắc độ từ màu đã xác nhận.
- Mọi thay đổi primary phải ghi vào `08_UIUX_DECISIONS.md`.

## 3. Color Tokens

| Token | Value | Usage |
|---|---|---|
| `primary-50` | TBD | Nền nhấn rất nhẹ |
| `primary-100` | TBD | Selected/hover nhẹ |
| `primary-200` | TBD | Border nhấn |
| `primary-300` | TBD | TBD |
| `primary-400` | TBD | TBD |
| `primary-500` | TBD | TBD |
| `primary-600` | TBD | Primary mặc định |
| `primary-700` | TBD | Hover/active |
| `primary-800` | TBD | Dark emphasis |
| `primary-900` | TBD | Strong text |
| `primary-950` | TBD | Maximum contrast |
| `surface-page` | TBD | Nền trang |
| `surface-card` | TBD | Card/panel |
| `surface-muted` | TBD | Khu vực phụ |
| `text-primary` | TBD | Nội dung chính |
| `text-secondary` | TBD | Nội dung phụ |
| `text-disabled` | TBD | Disabled |
| `border-default` | TBD | Viền chuẩn |
| `border-strong` | TBD | Viền cần nhấn |
| `success` | TBD | Success + icon/text |
| `warning` | TBD | Warning + icon/text |
| `error` | TBD | Error + icon/text |
| `info` | TBD | Info + icon/text |
| `focus-ring` | TBD | Focus bàn phím |

Ghi tỷ lệ contrast cho các cặp quan trọng.

## 4. Typography

| Role | Font | Size | Weight | Line height |
|---|---|---:|---:|---:|
| Page title | TBD | TBD | TBD | TBD |
| Section title | TBD | TBD | TBD | TBD |
| Card title | TBD | TBD | TBD | TBD |
| Body | TBD | TBD | TBD | TBD |
| Small/meta | TBD | TBD | TBD | TBD |
| Table header | TBD | TBD | TBD | TBD |
| Button | TBD | TBD | TBD | TBD |
| Form label | TBD | TBD | TBD | TBD |

Nguyên tắc:

- Ưu tiên khả năng quét nhanh.
- Hạn chế quá nhiều cấp chữ.
- Không dùng chữ quá nhỏ cho dữ liệu vận hành thường xuyên.
- Tránh font weight quá nhẹ.

## 5. Spacing

Sử dụng thang spacing hiện có nếu dự án đã có. Nếu chưa có, đề xuất thang nhất quán và ánh xạ vào token.

| Token | Value | Usage |
|---|---:|---|
| `space-1` | TBD | Khoảng rất nhỏ |
| `space-2` | TBD | Icon/text |
| `space-3` | TBD | Field nội bộ |
| `space-4` | TBD | Khoảng chuẩn |
| `space-5` | TBD | Group |
| `space-6` | TBD | Card section |
| `space-8` | TBD | Section lớn |

## 6. Border Radius

| Token | Value | Usage |
|---|---:|---|
| `radius-sm` | TBD | Input/chip |
| `radius-md` | TBD | Button/card nhỏ |
| `radius-lg` | TBD | Card/modal |
| `radius-full` | TBD | Badge/avatar |

Không dùng radius quá lớn nếu không phù hợp nhận diện hiện tại.

## 7. Shadow

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | TBD | Hover/card nhẹ |
| `shadow-md` | TBD | Dropdown |
| `shadow-lg` | TBD | Modal |

Ưu tiên border và surface hierarchy hơn shadow mạnh.

## 8. Action Hierarchy

1. Primary: hành động chính của màn hình.
2. Secondary: hành động hỗ trợ.
3. Tertiary/ghost: hành động ít quan trọng.
4. Destructive: xóa/hủy dữ liệu, phải khác biệt rõ và có xác nhận theo behavior hiện có.
5. Icon-only: bắt buộc tooltip hoặc accessible label.

Quy định:

- Không có nhiều hơn một primary action nổi bật trong cùng khu vực.
- Loading không làm thay đổi kích thước button.
- Disabled phải rõ nhưng vẫn đọc được.
- Focus ring không bị overflow hoặc che bởi container.

## 9. Table

- Header dễ quét, alignment theo loại dữ liệu.
- Số và tiền căn phải hợp lý, ưu tiên tabular numbers nếu có.
- Hành động hàng phải nhất quán.
- Không nhồi quá nhiều icon không nhãn.
- Có loading, empty và error state.
- Sticky header chỉ dùng khi hỗ trợ thao tác dài.
- Responsive phải ghi rõ chiến lược cho từng bảng.

## 10. Form

- Label luôn rõ ràng.
- Placeholder không thay label.
- Required, error và helper text nhất quán.
- Field height phù hợp thao tác thường xuyên.
- Validation hiện có phải được giữ nguyên.
- Không thay đổi thứ tự nghiệp vụ nếu chưa được phép.
- Error phải có text, không chỉ đổi màu.

## 11. Modal

- Tiêu đề mô tả đúng hành động.
- Primary/secondary action có thứ tự nhất quán.
- Destructive action phải rõ.
- Nội dung dài cần vùng scroll bên trong, không làm tràn viewport.
- Focus trap và đóng bằng bàn phím theo thư viện hiện tại.
- Không biến mọi thao tác thành modal.

## 12. Navigation

- Giữ cấu trúc route và phân quyền.
- Active state rõ ràng.
- Không dùng primary cho tất cả item.
- Sidebar collapse/expand phải giữ behavior hiện có.
- Mobile navigation không che nội dung và có touch target phù hợp.

## 13. System States

| State | Quy chuẩn |
|---|---|
| Loading | Skeleton/spinner phù hợp, không layout shift lớn |
| Empty | Nêu trạng thái và hành động hiện có nếu có |
| Error | Mô tả lỗi rõ, giữ retry hiện có |
| Disabled | Rõ ràng, không chỉ giảm opacity quá thấp |
| Success | Có icon/text hoặc toast hiện có |
| Focus | Visible, WCAG AA, không phụ thuộc màu đơn độc |
