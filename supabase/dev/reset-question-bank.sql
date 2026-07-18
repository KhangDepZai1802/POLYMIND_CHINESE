-- ⛔ CHỈ DÙNG Ở LOCAL DEV. KHÔNG BAO GIỜ chạy trên staging/production.
--
-- Xóa sạch NGÂN HÀNG CÂU HỎI + BỘ ĐỀ, kéo theo mọi lượt giao/làm bài liên quan.
-- Nặng hơn reset-deliveries.sql — dùng khi muốn test lại từ bước tạo câu hỏi.
--
-- Cách chạy:
--   psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" \
--     -v i_am_sure=1 -f supabase/dev/reset-question-bank.sql
--
-- Sau khi chạy, nếu muốn có lại seed câu hỏi mẫu:
--   psql "...55322/postgres" -f supabase/seed.questions.banking.sql

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

-- CASCADE kéo theo: question_versions, question_options, question_answer_keys,
-- question_media, question_tag_links, question_shares, question_review_requests,
-- question_set_versions, question_set_items, question_set_sections,
-- question_set_shares, và toàn bộ deliveries/attempts/answers trỏ tới chúng.
truncate table
  public.questions,
  public.question_sets,
  public.question_collections,
  public.question_tags
cascade;

-- Dọn nốt phần không dính FK tới các bảng trên.
truncate table
  public.learning_evaluations,
  public.notifications
cascade;

commit;

\echo 'Đã xóa ngân hàng câu hỏi + toàn bộ dữ liệu bài tập/đề thi.'
