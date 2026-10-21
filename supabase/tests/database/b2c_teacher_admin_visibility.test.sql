-- Reuse realistic permission/write fixtures; everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
\ir b2c_teacher_permissions.test.sql
select set_config('request.jwt.claims','{"sub":"8b000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select ok(public.read_b2c_class_workspace('8b000000-0000-4000-8000-000000000010','attendance',0,'','8b000000-0000-4000-8000-000000000040')->'rows' @> '[{"attendance_status":"present"}]','Admin sees teacher attendance immediately after save');
select ok(public.read_b2c_class_workspace('8b000000-0000-4000-8000-000000000010','comments')->'rows' @> '[{"content":"TEST PERMITTED COMMENT"}]','Admin sees saved teacher comments without sending');
select ok(public.read_b2c_class_workspace('8b000000-0000-4000-8000-000000000010','students')->'rows' @> '[{"full_name":"TEST UPDATED STUDENT"}]','Admin sees edited student profile');
-- The shared fixture records two distinct installments of 100000 each.
select ok(public.read_b2c_class_workspace('8b000000-0000-4000-8000-000000000010','tuition')->'rows' @> '[{"paid_amount":200000}]','Admin sees both teacher receipts in class tuition');
select is((select count(*) from public.b2c_class_history where class_id='8b000000-0000-4000-8000-000000000010' and actor_id='8b000000-0000-4000-8000-000000000001' and action='add_comment'),1::bigint,'Admin sees actual teacher attribution in history');
select is((public.get_b2c_teaching_page('2026-01-01',0,false)->>'total')::int,1,'Admin sees teacher payroll session');
select public.save_b2c_teacher_permissions('8b000000-0000-4000-8000-000000000005','8b000000-0000-4000-8000-000000000004',array['view_classes','view_students','view_comments','write_comments','view_assessments','grade_assessments'],(select updated_at from public.b2c_teacher_permissions where teacher_id='8b000000-0000-4000-8000-000000000005'));
reset role;
select set_config('request.jwt.claims','{"sub":"8b000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.write_b2c_monthly_comment('save',jsonb_build_object('request_id',gen_random_uuid(),'class_id','8b000000-0000-4000-8000-000000000010','enrollment_id','8b000000-0000-4000-8000-000000000030','month','2026-01','status','draft','expected_updated_at',null,'content',jsonb_build_object('attendance','TEST','attitude','','learning','','strengths','','improvements','','next_plan','')))$$,'Teacher can save unfinished monthly comments');
select set_config('test.visibility_exam',public.write_b2c_assessment('exam',jsonb_build_object('request_id',gen_random_uuid(),'class_id','8b000000-0000-4000-8000-000000000010','id',null,'expected_updated_at',null,'title','TEST VISIBILITY EXAM','kind','midterm','exam_date','2026-01-01','max_score',10))::text,true);
select lives_ok($$select public.write_b2c_assessment('result',jsonb_build_object('request_id',gen_random_uuid(),'class_id','8b000000-0000-4000-8000-000000000010','exam_id',current_setting('test.visibility_exam'),'enrollment_id','8b000000-0000-4000-8000-000000000030','expected_updated_at',null,'score',8,'feedback','TEST FEEDBACK','reason',''))$$,'Granted teacher saves assessment result');
reset role;
select set_config('request.jwt.claims','{"sub":"8b000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select ok(exists(select 1 from public.b2c_monthly_comments where class_id='8b000000-0000-4000-8000-000000000010' and status='draft'),'Admin can see a saved draft without sending or finalizing');
select ok(public.read_b2c_monthly_comments('8b000000-0000-4000-8000-000000000010','2026-01',0,'')->'rows' @> '[{"report":{"status":"draft"}}]','Admin monthly screen reads teacher draft');
select ok(public.read_b2c_assessments('8b000000-0000-4000-8000-000000000010',current_setting('test.visibility_exam')::uuid,0,'',0)->'rows' @> '[{"score":8,"feedback":"TEST FEEDBACK"}]','Admin reads teacher assessment score and feedback');
reset role;
select * from finish();
rollback;
