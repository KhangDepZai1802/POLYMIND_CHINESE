begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_function(
  'public', 'grade_exercise_answers_bulk', array['uuid', 'jsonb'],
  'có RPC lưu toàn bộ điểm bài tập'
);
select has_function(
  'public', 'grade_exam_answers_bulk', array['uuid', 'jsonb'],
  'có RPC lưu toàn bộ điểm kỳ thi'
);
select ok(
  has_function_privilege('authenticated', 'public.grade_exercise_answers_bulk(uuid,jsonb)', 'EXECUTE'),
  'giáo viên đăng nhập có thể lưu nhiều điểm bài tập'
);
select ok(
  has_function_privilege('authenticated', 'public.grade_exam_answers_bulk(uuid,jsonb)', 'EXECUTE'),
  'giáo viên đăng nhập có thể lưu nhiều điểm kỳ thi'
);
select ok(
  not has_function_privilege('anon', 'public.grade_exercise_answers_bulk(uuid,jsonb)', 'EXECUTE'),
  'anonymous không thể chấm bài tập'
);
select ok(
  not has_function_privilege('anon', 'public.grade_exam_answers_bulk(uuid,jsonb)', 'EXECUTE'),
  'anonymous không thể chấm kỳ thi'
);

select * from finish();
rollback;

