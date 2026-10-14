begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(40);
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('75000000-0000-4000-8000-000000000001','authenticated','authenticated','class-admin@example.test',now(),now()),
('75000000-0000-4000-8000-000000000002','authenticated','authenticated','class-manager@example.test',now(),now()),
('75000000-0000-4000-8000-000000000003','authenticated','authenticated','class-teacher@example.test',now(),now()),
('75000000-0000-4000-8000-000000000004','authenticated','authenticated','class-exec@example.test',now(),now());
insert into public.profiles(id,role,full_name,is_active) values
('75000000-0000-4000-8000-000000000001','super_admin','TEST CLASS ADMIN',true),
('75000000-0000-4000-8000-000000000002','academic_manager','TEST CLASS MANAGER',true),
('75000000-0000-4000-8000-000000000003','teacher','TEST CLASS TEACHER',true),
('75000000-0000-4000-8000-000000000004','executive','TEST CLASS EXEC',true);
insert into public.b2c_classes(id,program_slug,name,status) values('75000000-0000-4000-8000-000000000010','tieng-anh','TEST CLASS A','active'),('75000000-0000-4000-8000-000000000011','tieng-anh','TEST CLASS B','active');
insert into public.b2c_students(id,source_key,full_name,phone) values('75000000-0000-4000-8000-000000000020','TEST-WORKSPACE-STUDENT-A','TEST STUDENT A','0901234567'),('75000000-0000-4000-8000-000000000021','TEST-WORKSPACE-STUDENT-B','TEST STUDENT B','0901234568');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,enrollment_date,salesperson) values
('75000000-0000-4000-8000-000000000030','TEST-WORKSPACE-ENROLL-A','75000000-0000-4000-8000-000000000010','75000000-0000-4000-8000-000000000020','2026-01-01','TEST'),
('75000000-0000-4000-8000-000000000031','TEST-WORKSPACE-ENROLL-B','75000000-0000-4000-8000-000000000011','75000000-0000-4000-8000-000000000021','2026-01-01','TEST');
create temp table class_ctx(k text primary key,id uuid,payload jsonb);
grant all on class_ctx to authenticated;
select ok((select relrowsecurity from pg_class where oid='public.b2c_class_meetings'::regclass),'Meeting RLS');
select ok((select relrowsecurity from pg_class where oid='public.b2c_student_attendance'::regclass),'Attendance RLS');
select ok((select relrowsecurity from pg_class where oid='public.b2c_student_comments'::regclass),'Comment RLS');
select ok((select relrowsecurity from pg_class where oid='public.b2c_class_requests'::regclass),'Request RLS');
select ok((select relrowsecurity from pg_class where oid='public.b2c_class_history'::regclass),'History RLS');
select ok(not has_table_privilege('authenticated','public.b2c_student_attendance','UPDATE'),'No direct attendance update');
select ok(not has_function_privilege('anon','public.read_b2c_class_workspace(uuid,text,integer,text,uuid)','EXECUTE'),'Anonymous cannot read RPC');
select set_config('request.jwt.claims','{"sub":"75000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
insert into class_ctx(k,payload) values('meeting','{"class_id":"75000000-0000-4000-8000-000000000010","request_id":"75000000-0000-4000-8000-000000000040","starts_at":"2026-01-01T10:00:00+07:00","ends_at":"2026-01-01T11:00:00+07:00","teacher_name":"TEST","status":"planned","note":"TEST"}');
update class_ctx set id=public.write_b2c_class_workspace('save_meeting',payload) where k='meeting';
select lives_ok($$select public.write_b2c_class_workspace('save_meeting',payload) from class_ctx where k='meeting'$$,'Create meeting retry safe');
select is((select count(*)::int from public.b2c_class_meetings where class_id='75000000-0000-4000-8000-000000000010'),1,'Exactly one meeting');
select throws_ok($$select public.write_b2c_class_workspace('save_meeting',payload||'{"teacher_name":"CHANGED"}') from class_ctx where k='meeting'$$,'P0001',null,'Changed retry rejected');
select throws_ok($$select public.write_b2c_class_workspace('save_meeting',payload||jsonb_build_object('request_id',gen_random_uuid(),'starts_at','2026-01-01T10:30:00+07:00')) from class_ctx where k='meeting'$$,'P0001',null,'Overlap rejected');
select throws_ok($$select public.write_b2c_class_workspace('save_meeting',payload||jsonb_build_object('request_id',gen_random_uuid(),'ends_at','2026-01-02T11:00:00+07:00')) from class_ctx where k='meeting'$$,'P0001',null,'Cross-day duration rejected');
select ok(public.read_b2c_class_workspace('75000000-0000-4000-8000-000000000010','attendance')->'rows'->0->>'attendance_status' is null,'Unmarked is not absent');
select is((public.read_b2c_class_workspace('75000000-0000-4000-8000-000000000010','students')->>'total')::int,1,'Roster restricted to selected class');
select throws_ok($$select public.read_b2c_class_workspace('75000000-0000-4000-8000-000000000011','attendance',0,'',(select id from class_ctx where k='meeting'))$$,'P0001',null,'Foreign-class meeting rejected');
insert into class_ctx(k,payload) select 'attendance',jsonb_build_object('class_id','75000000-0000-4000-8000-000000000010','request_id','75000000-0000-4000-8000-000000000041','meeting_id',id,'enrollment_id','75000000-0000-4000-8000-000000000030','status','present','note','TEST','expected_updated_at',null) from class_ctx where k='meeting';
select throws_ok($$select public.write_b2c_class_workspace('save_attendance',payload||'{"enrollment_id":"75000000-0000-4000-8000-000000000031"}') from class_ctx where k='attendance'$$,'P0001',null,'Cannot mark another class enrollment');
select lives_ok($$select public.write_b2c_class_workspace('save_attendance',payload) from class_ctx where k='attendance'$$,'Academic manager marks attendance');
select lives_ok($$select public.write_b2c_class_workspace('save_attendance',payload) from class_ctx where k='attendance'$$,'Attendance retry safe');
select is((select count(*)::int from public.b2c_student_attendance where enrollment_id='75000000-0000-4000-8000-000000000030'),1,'One attendance record');
select is((select updated_by from public.b2c_student_attendance where enrollment_id='75000000-0000-4000-8000-000000000030'),'75000000-0000-4000-8000-000000000002'::uuid,'Actual actor');
select throws_ok($$select public.write_b2c_class_workspace('save_attendance',payload||jsonb_build_object('request_id',gen_random_uuid(),'status','absent')) from class_ctx where k='attendance'$$,'P0001',null,'Stale attendance cannot overwrite');
select throws_ok($$select public.write_b2c_class_workspace('save_meeting',payload||jsonb_build_object('id',id,'request_id',gen_random_uuid(),'expected_updated_at',(select updated_at from public.b2c_class_meetings where id=class_ctx.id),'status','cancelled')) from class_ctx where k='meeting'$$,'P0001',null,'Cannot cancel historical attendance');
insert into class_ctx(k,payload) select 'comment',jsonb_build_object('class_id','75000000-0000-4000-8000-000000000010','request_id','75000000-0000-4000-8000-000000000042','meeting_id',id,'enrollment_id','75000000-0000-4000-8000-000000000030','content','TEST nhận xét có dấu') from class_ctx where k='meeting';
select lives_ok($$select public.write_b2c_class_workspace('add_comment',payload) from class_ctx where k='comment'$$,'Save comment');
select lives_ok($$select public.write_b2c_class_workspace('add_comment',payload) from class_ctx where k='comment'$$,'Comment retry safe');
select is((select count(*)::int from public.b2c_student_comments where class_id='75000000-0000-4000-8000-000000000010'),1,'No duplicate comments');
select throws_ok($$select public.write_b2c_class_workspace('add_comment',payload||jsonb_build_object('request_id',gen_random_uuid(),'class_id','75000000-0000-4000-8000-000000000011')) from class_ctx where k='comment'$$,'P0001',null,'Cross-class comment rejected');
select throws_ok($$select public.write_b2c_class_workspace('add_comment',payload||jsonb_build_object('request_id',gen_random_uuid(),'content',' ')) from class_ctx where k='comment'$$,'23514',null,'Empty comment rejected');
select is((public.read_b2c_class_workspace('75000000-0000-4000-8000-000000000010','tuition')->'stats'->>'unconfigured')::int,1,'Missing package explicitly unconfigured');
insert into class_ctx(k,id) values('package',public.save_b2c_tuition_package('75000000-0000-4000-8000-000000000030',10,100,0,''));
select public.record_b2c_tuition_receipt((select id from class_ctx where k='package'),gen_random_uuid(),'2026-01-01',400,'cash','TEST');
select public.save_b2c_tuition_package('75000000-0000-4000-8000-000000000031',10,1000,0,'');
select is((public.read_b2c_class_workspace('75000000-0000-4000-8000-000000000010','tuition')->'stats'->>'total_due')::numeric,1000::numeric,'Only this class fee counted');
select is((public.read_b2c_class_workspace('75000000-0000-4000-8000-000000000010','tuition')->'stats'->>'paid_amount')::numeric,400::numeric,'Existing receipts reused');
select is((public.read_b2c_class_workspace('75000000-0000-4000-8000-000000000010','tuition')->'rows'->0->>'balance')::numeric,600::numeric,'Correct tuition balance');
select is((select count(*)::int from public.b2c_teaching_sessions where class_id='75000000-0000-4000-8000-000000000010'),0,'Calendar does not create payroll sessions');
select is((select count(*)::int from public.b2c_class_history where class_id='75000000-0000-4000-8000-000000000010'),3,'Each successful class mutation has one history event');
insert into class_ctx(k,id) select 'future',public.write_b2c_class_workspace('save_meeting',payload||jsonb_build_object('request_id',gen_random_uuid(),'starts_at','2099-01-01T10:00:00+07:00','ends_at','2099-01-01T11:00:00+07:00')) from class_ctx where k='meeting';
select throws_ok($$select public.write_b2c_class_workspace('save_attendance',payload||jsonb_build_object('request_id',gen_random_uuid(),'meeting_id',(select id from class_ctx where k='future'))) from class_ctx where k='attendance'$$,'P0001',null,'Future meeting cannot be marked');
reset role;
select set_config('request.jwt.claims','{"sub":"75000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.b2c_student_attendance),0,'Teacher cannot read raw class attendance without manager permission');
select throws_ok($$select public.read_b2c_class_workspace('75000000-0000-4000-8000-000000000010','students')$$,'42501',null,'Teacher cannot read manager roster RPC');
select throws_ok($$select public.write_b2c_class_workspace('save_attendance','{}')$$,'42501',null,'Teacher cannot write manager RPC');
reset role;
select set_config('request.jwt.claims','{"sub":"75000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.read_b2c_class_workspace('75000000-0000-4000-8000-000000000010','tuition')$$,'42501',null,'Executive XKLĐ permission does not grant class finances');
select is((select count(*)::int from public.b2c_student_comments),0,'Executive cannot read raw comments');
reset role;
select set_config('request.jwt.claims','{"sub":"75000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.read_b2c_class_workspace('75000000-0000-4000-8000-000000000010','students')$$,'Super admin can read');
reset role;
select * from finish();
rollback;
