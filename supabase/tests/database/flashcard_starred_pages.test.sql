-- Phase 16 / `P16-T7` — ★ thẻ khó: idempotency ở tầng DB + RLS hai chiều.
--
-- Hai điều bài này phải chứng minh, không chỉ "chạy được":
--   (1) `BUG_M09_01` — bấm ★ hai lần KHÔNG tạo hàng thứ hai, và chặn nằm ở DB
--       (khoá chính ghép + `on conflict do nothing`), không phải ở app;
--   (2) IDOR cả hai chiều — không ĐỌC được dấu sao của người khác, và không
--       GHI được dấu sao lên thẻ mình không có quyền đọc.

begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'flashcard_starred_pages'
  ),
  'bảng ★ bật RLS'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.flashcard_starred_pages'::regclass
      and contype = 'p'
      and array_length(conkey, 1) = 2
  ),
  'khoá chính GHÉP (student_id, page_id) — chính là unique index chống bấm hai lần'
);

select ok(
  not has_table_privilege('anon', 'public.flashcard_starred_pages', 'SELECT'),
  'anonymous không có table privilege'
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
    '72000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'admin.star@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '72000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'hv-a.star@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '72000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'hv-b.star@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('72000000-0000-4000-8000-000000000001', 'super_admin', 'Admin Star', 'admin.star@polymind.test'),
  ('72000000-0000-4000-8000-000000000002', 'student', 'Học viên A Star', 'hv-a.star@polymind.test'),
  ('72000000-0000-4000-8000-000000000003', 'student', 'Học viên B Star', 'hv-b.star@polymind.test');

insert into public.students (id, user_id, student_code, full_name)
values
  ('72100000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', 'HV-STAR-A', 'Học viên A Star'),
  ('72100000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000003', 'HV-STAR-B', 'Học viên B Star');

insert into public.courses (
  id, code, title, program, course_type, default_session_count, status
)
values
  ('72200000-0000-4000-8000-000000000001', 'KH-STAR-A', 'Khóa Star A', 'core', 'custom', 2, 'active'),
  ('72200000-0000-4000-8000-000000000002', 'KH-STAR-B', 'Khóa Star B', 'core', 'custom', 2, 'active');

insert into public.classes (
  id, course_id, code, name, capacity, delivery_mode, status
)
values
  ('72300000-0000-4000-8000-000000000001', '72200000-0000-4000-8000-000000000001', 'LOP-STAR-A', 'Lớp Star A', 20, 'offline', 'planned'),
  ('72300000-0000-4000-8000-000000000002', '72200000-0000-4000-8000-000000000002', 'LOP-STAR-B', 'Lớp Star B', 20, 'offline', 'planned');

insert into public.enrollments (id, student_id, class_id, status)
values
  ('72400000-0000-4000-8000-000000000001', '72100000-0000-4000-8000-000000000002', '72300000-0000-4000-8000-000000000001', 'active'),
  ('72400000-0000-4000-8000-000000000002', '72100000-0000-4000-8000-000000000003', '72300000-0000-4000-8000-000000000002', 'active');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.flashcard_decks (id, course_id, title)
values ('72500000-0000-4000-8000-000000000001', '72200000-0000-4000-8000-000000000001', 'Deck Star A');

insert into public.flashcard_sections (id, deck_id, session_number, title)
values
  ('72600000-0000-4000-8000-000000000001', '72500000-0000-4000-8000-000000000001', 1, 'Buổi 1'),
  ('72600000-0000-4000-8000-000000000002', '72500000-0000-4000-8000-000000000001', 2, 'Buổi 2 nháp');

insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  hanzi, pinyin_syllables, meaning_vi,
  front_image_path, back_image_path, audio_path, front_alt, back_alt
)
values
  (
    '72700000-0000-4000-8000-000000000001', '72600000-0000-4000-8000-000000000001',
    'session_cover', 0, null, null, null,
    '72000000-0000-4000-8000-000000000001/s1/c/front-1.png',
    '72000000-0000-4000-8000-000000000001/s1/c/back-1.png',
    null, 'trước', 'sau'
  ),
  (
    '72700000-0000-4000-8000-000000000002', '72600000-0000-4000-8000-000000000001',
    'vocabulary', 1, '难', 'nán', 'khó',
    null, null,
    '72000000-0000-4000-8000-000000000001/s1/v/audio-2.mp3', null, null
  ),
  (
    '72700000-0000-4000-8000-000000000003', '72600000-0000-4000-8000-000000000002',
    'session_cover', 0, null, null, null,
    '72000000-0000-4000-8000-000000000001/s2/c/front-3.png',
    '72000000-0000-4000-8000-000000000001/s2/c/back-3.png',
    null, 'trước', 'sau'
  ),
  (
    '72700000-0000-4000-8000-000000000004', '72600000-0000-4000-8000-000000000002',
    'vocabulary', 1, '易', 'yì', 'dễ',
    null, null,
    '72000000-0000-4000-8000-000000000001/s2/v/audio-4.mp3', null, null
  );

select public.publish_flashcard_section('72600000-0000-4000-8000-000000000001');

-- =====================================================================
-- Học viên A
-- =====================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.set_flashcard_star('72700000-0000-4000-8000-000000000002', true)$$,
  'học viên ★ được thẻ của buổi đã publish'
);
select is(
  (select count(*)::integer from public.flashcard_starred_pages),
  1,
  'sau lần ★ đầu tiên có đúng 1 hàng'
);

-- 🔴 `BUG_M09_01`: bấm lại KHÔNG được tạo hàng thứ hai.
select lives_ok(
  $$select public.set_flashcard_star('72700000-0000-4000-8000-000000000002', true)$$,
  'bấm ★ lần hai không ném lỗi'
);
select is(
  (select count(*)::integer from public.flashcard_starred_pages),
  1,
  'bấm ★ lần hai VẪN đúng 1 hàng — idempotent ở tầng DB'
);

-- Và chặn thật nằm ở DB: ghi thẳng bỏ qua RPC cũng không lách được.
select throws_ok(
  $$insert into public.flashcard_starred_pages(student_id, page_id)
    values ('72100000-0000-4000-8000-000000000002','72700000-0000-4000-8000-000000000002')$$,
  '23505',
  null,
  'ghi thẳng lần hai bị khoá chính chặn, không cần app can thiệp'
);

select lives_ok(
  $$select public.set_flashcard_star('72700000-0000-4000-8000-000000000002', false)$$,
  'bỏ ★ chạy được'
);
select is(
  (select count(*)::integer from public.flashcard_starred_pages),
  0,
  'bỏ ★ xoá đúng hàng'
);
select lives_ok(
  $$select public.set_flashcard_star('72700000-0000-4000-8000-000000000002', false)$$,
  'bỏ ★ lần hai cũng idempotent'
);

-- Không ★ được thẻ của buổi CHƯA publish.
select throws_ok(
  $$select public.set_flashcard_star('72700000-0000-4000-8000-000000000004', true)$$,
  '42501',
  null,
  'không ★ được thẻ của buổi chưa publish'
);

select public.set_flashcard_star('72700000-0000-4000-8000-000000000002', true);

-- =====================================================================
-- Học viên B — IDOR cả hai chiều
-- =====================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.flashcard_starred_pages),
  0,
  'IDOR đọc: học viên B không thấy dấu ★ của học viên A'
);

select throws_ok(
  $$select public.set_flashcard_star('72700000-0000-4000-8000-000000000002', true)$$,
  '42501',
  null,
  'IDOR ghi: học viên B không ★ được thẻ của khoá khác'
);

select throws_ok(
  $$insert into public.flashcard_starred_pages(student_id, page_id)
    values ('72100000-0000-4000-8000-000000000002','72700000-0000-4000-8000-000000000002')$$,
  '42501',
  null,
  'IDOR ghi: học viên B không cắm được dấu ★ MANG TÊN học viên A'
);

select lives_ok(
  $$delete from public.flashcard_starred_pages$$,
  'lệnh xoá của học viên B chạy được nhưng…'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select is(
  (select count(*)::integer from public.flashcard_starred_pages),
  1,
  '…không xoá được hàng của học viên A (RLS lọc trước khi xoá)'
);

-- =====================================================================
-- Không phải học viên thì không ★
-- =====================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.set_flashcard_star('72700000-0000-4000-8000-000000000002', true)$$,
  'P0001',
  'Chỉ học viên mới đánh dấu được thẻ khó',
  'super admin không ★ thay học viên'
);

reset role;
select * from finish();
rollback;
