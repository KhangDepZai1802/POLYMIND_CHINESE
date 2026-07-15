begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'notification-a@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'notification-b@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', '');

insert into public.profiles (id, role, full_name, email)
values
  ('d0000000-0000-0000-0000-000000000001', 'student', 'Học viên thông báo A', 'notification-a@polymind.test'),
  ('d0000000-0000-0000-0000-000000000002', 'student', 'Học viên thông báo B', 'notification-b@polymind.test');

insert into public.notifications (id, user_id, type, title, link)
values
  ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'assignment_new', 'Thông báo của A', '/student/assignments'),
  ('d1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'assignment_new', 'Thông báo của B', '/student/assignments');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::integer from public.notifications),
  1,
  'A chỉ đọc notification của chính mình'
);

select is(
  (select title from public.notifications),
  'Thông báo của A',
  'Notification A đọc được đúng nội dung của A'
);

select lives_ok(
  $$update public.notifications set read_at = now()
    where id = 'd1000000-0000-0000-0000-000000000001'$$,
  'A đánh dấu notification của mình đã đọc'
);

select ok(
  (select read_at is not null from public.notifications
   where id = 'd1000000-0000-0000-0000-000000000001'),
  'read_at được cập nhật'
);

select throws_ok(
  $$update public.notifications set title = 'Nội dung giả'
    where id = 'd1000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'Người nhận không sửa được nội dung notification'
);

select throws_ok(
  $$insert into public.notifications (user_id, type, title)
    values ('d0000000-0000-0000-0000-000000000001', 'announcement', 'Tự tạo')$$,
  '42501',
  null,
  'Người dùng không tự tạo notification'
);

insert into public.notification_preferences
  (user_id, type, in_app_enabled, email_enabled)
values
  ('d0000000-0000-0000-0000-000000000002', 'assignment_due', false, true);

select is(
  (select user_id from public.notification_preferences where type = 'assignment_due'),
  'd0000000-0000-0000-0000-000000000001'::uuid,
  'Preference luôn thuộc actor thật, không tin user_id client gửi'
);

select is(
  (select email_enabled from public.notification_preferences where type = 'assignment_due'),
  false,
  'User không bật được kênh email chưa triển khai'
);

select throws_ok(
  $$update public.notification_preferences set type = 'invoice_due'
    where type = 'assignment_due'$$,
  'P0001',
  'Không được đổi chủ sở hữu hoặc loại tùy chọn thông báo',
  'Loại preference là bất biến'
);

select ok(
  has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE'),
  'authenticated có quyền cột UPDATE read_at'
);

select ok(
  not has_column_privilege('authenticated', 'public.notifications', 'title', 'UPDATE'),
  'authenticated không có quyền cột UPDATE title'
);

reset role;
reset request.jwt.claims;

insert into public.notifications (id, user_id, type, title)
values (
  'd1000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000001',
  'assignment_due',
  'Thông báo đã tắt'
);

select is(
  (select count(*)::integer from public.notifications
   where user_id = 'd0000000-0000-0000-0000-000000000001'),
  1,
  'Preference tắt loại assignment_due ngăn notification mới ở DB'
);

insert into public.notifications (id, user_id, type, title)
values (
  'd1000000-0000-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000001',
  'invoice_new',
  'Loại mặc định vẫn bật'
);

select is(
  (select count(*)::integer from public.notifications
   where user_id = 'd0000000-0000-0000-0000-000000000001'),
  2,
  'Loại chưa có preference mặc định vẫn sinh notification'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::integer from public.notifications),
  1,
  'B không đọc được notification của A'
);

update public.notifications
set read_at = now()
where id = 'd1000000-0000-0000-0000-000000000004';

reset role;
reset request.jwt.claims;

select is(
  (select read_at from public.notifications
   where id = 'd1000000-0000-0000-0000-000000000004'),
  null::timestamptz,
  'B không đánh dấu hộ notification của A'
);

select is(
  (select count(*)::integer from public.notification_preferences
   where user_id = 'd0000000-0000-0000-0000-000000000002'),
  0,
  'A không tạo preference dưới danh nghĩa B'
);

select * from finish();
rollback;

