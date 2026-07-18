begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (
    'question_collections','questions','question_versions','question_options','question_answer_keys','question_media','question_tags','question_tag_links','question_shares','question_review_requests','question_sets','question_set_versions','question_set_sections','question_set_items','question_set_shares','exercise_deliveries','exercise_attempts','exercise_answers','exam_deliveries','exam_attempts','exam_answers','exam_integrity_events','exam_regrade_runs'
  ) and c.relrowsecurity),
  23,
  'mọi bảng assessment engine đều bật RLS'
);

select is((select public from storage.buckets where id='question-media'),false,'question-media là bucket private');
select ok(
  pg_get_functiondef('app.release_immediate_exercise_result()'::regprocedure) like '%result_release_mode = ''after_graded''%',
  'trigger công bố ngay dùng đúng giá trị enum after_graded'
);
select ok(not has_function_privilege('authenticated','public.finalize_expired_exam_attempts()','EXECUTE'),'authenticated không gọi được finalizer');
select ok(has_function_privilege('authenticated','public.share_question(uuid,uuid,public.question_share_permission)','EXECUTE'),'authenticated có entrypoint chia sẻ được kiểm quyền trong RPC');
select ok(has_function_privilege('authenticated','public.clone_question(uuid)','EXECUTE'),'authenticated có entrypoint clone được kiểm quyền trong RPC');
select ok(has_function_privilege('authenticated','public.import_questions(jsonb)','EXECUTE'),'authenticated có entrypoint import transaction');
select ok(has_function_privilege('authenticated','public.get_student_assessment_overview()','EXECUTE'),'authenticated có overview student không lộ điểm sớm');
select is(
  (select count(*)::integer from pg_class where relname in ('v_enrollment_assessment_progress','v_class_assessment_progress','v_at_risk_assessment_students') and reloptions @> array['security_invoker=true']),
  3,
  'ba view tiến độ mới đều security_invoker'
);

insert into auth.users(id,email) values
('40000000-0000-0000-0000-000000000001','admin.engine@test.local'),
('40000000-0000-0000-0000-000000000002','teacher.a.engine@test.local'),
('40000000-0000-0000-0000-000000000003','teacher.b.engine@test.local'),
('40000000-0000-0000-0000-000000000004','student.a.engine@test.local'),
('40000000-0000-0000-0000-000000000005','student.b.engine@test.local');
insert into public.profiles(id,role,full_name) values
('40000000-0000-0000-0000-000000000001','super_admin','Admin Engine'),
('40000000-0000-0000-0000-000000000002','teacher','Teacher A'),
('40000000-0000-0000-0000-000000000003','teacher','Teacher B'),
('40000000-0000-0000-0000-000000000004','student','Student A'),
('40000000-0000-0000-0000-000000000005','student','Student B');
insert into public.question_sets(id,owner_id,kind,title) values
('40500000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','exercise','Unlocked cascade test');
insert into public.question_set_versions(id,question_set_id,version_no,title_snapshot,created_by) values
('40600000-0000-0000-0000-000000000001','40500000-0000-0000-0000-000000000001',1,'Unlocked cascade test','40000000-0000-0000-0000-000000000002');
select lives_ok(
  $$delete from public.question_sets where id='40500000-0000-0000-0000-000000000001'$$,
  'xóa bộ nháp cascade qua version không đọc nhầm OLD.set_version_id'
);
insert into public.teachers(id,user_id,teacher_code) values
('41000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','GV-ENG-A'),
('41000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003','GV-ENG-B');
insert into public.students(id,user_id,student_code,full_name) values
('42000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000004','HV-ENG-A','Student A'),
('42000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000005','HV-ENG-B','Student B');
insert into public.courses(id,code,title,program,course_type,status,created_by) values
('43000000-0000-0000-0000-000000000001','KH-ENG','Engine Course','core','custom','active','40000000-0000-0000-0000-000000000001');
insert into public.classes(id,code,course_id,name,capacity,planned_session_count,session_duration_minutes,start_date,delivery_mode,status,created_by) values
('44000000-0000-0000-0000-000000000001','LOP-ENG-A','43000000-0000-0000-0000-000000000001','Class A',10,10,90,'2026-07-20','offline','planned','40000000-0000-0000-0000-000000000001'),
('44000000-0000-0000-0000-000000000002','LOP-ENG-B','43000000-0000-0000-0000-000000000001','Class B',10,10,90,'2026-07-20','offline','planned','40000000-0000-0000-0000-000000000001');
insert into public.class_teachers(class_id,teacher_id) values
('44000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001'),
('44000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000002');
insert into public.enrollments(id,student_id,class_id,status,created_by) values
('45000000-0000-0000-0000-000000000001','42000000-0000-0000-0000-000000000001','44000000-0000-0000-0000-000000000001','active','40000000-0000-0000-0000-000000000001'),
('45000000-0000-0000-0000-000000000002','42000000-0000-0000-0000-000000000002','44000000-0000-0000-0000-000000000001','active','40000000-0000-0000-0000-000000000001');
insert into public.questions(id,code,owner_id,title,skill,difficulty,created_by) values
('46000000-0000-0000-0000-000000000001','CH-ENG-1','40000000-0000-0000-0000-000000000002','Question A','reading','easy','40000000-0000-0000-0000-000000000002');
insert into public.question_versions(id,question_id,version_no,question_type,prompt_text,created_by) values
('47000000-0000-0000-0000-000000000001','46000000-0000-0000-0000-000000000001',1,'single_choice','你好 nghĩa là gì?','40000000-0000-0000-0000-000000000002');
update public.questions set current_version_id='47000000-0000-0000-0000-000000000001',status='ready' where id='46000000-0000-0000-0000-000000000001';
insert into public.question_options(question_version_id,option_key,content,order_index) values
('47000000-0000-0000-0000-000000000001','1','Xin chào',0),('47000000-0000-0000-0000-000000000001','2','Tạm biệt',1);
insert into public.question_answer_keys(question_version_id,answer_key,created_by) values
('47000000-0000-0000-0000-000000000001','{"value":"1"}','40000000-0000-0000-0000-000000000002');
insert into public.question_sets(id,owner_id,kind,title,status) values
('48000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','exercise','Exercise Set','ready');
insert into public.question_set_versions(id,question_set_id,version_no,title_snapshot,raw_max_score,created_by,locked_at) values
('49000000-0000-0000-0000-000000000001','48000000-0000-0000-0000-000000000001',1,'Exercise Set',10,'40000000-0000-0000-0000-000000000002',now());
update public.question_sets set current_version_id='49000000-0000-0000-0000-000000000001' where id='48000000-0000-0000-0000-000000000001';
insert into public.question_set_items(id,set_version_id,question_version_id,order_index,points) values
('4a000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000001',0,10);
insert into public.exercise_deliveries(id,class_id,set_version_id,title,available_from,due_at,max_score,status,published_at,created_by) values
('4b000000-0000-0000-0000-000000000001','44000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000001','Exercise Delivery',now()-interval '1 hour',now()+interval '1 day',10,'open',now(),'40000000-0000-0000-0000-000000000002');
insert into public.exercise_attempts(id,delivery_id,enrollment_id,attempt_no,status) values
('4c000000-0000-0000-0000-000000000001','4b000000-0000-0000-0000-000000000001','45000000-0000-0000-0000-000000000001',1,'in_progress'),
('4c000000-0000-0000-0000-000000000002','4b000000-0000-0000-0000-000000000001','45000000-0000-0000-0000-000000000002',1,'in_progress');

select lives_ok(
  $$insert into public.exam_deliveries(class_id,set_version_id,title,opens_at,closes_at,duration_minutes,created_by)
    values('44000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000001','Khung 2 ngày','2026-07-25 15:00+00','2026-07-26 16:00+00',45,'40000000-0000-0000-0000-000000000002')$$,
  'DB cho phép khung thi kéo dài nhiều ngày (EX-12 đã đảo)'
);
select throws_ok(
  $$update public.question_versions set prompt_text='Bị sửa' where id='47000000-0000-0000-0000-000000000001'$$,
  'P0001','Phiên bản câu hỏi đã được khóa','question version đã dùng là bất biến'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000004',true);
select is((select count(*)::integer from public.question_answer_keys),0,'student không đọc answer key');
select is((select count(*)::integer from public.exercise_attempts),1,'student A chỉ đọc attempt của mình');
select is((select id from public.exercise_attempts limit 1),'4c000000-0000-0000-0000-000000000001'::uuid,'attempt đọc được đúng của Student A');
select throws_ok(
  $$insert into public.exercise_deliveries(class_id,set_version_id,title,available_from,due_at,max_score,created_by)
    values('44000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000001','Hack',now(),now()+interval '1 day',10,'40000000-0000-0000-0000-000000000004')$$,
  '42501',null,'student không tự tạo delivery'
);
select ok((select public.get_exercise_attempt_payload('4c000000-0000-0000-0000-000000000001')) ? 'items','student nhận payload câu hỏi an toàn');
select ok(not ((select public.get_exercise_attempt_payload('4c000000-0000-0000-0000-000000000001'))::text like '%answer_key%'),'payload student không chứa answer_key');

select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000003',true);
select is((select count(*)::integer from public.exercise_deliveries),0,'Teacher B không đọc delivery lớp A');
select throws_ok($$select public.publish_exercise_delivery('4b000000-0000-0000-0000-000000000001')$$,'P0001',null,'Teacher B không publish lớp A');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select ok(not has_table_privilege('anon','public.exercise_deliveries','SELECT'),'anonymous không có quyền đọc delivery');
select ok(not has_table_privilege('anon','public.questions','SELECT'),'anonymous không có quyền đọc question');

reset role;
select * from finish();
rollback;
