# Báo cáo ngày Cô Lê và Cô Thy

Chạy toàn bộ `supabase/migrations/20261021000003_salework_daily_reports.sql` trong SQL Editor của Supabase Polymind. File kiểm tra tài khoản `cole` và `cothy`, liên kết bằng UUID tài khoản và dừng nếu thiếu một người.

Sau khi SQL chạy thành công và code được triển khai:

- Giáo viên: `/teacher/salework`. Mỗi cô xem và sửa báo cáo của chính mình.
- Quản trị: `/admin/b2c/salework`. Chọn người, ngày để xem; không sửa thay giáo viên.
- Mỗi ngày nhập số khách chốt, tiền thực thu VNĐ và số khóa chốt. Gửi lại thay thế số cũ.
- Số liệu SaleWork lấy snapshot cùng người/ngày. Thiếu snapshot hiện “Chưa đồng bộ”, không mặc định số 0.
- Tiêu đề và liên kết hiển thị “Báo cáo”. Không hiển thị dòng thời gian BikeForce đồng bộ trong báo cáo.
- Trên trang hiển thị thẻ HTML lấy số liệu SaleWork theo người/ngày và ba ô nhập kết quả; không dùng canvas/ảnh làm giao diện.
- Chỉ khi Sao chép/Xuất ảnh mới tạo PNG theo mẫu: nền xanh nhạt, không tai nghe, ngày/người báo cáo, 10 thẻ hai cột với icon màu và khung Ghi chú. Tiêu đề chỉ “BÁO CÁO”; lấy số liệu đang xem và giá trị đang nhập, chữ dài tự giảm cỡ.
- Ô Ghi chú không bắt buộc, tối đa500ký tự, lưu theo người/ngày với quyền báo cáo hiện có. Migration bổ sung: `supabase/migrations/20261021000004_salework_report_notes.sql`. Ảnh hiển thị nội dung ghi chú (tự xuống dòng/giảm cỡ chữ), trạng thái lưu nằm riêng bên dưới.
- Sao chép thành công hiện popup nổi trên màn hình trong 4 giây; lỗi sao chép cũng hiện popup, không bắt cuộn lên đầu nội dung.
- Nút Sao chép báo cáo sao chép ảnh PNG; Xuất ảnh tải cùng ảnh 1080×1920 (9:16). Bản chưa lưu có nhãn bản nháp. Nếu trình duyệt không hỗ trợ hoặc từ chối clipboard ảnh, thông báo dùng Xuất ảnh PNG.

SQL đã được người dùng chạy trên production ngày 21/10/2026. Kiểm thử transaction rollback dưới identity thật của cole/cothy/admin đạt: lưu và upsert của chính mình, cấm xem/sửa chéo, cấm ngày tương lai/số âm, admin chỉ đọc, anon bị từ chối. Edge local đã kiểm tra bản build đăng nhập Cô Thy, đọc snapshot thật, sao chép bản nháp, tải PNG và viewport390 không tràn ngang; không lưu số tiền thử.
