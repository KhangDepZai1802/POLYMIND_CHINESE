-- Nâng cấp bảng B2C đã tạo ở migration trước theo cấu trúc file Excel.
-- Không tác động public.classes và không xóa dữ liệu hiện có.
alter table public.b2c_classes
  add column if not exists weekdays_text text,
  add column if not exists time_text text;

-- Nếu bản cũ có schedule_text, giữ lại nguyên cột đó để tránh mất dữ liệu.
-- Dữ liệu mới từ form sẽ ghi vào weekdays_text và time_text.
notify pgrst, 'reload schema';
