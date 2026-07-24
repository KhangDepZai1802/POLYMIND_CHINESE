begin;

create extension if not exists pgtap with schema extensions;

select plan(34);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('flashcard_decks', 'flashcard_sections', 'flashcard_pages')
      and c.relrowsecurity
  ),
  3,
  'mọi bảng Flashcard đều bật RLS'
);
select is(
  (select public from storage.buckets where id = 'flashcard-media'),
  false,
  'flashcard-media là bucket private'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.publish_flashcard_section(uuid)',
    'EXECUTE'
  ),
  'authenticated có entrypoint publish được kiểm quyền trong RPC'
);
select ok(
  not has_table_privilege('anon', 'public.flashcard_pages', 'SELECT'),
  'anonymous không có table privilege Flashcard'
);

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
    '66000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'admin.flashcard-test@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '66000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'student-a.flashcard-test@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '66000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'student-b.flashcard-test@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '66000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'teacher.flashcard-test@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('66000000-0000-4000-8000-000000000001', 'super_admin', 'Admin Flashcard Test', 'admin.flashcard-test@polymind.test'),
  ('66000000-0000-4000-8000-000000000002', 'student', 'Student A Flashcard Test', 'student-a.flashcard-test@polymind.test'),
  ('66000000-0000-4000-8000-000000000003', 'student', 'Student B Flashcard Test', 'student-b.flashcard-test@polymind.test'),
  ('66000000-0000-4000-8000-000000000004', 'teacher', 'Teacher Flashcard Test', 'teacher.flashcard-test@polymind.test');

insert into public.students (id, user_id, student_code, full_name)
values
  ('66100000-0000-4000-8000-000000000002', '66000000-0000-4000-8000-000000000002', 'HV-FLASH-A', 'Student A Flashcard Test'),
  ('66100000-0000-4000-8000-000000000003', '66000000-0000-4000-8000-000000000003', 'HV-FLASH-B', 'Student B Flashcard Test');

insert into public.courses (
  id, code, title, program, course_type, default_session_count, status
)
values
  ('66200000-0000-4000-8000-000000000001', 'KH-FLASH-A', 'Khóa Flashcard A', 'core', 'custom', 2, 'active'),
  ('66200000-0000-4000-8000-000000000002', 'KH-FLASH-B', 'Khóa Flashcard B', 'core', 'custom', 2, 'active');

insert into public.classes (
  id, course_id, code, name, capacity, delivery_mode, status
)
values
  ('66300000-0000-4000-8000-000000000001', '66200000-0000-4000-8000-000000000001', 'LOP-FLASH-A', 'Lớp Flashcard A', 20, 'offline', 'planned'),
  ('66300000-0000-4000-8000-000000000002', '66200000-0000-4000-8000-000000000002', 'LOP-FLASH-B', 'Lớp Flashcard B', 20, 'offline', 'planned');

insert into public.enrollments (id, student_id, class_id, status)
values
  ('66400000-0000-4000-8000-000000000001', '66100000-0000-4000-8000-000000000002', '66300000-0000-4000-8000-000000000001', 'active'),
  ('66400000-0000-4000-8000-000000000002', '66100000-0000-4000-8000-000000000003', '66300000-0000-4000-8000-000000000002', 'active');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"66000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.flashcard_decks (
  id, course_id, title, created_by
)
values (
  '66500000-0000-4000-8000-000000000001',
  '66200000-0000-4000-8000-000000000001',
  'Flashcard khóa A',
  '66000000-0000-4000-8000-000000000004'
);

insert into public.flashcard_sections (
  id, deck_id, session_number, title
)
values
  ('66600000-0000-4000-8000-000000000001', '66500000-0000-4000-8000-000000000001', 1, 'Buổi 1'),
  ('66600000-0000-4000-8000-000000000002', '66500000-0000-4000-8000-000000000001', 2, 'Buổi 2');

insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  hanzi, pinyin_syllables, meaning_vi,
  front_image_path, back_image_path, audio_path,
  front_alt, back_alt
)
values
  (
    '66700000-0000-4000-8000-000000000001',
    '66600000-0000-4000-8000-000000000001',
    'session_cover', 0, null, null, null,
    '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000001/front-a.png',
    '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000001/back-a.png',
    null,
    'Trang mở đầu buổi 1', 'Mặt sau trang mở đầu buổi 1'
  ),
  (
    '66700000-0000-4000-8000-000000000002',
    '66600000-0000-4000-8000-000000000001',
    'vocabulary', 1, '你好', 'nǐ hǎo', 'Xin chào',
    '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000002/front-b.png',
    '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000002/back-b.png',
    '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000002/audio-b.mp3',
    'Từ 你好', 'Nghĩa của từ 你好'
  ),
  (
    '66700000-0000-4000-8000-000000000003',
    '66600000-0000-4000-8000-000000000001',
    'vocabulary', 2, '谢谢', 'xiè xie', 'Cảm ơn',
    '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000003/front-c.png',
    '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000003/back-c.png',
    '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000003/audio-c.mp3',
    'Từ 谢谢', 'Nghĩa của từ 谢谢'
  );

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
select
  'flashcard-media',
  media.path,
  '66000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'mimetype', case when media.path like '%.mp3' then 'audio/mpeg' else 'image/png' end,
    'size', 1024
  )
-- `media_paths` là nguồn sự thật duy nhất về media của trang (migration 70),
-- nên fixture storage dựng thẳng từ nó thay vì liệt kê lại từng cột.
from (
  select unnest(media_paths) as path from public.flashcard_pages
) media;

select is(
  (
    select created_by
    from public.flashcard_decks
    where id = '66500000-0000-4000-8000-000000000001'
  ),
  '66000000-0000-4000-8000-000000000001'::uuid,
  'DB ghi đè created_by bằng actor Super Admin thật'
);
select lives_ok(
  $$select public.publish_flashcard_section('66600000-0000-4000-8000-000000000001')$$,
  'Super Admin publish được buổi đủ cover, vocabulary và media'
);
select is(
  (
    select status::text
    from public.flashcard_decks
    where id = '66500000-0000-4000-8000-000000000001'
  ),
  'published',
  'publish section đồng thời publish deck'
);
select throws_ok(
  $$select public.publish_flashcard_section('66600000-0000-4000-8000-000000000002')$$,
  'P0001',
  'Mỗi buổi cần đúng một trang mở đầu và ít nhất một trang từ vựng',
  'không publish được buổi thiếu trang'
);
select throws_ok(
  $$update public.flashcard_pages set hanzi = 'Bị sửa' where id = '66700000-0000-4000-8000-000000000002'$$,
  'P0001',
  'Đưa buổi flashcard về nháp trước khi sửa trang',
  'trang của section đã publish là bất biến'
);
select throws_ok(
  $$delete from public.flashcard_pages where id = '66700000-0000-4000-8000-000000000002'$$,
  'P0001',
  'Không xóa cứng trang flashcard; hãy lưu trữ trang',
  'không hard-delete trang flashcard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"66000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is((select count(*)::integer from public.flashcard_decks), 1, 'Student A đọc deck đúng Course');
select is((select count(*)::integer from public.flashcard_sections), 1, 'Student A chỉ đọc section đã publish');
select is((select count(*)::integer from public.flashcard_pages), 3, 'Student A đọc đủ page active đã publish');
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'flashcard-media'),
  8,
  'Student A đọc đủ object Flashcard đã publish (cover không có audio)'
);
select ok(
  app.can_student_read_flashcard_media(
    '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000002/audio-b.mp3'
  ),
  'Student A được ký media đúng Course'
);
select throws_ok(
  $$insert into public.flashcard_decks(course_id,title) values('66200000-0000-4000-8000-000000000002','Hack')$$,
  '42501',
  null,
  'student không tự tạo deck'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"66000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select is((select count(*)::integer from public.flashcard_decks), 0, 'Student B khác Course không đọc deck');
select is((select count(*)::integer from public.flashcard_pages), 0, 'Student B khác Course không đọc page');
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'flashcard-media'),
  0,
  'Student B khác Course không đọc object'
);
select ok(
  not app.can_student_read_flashcard_media(
    '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000002/audio-b.mp3'
  ),
  'Student B không ký được media khác Course'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"66000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select is((select count(*)::integer from public.flashcard_decks), 0, 'teacher không đọc deck Flashcard');
select is((select count(*)::integer from public.flashcard_pages), 0, 'teacher không đọc page Flashcard');

select set_config(
  'request.jwt.claims',
  '{"sub":"66000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

update public.flashcard_sections
set status = 'draft'
where id = '66600000-0000-4000-8000-000000000001';

select throws_ok(
  $$select public.reorder_flashcard_pages(
      '66600000-0000-4000-8000-000000000001',
      array[
        '66700000-0000-4000-8000-000000000002'::uuid,
        '66700000-0000-4000-8000-000000000001'::uuid,
        '66700000-0000-4000-8000-000000000003'::uuid
      ]
    )$$,
  'P0001',
  'Trang mở đầu phải đứng đầu buổi flashcard',
  'reorder từ chối khi cover không đứng đầu'
);
select lives_ok(
  $$select public.reorder_flashcard_pages(
      '66600000-0000-4000-8000-000000000001',
      array[
        '66700000-0000-4000-8000-000000000001'::uuid,
        '66700000-0000-4000-8000-000000000003'::uuid,
        '66700000-0000-4000-8000-000000000002'::uuid
      ]
    )$$,
  'reorder hợp lệ chạy atomic'
);
select is(
  (
    select order_index
    from public.flashcard_pages
    where id = '66700000-0000-4000-8000-000000000003'
  ),
  1,
  'reorder cập nhật đúng thứ tự vocabulary'
);
select lives_ok(
  $$select public.archive_flashcard_page('66700000-0000-4000-8000-000000000003')$$,
  'archive vocabulary chạy được ở section nháp'
);
select is(
  (
    select order_index
    from public.flashcard_pages
    where id = '66700000-0000-4000-8000-000000000002'
  ),
  1,
  'archive tự compact thứ tự page còn lại'
);
-- ⚠️ Luật "thẻ từ vựng phải có audio" ĐÃ CHUYỂN CHỖ ở migration 72: từ CHECK
-- mức hàng sang `validate_flashcard_section_publish`. Lý do: đường nhập hàng
-- loạt (`P16-T4`) không nhập được audio, nên thẻ phải tồn tại được khi buổi còn
-- nháp. Lời hứa với học viên không đổi — buổi nháp thì học viên không đọc được.
select lives_ok(
  $$update public.flashcard_pages set audio_path = null where id = '66700000-0000-4000-8000-000000000002'$$,
  'thẻ từ vựng ĐƯỢC PHÉP thiếu audio khi buổi còn nháp'
);
select throws_ok(
  $$select public.publish_flashcard_section('66600000-0000-4000-8000-000000000001')$$,
  'P0001',
  'Còn 1 thẻ từ vựng chưa có audio phát âm',
  'nhưng KHÔNG publish được buổi còn thẻ thiếu audio'
);
update public.flashcard_pages
set audio_path = '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000002/audio-b.mp3'
where id = '66700000-0000-4000-8000-000000000002';
select throws_ok(
  $$update public.flashcard_pages
    set audio_path = '66000000-0000-4000-8000-000000000001/66500000-0000-4000-8000-000000000001/66600000-0000-4000-8000-000000000001/66700000-0000-4000-8000-000000000001/audio-a.mp3'
    where id = '66700000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'trang mở đầu không nhận audio'
);
select lives_ok(
  $$select public.archive_flashcard_page('66700000-0000-4000-8000-000000000001')$$,
  'archive trang mở đầu chạy được ở section nháp'
);
select is(
  (
    select order_index
    from public.flashcard_pages
    where id = '66700000-0000-4000-8000-000000000002'
  ),
  1,
  'archive trang mở đầu không dồn trang từ vựng về order 0'
);
select lives_ok(
  $$select public.reorder_flashcard_pages(
      '66600000-0000-4000-8000-000000000001',
      array['66700000-0000-4000-8000-000000000002'::uuid]
    )$$,
  'reorder chạy được khi buổi tạm thời không còn trang mở đầu'
);
select throws_ok(
  $$select public.publish_flashcard_section('66600000-0000-4000-8000-000000000001')$$,
  'P0001',
  'Mỗi buổi cần đúng một trang mở đầu và ít nhất một trang từ vựng',
  'buổi thiếu trang mở đầu không publish được'
);

reset role;
select * from finish();
rollback;
