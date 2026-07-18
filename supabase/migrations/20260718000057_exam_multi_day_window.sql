-- 57 — Cho phép khung kỳ thi kéo dài NHIỀU NGÀY (đảo quyết định EX-12)
--
-- User chốt 2026-07-18: không muốn ép học viên làm bài trong đúng một ngày —
-- "lỡ người ta bận sao". Mở/đóng có thể ở hai ngày Việt Nam khác nhau; thời
-- lượng (`duration_minutes`) + `closes_at` vẫn giới hạn mỗi lượt thi (EX-13:
-- deadline = min(started_at + duration, closes_at)), nên bỏ ràng buộc cùng-ngày
-- KHÔNG làm mất kiểm soát thời gian làm bài.
--
-- `exam_deliveries_check1` là ràng buộc CHECK cùng-ngày sinh tự động ở migration
-- 38 (bảng exam_deliveries, check thứ hai → hậu tố `1`). Giữ nguyên check
-- `opens_at < closes_at` (exam_deliveries_check).
alter table public.exam_deliveries
  drop constraint if exists exam_deliveries_check1;
