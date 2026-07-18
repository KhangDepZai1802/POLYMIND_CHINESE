begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select is(
  (select count(*)::integer from pg_tables where schemaname = 'public'),
  51,
  'catalog có đúng 51 bảng public đã review'
);
select is(
  (select count(*)::integer from pg_tables where schemaname = 'public' and rowsecurity),
  51,
  'mọi bảng public đều bật RLS'
);
select is(
  (select count(*)::integer
   from pg_tables table_record
   where table_record.schemaname = 'public'
     and has_table_privilege('anon', format('%I.%I', table_record.schemaname, table_record.tablename), 'SELECT')),
  0,
  'anonymous không có SELECT trực tiếp trên bảng nghiệp vụ'
);
select is(
  (select count(*)::integer
   from pg_tables table_record
   where table_record.schemaname = 'public'
     and not exists (
       select 1 from pg_policies policy
       where policy.schemaname = table_record.schemaname
         and policy.tablename = table_record.tablename
         and policy.cmd in ('SELECT', 'ALL')
     )),
  0,
  'mọi bảng có policy SELECT hoặc ALL tường minh'
);
select is(
  (select count(*)::integer
   from pg_tables table_record
   where table_record.schemaname = 'public'
     and has_table_privilege('authenticated', format('%I.%I', table_record.schemaname, table_record.tablename), 'INSERT')
     and not exists (
       select 1 from pg_policies policy
       where policy.schemaname = 'public' and policy.tablename = table_record.tablename
         and policy.cmd in ('INSERT', 'ALL')
     )),
  0,
  'mọi quyền INSERT authenticated đều có policy tương ứng'
);
select is(
  (select count(*)::integer
   from pg_tables table_record
   where table_record.schemaname = 'public'
     and has_table_privilege('authenticated', format('%I.%I', table_record.schemaname, table_record.tablename), 'UPDATE')
     and not exists (
       select 1 from pg_policies policy
       where policy.schemaname = 'public' and policy.tablename = table_record.tablename
         and policy.cmd in ('UPDATE', 'ALL')
     )),
  0,
  'mọi quyền UPDATE authenticated đều có policy tương ứng'
);
select is(
  (select count(*)::integer
   from pg_tables table_record
   where table_record.schemaname = 'public'
     and has_table_privilege('authenticated', format('%I.%I', table_record.schemaname, table_record.tablename), 'DELETE')
     and not exists (
       select 1 from pg_policies policy
       where policy.schemaname = 'public' and policy.tablename = table_record.tablename
         and policy.cmd in ('DELETE', 'ALL')
     )),
  0,
  'mọi quyền DELETE authenticated đều có policy tương ứng'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT,UPDATE,DELETE'),
  'audit log append-only với role ứng dụng'
);

select is(
  (select count(*)::integer
   from pg_proc function_record
   join pg_namespace namespace on namespace.oid = function_record.pronamespace
   where namespace.nspname = 'public'),
  58,
  'catalog có đúng 58 RPC public đã review'
);
select is(
  (select count(*)::integer
   from pg_proc function_record
   join pg_namespace namespace on namespace.oid = function_record.pronamespace
   where namespace.nspname = 'public'
     and has_function_privilege('anon', function_record.oid, 'EXECUTE')),
  0,
  'anonymous không execute RPC nghiệp vụ'
);
select is(
  (select count(*)::integer
   from pg_proc function_record
   join pg_namespace namespace on namespace.oid = function_record.pronamespace
   where namespace.nspname = 'public'
     and not has_function_privilege('authenticated', function_record.oid, 'EXECUTE')),
  4,
  'authenticated chỉ bị chặn đúng bốn RPC hệ thống'
);
select is(
  (select count(*)::integer
   from pg_proc function_record
   join pg_namespace namespace on namespace.oid = function_record.pronamespace
   where namespace.nspname = 'public'
     and function_record.proname like 'run_%'
     and has_function_privilege('service_role', function_record.oid, 'EXECUTE')),
  2,
  'service_role chỉ có hai entrypoint cron HTTP nền'
);

select is((select count(*)::integer from storage.buckets), 7, 'có đúng 7 bucket Storage');
select is(
  (select count(*)::integer from storage.buckets where public),
  0,
  'mọi bucket đều private'
);
select is(
  (select count(*)::integer
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and roles = array['authenticated'::name]),
  17,
  'đủ 17 policy Storage và tất cả chỉ áp cho authenticated'
);

select * from finish();
rollback;
