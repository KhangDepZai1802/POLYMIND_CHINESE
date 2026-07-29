-- Gắn ảnh mặt trước + audio HÀNG LOẠT cho cả buổi (`P16-T11`, migration `…077`).
--
-- Năm điều bài này phải chứng minh:
--   (1) FAIL-CLOSED: giáo viên / học viên gọi RPC là bị chặn;
--   (2) chỉ buổi NHÁP mới gắn được — buổi đã công bố bị từ chối;
--   (3) trang của buổi KHÁC và trang mở đầu đều bị từ chối, và từ chối bằng cách
--       huỷ CẢ LƯỢT (đây là vế an ninh, khác hẳn "thẻ đã có media" ở dưới);
--   (4) `front_alt` bắt buộc đi kèm ảnh — nếu không, `flashcard_pages_alt_pairing_check`
--       sẽ nổ ở chỗ khác và người dùng nhận thông báo constraint không đọc được;
--   (5) luật GHI ĐÈ: tắt thì bỏ qua và KHÔNG trả `removed_paths` (file cũ sống),
--       bật thì thay và trả đúng đường dẫn cũ để tầng app dọn bucket.

begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

-- =====================================================================
-- Hình dạng
-- =====================================================================
select has_function(
  'public', 'attach_flashcard_section_media',
  array['uuid', 'jsonb', 'boolean'],
  'RPC gắn media hàng loạt tồn tại'
);

select ok(
  not has_function_privilege('anon', 'public.attach_flashcard_section_media(uuid,jsonb,boolean)', 'EXECUTE'),
  'anon KHÔNG gọi được RPC gắn media'
);

select ok(
  has_function_privilege('authenticated', 'public.attach_flashcard_section_media(uuid,jsonb,boolean)', 'EXECUTE'),
  'authenticated gọi được (quyền thật do app.is_super_admin() chặn bên trong)'
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
    '77000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'admin.bulkmedia@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '77000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'gv.bulkmedia@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('77000000-0000-4000-8000-000000000001', 'super_admin', 'Admin BulkMedia', 'admin.bulkmedia@polymind.test'),
  ('77000000-0000-4000-8000-000000000002', 'teacher', 'Giáo viên BulkMedia', 'gv.bulkmedia@polymind.test');

insert into public.courses (
  id, code, title, program, course_type, default_session_count, status
)
values ('77200000-0000-4000-8000-000000000001', 'KH-BULKMEDIA', 'Khóa BulkMedia', 'core', 'custom', 10, 'active');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"77000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.flashcard_decks (id, course_id, code, title)
values ('77500000-0000-4000-8000-000000000001', '77200000-0000-4000-8000-000000000001', 'deck-bulkmedia-77', 'Deck BulkMedia');

insert into public.flashcard_sections (id, deck_id, session_number, title, status)
values
  ('77600000-0000-4000-8000-000000000001', '77500000-0000-4000-8000-000000000001', 1, 'Buổi nháp', 'draft'),
  ('77600000-0000-4000-8000-000000000002', '77500000-0000-4000-8000-000000000001', 2, 'Buổi khác', 'draft');

-- Buổi 1: trang mở đầu + 3 thẻ từ vựng. Thẻ 胡萝卜 đã có sẵn cả ảnh lẫn audio để
-- kiểm luật ghi đè; hai thẻ còn lại trống.
insert into public.flashcard_pages (
  id, section_id, order_index, kind, created_by,
  front_image_path, back_image_path, front_alt, back_alt
)
values (
  '77700000-0000-4000-8000-000000000000',
  '77600000-0000-4000-8000-000000000001', 0, 'session_cover',
  '77000000-0000-4000-8000-000000000001',
  -- Trang mở đầu chỉ còn MỘT ảnh (`…084`/`D-41`): back luôn null.
  'cover/front.jpg', null, 'Mặt trước trang mở đầu', null
);

insert into public.flashcard_pages (
  id, section_id, order_index, kind, created_by,
  hanzi, pinyin_syllables, meaning_vi,
  front_image_path, front_alt, audio_path
)
values
  (
    '77700000-0000-4000-8000-000000000001',
    '77600000-0000-4000-8000-000000000001', 1, 'vocabulary',
    '77000000-0000-4000-8000-000000000001',
    '胡萝卜', 'hú luó bo', 'Củ cà rốt',
    'old/front-carot.jpg', 'Alt cũ', 'old/audio-carot.mp3'
  ),
  (
    '77700000-0000-4000-8000-000000000002',
    '77600000-0000-4000-8000-000000000001', 2, 'vocabulary',
    '77000000-0000-4000-8000-000000000001',
    '苹果', 'píng guǒ', 'Quả táo', null, null, null
  ),
  (
    '77700000-0000-4000-8000-000000000003',
    '77600000-0000-4000-8000-000000000001', 3, 'vocabulary',
    '77000000-0000-4000-8000-000000000001',
    '你好', 'nǐ hǎo', 'Xin chào', null, null, null
  );

-- Trang thuộc buổi KHÁC — dùng để kiểm vế "không thuộc buổi đã chọn".
insert into public.flashcard_pages (
  id, section_id, order_index, kind, created_by,
  hanzi, pinyin_syllables, meaning_vi
)
values (
  '77700000-0000-4000-8000-000000000009',
  '77600000-0000-4000-8000-000000000002', 1, 'vocabulary',
  '77000000-0000-4000-8000-000000000001',
  '别的', 'bié de', 'Cái khác'
);

-- =====================================================================
-- (1) FAIL-CLOSED
-- =====================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"77000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000002","audio_path":"a/b/c/d/audio-1.mp3"}]'::jsonb,
      false
    )$$,
  'Chỉ Super Admin được gắn media flashcard',
  'giáo viên bị chặn'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select * from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000002","audio_path":"a/b/c/d/audio-1.mp3"}]'::jsonb,
      false
    )$$,
  'Chỉ Super Admin được gắn media flashcard',
  'phiên không đăng nhập bị chặn'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"77000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- =====================================================================
-- (3) Vế an ninh — huỷ CẢ LƯỢT
-- =====================================================================
select throws_ok(
  $$select * from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000009","audio_path":"a/b/c/d/audio-1.mp3"}]'::jsonb,
      false
    )$$,
  'Trang flashcard không thuộc buổi đã chọn',
  'trang của buổi khác bị từ chối'
);

select throws_ok(
  $$select * from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000000","audio_path":"a/b/c/d/audio-1.mp3"}]'::jsonb,
      false
    )$$,
  'Trang mở đầu không nhận media hàng loạt',
  'trang mở đầu bị từ chối'
);

-- Một thẻ hợp lệ đứng TRƯỚC một thẻ phạm luật: cả lượt phải huỷ, thẻ hợp lệ
-- KHÔNG được ghi. Đây là chỗ phân biệt "huỷ cả lượt" với "bỏ qua từng dòng".
select throws_ok(
  $$select * from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000002","audio_path":"a/b/c/d/audio-1.mp3"},
        {"page_id":"77700000-0000-4000-8000-000000000009","audio_path":"a/b/c/d/audio-2.mp3"}]'::jsonb,
      false
    )$$,
  'Trang flashcard không thuộc buổi đã chọn',
  'lô có một trang phạm luật thì huỷ cả lượt'
);

select is(
  (select audio_path from public.flashcard_pages
   where id = '77700000-0000-4000-8000-000000000002'),
  null,
  'thẻ hợp lệ trong lô bị huỷ vẫn KHÔNG được ghi'
);

-- =====================================================================
-- (4) Alt bắt buộc đi kèm ảnh
-- =====================================================================
select throws_ok(
  $$select * from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000002","front_image_path":"a/b/c/d/front-1.jpg"}]'::jsonb,
      false
    )$$,
  'Thiếu alt cho ảnh mặt trước',
  'ảnh không kèm alt bị từ chối bằng câu đọc được'
);

-- =====================================================================
-- Đường chính: gắn cho thẻ đang trống
-- =====================================================================
select is(
  (select count(*)::integer from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000002",
         "front_image_path":"a/b/c/d/front-apple.jpg",
         "front_alt":"Mặt trước thẻ từ vựng 苹果 — Quả táo",
         "audio_path":"a/b/c/d/audio-apple.mp3"},
        {"page_id":"77700000-0000-4000-8000-000000000003",
         "audio_path":"a/b/c/d/audio-hello.mp3"}]'::jsonb,
      false
    )),
  2,
  'trả về đúng một dòng cho mỗi thẻ được gửi'
);

select is(
  (select audio_path from public.flashcard_pages
   where id = '77700000-0000-4000-8000-000000000003'),
  'a/b/c/d/audio-hello.mp3',
  'audio được ghi cho thẻ chỉ gắn audio'
);

select is(
  (select front_alt from public.flashcard_pages
   where id = '77700000-0000-4000-8000-000000000002'),
  'Mặt trước thẻ từ vựng 苹果 — Quả táo',
  'alt do tầng app tính được ghi nguyên văn'
);

-- Trigger `app.sync_flashcard_media_paths()` phải gom đường dẫn mới vào
-- `media_paths` — cột mà policy Storage của học viên đọc. Không có bước này thì
-- ảnh gắn hàng loạt hiện với admin nhưng học viên nhận 403 (đúng mẫu `DS-049`).
select is(
  (select count(*)::integer from public.flashcard_pages
   where id = '77700000-0000-4000-8000-000000000002'
     and media_paths @> array['a/b/c/d/front-apple.jpg', 'a/b/c/d/audio-apple.mp3']),
  1,
  'media_paths được trigger cập nhật để học viên đọc được file'
);

-- =====================================================================
-- (5) Luật GHI ĐÈ
-- =====================================================================
select is(
  (select skipped_audio from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000001","audio_path":"a/b/c/d/audio-moi.mp3"}]'::jsonb,
      false
    )),
  true,
  'ghi đè TẮT: thẻ đã có audio bị bỏ qua'
);

select is(
  (select audio_path from public.flashcard_pages
   where id = '77700000-0000-4000-8000-000000000001'),
  'old/audio-carot.mp3',
  'ghi đè TẮT: file cũ còn nguyên'
);

select is(
  (select removed_paths from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000001","audio_path":"a/b/c/d/audio-moi.mp3"}]'::jsonb,
      false
    )),
  '{}'::text[],
  'ghi đè TẮT: KHÔNG trả đường dẫn nào để xoá — đây là vế giữ file cho người dùng'
);

select is(
  (select removed_paths from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000001","audio_path":"a/b/c/d/audio-moi.mp3"}]'::jsonb,
      true
    )),
  array['old/audio-carot.mp3'],
  'ghi đè BẬT: trả đúng đường dẫn cũ để tầng app dọn bucket'
);

select is(
  (select audio_path from public.flashcard_pages
   where id = '77700000-0000-4000-8000-000000000001'),
  'a/b/c/d/audio-moi.mp3',
  'ghi đè BẬT: audio mới đã thay audio cũ'
);

-- Gắn lại ĐÚNG đường dẫn đang có: không được báo là file cũ bị thay, nếu không
-- tầng app sẽ xoá khỏi bucket chính cái file mà DB vẫn đang trỏ tới.
select is(
  (select removed_paths from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000001","audio_path":"a/b/c/d/audio-moi.mp3"}]'::jsonb,
      true
    )),
  '{}'::text[],
  'gắn lại đúng file đang dùng thì không trả nó vào danh sách xoá'
);

-- =====================================================================
-- (2) Chỉ buổi NHÁP
-- =====================================================================
-- Cần đủ điều kiện công bố: mọi thẻ từ vựng phải có audio.
update public.flashcard_pages
set audio_path = 'a/b/c/d/audio-apple.mp3'
where id = '77700000-0000-4000-8000-000000000002'
  and audio_path is null;

update public.flashcard_sections
set status = 'published'
where id = '77600000-0000-4000-8000-000000000001';

select throws_ok(
  $$select * from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000001',
      '[{"page_id":"77700000-0000-4000-8000-000000000003","audio_path":"a/b/c/d/audio-x.mp3"}]'::jsonb,
      false
    )$$,
  'Chỉ gắn media cho buổi flashcard đang nháp',
  'buổi đã công bố không gắn được media'
);

-- =====================================================================
-- Buổi không tồn tại
-- =====================================================================
select throws_ok(
  $$select * from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-0000000000ff',
      '[{"page_id":"77700000-0000-4000-8000-000000000003","audio_path":"a/b/c/d/audio-x.mp3"}]'::jsonb,
      false
    )$$,
  'Không tìm thấy buổi flashcard',
  'buổi không tồn tại bị từ chối'
);

select throws_ok(
  $$select * from public.attach_flashcard_section_media(
      '77600000-0000-4000-8000-000000000002',
      '"khong-phai-mang"'::jsonb,
      false
    )$$,
  'Danh sách gắn media không hợp lệ',
  'payload không phải mảng bị từ chối'
);

select * from finish();
rollback;
