create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id) values('17200000-0000-4000-8000-000000000001'),('17200000-0000-4000-8000-000000000002');
insert into public.profiles(id,role,full_name,is_active) values
 ('17200000-0000-4000-8000-000000000001','academic_manager','TEST-ASSESS-MANAGER',true),
 ('17200000-0000-4000-8000-000000000002','teacher','TEST-ASSESS-TEACHER',true);
insert into public.teachers(id,user_id) values('17200000-0000-4000-8000-000000000003','17200000-0000-4000-8000-000000000002');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values('17200000-0000-4000-8000-000000000004','TEST-ASSESS-TEACHER','17200000-0000-4000-8000-000000000003');
insert into public.b2c_classes(id,program_slug,name,teacher_name,status) values
 ('17200000-0000-4000-8000-000000000010','tieng-anh','TEST-ASSESS-CLASS','TEST-ASSESS-TEACHER','active'),
 ('17200000-0000-4000-8000-000000000011','tieng-anh','TEST-ASSESS-OTHER','UNASSIGNED','active');
insert into public.b2c_students(id,source_key,full_name) values
 ('17200000-0000-4000-8000-000000000020','test-assess-student','TEST-ASSESS-STUDENT'),
 ('17200000-0000-4000-8000-000000000021','test-assess-later','TEST-ASSESS-LATER'),
 ('17200000-0000-4000-8000-000000000022','test-assess-transferred','TEST-ASSESS-TRANSFERRED');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,enrollment_date,status) values
 ('17200000-0000-4000-8000-000000000030','test-assess-enrollment','17200000-0000-4000-8000-000000000010','17200000-0000-4000-8000-000000000020','2026-01-01','studying'),
 ('17200000-0000-4000-8000-000000000031','test-assess-later-e','17200000-0000-4000-8000-000000000010','17200000-0000-4000-8000-000000000021','2026-12-01','studying'),
 ('17200000-0000-4000-8000-000000000032','test-assess-transferred-e','17200000-0000-4000-8000-000000000010','17200000-0000-4000-8000-000000000022','2026-01-01','transferred');
select is((select count(*)::integer from pg_class where oid in ('public.b2c_assessments'::regclass,'public.b2c_assessment_results'::regclass,'public.b2c_assessment_history'::regclass,'public.b2c_assessment_requests'::regclass) and relrowsecurity),4,'All four assessment tables have RLS');
select ok(not has_function_privilege('anon','public.write_b2c_assessment(text,jsonb)','EXECUTE'),'Anon cannot write assessments');
select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.exam',jsonb_build_object('request_id','17200000-0000-4000-8000-000000000040','class_id','17200000-0000-4000-8000-000000000010','id',null,'expected_updated_at',null,'title','TEST MIDTERM','kind','midterm','exam_date','2026-10-17','max_score',10)::text,true);
select throws_ok($$select public.write_b2c_assessment('exam',current_setting('test.exam')::jsonb||'{"max_score":0}')$$,'22023',null,'Zero max score rejected');
select throws_ok($$select public.write_b2c_assessment('exam',current_setting('test.exam')::jsonb||'{"kind":"unknown"}')$$,'22023',null,'Unknown assessment kind rejected');
select lives_ok($$select public.write_b2c_assessment('exam',current_setting('test.exam')::jsonb)$$,'Manager creates midterm');
select lives_ok($$select public.write_b2c_assessment('exam',current_setting('test.exam')::jsonb)$$,'Create retry succeeds');
select is((select count(*)::integer from public.b2c_assessments where class_id='17200000-0000-4000-8000-000000000010'),1,'Create retry has no duplicates');
select throws_ok($$select public.write_b2c_assessment('exam',current_setting('test.exam')::jsonb||'{"title":"OTHER"}')$$,'22023',null,'Changed retry rejected');
select set_config('test.exam_id',(select id::text from public.b2c_assessments where class_id='17200000-0000-4000-8000-000000000010'),true);
select is((public.read_b2c_assessments('17200000-0000-4000-8000-000000000010')->>'total')::integer,1,'Roster excludes late enrollment and transferred before exam');
select is((public.read_b2c_assessments('17200000-0000-4000-8000-000000000010')->>'graded')::integer,0,'Unentered marks are not graded');
select throws_ok($$select public.read_b2c_assessments('17200000-0000-4000-8000-000000000011',current_setting('test.exam_id')::uuid)$$,'22023',null,'Cross-class exam read rejected');
select set_config('test.result',jsonb_build_object('request_id','17200000-0000-4000-8000-000000000041','class_id','17200000-0000-4000-8000-000000000010','exam_id',current_setting('test.exam_id'),'enrollment_id','17200000-0000-4000-8000-000000000030','expected_updated_at',null,'score',0,'feedback','TEST-FEEDBACK','reason','')::text,true);
select throws_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb||'{"score":11}')$$,'22023',null,'Score above max rejected');
select throws_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb||'{"score":-1}')$$,'22023',null,'Negative score rejected');
select throws_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb||'{"score":1.001}')$$,'22023',null,'Excess precision rejected');
select throws_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb||'{"enrollment_id":"17200000-0000-4000-8000-000000000031"}')$$,'22023',null,'Student joining after exam cannot be graded');
select lives_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb)$$,'Zero score saved');
select is((public.read_b2c_assessments('17200000-0000-4000-8000-000000000010')->>'graded')::integer,1,'Zero is graded');
select lives_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb)$$,'Result retry succeeds');
select is((select count(*)::integer from public.b2c_assessment_history where exam_id=current_setting('test.exam_id')::uuid),2,'Retry adds no history');
select throws_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb||'{"request_id":"17200000-0000-4000-8000-000000000042","score":7}')$$,'40001',null,'Stale score correction rejected');
select set_config('test.result',(current_setting('test.result')::jsonb||jsonb_build_object('request_id','17200000-0000-4000-8000-000000000042','expected_updated_at',(select updated_at from public.b2c_assessment_results where exam_id=current_setting('test.exam_id')::uuid),'score',7))::text,true);
select throws_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb)$$,'22023',null,'Correction requires reason');
select set_config('test.result',(current_setting('test.result')::jsonb||'{"reason":"TEST-CORRECTION"}')::text,true);
select lives_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb)$$,'Correction recorded');
select is((select score::integer from public.b2c_assessment_results where exam_id=current_setting('test.exam_id')::uuid),7,'Corrected score returned');
select is((select (before_data->>'score')::numeric from public.b2c_assessment_history where reason='TEST-CORRECTION'),0::numeric,'History preserves previous zero');
select is((select actor_id from public.b2c_assessment_history where reason='TEST-CORRECTION'),'17200000-0000-4000-8000-000000000001'::uuid,'History captures actual actor');
select throws_ok($$select public.write_b2c_assessment('exam',current_setting('test.exam')::jsonb||jsonb_build_object('request_id',gen_random_uuid(),'id',current_setting('test.exam_id'),'expected_updated_at',(select updated_at from public.b2c_assessments where id=current_setting('test.exam_id')::uuid),'max_score',100))$$,'22023',null,'Cannot change scale after results exist');
select throws_ok($$delete from public.b2c_assessment_history$$,'42501',null,'History cannot be deleted');
select throws_ok($$update public.b2c_assessment_results set score=9$$,'42501',null,'Direct score write bypass rejected');
select lives_ok($$select public.write_b2c_assessment('exam',current_setting('test.exam')::jsonb||'{"request_id":"17200000-0000-4000-8000-000000000043","kind":"final","title":"TEST FINAL","exam_date":"2099-01-01"}')$$,'Future final exam may be planned');
select throws_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb||jsonb_build_object('request_id',gen_random_uuid(),'exam_id',(select id from public.b2c_assessments where title='TEST FINAL'),'expected_updated_at',null))$$,'22023',null,'Future exam cannot receive marks');
select throws_ok($$select public.save_b2c_teacher_permissions('17200000-0000-4000-8000-000000000004','17200000-0000-4000-8000-000000000003',array['grade_assessments'],null)$$,'P0001',null,'Grade capability requires dependencies');
select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select ok(not public.has_b2c_permission('view_assessments','17200000-0000-4000-8000-000000000010'),'Teacher not granted by default');
select is((select count(*)::integer from public.b2c_assessment_results),0,'RLS hides marks from ungranted teacher');
select throws_ok($$select public.read_b2c_assessments('17200000-0000-4000-8000-000000000010')$$,'42501',null,'Ungrant teacher cannot use read RPC');
select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.save_b2c_teacher_permissions('17200000-0000-4000-8000-000000000004','17200000-0000-4000-8000-000000000003',array['view_classes','view_students','view_assessments'],null)$$,'Manager grants assessment view');
select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.read_b2c_assessments('17200000-0000-4000-8000-000000000010')$$,'View teacher reads own class');
select throws_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb)$$,'42501',null,'View-only teacher cannot grade');
select throws_ok($$select public.read_b2c_assessments('17200000-0000-4000-8000-000000000011')$$,'42501',null,'Foreign class denied');
select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.save_b2c_teacher_permissions('17200000-0000-4000-8000-000000000004','17200000-0000-4000-8000-000000000003',array['view_classes','view_students','view_assessments','grade_assessments'],(select updated_at from public.b2c_teacher_permissions where teacher_id='17200000-0000-4000-8000-000000000004'))$$,'Manager grants grading');
select set_config('test.result',(current_setting('test.result')::jsonb||jsonb_build_object('request_id','17200000-0000-4000-8000-000000000044','score',null,'expected_updated_at',(select updated_at from public.b2c_assessment_results where exam_id=current_setting('test.exam_id')::uuid)))::text,true);
select set_config('request.jwt.claims','{"sub":"17200000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb)$$,'Granted teacher can correct mark back to ungraded');
select is((public.read_b2c_assessments('17200000-0000-4000-8000-000000000010',current_setting('test.exam_id')::uuid)->>'graded')::integer,0,'Null mark remains ungraded');
select is((public.read_b2c_assessment_history(current_setting('test.exam_id')::uuid)->>'total')::integer,4,'Teacher views result correction history');
reset role;
alter table public.b2c_assessment_history add constraint test_assess_audit_fail check(reason<>'FAIL-AUDIT') not valid;
select set_config('test.result',(current_setting('test.result')::jsonb||jsonb_build_object('request_id','17200000-0000-4000-8000-000000000045','score',8,'reason','FAIL-AUDIT','expected_updated_at',(select updated_at from public.b2c_assessment_results where exam_id=current_setting('test.exam_id')::uuid)))::text,true);
set local role authenticated;
select throws_ok($$select public.write_b2c_assessment('result',current_setting('test.result')::jsonb)$$,'23514',null,'History failure rolls back mark');
select ok((select score is null from public.b2c_assessment_results where exam_id=current_setting('test.exam_id')::uuid),'Failed history leaves prior score unchanged');
reset role;
select is((select count(*)::integer from public.b2c_assessment_requests where request_id='17200000-0000-4000-8000-000000000045'),0,'Failed history leaves no retry ledger entry');
select * from finish();
