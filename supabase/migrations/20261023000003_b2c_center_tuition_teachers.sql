-- Explicit global tuition scope, independent of teaching assignments.
alter table public.b2c_teacher_permissions drop constraint known_b2c_permissions;
alter table public.b2c_teacher_permissions add constraint known_b2c_permissions check(permissions <@ array['view_classes','view_students','view_schedule','view_comments','write_comments','mark_attendance','check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition','view_assessments','grade_assessments','share_monthly_comments','manage_admissions','manage_center_tuition']::text[]);
do $$ declare d text; begin
 select pg_get_functiondef('app.has_b2c_permission(text,uuid)'::regprocedure) into d;
 if position('''manage_admissions''' in d)=0 or position('(p_class is null or app.teaches_b2c_class(p_class))' in d)=0 then raise exception 'Unexpected permission definition'; end if;
 d:=replace(d,'''manage_admissions''','''manage_admissions'',''manage_center_tuition''');
 d:=replace(d,'(p_class is null or app.teaches_b2c_class(p_class))','(p_class is null or app.teaches_b2c_class(p_class) or (p_key in (''view_tuition'',''edit_tuition'',''collect_tuition'') and ''manage_center_tuition''=any(public.get_my_b2c_permissions())))');
 execute d;
 select pg_get_functiondef('public.save_b2c_teacher_permissions(uuid,uuid,text[],timestamptz)'::regprocedure) into d;
 if position('''manage_admissions'']' in d)=0 then raise exception 'Unexpected permission editor definition'; end if;
 d:=replace(d,'''manage_admissions'']','''manage_admissions'',''manage_center_tuition'']');
 d:=replace(d,'"view_students":["view_classes"]','"manage_center_tuition":["view_tuition","edit_tuition","collect_tuition"],"view_students":["view_classes"]');
 execute d;
 -- Reuse the effective-balance projection, with a dedicated guard and limited fields.
 select pg_get_functiondef('public.get_b2c_tuition_page(text,integer)'::regprocedure) into d;
 if position('e.id as enrollment_id,' in d)=0 or position('app.is_manager()' in d)=0 or position('sum(effective_amount)' in d)=0 then raise exception 'Unexpected tuition projection'; end if;
 d:=replace(d,'public.get_b2c_tuition_page(', 'public.read_center_b2c_tuition_page(');
 d:=replace(d,'STABLE','STABLE SECURITY DEFINER');
 d:=replace(d,'app.is_manager()','app.has_b2c_permission(''manage_center_tuition'')');
 d:=replace(d,'e.id as enrollment_id,','e.id as enrollment_id,e.class_id,e.enrollment_date,e.tuition_end_date,e.status,');
 execute d;
end $$;
revoke all on function public.read_center_b2c_tuition_page(text,integer) from public,anon;
grant execute on function public.read_center_b2c_tuition_page(text,integer) to authenticated;
notify pgrst,'reload schema';
