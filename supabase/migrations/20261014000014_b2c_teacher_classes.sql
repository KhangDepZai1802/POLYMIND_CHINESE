-- Stable assignment identity: names are only resolved on initial import/name change.
alter table public.b2c_classes add column teacher_id uuid references public.b2c_teachers(id) on delete restrict;
create index b2c_classes_teacher_idx on public.b2c_classes(teacher_id,id);
update public.b2c_classes c set teacher_id=t.id from public.b2c_teachers t
where lower(btrim(c.teacher_name))=lower(btrim(t.full_name))
and (select count(*) from public.b2c_teachers x where lower(btrim(x.full_name))=lower(btrim(c.teacher_name)))=1;
create function app.resolve_b2c_class_teacher() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.teacher_name is distinct from old.teacher_name then
  new.teacher_id:=null;
  select t.id into new.teacher_id from public.b2c_teachers t
  where lower(btrim(t.full_name))=lower(btrim(new.teacher_name))
  and (select count(*) from public.b2c_teachers x where lower(btrim(x.full_name))=lower(btrim(new.teacher_name)))=1;
 end if;
 return new;
end $$;
revoke all on function app.resolve_b2c_class_teacher() from public,anon,authenticated;
create trigger resolve_b2c_class_teacher before insert or update of teacher_name on public.b2c_classes for each row execute function app.resolve_b2c_class_teacher();

create function app.teaches_b2c_class(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.b2c_classes c
 join public.b2c_teachers b on b.id=c.teacher_id
 join public.teachers t on t.id=b.source_teacher_id
 join public.profiles p on p.id=t.user_id
 where c.id=p_id and p.id=auth.uid() and p.is_active and t.is_active and p.role in ('teacher','academic_manager'));
$$;
revoke all on function app.teaches_b2c_class(uuid) from public,anon,authenticated;

-- Deliberate minimal projection. Raw B2C tables remain manager-only under RLS.
create function public.read_my_b2c_classes(p_class_id uuid default null,p_tab text default 'students',p_page integer default 0,p_query text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;v_total integer;v_class jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('teacher','academic_manager')) then
  raise exception 'Không có quyền giáo viên.' using errcode='42501';
 end if;
 if p_page is null or p_page<0 or p_page>1000000 or length(coalesce(p_query,''))>200 then raise exception 'Bộ lọc không hợp lệ.'; end if;
 if p_class_id is null then
  select coalesce(jsonb_agg(to_jsonb(r) order by r.code),'[]'::jsonb) into v_rows from (
   select c.id,c.code,c.name,c.program_slug,c.status,c.capacity,c.weekdays_text,c.time_text,c.campus,c.start_date,
    (select count(*) from public.b2c_enrollments e where e.class_id=c.id) as student_count
   from public.b2c_classes c where app.teaches_b2c_class(c.id)
  ) r;
  return jsonb_build_object('rows',v_rows,'total',jsonb_array_length(v_rows));
 end if;
 if not app.teaches_b2c_class(p_class_id) then raise exception 'Bạn không được phân công lớp này.' using errcode='42501'; end if;
 select jsonb_build_object('id',id,'code',code,'name',name,'program_slug',program_slug,'status',status,'capacity',capacity,'weekdays_text',weekdays_text,'time_text',time_text,'campus',campus,'start_date',start_date) into v_class from public.b2c_classes where id=p_class_id;
 if p_tab='students' then
  with filtered as (
   select s.code,s.full_name,e.status,e.enrollment_date from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id
   where e.class_id=p_class_id and strpos(lower(s.code||' '||s.full_name),lower(coalesce(p_query,'')))>0
  ) select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(r) order by r.code) from (select * from filtered order by code limit 25 offset p_page::bigint*25) r),'[]'::jsonb) into v_total,v_rows;
 elsif p_tab='schedule' then
  select count(*) into v_total from public.b2c_class_meetings where class_id=p_class_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.starts_at desc,r.id),'[]'::jsonb) into v_rows from (
   select id,starts_at,ends_at,status,teacher_name from public.b2c_class_meetings where class_id=p_class_id order by starts_at desc,id limit 25 offset p_page::bigint*25
  ) r;
 elsif p_tab='comments' then
  select count(*) into v_total from public.b2c_student_comments where class_id=p_class_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]'::jsonb) into v_rows from (
   select n.id,s.code,s.full_name,n.content,n.actor_name,n.created_at from public.b2c_student_comments n join public.b2c_enrollments e on e.id=n.enrollment_id join public.b2c_students s on s.id=e.student_id
   where n.class_id=p_class_id order by n.created_at desc,n.id limit 25 offset p_page::bigint*25
  ) r;
 else raise exception 'Mục không hợp lệ.'; end if;
 return jsonb_build_object('class',v_class,'rows',v_rows,'total',v_total);
end $$;
revoke all on function public.read_my_b2c_classes(uuid,text,integer,text) from public,anon;
grant execute on function public.read_my_b2c_classes(uuid,text,integer,text) to authenticated;
notify pgrst,'reload schema';
