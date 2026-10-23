-- All active, linked B2C teachers can enroll students, including future accounts.
create function public.can_add_b2c_students() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(app.is_manager() or app.my_b2c_teacher_id() is not null,false)
$$;
revoke all on function public.can_add_b2c_students() from public,anon;
grant execute on function public.can_add_b2c_students() to authenticated;

do $$ declare d text; begin
 select pg_get_functiondef('public.add_b2c_class_student(jsonb)'::regprocedure) into d;
 if position('app.is_manager()' in d)=0 then raise exception 'Unexpected enrollment writer'; end if;
 execute replace(d,'app.is_manager()','public.can_add_b2c_students()');
 select pg_get_functiondef('public.find_b2c_enrollment_students(uuid,text,integer)'::regprocedure) into d;
 if position('app.is_manager()' in d)=0 then raise exception 'Unexpected enrollment search'; end if;
 d:=replace(d,'app.is_manager()','public.can_add_b2c_students()');
 -- Return the existing limited student-option projection; no raw-table grants.
 d:=replace(d,'STABLE','STABLE SECURITY DEFINER');
 execute d;
end $$;

create function public.read_b2c_enrollment_classes() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_add_b2c_students() then raise exception 'Không có quyền thêm học viên B2C.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'status',status) order by code,id)
  from public.b2c_classes where status not in ('completed','cancelled')),'[]'::jsonb);
end $$;
revoke all on function public.read_b2c_enrollment_classes() from public,anon;
grant execute on function public.read_b2c_enrollment_classes() to authenticated;
notify pgrst,'reload schema';
