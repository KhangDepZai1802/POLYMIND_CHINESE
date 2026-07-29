-- `MULTIDECK-1` — một khoá học có NHIỀU bộ flashcard (user chốt 2026-07-29).
--
-- Bài kiểm này tồn tại vì migration `…083` đụng vào thứ có hậu quả VẬT LÝ: công
-- thức sinh mã QR in trong sách giấy. Ba câu hỏi phải trả lời được bằng số,
-- không bằng lý lẽ:
--
--   (1) Mã đã in có còn sống không? — ghim CHUỖI CỤ THỂ (`md-bank-35`) chứ
--       không ghim hình dạng: ghim hình dạng thì đổi công thức sai vẫn xanh.
--       Kèm một bài PHÁT BIỂU THẲNG cái tính chất giữ mạng cho 35 mã đã in:
--       *bộ có mã bộ = slug(mã khoá) ⇒ mã ra y hệt công thức cũ của `…081`*.
--   (2) Hai bộ trong CÙNG một khoá có ra hai dải địa chỉ khác nhau không, và
--       phát hành liên kết cho cả hai có chạy không? Đây chính là chỗ mà bản
--       `…081` ném lỗi *"Mã cố định … đã thuộc một buổi khác"*.
--   (3) Các cửa fail-closed mới có tác dụng THẬT không? Mỗi vế một bài chiều
--       PHỦ ĐỊNH: mã bộ trùng, mã bộ sai hình dạng, đổi mã khi còn liên kết.

begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- =====================================================================
-- A. Catalog — ràng buộc cũ đã gỡ, ràng buộc mới đã có
-- =====================================================================
select is(
  (
    select count(*)::integer
    from pg_constraint
    where conrelid = 'public.flashcard_decks'::regclass
      and contype = 'u'
      and conkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = 'public.flashcard_decks'::regclass
            and attname = 'course_id'
        )
      ]
  ),
  0,
  'ràng buộc unique(course_id) đã gỡ — một khoá được có nhiều bộ'
);

select has_column('public', 'flashcard_decks', 'code', 'bộ thẻ có cột mã bộ');
select col_not_null('public', 'flashcard_decks', 'code', 'mã bộ không được rỗng');

select has_index(
  'public', 'flashcard_decks', 'ux_flashcard_decks_code',
  'mã bộ duy nhất TOÀN BẢNG (không phải theo khoá)'
);

-- Khoá ngoại và `on delete restrict` phải còn nguyên: `…083` chỉ bỏ tính duy
-- nhất, không được nới đường xoá dữ liệu lịch sử.
select is(
  (
    select confdeltype
    from pg_constraint
    where conrelid = 'public.flashcard_decks'::regclass
      and contype = 'f'
      and conname = 'flashcard_decks_course_id_fkey'
  ),
  'r'::"char",
  'khoá ngoại tới khoá học vẫn là ON DELETE RESTRICT'
);

-- =====================================================================
-- Fixture — MỘT khoá, HAI bộ
-- =====================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '83000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'admin.multideck@polymind.test', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
);

insert into public.profiles (id, role, full_name, email)
values (
  '83000000-0000-4000-8000-000000000001', 'super_admin',
  'Admin nhiều bộ', 'admin.multideck@polymind.test'
);

-- Mã khoá riêng của bài kiểm. KHÔNG dùng `VCB-BANK`: mã đó đã nằm trong
-- `seed.sql` nền, và `courses.code` là unique — trùng thì cả file chết ở fixture
-- chứ không phải ở bài kiểm nào.
insert into public.courses (id, code, title, program, course_type, default_session_count, status)
values (
  '83200000-0000-4000-8000-000000000001', 'MD-BANK', 'Khoá nhiều bộ',
  'business', null, 35, 'active'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- Bộ 1 mang mã bộ = slug mã khoá — đúng thứ mà backfill của `…083` gán cho bộ
-- đang chạy trên cloud.
insert into public.flashcard_decks (id, course_id, code, title)
values (
  '83500000-0000-4000-8000-000000000001',
  '83200000-0000-4000-8000-000000000001',
  'md-bank',
  'Từ vựng'
);

-- =====================================================================
-- B. Bộ thứ HAI trong cùng khoá — thứ mà DB cũ chặn cứng
-- =====================================================================
select lives_ok(
  $$insert into public.flashcard_decks (id, course_id, code, title)
    values (
      '83500000-0000-4000-8000-000000000002',
      '83200000-0000-4000-8000-000000000001',
      'md-ngu-phap',
      'Ngữ pháp'
    )$$,
  'tạo được bộ thứ hai trong CÙNG một khoá học'
);

select is(
  (
    select count(*)::integer
    from public.flashcard_decks
    where course_id = '83200000-0000-4000-8000-000000000001'
  ),
  2,
  'khoá học đang giữ đúng 2 bộ thẻ'
);

-- Mã bộ trùng: chặn ở DB, không phải ở app.
select throws_ok(
  $$insert into public.flashcard_decks (course_id, code, title)
    values ('83200000-0000-4000-8000-000000000001', 'md-bank', 'Trùng mã')$$,
  '23505',
  null,
  'mã bộ TRÙNG bị từ chối — hai dải địa chỉ không chồng lên nhau'
);

-- Hình dạng: mọi thứ không phải slug đều bị chặn. Ba dạng hỏng hay gặp nhất khi
-- người dùng gõ tay: chữ HOA, khoảng trắng, gạch ở đầu/cuối.
select throws_ok(
  $$insert into public.flashcard_decks (course_id, code, title)
    values ('83200000-0000-4000-8000-000000000001', 'MD-Hoa', 'Chữ hoa')$$,
  '23514',
  null,
  'mã bộ có chữ HOA bị từ chối'
);

select throws_ok(
  $$insert into public.flashcard_decks (course_id, code, title)
    values ('83200000-0000-4000-8000-000000000001', 'md bank 2', 'Có khoảng trắng')$$,
  '23514',
  null,
  'mã bộ có khoảng trắng bị từ chối'
);

select throws_ok(
  $$insert into public.flashcard_decks (course_id, code, title)
    values ('83200000-0000-4000-8000-000000000001', '-md-', 'Gạch hai đầu')$$,
  '23514',
  null,
  'mã bộ có gạch ở hai đầu bị từ chối'
);

-- Trần 40 ký tự: mã liên kết = mã bộ + `-NN` phải lọt trần 48 của
-- `flashcard_public_links_token_shape_check` (`…081`).
select throws_ok(
  format(
    $$insert into public.flashcard_decks (course_id, code, title)
      values ('83200000-0000-4000-8000-000000000001', %L, 'Quá dài')$$,
    repeat('a', 41)
  ),
  '23514',
  null,
  'mã bộ dài quá 40 ký tự bị từ chối — mã liên kết phải lọt trần 48'
);

-- =====================================================================
-- C. Công thức mã — bằng chứng mã đã in vẫn sống
-- =====================================================================
insert into public.flashcard_sections (id, deck_id, session_number, title)
values
  ('83600000-0000-4000-8000-000000000001', '83500000-0000-4000-8000-000000000001', 1, 'TV buổi 1'),
  ('83600000-0000-4000-8000-000000000035', '83500000-0000-4000-8000-000000000001', 35, 'TV buổi 35'),
  ('83600000-0000-4000-8000-000000000101', '83500000-0000-4000-8000-000000000002', 1, 'NP buổi 1');

-- `app.flashcard_fixed_link_token` bị revoke khỏi `authenticated` (đúng thiết
-- kế: mã chỉ sinh ra qua RPC `security definer`). Gọi thẳng để soi công thức thì
-- phải bỏ vai xuống, giống hệt `flashcard_public_links.test.sql`.
reset role;

-- 🔴 BÀI QUAN TRỌNG NHẤT CỦA CẢ FILE. Ghim CHUỖI, không ghim hình dạng: 35 mã
-- này đã phát hành trên cloud 2026-07-27 và đang trên đường vào sách in.
select is(
  app.flashcard_fixed_link_token('83600000-0000-4000-8000-000000000001'),
  'md-bank-01',
  'mã của buổi 1 vẫn ĐÚNG chuỗi đã phát hành trước MULTIDECK-1'
);

select is(
  app.flashcard_fixed_link_token('83600000-0000-4000-8000-000000000035'),
  'md-bank-35',
  'mã của buổi 35 vẫn ĐÚNG chuỗi đã phát hành (lpad 2 chữ số giữ nguyên)'
);

-- 🔴 TÍNH CHẤT GIỮ MẠNG CHO 35 MÃ ĐÃ IN, phát biểu thẳng thay vì ngụ ý.
--
-- Vế phải là **công thức CŨ của `…081`** viết lại nguyên văn (slug của MÃ KHOÁ).
-- Bài này xanh nghĩa là: với bộ mà backfill gán `code = slug(mã khoá)` — tức mọi
-- bộ có trước 2026-07-29, gồm cả bộ `VCB-BANK` trên cloud — hàm mới cho ra ĐÚNG
-- chuỗi mà hàm cũ đã cho. Đây là điều mà hai bài ghim chuỗi ở trên chỉ chứng
-- minh cho riêng `md-bank`.
select is(
  (
    select string_agg(
      app.flashcard_fixed_link_token(s.id), ',' order by s.session_number
    )
    from public.flashcard_sections s
    where s.deck_id = '83500000-0000-4000-8000-000000000001'
  ),
  (
    select string_agg(
      btrim(regexp_replace(lower(c.code), '[^a-z0-9]+', '-', 'g'), '-')
        || '-' || lpad(s.session_number::text, 2, '0'),
      ',' order by s.session_number
    )
    from public.flashcard_sections s
    join public.flashcard_decks d on d.id = s.deck_id
    join public.courses c on c.id = d.course_id
    where s.deck_id = '83500000-0000-4000-8000-000000000001'
  ),
  'bộ có mã bộ = slug(mã khoá) cho ra Y HỆT công thức cũ của `…081`'
);

-- Cùng khoá, cùng số buổi, KHÁC bộ → khác mã. Đây là toàn bộ lý do `…083` phải
-- đổi công thức: bản `…081` cho ra `vcb-bank-01` cho cả hai và RPC ném lỗi.
select is(
  app.flashcard_fixed_link_token('83600000-0000-4000-8000-000000000101'),
  'md-ngu-phap-01',
  'buổi 1 của bộ thứ hai ra mã KHÁC dù cùng khoá và cùng số buổi'
);

select isnt(
  app.flashcard_fixed_link_token('83600000-0000-4000-8000-000000000001'),
  app.flashcard_fixed_link_token('83600000-0000-4000-8000-000000000101'),
  'hai bộ cùng khoá không bao giờ giành nhau một mã'
);

-- Phát hành thật cho cả hai bộ: bài trên chứng minh công thức, bài này chứng
-- minh đường GHI chạy được đến cùng. Cần lại vai `authenticated` vì RPC kiểm
-- `app.is_super_admin()` từ claims của phiên.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.create_flashcard_public_link('83600000-0000-4000-8000-000000000001')$$,
  'phát hành được liên kết cho buổi 1 của bộ 1'
);

select lives_ok(
  $$select public.create_flashcard_public_link('83600000-0000-4000-8000-000000000101')$$,
  'phát hành được liên kết cho buổi 1 của bộ 2 — KHÔNG còn va mã'
);

select is(
  (
    select string_agg(l.token, ' | ' order by l.token)
    from public.flashcard_public_links l
    join public.flashcard_sections s on s.id = l.section_id
    where s.deck_id in (
      '83500000-0000-4000-8000-000000000001',
      '83500000-0000-4000-8000-000000000002'
    )
      and l.revoked_at is null
  ),
  'md-bank-01 | md-ngu-phap-01',
  'hai bộ cùng khoá đang giữ hai địa chỉ tách bạch'
);

-- =====================================================================
-- D. Đổi mã bộ khi còn liên kết sống — CẤM (`MULTIDECK-1c`)
-- =====================================================================
select throws_ok(
  $$update public.flashcard_decks
    set code = 'md-bank-doi'
    where id = '83500000-0000-4000-8000-000000000001'$$,
  'P0001',
  null,
  'đổi mã bộ khi còn liên kết SỐNG bị từ chối ở DB'
);

-- Bộ chưa phát hành liên kết nào thì đổi mã tự do — cửa này phải còn mở, nếu
-- không thì đặt nhầm mã lúc tạo là hỏng vĩnh viễn.
insert into public.flashcard_decks (id, course_id, code, title)
values (
  '83500000-0000-4000-8000-000000000003',
  '83200000-0000-4000-8000-000000000001',
  'md-chua-phat-hanh',
  'Bộ chưa phát hành'
);

select lives_ok(
  $$update public.flashcard_decks
    set code = 'md-doi-thoai'
    where id = '83500000-0000-4000-8000-000000000003'$$,
  'bộ CHƯA có liên kết nào thì đổi mã được'
);

-- Thu hồi hết liên kết → mở lại đường đổi mã. Đây là đường thoát hợp lệ duy
-- nhất, và nó phải thật sự dùng được.
select public.revoke_flashcard_public_link(
  (
    select l.id
    from public.flashcard_public_links l
    where l.section_id = '83600000-0000-4000-8000-000000000001'
      and l.revoked_at is null
  )
);

select lives_ok(
  $$update public.flashcard_decks
    set code = 'md-bank-v2'
    where id = '83500000-0000-4000-8000-000000000001'$$,
  'thu hồi hết liên kết rồi thì đổi mã được — cửa thoát hợp lệ vẫn mở'
);

-- Sửa các cột KHÁC không bao giờ bị trigger chặn, kể cả khi còn liên kết sống.
-- Trigger `before update of code` phải hẹp đúng bằng tên nó.
select lives_ok(
  $$update public.flashcard_decks
    set title = 'Ngữ pháp (đã đổi tên)'
    where id = '83500000-0000-4000-8000-000000000002'$$,
  'đổi TÊN bộ vẫn được dù bộ đang có liên kết sống'
);

select * from finish();
rollback;
