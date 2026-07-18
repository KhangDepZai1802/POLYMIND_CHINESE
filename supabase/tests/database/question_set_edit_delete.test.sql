-- Regression: "Chỉnh sửa" bộ đã khóa = MỞ KHÓA sửa tại chỗ (migration 59).
-- Mở khóa được khi chưa có ai làm bài; sửa được item sau khi mở; chặn khi đã có
-- học viên làm bài.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users(id,email) values
('70000000-0000-0000-0000-000000000001','admin.set@test.local'),
('70000000-0000-0000-0000-000000000002','teacher.set@test.local'),
('70000000-0000-0000-0000-000000000004','student.set@test.local');
insert into public.profiles(id,role,full_name) values
('70000000-0000-0000-0000-000000000001','super_admin','Admin Set'),
('70000000-0000-0000-0000-000000000002','teacher','Teacher Set'),
('70000000-0000-0000-0000-000000000004','student','Student Set');
insert into public.teachers(id,user_id,teacher_code) values
('71000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002','GV-SET');
insert into public.students(id,user_id,student_code,full_name) values
('72000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000004','HV-SET','Student Set');
insert into public.courses(id,code,title,program,course_type,status,created_by) values
('73000000-0000-0000-0000-000000000001','KH-SET','Course Set','core','custom','active','70000000-0000-0000-0000-000000000001');
insert into public.classes(id,code,course_id,name,capacity,planned_session_count,session_duration_minutes,start_date,delivery_mode,status,created_by) values
('74000000-0000-0000-0000-000000000001','LOP-SET','73000000-0000-0000-0000-000000000001','Class Set',10,10,90,'2026-07-20','offline','planned','70000000-0000-0000-0000-000000000001');
insert into public.class_teachers(class_id,teacher_id) values
('74000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001');
insert into public.enrollments(id,student_id,class_id,status,created_by) values
('75000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001','active','70000000-0000-0000-0000-000000000001');
insert into public.questions(id,code,owner_id,title,skill,difficulty,created_by) values
('76000000-0000-0000-0000-000000000001','CH-SET','70000000-0000-0000-0000-000000000002','Q Set','reading','easy','70000000-0000-0000-0000-000000000002');
insert into public.question_versions(id,question_id,version_no,question_type,prompt_text,created_by) values
('77000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000001',1,'single_choice','你好?','70000000-0000-0000-0000-000000000002');
update public.questions set current_version_id='77000000-0000-0000-0000-000000000001',status='ready' where id='76000000-0000-0000-0000-000000000001';
insert into public.question_answer_keys(question_version_id,answer_key,created_by) values
('77000000-0000-0000-0000-000000000001','{"value":"1"}','70000000-0000-0000-0000-000000000002');

-- Set A: đã khóa, CHƯA giao → mở khóa được
insert into public.question_sets(id,owner_id,kind,title,status) values
('78000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002','exam','Bộ A','ready');
insert into public.question_set_versions(id,question_set_id,version_no,title_snapshot,raw_max_score,created_by,locked_at) values
('79000000-0000-0000-0000-000000000001','78000000-0000-0000-0000-000000000001',1,'Bộ A',10,'70000000-0000-0000-0000-000000000002',now());
update public.question_sets set current_version_id='79000000-0000-0000-0000-000000000001' where id='78000000-0000-0000-0000-000000000001';
insert into public.question_set_sections(id,set_version_id,title,instructions,order_index) values
('7a000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000001','Phần A','Đọc kỹ',0);
insert into public.question_set_items(id,set_version_id,question_version_id,section_id,order_index,points) values
('7b000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000001','7a000000-0000-0000-0000-000000000001',0,10);

-- Set B: đã khóa, ĐÃ giao + có lượt thi → KHÔNG được mở khóa
insert into public.question_sets(id,owner_id,kind,title,status) values
('78000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000002','exam','Bộ B','ready');
insert into public.question_set_versions(id,question_set_id,version_no,title_snapshot,raw_max_score,created_by,locked_at) values
('79000000-0000-0000-0000-000000000002','78000000-0000-0000-0000-000000000002',1,'Bộ B',10,'70000000-0000-0000-0000-000000000002',now());
update public.question_sets set current_version_id='79000000-0000-0000-0000-000000000002' where id='78000000-0000-0000-0000-000000000002';
insert into public.question_set_items(id,set_version_id,question_version_id,order_index,points) values
('7b000000-0000-0000-0000-000000000002','79000000-0000-0000-0000-000000000002','77000000-0000-0000-0000-000000000001',0,10);
insert into public.exam_deliveries(id,class_id,set_version_id,title,opens_at,closes_at,duration_minutes,status,published_at,created_by) values
('7c000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000002','Thi B',now()-interval '1 hour',now()+interval '1 hour',60,'open',now(),'70000000-0000-0000-0000-000000000002');
insert into public.exam_attempts(id,exam_delivery_id,enrollment_id,status,started_at,deadline_at) values
('7d000000-0000-0000-0000-000000000002','7c000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000001','in_progress',now(),now()+interval '1 hour');

set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000002',true);

-- Mở khóa Set A (chưa ai làm)
select lives_ok(
  $$select public.unlock_question_set_for_edit('78000000-0000-0000-0000-000000000001')$$,
  'mở khóa bộ chưa giao để chỉnh sửa không lỗi'
);
select is(
  (select locked_at from public.question_set_versions where id='79000000-0000-0000-0000-000000000001'),
  null,
  'bản đã trở về trạng thái mở (locked_at null)'
);
select is(
  (select status from public.question_sets where id='78000000-0000-0000-0000-000000000001'),
  'draft',
  'bộ trở về draft để sửa tiếp'
);
-- Sau khi mở khóa, sửa câu (đổi điểm) phải chạy được (trước đó trigger chặn)
select lives_ok(
  $$update public.question_set_items set points=5 where id='7b000000-0000-0000-0000-000000000001'$$,
  'sửa được câu trong bộ sau khi mở khóa'
);

-- Set B đã có học viên làm bài → mở khóa bị chặn
select throws_ok(
  $$select public.unlock_question_set_for_edit('78000000-0000-0000-0000-000000000002')$$,
  'P0001',null,'không mở khóa khi đã có học viên làm bài'
);

select * from finish();
rollback;
