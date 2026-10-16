alter table public.b2c_classes add column end_date date,
 add constraint b2c_classes_course_dates_check check(end_date is null or start_date is null or end_date>=start_date);
comment on column public.b2c_classes.end_date is 'Optional course end date. Independent of tuition expiry and recurring schedule date_to. No automatic status/schedule changes.';

do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.save_teacher_b2c_class(uuid,jsonb,uuid,timestamptz)'::regprocedure);
 if position('delivery_mode,start_date,status,notes,created_by' in definition)=0
 or position('start_date=nullif(p_data->>''start_date'','''')::date,status=' in definition)=0 then
  raise exception 'Unexpected save_teacher_b2c_class definition';
 end if;
 -- Managers may edit existing classes without a personal linked teacher profile.
 -- Teacher capabilities and class scoping above this guard remain unchanged.
 definition:=replace(definition,'if v_teacher is null then raise exception','if v_teacher is null and p_id is null then raise exception');
 definition:=replace(definition,'delivery_mode,start_date,status,notes,created_by','delivery_mode,start_date,end_date,status,notes,created_by');
 definition:=replace(definition,'nullif(p_data->>''start_date'','''')::date,p_data->>''status''',
  'nullif(p_data->>''start_date'','''')::date,nullif(p_data->>''end_date'','''')::date,p_data->>''status''');
 definition:=replace(definition,'start_date=nullif(p_data->>''start_date'','''')::date,status=',
  'start_date=nullif(p_data->>''start_date'','''')::date,end_date=case when p_data ? ''end_date'' then nullif(p_data->>''end_date'','''')::date else end_date end,status=');
 execute definition;
 definition:=pg_get_functiondef('public.read_teacher_b2c_class_edit(uuid)'::regprocedure);
 definition:=replace(definition,'''start_date'',start_date,','''start_date'',start_date,''end_date'',end_date,');
 execute definition;
 definition:=pg_get_functiondef('public.read_teacher_b2c_workspace(uuid,text,integer,text,uuid)'::regprocedure);
 definition:=replace(definition,'''start_date'',c.start_date,','''start_date'',c.start_date,''end_date'',c.end_date,');
 execute definition;
end $$;
notify pgrst,'reload schema';
