-- Tạo NHIỀU buổi cùng lúc + xoá hàng loạt buổi/trang (yêu cầu user 2026-07-24).
--
-- Ba điều bài này phải chứng minh:
--   (1) phân quyền FAIL-CLOSED: không phải super_admin thì bị chặn ở cả 3 RPC;
--   (2) buổi đã CÔNG BỐ không xoá được — kể cả khi gọi lệnh xoá cả bộ;
--   (3) xoá xong thì SỐ BUỔI được giải phóng, tạo lại "Buổi 1" phải chạy.
--       Đây là chỗ dễ hỏng nhất: khoá `(deck_id, session_number)` vốn là unique
--       TOÀN BẢNG, giữ nguyên thì hàng đã xoá vẫn chiếm số.

begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- =====================================================================
-- Hình dạng schema
-- =====================================================================
select has_column(
  'public', 'flashcard_sections', 'archived_at',
  'buổi có cột archived_at (xoá MỀM, đúng luật "không hard delete")'
);

select ok(
  exists (
    select 1
    from pg_index i
    join pg_class c on c.oid = i.indexrelid
    where c.relname = 'ux_flashcard_sections_deck_session'
      and i.indisunique
      and i.indpred is not null
  ),
  'khoá số buổi là PARTIAL index — buổi đã xoá không chiếm số nữa'
);

select ok(
  not exists (
    select 1 from pg_constraint
    where conname = 'uq_flashcard_sections_deck_session'
  ),
  'khoá unique toàn bảng cũ đã gỡ'
);

-- =====================================================================
-- Fixture
-- =====================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '76000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'admin.bulkops@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '76000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'gv.bulkops@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('76000000-0000-4000-8000-000000000001', 'super_admin', 'Admin BulkOps', 'admin.bulkops@polymind.test'),
  ('76000000-0000-4000-8000-000000000002', 'teacher', 'Giáo viên BulkOps', 'gv.bulkops@polymind.test');

insert into public.courses (
  id, code, title, program, course_type, default_session_count, status
)
values ('76200000-0000-4000-8000-000000000001', 'KH-BULKOPS', 'Khóa BulkOps', 'core', 'custom', 10, 'active');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"76000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.flashcard_decks (id, course_id, title)
values ('76500000-0000-4000-8000-000000000001', '76200000-0000-4000-8000-000000000001', 'Deck BulkOps');

-- =====================================================================
-- Tạo nhiều buổi
-- =====================================================================
select is(
  (
    select count(*)::integer
    from public.create_flashcard_sections(
      '76500000-0000-4000-8000-000000000001', 1, 5
    )
    where row_status = 'created'
  ),
  5,
  'tạo được một lượt 5 buổi (từ buổi 1 đến buổi 5)'
);

select is(
  (
    select array_agg(session_number order by session_number)
    from public.flashcard_sections
    where deck_id = '76500000-0000-4000-8000-000000000001'
      and archived_at is null
  ),
  array[1, 2, 3, 4, 5],
  'đúng 5 buổi, đánh số liên tục'
);

select is(
  (
    select title from public.flashcard_sections
    where deck_id = '76500000-0000-4000-8000-000000000001' and session_number = 3
  ),
  'Buổi 3',
  'tên buổi mặc định là "Buổi N"'
);

-- 🔴 `BUG_M09_01`: bấm lại đúng khoảng cũ không được sinh buổi trùng.
select is(
  (
    select array_agg(row_status order by session_no)
    from public.create_flashcard_sections(
      '76500000-0000-4000-8000-000000000001', 4, 6
    )
  ),
  array['exists', 'exists', 'created'],
  'khoảng chồng lấn: buổi đã có báo exists, buổi mới vẫn tạo — idempotent ở DB'
);

select is(
  (
    select count(*)::integer from public.flashcard_sections
    where deck_id = '76500000-0000-4000-8000-000000000001' and archived_at is null
  ),
  6,
  'và KHÔNG sinh buổi trùng nào'
);

select throws_ok(
  $$select public.create_flashcard_sections(
      '76500000-0000-4000-8000-000000000001', 9, 12
    )$$,
  'P0001',
  'Khóa học chỉ có 10 buổi',
  'không tạo vượt số buổi của khóa học'
);

select throws_ok(
  $$select public.create_flashcard_sections(
      '76500000-0000-4000-8000-000000000001', 5, 2
    )$$,
  'P0001',
  'Khoảng buổi không hợp lệ',
  'khoảng ngược (từ 5 đến 2) bị từ chối'
);

-- =====================================================================
-- Xoá TẤT CẢ trang trong một buổi
-- =====================================================================
insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  front_image_path, back_image_path, front_alt, back_alt
)
select
  '76700000-0000-4000-8000-000000000001',
  s.id, 'session_cover', 0,
  '76000000-0000-4000-8000-000000000001/d/s1/c/front-1.png',
  '76000000-0000-4000-8000-000000000001/d/s1/c/back-1.png',
  'trước', 'sau'
from public.flashcard_sections s
where s.deck_id = '76500000-0000-4000-8000-000000000001' and s.session_number = 1;

insert into public.flashcard_pages (
  id, section_id, kind, order_index, hanzi, pinyin_syllables, meaning_vi,
  audio_path, front_image_path, front_alt
)
select
  ('76700000-0000-4000-8000-00000000000' || v.n)::uuid,
  s.id, 'vocabulary', v.n::integer, v.hanzi, v.pinyin, v.meaning,
  '76000000-0000-4000-8000-000000000001/d/s1/v/audio-' || v.n || '.mp3',
  '76000000-0000-4000-8000-000000000001/d/s1/v/front-' || v.n || '.png',
  'trước'
from public.flashcard_sections s
cross join (values (2, '苹果', 'píng guǒ', 'quả táo'), (3, '香蕉', 'xiāng jiāo', 'quả chuối'))
  as v(n, hanzi, pinyin, meaning)
where s.deck_id = '76500000-0000-4000-8000-000000000001' and s.session_number = 1;

-- Một trang mang 2 media: đây là chỗ bản đầu của tôi đếm sai (count(*) sau
-- `unnest` đếm theo cặp trang × đường dẫn nên ra 4 thay vì 3).
select is(
  (
    select archived_count
    from public.archive_flashcard_section_pages(
      (select id from public.flashcard_sections
       where deck_id = '76500000-0000-4000-8000-000000000001' and session_number = 1)
    )
  ),
  3,
  'xoá hết trang báo đúng SỐ TRANG (3), không phải số file media'
);

select is(
  (
    select array_length(removed_paths, 1)
    from public.archive_flashcard_section_pages(
      (select id from public.flashcard_sections
       where deck_id = '76500000-0000-4000-8000-000000000001' and session_number = 2)
    )
  ),
  null,
  'buổi không có trang nào: xoá vẫn chạy, không trả đường dẫn nào'
);

select is(
  (
    select count(*)::integer from public.flashcard_pages
    where section_id = (
      select id from public.flashcard_sections
      where deck_id = '76500000-0000-4000-8000-000000000001' and session_number = 1
    ) and archived_at is null
  ),
  0,
  'buổi 1 không còn trang nào đang sống'
);

-- =====================================================================
-- 🔴 Buổi đã CÔNG BỐ không được xoá
-- =====================================================================
-- Dựng lại buổi 1 cho đủ điều kiện công bố, rồi công bố nó.
insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  front_image_path, back_image_path, front_alt, back_alt
)
select
  '76700000-0000-4000-8000-000000000011',
  s.id, 'session_cover', 0,
  '76000000-0000-4000-8000-000000000001/d/s1/c2/front-1.png',
  '76000000-0000-4000-8000-000000000001/d/s1/c2/back-1.png',
  'trước', 'sau'
from public.flashcard_sections s
where s.deck_id = '76500000-0000-4000-8000-000000000001' and s.session_number = 1;

insert into public.flashcard_pages (
  id, section_id, kind, order_index, hanzi, pinyin_syllables, meaning_vi, audio_path
)
select
  '76700000-0000-4000-8000-000000000012',
  s.id, 'vocabulary', 1, '西瓜', 'xī guā', 'dưa hấu',
  '76000000-0000-4000-8000-000000000001/d/s1/v2/audio-1.mp3'
from public.flashcard_sections s
where s.deck_id = '76500000-0000-4000-8000-000000000001' and s.session_number = 1;

select lives_ok(
  $$select public.publish_flashcard_section(
      (select id from public.flashcard_sections
       where deck_id = '76500000-0000-4000-8000-000000000001' and session_number = 1)
    )$$,
  'công bố được buổi 1'
);

select throws_ok(
  $$select public.archive_flashcard_section_pages(
      (select id from public.flashcard_sections
       where deck_id = '76500000-0000-4000-8000-000000000001' and session_number = 1)
    )$$,
  'P0001',
  'Đưa buổi flashcard về nháp trước khi xoá trang',
  '🔴 buổi đã CÔNG BỐ thì không xoá được trang'
);

-- =====================================================================
-- Xoá TẤT CẢ buổi của một bộ thẻ
-- =====================================================================
select is(
  (
    select array[archived_count, kept_published_count]
    from public.archive_flashcard_deck_sections(
      '76500000-0000-4000-8000-000000000001'
    )
  ),
  array[5, 1],
  '🔴 xoá cả bộ: 5 buổi nháp bị xoá, 1 buổi ĐÃ CÔNG BỐ được GIỮ LẠI'
);

select is(
  (
    select array_agg(session_number order by session_number)
    from public.flashcard_sections
    where deck_id = '76500000-0000-4000-8000-000000000001'
      and archived_at is null
  ),
  array[1],
  'chỉ còn đúng buổi đã công bố'
);

-- Chỗ dễ hỏng nhất: số buổi phải được GIẢI PHÓNG sau khi xoá.
select is(
  (
    select count(*)::integer
    from public.create_flashcard_sections(
      '76500000-0000-4000-8000-000000000001', 2, 4
    )
    where row_status = 'created'
  ),
  3,
  '🔴 tạo lại được buổi 2–4 sau khi xoá — số buổi đã được giải phóng'
);

-- Buổi đã xoá không được công bố lại: một buổi vô hình vẫn có thể chảy tới học
-- viên nếu quên chặn ở đây.
select throws_ok(
  $$update public.flashcard_sections
    set status = 'published'
    where deck_id = '76500000-0000-4000-8000-000000000001'
      and archived_at is not null
      and session_number = 5$$,
  'P0001',
  'Buổi flashcard đã xoá thì không công bố được',
  'buổi đã xoá KHÔNG công bố lại được'
);

-- =====================================================================
-- 🔴 Phân quyền FAIL-CLOSED — cả ba RPC
-- =====================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"76000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.create_flashcard_sections(
      '76500000-0000-4000-8000-000000000001', 7, 8
    )$$,
  'P0001',
  'Chỉ Super Admin được tạo buổi flashcard',
  '🔴 giáo viên KHÔNG tạo được buổi hàng loạt'
);

select throws_ok(
  $$select public.archive_flashcard_deck_sections(
      '76500000-0000-4000-8000-000000000001'
    )$$,
  'P0001',
  'Chỉ Super Admin được xoá buổi flashcard',
  '🔴 giáo viên KHÔNG xoá được buổi'
);

select throws_ok(
  $$select public.archive_flashcard_section_pages(
      (select id from public.flashcard_sections
       where deck_id = '76500000-0000-4000-8000-000000000001' and session_number = 2)
    )$$,
  'P0001',
  'Chỉ Super Admin được xoá trang flashcard',
  '🔴 giáo viên KHÔNG xoá được trang hàng loạt'
);

reset role;
select * from finish();
rollback;
