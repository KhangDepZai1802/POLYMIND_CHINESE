-- =============================================================================
-- Công bố / bỏ công bố flashcard HÀNG LOẠT (`FLASHCARD-BULKPUB-1`, `D-43` điểm 4)
--
-- Ba điều bài này phải chứng minh — và cả ba đều là thứ dễ làm sai nhất:
--   (1) một buổi HỎNG không kéo đổ cả lô (mỗi buổi một subtransaction riêng);
--   (2) lý do lỗi lấy từ CHÍNH trigger của DB, không phải câu app tự đoán;
--   (3) chạy lại lần hai KHÔNG đổi `published_at` của buổi đã công bố
--       (`BUG_M09_01` — bấm hai lần vì mạng chậm vẫn ra một kết quả).
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

-- --- Fixture -----------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '79000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'admin.bulkpub@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '79000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'gv.bulkpub@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', '');

insert into public.profiles (id, role, full_name, email)
values
  ('79000000-0000-4000-8000-000000000001', 'super_admin', 'Admin BulkPub', 'admin.bulkpub@polymind.test'),
  ('79000000-0000-4000-8000-000000000002', 'teacher', 'Giáo viên BulkPub', 'gv.bulkpub@polymind.test');

insert into public.courses (
  id, code, title, program, course_type, default_session_count, status
)
values ('79200000-0000-4000-8000-000000000001', 'KH-BULKPUB', 'Khóa BulkPub',
        'core', 'custom', 10, 'active');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"79000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.flashcard_decks (id, course_id, code, title)
values ('79500000-0000-4000-8000-000000000001', '79200000-0000-4000-8000-000000000001',
        'deck-bulkpub-79', 'Deck BulkPub');

-- Ba buổi: 1 và 2 đủ trang (công bố được), 3 THIẾU TRANG MỞ ĐẦU (phải hỏng).
select public.create_flashcard_sections('79500000-0000-4000-8000-000000000001', 1, 3);

-- Buổi 1 và 2: đúng một trang mở đầu + một trang từ vựng, order_index liên tục từ 0.
insert into public.flashcard_pages (
  section_id, kind, order_index, front_image_path, front_alt
)
select s.id, 'session_cover', 0,
       '79000000-0000-4000-8000-000000000001/d/s' || s.session_number || '/c/front.png',
       'trước'
from public.flashcard_sections s
where s.deck_id = '79500000-0000-4000-8000-000000000001'
  and s.session_number in (1, 2);

insert into public.flashcard_pages (
  section_id, kind, order_index, hanzi, pinyin_syllables, meaning_vi,
  audio_path, front_image_path, front_alt
)
select s.id, 'vocabulary', 1, '苹果', 'píng guǒ', 'quả táo',
       '79000000-0000-4000-8000-000000000001/d/s' || s.session_number || '/v/audio.mp3',
       '79000000-0000-4000-8000-000000000001/d/s' || s.session_number || '/v/front.png',
       'trước'
from public.flashcard_sections s
where s.deck_id = '79500000-0000-4000-8000-000000000001'
  and s.session_number in (1, 2);

-- Buổi 3: CHỈ có trang từ vựng, cố ý thiếu trang mở đầu.
--
-- `order_index` phải là 1 chứ không phải 0: `flashcard_pages_kind_order_check`
-- đòi trang từ vựng luôn `order_index > 0` (chỗ số 0 dành riêng cho trang mở
-- đầu). Buổi này vì thế hợp lệ ở tầng bảng nhưng KHÔNG công bố được — đúng
-- hình dạng hỏng mà bài kiểm cần.
insert into public.flashcard_pages (
  section_id, kind, order_index, hanzi, pinyin_syllables, meaning_vi,
  audio_path, front_image_path, front_alt
)
select s.id, 'vocabulary', 1, '香蕉', 'xiāng jiāo', 'quả chuối',
       '79000000-0000-4000-8000-000000000001/d/s3/v/audio.mp3',
       '79000000-0000-4000-8000-000000000001/d/s3/v/front.png',
       'trước'
from public.flashcard_sections s
where s.deck_id = '79500000-0000-4000-8000-000000000001'
  and s.session_number = 3;

-- =============================================================================
-- 1. Fail-closed: không phải super_admin thì không gọi được
-- =============================================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"79000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.bulk_set_flashcard_section_status(
      '79500000-0000-4000-8000-000000000001', 'published'
    )$$,
  'Không có quyền thao tác hàng loạt trên bộ flashcard',
  'giáo viên KHÔNG công bố hàng loạt được (fail-closed)'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"79000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- =============================================================================
-- 2. Công bố hàng loạt — buổi hỏng bị BỎ QUA, không kéo đổ cả lô
-- =============================================================================

create temp table bulk_run_1 as
select * from public.bulk_set_flashcard_section_status(
  '79500000-0000-4000-8000-000000000001', 'published'
);

select is(
  (select count(*)::integer from bulk_run_1),
  3,
  'trả về đúng một dòng cho mỗi buổi trong bộ'
);

select is(
  (select count(*)::integer from bulk_run_1 where outcome = 'changed'),
  2,
  '🔴 hai buổi hợp lệ VẪN công bố được dù buổi 3 hỏng — không kéo đổ cả lô'
);

select is(
  (select count(*)::integer from bulk_run_1 where outcome = 'failed'),
  1,
  'đúng một buổi báo hỏng'
);

select is(
  (select session_number from bulk_run_1 where outcome = 'failed'),
  3,
  'báo đúng SỐ BUỔI bị hỏng, để admin biết chỗ mà sửa'
);

-- Lý do phải là câu của chính trigger `validate_flashcard_section_publish`,
-- không phải câu app tự nghĩ ra.
select matches(
  (select reason from bulk_run_1 where outcome = 'failed'),
  'trang mở đầu',
  'lý do lấy nguyên văn từ trigger của DB, app không nhân bản luật hợp lệ'
);

select is(
  (select array_agg(session_number order by session_number)
   from public.flashcard_sections
   where deck_id = '79500000-0000-4000-8000-000000000001' and status = 'published'),
  array[1, 2],
  'đúng hai buổi ở trạng thái published trong DB'
);

select is(
  (select status::text from public.flashcard_sections
   where deck_id = '79500000-0000-4000-8000-000000000001' and session_number = 3),
  'draft',
  'buổi hỏng vẫn nằm nguyên ở nháp'
);

-- =============================================================================
-- 3. Chạy lại lần hai — idempotent, KHÔNG đụng published_at
-- =============================================================================

select set_config(
  'polymind.published_at_before',
  (select published_at::text from public.flashcard_sections
   where deck_id = '79500000-0000-4000-8000-000000000001' and session_number = 1),
  true
);

create temp table bulk_run_2 as
select * from public.bulk_set_flashcard_section_status(
  '79500000-0000-4000-8000-000000000001', 'published'
);

select is(
  (select count(*)::integer from bulk_run_2 where outcome = 'skipped'),
  2,
  'chạy lại: hai buổi đã công bố báo skipped, KHÔNG phải lỗi'
);

select is(
  (select published_at::text from public.flashcard_sections
   where deck_id = '79500000-0000-4000-8000-000000000001' and session_number = 1),
  current_setting('polymind.published_at_before'),
  '🔴 chạy lại KHÔNG đổi published_at của buổi đã công bố (BUG_M09_01)'
);

-- =============================================================================
-- 4. Bỏ công bố hàng loạt
-- =============================================================================

create temp table bulk_run_3 as
select * from public.bulk_set_flashcard_section_status(
  '79500000-0000-4000-8000-000000000001', 'draft'
);

select is(
  (select count(*)::integer from bulk_run_3 where outcome = 'changed'),
  2,
  'bỏ công bố đưa đúng hai buổi đang công bố về nháp'
);

select is(
  (select count(*)::integer from bulk_run_3 where outcome = 'skipped'),
  1,
  'buổi vốn đã ở nháp thì bỏ qua, không tính là đổi'
);

select is(
  (select count(*)::integer from public.flashcard_sections
   where deck_id = '79500000-0000-4000-8000-000000000001'
     and published_at is not null),
  0,
  'về nháp thì published_at được xoá sạch'
);

reset role;

select * from finish();
rollback;
