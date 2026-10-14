-- Run in a transaction. Copy only uniquely identified teachers used in B2C.
-- Keep existing source records and all account data intact.
do $$
begin
  if exists (
    select btrim(p.full_name) from public.teachers t join public.profiles p on p.id=t.user_id
    where exists(select 1 from public.b2c_classes c where btrim(c.teacher_name)=btrim(p.full_name))
    group by btrim(p.full_name) having count(*) > 1
  ) then raise exception 'Ambiguous teacher name; review before import'; end if;
  if exists (
    select 1 from public.b2c_teachers b join public.profiles p on btrim(b.full_name)=btrim(p.full_name)
    join public.teachers t on t.user_id=p.id
    where b.source_teacher_id is null and exists(select 1 from public.b2c_classes c where btrim(c.teacher_name)=btrim(p.full_name))
  ) then raise exception 'Existing B2C profile needs explicit source mapping'; end if;
end;
$$;
insert into public.b2c_teachers(source_teacher_id,full_name,phone,email,specialization,employment_type,hourly_rate,created_by)
select t.id,p.full_name,p.phone,p.email,t.specialization,t.employment_type,t.hourly_rate,null
from public.teachers t join public.profiles p on p.id=t.user_id
where exists(select 1 from public.b2c_classes c where btrim(c.teacher_name)=btrim(p.full_name))
on conflict(source_teacher_id) do nothing;
