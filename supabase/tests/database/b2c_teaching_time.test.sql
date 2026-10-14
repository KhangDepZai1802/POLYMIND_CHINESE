begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(20);
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('50000000-0000-4000-8000-000000000001','authenticated','authenticated','teaching-manager@example.test',now(),now()),
('50000000-0000-4000-8000-000000000002','authenticated','authenticated','teaching-owner@example.test',now(),now()),
('50000000-0000-4000-8000-000000000003','authenticated','authenticated','teaching-peer@example.test',now(),now());
insert into public.profiles(id,role,full_name,is_active) values
('50000000-0000-4000-8000-000000000001','academic_manager','TEST MANAGER',true),
('50000000-0000-4000-8000-000000000002','teacher','TEST TEACHER',true),
('50000000-0000-4000-8000-000000000003','teacher','TEST PEER',true);
insert into public.teachers(id,user_id,teacher_code) values('50000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000002','GV-TEST-TIME');
insert into public.b2c_teachers(id,source_teacher_id,full_name,hourly_rate) values('50000000-0000-4000-8000-000000000005','50000000-0000-4000-8000-000000000004','TEST TEACHER',120000);
insert into public.b2c_classes(id,program_slug,name) values('50000000-0000-4000-8000-000000000006','tieng-anh','TEST TEACHING');
select ok((select relrowsecurity from pg_class where oid='public.b2c_teaching_sessions'::regclass),'Session RLS enabled');
select ok(not has_function_privilege('anon','public.check_b2c_teaching_session(uuid,text,text)','EXECUTE'),'Anonymous cannot check in');
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.create_b2c_teaching_session('50000000-0000-4000-8000-000000000006','50000000-0000-4000-8000-000000000005',now()-interval '30 minutes',now()+interval '30 minutes')$$,'Manager creates session');
select is((select hourly_rate from public.b2c_teaching_sessions where class_id='50000000-0000-4000-8000-000000000006'),120000::numeric,'Rate snapshot stored');
select throws_ok($$select public.create_b2c_teaching_session('50000000-0000-4000-8000-000000000006','50000000-0000-4000-8000-000000000005',now(),now()+interval '20 minutes')$$,'22023',null,'Overlapping teaching blocked');
reset role;
create temporary table test_session as select id from public.b2c_teaching_sessions where class_id='50000000-0000-4000-8000-000000000006';
grant select on test_session to authenticated;
update public.b2c_teachers set hourly_rate=180000 where id='50000000-0000-4000-8000-000000000005';
insert into storage.objects(bucket_id,name,metadata) select 'b2c-check-photos',id::text||'/50000000-0000-4000-8000-000000000002/'||kind||'/test.jpg','{"mimetype":"image/jpeg","size":100}'::jsonb from test_session cross join (values('in'),('out')) q(kind);
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.create_b2c_teaching_session('50000000-0000-4000-8000-000000000006','50000000-0000-4000-8000-000000000005',now(),now()+interval '1 hour')$$,'42501',null,'Teacher cannot create payable schedules');
select is((select count(*)::integer from public.b2c_teaching_sessions),1,'Teacher sees own session');
select throws_ok($$select public.check_b2c_teaching_session(id,'in',id::text||'/50000000-0000-4000-8000-000000000002/in/missing.jpg') from test_session$$,'22023',null,'Photo must exist');
select throws_ok($$select public.check_b2c_teaching_session(id,'out',id::text||'/50000000-0000-4000-8000-000000000002/out/test.jpg') from test_session$$,'22023',null,'Must check in first');
select lives_ok($$select public.check_b2c_teaching_session(id,'in',id::text||'/50000000-0000-4000-8000-000000000002/in/test.jpg') from test_session$$,'Check in with own photo');
select lives_ok($$select public.check_b2c_teaching_session(id,'in',id::text||'/50000000-0000-4000-8000-000000000002/in/test.jpg') from test_session$$,'Retry is idempotent');
select throws_ok($$select public.check_b2c_teaching_session(id,'out',id::text||'/50000000-0000-4000-8000-000000000002/out/test.jpg') from test_session$$,'22023',null,'Early check out blocked');
select throws_ok($$update public.b2c_teaching_sessions set check_out_at=now()$$,'42501',null,'Cannot forge timestamps directly');
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::integer from public.b2c_teaching_sessions),0,'Peer cannot read another teacher');
select throws_ok($$select public.check_b2c_teaching_session(id,'in',id::text||'/50000000-0000-4000-8000-000000000002/in/test.jpg') from test_session$$,'42501',null,'Peer cannot check in');
reset role;
-- Shorten the test schedule only as postgres so checkout can be tested now.
update public.b2c_teaching_sessions set ends_at=clock_timestamp()-interval '1 second',starts_at=clock_timestamp()-interval '1 hour 1 second' where id=(select id from test_session);
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.check_b2c_teaching_session(id,'out',id::text||'/50000000-0000-4000-8000-000000000002/out/test.jpg') from test_session$$,'Checkout after scheduled end');
select ok(abs((select teaching_hours from public.b2c_teaching_sessions)-1)<0.0001,'Hours use schedule rather than seconds between checkpoints');
select is((select salary from public.b2c_teaching_sessions),120000::numeric,'Original hourly rate used despite rate edit');
select lives_ok($$select public.check_b2c_teaching_session(id,'out',id::text||'/50000000-0000-4000-8000-000000000002/out/test.jpg') from test_session$$,'Checkout retry does not duplicate salary');
select is((public.get_b2c_teaching_page((now() at time zone 'Asia/Ho_Chi_Minh')::date,0,true)->>'salary')::numeric,120000::numeric,'Monthly salary includes completed session once');
reset role;
select * from finish();
rollback;
