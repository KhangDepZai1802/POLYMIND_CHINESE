-- `P17-T1` — Trang flashcard CÔNG KHAI qua mã QR (`D-36`), sửa bởi `QRLINK-1`
-- (`D-39`: mã CỐ ĐỊNH + trạng thái `coming_soon`).
--
-- Đây là lần đầu repo cấp cho `anon` một thứ gì đó. Bài kiểm này tồn tại để
-- chứng minh khe mở ra ĐÚNG bằng thiết kế, không rộng hơn một milimet:
--
--   (1) `anon` gọi được ĐÚNG một hàm chỉ-đọc, và KHÔNG chạm được bảng nào;
--   (2) mọi vế fail-closed đều có tác dụng THẬT — mỗi vế một bài chiều phủ định;
--   (3) thu hồi cắt CẢ nội dung LẪN media, ngay lập tức;
--   (4) media của buổi chưa công khai vẫn kín;
--   (5) `D-39` — buổi CHƯA CÔNG BỐ có mã và trả `coming_soon`, nhưng KHÔNG rò
--       một chữ nội dung nào, và media của nó vẫn kín như cũ.
--
-- Phần lớn bài dưới đây là chiều PHỦ ĐỊNH. Một trang công khai mà chỉ kiểm
-- "mở được" thì không chứng minh được gì cả.

begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

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
  -- Buổi 2 (NHÁP, sẽ có liên kết từ `D-39`): media của nó phải vẫn kín, kể cả
  -- khi liên kết đã phát hành. Đây là bài quan trọng nhất của `D-39`.
  (
    '80700000-0000-4000-8000-000000000007', '80600000-0000-4000-8000-000000000002',
    'vocabulary', 1, '茶', 'chá', 'trà',
    null, null,
    '80000000-0000-4000-8000-000000000001/d1/s2/p7/audio-7.mp3', null, null, null
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
-- C. Tạo liên kết — mã CỐ ĐỊNH (`D-39`)
-- =====================================================================
select set_config(
  'test.token', link_token, true
), set_config(
  'test.link_id', link_id::text, true
)
from public.create_flashcard_public_link(
  '80600000-0000-4000-8000-000000000001', 'Sách HSK1 bản in 2026'
);

-- Ghim CHUỖI CỤ THỂ, không ghim hình dạng: toàn bộ giá trị của `D-39` nằm ở chỗ
-- bên in suy ra được địa chỉ trước khi ai bấm nút. Một bài kiểu `matches(...)`
-- vẫn xanh kể cả khi mã quay về ngẫu nhiên.
select is(
  current_setting('test.token'),
  'kh-qr-01',
  'mã sinh ra đúng công thức <slug mã khoá>-<số buổi>, đoán trước được'
);

-- Cùng cặp vào/ra với `tests/unit/domain/flashcard-public-link.test.ts`. Hai bản
-- cài đặt lệch nhau nghĩa là màn Admin hứa một địa chỉ mà DB phát hành địa chỉ
-- khác — sai lệch chỉ lộ ra sau khi sách đã in.
reset role;
select is(
  app.flashcard_fixed_link_token('80600000-0000-4000-8000-000000000003'),
  'kh-qr-03',
  'công thức trong DB khớp bản TypeScript của màn Admin'
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- Idempotent (`BUG_M09_01`). Trước `D-39` đây là một exception; với mã cố định
-- thì "tạo lại" luôn ra đúng chuỗi cũ, nên ném lỗi chỉ làm nút "tạo cho cả bộ"
-- gãy giữa chừng ở buổi đầu tiên đã có mã.
select is(
  (
    select link_token
    from public.create_flashcard_public_link('80600000-0000-4000-8000-000000000001')
  ),
  'kh-qr-01',
  'gọi lại trả đúng mã cũ, không ném lỗi và không sinh mã thứ hai'
);

select is(
  (
    select link_token
    from public.create_flashcard_public_link('80600000-0000-4000-8000-000000000002')
  ),
  'kh-qr-02',
  'buổi NHÁP nay cũng phát hành được mã — in sách trước, công bố sau (`D-39`)'
);

-- =====================================================================
-- D. Đọc công khai — vai `anon` thật
-- =====================================================================
set local role anon;

select is(
  public.get_public_flashcard_session(current_setting('test.token')) ->> 'state',
  'ready',
  'buổi đã công bố trả trạng thái `ready`'
);

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

-- =====================================================================
-- D-bis. Buổi CHƯA CÔNG BỐ — `coming_soon` (`D-39`)
--
-- Hai bài này đi cùng nhau và không tách được: bài đầu chứng minh người quét
-- sớm không bị đuổi ra bằng 404; bài sau chứng minh cái giá phải trả bằng đúng
-- MỘT bit ("mã này có tồn tại") chứ không phải bằng nội dung chưa duyệt.
-- =====================================================================
select is(
  public.get_public_flashcard_session('kh-qr-02') ->> 'state',
  'coming_soon',
  'buổi nháp có mã: trả `coming_soon`, không phải rỗng'
);

select ok(
  public.get_public_flashcard_session('kh-qr-02') -> 'pages' is null
    and public.get_public_flashcard_session('kh-qr-02')::text not like '%Buổi 2 nháp%'
    and public.get_public_flashcard_session('kh-qr-02')::text not like '%茶%',
  'payload `coming_soon` KHÔNG mang trang, tiêu đề hay Hán tự nào'
);

select is(
  public.get_public_flashcard_session('zzz-zzzz-99'),
  null,
  'mã bịa (đúng hình dạng) trả rỗng'
);

select is(
  public.get_public_flashcard_session('kh_qr_01'),
  null,
  'mã sai hình dạng (gạch dưới) trả rỗng — chặn trước khi chạm dữ liệu'
);

select is(
  public.get_public_flashcard_session('kh-qr-01-'),
  null,
  'gạch nối ở cuối là sai hình dạng — không "gần đúng thì cho qua"'
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

-- 🔴 BÀI QUAN TRỌNG NHẤT CỦA `D-39`.
--
-- Buổi 2 vừa được phát hành liên kết ở phần C, và trang công khai của nó trả
-- `coming_soon`. Nếu ai đó "nới cho đồng bộ" vế `status = 'published'` trong
-- `share.can_read_public_flashcard_media`, thì ảnh và audio của buổi CHƯA DUYỆT
-- tải về được bằng đường dẫn trực tiếp trong khi trang web vẫn nói "sắp mở" —
-- rò nội dung im lặng, không ai nhìn thấy trên giao diện.
select ok(
  not share.can_read_public_flashcard_media(
    '80000000-0000-4000-8000-000000000001/d1/s2/p7/audio-7.mp3'
  ),
  'buổi NHÁP tuy đã có liên kết nhưng media vẫn KÍN'
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
-- G. Hồi sinh — hệ quả trực tiếp của mã cố định (`D-39`)
--
-- Với mã ngẫu nhiên, "tạo lại" đẻ ra mã khác nên mã đã in coi như chết hẳn. Với
-- mã cố định thì công thức chỉ cho ra đúng một chuỗi, nên tạo lại BẮT BUỘC phải
-- bật lại chính hàng cũ — nếu không thì unique index trên `token` sẽ chặn và
-- admin không bao giờ sửa được cú bấm nhầm.
-- =====================================================================
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select link_token
    from public.create_flashcard_public_link('80600000-0000-4000-8000-000000000001')
  ),
  'kh-qr-01',
  'tạo lại sau khi thu hồi trả ĐÚNG mã cũ — sách đã in không thành giấy lộn'
);

set local role anon;

select isnt(
  public.get_public_flashcard_session('kh-qr-01'),
  null,
  'mã cũ sống lại: nội dung đọc được ngay sau khi bật lại'
);

select ok(
  share.can_read_public_flashcard_media(
    '80000000-0000-4000-8000-000000000001/d1/s1/p2/audio-2.mp3'
  ),
  'bật lại thì media cũng mở lại — cùng một công tắc, không phải hai'
);

-- =====================================================================
-- H. Mã NGẪU NHIÊN đời `…080` — không được chết, cũng không được thay lén
-- =====================================================================
reset role;

select lives_ok(
  $$insert into public.flashcard_public_links (section_id, token, created_by)
    values ('80600000-0000-4000-8000-000000000003', 'qrlegacy0080',
            '80000000-0000-4000-8000-000000000001')$$,
  'mã ngẫu nhiên 12 ký tự vẫn qua được CHECK mới — migration không giết mã đã in'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.create_flashcard_public_links_for_deck('80500000-0000-4000-8000-000000000001')$$,
  'P0001',
  null,
  'buổi đang mang mã cũ: KHÔNG bị thay lặng lẽ, phải xin phép trước'
);

select is(
  (
    select l.link_token
    from public.create_flashcard_public_links_for_deck(
      '80500000-0000-4000-8000-000000000001', true
    ) l
    where l.session_no = 3
  ),
  'kh-qr-03',
  'được phép thì mới thay mã cũ bằng mã cố định'
);

set local role anon;

select is(
  public.get_public_flashcard_session('qrlegacy0080'),
  null,
  'mã cũ bị thay chết ngay lập tức — không có hai mã cùng sống cho một buổi'
);

-- =====================================================================
-- I. Phát hành hàng loạt cho cả bộ thẻ
-- =====================================================================
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.create_flashcard_public_links_for_deck(
      '80500000-0000-4000-8000-000000000001'
    )
  ),
  3,
  'trả đủ mọi buổi chưa xoá của bộ thẻ — bên in nhận trọn danh sách'
);

-- Chạy lại phải là thao tác RỖNG. Đây chính là vế `BUG_M09_01`: nút bấm hai lần
-- không được đẻ ra mã thứ hai cho cùng một buổi.
select is(
  (
    select count(*)::integer
    from public.create_flashcard_public_links_for_deck(
      '80500000-0000-4000-8000-000000000001'
    ) l
    where l.row_status <> 'existing'
  ),
  0,
  'chạy lại lượt nữa KHÔNG sinh thêm mã nào'
);

-- =====================================================================
-- J. Quản trị
-- =====================================================================
select public.revoke_flashcard_public_link(current_setting('test.link_id')::uuid);

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

select throws_ok(
  $$select * from public.create_flashcard_public_links_for_deck('80500000-0000-4000-8000-000000000001')$$,
  'P0001',
  'Chỉ Super Admin được tạo liên kết công khai',
  'học viên KHÔNG phát hành hàng loạt được — cửa thứ hai cũng khoá'
);

reset role;

-- Đếm tay cho khớp, theo đúng thứ tự các thao tác GHI ở trên:
--   1 tạo buổi 1 · 2 tạo buổi 2 (nháp) · 3 thu hồi buổi 1 · 4 bật lại buổi 1 ·
--   5 thu hồi mã cũ buổi 3 · 6 tạo mã cố định buổi 3 · 7 thu hồi buổi 1 lần cuối.
-- Các lượt gọi idempotent (tạo lại khi đang sống, chạy batch lần hai, thu hồi
-- lần hai) KHÔNG được ghi thêm dòng nào — đó mới là điều bài này canh.
select is(
  (
    select count(*)::integer from public.audit_logs
    where action in ('flashcard.public_link.create', 'flashcard.public_link.revoke')
  ),
  7,
  'mọi thao tác GHI đều có vết audit, và chỉ thao tác GHI mới có'
);

select * from finish();
rollback;
