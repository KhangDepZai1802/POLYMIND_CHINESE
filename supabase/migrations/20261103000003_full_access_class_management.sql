create table public.b2c_full_access_teachers (
 teacher_id uuid primary key references public.b2c_teachers(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.b2c_full_access_teachers enable row level security;
revoke all on public.b2c_full_access_teachers from public,anon,authenticated;

do $$
declare matched integer;
begin
 select count(*) into matched from public.b2c_teachers b
 join public.teachers t on t.id=b.source_teacher_id join public.profiles p on p.id=t.user_id
 where b.full_name in ('Cô Lê','Cô Thy') and p.full_name=b.full_name and p.is_active and t.is_active and p.role='teacher';
 if matched<>2 then raise exception 'Không xác định đúng hai tài khoản Cô Lê/Cô Thy.'; end if;
 insert into public.b2c_full_access_teachers(teacher_id)
 select b.id from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id join public.profiles p on p.id=t.user_id
 where b.full_name in ('Cô Lê','Cô Thy') and p.full_name=b.full_name and p.is_active and t.is_active and p.role='teacher';
 insert into public.b2c_teacher_permissions(teacher_id,permissions,updated_by)
 select f.teacher_id,array[
  'delete_center_records','manage_center_student_data','manage_center_tuition','manage_admissions','view_classes','view_students',
  'view_assessments','grade_assessments','view_schedule','view_comments','write_comments','share_monthly_comments','mark_attendance',
  'check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition'
 ]::text[],(select id from public.profiles where role='super_admin' and is_active order by created_at limit 1)
 from public.b2c_full_access_teachers f
 on conflict(teacher_id) do update set permissions=excluded.permissions,updated_at=clock_timestamp();
end $$;

create or replace function app.has_b2c_permission(p_key text,p_class uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(p_key=any(array['delete_center_records','manage_center_student_data','manage_center_tuition','manage_admissions','view_classes','view_students','view_assessments','grade_assessments','view_schedule','view_comments','write_comments','share_monthly_comments','mark_attendance','check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition']) and
 (app.is_manager() or exists(select 1 from public.b2c_full_access_teachers where teacher_id=app.my_b2c_teacher_id()) or
  (p_key=any(public.get_my_b2c_permissions()) and (p_class is null or app.teaches_b2c_class(p_class)))),false)
$$;

create function public.read_b2c_class_teacher_options() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.b2c_full_access_teachers where teacher_id=app.my_b2c_teacher_id()) and not app.is_manager() then raise exception 'Không có quyền phân công giáo viên.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'full_name',b.full_name) order by b.full_name,b.id)
  from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id join public.profiles p on p.id=t.user_id
  where p.is_active and t.is_active and p.role in ('teacher','academic_manager')),'[]'::jsonb);
end $$;

create function public.assign_b2c_class_teacher(p_class_id uuid,p_teacher_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.b2c_classes; v_name text;
begin
 if not exists(select 1 from public.b2c_full_access_teachers where teacher_id=app.my_b2c_teacher_id()) and not app.is_manager() then raise exception 'Không có quyền phân công giáo viên.' using errcode='42501'; end if;
 select * into c from public.b2c_classes where id=p_class_id for update;
 if not found then raise exception 'Không tìm thấy lớp.' using errcode='22023'; end if;
 select b.full_name into v_name from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id join public.profiles p on p.id=t.user_id
 where b.id=p_teacher_id and p.is_active and t.is_active and p.role in ('teacher','academic_manager');
 if v_name is null then raise exception 'Giáo viên không hợp lệ.' using errcode='22023'; end if;
 update public.b2c_classes set teacher_id=p_teacher_id,teacher_name=v_name where id=p_class_id;
 insert into public.b2c_class_history(class_id,action,before_data,after_data,actor_id,actor_name)
 values(p_class_id,'assign_teacher',jsonb_build_object('teacher_id',c.teacher_id,'teacher_name',c.teacher_name),jsonb_build_object('teacher_id',p_teacher_id,'teacher_name',v_name),auth.uid(),(select full_name from public.profiles where id=auth.uid()));
end $$;
revoke all on function public.read_b2c_class_teacher_options(),public.assign_b2c_class_teacher(uuid,uuid) from public,anon;
grant execute on function public.read_b2c_class_teacher_options(),public.assign_b2c_class_teacher(uuid,uuid) to authenticated;

do $$ declare d text; begin
 d:=pg_get_functiondef('public.read_teacher_b2c_class_edit(uuid)'::regprocedure);
 if position('''updated_at'',updated_at' in d)=0 then raise exception 'Unexpected class editor'; end if;
 execute replace(d,'''updated_at'',updated_at','''updated_at'',updated_at,''teacher_id'',teacher_id');
end $$;
notify pgrst,'reload schema';
