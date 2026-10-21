begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select is((select starts_at from app.b2c_weekly_slot('T2, T4','18:00–19:30','2026-10-21')), '2026-10-21 18:00+07'::timestamptz,'Shared weekly hours');
select is((select starts_at from app.b2c_weekly_slot('T2, T4','T2 17:00–18:00; T4 18:30–20:00','2026-10-21')), '2026-10-21 18:30+07'::timestamptz,'Day-specific hours');
select is((select count(*) from app.b2c_weekly_slot('T2','18:00–19:00','2026-10-21')),0::bigint,'Other weekday excluded');
select is((select count(*) from app.b2c_weekly_slot('T4','unknown','2026-10-21')),0::bigint,'Unknown hours never guessed');
select is((select count(*) from app.b2c_weekly_slot('T4','25:00–26:00','2026-10-21')),0::bigint,'Invalid time rejected');
select is((select count(*) from app.b2c_weekly_slot('T4','19:00–18:00','2026-10-21')),0::bigint,'Overnight rejected');
select ok(not app.b2c_checkin_open('2026-10-21 18:00+07','2026-10-21 19:30+07','2026-10-21 17:44:59+07'),'15 minutes plus one second is too early');
select ok(app.b2c_checkin_open('2026-10-21 18:00+07','2026-10-21 19:30+07','2026-10-21 17:45+07'),'Exactly 15 minutes allowed');
select ok(app.b2c_checkin_open('2026-10-21 18:00+07','2026-10-21 19:30+07','2026-10-21 19:29:59+07'),'Last second allowed');
select ok(not app.b2c_checkin_open('2026-10-21 18:00+07','2026-10-21 19:30+07','2026-10-21 19:30+07'),'Exact end rejected');
select ok(not app.b2c_checkin_open('2026-10-21 00:05+07','2026-10-21 01:00+07','2026-10-20 23:55+07'),'Prior calendar day rejected');
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('52100000-0000-4000-8000-000000000001','authenticated','authenticated','weekly-manager@example.test',now(),now()),
('52100000-0000-4000-8000-000000000002','authenticated','authenticated','weekly-owner@example.test',now(),now()),
('52100000-0000-4000-8000-000000000003','authenticated','authenticated','weekly-peer@example.test',now(),now());
insert into public.profiles(id,role,full_name,is_active) values
('52100000-0000-4000-8000-000000000001','academic_manager','WEEKLY MANAGER',true),
('52100000-0000-4000-8000-000000000002','teacher','WEEKLY OWNER',true),
('52100000-0000-4000-8000-000000000003','teacher','WEEKLY PEER',true);
insert into public.teachers(id,user_id,teacher_code) values('52100000-0000-4000-8000-000000000004','52100000-0000-4000-8000-000000000002','GV-WEEKLY-TEST');
insert into public.b2c_teachers(id,source_teacher_id,full_name) values('52100000-0000-4000-8000-000000000005','52100000-0000-4000-8000-000000000004','WEEKLY OWNER');
insert into public.b2c_classes(id,program_slug,name,teacher_id,teacher_name,status,weekdays_text,time_text) values
('52100000-0000-4000-8000-000000000006','tieng-anh','WEEKLY CLASS','52100000-0000-4000-8000-000000000005','WEEKLY OWNER','active',
case extract(isodow from now() at time zone 'Asia/Ho_Chi_Minh')::int when 7 then 'CN' else 'T'||(extract(isodow from now() at time zone 'Asia/Ho_Chi_Minh')::int+1)::text end,
to_char(now() at time zone 'Asia/Ho_Chi_Minh','HH24:MI')||'-'||to_char(least((now() at time zone 'Asia/Ho_Chi_Minh')::time+interval '30 minutes',time '23:59'),'HH24:MI'));
select ok(not has_function_privilege('anon','public.prepare_b2c_weekly_checkin(uuid)','EXECUTE'),'Anonymous cannot prepare');
select ok(not has_function_privilege('authenticated','app.b2c_weekly_slot(text,text,date)','EXECUTE'),'Weekly helper private');
select set_config('request.jwt.claims','{"sub":"52100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.prepare_b2c_weekly_checkin('52100000-0000-4000-8000-000000000006')$$,'42501',null,'Other teacher denied');
reset role;
select set_config('request.jwt.claims','{"sub":"52100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.read_b2c_checkin_meetings()),1,'Weekly class appears without dated meeting');
reset role;
select is((select count(*) from public.b2c_class_meetings where class_id='52100000-0000-4000-8000-000000000006'),0::bigint,'Read does not create meetings');
set local role authenticated;
select lives_ok($$select public.prepare_b2c_weekly_checkin('52100000-0000-4000-8000-000000000006')$$,'Assigned teacher can prepare weekly slot');
select lives_ok($$select public.prepare_b2c_weekly_checkin('52100000-0000-4000-8000-000000000006')$$,'Retry is idempotent');
select is(jsonb_array_length(public.read_b2c_checkin_meetings()),1,'Materialized meeting replaces weekly card');
reset role;
select is((select count(*) from public.b2c_teaching_sessions where class_id='52100000-0000-4000-8000-000000000006'),1::bigint,'One payroll session only');
select ok((select hourly_rate is null from public.b2c_teaching_sessions where class_id='52100000-0000-4000-8000-000000000006'),'No invented hourly rate');
create temporary table weekly_session as select teaching_session_id id from public.b2c_class_meetings where class_id='52100000-0000-4000-8000-000000000006';
grant select on weekly_session to authenticated;
insert into storage.objects(bucket_id,name,metadata) select 'b2c-check-photos',id::text||'/52100000-0000-4000-8000-000000000002/in/test.jpg','{"mimetype":"image/jpeg","size":100}'::jsonb from weekly_session;
-- Shift the payroll start forward without changing the fixture's calendar day.
update public.b2c_teaching_sessions set starts_at=clock_timestamp()+interval '16 minutes',ends_at=clock_timestamp()+interval '40 minutes' where id=(select id from weekly_session);
set local role authenticated;
select throws_ok($$select public.check_b2c_teaching_session(id,'in',id::text||'/52100000-0000-4000-8000-000000000002/in/test.jpg') from weekly_session$$,'22023',null,'Direct RPC cannot check in too early');
reset role;
update public.b2c_teaching_sessions set starts_at=clock_timestamp()-interval '1 minute',ends_at=clock_timestamp()+interval '20 minutes' where id=(select id from weekly_session);
set local role authenticated;
select lives_ok($$select public.check_b2c_teaching_session(id,'in',id::text||'/52100000-0000-4000-8000-000000000002/in/test.jpg') from weekly_session$$,'Valid photo within teaching window succeeds');
reset role;
update public.b2c_teaching_sessions set starts_at=clock_timestamp()-interval '40 minutes',ends_at=clock_timestamp()-interval '1 minute' where id=(select id from weekly_session);
set local role authenticated;
select lives_ok($$select public.check_b2c_teaching_session(id,'in',id::text||'/52100000-0000-4000-8000-000000000002/in/test.jpg') from weekly_session$$,'Same-photo retry still succeeds after end');
reset role;
update public.b2c_class_meetings set status='cancelled' where class_id='52100000-0000-4000-8000-000000000006';
set local role authenticated;
select is(jsonb_array_length(public.read_b2c_checkin_meetings()),0,'Cancelled dated override suppresses weekly fallback');
select throws_ok($$select public.prepare_b2c_weekly_checkin('52100000-0000-4000-8000-000000000006')$$,'22023',null,'Cancelled meeting cannot be recreated');
reset role;
insert into public.b2c_teacher_permissions(teacher_id,permissions,updated_by) values('52100000-0000-4000-8000-000000000005',array[]::text[],'52100000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select public.read_b2c_checkin_meetings()$$,'42501',null,'Revoked permission blocks combined read');
select throws_ok($$select public.prepare_b2c_weekly_checkin('52100000-0000-4000-8000-000000000006')$$,'42501',null,'Revoked permission blocks weekly prepare');
reset role;
select * from finish();
rollback;
