-- Admissions is an explicit permission, independent of assigned teaching classes.
alter table public.b2c_teacher_permissions drop constraint known_b2c_permissions;
alter table public.b2c_teacher_permissions add constraint known_b2c_permissions check(permissions <@ array['view_classes','view_students','view_schedule','view_comments','write_comments','mark_attendance','check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition','view_assessments','grade_assessments','share_monthly_comments','manage_admissions']::text[]);
do $$ declare d text; begin
 select pg_get_functiondef('app.has_b2c_permission(text,uuid)'::regprocedure) into d;
 if position('''share_monthly_comments''' in d)=0 or position('''manage_admissions''' in d)>0 then raise exception 'Unexpected permission definition'; end if;
 execute replace(d,'''share_monthly_comments''','''share_monthly_comments'',''manage_admissions''');
 select pg_get_functiondef('public.save_b2c_teacher_permissions(uuid,uuid,text[],timestamptz)'::regprocedure) into d;
 if position('''share_monthly_comments'']' in d)=0 then raise exception 'Unexpected permission save definition'; end if;
 execute replace(d,'''share_monthly_comments'']','''share_monthly_comments'',''manage_admissions'']');
 select pg_get_functiondef('public.get_b2c_admissions_page(text,text,text,integer,integer)'::regprocedure) into d;
 if position('app.is_manager()' in d)=0 then raise exception 'Unexpected admissions definition'; end if;
 execute replace(d,'app.is_manager()','public.has_b2c_permission(''manage_admissions'')');
end $$;

create policy b2c_admissions_permitted_select on public.b2c_admission_leads
 for select to authenticated using(public.has_b2c_permission('manage_admissions'));
create policy b2c_admissions_permitted_insert on public.b2c_admission_leads
 for insert to authenticated with check(public.has_b2c_permission('manage_admissions') and created_by=auth.uid());
create policy b2c_admissions_permitted_update on public.b2c_admission_leads
 for update to authenticated using(public.has_b2c_permission('manage_admissions'))
 with check(public.has_b2c_permission('manage_admissions'));
create policy b2c_care_permitted_select on public.b2c_admission_care_logs
 for select to authenticated using(public.has_b2c_permission('manage_admissions'));
create policy b2c_care_permitted_insert on public.b2c_admission_care_logs
 for insert to authenticated with check(public.has_b2c_permission('manage_admissions') and created_by=auth.uid());
notify pgrst,'reload schema';
