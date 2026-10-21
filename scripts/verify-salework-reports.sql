-- Production integration verification. All report writes are rolled back.
begin;
select user_id as le_id from public.salework_report_people where person_slug='co-le' \gset
select user_id as thy_id from public.salework_report_people where person_slug='co-thy' \gset
select id as admin_id from public.profiles where role='super_admin' and is_active order by id limit 1 \gset
do $$ begin
 if exists(select 1 from public.salework_daily_reports where work_date='1901-01-01') then
   raise exception 'Fixture date already in use';
 end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',:'le_id','role','authenticated')::text,true);
set local role authenticated;
insert into public.salework_daily_reports(person_slug,work_date,closed_customers,collected_amount,closed_courses)
values('co-le','1901-01-01',2,1000000,3);
insert into public.salework_daily_reports(person_slug,work_date,closed_customers,collected_amount,closed_courses)
values('co-le','1901-01-01',4,2000000,5)
on conflict(person_slug,work_date) do update set closed_customers=excluded.closed_customers,collected_amount=excluded.collected_amount,closed_courses=excluded.closed_courses;
do $$ begin
 if not exists(select 1 from public.salework_daily_reports where person_slug='co-le' and work_date='1901-01-01' and closed_customers=4 and collected_amount=2000000 and closed_courses=5) then raise exception 'Own upsert failed'; end if;
 if exists(select 1 from public.salework_report_people where person_slug='co-thy') then raise exception 'Other identity exposed'; end if;
 if exists(select 1 from public.bikeforce_salework_snapshots where person_slug='co-thy') then raise exception 'Other snapshot exposed'; end if;
 begin
   insert into public.salework_daily_reports values('co-thy','1901-01-01',99,99,99,now());
   raise exception 'Cross-person insert allowed';
 exception when insufficient_privilege then null;
 end;
 begin
   insert into public.salework_daily_reports values('co-le','2999-01-01',1,1,1,now());
   raise exception 'Future date allowed';
 exception when insufficient_privilege then null;
 end;
 begin
   update public.salework_daily_reports set closed_customers=-1 where person_slug='co-le' and work_date='1901-01-01';
   raise exception 'Negative values allowed';
 exception when check_violation then null;
 end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',:'thy_id','role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.salework_daily_reports where person_slug='co-le') then raise exception 'Other report exposed'; end if;
 update public.salework_daily_reports set closed_courses=99 where person_slug='co-le' and work_date='1901-01-01';
 if found then raise exception 'Cross-person update allowed'; end if;
end $$;
insert into public.salework_daily_reports(person_slug,work_date,closed_customers,collected_amount,closed_courses)
values('co-thy','1901-01-01',1,500000,1);
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',:'admin_id','role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.salework_daily_reports where work_date='1901-01-01')<>2 then raise exception 'Admin cannot see both reports'; end if;
 update public.salework_daily_reports set closed_courses=99 where work_date='1901-01-01';
 if found then raise exception 'Admin write unexpectedly allowed'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
   perform 1 from public.salework_daily_reports;
   raise exception 'Anonymous table access allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
select 'PASS: own upsert, isolation, future/negative validation, manager read-only, anon denied; all fixtures rolled back' as result;
