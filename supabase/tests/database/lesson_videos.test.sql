-- Video bài giảng qua liên kết YouTube (`VIDEO-1`, migration `…090`).
--
-- Sáu điều bài này phải chứng minh:
--   (1) FAIL-CLOSED: giáo viên / học viên / anon gọi RPC lưu là bị chặn;
--   (2) học viên KHÁC KHÓA không thấy một hàng nào — đây là vế cách ly quan trọng
--       nhất, vì RLS ở tính năng này là thứ duy nhất giấu danh sách link;
--   (3) bộ `draft` thì học viên KHÔNG thấy, kể cả khi buổi đã published;
--   (4) `on conflict` — chạy RPC hai lần ra ĐÚNG MỘT hàng (bài học `BUG_M09_01`);
--   (5) CHECK định dạng ID YouTube chặn ở tầng DB, không chỉ ở app;
--   (6) `created_by` LUÔN là actor thật, kể cả khi client cố gán người khác
--       (bài học `BUG_M06_01`).

begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- =====================================================================
-- Hình dạng
-- =====================================================================
select has_table('public', 'video_collections', 'Bảng video_collections tồn tại');
select has_table('public', 'video_items', 'Bảng video_items tồn tại');

select has_function(
  'public', 'save_lesson_videos',
  array['uuid', 'jsonb', 'boolean'],
  'RPC save_lesson_videos tồn tại'
);

select ok(
  not has_function_privilege('anon', 'public.save_lesson_videos(uuid,jsonb,boolean)', 'EXECUTE'),
  'anon KHÔNG gọi được RPC lưu video'
);

select ok(
  has_function_privilege('authenticated', 'public.save_lesson_videos(uuid,jsonb,boolean)', 'EXECUTE'),
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
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'admin.video@polymind.test', '',
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'gv.video@polymind.test', '',
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'hv.trong.video@polymind.test', '',
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'hv.ngoai.video@polymind.test', '',
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', '');

insert into public.profiles (id, role, full_name, email)
values
  ('90000000-0000-4000-8000-000000000001', 'super_admin', 'Admin Video', 'admin.video@polymind.test'),
  ('90000000-0000-4000-8000-000000000002', 'teacher', 'Giáo viên Video', 'gv.video@polymind.test'),
  ('90000000-0000-4000-8000-000000000003', 'student', 'HV Trong Khóa', 'hv.trong.video@polymind.test'),
  ('90000000-0000-4000-8000-000000000004', 'student', 'HV Ngoài Khóa', 'hv.ngoai.video@polymind.test');

insert into public.students (id, user_id, student_code, full_name)
values
  ('90100000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000003', 'HV-VID-IN', 'HV Trong Khóa'),
  ('90100000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000004', 'HV-VID-OUT', 'HV Ngoài Khóa');

insert into public.courses (
  id, code, title, program, course_type, default_session_count, status
)
values
  ('90200000-0000-4000-8000-000000000001', 'KH-VIDEO-A', 'Khóa Video A', 'core', 'custom', 35, 'active'),
  ('90200000-0000-4000-8000-000000000002', 'KH-VIDEO-B', 'Khóa Video B', 'core', 'custom', 35, 'active');

insert into public.classes (id, course_id, code, name, capacity, delivery_mode, status)
values
  ('90300000-0000-4000-8000-000000000001', '90200000-0000-4000-8000-000000000001', 'LOP-VID-A', 'Lớp Video A', 20, 'offline', 'planned'),
  ('90300000-0000-4000-8000-000000000002', '90200000-0000-4000-8000-000000000002', 'LOP-VID-B', 'Lớp Video B', 20, 'offline', 'planned');

insert into public.enrollments (id, student_id, class_id, status)
values
  ('90400000-0000-4000-8000-000000000001', '90100000-0000-4000-8000-000000000003', '90300000-0000-4000-8000-000000000001', 'active'),
  ('90400000-0000-4000-8000-000000000002', '90100000-0000-4000-8000-000000000004', '90300000-0000-4000-8000-000000000002', 'active');

-- =====================================================================
-- Admin tạo bộ và lưu lô đầu tiên
-- =====================================================================
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- Cố tình gán `created_by` sang người KHÁC: trigger phải ghi đè bằng actor thật.
insert into public.video_collections (id, course_id, title, created_by)
values (
  '90500000-0000-4000-8000-000000000001',
  '90200000-0000-4000-8000-000000000001',
  'Video bài giảng — Khóa A',
  '90000000-0000-4000-8000-000000000002'
);

select is(
  (select created_by from public.video_collections
    where id = '90500000-0000-4000-8000-000000000001'),
  '90000000-0000-4000-8000-000000000001'::uuid,
  'created_by LUÔN là actor thật, không nhận giá trị client gửi (BUG_M06_01)'
);

select lives_ok(
  $$select public.save_lesson_videos(
      '90500000-0000-4000-8000-000000000001'::uuid,
      '[{"sessionNumber":1,"youtubeVideoId":"dQw4w9WgXcQ","title":"Buổi 1. Chào hỏi"},
        {"sessionNumber":2,"youtubeVideoId":"abc12345678","title":"Buổi 2. Giới thiệu"}]'::jsonb,
      false
    )$$,
  'Admin lưu được lô 2 buổi'
);

select is(
  (select count(*)::int from public.video_items
    where collection_id = '90500000-0000-4000-8000-000000000001'),
  2,
  'Lưu đúng 2 hàng'
);

-- (4) Idempotent: chạy LẠI cùng lô, có ghi đè → vẫn đúng 2 hàng, không đẻ thêm.
select lives_ok(
  $$select public.save_lesson_videos(
      '90500000-0000-4000-8000-000000000001'::uuid,
      '[{"sessionNumber":1,"youtubeVideoId":"dQw4w9WgXcQ","title":"Buổi 1. Chào hỏi"},
        {"sessionNumber":2,"youtubeVideoId":"abc12345678","title":"Buổi 2. Giới thiệu"}]'::jsonb,
      true
    )$$,
  'Chạy lại lô y hệt không lỗi'
);

select is(
  (select count(*)::int from public.video_items
    where collection_id = '90500000-0000-4000-8000-000000000001'),
  2,
  'Chạy 2 lần vẫn ĐÚNG 2 hàng — on conflict chặn nhân bản (BUG_M09_01)'
);

-- Ghi đè TẮT thì buổi đã có bị bỏ qua, giá trị cũ giữ nguyên.
select lives_ok(
  $$select public.save_lesson_videos(
      '90500000-0000-4000-8000-000000000001'::uuid,
      '[{"sessionNumber":1,"youtubeVideoId":"zzzzzzzzzzz","title":"Đè trộm"}]'::jsonb,
      false
    )$$,
  'Ghi đè tắt: lượt lưu vẫn chạy, không ném lỗi'
);

select is(
  (select youtube_video_id from public.video_items
    where collection_id = '90500000-0000-4000-8000-000000000001' and session_number = 1),
  'dQw4w9WgXcQ',
  'Ghi đè TẮT ⇒ link cũ còn nguyên, không bị thay lén'
);

-- (5) CHECK định dạng ID chặn ngay ở DB.
select throws_ok(
  $$select public.save_lesson_videos(
      '90500000-0000-4000-8000-000000000001'::uuid,
      '[{"sessionNumber":3,"youtubeVideoId":"qua-ngan"}]'::jsonb,
      false
    )$$,
  null,
  null,
  'ID YouTube sai định dạng bị chặn ở DB, không chỉ ở app'
);

select throws_ok(
  $$insert into public.video_items (collection_id, session_number, title, youtube_video_id)
    values ('90500000-0000-4000-8000-000000000001', 9, 'Ghi thẳng', 'khong-hop-le!')$$,
  null,
  null,
  'CHECK constraint chặn cả đường ghi thẳng vào bảng'
);

-- =====================================================================
-- (1) FAIL-CLOSED — giáo viên
-- =====================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_lesson_videos(
      '90500000-0000-4000-8000-000000000001'::uuid,
      '[{"sessionNumber":5,"youtubeVideoId":"dQw4w9WgXcQ"}]'::jsonb,
      false
    )$$,
  null,
  null,
  'Giáo viên KHÔNG lưu được video'
);

-- =====================================================================
-- (2)(3) Học viên — bộ đang DRAFT nên chưa ai thấy
-- =====================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_lesson_videos(
      '90500000-0000-4000-8000-000000000001'::uuid,
      '[{"sessionNumber":6,"youtubeVideoId":"dQw4w9WgXcQ"}]'::jsonb,
      false
    )$$,
  null,
  null,
  'Học viên KHÔNG lưu được video'
);

select is(
  (select count(*)::int from public.video_items),
  0,
  'Bộ DRAFT ⇒ học viên trong khóa thấy 0 hàng'
);

select is(
  (select count(*)::int from public.video_collections),
  0,
  'Bộ DRAFT ⇒ học viên không thấy cả bộ'
);

-- =====================================================================
-- Công bố rồi đo lại
-- =====================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

update public.video_collections
set status = 'published'
where id = '90500000-0000-4000-8000-000000000001';

update public.video_items
set status = 'published'
where collection_id = '90500000-0000-4000-8000-000000000001';

select isnt(
  (select published_at from public.video_collections
    where id = '90500000-0000-4000-8000-000000000001'),
  null,
  'published_at tự điền khi công bố'
);

-- Học viên TRONG khóa
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from public.video_items),
  2,
  'Học viên TRONG khóa thấy đủ 2 buổi đã công bố'
);

-- 🔴 Vế cách ly quan trọng nhất của cả bài.
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from public.video_items),
  0,
  'Học viên KHÁC khóa thấy 0 buổi — RLS cách ly đúng'
);

select is(
  (select count(*)::int from public.video_collections),
  0,
  'Học viên KHÁC khóa không thấy cả bộ'
);

-- =====================================================================
-- anon — bị chặn ở tầng GRANT, tức TRƯỚC cả RLS
--
-- ⚠️ Bản đầu của bài này viết `is(count(*), 0)` và ĐỎ. Sai ở bài test, không
-- phải ở code: `revoke all … from anon` khiến câu select **ném lỗi quyền** chứ
-- không trả về 0 hàng. Đó là hàng rào CHẶT HƠN "đọc được nhưng rỗng", nên ghim
-- đúng hành vi thật thay vì nới bài test cho nó xanh.
-- =====================================================================
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  'select count(*) from public.video_items',
  '42501',
  null,
  'anon bị chặn ở tầng GRANT, không chỉ ở RLS'
);

select throws_ok(
  'select count(*) from public.video_collections',
  '42501',
  null,
  'anon không đọc được cả bảng bộ video'
);

select * from finish();
rollback;
