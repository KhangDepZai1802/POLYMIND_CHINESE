-- `P17-T1` — Trang flashcard CÔNG KHAI qua mã QR (`D-36`).
--
-- Đây là lần đầu repo cấp cho `anon` một thứ gì đó. Bài kiểm này tồn tại để
-- chứng minh khe mở ra ĐÚNG bằng thiết kế, không rộng hơn một milimet:
--
--   (1) `anon` gọi được ĐÚNG một hàm chỉ-đọc, và KHÔNG chạm được bảng nào;
--   (2) sáu vế fail-closed đều có tác dụng THẬT — mỗi vế một bài chiều phủ định;
--   (3) thu hồi cắt CẢ nội dung LẪN media, ngay lập tức;
--   (4) media của buổi chưa công khai vẫn kín.
--
-- Phần lớn bài dưới đây là chiều PHỦ ĐỊNH. Một trang công khai mà chỉ kiểm
-- "mở được" thì không chứng minh được gì cả.

begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

-- =====================================================================
-- A. Catalog — bề mặt công khai đúng bằng thiết kế
-- =====================================================================
select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'flashcard_public_links'
  ),
  'bảng liên kết công khai bật RLS'
);

select ok(
  not has_table_privilege('anon', 'public.flashcard_public_links', 'SELECT'),
  'anon KHÔNG đọc được bảng liên kết — mã chỉ đi qua RPC'
);

select ok(
  has_table_privilege('authenticated', 'public.flashcard_public_links', 'SELECT'),
  'authenticated đọc được (RLS còn siết tiếp về super_admin)'
);

select ok(
  not has_table_privilege(
    'authenticated', 'public.flashcard_public_links', 'INSERT,UPDATE,DELETE'
  ),
  'authenticated KHÔNG ghi thẳng — mọi thao tác ghi qua RPC security definer'
);

select ok(
  has_function_privilege(
    'anon', 'public.get_public_flashcard_session(text)'::regprocedure, 'EXECUTE'
  ),
  'anon execute được RPC công khai'
);

select ok(
  not has_function_privilege(
    'anon', 'public.create_flashcard_public_link(uuid, text)'::regprocedure, 'EXECUTE'
  ),
  'anon KHÔNG tạo được liên kết'
);

select ok(
  not has_function_privilege(
    'anon', 'public.revoke_flashcard_public_link(uuid)'::regprocedure, 'EXECUTE'
  ),
  'anon KHÔNG thu hồi được liên kết'
);

-- Trang công khai luôn dùng client mù cookie nên vai luôn là `anon`. Gọi được
-- từ phiên đã đăng nhập nghĩa là tầng app dùng sai client.
select ok(
  not has_function_privilege(
    'authenticated', 'public.get_public_flashcard_session(text)'::regprocedure, 'EXECUTE'
  ),
  'authenticated KHÔNG gọi được RPC công khai — hai thế giới tách bạch'
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
    '80000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'admin.qr@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '80000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'hv.qr@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('80000000-0000-4000-8000-000000000001', 'super_admin', 'Admin QR', 'admin.qr@polymind.test'),
  ('80000000-0000-4000-8000-000000000002', 'student', 'Học viên QR', 'hv.qr@polymind.test');

insert into public.students (id, user_id, student_code, full_name)
values ('80100000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002', 'HV-QR-1', 'Học viên QR');

insert into public.courses (id, code, title, program, course_type, default_session_count, status)
values ('80200000-0000-4000-8000-000000000001', 'KH-QR', 'Khóa QR', 'core', 'custom', 3, 'active');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.flashcard_decks (id, course_id, title)
values ('80500000-0000-4000-8000-000000000001', '80200000-0000-4000-8000-000000000001', 'Deck QR');

insert into public.flashcard_sections (id, deck_id, session_number, title)
values
  -- Buổi 1: sẽ publish + có liên kết công khai
  ('80600000-0000-4000-8000-000000000001', '80500000-0000-4000-8000-000000000001', 1, 'Buổi 1'),
  -- Buổi 2: giữ NHÁP — dùng để chứng minh không phát hành được liên kết
  ('80600000-0000-4000-8000-000000000002', '80500000-0000-4000-8000-000000000001', 2, 'Buổi 2 nháp'),
  -- Buổi 3: publish nhưng KHÔNG có liên kết — dùng để chứng minh media vẫn kín
  ('80600000-0000-4000-8000-000000000003', '80500000-0000-4000-8000-000000000001', 3, 'Buổi 3 không chia sẻ');

insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  hanzi, pinyin_syllables, meaning_vi,
  front_image_path, back_image_path, audio_path, front_alt, back_alt, archived_at
)
values
  (
    '80700000-0000-4000-8000-000000000001', '80600000-0000-4000-8000-000000000001',
    'session_cover', 0, null, null, null,
    '80000000-0000-4000-8000-000000000001/d1/s1/p1/front-1.png',
    '80000000-0000-4000-8000-000000000001/d1/s1/p1/back-1.png',
    null, 'bìa trước', 'bìa sau', null
  ),
  (
    '80700000-0000-4000-8000-000000000002', '80600000-0000-4000-8000-000000000001',
    'vocabulary', 1, '書', 'shū', 'sách',
    '80000000-0000-4000-8000-000000000001/d1/s1/p2/front-2.png', null,
    '80000000-0000-4000-8000-000000000001/d1/s1/p2/audio-2.mp3', 'ảnh sách', null, null
  ),
  (
    '80700000-0000-4000-8000-000000000003', '80600000-0000-4000-8000-000000000001',
    'vocabulary', 2, '筆', 'bǐ', 'bút',
    null, null,
    '80000000-0000-4000-8000-000000000001/d1/s1/p3/audio-3.mp3', null, null, null
  ),
  -- Trang ĐÃ XOÁ MỀM: phải không xuất hiện trong payload công khai
  (
    '80700000-0000-4000-8000-000000000004', '80600000-0000-4000-8000-000000000001',
    'vocabulary', 3, '紙', 'zhǐ', 'giấy',
    null, null,
    '80000000-0000-4000-8000-000000000001/d1/s1/p4/audio-4.mp3', null, null, now()
  ),
  -- Buổi 3 (publish, không chia sẻ) — cần đủ bìa + từ vựng mới publish được
  (
    '80700000-0000-4000-8000-000000000005', '80600000-0000-4000-8000-000000000003',
    'session_cover', 0, null, null, null,
    '80000000-0000-4000-8000-000000000001/d1/s3/p5/front-5.png',
    '80000000-0000-4000-8000-000000000001/d1/s3/p5/back-5.png',
    null, 'bìa trước 3', 'bìa sau 3', null
  ),
  (
    '80700000-0000-4000-8000-000000000006', '80600000-0000-4000-8000-000000000003',
    'vocabulary', 1, '墨', 'mò', 'mực',
    null, null,
    '80000000-0000-4000-8000-000000000001/d1/s3/p6/audio-6.mp3', null, null, null
  );

select public.publish_flashcard_section('80600000-0000-4000-8000-000000000001');
select public.publish_flashcard_section('80600000-0000-4000-8000-000000000003');

-- =====================================================================
-- B. Ràng buộc ở tầng DB
--
-- Hai bài này phải chạy ở vai CHỦ BẢNG, không phải `authenticated`: bài 4 vừa
-- khẳng định `authenticated` không có INSERT, nên chạy ở vai đó thì cái đỏ lên
-- là `permission denied` chứ không phải CHECK — tức là bài kiểm xanh/đỏ vì lý
-- do sai. `created_by` truyền tay vì `auth.uid()` rỗng ở vai này.
-- =====================================================================
reset role;

select throws_ok(
  $$insert into public.flashcard_public_links (section_id, token, created_by)
    values ('80600000-0000-4000-8000-000000000001', 'MA-SAI-HINH-DANG',
            '80000000-0000-4000-8000-000000000001')$$,
  '23514',
  null,
  'mã sai hình dạng bị CHECK chặn ngay ở DB, không đợi tầng app'
);

select throws_ok(
  $$insert into public.flashcard_public_links
      (section_id, token, created_by, revoked_at)
    values ('80600000-0000-4000-8000-000000000001', 'abcdefghjkmn',
            '80000000-0000-4000-8000-000000000001', now())$$,
  '23514',
  null,
  'thu hồi mà không ghi ai thu hồi bị chặn — không có thu hồi ẩn danh'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- =====================================================================
-- C. Tạo liên kết
-- =====================================================================
select set_config(
  'test.token', link_token, true
), set_config(
  'test.link_id', link_id::text, true
)
from public.create_flashcard_public_link(
  '80600000-0000-4000-8000-000000000001', 'Sách HSK1 bản in 2026'
);

select matches(
  current_setting('test.token'),
  '^[0-9a-hjkmnp-tv-z]{12}$',
  'mã sinh ra đúng 12 ký tự trong bảng chữ đã bỏ i/l/o/u'
);

select throws_ok(
  $$select public.create_flashcard_public_link('80600000-0000-4000-8000-000000000001')$$,
  'P0001',
  'Buổi này đã có liên kết công khai đang hoạt động',
  'một buổi chỉ có ĐÚNG MỘT liên kết còn hiệu lực'
);

select throws_ok(
  $$select public.create_flashcard_public_link('80600000-0000-4000-8000-000000000002')$$,
  'P0001',
  'Chỉ công khai được buổi flashcard đã công bố',
  'không phát hành được mã QR trỏ vào buổi nháp — mã in ra sẽ chết ngay'
);

-- =====================================================================
-- D. Đọc công khai — vai `anon` thật
-- =====================================================================
set local role anon;

select is(
  jsonb_array_length(
    public.get_public_flashcard_session(current_setting('test.token')) -> 'pages'
  ),
  3,
  'anon đọc được đúng 3 trang — trang đã xoá mềm KHÔNG lọt ra'
);

select is(
  public.get_public_flashcard_session(current_setting('test.token'))
    -> 'section' ->> 'title',
  'Buổi 1',
  'trả đúng buổi ứng với mã'
);

-- Payload công khai không được mang UUID: nó sẽ thành mảnh ghép để đối chiếu
-- chéo với dữ liệu rò từ nguồn khác.
select ok(
  not (
    public.get_public_flashcard_session(current_setting('test.token'))::text
    like '%' || '80700000-0000-4000-8000-000000000002' || '%'
  ),
  'payload KHÔNG chứa UUID của trang'
);

select is(
  public.get_public_flashcard_session('zzzzzzzzzzzz'),
  null,
  'mã bịa (đúng hình dạng) trả rỗng'
);

select is(
  public.get_public_flashcard_session('abcdefghjkm'),
  null,
  'mã 11 ký tự trả rỗng — chặn trước khi chạm dữ liệu'
);

select isnt(
  public.get_public_flashcard_session(upper(current_setting('test.token'))),
  null,
  'mã viết HOA vẫn dùng được (chuẩn hoá về chữ thường)'
);

select throws_ok(
  $$select 1 from public.flashcard_sections limit 1$$,
  '42501',
  null,
  'anon vẫn KHÔNG select được bảng buổi học — chỉ có RPC là đường vào'
);

-- =====================================================================
-- E. Media
-- =====================================================================
select ok(
  share.can_read_public_flashcard_media(
    '80000000-0000-4000-8000-000000000001/d1/s1/p2/audio-2.mp3'
  ),
  'anon đọc được media của buổi ĐANG công khai'
);

select ok(
  not share.can_read_public_flashcard_media(
    '80000000-0000-4000-8000-000000000001/d1/s3/p6/audio-6.mp3'
  ),
  'media của buổi đã publish nhưng CHƯA chia sẻ vẫn kín'
);

select ok(
  not share.can_read_public_flashcard_media('khong-ton-tai/abc.png'),
  'đường dẫn lạ trả false'
);

-- =====================================================================
-- F. Thu hồi — phải cắt CẢ nội dung LẪN media
-- =====================================================================
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select public.revoke_flashcard_public_link(current_setting('test.link_id')::uuid);

set local role anon;

select is(
  public.get_public_flashcard_session(current_setting('test.token')),
  null,
  'sau khi thu hồi, cùng mã đó trả rỗng'
);

-- Bài quan trọng nhất của file: nếu media KHÔNG neo vào trạng thái liên kết thì
-- thu hồi chỉ là tấm rèm — ảnh và audio vẫn tải về được như thường.
select ok(
  not share.can_read_public_flashcard_media(
    '80000000-0000-4000-8000-000000000001/d1/s1/p2/audio-2.mp3'
  ),
  'thu hồi cắt LUÔN media, không chỉ cắt nội dung'
);

-- =====================================================================
-- G. Quản trị
-- =====================================================================
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.revoke_flashcard_public_link(current_setting('test.link_id')::uuid)$$,
  'thu hồi lần hai KHÔNG ném lỗi (idempotent — người dùng bấm hai lần là chuyện thường)'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.create_flashcard_public_link('80600000-0000-4000-8000-000000000001')$$,
  'P0001',
  'Chỉ Super Admin được tạo liên kết công khai',
  'học viên KHÔNG tự phát hành được liên kết công khai'
);

reset role;

select is(
  (
    select count(*)::integer from public.audit_logs
    where action in ('flashcard.public_link.create', 'flashcard.public_link.revoke')
  ),
  2,
  'tạo và thu hồi đều để lại vết audit (thu hồi lần hai không ghi thêm)'
);

select * from finish();
rollback;
