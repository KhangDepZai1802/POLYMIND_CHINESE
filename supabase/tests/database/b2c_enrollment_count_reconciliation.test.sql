-- The migration test runs inside an enclosing rollback transaction.
insert into public.b2c_classes(id,code,name,program_slug,capacity,enrolled_count)
values ('b2c10000-0000-4000-8000-000000000001','TEST-COUNT-CLASS','TEST COUNT CLASS','tieng-anh',15,9);
insert into public.b2c_students(id,source_key,full_name)
values
  ('b2c10000-0000-4000-8000-000000000011','TEST-COUNT-STUDENT-1','TEST COUNT ONE'),
  ('b2c10000-0000-4000-8000-000000000012','TEST-COUNT-STUDENT-2','TEST COUNT TWO'),
  ('b2c10000-0000-4000-8000-000000000013','TEST-COUNT-STUDENT-3','TEST COUNT THREE');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status)
values
  ('b2c10000-0000-4000-8000-000000000021','TEST-COUNT-ENROLLMENT-1','b2c10000-0000-4000-8000-000000000001','b2c10000-0000-4000-8000-000000000011','studying'),
  ('b2c10000-0000-4000-8000-000000000022','TEST-COUNT-ENROLLMENT-2','b2c10000-0000-4000-8000-000000000001','b2c10000-0000-4000-8000-000000000012','withdrawn'),
  ('b2c10000-0000-4000-8000-000000000023','TEST-COUNT-ENROLLMENT-3','b2c10000-0000-4000-8000-000000000001','b2c10000-0000-4000-8000-000000000013','on_hold');
do $$ begin
  assert (select enrolled_count from public.b2c_classes where id='b2c10000-0000-4000-8000-000000000001') = 2,
    'Existing count is reconciled, terminal enrollments do not occupy a seat, and on-hold enrollments do';
  update public.b2c_enrollments set status='completed' where id='b2c10000-0000-4000-8000-000000000021';
  assert (select enrolled_count from public.b2c_classes where id='b2c10000-0000-4000-8000-000000000001') = 1,
    'Status changes keep the class count synchronized';
end $$;
select 'ok: all B2C class counts reconcile and stay synchronized';
