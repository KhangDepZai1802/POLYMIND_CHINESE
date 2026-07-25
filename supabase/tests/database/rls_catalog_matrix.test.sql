begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select is(
  (select count(*)::integer from pg_tables where schemaname = 'public'),
  58,
  'catalog có đúng 58 bảng public đã review'
);
select is(
  (select count(*)::integer from pg_tables where schemaname = 'public' and rowsecurity),
  58,
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
  75,
  'catalog có đúng 75 RPC public đã review'
);
/*
 * ⚠️ Bài này TỪNG là `count = 0`. Đổi thành DANH SÁCH TRẮNG THEO TÊN khi mở
 * trang flashcard công khai (`D-36`, migration `…080`).
 *
 * Cố ý KHÔNG đổi thành `count = 1`: đếm bằng 1 thì đổi tên hàm, hoặc thay bằng
 * một hàm anon khác hẳn, test vẫn xanh. Ghim tên là chặt hơn bản gốc, không
 * phải nới lỏng.
 */
select is(
  (select coalesce(array_agg(function_record.proname order by function_record.proname),
                   array[]::name[])
   from pg_proc function_record
   join pg_namespace namespace on namespace.oid = function_record.pronamespace
   where namespace.nspname = 'public'
     and has_function_privilege('anon', function_record.oid, 'EXECUTE')),
  array['get_public_flashcard_session']::name[],
  'anonymous chỉ execute ĐÚNG một RPC công khai đã review'
);
select is(
  (select coalesce(array_agg(function_record.proname order by function_record.proname),
                   array[]::name[])
   from pg_proc function_record
   join pg_namespace namespace on namespace.oid = function_record.pronamespace
   where namespace.nspname = 'public'
     and not has_function_privilege('authenticated', function_record.oid, 'EXECUTE')),
  array[
    'finalize_assessment_attempts',
    'finalize_expired_exam_attempts',
    'get_public_flashcard_session',
    'run_invoice_overdue',
    'run_session_reminders'
  ]::name[],
  'authenticated bị chặn đúng bốn RPC hệ thống + RPC công khai'
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

select is(
  (
    select count(*)::integer
    from storage.buckets
    where id not in ('assignment-files', 'submissions')
  ),
  6,
  'có đúng 6 bucket nghiệp vụ Storage; không tính hai bucket legacy rỗng'
);
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
  24,
  'đủ 24 policy Storage và tất cả chỉ áp cho authenticated'
);

/*
 * Bề mặt CÔNG KHAI (`D-36`) — bốn bài dưới đây giữ cho nó không phình ra.
 * Bài 24 policy ở trên vẫn nguyên 24 vì policy mới có `roles = {anon}`, không
 * lọt vào phép đếm đó.
 */
select is(
  (select coalesce(array_agg(policyname order by policyname), array[]::name[])
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and roles <> array['authenticated'::name]),
  array['flashcard_media_public_link_read']::name[],
  'chỉ đúng một policy Storage nằm ngoài authenticated'
);
select is(
  (select array_agg(distinct cmd)
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'flashcard_media_public_link_read'),
  array['SELECT']::text[],
  'policy Storage công khai CHỈ đọc — không insert/update/delete'
);
select is(
  (select roles
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'flashcard_media_public_link_read'),
  array['anon'::name],
  'policy Storage công khai chỉ áp cho anon'
);
select is(
  (select coalesce(array_agg(function_record.proname order by function_record.proname),
                   array[]::name[])
   from pg_proc function_record
   join pg_namespace namespace on namespace.oid = function_record.pronamespace
   where namespace.nspname = 'share'),
  array['can_read_public_flashcard_media']::name[],
  'schema share chứa ĐÚNG một hàm — bán kính nổ của bề mặt công khai bằng 0'
);
select ok(
  not has_schema_privilege('anon', 'app', 'USAGE'),
  'anon vẫn KHÔNG chạm được schema app'
);

select * from finish();
rollback;
