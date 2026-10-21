-- Chạy toàn bộ file trong Supabase SQL Editor.
begin;
create table public.salework_report_people (
 person_slug text primary key check(person_slug in ('co-le','co-thy')),
 user_id uuid not null unique references public.profiles(id)
);
alter table public.salework_report_people enable row level security;
insert into public.salework_report_people(person_slug,user_id)
select case username when 'cole' then 'co-le' else 'co-thy' end,id
from public.profiles where username in ('cole','cothy') and role='teacher' and is_active;
do $$ begin
 if (select count(*) from public.salework_report_people)<>2 then raise exception 'Thiếu tài khoản cole hoặc cothy'; end if;
end $$;
revoke all on public.salework_report_people from public,anon,authenticated;
grant select on public.salework_report_people to authenticated;
create policy report_people_read on public.salework_report_people for select to authenticated
using(app.is_manager() or user_id=auth.uid());

create table public.salework_daily_reports (
 person_slug text not null references public.salework_report_people(person_slug),
 work_date date not null,
 closed_customers integer not null check(closed_customers>=0),
 collected_amount numeric(18,0) not null check(collected_amount>=0),
 closed_courses integer not null check(closed_courses>=0),
 updated_at timestamptz not null default now(),
 primary key(person_slug,work_date)
);
alter table public.salework_daily_reports enable row level security;
revoke all on public.salework_daily_reports from public,anon,authenticated;
grant select,insert,update on public.salework_daily_reports to authenticated;
create policy daily_report_read on public.salework_daily_reports for select to authenticated
using(app.is_manager() or exists(select 1 from public.salework_report_people p join public.profiles u on u.id=p.user_id where p.person_slug=salework_daily_reports.person_slug and p.user_id=auth.uid() and u.is_active));
create policy daily_report_insert on public.salework_daily_reports for insert to authenticated
with check(work_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date and exists(select 1 from public.salework_report_people p join public.profiles u on u.id=p.user_id where p.person_slug=salework_daily_reports.person_slug and p.user_id=auth.uid() and u.is_active and u.role='teacher'));
create policy daily_report_update on public.salework_daily_reports for update to authenticated
using(exists(select 1 from public.salework_report_people p join public.profiles u on u.id=p.user_id where p.person_slug=salework_daily_reports.person_slug and p.user_id=auth.uid() and u.is_active and u.role='teacher'))
with check(work_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date and exists(select 1 from public.salework_report_people p join public.profiles u on u.id=p.user_id where p.person_slug=salework_daily_reports.person_slug and p.user_id=auth.uid() and u.is_active and u.role='teacher'));
create trigger daily_report_updated before update on public.salework_daily_reports for each row execute function app.set_updated_at();
create policy bikeforce_owner_read on public.bikeforce_salework_snapshots for select to authenticated
using(exists(select 1 from public.salework_report_people p join public.profiles u on u.id=p.user_id where p.person_slug=bikeforce_salework_snapshots.person_slug and p.user_id=auth.uid() and u.is_active));
notify pgrst,'reload schema';
commit;
