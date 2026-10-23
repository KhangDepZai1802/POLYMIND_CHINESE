create function public.can_manage_b2c_parents() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(app.is_manager() or app.my_b2c_teacher_id() is not null,false)
$$;
revoke all on function public.can_manage_b2c_parents() from public,anon;
grant execute on function public.can_manage_b2c_parents() to authenticated;

do $$ declare d text; begin
 select pg_get_functiondef('public.save_b2c_parent(uuid,text,text,text,text[],text)'::regprocedure) into d;
 if position('app.is_manager()' in d)=0 then raise exception 'Unexpected parent writer'; end if;
 d:=replace(d,'app.is_manager()','public.can_manage_b2c_parents()');
 d:=replace(d,'LANGUAGE plpgsql','LANGUAGE plpgsql SECURITY DEFINER');
 execute d;
 select pg_get_functiondef('public.save_b2c_parent_with_email(jsonb)'::regprocedure) into d;
 if position('app.is_manager()' in d)=0 then raise exception 'Unexpected parent email writer'; end if;
 execute replace(d,'app.is_manager()','public.can_manage_b2c_parents()');
 -- Separate safe teacher projection: no raw-table access to student/enrollment data.
 select pg_get_functiondef('public.get_b2c_parents_page(text,integer)'::regprocedure) into d;
 if position('app.is_manager()' in d)=0 or position('''relationship'',l.relationship' in d)=0 then raise exception 'Unexpected parent list'; end if;
 d:=replace(d,'public.get_b2c_parents_page(','public.read_teacher_b2c_parents_page(');
 d:=replace(d,'STABLE','STABLE SECURITY DEFINER');
 d:=replace(d,'app.is_manager()','public.can_manage_b2c_parents()');
 d:=replace(d,'''relationship'',l.relationship','''relationship'',l.relationship,''classes'',coalesce((select jsonb_agg(jsonb_build_object(''id'',cc.id,''name'',cc.name) order by cc.name,cc.id) from public.b2c_classes cc where exists(select 1 from public.b2c_enrollments ee where ee.class_id=cc.id and ee.student_id=s.id and ee.status in (''studying'',''on_hold'',''awaiting_renewal'',''overdue''))),''[]''::jsonb)');
 execute d;
end $$;
revoke all on function public.read_teacher_b2c_parents_page(text,integer) from public,anon;
grant execute on function public.read_teacher_b2c_parents_page(text,integer) to authenticated;
notify pgrst,'reload schema';
