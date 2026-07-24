-- Phase 16 / `P16-T4` — nhập hàng loạt thẻ từ vựng.
--
-- Điều bài này phải chứng minh: chặn trùng nằm ở **DB**, không phải ở app
-- (`BUG_M09_01`). Nên có bài ghi THẲNG vào bảng, bỏ qua RPC, và vẫn bị chặn.

begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select ok(
  exists (
    select 1 from pg_class
    where relname = 'ux_flashcard_pages_vocab_key' and relkind = 'i'
  ),
  'có unique index nghiệp vụ cho thẻ từ vựng'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '73000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'admin.import@polymind.test', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
);

insert into public.profiles (id, role, full_name, email)
values ('73000000-0000-4000-8000-000000000001', 'super_admin', 'Admin Import', 'admin.import@polymind.test');

insert into public.courses (
  id, code, title, program, course_type, default_session_count, status
)
values ('73200000-0000-4000-8000-000000000001', 'KH-IMPORT', 'Khóa Import', 'core', 'custom', 2, 'active');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.flashcard_decks (id, course_id, title)
values ('73500000-0000-4000-8000-000000000001', '73200000-0000-4000-8000-000000000001', 'Deck Import');

insert into public.flashcard_sections (id, deck_id, session_number, title)
values ('73600000-0000-4000-8000-000000000001', '73500000-0000-4000-8000-000000000001', 1, 'Buổi 1');

insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  front_image_path, back_image_path, front_alt, back_alt
)
values (
  '73700000-0000-4000-8000-000000000001', '73600000-0000-4000-8000-000000000001',
  'session_cover', 0,
  '73000000-0000-4000-8000-000000000001/s1/c/front-1.png',
  '73000000-0000-4000-8000-000000000001/s1/c/back-1.png',
  'trước', 'sau'
);

-- =====================================================================
-- Lượt nhập đầu tiên
-- =====================================================================
select is(
  (
    select count(*)::integer
    from public.import_flashcard_vocabulary(
      '73600000-0000-4000-8000-000000000001',
      '[{"hanzi":"苹果","pinyin_syllables":"píng guǒ","meaning_vi":"quả táo"},
        {"hanzi":"香蕉","pinyin_syllables":"xiāng jiāo","meaning_vi":"quả chuối"}]'::jsonb
    )
    where row_status = 'created'
  ),
  2,
  'lượt nhập đầu tạo đủ 2 thẻ'
);

select is(
  (select count(*)::integer from public.flashcard_pages where kind = 'vocabulary'),
  2,
  'DB có đúng 2 thẻ từ vựng'
);

select is(
  (
    select array_agg(order_index order by order_index)
    from public.flashcard_pages
    where section_id = '73600000-0000-4000-8000-000000000001' and archived_at is null
  ),
  array[0, 1, 2],
  'thứ tự liên tục từ 0 (cover giữ vị trí 0)'
);

-- Thẻ nhập hàng loạt chưa có audio — đó là điều DoD chấp nhận.
select is(
  (
    select count(*)::integer
    from public.flashcard_pages
    where kind = 'vocabulary' and audio_path is null
  ),
  2,
  'thẻ nhập hàng loạt chưa có audio (đường này không nhập audio)'
);

-- =====================================================================
-- 🔴 `BUG_M09_01` — dán lại đúng danh sách cũ
-- =====================================================================
select is(
  (
    select count(*)::integer
    from public.import_flashcard_vocabulary(
      '73600000-0000-4000-8000-000000000001',
      '[{"hanzi":"苹果","pinyin_syllables":"píng guǒ","meaning_vi":"quả táo"},
        {"hanzi":"香蕉","pinyin_syllables":"xiāng jiāo","meaning_vi":"quả chuối"}]'::jsonb
    )
    where row_status = 'duplicate'
  ),
  2,
  'dán lại danh sách cũ: cả 2 dòng báo trùng'
);

select is(
  (select count(*)::integer from public.flashcard_pages where kind = 'vocabulary'),
  2,
  'và KHÔNG sinh thêm thẻ nào — idempotent'
);

select is(
  (
    select array_agg(order_index order by order_index)
    from public.flashcard_pages
    where section_id = '73600000-0000-4000-8000-000000000001' and archived_at is null
  ),
  array[0, 1, 2],
  'dòng trùng không tiêu số thứ tự nên dãy order_index không thủng'
);

-- Lô lẫn lộn: dòng cũ bỏ qua, dòng mới vẫn tạo — không nuốt cả lô.
select is(
  (
    select array_agg(row_status order by row_index)
    from public.import_flashcard_vocabulary(
      '73600000-0000-4000-8000-000000000001',
      '[{"hanzi":"苹果","pinyin_syllables":"píng guǒ","meaning_vi":"quả táo"},
        {"hanzi":"西瓜","pinyin_syllables":"xī guā","meaning_vi":"dưa hấu"}]'::jsonb
    )
  ),
  array['duplicate', 'created'],
  'lô lẫn lộn: dòng trùng bỏ qua, dòng mới vẫn tạo, báo theo TỪNG dòng'
);

-- =====================================================================
-- Chặn thật nằm ở DB, không phải ở app
-- =====================================================================
select throws_ok(
  $$insert into public.flashcard_pages
      (section_id, kind, order_index, hanzi, pinyin_syllables, meaning_vi)
    values ('73600000-0000-4000-8000-000000000001','vocabulary', 99,
            '苹果','píng guǒ','quả táo')$$,
  '23505',
  null,
  'ghi THẲNG vào bảng, bỏ qua RPC, vẫn bị unique index chặn'
);

-- Chữ đa âm vẫn làm được hai thẻ riêng (lý do khóa gồm cả pinyin).
select is(
  (
    select count(*)::integer
    from public.import_flashcard_vocabulary(
      '73600000-0000-4000-8000-000000000001',
      '[{"hanzi":"行","pinyin_syllables":"xíng","meaning_vi":"đi"},
        {"hanzi":"行","pinyin_syllables":"háng","meaning_vi":"hàng, nghề"}]'::jsonb
    )
    where row_status = 'created'
  ),
  2,
  'chữ đa âm 行 (xíng / háng) làm được HAI thẻ trong cùng một buổi'
);

-- =====================================================================
-- 🔴 `D-35` điểm 1 — nhập hàng loạt phải GHI ĐƯỢC câu ví dụ và cụm từ
-- =====================================================================
-- `…072` chỉ chèn 3 cột chữ nên hai danh sách con rơi mất mà không báo gì.
-- Bốn bài dưới đây khoá đúng chỗ đó.
select is(
  (
    select count(*)::integer
    from public.import_flashcard_vocabulary(
      '73600000-0000-4000-8000-000000000001',
      '[{"hanzi":"你好","pinyin_syllables":"nǐ hǎo","meaning_vi":"xin chào",
         "example_sentences":[
           {"hanzi":"你好吗？","pinyin":"nǐ hǎo ma","meaning_vi":"Bạn khỏe không?","image_path":null},
           {"hanzi":"你好，老师","pinyin":"nǐ hǎo lǎo shī","meaning_vi":"Chào thầy","image_path":null}],
         "common_phrases":[
           {"hanzi":"你好啊","pinyin":"nǐ hǎo a","meaning_vi":"Chào cậu"}]}]'::jsonb
    )
    where row_status = 'created'
  ),
  1,
  'nhập được dòng có kèm câu ví dụ và cụm từ'
);

select is(
  (
    select jsonb_array_length(example_sentences)
    from public.flashcard_pages
    where hanzi = '你好'
  ),
  2,
  'hai câu ví dụ ĐƯỢC GHI XUỐNG DB, không rơi mất ở RPC'
);

select is(
  (
    select common_phrases -> 0 ->> 'meaning_vi'
    from public.flashcard_pages
    where hanzi = '你好'
  ),
  'Chào cậu',
  'cụm từ ghi xuống đúng nội dung, không chỉ đúng số lượng'
);

-- Dòng 3 cột cũ vẫn phải chạy y hệt: hai cột jsonb nhận mặc định `[]`.
select is(
  (
    select array[jsonb_array_length(example_sentences), jsonb_array_length(common_phrases)]
    from public.flashcard_pages
    where hanzi = '西瓜'
  ),
  array[0, 0],
  'dòng 3 cột (không có danh sách con) vẫn ra mảng rỗng — tương thích ngược'
);

-- =====================================================================
-- Luật audio nay ở mức CÔNG BỐ
-- =====================================================================
select throws_ok(
  $$select public.publish_flashcard_section('73600000-0000-4000-8000-000000000001')$$,
  'P0001',
  'Còn 6 thẻ từ vựng chưa có audio phát âm',
  'không publish được khi còn thẻ thiếu audio, và báo đúng SỐ thẻ'
);

update public.flashcard_pages
set audio_path = '73000000-0000-4000-8000-000000000001/s1/v/audio-' || id || '.mp3'
where kind = 'vocabulary';

select lives_ok(
  $$select public.publish_flashcard_section('73600000-0000-4000-8000-000000000001')$$,
  'gắn đủ audio thì publish được'
);

-- =====================================================================
-- Phân quyền và trạng thái buổi
-- =====================================================================
select throws_ok(
  $$select public.import_flashcard_vocabulary(
      '73600000-0000-4000-8000-000000000001',
      '[{"hanzi":"新","pinyin_syllables":"xīn","meaning_vi":"mới"}]'::jsonb
    )$$,
  'P0001',
  'Chỉ nhập được vào buổi flashcard đang nháp',
  'không nhập được vào buổi đã công bố'
);

select ok(
  not has_function_privilege(
    'anon', 'public.import_flashcard_vocabulary(uuid, jsonb)', 'EXECUTE'
  ),
  'anonymous không gọi được RPC nhập hàng loạt'
);

reset role;
select * from finish();
rollback;
