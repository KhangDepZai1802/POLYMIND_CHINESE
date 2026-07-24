-- Regression: chấm nốt câu cuối của bài tập ở chế độ trả kết quả `after_graded`
-- phải chạy được, và phải thật sự đóng dấu thời điểm công bố.
--
-- Trước migration 73, `app.release_immediate_exercise_result()` ghi vào cột
-- `result_published_at` trong khi cột thật tên `results_published_at`. PL/pgSQL
-- chỉ phân giải tên cột lúc câu lệnh CHẠY THẬT, mà trigger lại nằm sau hai lớp
-- điều kiện (`status` vừa chuyển sang `graded` **và** delivery đặt
-- `after_graded`), nên không migration nào và không test nào cũ báo đỏ — user
-- gặp lỗi ngay khi bấm "Lưu tất cả điểm đã nhập":
--   column "result_published_at" does not exist
--
-- Bài này lái ĐÚNG luồng đó: giao bài → học viên nộp câu tự luận (bắt buộc chấm
-- tay) → giáo viên chấm hàng loạt. Bài 3 là bài bắt lỗi; bài 4 chặn kiểu "sửa
-- cho hết lỗi nhưng trigger không còn làm gì".
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- --- Fixtures: 1 admin, 1 GV, 1 HV, 1 lớp ---------------------------------
insert into auth.users(id,email) values
('60000000-0000-0000-0000-000000000001','admin.release@test.local'),
('60000000-0000-0000-0000-000000000002','teacher.release@test.local'),
('60000000-0000-0000-0000-000000000004','student.release@test.local');
insert into public.profiles(id,role,full_name) values
('60000000-0000-0000-0000-000000000001','super_admin','Admin Release'),
('60000000-0000-0000-0000-000000000002','teacher','Teacher Release'),
('60000000-0000-0000-0000-000000000004','student','Student Release');
insert into public.teachers(id,user_id,teacher_code) values
('61000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','GV-REL');
insert into public.students(id,user_id,student_code,full_name) values
('62000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000004','HV-REL','Student Release');
insert into public.courses(id,code,title,program,course_type,status,created_by) values
('63000000-0000-0000-0000-000000000001','KH-REL','Course Release','core','custom','active','60000000-0000-0000-0000-000000000001');
insert into public.classes(id,code,course_id,name,capacity,planned_session_count,session_duration_minutes,start_date,delivery_mode,status,created_by) values
('64000000-0000-0000-0000-000000000001','LOP-REL','63000000-0000-0000-0000-000000000001','Class Release',10,10,90,'2026-07-20','offline','planned','60000000-0000-0000-0000-000000000001');
insert into public.class_teachers(class_id,teacher_id) values
('64000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001');
insert into public.enrollments(id,student_id,class_id,status,created_by) values
('65000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','active','60000000-0000-0000-0000-000000000001');

-- Câu TỰ LUẬN: không có khóa đáp án nên buộc phải chấm tay — đó là điều kiện
-- để lượt làm dừng ở `pending_manual_grading` rồi mới chuyển sang `graded`
-- bằng thao tác chấm của giáo viên (chính là lúc trigger chạy).
insert into public.questions(id,code,owner_id,title,skill,difficulty,created_by) values
('66000000-0000-0000-0000-000000000001','CH-REL','60000000-0000-0000-0000-000000000002','Q Release','writing','medium','60000000-0000-0000-0000-000000000002');
insert into public.question_versions(id,question_id,version_no,question_type,prompt_text,created_by) values
('67000000-0000-0000-0000-000000000001','66000000-0000-0000-0000-000000000001',1,'essay_translation','Dịch câu sau sang tiếng Trung.','60000000-0000-0000-0000-000000000002');
update public.questions set current_version_id='67000000-0000-0000-0000-000000000001',status='ready' where id='66000000-0000-0000-0000-000000000001';
-- BẮT BUỘC phải có hàng khóa đáp án, kể cả với câu tự luận: `app.auto_score_answer`
-- lấy `question_type` bằng INNER JOIN sang `question_answer_keys`
-- (`20260717000055_speaking_answer_media.sql:15`). Thiếu hàng này thì truy vấn
-- không trả dòng nào ⇒ `v_type` = NULL ⇒ nhánh "phải chấm tay" không chạy ⇒ bài
-- được chấm tự động thành `graded` NGAY LÚC NỘP. Khi đó bài 3 dưới đây vẫn xanh
-- nhưng XANH VÌ LÝ DO SAI: trigger đã chạy ở bước nộp chứ không phải bước chấm.
insert into public.question_answer_keys(question_version_id,answer_key,created_by) values
('67000000-0000-0000-0000-000000000001','{"rubric":"Chấm tay"}','60000000-0000-0000-0000-000000000002');
insert into public.question_sets(id,owner_id,kind,title,status) values
('68000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','exercise','Set Release','ready');
insert into public.question_set_versions(id,question_set_id,version_no,title_snapshot,raw_max_score,created_by,locked_at) values
('69000000-0000-0000-0000-000000000001','68000000-0000-0000-0000-000000000001',1,'Set Release',10,'60000000-0000-0000-0000-000000000002',now());
update public.question_sets set current_version_id='69000000-0000-0000-0000-000000000001' where id='68000000-0000-0000-0000-000000000001';
insert into public.question_set_items(id,set_version_id,question_version_id,order_index,points) values
('6a000000-0000-0000-0000-000000000001','69000000-0000-0000-0000-000000000001','67000000-0000-0000-0000-000000000001',0,10);

-- === Giáo viên giao bài tập ===============================================
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000002',true);
select public.create_multi_class_exercise_deliveries(
  array['64000000-0000-0000-0000-000000000001']::uuid[],
  '69000000-0000-0000-0000-000000000001','Bài tập Release',
  now()-interval '1 hour', now()+interval '7 day',
  10, 1, false, 0, true);

-- Đặt chế độ trả kết quả TỰ ĐỘNG SAU KHI CHẤM — điều kiện thứ hai của trigger.
-- RPC giao bài không nhận tham số này nên đặt thẳng bằng quyền hệ thống.
reset role;
update public.exercise_deliveries set result_release_mode='after_graded'
where class_id='64000000-0000-0000-0000-000000000001';

select is(
  (select result_release_mode::text from public.exercise_deliveries where class_id='64000000-0000-0000-0000-000000000001'),
  'after_graded',
  'tiền đề: bài tập đặt chế độ trả kết quả tự động sau khi chấm'
);

-- === Học viên nộp bài =====================================================
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000004',true);
do $$
declare v_delivery uuid; v_attempt uuid;
begin
  select id into v_delivery from public.exercise_deliveries where class_id='64000000-0000-0000-0000-000000000001';
  v_attempt := public.start_exercise_attempt(v_delivery);
  perform public.save_exercise_answer(v_attempt,'6a000000-0000-0000-0000-000000000001','{"value":"你好世界"}'::jsonb);
  perform public.submit_exercise_attempt(v_attempt);
end $$;

-- Đo bằng quyền hệ thống: RLS của vai học viên che lượt làm chưa công bố kết
-- quả, đo ở vai đó thì câu này trả NULL và tiền đề thành vô nghĩa.
reset role;
select is(
  (select status::text from public.exercise_attempts where enrollment_id='65000000-0000-0000-0000-000000000001'),
  'pending_manual_grading',
  'tiền đề: câu tự luận giữ lượt làm ở trạng thái chờ chấm tay'
);

-- === Giáo viên bấm "Lưu tất cả điểm đã nhập" ===============================
-- Đây là câu bắt lỗi. Chấm nốt câu cuối ⇒ `pending = 0` ⇒ status sang `graded`
-- ⇒ trigger `trg_exercise_result_immediate` chạy lần đầu tiên trong đời.
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000002',true);
select lives_ok(
  $$do $inner$
    declare v_delivery uuid; v_answer uuid;
    begin
      select id into v_delivery from public.exercise_deliveries where class_id='64000000-0000-0000-0000-000000000001';
      select a.id into v_answer from public.exercise_answers a
        join public.exercise_attempts ea on ea.id=a.attempt_id
        where ea.delivery_id=v_delivery;
      perform public.grade_exercise_answers_bulk(
        v_delivery,
        jsonb_build_array(jsonb_build_object('answer_id',v_answer,'score',8))
      );
    end $inner$;$$,
  'lưu tất cả điểm đã chấm không còn lỗi cột result_published_at'
);

-- Không chỉ "hết lỗi": trigger phải THẬT SỰ đóng dấu thời điểm công bố. Thiếu
-- bài này thì xoá rỗng thân trigger cũng làm bài 3 xanh.
reset role;
select isnt(
  (select results_published_at from public.exercise_attempts where enrollment_id='65000000-0000-0000-0000-000000000001'),
  null,
  'trigger đóng dấu results_published_at cho lượt làm vừa chấm xong'
);

-- Hồi quy thứ hai của migration 50: khối gửi thông báo bị đánh rơi, khiến
-- `after_graded` là chế độ trả kết quả duy nhất im lặng.
select is(
  (select count(*)::integer from public.notifications
   where user_id='60000000-0000-0000-0000-000000000004' and type='exercise_result_published'),
  1,
  'học viên nhận đúng MỘT thông báo kết quả bài tập'
);

-- Chấm lại cùng câu đó lần nữa: chống trùng nằm ở unique index của DB
-- (`BUG_M09_01`), không phải ở tầng ứng dụng — nên số thông báo vẫn là 1.
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000002',true);
do $$
declare v_delivery uuid; v_answer uuid;
begin
  select id into v_delivery from public.exercise_deliveries where class_id='64000000-0000-0000-0000-000000000001';
  select a.id into v_answer from public.exercise_answers a
    join public.exercise_attempts ea on ea.id=a.attempt_id
    where ea.delivery_id=v_delivery;
  perform public.grade_exercise_answers_bulk(
    v_delivery, jsonb_build_array(jsonb_build_object('answer_id',v_answer,'score',9)));
end $$;
reset role;
select is(
  (select count(*)::integer from public.notifications
   where user_id='60000000-0000-0000-0000-000000000004' and type='exercise_result_published'),
  1,
  'chấm lại lần nữa không sinh thêm thông báo trùng'
);

select * from finish();
rollback;
