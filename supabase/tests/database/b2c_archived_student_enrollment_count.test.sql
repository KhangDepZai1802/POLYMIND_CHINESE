-- The migration test runs inside an enclosing rollback transaction.
insert into public.b2c_classes(id,code,name,program_slug,capacity,enrolled_count)
values ('b2c20000-0000-4000-8000-000000000001','TEST-ARCHIVE-COUNT','TEST ARCHIVE COUNT','tieng-anh',15,2);
insert into public.b2c_students(id,source_key,full_name,archived_at)
values
  ('b2c20000-0000-4000-8000-000000000011','TEST-ARCHIVE-COUNT-1','TEST ACTIVE STUDENT',null),
  ('b2c20000-0000-4000-8000-000000000012','TEST-ARCHIVE-COUNT-2','TEST ARCHIVED STUDENT',null);
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status)
values
  ('b2c20000-0000-4000-8000-000000000021','TEST-ARCHIVE-ENROLLMENT-1','b2c20000-0000-4000-8000-000000000001','b2c20000-0000-4000-8000-000000000011','studying'),
  ('b2c20000-0000-4000-8000-000000000022','TEST-ARCHIVE-ENROLLMENT-2','b2c20000-0000-4000-8000-000000000001','b2c20000-0000-4000-8000-000000000012','studying');
do $$ begin
  assert (select enrolled_count from public.b2c_classes where id='b2c20000-0000-4000-8000-000000000001') = 2,
    'Active student enrollments occupy class seats';
  update public.b2c_students set archived_at=clock_timestamp() where id='b2c20000-0000-4000-8000-000000000012';
  assert (select enrolled_count from public.b2c_classes where id='b2c20000-0000-4000-8000-000000000001') = 1,
    'Archived student enrollments do not occupy a class seat';
  update public.b2c_students set archived_at=clock_timestamp() where id='b2c20000-0000-4000-8000-000000000011';
  assert (select enrolled_count from public.b2c_classes where id='b2c20000-0000-4000-8000-000000000001') = 0,
    'Archiving a student synchronizes each class count';
end $$;
select 'ok: archived students are excluded from B2C class counts';
