begin;

select plan(5);

select has_column('public', 'profiles', 'username', 'profiles có username');
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'username'
      and is_nullable = 'YES'
  ),
  'tài khoản cũ chưa bị khóa vì username nullable'
);

insert into auth.users (id, email)
values
  ('36000000-0000-0000-0000-000000000001', 'direct-one@login.polymind.local'),
  ('36000000-0000-0000-0000-000000000002', 'direct-two@login.polymind.local');

insert into public.profiles (id, role, full_name, username)
values ('36000000-0000-0000-0000-000000000001', 'teacher', 'Giáo viên Một', 'gv.mot');

select lives_ok(
  $$insert into public.profiles (id, role, full_name, username)
    values ('36000000-0000-0000-0000-000000000002', 'student', 'Học viên Hai', 'hv.hai')$$,
  'username hợp lệ được chấp nhận'
);

select throws_ok(
  $$update public.profiles set username = 'GV Mot' where id = '36000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'DB từ chối username sai định dạng'
);

select throws_ok(
  $$update public.profiles set username = 'gv.mot' where id = '36000000-0000-0000-0000-000000000002'$$,
  '23505',
  null,
  'DB cưỡng chế username duy nhất'
);

select * from finish();
rollback;
