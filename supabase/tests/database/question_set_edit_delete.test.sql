-- Regression: clone bộ đã khóa để sửa (migration 58) + xóa/lưu-trữ bộ.
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

-- Bộ đề đã khóa, có 1 section + 1 câu
insert into public.question_sets(id,owner_id,kind,title,status) values
('78000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002','exam','Bộ Set','ready');
insert into public.question_set_versions(id,question_set_id,version_no,title_snapshot,raw_max_score,created_by,locked_at) values
('79000000-0000-0000-0000-000000000001','78000000-0000-0000-0000-000000000001',1,'Bộ Set',10,'70000000-0000-0000-0000-000000000002',now());
update public.question_sets set current_version_id='79000000-0000-0000-0000-000000000001' where id='78000000-0000-0000-0000-000000000001';
insert into public.question_set_sections(id,set_version_id,title,instructions,order_index) values
('7a000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000001','Phần A','Đọc kỹ',0);
insert into public.question_set_items(id,set_version_id,question_version_id,section_id,order_index,points) values
('7b000000-0000-0000-0000-000000000001','79000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000001','7a000000-0000-0000-0000-000000000001',0,10);

set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000002',true);

-- Clone bản đã khóa để chỉnh sửa
select lives_ok(
  $$select public.clone_question_set_for_edit('78000000-0000-0000-0000-000000000001')$$,
  'clone bộ đã khóa tạo bản nháp mới không lỗi'
);
select is(
  (select version_no from public.question_set_versions v
    join public.question_sets s on s.current_version_id=v.id
    where s.id='78000000-0000-0000-0000-000000000001'),
  2,
  'current_version chuyển sang bản 2 (nháp)'
);
select is(
  (select count(*)::integer from public.question_set_items i
    join public.question_sets s on s.current_version_id=i.set_version_id
    where s.id='78000000-0000-0000-0000-000000000001'),
  1,
  'bản nháp mới đã copy 1 câu hỏi'
);
-- Câu trong bản nháp trỏ vào SECTION MỚI (đã ánh xạ lại), không phải section cũ
select isnt(
  (select i.section_id from public.question_set_items i
    join public.question_sets s on s.current_version_id=i.set_version_id
    where s.id='78000000-0000-0000-0000-000000000001'),
  '7a000000-0000-0000-0000-000000000001'::uuid,
  'section của câu trong bản nháp là section mới, không dùng lại id section cũ'
);

-- Bản nháp hiện tại chưa khóa → clone lần nữa phải bị từ chối
select throws_ok(
  $$select public.clone_question_set_for_edit('78000000-0000-0000-0000-000000000001')$$,
  'P0001',null,'không clone khi bản hiện tại đang mở'
);

select * from finish();
rollback;
