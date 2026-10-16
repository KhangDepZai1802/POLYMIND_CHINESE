begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('51000000-0000-4000-8000-000000000001','authenticated','authenticated','unpriced-manager@example.test',now(),now()),
('51000000-0000-4000-8000-000000000002','authenticated','authenticated','unpriced-owner@example.test',now(),now()),
('51000000-0000-4000-8000-000000000003','authenticated','authenticated','unpriced-peer@example.test',now(),now());
insert into public.profiles(id,role,full_name,is_active) values
('51000000-0000-4000-8000-000000000001','academic_manager','TEST MANAGER',true),
('51000000-0000-4000-8000-000000000002','teacher','TEST TEACHER',true),
('51000000-0000-4000-8000-000000000003','teacher','TEST PEER',true);
insert into public.teachers(id,user_id,teacher_code) values('51000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000002','GV-TEST-TIME');
insert into public.b2c_teachers(id,source_teacher_id,full_name,hourly_rate) values('51000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000004','TEST TEACHER',null);
insert into public.b2c_classes(id,program_slug,name,teacher_id,teacher_name,status) values('51000000-0000-4000-8000-000000000006','tieng-anh','TEST TEACHING','51000000-0000-4000-8000-000000000005','TEST TEACHER','active');

insert into public.b2c_class_meetings(id,request_id,class_id,starts_at,ends_at,created_by,updated_by,teacher_name)
values('51000000-0000-4000-8000-000000000007',gen_random_uuid(),'51000000-0000-4000-8000-000000000006',now()-interval '30 minutes',now()+interval '30 minutes','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','TEST TEACHER');
select ok(not has_function_privilege('anon','public.prepare_b2c_meeting_checkin(uuid)','EXECUTE'),'Anon denied');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.prepare_b2c_meeting_checkin('51000000-0000-4000-8000-000000000007')$$,'42501',null,'Peer denied');
reset role;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.read_b2c_checkin_meetings()),1,'Owner sees actual meeting without rate');
select lives_ok($$select public.prepare_b2c_meeting_checkin('51000000-0000-4000-8000-000000000007')$$,'Prepare without rate');
select lives_ok($$select public.prepare_b2c_meeting_checkin('51000000-0000-4000-8000-000000000007')$$,'Prepare retry');
reset role;
select is((select count(*) from public.b2c_teaching_sessions where class_id='51000000-0000-4000-8000-000000000006'),1::bigint,'No duplicate');
select ok((select hourly_rate is null from public.b2c_teaching_sessions where class_id='51000000-0000-4000-8000-000000000006'),'Unknown rate stays null');
create temporary table unpriced_session as select teaching_session_id as id from public.b2c_class_meetings where id='51000000-0000-4000-8000-000000000007';
grant select on unpriced_session to authenticated;
insert into storage.objects(bucket_id,name,metadata) select 'b2c-check-photos',id::text||'/51000000-0000-4000-8000-000000000002/'||kind||'/test.jpg','{"mimetype":"image/jpeg","size":100}'::jsonb from unpriced_session cross join(values('in'),('out')) q(kind);
set local role authenticated;
select throws_ok($$select public.price_b2c_teaching_session(id,120000) from unpriced_session$$,'42501',null,'Teacher cannot set own rate');
select throws_ok($$select public.check_b2c_teaching_session(id,'in',id::text||'/51000000-0000-4000-8000-000000000002/in/missing.jpg') from unpriced_session$$,'22023',null,'Still requires uploaded photo');
select lives_ok($$select public.check_b2c_teaching_session(id,'in',id::text||'/51000000-0000-4000-8000-000000000002/in/test.jpg') from unpriced_session$$,'Check-in without rate');
select throws_ok($$select public.check_b2c_teaching_session(id,'out',id::text||'/51000000-0000-4000-8000-000000000002/out/test.jpg') from unpriced_session$$,'22023',null,'Cannot checkout early');
reset role;
update public.b2c_teaching_sessions set starts_at=clock_timestamp()-interval '1 hour 1 second',ends_at=clock_timestamp()-interval '1 second' where id=(select id from unpriced_session);
set local role authenticated;
select lives_ok($$select public.check_b2c_teaching_session(id,'out',id::text||'/51000000-0000-4000-8000-000000000002/out/test.jpg') from unpriced_session$$,'Checkout without rate');
reset role;
select ok(abs((select teaching_hours from public.b2c_teaching_sessions where id=(select id from unpriced_session))-1)<0.0001,'Hours recorded without rate');
select ok((select salary is null from public.b2c_teaching_sessions where id=(select id from unpriced_session)),'Money pending rather than zero');
set local role authenticated;
select is((public.get_b2c_teaching_page((now() at time zone 'Asia/Ho_Chi_Minh')::date,0,true)->>'pending_price_count')::integer,1,'Pending count includes unpriced completed session');
reset role;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.price_b2c_teaching_session(id,-1) from unpriced_session$$,'22023',null,'Reject negative');
select throws_ok($$select public.price_b2c_teaching_session(id,null) from unpriced_session$$,'22023',null,'Reject null');
select lives_ok($$select public.price_b2c_teaching_session(id,120000) from unpriced_session$$,'Manager prices completed session');
select lives_ok($$select public.price_b2c_teaching_session(id,120000) from unpriced_session$$,'Price retry');
select throws_ok($$select public.price_b2c_teaching_session(id,130000) from unpriced_session$$,'40001',null,'Cannot overwrite priced history');
reset role;
select is((select salary from public.b2c_teaching_sessions where id=(select id from unpriced_session)),120000::numeric,'Money calculated after explicit pricing');
select is((select count(*) from public.b2c_class_history where class_id='51000000-0000-4000-8000-000000000006' and action='price_teaching_session'),1::bigint,'Audit once');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.create_b2c_teaching_session('51000000-0000-4000-8000-000000000006','51000000-0000-4000-8000-000000000005',date_trunc('day',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'+interval '1 day 10 hours',date_trunc('day',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'+interval '1 day 11 hours')$$,'Manager creates without rate');
reset role;
create temporary table future_unpriced as select id from public.b2c_class_meetings where class_id='51000000-0000-4000-8000-000000000006' and id<>'51000000-0000-4000-8000-000000000007';
grant select on future_unpriced to authenticated;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.prepare_b2c_meeting_checkin(id) from future_unpriced$$,'22023',null,'No future check-in');
reset role;
update public.b2c_class_meetings set status='cancelled' where id='51000000-0000-4000-8000-000000000007';
set local role authenticated;
select is(jsonb_array_length(public.read_b2c_checkin_meetings()),0,'Cancelled meeting hidden');
select throws_ok($$select public.prepare_b2c_meeting_checkin('51000000-0000-4000-8000-000000000007')$$,'22023',null,'Cancelled meeting rejected');
reset role;
insert into public.b2c_teacher_permissions(teacher_id,permissions,updated_by) values('51000000-0000-4000-8000-000000000005',array[]::text[],'51000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select public.read_b2c_checkin_meetings()$$,'42501',null,'Revoked permission blocks reads');
select throws_ok($$select public.prepare_b2c_meeting_checkin('51000000-0000-4000-8000-000000000007')$$,'42501',null,'Revoked permission blocks writes');
reset role;
select * from finish();
rollback;
