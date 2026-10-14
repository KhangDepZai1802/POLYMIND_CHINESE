begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(11);
insert into auth.users(id,aud,role,email,created_at,updated_at)
values('48000000-0000-4000-8000-000000000010','authenticated','authenticated','b2c-manager-test@example.test',now(),now()),
('48000000-0000-4000-8000-000000000011','authenticated','authenticated','b2c-teacher-test@example.test',now(),now());
insert into public.profiles(id,role,full_name,is_active)
values('48000000-0000-4000-8000-000000000010','academic_manager','TEST MANAGER',true),
('48000000-0000-4000-8000-000000000011','teacher','TEST TEACHER',true);
select ok((select relrowsecurity from pg_class where oid='public.b2c_teachers'::regclass),'RLS enabled');
select set_config('request.jwt.claims','{"sub":"48000000-0000-4000-8000-000000000010","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$insert into public.b2c_teachers(id,full_name,phone,email,specialization,employment_type,hourly_rate) values('48000000-0000-4000-8000-000000000001','TEST B2C Teacher','0901234567','test@example.com','English','part_time',150000)$$,'Academic manager can create without account');
select is((select hourly_rate from public.b2c_teachers where id='48000000-0000-4000-8000-000000000001'),150000::numeric,'Rate persisted');
select lives_ok($$update public.b2c_teachers set phone='0907654321',employment_type='full_time',hourly_rate=200000 where id='48000000-0000-4000-8000-000000000001'$$,'Manager can edit contact and work terms');
select throws_ok($$update public.b2c_teachers set employment_type='invalid' where id='48000000-0000-4000-8000-000000000001'$$,'23514',null,'Invalid employment rejected');
select throws_ok($$update public.b2c_teachers set hourly_rate=-1 where id='48000000-0000-4000-8000-000000000001'$$,'23514',null,'Negative rate rejected');
select throws_ok($$update public.b2c_teachers set hourly_rate=1.5 where id='48000000-0000-4000-8000-000000000001'$$,'23514',null,'Fractional rate rejected');
select throws_ok($$update public.b2c_teachers set created_by=auth.uid() where id='48000000-0000-4000-8000-000000000001'$$,'42501',null,'Cannot change actor');
select throws_ok($$delete from public.b2c_teachers where id='48000000-0000-4000-8000-000000000001'$$,'42501',null,'No hard delete');
select set_config('request.jwt.claims','{"sub":"48000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
select is((select count(*)::integer from public.b2c_teachers),0,'Teacher cannot read B2C profiles');
select throws_ok($$insert into public.b2c_teachers(full_name,employment_type,hourly_rate) values('DENIED','full_time',100)$$,'42501',null,'Teacher cannot create B2C profile');
reset role;
select * from finish();
rollback;
