-- Regression: RPC đánh giá gán cột enum `status` bằng CASE phải chạy được.
--
-- Trước migration 56, `set status = case when ... then 'x' else 'y' end` (mọi
-- nhánh là literal unknown) giải kiểu thành text → lỗi khi gán vào cột enum:
--   column "status" is of type ... but expression is of type text
-- Bug user gặp khi "giao bài tập". Test này lái luồng thật của cả 5 hàm dính lỗi.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- --- Fixtures: 1 admin, 1 GV, 1 HV, 1 lớp; 1 bộ bài tập + 1 bộ đề đã khóa ---
insert into auth.users(id,email) values
('50000000-0000-0000-0000-000000000001','admin.case@test.local'),
('50000000-0000-0000-0000-000000000002','teacher.case@test.local'),
('50000000-0000-0000-0000-000000000004','student.case@test.local');
insert into public.profiles(id,role,full_name) values
('50000000-0000-0000-0000-000000000001','super_admin','Admin Case'),
('50000000-0000-0000-0000-000000000002','teacher','Teacher Case'),
('50000000-0000-0000-0000-000000000004','student','Student Case');
insert into public.teachers(id,user_id,teacher_code) values
('51000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','GV-CASE');
insert into public.students(id,user_id,student_code,full_name) values
('52000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000004','HV-CASE','Student Case');
insert into public.courses(id,code,title,program,course_type,status,created_by) values
('53000000-0000-0000-0000-000000000001','KH-CASE','Course Case','core','custom','active','50000000-0000-0000-0000-000000000001');
insert into public.classes(id,code,course_id,name,capacity,planned_session_count,session_duration_minutes,start_date,delivery_mode,status,created_by) values
('54000000-0000-0000-0000-000000000001','LOP-CASE','53000000-0000-0000-0000-000000000001','Class Case',10,10,90,'2026-07-20','offline','planned','50000000-0000-0000-0000-000000000001'),
('54000000-0000-0000-0000-000000000002','LOP-CASE-2','53000000-0000-0000-0000-000000000001','Class Case 2',10,10,90,'2026-07-20','offline','planned','50000000-0000-0000-0000-000000000001');
insert into public.class_teachers(class_id,teacher_id) values
('54000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001'),
('54000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000001');
insert into public.enrollments(id,student_id,class_id,status,created_by) values
('55000000-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','active','50000000-0000-0000-0000-000000000001');
-- Câu hỏi trắc nghiệm 1 đáp án (chấm tự động → status 'graded' khi nộp)
insert into public.questions(id,code,owner_id,title,skill,difficulty,created_by) values
('56000000-0000-0000-0000-000000000001','CH-CASE','50000000-0000-0000-0000-000000000002','Q Case','reading','easy','50000000-0000-0000-0000-000000000002');
insert into public.question_versions(id,question_id,version_no,question_type,prompt_text,created_by) values
('57000000-0000-0000-0000-000000000001','56000000-0000-0000-0000-000000000001',1,'single_choice','你好?','50000000-0000-0000-0000-000000000002');
update public.questions set current_version_id='57000000-0000-0000-0000-000000000001',status='ready' where id='56000000-0000-0000-0000-000000000001';
insert into public.question_options(question_version_id,option_key,content,order_index) values
('57000000-0000-0000-0000-000000000001','1','Xin chào',0),('57000000-0000-0000-0000-000000000001','2','Tạm biệt',1);
insert into public.question_answer_keys(question_version_id,answer_key,created_by) values
('57000000-0000-0000-0000-000000000001','{"value":"1"}','50000000-0000-0000-0000-000000000002');
-- Bộ bài tập đã khóa
insert into public.question_sets(id,owner_id,kind,title,status) values
('58000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','exercise','Set Case Exercise','ready');
insert into public.question_set_versions(id,question_set_id,version_no,title_snapshot,raw_max_score,created_by,locked_at) values
('59000000-0000-0000-0000-000000000001','58000000-0000-0000-0000-000000000001',1,'Set Case Exercise',10,'50000000-0000-0000-0000-000000000002',now());
update public.question_sets set current_version_id='59000000-0000-0000-0000-000000000001' where id='58000000-0000-0000-0000-000000000001';
insert into public.question_set_items(id,set_version_id,question_version_id,order_index,points) values
('5a000000-0000-0000-0000-000000000001','59000000-0000-0000-0000-000000000001','57000000-0000-0000-0000-000000000001',0,10);
-- Bộ đề thi đã khóa
insert into public.question_sets(id,owner_id,kind,title,status) values
('58000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','exam','Set Case Exam','ready');
insert into public.question_set_versions(id,question_set_id,version_no,title_snapshot,raw_max_score,created_by,locked_at) values
('59000000-0000-0000-0000-000000000002','58000000-0000-0000-0000-000000000002',1,'Set Case Exam',10,'50000000-0000-0000-0000-000000000002',now());
update public.question_sets set current_version_id='59000000-0000-0000-0000-000000000002' where id='58000000-0000-0000-0000-000000000002';
insert into public.question_set_items(id,set_version_id,question_version_id,order_index,points) values
('5a000000-0000-0000-0000-000000000002','59000000-0000-0000-0000-000000000002','57000000-0000-0000-0000-000000000001',0,10);

-- === Giáo viên giao bài tập (luồng user báo lỗi) ============================
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);

-- create_multi_class_exercise_deliveries → create_exercise_delivery + publish_exercise_delivery
select lives_ok(
  $$select public.create_multi_class_exercise_deliveries(
      array['54000000-0000-0000-0000-000000000001']::uuid[],
      '59000000-0000-0000-0000-000000000001', 'Bài tập Case',
      now()-interval '1 hour', now()+interval '7 day',
      10, 1, false, 0, true)$$,
  'giao bài tập (publish_exercise_delivery) không còn lỗi enum/text'
);
select is(
  (select status::text from public.exercise_deliveries where class_id='54000000-0000-0000-0000-000000000001' order by created_at desc limit 1),
  'open',
  'delivery được publish sang trạng thái open'
);

-- Giáo viên lên lịch thi (publish_exam_delivery dùng literal — kiểm luôn cho chắc)
select lives_ok(
  $$select public.create_multi_class_exam_deliveries(
      array['54000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000002']::uuid[],
      '59000000-0000-0000-0000-000000000002','Thi Case','final',
      now()-interval '1 hour',now()+interval '1 hour',60,50,'with_results',true)$$,
  'lên lịch + publish bài thi nhiều lớp chạy được trong một RPC'
);
select is(
  (select count(*)::integer from public.exam_deliveries where title='Thi Case'),
  2,
  'mỗi lớp được tạo đúng một kỳ thi riêng'
);
select is(
  (select count(*)::integer from public.exam_deliveries where title='Thi Case' and status='scheduled' and answer_release_mode='with_results'),
  2,
  'cấu hình và trạng thái publish đồng bộ cho mọi lớp'
);

-- === Học viên nộp bài tập (submit_exercise_attempt) =========================
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000004',true);
select lives_ok(
  $$do $inner$
    declare v_delivery uuid; v_attempt uuid;
    begin
      select id into v_delivery from public.exercise_deliveries where class_id='54000000-0000-0000-0000-000000000001' order by created_at desc limit 1;
      v_attempt := public.start_exercise_attempt(v_delivery);
      perform public.save_exercise_answer(v_attempt,'5a000000-0000-0000-0000-000000000001','{"value":"1"}'::jsonb);
      perform public.submit_exercise_attempt(v_attempt);
    end $inner$;$$,
  'học viên nộp bài tập (submit_exercise_attempt) không còn lỗi enum/text'
);

-- === Học viên nộp bài thi (submit_exam_attempt) =============================
select lives_ok(
  $$do $inner$
    declare v_exam uuid; v_attempt uuid;
    begin
      select id into v_exam from public.exam_deliveries where class_id='54000000-0000-0000-0000-000000000001' order by created_at desc limit 1;
      update public.exam_deliveries set status='open' where id=v_exam;
      select attempt_id into v_attempt from public.start_exam_attempt(v_exam);
      perform public.save_exam_answer(v_attempt,'5a000000-0000-0000-0000-000000000002','{"value":"1"}'::jsonb);
      perform public.submit_exam_attempt(v_attempt,'manual');
    end $inner$;$$,
  'học viên nộp bài thi (submit_exam_attempt) không còn lỗi enum/text'
);

-- === Tính lại điểm thi (app.recalculate_exam_attempt) =======================
-- Gọi trực tiếp bằng quyền hệ thống để phủ nhánh CASE gán status của hàm này.
reset role;
select lives_ok(
  $$do $inner$
    declare v_attempt uuid;
    begin
      select ea.id into v_attempt from public.exam_attempts ea
        join public.exam_deliveries d on d.id=ea.exam_delivery_id
        where d.class_id='54000000-0000-0000-0000-000000000001' limit 1;
      perform app.recalculate_exam_attempt(v_attempt);
    end $inner$;$$,
  'tính lại điểm thi (recalculate_exam_attempt) không còn lỗi enum/text'
);

select * from finish();
rollback;
