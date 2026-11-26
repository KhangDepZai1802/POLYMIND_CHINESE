-- Tuition history remains visible after starting a new period. These readers
-- paginate packages, not enrollments, so a student's periods cannot multiply a
-- page after its limit has already been applied.
create or replace function public.get_b2c_tuition_period_page(
  p_query text default '', p_page integer default 0
)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_result jsonb;
  v_pattern text;
begin
  if not coalesce(app.is_manager(), false) then
    raise exception 'Không có quyền quản lý học phí B2C' using errcode = '42501';
  end if;
  if p_page is null or p_page < 0 or p_page > 1000000 or char_length(p_query) > 200 then
    raise exception 'Bộ lọc không hợp lệ' using errcode = '22023';
  end if;
  v_pattern := '%' || replace(replace(replace(btrim(coalesce(p_query, '')), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  with filtered as (
    select e.id as enrollment_id, s.code as student_code,
      s.archived_at as student_archived_at, s.full_name, c.name as class_name,
      p.id as package_id, p.period_no, p.is_current,
      p.sessions, p.unit_price, p.discount, p.discount_reason, p.total_due
    from public.b2c_enrollments e
    join public.b2c_students s on s.id = e.student_id
    join public.b2c_classes c on c.id = e.class_id
    left join public.b2c_tuition_packages p on p.enrollment_id = e.id and p.archived_at is null
    where s.full_name ilike v_pattern or s.code ilike v_pattern or c.name ilike v_pattern
  ), paid as (
    select package_id, sum(effective_amount) as amount
    from public.b2c_tuition_receipts group by package_id
  ), page_rows as (
    select f.*, coalesce(paid.amount, 0) as paid_amount,
      coalesce(f.total_due, 0) - coalesce(paid.amount, 0) as balance
    from (
      select * from filtered
      order by student_code, enrollment_id, period_no desc, package_id
      limit 50 offset p_page::bigint * 50
    ) f
    left join paid on paid.package_id = f.package_id
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'total_due', (select coalesce(sum(total_due), 0) from filtered),
    'paid_amount', (select coalesce(sum(paid.amount), 0) from filtered f join paid on paid.package_id = f.package_id),
    'rows', coalesce((select jsonb_agg(to_jsonb(r) order by student_code, enrollment_id, period_no desc, package_id) from page_rows r), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.read_center_b2c_tuition_period_page(
  p_query text default '', p_page integer default 0
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_pattern text;
begin
  if not coalesce(app.has_b2c_permission('manage_center_tuition'), false) then
    raise exception 'Không có quyền quản lý học phí B2C' using errcode = '42501';
  end if;
  if p_page is null or p_page < 0 or p_page > 1000000 or char_length(p_query) > 200 then
    raise exception 'Bộ lọc không hợp lệ' using errcode = '22023';
  end if;
  v_pattern := '%' || replace(replace(replace(btrim(coalesce(p_query, '')), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  with filtered as (
    select e.id as enrollment_id, e.class_id, e.enrollment_date, e.tuition_end_date, e.status,
      s.code as student_code, s.archived_at as student_archived_at, s.full_name, c.name as class_name,
      p.id as package_id, p.period_no, p.is_current,
      p.sessions, p.unit_price, p.discount, p.discount_reason, p.total_due
    from public.b2c_enrollments e
    join public.b2c_students s on s.id = e.student_id
    join public.b2c_classes c on c.id = e.class_id
    left join public.b2c_tuition_packages p on p.enrollment_id = e.id and p.archived_at is null
    where s.full_name ilike v_pattern or s.code ilike v_pattern or c.name ilike v_pattern
  ), paid as (
    select package_id, sum(effective_amount) as amount
    from public.b2c_tuition_receipts group by package_id
  ), page_rows as (
    select f.*, coalesce(paid.amount, 0) as paid_amount,
      coalesce(f.total_due, 0) - coalesce(paid.amount, 0) as balance
    from (
      select * from filtered
      order by student_code, enrollment_id, period_no desc, package_id
      limit 50 offset p_page::bigint * 50
    ) f
    left join paid on paid.package_id = f.package_id
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'total_due', (select coalesce(sum(total_due), 0) from filtered),
    'paid_amount', (select coalesce(sum(paid.amount), 0) from filtered f join paid on paid.package_id = f.package_id),
    'rows', coalesce((select jsonb_agg(to_jsonb(r) order by student_code, enrollment_id, period_no desc, package_id) from page_rows r), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.read_b2c_class_tuition_periods(
  p_class_id uuid, p_page integer default 0, p_query text default ''
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_rows jsonb;
  v_total bigint;
  v_stats jsonb;
begin
  if not coalesce(app.has_b2c_permission('view_classes', p_class_id), false)
    or not coalesce(app.has_b2c_permission('view_tuition', p_class_id), false) then
    raise exception 'Không có quyền quản lý học phí lớp.' using errcode = '42501';
  end if;
  if p_page is null or p_page < 0 or p_page > 1000000 or length(coalesce(p_query, '')) > 200 then
    raise exception 'Bộ lọc không hợp lệ.' using errcode = '22023';
  end if;
  if not exists(select 1 from public.b2c_classes where id = p_class_id) then
    raise exception 'Không tìm thấy lớp.' using errcode = 'P0002';
  end if;
  with filtered as (
    select e.id as enrollment_id, s.id as student_id, s.code as student_code,
      s.full_name, s.phone, e.status as student_status, e.enrollment_date,
      e.tuition_end_date, e.registered_sessions, c.name as class_name,
      (
        select string_agg(p.full_name, ', ' order by p.full_name)
        from public.b2c_student_parents l
        join public.b2c_parents p on p.id = l.parent_id and p.archived_at is null
        where l.student_id = s.id
      ) as guardian_name,
      t.id as package_id, t.period_no, t.is_current,
      t.sessions, t.unit_price, t.discount, t.discount_reason, t.total_due,
      case when t.id is null then null else coalesce(paid.amount, 0) end as paid_amount,
      case when t.id is null then null else t.total_due - coalesce(paid.amount, 0) end as balance
    from public.b2c_enrollments e
    join public.b2c_students s on s.id = e.student_id and s.archived_at is null
    join public.b2c_classes c on c.id = e.class_id
    left join public.b2c_tuition_packages t on t.enrollment_id = e.id and t.archived_at is null
    left join lateral (
      select sum(effective_amount) as amount from public.b2c_tuition_receipts where package_id = t.id
    ) paid on true
    where e.class_id = p_class_id
      and strpos(lower(s.code || ' ' || s.full_name || ' ' || coalesce(s.phone, '')), lower(coalesce(p_query, ''))) > 0
  ), page_rows as (
    select f.*,
      case when app.has_b2c_permission('mark_attendance', p_class_id) then (
        select jsonb_build_object(
          'attended', count(*) filter(where a.status in ('present', 'late', 'makeup')),
          'absent', count(*) filter(where a.status = 'absent'),
          'excused', count(*) filter(where a.status = 'excused'),
          'makeup', count(*) filter(where a.status = 'makeup'),
          'remaining', case when f.registered_sessions is null then null
            else f.registered_sessions - count(*) filter(where a.status in ('present', 'late', 'makeup')) end
        )
        from public.b2c_student_attendance a
        join public.b2c_class_meetings m on m.id = a.meeting_id
        where a.enrollment_id = f.enrollment_id and m.class_id = p_class_id
          and m.status <> 'cancelled' and m.ends_at <= now()
      ) else null end as session_summary,
      null::uuid as attendance_id, null::text as attendance_status,
      null::text as attendance_note, null::timestamptz as attendance_updated_at
    from (
      select * from filtered
      order by student_code, enrollment_id, period_no desc, package_id
      limit 25 offset p_page::bigint * 25
    ) f
  )
  select (select count(*) from filtered),
    coalesce((select jsonb_agg(to_jsonb(r) order by student_code, enrollment_id, period_no desc, package_id) from page_rows r), '[]'::jsonb),
    (select jsonb_build_object(
      'total_due', coalesce(sum(total_due), 0),
      'paid_amount', coalesce(sum(paid_amount), 0),
      'unconfigured', count(*) filter(where package_id is null)
    ) from filtered)
  into v_total, v_rows, v_stats;
  return jsonb_build_object(
    'class', (
      select jsonb_build_object(
        'id', c.id, 'code', c.code, 'name', c.name, 'program_slug', c.program_slug,
        'teacher_name', c.teacher_name,
        'weekdays_text', case when app.has_b2c_permission('view_schedule', c.id) then c.weekdays_text end,
        'time_text', case when app.has_b2c_permission('view_schedule', c.id) then c.time_text end,
        'capacity', c.capacity,
        'enrolled_count', case when app.has_b2c_permission('view_students', c.id) then c.enrolled_count end,
        'start_date', c.start_date, 'end_date', c.end_date,
        'campus', c.campus, 'delivery_mode', c.delivery_mode, 'notes', c.notes
      ) from public.b2c_classes c where c.id = p_class_id
    ),
    'schedules', '[]'::jsonb, 'rows', v_rows, 'total', v_total, 'stats', v_stats, 'meeting', null
  );
end;
$$;

revoke all on function public.get_b2c_tuition_period_page(text, integer),
  public.read_center_b2c_tuition_period_page(text, integer),
  public.read_b2c_class_tuition_periods(uuid, integer, text) from public, anon;
grant execute on function public.get_b2c_tuition_period_page(text, integer),
  public.read_center_b2c_tuition_period_page(text, integer),
  public.read_b2c_class_tuition_periods(uuid, integer, text) to authenticated;

-- Older deployments and the student/attendance tabs still expect exactly one
-- package per enrollment. Keep those readers on the current period, including
-- their totals, until the client opts into the new period-aware RPCs above.
do $$
declare
  v_function regprocedure;
  v_definition text;
  v_needle constant text := '(select * from public.b2c_tuition_packages where archived_at is null)';
  v_count integer;
  v_expected integer;
begin
  foreach v_function in array array[
    'public.get_b2c_tuition_page(text,integer)'::regprocedure,
    'public.read_center_b2c_tuition_page(text,integer)'::regprocedure,
    'public.read_b2c_class_workspace(uuid,text,integer,text,uuid)'::regprocedure,
    'public.read_teacher_b2c_workspace(uuid,text,integer,text,uuid)'::regprocedure
  ] loop
    v_definition := pg_get_functiondef(v_function);
    v_expected := case when v_function in (
      'public.get_b2c_tuition_page(text,integer)'::regprocedure,
      'public.read_center_b2c_tuition_page(text,integer)'::regprocedure
    ) then 1 else 2 end;
    v_count := (length(v_definition) - length(replace(v_definition, v_needle, ''))) / length(v_needle);
    if v_count <> v_expected then
      raise exception 'Unexpected tuition reader definition: % (% predicates, expected %)', v_function, v_count, v_expected;
    end if;
    execute replace(v_definition, v_needle,
      '(select * from public.b2c_tuition_packages where archived_at is null and is_current)');
  end loop;
end;
$$;

-- Do not leave only historical rows with no current period. The existing RPC
-- already locks the enrollment and package before this check, serializing it
-- against creation of the next period and preserving its archive audit trail.
do $$
declare
  v_definition text := pg_get_functiondef('public.archive_b2c_center_record(text,uuid,text)'::regprocedure);
  v_needle constant text := 'if d->>''archived_at'' is not null then return; end if;';
begin
  if (length(v_definition) - length(replace(v_definition, v_needle, ''))) / length(v_needle) <> 1 then
    raise exception 'Unexpected archive_b2c_center_record definition';
  end if;
  execute replace(v_definition, v_needle, v_needle || $guard$
 if p_entity='package' and coalesce((d->>'is_current')::boolean,false)
  and exists(select 1 from public.b2c_tuition_packages
   where enrollment_id=v_enrollment and id<>p_id and archived_at is null) then
  raise exception 'Không thể lưu trữ đợt hiện tại khi còn lịch sử học phí. Hãy điều chỉnh đúng đợt.' using errcode='22023';
 end if;
$guard$);
end;
$$;

notify pgrst, 'reload schema';
