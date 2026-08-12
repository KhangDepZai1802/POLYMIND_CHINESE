-- =============================================================================
-- 91 — Nghỉ học / xếp lịch bù không sinh thêm số buổi
--
-- Một lớp 35 buổi vẫn phải là 35 buổi sau khi nghỉ và học bù. RPC bên dưới
-- bỏ mốc nghỉ, thêm mốc bù rồi gán lại CÁC MỐC THỜI GIAN cho chính những row
-- session hiện hữu. ID, session_number, lesson/content và điểm danh không đổi.
-- =============================================================================

create table public.class_session_schedule_changes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  source_session_id uuid not null references public.class_sessions(id) on delete restrict,
  request_id uuid not null unique,
  reason text not null,
  old_starts_at timestamptz not null,
  old_ends_at timestamptz not null,
  makeup_starts_at timestamptz not null,
  makeup_ends_at timestamptz not null,
  affected_session_count integer not null check (affected_session_count > 0),
  changes jsonb not null check (jsonb_typeof(changes) = 'object'),
  changed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint ck_class_session_schedule_changes_reason
    check (char_length(trim(reason)) between 3 and 500),
  constraint ck_class_session_schedule_changes_old_time
    check (old_ends_at > old_starts_at),
  constraint ck_class_session_schedule_changes_makeup_time
    check (makeup_ends_at > makeup_starts_at)
);

create index ix_class_session_schedule_changes_class
  on public.class_session_schedule_changes(class_id, created_at desc);
create index ix_class_session_schedule_changes_source
  on public.class_session_schedule_changes(source_session_id, created_at desc);

alter table public.class_session_schedule_changes enable row level security;

create policy class_session_schedule_changes_staff_read
  on public.class_session_schedule_changes
  for select
  using (app.is_manager() or app.teaches_class(class_id));

revoke all on table public.class_session_schedule_changes from public, anon, authenticated;
grant select on table public.class_session_schedule_changes to authenticated, service_role;

create or replace function public.reschedule_class_session_with_makeup(
  p_session_id uuid,
  p_new_starts_at timestamptz,
  p_new_ends_at timestamptz,
  p_reason text,
  p_request_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.class_sessions%rowtype;
  v_class public.classes%rowtype;
  v_existing_count integer;
  v_affected_count integer;
  v_expected_count integer;
  v_new_schedule_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_change_id uuid;
  v_reason text := nullif(trim(p_reason), '');
begin
  if not app.is_active() or not app.is_manager() then
    raise exception 'Chỉ quản trị viên hoặc giáo vụ được đổi lịch học';
  end if;

  if p_request_id is null then
    raise exception 'Thiếu mã chống gửi trùng';
  end if;

  select h.affected_session_count
    into v_existing_count
  from public.class_session_schedule_changes h
  where h.request_id = p_request_id;

  if found then
    return v_existing_count;
  end if;

  if v_reason is null or char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Lý do phải có từ 3 đến 500 ký tự';
  end if;

  if p_new_starts_at is null or p_new_ends_at is null or p_new_ends_at <= p_new_starts_at then
    raise exception 'Thời gian học bù không hợp lệ';
  end if;

  select * into v_source
  from public.class_sessions
  where id = p_session_id;

  if v_source.id is null then
    raise exception 'Không tìm thấy buổi học';
  end if;

  -- Khóa theo lớp trước, sau đó khóa toàn bộ session của lớp theo một thứ tự ổn
  -- định. Hai admin đổi lịch cùng lúc sẽ xếp hàng, không thể ghi đè lẫn nhau.
  select * into v_class
  from public.classes
  where id = v_source.class_id
  for update;

  perform 1
  from public.class_sessions
  where class_id = v_source.class_id
  order by session_number
  for update;

  -- Sau khi chờ lock, request cùng mã có thể đã được transaction trước hoàn tất.
  select h.affected_session_count
    into v_existing_count
  from public.class_session_schedule_changes h
  where h.request_id = p_request_id;

  if found then
    return v_existing_count;
  end if;

  select * into v_source
  from public.class_sessions
  where id = p_session_id;

  if v_source.status <> 'scheduled' then
    raise exception 'Chỉ đổi lịch cho buổi đang được lên lịch';
  end if;

  if p_new_starts_at <= v_source.starts_at then
    raise exception 'Ngày học bù phải sau ngày nghỉ';
  end if;

  if v_class.planned_session_count is null then
    raise exception 'Lớp chưa có tổng số buổi dự kiến';
  end if;

  v_expected_count := v_class.planned_session_count - v_source.session_number + 1;

  select count(*)::integer
    into v_affected_count
  from public.class_sessions s
  where s.class_id = v_source.class_id
    and s.session_number >= v_source.session_number
    and s.session_number <= v_class.planned_session_count;

  if v_affected_count <> v_expected_count then
    raise exception 'Dãy buổi từ % đến % đang thiếu hoặc thừa; không tự đoán cách dời lịch',
      v_source.session_number, v_class.planned_session_count;
  end if;

  if exists (
    select 1
    from public.class_sessions s
    where s.class_id = v_source.class_id
      and s.session_number between v_source.session_number and v_class.planned_session_count
      and (
        s.status <> 'scheduled'
        or s.completed_at is not null
        or s.lesson_log is not null
        or exists (
          select 1 from public.attendance_records a where a.session_id = s.id
        )
      )
  ) then
    raise exception 'Không thể dời chuỗi có buổi đã dạy, có nhật ký hoặc có điểm danh';
  end if;

  -- Mốc bù không được đè lên một buổi khác của cùng lớp, kể cả buổi nằm trong
  -- chuỗi sắp dời: một mốc thời gian chỉ được xuất hiện đúng một lần.
  if exists (
    select 1
    from public.class_sessions s
    where s.class_id = v_source.class_id
      and s.id <> v_source.id
      and s.status not in ('cancelled', 'rescheduled')
      and tstzrange(s.starts_at, s.ends_at, '[)')
          && tstzrange(p_new_starts_at, p_new_ends_at, '[)')
  ) then
    raise exception 'Thời gian học bù bị trùng với một buổi khác của lớp';
  end if;

  -- Chặn cả xung đột giáo viên với lớp khác. Ẩn cảnh báo ở UI không đủ; RPC là
  -- chốt cuối cho mọi client và request đồng thời.
  if exists (
    select 1
    from public.class_teachers source_teacher
    join public.class_teachers other_teacher
      on other_teacher.teacher_id = source_teacher.teacher_id
     and other_teacher.class_id <> source_teacher.class_id
    join public.class_sessions other_session
      on other_session.class_id = other_teacher.class_id
    where source_teacher.class_id = v_source.class_id
      and other_session.status not in ('cancelled', 'rescheduled')
      and tstzrange(other_session.starts_at, other_session.ends_at, '[)')
          && tstzrange(p_new_starts_at, p_new_ends_at, '[)')
  ) then
    raise exception 'Giáo viên đã có lớp khác trong thời gian học bù';
  end if;

  select s.id
    into v_new_schedule_id
  from public.class_schedules s
  where s.class_id = v_source.class_id
    and s.weekday = extract(isodow from p_new_starts_at at time zone 'Asia/Ho_Chi_Minh')
    and s.start_time = (p_new_starts_at at time zone 'Asia/Ho_Chi_Minh')::time
    and s.end_time = (p_new_ends_at at time zone 'Asia/Ho_Chi_Minh')::time
    and (s.effective_from is null or (p_new_starts_at at time zone 'Asia/Ho_Chi_Minh')::date >= s.effective_from)
    and (s.effective_to is null or (p_new_starts_at at time zone 'Asia/Ho_Chi_Minh')::date <= s.effective_to)
  order by s.id
  limit 1;

  select jsonb_agg(
           jsonb_build_object(
             'session_id', s.id,
             'session_number', s.session_number,
             'starts_at', s.starts_at,
             'ends_at', s.ends_at,
             'schedule_id', s.schedule_id
           ) order by s.session_number
         )
    into v_before
  from public.class_sessions s
  where s.class_id = v_source.class_id
    and s.session_number between v_source.session_number and v_class.planned_session_count;

  -- Giữ các session theo số thứ tự; chỉ thay danh sách time slot:
  -- bỏ slot của buổi nghỉ, thêm slot học bù, sắp theo thời gian rồi ghép 1-1.
  with affected as materialized (
    select s.id,
           row_number() over (order by s.session_number) as rn
    from public.class_sessions s
    where s.class_id = v_source.class_id
      and s.session_number between v_source.session_number and v_class.planned_session_count
  ),
  slots as materialized (
    select s.starts_at, s.ends_at, s.schedule_id
    from public.class_sessions s
    where s.class_id = v_source.class_id
      and s.session_number between v_source.session_number and v_class.planned_session_count
      and s.id <> v_source.id
    union all
    select p_new_starts_at, p_new_ends_at, v_new_schedule_id
  ),
  ordered_slots as (
    select slots.*,
           row_number() over (order by starts_at, ends_at, schedule_id nulls last) as rn
    from slots
  ),
  mapping as (
    select affected.id, ordered_slots.starts_at, ordered_slots.ends_at, ordered_slots.schedule_id
    from affected
    join ordered_slots using (rn)
  )
  update public.class_sessions target
  set starts_at = mapping.starts_at,
      ends_at = mapping.ends_at,
      schedule_id = mapping.schedule_id
  from mapping
  where target.id = mapping.id;

  select jsonb_agg(
           jsonb_build_object(
             'session_id', s.id,
             'session_number', s.session_number,
             'starts_at', s.starts_at,
             'ends_at', s.ends_at,
             'schedule_id', s.schedule_id
           ) order by s.session_number
         )
    into v_after
  from public.class_sessions s
  where s.class_id = v_source.class_id
    and s.session_number between v_source.session_number and v_class.planned_session_count;

  insert into public.class_session_schedule_changes (
    class_id, source_session_id, request_id, reason,
    old_starts_at, old_ends_at, makeup_starts_at, makeup_ends_at,
    affected_session_count, changes, changed_by
  ) values (
    v_source.class_id, v_source.id, p_request_id, v_reason,
    v_source.starts_at, v_source.ends_at, p_new_starts_at, p_new_ends_at,
    v_affected_count, jsonb_build_object('before', v_before, 'after', v_after), auth.uid()
  ) returning id into v_change_id;

  insert into public.notifications (
    user_id, type, title, body, link, resource_type, resource_id, dedupe_key
  )
  select st.user_id,
         'session_changed',
         'Lịch học đã thay đổi',
         format(
           '%s nghỉ ngày %s và học bù ngày %s. Tổng số buổi vẫn giữ nguyên.',
           v_class.name,
           to_char(v_source.starts_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY'),
           to_char(p_new_starts_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')
         ),
         '/student/class',
         'class_session_schedule_change',
         v_change_id,
         format('session-changed:%s:%s', v_change_id, st.user_id)
  from public.enrollments e
  join public.students st on st.id = e.student_id
  where e.class_id = v_source.class_id
    and e.status in ('active', 'paused')
    and st.user_id is not null
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  perform app.write_audit(
    'class.session.reschedule_makeup',
    'class_session',
    v_source.id,
    jsonb_build_object(
      'starts_at', v_source.starts_at,
      'ends_at', v_source.ends_at,
      'session_number', v_source.session_number
    ),
    jsonb_build_object(
      'change_id', v_change_id,
      'request_id', p_request_id,
      'makeup_starts_at', p_new_starts_at,
      'makeup_ends_at', p_new_ends_at,
      'affected_session_count', v_affected_count,
      'reason', v_reason
    )
  );

  return v_affected_count;
end;
$$;

revoke all on function public.reschedule_class_session_with_makeup(
  uuid, timestamptz, timestamptz, text, uuid
) from public, anon;
grant execute on function public.reschedule_class_session_with_makeup(
  uuid, timestamptz, timestamptz, text, uuid
) to authenticated;

comment on function public.reschedule_class_session_with_makeup(
  uuid, timestamptz, timestamptz, text, uuid
) is 'Bỏ ngày nghỉ, thêm ngày bù và dời time slot trên các session hiện hữu; không sinh thêm số buổi.';

-- -----------------------------------------------------------------------------
-- Sửa dữ liệu production 2026-08-12
--
-- User đã xóa Buổi 4 của LOP-02/03 rồi thêm tay ngày bù, tạo dãy
-- 1,2,3,5…36. Chỉ sửa khi CẢ HAI lớp khớp chính xác fingerprint đã đo read-only.
-- Local/DB sạch không có fingerprint này thì bỏ qua.
-- -----------------------------------------------------------------------------
do $data_fix$
declare
  v_bad_classes integer;
  v_class_id uuid;
  v_code text;
  v_expected_makeup_date date;
  v_count integer;
begin
  select count(*)::integer
    into v_bad_classes
  from public.classes c
  where c.code in ('LOP-02', 'LOP-03')
    and c.planned_session_count = 35
    and (select count(*) from public.class_sessions s where s.class_id = c.id) = 35
    and not exists (
      select 1 from public.class_sessions s where s.class_id = c.id and s.session_number = 4
    )
    and exists (
      select 1 from public.class_sessions s where s.class_id = c.id and s.session_number = 36
    );

  if v_bad_classes not in (0, 2) then
    raise exception 'Dữ liệu Buổi 36 chỉ khớp %/2 lớp; dừng để tránh sửa một trạng thái chưa biết', v_bad_classes;
  end if;

  if v_bad_classes = 0 then
    return;
  end if;

  foreach v_code in array array['LOP-02', 'LOP-03']
  loop
    v_expected_makeup_date := case v_code
      when 'LOP-02' then date '2026-12-03'
      else date '2026-12-02'
    end;

    select c.id into strict v_class_id
    from public.classes c
    where c.code = v_code;

    if not exists (
      select 1
      from public.class_sessions s
      where s.class_id = v_class_id
        and s.session_number = 36
        and (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date = v_expected_makeup_date
        and (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::time = time '08:00'
        and (s.ends_at at time zone 'Asia/Ho_Chi_Minh')::time = time '09:30'
    ) then
      raise exception '% / Buổi 36 không còn ở mốc học bù đã xác minh', v_code;
    end if;

    select count(*)::integer into v_count
    from public.class_sessions s
    where s.class_id = v_class_id
      and s.session_number between 5 and 36
      and s.status = 'scheduled'
      and s.lesson_id is null
      and s.topic is null
      and s.lesson_log is null
      and s.teacher_note is null
      and s.completed_at is null
      and s.completed_by is null
      and not exists (
        select 1 from public.attendance_records a where a.session_id = s.id
      );

    if v_count <> 32 then
      raise exception '% chỉ có %/32 buổi tương lai sạch; không tự renumber dữ liệu có lịch sử', v_code, v_count;
    end if;

    -- Tránh va unique (class_id, session_number) trong lúc 5→4, 6→5…36→35.
    update public.class_sessions
    set session_number = -session_number
    where class_id = v_class_id
      and session_number between 5 and 36;

    get diagnostics v_count = row_count;
    if v_count <> 32 then
      raise exception '% chỉ chuyển tạm được %/32 buổi', v_code, v_count;
    end if;

    update public.class_sessions
    set session_number = (-session_number) - 1
    where class_id = v_class_id
      and session_number between -36 and -5;

    get diagnostics v_count = row_count;
    if v_count <> 32 then
      raise exception '% chỉ renumber được %/32 buổi', v_code, v_count;
    end if;

    if (select count(*) from public.class_sessions s where s.class_id = v_class_id) <> 35
       or (select min(session_number) from public.class_sessions s where s.class_id = v_class_id) <> 1
       or (select max(session_number) from public.class_sessions s where s.class_id = v_class_id) <> 35
       or exists (
         select 1
         from generate_series(1, 35) g
         where not exists (
           select 1 from public.class_sessions s
           where s.class_id = v_class_id and s.session_number = g
         )
       ) then
      raise exception '% chưa trở về dãy 1…35 liên tục', v_code;
    end if;

    insert into public.audit_logs(action, resource_type, resource_id, before, after)
    values (
      'class.session.makeup_data_fix',
      'class',
      v_class_id,
      jsonb_build_object('session_numbers', '1,2,3,5…36', 'missing', 4, 'max', 36),
      jsonb_build_object(
        'session_numbers', '1…35',
        'missing', null,
        'max', 35,
        'makeup_date', v_expected_makeup_date,
        'reason', 'User đã xóa Buổi 4 rồi thêm buổi học bù; sửa dãy số, giữ nguyên toàn bộ session_id và điểm danh.'
      )
    );
  end loop;
end;
$data_fix$;

-- Chốt DB cuối cùng: dù client cũ hay request viết thẳng PostgREST, một lớp
-- 35 buổi không thể nhận session_number 36 nữa. Trigger được tạo SAU data-fix
-- vì data-fix dùng số âm tạm thời để tránh va unique khi 5→4…36→35.
create or replace function app.enforce_class_session_number_bounds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_planned integer;
begin
  select c.planned_session_count into v_planned
  from public.classes c
  where c.id = new.class_id;

  if new.session_number <= 0 then
    raise exception 'Số buổi phải lớn hơn 0';
  end if;

  if v_planned is not null and new.session_number > v_planned then
    raise exception 'Lớp chỉ có % buổi; không thể tạo Buổi %', v_planned, new.session_number;
  end if;

  return new;
end;
$$;

create trigger trg_class_sessions_number_bounds
  before insert or update of class_id, session_number on public.class_sessions
  for each row execute function app.enforce_class_session_number_bounds();

revoke all on function app.enforce_class_session_number_bounds() from public, anon, authenticated;
