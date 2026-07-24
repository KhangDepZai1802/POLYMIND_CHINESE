-- Phase 16 / `P16-T1` — thẻ từ vựng dạng bản ghi có cấu trúc + `media_paths`.
--
-- Trọng tâm là LỖ HỔNG mà `DS-049` điểm 1 mô tả: ảnh của câu ví dụ nằm trong
-- `jsonb` nên cách cũ (liệt kê cứng 3 cột trong
-- `app.can_student_read_flashcard_media`) không thấy nó → học viên nhận 403
-- trong khi admin vẫn xem được, và KHÔNG spec nào báo đỏ.
--
-- Hai bài kiểm ngược bắt buộc của Definition of Done nằm ở cuối file:
--   (a) học viên ĐỌC ĐƯỢC ảnh câu ví dụ khi buổi đã `published`;
--   (b) học viên KHÔNG đọc được đúng ảnh đó khi buổi chưa `published`.

begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

-- =====================================================================
-- Hình dạng schema
-- =====================================================================
select has_column('public', 'flashcard_pages', 'hanzi', 'có cột hanzi');
select has_column('public', 'flashcard_pages', 'pinyin_syllables', 'có cột pinyin_syllables');
select has_column('public', 'flashcard_pages', 'meaning_vi', 'có cột meaning_vi');
select has_column('public', 'flashcard_pages', 'sense_breakdown', 'có cột sense_breakdown');
select has_column('public', 'flashcard_pages', 'example_sentences', 'có cột example_sentences');
select has_column('public', 'flashcard_pages', 'common_phrases', 'có cột common_phrases');
select has_column('public', 'flashcard_pages', 'media_paths', 'có cột media_paths');
select hasnt_column(
  'public', 'flashcard_pages', 'term',
  'cột term đã bị hanzi thay hẳn — không giữ hai nguồn sự thật (BUG_M10_01)'
);

select ok(
  exists (
    select 1
    from pg_index i
    join pg_class c on c.oid = i.indexrelid
    join pg_am am on am.oid = (select relam from pg_class where oid = i.indexrelid)
    where c.relname = 'ix_flashcard_pages_media_paths'
      and am.amname = 'gin'
  ),
  'media_paths có index GIN (DS-050 điểm 2)'
);

-- Chốt user 2026-07-23 ở `P16-T1`: GIỮ NGUYÊN constraint này, §7ter khối 2 sửa theo.
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'flashcard_pages_distinct_media_check'
      and conrelid = 'public.flashcard_pages'::regclass
  ),
  'flashcard_pages_distinct_media_check còn nguyên — hai mặt phải khác file'
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
    '70000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'admin.flash-struct@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'hv-a.flash-struct@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'hv-b.flash-struct@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('70000000-0000-4000-8000-000000000001', 'super_admin', 'Admin Flashcard Struct', 'admin.flash-struct@polymind.test'),
  ('70000000-0000-4000-8000-000000000002', 'student', 'Học viên A Struct', 'hv-a.flash-struct@polymind.test'),
  ('70000000-0000-4000-8000-000000000003', 'student', 'Học viên B Struct', 'hv-b.flash-struct@polymind.test');

insert into public.students (id, user_id, student_code, full_name)
values
  ('70100000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002', 'HV-FLSTR-A', 'Học viên A Struct'),
  ('70100000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000003', 'HV-FLSTR-B', 'Học viên B Struct');

insert into public.courses (
  id, code, title, program, course_type, default_session_count, status
)
values
  ('70200000-0000-4000-8000-000000000001', 'KH-FLSTR-A', 'Khóa Struct A', 'core', 'custom', 2, 'active'),
  ('70200000-0000-4000-8000-000000000002', 'KH-FLSTR-B', 'Khóa Struct B', 'core', 'custom', 2, 'active');

insert into public.classes (
  id, course_id, code, name, capacity, delivery_mode, status
)
values
  ('70300000-0000-4000-8000-000000000001', '70200000-0000-4000-8000-000000000001', 'LOP-FLSTR-A', 'Lớp Struct A', 20, 'offline', 'planned'),
  ('70300000-0000-4000-8000-000000000002', '70200000-0000-4000-8000-000000000002', 'LOP-FLSTR-B', 'Lớp Struct B', 20, 'offline', 'planned');

insert into public.enrollments (id, student_id, class_id, status)
values
  ('70400000-0000-4000-8000-000000000001', '70100000-0000-4000-8000-000000000002', '70300000-0000-4000-8000-000000000001', 'active'),
  ('70400000-0000-4000-8000-000000000002', '70100000-0000-4000-8000-000000000003', '70300000-0000-4000-8000-000000000002', 'active');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.flashcard_decks (id, course_id, title)
values (
  '70500000-0000-4000-8000-000000000001',
  '70200000-0000-4000-8000-000000000001',
  'Flashcard Struct A'
);

insert into public.flashcard_sections (id, deck_id, session_number, title)
values
  ('70600000-0000-4000-8000-000000000001', '70500000-0000-4000-8000-000000000001', 1, 'Buổi 1 (sẽ publish)'),
  ('70600000-0000-4000-8000-000000000002', '70500000-0000-4000-8000-000000000001', 2, 'Buổi 2 (giữ nháp)');

-- Buổi 1: trang mở đầu (2 ảnh, không chữ) + 1 thẻ từ vựng đủ 3 danh sách con.
insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  hanzi, pinyin_syllables, meaning_vi,
  sense_breakdown, example_sentences, common_phrases,
  front_image_path, back_image_path, audio_path,
  front_alt, back_alt
)
values
  (
    '70700000-0000-4000-8000-000000000001',
    '70600000-0000-4000-8000-000000000001',
    'session_cover', 0,
    null, null, null,
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    '70000000-0000-4000-8000-000000000001/s1/cover/front-1.png',
    '70000000-0000-4000-8000-000000000001/s1/cover/back-1.png',
    null,
    'Mặt trước trang mở đầu buổi 1', 'Mặt sau trang mở đầu buổi 1'
  ),
  (
    '70700000-0000-4000-8000-000000000002',
    '70600000-0000-4000-8000-000000000001',
    'vocabulary', 1,
    '苹果', 'píng guǒ', 'Quả táo',
    '[{"hanzi":"苹","pinyin":"píng","meaning_vi":"cây táo"}]'::jsonb,
    '[{"hanzi":"我吃苹果。","pinyin":"wǒ chī píngguǒ","meaning_vi":"Tôi ăn táo.","image_path":"70000000-0000-4000-8000-000000000001/s1/v1/example-1-aaa.png"}]'::jsonb,
    '[{"hanzi":"吃苹果","pinyin":"chī píngguǒ","meaning_vi":"ăn táo"}]'::jsonb,
    '70000000-0000-4000-8000-000000000001/s1/v1/front-2.png',
    '70000000-0000-4000-8000-000000000001/s1/v1/back-2.png',
    '70000000-0000-4000-8000-000000000001/s1/v1/audio-2.mp3',
    'Mặt trước thẻ từ vựng 苹果', 'Mặt sau thẻ từ vựng 苹果'
  );

-- Buổi 2: giữ NHÁP cả file, dùng cho bài kiểm ngược (b).
insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  hanzi, pinyin_syllables, meaning_vi,
  example_sentences,
  front_image_path, back_image_path, audio_path,
  front_alt, back_alt
)
values
  (
    '70700000-0000-4000-8000-000000000003',
    '70600000-0000-4000-8000-000000000002',
    'session_cover', 0,
    null, null, null,
    '[]'::jsonb,
    '70000000-0000-4000-8000-000000000001/s2/cover/front-3.png',
    '70000000-0000-4000-8000-000000000001/s2/cover/back-3.png',
    null,
    'Mặt trước trang mở đầu buổi 2', 'Mặt sau trang mở đầu buổi 2'
  ),
  (
    '70700000-0000-4000-8000-000000000004',
    '70600000-0000-4000-8000-000000000002',
    'vocabulary', 1,
    '香蕉', 'xiāng jiāo', 'Quả chuối',
    '[{"hanzi":"我吃香蕉。","pinyin":"wǒ chī xiāngjiāo","meaning_vi":"Tôi ăn chuối.","image_path":"70000000-0000-4000-8000-000000000001/s2/v1/example-1-bbb.png"}]'::jsonb,
    '70000000-0000-4000-8000-000000000001/s2/v1/front-4.png',
    '70000000-0000-4000-8000-000000000001/s2/v1/back-4.png',
    '70000000-0000-4000-8000-000000000001/s2/v1/audio-4.mp3',
    'Mặt trước thẻ từ vựng 香蕉', 'Mặt sau thẻ từ vựng 香蕉'
  );

-- =====================================================================
-- Ràng buộc nội dung theo `kind`
-- =====================================================================
select throws_ok(
  $$insert into public.flashcard_pages (
      id, section_id, kind, order_index, hanzi, pinyin_syllables, meaning_vi,
      front_image_path, back_image_path, audio_path, front_alt, back_alt
    ) values (
      '70700000-0000-4000-8000-000000000011',
      '70600000-0000-4000-8000-000000000002',
      'vocabulary', 2, '同', 'tóng', 'giống',
      '70000000-0000-4000-8000-000000000001/s2/v2/front-x.png',
      '70000000-0000-4000-8000-000000000001/s2/v2/front-x.png',
      '70000000-0000-4000-8000-000000000001/s2/v2/audio-x.mp3',
      'a', 'b'
    )$$,
  '23514',
  null,
  'thẻ từ vựng KHÔNG được dùng chung một file cho hai mặt (chốt user P16-T1)'
);

select throws_ok(
  $$insert into public.flashcard_pages (
      id, section_id, kind, order_index, pinyin_syllables, meaning_vi
    ) values (
      '70700000-0000-4000-8000-000000000012',
      '70600000-0000-4000-8000-000000000002',
      'vocabulary', 2, 'tóng', 'giống'
    )$$,
  '23514',
  null,
  'thẻ từ vựng thiếu hanzi bị từ chối'
);

select throws_ok(
  $$insert into public.flashcard_pages (
      id, section_id, kind, order_index, hanzi, meaning_vi
    ) values (
      '70700000-0000-4000-8000-000000000013',
      '70600000-0000-4000-8000-000000000002',
      'vocabulary', 2, '同', 'giống'
    )$$,
  '23514',
  null,
  'thẻ từ vựng thiếu pinyin_syllables bị từ chối'
);

select throws_ok(
  $$insert into public.flashcard_pages (
      id, section_id, kind, order_index, hanzi, pinyin_syllables
    ) values (
      '70700000-0000-4000-8000-000000000014',
      '70600000-0000-4000-8000-000000000002',
      'vocabulary', 2, '同', 'tóng'
    )$$,
  '23514',
  null,
  'thẻ từ vựng thiếu meaning_vi bị từ chối'
);

select throws_ok(
  $$update public.flashcard_pages
    set hanzi = '不'
    where id = '70700000-0000-4000-8000-000000000003'$$,
  '23514',
  null,
  'trang mở đầu không mang chữ (chốt Q5)'
);

select throws_ok(
  $$update public.flashcard_pages
    set sense_breakdown = '{"khong":"phai mang"}'::jsonb
    where id = '70700000-0000-4000-8000-000000000004'$$,
  '23514',
  null,
  'ba cột danh sách con luôn phải là MẢNG jsonb'
);

-- §7ter: ảnh của thẻ từ vựng là TUỲ CHỌN.
select lives_ok(
  $$insert into public.flashcard_pages (
      id, section_id, kind, order_index, hanzi, pinyin_syllables, meaning_vi,
      audio_path
    ) values (
      '70700000-0000-4000-8000-000000000015',
      '70600000-0000-4000-8000-000000000002',
      'vocabulary', 2, '同', 'tóng', 'giống',
      '70000000-0000-4000-8000-000000000001/s2/v2/audio-y.mp3'
    )$$,
  'thẻ từ vựng không có ảnh nào vẫn hợp lệ (ảnh là tuỳ chọn ở §7ter)'
);

-- =====================================================================
-- Trigger tổng hợp `media_paths`
-- =====================================================================
select is(
  (
    select array_length(media_paths, 1)
    from public.flashcard_pages
    where id = '70700000-0000-4000-8000-000000000002'
  ),
  4,
  'media_paths gom đủ 4 nguồn: 2 ảnh mặt + audio + ảnh câu ví dụ'
);

select ok(
  (
    select media_paths @> array['70000000-0000-4000-8000-000000000001/s1/v1/example-1-aaa.png']
    from public.flashcard_pages
    where id = '70700000-0000-4000-8000-000000000002'
  ),
  'ảnh câu ví dụ nằm trong jsonb đã được trigger đưa vào media_paths'
);

-- Chứng minh bài kiểm thật sự đo CƠ CHẾ MỚI: ảnh câu ví dụ không trùng cột nào cũ.
-- Thiếu câu này thì bài kiểm dưới có thể xanh nhờ đường cũ mà ta không hay biết.
select ok(
  (
    select '70000000-0000-4000-8000-000000000001/s1/v1/example-1-aaa.png'
             not in (front_image_path, back_image_path, audio_path)
    from public.flashcard_pages
    where id = '70700000-0000-4000-8000-000000000002'
  ),
  'ảnh câu ví dụ KHÔNG nằm ở 3 cột cũ — cách cũ chắc chắn trả 403'
);

select is(
  (
    select array_length(media_paths, 1)
    from public.flashcard_pages
    where id = '70700000-0000-4000-8000-000000000001'
  ),
  2,
  'trang mở đầu chỉ có 2 ảnh trong media_paths (không audio)'
);

-- Một đường ghi duy nhất: client gửi media_paths gì cũng bị trigger đè.
update public.flashcard_pages
set media_paths = array['bia-dat/khong-thuoc-trang-nay.png']
where id = '70700000-0000-4000-8000-000000000002';

select ok(
  (
    select not (media_paths @> array['bia-dat/khong-thuoc-trang-nay.png'])
    from public.flashcard_pages
    where id = '70700000-0000-4000-8000-000000000002'
  ),
  'trigger ĐÈ media_paths do client gửi — một hành động, một đường ghi'
);

-- =====================================================================
-- Storage fixture + publish buổi 1 (buổi 2 giữ nháp)
-- =====================================================================
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
select
  'flashcard-media',
  media.path,
  '70000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'mimetype', case when media.path like '%.mp3' then 'audio/mpeg' else 'image/png' end,
    'size', 1024
  )
from (
  select distinct unnest(media_paths) as path from public.flashcard_pages
) media;

select lives_ok(
  $$select public.publish_flashcard_section('70600000-0000-4000-8000-000000000001')$$,
  'publish được buổi 1'
);

-- =====================================================================
-- 🔴 HAI BÀI KIỂM NGƯỢC BẮT BUỘC (Definition of Done `P16-T1`)
-- =====================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

-- (a) Đây chính là chỗ mô hình cũ trả 403 mà không spec nào báo đỏ.
select ok(
  app.can_student_read_flashcard_media(
    '70000000-0000-4000-8000-000000000001/s1/v1/example-1-aaa.png'
  ),
  'KIỂM NGƯỢC (a): học viên ĐỌC ĐƯỢC ảnh câu ví dụ của buổi đã publish'
);

-- (b) Cùng một học viên, cùng một khoá, nhưng buổi chưa publish.
select ok(
  not app.can_student_read_flashcard_media(
    '70000000-0000-4000-8000-000000000001/s2/v1/example-1-bbb.png'
  ),
  'KIỂM NGƯỢC (b): học viên KHÔNG đọc được ảnh câu ví dụ khi buổi chưa publish'
);

-- Cùng kết luận nhưng đo ở tầng policy Storage thật, không chỉ ở tầng hàm.
select ok(
  exists (
    select 1 from storage.objects
    where bucket_id = 'flashcard-media'
      and name = '70000000-0000-4000-8000-000000000001/s1/v1/example-1-aaa.png'
  ),
  'policy Storage cho học viên thấy object ảnh câu ví dụ đã publish'
);

select ok(
  not exists (
    select 1 from storage.objects
    where bucket_id = 'flashcard-media'
      and name = '70000000-0000-4000-8000-000000000001/s2/v1/example-1-bbb.png'
  ),
  'policy Storage giấu object ảnh câu ví dụ của buổi chưa publish'
);

-- Học viên khoá khác không chạm được, kể cả khi buổi đã publish.
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select ok(
  not app.can_student_read_flashcard_media(
    '70000000-0000-4000-8000-000000000001/s1/v1/example-1-aaa.png'
  ),
  'học viên khoá khác không đọc được ảnh câu ví dụ (IDOR)'
);

reset role;
select * from finish();
rollback;
