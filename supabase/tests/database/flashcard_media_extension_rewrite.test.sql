-- `PERF-IMG-2` — đổi ĐUÔI file media của một buổi ĐÃ CÔNG BỐ.
--
-- Hàm này là thứ duy nhất trong hệ đi vòng qua `trg_flashcard_pages_guard_history`
-- (thứ đang chặn việc sửa nội dung buổi đã công bố). Bài kiểm vì thế nặng về
-- chiều PHỦ ĐỊNH: chứng minh khe mở ra đúng bằng thiết kế, và cái chốt cũ vẫn
-- còn nguyên cho mọi đường khác.
--
--   (1) chỉ `service_role` gọi được — `anon`/`authenticated` thì không;
--   (2) đổi được đuôi trên buổi ĐÃ CÔNG BỐ, mà buổi vẫn công bố và **giữ nguyên
--       mốc `published_at`** (mã QR in trong sách không được chớp tắt);
--   (3) `media_paths` được trigger tính lại theo đường dẫn MỚI;
--   (4) ảnh trong `jsonb` câu ví dụ đổi theo; mục không có ảnh giữ NGUYÊN;
--   (5) 🔴 đổi cả thân đường dẫn bị TỪ CHỐI — nếu không, hàm này trở thành đường
--       chuyển media từ thẻ này sang thẻ khác;
--   (6) 🔴 chốt cũ còn nguyên: `update` thẳng vào trang của buổi đã công bố vẫn đỏ.

begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

-- =====================================================================
-- Dữ liệu mẫu
-- =====================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '90000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'admin.webp@polymind.test', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
);

insert into public.profiles (id, role, full_name, email)
values ('90000000-0000-4000-8000-000000000001', 'super_admin', 'Admin WebP', 'admin.webp@polymind.test');

insert into public.courses (id, code, title, program, course_type, default_session_count, status)
values ('90200000-0000-4000-8000-000000000001', 'KH-WEBP', 'Khóa WebP', 'core', 'custom', 3, 'active');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.flashcard_decks (id, course_id, code, title)
values ('90500000-0000-4000-8000-000000000001', '90200000-0000-4000-8000-000000000001', 'deck-webp-90', 'Deck WebP');

insert into public.flashcard_sections (id, deck_id, session_number, title)
values ('90600000-0000-4000-8000-000000000001', '90500000-0000-4000-8000-000000000001', 1, 'Buổi WebP');

insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  hanzi, pinyin_syllables, meaning_vi,
  front_image_path, back_image_path, audio_path, front_alt, back_alt,
  example_sentences
)
values
  (
    '90700000-0000-4000-8000-000000000001', '90600000-0000-4000-8000-000000000001',
    -- Trang mở đầu chỉ còn MỘT ảnh (`…084`/`D-41`): back luôn null.
    'session_cover', 0, null, null, null,
    '90000000-0000-4000-8000-000000000001/d1/s1/p1/front-1.png',
    null,
    null, 'bìa trước', null, '[]'::jsonb
  ),
  (
    '90700000-0000-4000-8000-000000000002', '90600000-0000-4000-8000-000000000001',
    'vocabulary', 1, '書', 'shū', 'sách',
    '90000000-0000-4000-8000-000000000001/d1/s1/p2/front-2.png', null,
    '90000000-0000-4000-8000-000000000001/d1/s1/p2/audio-2.mp3', 'ảnh sách', null,
    -- Một câu CÓ ảnh, một câu KHÔNG — vế thứ hai là chỗ dễ sinh khoá rác nhất.
    '[{"hanzi":"這是書","pinyin":"zhè shì shū","meaning_vi":"Đây là sách",
       "image_path":"90000000-0000-4000-8000-000000000001/d1/s1/p2/example-0-1.png"},
      {"hanzi":"我看書","pinyin":"wǒ kàn shū","meaning_vi":"Tôi đọc sách"}]'::jsonb
  );

select public.publish_flashcard_section('90600000-0000-4000-8000-000000000001');

-- Ghim mốc công bố để so lại sau khi đổi đuôi.
select set_config(
  'test.published_at',
  (select published_at::text from public.flashcard_sections
   where id = '90600000-0000-4000-8000-000000000001'),
  true
);

-- =====================================================================
-- A. Bề mặt gọi được — chỉ service_role
-- =====================================================================
select ok(
  not has_function_privilege(
    'anon', 'public.rewrite_flashcard_media_extension(jsonb)', 'EXECUTE'),
  'anon KHÔNG gọi được hàm đổi đuôi'
);

select ok(
  not has_function_privilege(
    'authenticated', 'public.rewrite_flashcard_media_extension(jsonb)', 'EXECUTE'),
  'authenticated KHÔNG gọi được — kể cả super_admin đăng nhập bằng trình duyệt'
);

select ok(
  has_function_privilege(
    'service_role', 'public.rewrite_flashcard_media_extension(jsonb)', 'EXECUTE'),
  'service_role gọi được — script vận hành chạy bằng khoá này'
);

select ok(
  not has_schema_privilege('anon', 'app', 'USAGE'),
  'anon vẫn không có USAGE trên schema app'
);

-- =====================================================================
-- B. 🔴 Chốt cũ còn nguyên
-- =====================================================================
-- Nếu bài này chuyển sang xanh nghĩa là ai đó đã nới `guard_flashcard_page_history`
-- — lúc đó hàm đổi đuôi không còn là con đường DUY NHẤT sửa được buổi đã công bố.
reset role;
select throws_ok(
  $$update public.flashcard_pages
    set front_image_path = 'x/y/z/p/front-9.webp'
    where id = '90700000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Đưa buổi flashcard về nháp trước khi sửa trang',
  'update thẳng vào trang của buổi ĐÃ CÔNG BỐ vẫn bị chặn'
);

-- =====================================================================
-- C. Đổi đuôi — đường đi đúng
-- =====================================================================
set local role service_role;

select set_config(
  'test.applied',
  public.rewrite_flashcard_media_extension(
    jsonb_build_object(
      '90000000-0000-4000-8000-000000000001/d1/s1/p1/front-1.png',
      '90000000-0000-4000-8000-000000000001/d1/s1/p1/front-1.webp',
      -- Bảng tra CỐ Ý vẫn mang một khoá `back-…`: script vận hành liệt kê file
      -- có thật trong bucket, mà bucket còn ảnh mặt sau cũ cho tới khi
      -- `media:prune-cover-back` chạy. Đường dẫn không còn trang nào tham chiếu
      -- thì hàm phải bỏ qua nó, không được đếm vào danh sách "đã thay" (nếu
      -- không, script sẽ xoá một file mà DB chưa hề đổi).
      '90000000-0000-4000-8000-000000000001/d1/s1/p1/back-1.png',
      '90000000-0000-4000-8000-000000000001/d1/s1/p1/back-1.webp',
      '90000000-0000-4000-8000-000000000001/d1/s1/p2/front-2.png',
      '90000000-0000-4000-8000-000000000001/d1/s1/p2/front-2.webp',
      '90000000-0000-4000-8000-000000000001/d1/s1/p2/example-0-1.png',
      '90000000-0000-4000-8000-000000000001/d1/s1/p2/example-0-1.webp'
    )
  )::text,
  true
);

select is(
  (select count(*)::integer
   from jsonb_array_elements_text(current_setting('test.applied')::jsonb)),
  -- 4 → 3 (`COVER-1`): bìa chỉ còn MỘT ảnh nên khoá `back-1.png` trong bảng tra
  -- không khớp trang nào. Con số này là thứ script dùng để quyết định xoá file
  -- cũ, nên nó phải đếm đúng số đường dẫn DB THẬT SỰ đã đổi.
  3,
  'trả về đúng 3 đường dẫn cũ đã được thay — script chỉ xoá đúng bấy nhiêu file'
);

-- `service_role` KHÔNG có quyền đọc bảng flashcard (migration `…015` chỉ cấp cho
-- các bảng tồn tại lúc đó, flashcard sinh sau). Đọc để đối chiếu vì thế phải về
-- vai chủ bảng — và chính điều này là lý do RPC phải trả về danh sách đường dẫn.
reset role;

select is(
  (select front_image_path from public.flashcard_pages
   where id = '90700000-0000-4000-8000-000000000001'),
  '90000000-0000-4000-8000-000000000001/d1/s1/p1/front-1.webp',
  'ảnh mặt trước của bìa đã sang .webp'
);

-- 🔴 Bài này ĐỔI CHIỀU ở `COVER-1`: trước đây nó ghim "ảnh mặt sau của bìa đã
-- sang .webp". Nay bìa chỉ còn một ảnh, nên thứ đáng canh là chiều ngược lại —
-- hàm đổi đuôi KHÔNG được làm sống lại một đường dẫn mặt sau chỉ vì bảng tra do
-- script dựng còn nhắc tới nó.
select is(
  (select back_image_path from public.flashcard_pages
   where id = '90700000-0000-4000-8000-000000000001'),
  null,
  'bìa vẫn KHÔNG có ảnh mặt sau sau khi đổi đuôi'
);

select is(
  (select audio_path from public.flashcard_pages
   where id = '90700000-0000-4000-8000-000000000002'),
  '90000000-0000-4000-8000-000000000001/d1/s1/p2/audio-2.mp3',
  'audio KHÔNG nằm trong bảng tra nên giữ nguyên'
);

-- =====================================================================
-- D. jsonb — câu có ảnh đổi, câu không ảnh giữ nguyên
-- =====================================================================
select is(
  (select example_sentences -> 0 ->> 'image_path' from public.flashcard_pages
   where id = '90700000-0000-4000-8000-000000000002'),
  '90000000-0000-4000-8000-000000000001/d1/s1/p2/example-0-1.webp',
  'ảnh trong câu ví dụ đã sang .webp'
);

select ok(
  (select not (example_sentences -> 1 ? 'image_path') from public.flashcard_pages
   where id = '90700000-0000-4000-8000-000000000002'),
  'câu ví dụ vốn không có ảnh KHÔNG bị mọc thêm khoá image_path'
);

select is(
  (select example_sentences -> 1 ->> 'hanzi' from public.flashcard_pages
   where id = '90700000-0000-4000-8000-000000000002'),
  '我看書',
  'thứ tự và nội dung câu ví dụ giữ nguyên'
);

-- =====================================================================
-- E. `media_paths` + trạng thái buổi
-- =====================================================================
select ok(
  (select media_paths @> array[
      '90000000-0000-4000-8000-000000000001/d1/s1/p2/front-2.webp',
      '90000000-0000-4000-8000-000000000001/d1/s1/p2/example-0-1.webp'
    ]
    and not (media_paths @> array['90000000-0000-4000-8000-000000000001/d1/s1/p2/front-2.png'])
   from public.flashcard_pages
   where id = '90700000-0000-4000-8000-000000000002'),
  'trigger tính lại media_paths theo đường dẫn MỚI — học viên vẫn ký được URL'
);

select ok(
  (select status = 'published'
     and published_at::text = current_setting('test.published_at')
   from public.flashcard_sections
   where id = '90600000-0000-4000-8000-000000000001'),
  'buổi vẫn CÔNG BỐ và giữ NGUYÊN mốc công bố cũ'
);

-- =====================================================================
-- F. 🔴 Chiều phủ định — không được đổi thân đường dẫn
-- =====================================================================
select throws_ok(
  $$select public.rewrite_flashcard_media_extension(
      '{"90000000-0000-4000-8000-000000000001/d1/s1/p1/front-1.webp":
        "90000000-0000-4000-8000-000000000001/d1/s1/p9/front-9.webp"}'::jsonb
    )$$,
  'P0001',
  null,
  'đổi cả thân đường dẫn bị từ chối — không thể chuyển media sang thẻ khác'
);

rollback;
