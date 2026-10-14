begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(14);
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('49000000-0000-4000-8000-000000000010','authenticated','authenticated','finance-manager@example.test',now(),now()),
('49000000-0000-4000-8000-000000000011','authenticated','authenticated','finance-teacher@example.test',now(),now());
insert into public.profiles(id,role,full_name,is_active) values
('49000000-0000-4000-8000-000000000010','academic_manager','TEST FINANCE MANAGER',true),
('49000000-0000-4000-8000-000000000011','teacher','TEST FINANCE TEACHER',true);
insert into public.b2c_monthly_reports(id,report_year,report_month,payroll_cost) values('49000000-0000-4000-8000-000000000001',2099,1,12345);
select is((select payroll_cost from public.b2c_monthly_reports where id='49000000-0000-4000-8000-000000000001'),12345::bigint,'Legacy total stays intact');
select ok((select teacher_payroll_cost is null and office_payroll_cost is null from public.b2c_monthly_reports where id='49000000-0000-4000-8000-000000000001'),'Legacy split remains unknown');
select ok((select relrowsecurity from pg_class where oid='public.b2c_monthly_reports'::regclass),'RLS remains enabled');
select set_config('request.jwt.claims','{"sub":"49000000-0000-4000-8000-000000000010","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.save_b2c_monthly_report(2099,2,1000,'{"teacher_payroll":300,"office_payroll":200,"marketing":100}'::jsonb,'[]'::jsonb)$$,'Manager saves split payroll');
select is((select teacher_payroll_cost from public.b2c_monthly_reports where report_year=2099 and report_month=2),300::bigint,'Teacher payroll persisted');
select is((select office_payroll_cost from public.b2c_monthly_reports where report_year=2099 and report_month=2),200::bigint,'Office payroll persisted');
select is((select payroll_cost from public.b2c_monthly_reports where report_year=2099 and report_month=2),500::bigint,'Combined payroll equals the two components');
select lives_ok($$select public.save_b2c_monthly_report(2099,2,1000,'{"payroll":500,"marketing":100}'::jsonb,'[]'::jsonb)$$,'Legacy API does not erase classified payroll');
select is((select teacher_payroll_cost from public.b2c_monthly_reports where report_year=2099 and report_month=2),300::bigint,'Split retained after compatible legacy update');
select throws_ok($$select public.save_b2c_monthly_report(2099,2,1000,'{"teacher_payroll":-1,"office_payroll":200}'::jsonb,'[]'::jsonb)$$,'23514',null,'Negative payroll rejected');
select throws_ok($$select public.save_b2c_monthly_report(2099,2,1000,'{"teacher_payroll":300}'::jsonb,'[]'::jsonb)$$,'22023',null,'Partial split rejected');
select throws_ok($$update public.b2c_monthly_reports set payroll_cost=999 where report_year=2099 and report_month=2$$,'23514',null,'Direct inconsistent total rejected');
select set_config('request.jwt.claims','{"sub":"49000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
select throws_ok($$select public.save_b2c_monthly_report(2099,2,1000,'{"teacher_payroll":300,"office_payroll":200}'::jsonb,'[]'::jsonb)$$,'42501',null,'Teacher cannot change reports');
select is((select count(*)::integer from public.b2c_monthly_reports),0,'Teacher cannot read finance reports');
reset role;
select * from finish();
rollback;
