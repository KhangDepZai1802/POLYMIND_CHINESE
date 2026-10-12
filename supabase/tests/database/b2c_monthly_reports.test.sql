begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'b2c_monthly_reports', 'có bảng báo cáo tháng B2C');
select has_table('public', 'b2c_monthly_program_metrics', 'có bảng chỉ số chương trình B2C');
select is((select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'b2c_monthly_reports'), true, 'RLS bật cho báo cáo B2C');
select is((select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'b2c_monthly_program_metrics'), true, 'RLS bật cho chỉ số B2C');
select has_function('public', 'save_b2c_monthly_report', array['integer','integer','bigint','jsonb','jsonb','text'], 'có RPC lưu nguyên tử');
select function_privs_are('public', 'save_b2c_monthly_report', array['integer','integer','bigint','jsonb','jsonb','text'], 'anon', array[]::text[], 'anon không gọi RPC');
select function_privs_are('public', 'save_b2c_monthly_report', array['integer','integer','bigint','jsonb','jsonb','text'], 'authenticated', array['EXECUTE'], 'authenticated được gọi RPC');
select col_is_fk('public', 'b2c_monthly_program_metrics', 'report_id', 'metric thuộc một báo cáo');
select col_is_fk('public', 'b2c_monthly_program_metrics', 'program_slug', 'metric thuộc chương trình B2C');
select is((select count(*)::integer from pg_constraint where conrelid = 'public.b2c_monthly_reports'::regclass and contype = 'u'), 1, 'mỗi tháng chỉ có một báo cáo');
select is((select count(*)::integer from pg_constraint where conrelid = 'public.b2c_monthly_program_metrics'::regclass and contype = 'u'), 1, 'mỗi chương trình chỉ có một dòng trong tháng');
select throws_ok(
  $$ insert into public.b2c_monthly_reports (report_year, report_month) values (2026, 13) $$,
  '23514', null, 'không nhận tháng ngoài 1–12'
);

select * from finish();
rollback;
