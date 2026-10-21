begin;
do $$ begin
 if exists(select 1 from public.salework_daily_reports where work_date='1901-01-02') then
  raise exception 'Fixture exists';
 end if;
end $$;
select user_id as le_id from public.salework_report_people where person_slug='co-le' \gset
select user_id as thy_id from public.salework_report_people where person_slug='co-thy' \gset
select set_config('request.jwt.claims',jsonb_build_object('sub',:'le_id','role','authenticated')::text,true);
set local role authenticated;
insert into public.salework_daily_reports(person_slug,work_date,closed_customers,collected_amount,closed_courses)
 values('co-le','1901-01-02',0,0,0);
do $$ begin
 if not exists(select 1 from public.salework_daily_reports where work_date='1901-01-02' and notes='') then raise exception 'Default failed'; end if;
end $$;
update public.salework_daily_reports set notes='Khách hẹn ngày mai.' where person_slug='co-le' and work_date='1901-01-02';
do $$ begin
 if not exists(select 1 from public.salework_daily_reports where work_date='1901-01-02' and notes='Khách hẹn ngày mai.') then raise exception 'Notes readback failed'; end if;
 begin
  update public.salework_daily_reports set notes=repeat('x',501) where person_slug='co-le' and work_date='1901-01-02';
  raise exception 'Length validation failed';
 exception when check_violation then null;
 end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',:'thy_id','role','authenticated')::text,true);
set local role authenticated;
do $$ declare changed integer; begin
 if exists(select 1 from public.salework_daily_reports where person_slug='co-le' and work_date='1901-01-02') then raise exception 'Cross read allowed'; end if;
 update public.salework_daily_reports set notes='forbidden' where person_slug='co-le' and work_date='1901-01-02';
 get diagnostics changed = row_count;
 if changed<>0 then raise exception 'Cross update allowed'; end if;
end $$;
rollback;
select 'PASS: default, own note read/write, length, cross read/write denied; rolled back' as result;
