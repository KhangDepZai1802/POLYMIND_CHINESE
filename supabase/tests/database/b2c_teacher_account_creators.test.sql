-- Integration test. The database test harness wraps this file in a rollback.
insert into auth.users(id) values
 ('ac031104-0000-4000-8000-000000000001'),
 ('ac031104-0000-4000-8000-000000000002');
insert into public.profiles(id,role,full_name,is_active) values
 ('ac031104-0000-4000-8000-000000000001','teacher','TEST ACCOUNT CREATOR',true),
 ('ac031104-0000-4000-8000-000000000002','super_admin','TEST ACCOUNT ADMIN',true);
insert into public.teachers(id,user_id) values
 ('ac031104-0000-4000-8000-000000000003','ac031104-0000-4000-8000-000000000001');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values
 ('ac031104-0000-4000-8000-000000000004','TEST ACCOUNT CREATOR','ac031104-0000-4000-8000-000000000003');

select set_config('request.jwt.claims','{"sub":"ac031104-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert not public.can_create_b2c_teacher_accounts(), 'Ordinary teacher must be denied';
end $$;
reset role;

insert into public.b2c_teacher_account_creators(teacher_id)
values('ac031104-0000-4000-8000-000000000004');
set local role authenticated;
do $$ begin
 assert public.can_create_b2c_teacher_accounts(), 'Allowlisted active teacher must be allowed';
end $$;
reset role;

update public.profiles set is_active=false where id='ac031104-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
 assert not public.can_create_b2c_teacher_accounts(), 'Inactive allowlisted teacher must be denied';
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"ac031104-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert public.can_create_b2c_teacher_accounts(), 'Super Admin must retain account creation';
end $$;
reset role;

select 'ok: teacher account creator allowlist, inactive denial and Super Admin';
