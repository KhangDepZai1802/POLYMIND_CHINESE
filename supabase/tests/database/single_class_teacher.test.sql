begin;

select plan(5);

select hasnt_column(
  'public', 'class_teachers', 'assignment_role',
  'class_teachers không còn cột vai trò'
);

select is(
  to_regtype('public.assignment_role'),
  null::regtype,
  'enum assignment_role đã bị loại'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.class_teachers'::regclass
      and conname = 'uq_class_teachers_one_teacher'
  ),
  'DB có unique constraint một giáo viên mỗi lớp'
);

select ok(
  not exists (
    select class_id from public.class_teachers group by class_id having count(*) > 1
  ),
  'không còn lớp có nhiều phân công'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'prevent_active_class_teacher_removal'
  ),
  'có chốt chặn không gỡ giáo viên khỏi lớp active'
);

select * from finish();
rollback;
