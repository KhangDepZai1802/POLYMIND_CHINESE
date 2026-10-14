-- Existing teacher profiles remain unset until a manager provides real values.
alter table public.teachers
  add column employment_type text check (employment_type in ('full_time', 'part_time')),
  add column hourly_rate numeric check (hourly_rate >= 0 and hourly_rate <= 999999999999 and hourly_rate = trunc(hourly_rate));

-- Invoker preserves existing account permissions and rolls back the entire edit
-- if a profile contact change is denied. Unchanged contact fields need no write.
create function public.update_teacher_profile(
  p_id uuid, p_full_name text, p_phone text, p_specialization text, p_bio text,
  p_employment_type text, p_hourly_rate numeric
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_user_id uuid;
begin
  if not app.is_manager() then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_full_name is null or char_length(btrim(p_full_name)) < 2 then
    raise exception 'Invalid teacher name' using errcode='22023';
  end if;
  select user_id into v_user_id from public.teachers where id=p_id for update;
  if not found then raise exception 'Teacher not found' using errcode='22023'; end if;
  if exists(select 1 from public.profiles where id=v_user_id and
    (full_name is distinct from btrim(p_full_name) or phone is distinct from p_phone)) then
    if not app.is_super_admin() then raise exception 'Contact changes require super admin' using errcode='42501'; end if;
    update public.profiles set full_name=btrim(p_full_name), phone=p_phone where id=v_user_id;
  end if;
  update public.teachers set specialization=p_specialization, bio=p_bio,
    employment_type=p_employment_type, hourly_rate=p_hourly_rate where id=p_id;
end;
$$;
revoke all on function public.update_teacher_profile(uuid,text,text,text,text,text,numeric) from public, anon;
grant execute on function public.update_teacher_profile(uuid,text,text,text,text,text,numeric) to authenticated;

notify pgrst, 'reload schema';
