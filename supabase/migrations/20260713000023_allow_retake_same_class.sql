-- =============================================================================
-- 23 — CHO PHÉP HỌC LẠI CHÍNH LỚP CŨ (user chốt 2026-07-14 → D-19)
--
-- Nghiệp vụ thật: học viên rớt (không đạt điều kiện hoàn thành) thì được HỌC LẠI.
--
-- Ràng buộc `uq_enrollments_student_class UNIQUE (student_id, class_id)` ở
-- migration 04 cấm điều đó: một học viên chỉ ghi danh được vào một lớp ĐÚNG MỘT
-- LẦN trong toàn bộ lịch sử. Rút học rồi thì vĩnh viễn không quay lại lớp đó,
-- kể cả sau khi lớp mở lại khóa mới.
--
-- Không sửa migration cũ (forward-fix) → gỡ ràng buộc ở đây.
--
-- CÓ AN TOÀN VỚI D-18 KHÔNG? Có. D-18 ("một học viên chỉ học MỘT lớp tại một
-- thời điểm") được cưỡng chế bằng `ux_enrollments_one_open_per_student` — partial
-- unique index trên `student_id` cho các trạng thái đang mở. Index đó đã bảo đảm
-- mỗi học viên có TỐI ĐA MỘT ghi danh mở trên TOÀN HỆ THỐNG, nên đương nhiên
-- không thể có hai ghi danh mở trong cùng một lớp. Cái bị gỡ chỉ chặn thêm các
-- ghi danh ĐÃ ĐÓNG — tức là chặn đúng phần lịch sử mà ta muốn giữ.
--
-- Sau migration này:
--   • Ghi danh LOP-02 → rớt → `withdrawn` → ghi danh LẠI LOP-02: ĐƯỢC.
--   • Hai ghi danh cùng mở ở LOP-02 (hoặc bất kỳ lớp nào khác): VẪN BỊ CHẶN.
--   • Lịch sử lần học trước (điểm danh, điểm, bài nộp) treo vào `enrollment_id`
--     cũ nên KHÔNG bị trộn lẫn với lần học lại. Đây chính là lý do mọi thứ treo
--     vào enrollment chứ không treo vào student_id.
-- =============================================================================

alter table public.enrollments
  drop constraint if exists uq_enrollments_student_class;

comment on table public.enrollments is
  'Ghi danh = hộ chiếu của học viên trong một lớp. Một học viên được ghi danh NHIỀU LẦN vào cùng một lớp (học lại sau khi rớt) — mỗi lần là một enrollment riêng, giữ nguyên lịch sử của lần trước. Ràng buộc còn lại: tối đa MỘT ghi danh đang mở trên toàn hệ thống (ux_enrollments_one_open_per_student, D-18).';
