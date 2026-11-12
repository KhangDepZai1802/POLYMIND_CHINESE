-- Archived student profiles are hidden from class rosters, so their historical
-- enrollments must not occupy capacity or appear in the recorded class size.
create or replace function app.sync_b2c_class_enrollment_count(p_class_id uuid)
returns void language sql security definer set search_path='' as $$
  update public.b2c_classes c
     set enrolled_count = (
       select count(*)
       from public.b2c_enrollments e
       join public.b2c_students s on s.id = e.student_id
       where e.class_id = c.id
         and s.archived_at is null
         and e.status not in ('withdrawn', 'completed', 'transferred')
     )
   where c.id = p_class_id;
$$;

-- Archiving or restoring a profile also changes each affected class's roster.
create or replace function app.sync_b2c_class_count_after_student_archive()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.archived_at is distinct from old.archived_at then
    perform app.sync_b2c_class_enrollment_count(e.class_id)
    from public.b2c_enrollments e
    where e.student_id = new.id;
  end if;
  return null;
end;
$$;
revoke all on function app.sync_b2c_class_count_after_student_archive() from public, anon, authenticated;

drop trigger if exists b2c_students_sync_class_count_on_archive on public.b2c_students;
create trigger b2c_students_sync_class_count_on_archive
after update of archived_at on public.b2c_students
for each row execute function app.sync_b2c_class_count_after_student_archive();

update public.b2c_classes c
   set enrolled_count = (
     select count(*)
     from public.b2c_enrollments e
     join public.b2c_students s on s.id = e.student_id
     where e.class_id = c.id
       and s.archived_at is null
       and e.status not in ('withdrawn', 'completed', 'transferred')
   )
 where c.enrolled_count is distinct from (
   select count(*)
   from public.b2c_enrollments e
   join public.b2c_students s on s.id = e.student_id
   where e.class_id = c.id
     and s.archived_at is null
     and e.status not in ('withdrawn', 'completed', 'transferred')
 );

notify pgrst, 'reload schema';
