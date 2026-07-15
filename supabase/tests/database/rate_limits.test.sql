begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'a9000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'rate-limit@polymind.test', '',
  now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', '', '', '', '', ''
);
insert into public.profiles (id, role, full_name, email)
values ('a9000000-0000-4000-8000-000000000001', 'student', 'Kiểm thử rate limit', 'rate-limit@polymind.test');

select ok(
  not has_function_privilege('anon', 'public.consume_rate_limit(text)', 'EXECUTE'),
  'anonymous không gọi được rate-limit RPC'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(
  (select bool_and(public.consume_rate_limit('material_upload')) from generate_series(1, 20)),
  '20 upload đầu tiên trong giờ được phép'
);
select is(public.consume_rate_limit('material_upload'), false, 'upload thứ 21 trong giờ bị chặn');
select is(public.consume_rate_limit('submission_upload'), true, 'scope khác có counter độc lập');
select is(public.consume_rate_limit('scope_tu_che'), false, 'scope không có trong allowlist bị fail-closed');
reset role;
select * from finish();
rollback;
