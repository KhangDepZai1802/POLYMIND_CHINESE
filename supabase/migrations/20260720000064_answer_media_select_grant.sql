-- 64 — Cho user client đọc metadata answer_media qua RLS.
--
-- Migration 55 tạo bảng sau batch GRANT của assessment engine nên mới chỉ có
-- policy mà thiếu table privilege. App cần SELECT để lấy bản ghi cũ khi thu lại;
-- Storage policy cũng cần đọc bảng này khi ký URL cho học viên/giáo viên.

grant select on public.answer_media to authenticated;
