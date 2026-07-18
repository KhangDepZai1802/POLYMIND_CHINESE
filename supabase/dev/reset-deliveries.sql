-- ⛔ CHỈ DÙNG Ở LOCAL DEV. KHÔNG BAO GIỜ chạy trên staging/production.
--
-- Xóa sạch mọi lượt giao bài + lượt làm bài + bài chấm, GIỮ NGUYÊN ngân hàng
-- câu hỏi và bộ đề (question_sets / questions). Dùng khi test luồng
-- tạo → giao → làm → chấm và muốn làm lại từ đầu với cùng bộ đề.
--
-- Cách chạy:
--   psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" \
--     -v i_am_sure=1 -f supabase/dev/reset-deliveries.sql
--
-- Vì sao dùng TRUNCATE ... CASCADE thay vì DELETE:
-- TRUNCATE không kích hoạt BEFORE DELETE row trigger — tức là bỏ qua đúng các
-- chốt toàn vẹn kiểu "Không thể xóa bài tập đã giao hoặc đã có bài nộp"
-- (20260714000025_assignment_integrity.sql:127) mà vẫn không phải sửa/tắt
-- trigger. Trigger vẫn nguyên vẹn cho app thật.

\set ON_ERROR_STOP on

\if :{?i_am_sure}
\else
\echo ''
\echo 'ABORT: script này xóa dữ liệu không phục hồi được.'
\echo 'Chạy lại với: -v i_am_sure=1'
\echo ''
\quit
\endif

begin;

-- Deliveries là gốc: cascade kéo theo attempts → answers,
-- exam_integrity_events, exam_regrade_runs.
--
-- answer_media phải liệt kê riêng: nó trỏ tới attempt bằng cặp
-- (attempt_kind, attempt_id) polymorphic nên KHÔNG có FK tới attempts,
-- tức là không được cascade kéo theo — bỏ sót sẽ để lại hàng mồ côi.
truncate table
  public.exercise_deliveries,
  public.exam_deliveries,
  public.answer_media
cascade;

-- Nhận xét học tập giáo viên ghi kèm các lượt trên.
truncate table public.learning_evaluations cascade;

-- Thông báo trỏ tới bài vừa xóa sẽ thành rác.
truncate table public.notifications cascade;

commit;

\echo 'Đã xóa toàn bộ delivery/attempt/submission. Ngân hàng câu hỏi giữ nguyên.'
