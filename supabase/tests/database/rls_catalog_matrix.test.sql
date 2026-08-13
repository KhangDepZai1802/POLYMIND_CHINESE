begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select is(
  (select count(*)::integer from pg_tables where schemaname = 'public'),
  -- 58 → 60: `VIDEO-1` thêm `lesson_video_collections` và `lesson_videos`.
  -- 60 → 61: `BUG-SCHED-MAKEUP-1` thêm lịch sử bất biến
  -- `class_session_schedule_changes`; bảng chỉ cho staff đọc qua RLS và không
  -- cấp quyền ghi trực tiếp cho role ứng dụng.
  -- 61 → 64: `TEACHER-REPORT-1` thêm `session_reports` +
  -- `session_report_students` + `session_report_evidence`.
  --
  -- 🔴 CHÍNH BÀI NÀY LÀ THỨ ĐÁNG RA PHẢI ĐỎ NGAY LÚC TẠO BẢNG. Migration `…092`
  -- vấp đúng `BLK-6` — `pg_default_acl` cấp cho `anon` 9 quyền trên bảng mới
  -- trong khi `authenticated` không có quyền nào — và nó được phát hiện nhờ bài
  -- pgTAP riêng của tính năng, KHÔNG phải nhờ bài đếm catalog này, vì cả bộ
  -- pgTAP chưa từng được chạy lại sau khi thêm bảng. Ba bảng chứa nhận xét nội
  -- bộ về học viên; grant/revoke tường minh nằm ngay trong `…092`, và bài 3 bên
  -- dưới (`anon` SELECT = 0) là chỗ ghim kết quả đó.
  64,
  'catalog có đúng 64 bảng public đã review'
);
select is(
  (select count(*)::integer from pg_tables where schemaname = 'public' and rowsecurity),
  64,
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
  -- 75 → 76: `QRLINK-1`/`D-38` thêm `create_flashcard_public_links_for_deck`
  -- (phát hành liên kết QR cố định cho cả bộ thẻ, chỉ `authenticated` +
  -- super_admin). Con số này là CHỐT CHẶN, không phải chú thích: mỗi lần nó đỏ
  -- là có một RPC public mới cần người đọc lại grant của nó.
  -- 76 → 77: `PERF-IMG-2` thêm `rewrite_flashcard_media_extension` — vỏ gọi cho
  -- script vận hành đổi `.png` → `.webp`. 🔴 Đây là RPC DUY NHẤT đi vòng được
  -- `trg_flashcard_pages_guard_history`, nên nó chỉ cấp cho `service_role`; bài
  -- ngay dưới ghim việc `authenticated` KHÔNG gọi được.
  -- 77 → 78: `COVER-1`/`D-41` thêm `attach_flashcard_deck_covers` — gắn ảnh trang
  -- mở đầu hàng loạt cho cả bộ. Cấp cho `authenticated` + chặn bằng
  -- `app.is_super_admin()` bên trong; bề mặt `anon` KHÔNG đổi (bài ngay dưới vẫn
  -- ghim đúng một tên).
  -- 78 → 79: `VIDEO-1` thêm `save_lesson_videos`; chỉ manager được ghi và hàm
  -- tự kiểm quyền fail-closed.
  -- 79 → 80: `BUG-SCHED-MAKEUP-1` thêm
  -- `reschedule_class_session_with_makeup`; chỉ manager được gọi, cập nhật lịch
  -- nguyên tử và giữ nguyên số lượng/ID/số thứ tự buổi.
  -- 80 → 83: `TEACHER-REPORT-1` thêm `save_session_report` +
  -- `submit_session_report`, `FLASHCARD-BULKPUB-1` thêm
  -- `bulk_set_flashcard_section_status`. Cả ba chỉ cấp cho `authenticated` +
  -- `service_role` và tự kiểm quyền fail-closed bên trong; bề mặt `anon` KHÔNG
  -- đổi — bài ngay dưới vẫn ghim đúng một tên.
  83,
  'catalog có đúng 83 RPC public đã review'
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
    'rewrite_flashcard_media_extension',
    'run_invoice_overdue',
    'run_session_reminders'
  ]::name[],
  'authenticated bị chặn đúng bốn RPC hệ thống + RPC công khai + RPC vận hành đổi đuôi'
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
  -- 6 → 7: `TEACHER-REPORT-1` thêm `session-report-evidence` (ảnh minh chứng
  -- mục 8). Private như mọi bucket khác — bài ngay dưới ghim điều đó.
  7,
  'có đúng 7 bucket nghiệp vụ Storage; không tính hai bucket legacy rỗng'
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
  -- 24 → 27: `TEACHER-REPORT-1` thêm ba policy cho bucket
  -- `session-report-evidence` — `session_report_evidence_read` (SELECT),
  -- `…_teacher_insert` (INSERT), `…_owner_delete` (DELETE). Cả ba `to
  -- authenticated`, nên bài 16 vẫn thấy đúng MỘT policy nằm ngoài
  -- `authenticated`.
  27,
  'đủ 27 policy Storage và tất cả chỉ áp cho authenticated'
);

/*
 * Bề mặt CÔNG KHAI (`D-36`) — bốn bài dưới đây giữ cho nó không phình ra.
 * Phép đếm policy `authenticated` ở trên không đổi vì policy công khai có
 * `roles = {anon}`, không lọt vào đó.
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
