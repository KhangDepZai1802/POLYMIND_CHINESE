-- `enrolled_count` is a projection of open B2C enrollments.  Keep it derived
-- in the database so every writer (manager and teacher flows) remains consistent.
create or replace function app.sync_b2c_class_enrollment_count(p_class_id uuid)
returns void language sql security definer set search_path='' as $$
  update public.b2c_classes c
     set enrolled_count = (
       select count(*)
       from public.b2c_enrollments e
       where e.class_id = c.id
         and e.status not in ('withdrawn', 'completed', 'transferred')
     )
   where c.id = p_class_id;
$$;
revoke all on function app.sync_b2c_class_enrollment_count(uuid) from public, anon, authenticated;

create or replace function app.sync_b2c_class_enrollment_count_after_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'INSERT' then
    perform app.sync_b2c_class_enrollment_count(new.class_id);
  elsif tg_op = 'DELETE' then
    perform app.sync_b2c_class_enrollment_count(old.class_id);
  elsif new.class_id is distinct from old.class_id then
    perform app.sync_b2c_class_enrollment_count(old.class_id);
    perform app.sync_b2c_class_enrollment_count(new.class_id);
  elsif new.status is distinct from old.status then
    perform app.sync_b2c_class_enrollment_count(new.class_id);
  end if;
  return null;
end;
$$;
revoke all on function app.sync_b2c_class_enrollment_count_after_change() from public, anon, authenticated;

drop trigger if exists b2c_enrollments_sync_class_count on public.b2c_enrollments;
create trigger b2c_enrollments_sync_class_count
after insert or update of class_id, status or delete on public.b2c_enrollments
for each row execute function app.sync_b2c_class_enrollment_count_after_change();

-- Repair every pre-existing class, including those not currently visible to a
-- particular teacher.  `on_hold` still retains a seat; only terminal statuses do not.
update public.b2c_classes c
   set enrolled_count = (
     select count(*)
     from public.b2c_enrollments e
     where e.class_id = c.id
       and e.status not in ('withdrawn', 'completed', 'transferred')
   )
 where c.enrolled_count is distinct from (
   select count(*)
   from public.b2c_enrollments e
   where e.class_id = c.id
     and e.status not in ('withdrawn', 'completed', 'transferred')
 );

notify pgrst, 'reload schema';
