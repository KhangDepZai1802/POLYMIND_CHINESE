-- Gắn ảnh TRANG MỞ ĐẦU hàng loạt cho cả BỘ THẺ (`COVER-1`/`D-41`, migration `…084`).
--
-- Sáu điều bài này phải chứng minh:
--   (1) trang mở đầu nay chỉ nhận ĐÚNG MỘT ảnh — DB từ chối trang mở đầu mang
--       ảnh mặt sau, và cũng từ chối trang mở đầu KHÔNG có ảnh nào;
--   (2) FAIL-CLOSED: giáo viên gọi RPC là bị chặn;
--   (3) buổi chưa có trang mở đầu → RPC TẠO trang mới ở `order_index = 0`;
--   (4) buổi ĐÃ CÔNG BỐ bị **bỏ qua bằng `row_status`**, KHÔNG ném lỗi và KHÔNG
--       kéo theo 34 buổi còn lại — đây là điểm khác `…077` và là chỗ dễ bị
--       "sửa cho nhất quán" nhất;
--   (5) luật GHI ĐÈ: tắt thì bỏ qua và KHÔNG trả `removed_paths` (ảnh cũ sống),
--       bật thì thay và trả đúng đường dẫn cũ để tầng app dọn bucket;
--   (6) buổi thuộc BỘ KHÁC bị từ chối bằng cách huỷ CẢ LƯỢT — vế an ninh, khác
--       hẳn "buổi đã công bố" ở (4).

begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

-- =====================================================================
-- Hình dạng
-- =====================================================================
select has_function(
  'public', 'attach_flashcard_deck_covers',
  array['uuid', 'jsonb', 'boolean'],
  'RPC gắn ảnh mở đầu hàng loạt tồn tại'
);

select ok(
  not has_function_privilege('anon', 'public.attach_flashcard_deck_covers(uuid,jsonb,boolean)', 'EXECUTE'),
  'anon KHÔNG gọi được RPC gắn ảnh mở đầu — bề mặt `D-36` không bị nới'
);

select ok(
  has_function_privilege('authenticated', 'public.attach_flashcard_deck_covers(uuid,jsonb,boolean)', 'EXECUTE'),
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
    '84000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'admin.covers@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '84000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'gv.covers@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('84000000-0000-4000-8000-000000000001', 'super_admin', 'Admin Covers', 'admin.covers@polymind.test'),
  ('84000000-0000-4000-8000-000000000002', 'teacher', 'Giáo viên Covers', 'gv.covers@polymind.test');

insert into public.courses (
  id, code, title, program, course_type, default_session_count, status
)
values ('84200000-0000-4000-8000-000000000001', 'KH-COVERS', 'Khóa Covers', 'core', 'custom', 10, 'active');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"84000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.flashcard_decks (id, course_id, code, title)
values
  ('84500000-0000-4000-8000-000000000001', '84200000-0000-4000-8000-000000000001', 'deck-covers-84', 'Deck Covers'),
  ('84500000-0000-4000-8000-000000000002', '84200000-0000-4000-8000-000000000001', 'deck-covers-84b', 'Deck Covers B');

insert into public.flashcard_sections (id, deck_id, session_number, title, status)
values
  -- Buổi 1: đã có ảnh mở đầu → dùng cho luật ghi đè.
  ('84600000-0000-4000-8000-000000000001', '84500000-0000-4000-8000-000000000001', 1, 'Buổi có bìa', 'draft'),
  -- Buổi 2: chưa có trang mở đầu → dùng cho đường TẠO MỚI.
  ('84600000-0000-4000-8000-000000000002', '84500000-0000-4000-8000-000000000001', 2, 'Buổi trống bìa', 'draft'),
  -- Buổi 3: sẽ công bố → dùng cho vế "bỏ qua, không ném lỗi".
  ('84600000-0000-4000-8000-000000000003', '84500000-0000-4000-8000-000000000001', 3, 'Buổi sẽ công bố', 'draft'),
  -- Buổi của BỘ KHÁC → dùng cho vế an ninh.
  ('84600000-0000-4000-8000-000000000004', '84500000-0000-4000-8000-000000000002', 1, 'Buổi bộ khác', 'draft');

insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  front_image_path, front_alt
)
values
  (
    '84700000-0000-4000-8000-000000000001', '84600000-0000-4000-8000-000000000001',
    'session_cover', 0,
    '84000000-0000-4000-8000-000000000001/d1/s1/p1/front-cu.png', 'bìa cũ buổi 1'
  ),
  (
    '84700000-0000-4000-8000-000000000003', '84600000-0000-4000-8000-000000000003',
    'session_cover', 0,
    '84000000-0000-4000-8000-000000000001/d1/s3/p3/front-3.png', 'bìa buổi 3'
  );

-- Buổi 3 cần một thẻ từ vựng mới công bố được.
insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  hanzi, pinyin_syllables, meaning_vi, audio_path
)
values (
  '84700000-0000-4000-8000-000000000030', '84600000-0000-4000-8000-000000000003',
  'vocabulary', 1, '書', 'shū', 'sách',
  '84000000-0000-4000-8000-000000000001/d1/s3/p30/audio-30.mp3'
);

select public.publish_flashcard_section('84600000-0000-4000-8000-000000000003');

-- =====================================================================
-- (1) Trang mở đầu = ĐÚNG MỘT ảnh
-- =====================================================================
-- 🔴 Hai bài này là chốt chặn của `D-41`. Nếu chúng chuyển sang xanh khi ai đó
-- "khôi phục cho giống bản cũ" thì mô hình một-ảnh đã bị nới, và hậu quả chỉ lộ
-- ra ở chỗ nhìn thấy được: hai mặt thẻ hiện hai ảnh khác nhau trên đúng trang QR
-- đã in trong sách.
select throws_ok(
  $$insert into public.flashcard_pages (
      id, section_id, kind, order_index,
      front_image_path, back_image_path, front_alt, back_alt
    ) values (
      '84700000-0000-4000-8000-000000000090',
      '84600000-0000-4000-8000-000000000002',
      'session_cover', 0,
      '84000000-0000-4000-8000-000000000001/d1/s2/p90/front-x.png',
      '84000000-0000-4000-8000-000000000001/d1/s2/p90/back-x.png',
      'a', 'b'
    )$$,
  '23514',
  null,
  'trang mở đầu KHÔNG được mang ảnh mặt sau (D-41)'
);

select throws_ok(
  $$insert into public.flashcard_pages (
      id, section_id, kind, order_index, front_image_path, front_alt
    ) values (
      '84700000-0000-4000-8000-000000000091',
      '84600000-0000-4000-8000-000000000002',
      'session_cover', 0, null, null
    )$$,
  '23514',
  null,
  'trang mở đầu vẫn BẮT BUỘC có ảnh — bỏ mặt sau không có nghĩa là bỏ luôn ảnh'
);

-- =====================================================================
-- (2) Fail-closed
-- =====================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"84000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.attach_flashcard_deck_covers(
      '84500000-0000-4000-8000-000000000001',
      '[{"section_id":"84600000-0000-4000-8000-000000000002",
         "page_id":"84700000-0000-4000-8000-000000000002",
         "front_image_path":"x/y/z/p/front-1.png","front_alt":"bìa"}]'::jsonb,
      false
    )$$,
  'P0001',
  'Chỉ Super Admin được gắn ảnh mở đầu flashcard',
  'giáo viên KHÔNG gắn được ảnh mở đầu hàng loạt'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"84000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- =====================================================================
-- (6) Buổi thuộc BỘ KHÁC → huỷ cả lượt
-- =====================================================================
select throws_ok(
  $$select * from public.attach_flashcard_deck_covers(
      '84500000-0000-4000-8000-000000000001',
      '[{"section_id":"84600000-0000-4000-8000-000000000004",
         "page_id":"84700000-0000-4000-8000-000000000004",
         "front_image_path":"x/y/z/p/front-4.png","front_alt":"bìa"}]'::jsonb,
      false
    )$$,
  'P0001',
  'Buổi flashcard không thuộc bộ đã chọn',
  'buổi của bộ khác bị từ chối, và từ chối bằng cách huỷ CẢ LƯỢT'
);

-- Alt bắt buộc đi kèm ảnh: thiếu nó thì `flashcard_pages_alt_pairing_check` sẽ
-- nổ ở chỗ khác với một thông báo constraint không ai đọc được.
select throws_ok(
  $$select * from public.attach_flashcard_deck_covers(
      '84500000-0000-4000-8000-000000000001',
      '[{"section_id":"84600000-0000-4000-8000-000000000002",
         "page_id":"84700000-0000-4000-8000-000000000002",
         "front_image_path":"x/y/z/p/front-2.png"}]'::jsonb,
      false
    )$$,
  'P0001',
  'Thiếu alt cho ảnh mở đầu buổi 2',
  'thiếu alt bị chặn, và thông báo nói rõ BUỔI NÀO'
);

-- Một buổi hai ảnh trong cùng một lượt: nói thẳng thay vì chọn bừa.
select throws_ok(
  $$select * from public.attach_flashcard_deck_covers(
      '84500000-0000-4000-8000-000000000001',
      '[{"section_id":"84600000-0000-4000-8000-000000000002",
         "page_id":"84700000-0000-4000-8000-000000000002",
         "front_image_path":"x/y/z/p/front-a.png","front_alt":"a"},
        {"section_id":"84600000-0000-4000-8000-000000000002",
         "page_id":"84700000-0000-4000-8000-000000000002",
         "front_image_path":"x/y/z/p/front-b.png","front_alt":"b"}]'::jsonb,
      false
    )$$,
  'P0001',
  'Mỗi buổi chỉ nhận một ảnh mở đầu trong một lượt',
  'hai ảnh cho cùng một buổi bị chặn, không chọn bừa file nào'
);

-- =====================================================================
-- (3) Tạo mới + (4) bỏ qua buổi đã công bố + (5) ghi đè TẮT
-- =====================================================================
-- MỘT lượt gọi chạm cả ba tình huống — đúng thứ xảy ra thật khi admin thả 35 ảnh
-- vào một bộ đang soạn dở. Nếu vế "đã công bố" ném lỗi thay vì trả `row_status`
-- thì hai buổi kia cũng mất trắng, và bài này sẽ đỏ ở cả ba chỗ.
select set_config(
  'test.mixed',
  (
    select jsonb_agg(
      jsonb_build_object('section_id', section_id, 'row_status', row_status,
                         'removed', removed_paths)
      order by section_id
    )::text
    from public.attach_flashcard_deck_covers(
      '84500000-0000-4000-8000-000000000001',
      '[{"section_id":"84600000-0000-4000-8000-000000000001",
         "page_id":"84700000-0000-4000-8000-000000000001",
         "front_image_path":"84000000-0000-4000-8000-000000000001/d1/s1/p1/front-moi.png",
         "front_alt":"bìa mới buổi 1"},
        {"section_id":"84600000-0000-4000-8000-000000000002",
         "page_id":"84700000-0000-4000-8000-000000000002",
         "front_image_path":"84000000-0000-4000-8000-000000000001/d1/s2/p2/front-2.png",
         "front_alt":"bìa buổi 2"},
        {"section_id":"84600000-0000-4000-8000-000000000003",
         "page_id":"84700000-0000-4000-8000-000000000003",
         "front_image_path":"84000000-0000-4000-8000-000000000001/d1/s3/p3/front-3-moi.png",
         "front_alt":"bìa mới buổi 3"}]'::jsonb,
      false
    )
  ),
  true
);

select is(
  (select count(*)::integer
   from jsonb_array_elements(current_setting('test.mixed')::jsonb)),
  3,
  'trả về đủ 3 hàng — buổi đã công bố vẫn có mặt trong kết quả, không bị nuốt'
);

select is(
  (select item ->> 'row_status'
   from jsonb_array_elements(current_setting('test.mixed')::jsonb) item
   where item ->> 'section_id' = '84600000-0000-4000-8000-000000000002'),
  'created',
  'buổi chưa có bìa → TẠO trang mở đầu mới'
);

select is(
  (select item ->> 'row_status'
   from jsonb_array_elements(current_setting('test.mixed')::jsonb) item
   where item ->> 'section_id' = '84600000-0000-4000-8000-000000000001'),
  'skipped_existing',
  'ghi đè TẮT: buổi đã có bìa bị bỏ qua'
);

select is(
  (select item ->> 'row_status'
   from jsonb_array_elements(current_setting('test.mixed')::jsonb) item
   where item ->> 'section_id' = '84600000-0000-4000-8000-000000000003'),
  'skipped_published',
  'buổi ĐÃ CÔNG BỐ bị bỏ qua bằng row_status, KHÔNG ném lỗi'
);

select is(
  (select front_image_path from public.flashcard_pages
   where id = '84700000-0000-4000-8000-000000000001'),
  '84000000-0000-4000-8000-000000000001/d1/s1/p1/front-cu.png',
  'ghi đè TẮT: ảnh cũ của buổi 1 còn nguyên'
);

select is(
  (select front_image_path from public.flashcard_pages
   where id = '84700000-0000-4000-8000-000000000003'),
  '84000000-0000-4000-8000-000000000001/d1/s3/p3/front-3.png',
  'buổi đã công bố: ảnh không hề bị đụng tới'
);

-- Trang vừa TẠO phải đúng hình dạng của trang mở đầu, không chỉ "có tồn tại".
select is(
  (select order_index from public.flashcard_pages
   where id = '84700000-0000-4000-8000-000000000002'),
  0,
  'trang mở đầu mới nằm ở order_index = 0'
);

select is(
  (select back_image_path from public.flashcard_pages
   where id = '84700000-0000-4000-8000-000000000002'),
  null,
  'trang mở đầu mới KHÔNG có ảnh mặt sau'
);

select is(
  (select created_by from public.flashcard_pages
   where id = '84700000-0000-4000-8000-000000000002'),
  '84000000-0000-4000-8000-000000000001'::uuid,
  'người tạo là ACTOR THẬT lấy từ auth.uid() (bài học BUG_M06_01)'
);

select is(
  (select media_paths from public.flashcard_pages
   where id = '84700000-0000-4000-8000-000000000002'),
  array['84000000-0000-4000-8000-000000000001/d1/s2/p2/front-2.png'],
  'media_paths được trigger cập nhật — không có bước này thì học viên nhận 403'
);

-- =====================================================================
-- (5) Ghi đè BẬT
-- =====================================================================
select is(
  (select removed_paths from public.attach_flashcard_deck_covers(
      '84500000-0000-4000-8000-000000000001',
      '[{"section_id":"84600000-0000-4000-8000-000000000001",
         "page_id":"84700000-0000-4000-8000-000000000001",
         "front_image_path":"84000000-0000-4000-8000-000000000001/d1/s1/p1/front-moi.png",
         "front_alt":"bìa mới buổi 1"}]'::jsonb,
      true
    )),
  array['84000000-0000-4000-8000-000000000001/d1/s1/p1/front-cu.png'],
  'ghi đè BẬT: trả đúng đường dẫn cũ để tầng app dọn bucket'
);

select is(
  (select front_image_path from public.flashcard_pages
   where id = '84700000-0000-4000-8000-000000000001'),
  '84000000-0000-4000-8000-000000000001/d1/s1/p1/front-moi.png',
  'ghi đè BẬT: ảnh mới đã vào đúng trang'
);

select is(
  (select front_alt from public.flashcard_pages
   where id = '84700000-0000-4000-8000-000000000001'),
  'bìa mới buổi 1',
  'alt đi theo ảnh mới — alt cũ mồ côi là thứ chỉ trình đọc màn hình thấy'
);

-- Chạy lại y hệt: cùng đường dẫn thì KHÔNG có gì để dọn. Bài này canh việc RPC
-- không tự báo "đã xoá file X" cho một file vẫn đang được dùng — tầng app tin
-- vào `removed_paths` để gọi `storage.remove()`.
select is(
  (select removed_paths from public.attach_flashcard_deck_covers(
      '84500000-0000-4000-8000-000000000001',
      '[{"section_id":"84600000-0000-4000-8000-000000000001",
         "page_id":"84700000-0000-4000-8000-000000000001",
         "front_image_path":"84000000-0000-4000-8000-000000000001/d1/s1/p1/front-moi.png",
         "front_alt":"bìa mới buổi 1"}]'::jsonb,
      true
    )),
  '{}'::text[],
  'gắn lại đúng ảnh đang dùng: KHÔNG trả đường dẫn nào để xoá'
);

select * from finish();
rollback;
