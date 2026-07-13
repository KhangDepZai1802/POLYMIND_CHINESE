-- =============================================================================
-- 13 — RPC (mutation nhiều bảng, cần transaction / locking)
--
-- Vì sao phải là RPC chứ không phải nhiều lệnh insert tuần tự ở JS?
--   → JS không có transaction. Hỏng giữa chừng = dữ liệu rác (enrollment cũ đã
--     đánh dấu `transferred` nhưng enrollment mới chưa tạo → học viên biến mất).
--
-- Mọi RPC: SECURITY DEFINER + SET search_path='' + KIỂM QUYỀN Ở DÒNG ĐẦU.
-- SECURITY DEFINER bỏ qua RLS, nên nếu quên kiểm quyền thì đây là cửa hậu.
-- =============================================================================

-- Sinh mã phiếu thu/thanh toán an toàn khi có nhiều người ghi đồng thời.
-- (Đếm `count(*) + 1` sẽ đụng mã trùng dưới tải song song.)
create sequence if not exists public.tuition_payment_code_seq;
revoke all on sequence public.tuition_payment_code_seq from public, anon;

-- --- Ghi danh -----------------------------------------------------------------
-- Kiểm sĩ số CÓ KHÓA HÀNG.
--
-- Vì sao không kiểm ở app? Hai admin ghi danh đồng thời vào lớp còn đúng 1 chỗ:
-- cả hai cùng đọc "còn 1 chỗ", cả hai cùng insert → lớp thừa người. `FOR UPDATE`
-- buộc người thứ hai chờ người thứ nhất commit xong mới đọc.

create or replace function public.enroll_student(
  p_student_id uuid,
  p_class_id   uuid,
  p_status     public.enrollment_status default 'active',
  p_reason     text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity     integer;
  v_active_count integer;
  v_enrollment_id uuid;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ quản trị viên được ghi danh học viên';
  end if;

  -- Khóa hàng lớp: hai lời gọi đồng thời sẽ tuần tự hóa tại đây.
  select capacity into v_capacity
  from public.classes
  where id = p_class_id
  for update;

  if v_capacity is null then
    raise exception 'Không tìm thấy lớp học';
  end if;

  select count(*) into v_active_count
  from public.enrollments
  where class_id = p_class_id
    and status in ('pending', 'active', 'paused');

  if p_status in ('pending', 'active', 'paused')
     and v_active_count >= v_capacity then
    raise exception 'Lớp đã đủ sĩ số (% / %)', v_active_count, v_capacity;
  end if;

  insert into public.enrollments
    (student_id, class_id, status, reason, created_by,
     started_on)
  values
    (p_student_id, p_class_id, p_status, p_reason, auth.uid(),
     case when p_status = 'active' then current_date end)
  returning id into v_enrollment_id;

  insert into public.enrollment_status_history
    (enrollment_id, old_status, new_status, reason, changed_by)
  values
    (v_enrollment_id, null, p_status, p_reason, auth.uid());

  perform app.write_audit(
    'enrollment.create', 'enrollment', v_enrollment_id,
    null,
    jsonb_build_object('student_id', p_student_id, 'class_id', p_class_id,
                       'status', p_status)
  );

  return v_enrollment_id;
end;
$$;

-- --- Đổi trạng thái ghi danh --------------------------------------------------

create or replace function public.change_enrollment_status(
  p_enrollment_id uuid,
  p_new_status    public.enrollment_status,
  p_reason        text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_status public.enrollment_status;
  v_class_id   uuid;
begin
  -- Giáo viên được phân công cũng xác nhận hoàn thành được (BR-9), nhưng KHÔNG
  -- được làm các thao tác khác (rút học, chuyển lớp là việc của admin).
  select status, class_id into v_old_status, v_class_id
  from public.enrollments
  where id = p_enrollment_id
  for update;

  if v_old_status is null then
    raise exception 'Không tìm thấy bản ghi ghi danh';
  end if;

  if not (
    app.is_super_admin()
    or (p_new_status = 'completed' and app.teaches_class(v_class_id))
  ) then
    raise exception 'Không có quyền đổi trạng thái ghi danh';
  end if;

  if v_old_status in ('completed', 'withdrawn', 'transferred') then
    raise exception 'Ghi danh đã ở trạng thái cuối (%), không đổi được', v_old_status;
  end if;

  update public.enrollments
  set status   = p_new_status,
      reason   = coalesce(p_reason, reason),
      started_on = case
        when p_new_status = 'active' and started_on is null then current_date
        else started_on end,
      ended_on = case
        when p_new_status in ('completed', 'withdrawn') then current_date
        else ended_on end
  where id = p_enrollment_id;

  insert into public.enrollment_status_history
    (enrollment_id, old_status, new_status, reason, changed_by)
  values
    (p_enrollment_id, v_old_status, p_new_status, p_reason, auth.uid());

  perform app.write_audit(
    'enrollment.status_change', 'enrollment', p_enrollment_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status, 'reason', p_reason)
  );
end;
$$;

-- --- Chuyển lớp ---------------------------------------------------------------
-- KHÔNG xóa enrollment cũ. Đánh dấu `transferred` + tạo enrollment mới, trong
-- MỘT transaction. Điểm/điểm danh của lớp cũ Ở LẠI lớp cũ — chuyển lớp không tự
-- động mang chúng sang (nếu cần quy đổi thì đó là thao tác riêng, có audit riêng).

create or replace function public.transfer_enrollment(
  p_enrollment_id uuid,
  p_to_class_id   uuid,
  p_reason        text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id   uuid;
  v_old_status   public.enrollment_status;
  v_from_class   uuid;
  v_capacity     integer;
  v_active_count integer;
  v_new_id       uuid;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ quản trị viên được chuyển lớp';
  end if;

  select student_id, status, class_id
    into v_student_id, v_old_status, v_from_class
  from public.enrollments
  where id = p_enrollment_id
  for update;

  if v_student_id is null then
    raise exception 'Không tìm thấy bản ghi ghi danh';
  end if;

  if v_old_status in ('completed', 'withdrawn', 'transferred') then
    raise exception 'Ghi danh đã ở trạng thái cuối (%), không chuyển lớp được', v_old_status;
  end if;

  if v_from_class = p_to_class_id then
    raise exception 'Lớp đích trùng với lớp hiện tại';
  end if;

  -- Kiểm sĩ số lớp ĐÍCH, có khóa hàng.
  select capacity into v_capacity
  from public.classes where id = p_to_class_id for update;

  if v_capacity is null then
    raise exception 'Không tìm thấy lớp đích';
  end if;

  select count(*) into v_active_count
  from public.enrollments
  where class_id = p_to_class_id and status in ('pending', 'active', 'paused');

  if v_active_count >= v_capacity then
    raise exception 'Lớp đích đã đủ sĩ số (% / %)', v_active_count, v_capacity;
  end if;

  -- 1) Đóng enrollment cũ (KHÔNG xóa)
  update public.enrollments
  set status = 'transferred', ended_on = current_date, reason = p_reason
  where id = p_enrollment_id;

  insert into public.enrollment_status_history
    (enrollment_id, old_status, new_status, reason, changed_by)
  values
    (p_enrollment_id, v_old_status, 'transferred', p_reason, auth.uid());

  -- 2) Mở enrollment mới ở lớp đích
  insert into public.enrollments
    (student_id, class_id, status, reason, created_by, started_on)
  values
    (v_student_id, p_to_class_id, 'active', p_reason, auth.uid(), current_date)
  returning id into v_new_id;

  insert into public.enrollment_status_history
    (enrollment_id, old_status, new_status, reason, changed_by)
  values
    (v_new_id, null, 'active', p_reason, auth.uid());

  perform app.write_audit(
    'enrollment.transfer', 'enrollment', p_enrollment_id,
    jsonb_build_object('class_id', v_from_class, 'status', v_old_status),
    jsonb_build_object('class_id', p_to_class_id, 'new_enrollment_id', v_new_id)
  );

  return v_new_id;
end;
$$;

-- --- Sinh buổi học từ lịch lặp ------------------------------------------------
-- IDEMPOTENT: chạy lại KHÔNG sinh buổi trùng (nhờ unique (class_id, session_number)
-- + ON CONFLICT DO NOTHING), và dừng đúng ở planned_session_count.
--
-- Lớp KHÔNG có lịch lặp (LOP-01 — theo lịch Ban Giám đốc VCB) → trả về 0.
-- Đó là kết quả HỢP LỆ, không phải lỗi.

create or replace function public.generate_class_sessions(p_class_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class          public.classes%rowtype;
  v_tz             text := 'Asia/Ho_Chi_Minh';
  v_existing       integer;
  v_next_number    integer;
  v_created        integer := 0;
  v_cursor_date    date;
  v_max_date       date;
  v_schedule       record;
  v_starts_at      timestamptz;
  v_ends_at        timestamptz;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ quản trị viên được sinh buổi học';
  end if;

  select * into v_class from public.classes where id = p_class_id for update;

  if v_class.id is null then
    raise exception 'Không tìm thấy lớp học';
  end if;

  if v_class.planned_session_count is null then
    raise exception 'Lớp chưa cấu hình số buổi dự kiến';
  end if;

  if v_class.start_date is null then
    raise exception 'Lớp chưa có ngày bắt đầu';
  end if;

  -- Lớp linh hoạt: không có lịch lặp → không sinh gì, và đó không phải lỗi.
  if not exists (select 1 from public.class_schedules where class_id = p_class_id) then
    return 0;
  end if;

  select count(*), coalesce(max(session_number), 0) + 1
    into v_existing, v_next_number
  from public.class_sessions
  where class_id = p_class_id;

  if v_existing >= v_class.planned_session_count then
    return 0;   -- đã đủ buổi
  end if;

  v_cursor_date := v_class.start_date;
  -- Chặn trên an toàn: 2 năm. Nếu lịch cấu hình sai (vd weekday không bao giờ
  -- khớp), vòng lặp phải dừng thay vì chạy vô hạn.
  v_max_date := v_class.start_date + interval '2 years';

  while v_existing + v_created < v_class.planned_session_count
        and v_cursor_date <= v_max_date
  loop
    for v_schedule in
      select * from public.class_schedules
      where class_id = p_class_id
        and (effective_from is null or v_cursor_date >= effective_from)
        and (effective_to   is null or v_cursor_date <= effective_to)
        and weekday = extract(isodow from v_cursor_date)
      order by start_time
    loop
      exit when v_existing + v_created >= v_class.planned_session_count;

      -- Giờ địa phương (Asia/Ho_Chi_Minh) → UTC. DB luôn lưu UTC.
      v_starts_at := (v_cursor_date + v_schedule.start_time) at time zone v_tz;
      v_ends_at   := (v_cursor_date + v_schedule.end_time)   at time zone v_tz;

      insert into public.class_sessions
        (class_id, schedule_id, session_number, starts_at, ends_at, created_by)
      values
        (p_class_id, v_schedule.id, v_next_number + v_created,
         v_starts_at, v_ends_at, auth.uid())
      on conflict (class_id, session_number) do nothing;

      if found then
        v_created := v_created + 1;
      end if;
    end loop;

    v_cursor_date := v_cursor_date + 1;
  end loop;

  perform app.write_audit(
    'class.generate_sessions', 'class', p_class_id,
    null, jsonb_build_object('created', v_created)
  );

  return v_created;
end;
$$;

-- --- Điểm danh hàng loạt ------------------------------------------------------
-- UPSERT theo (session_id, enrollment_id). Giáo viên bấm Lưu 2 lần → vẫn 1 bản
-- ghi/học viên. Idempotency được cưỡng chế ở DB, không phải bằng disable nút.
--
-- p_records: jsonb array [{"enrollment_id": "...", "status": "present", "note": "..."}]

create or replace function public.bulk_mark_attendance(
  p_session_id uuid,
  p_records    jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_count    integer := 0;
  v_rec      jsonb;
begin
  select class_id into v_class_id
  from public.class_sessions where id = p_session_id;

  if v_class_id is null then
    raise exception 'Không tìm thấy buổi học';
  end if;

  if not (app.is_super_admin() or app.teaches_class(v_class_id)) then
    raise exception 'Không có quyền điểm danh buổi học này';
  end if;

  for v_rec in select * from jsonb_array_elements(p_records)
  loop
    insert into public.attendance_records
      (session_id, enrollment_id, status, note, marked_by, marked_at)
    values
      (p_session_id,
       (v_rec ->> 'enrollment_id')::uuid,
       (v_rec ->> 'status')::public.attendance_status,
       nullif(v_rec ->> 'note', ''),
       auth.uid(),      -- ACTOR THẬT, không phải "user đầu tiên"
       now())
    on conflict (session_id, enrollment_id) do update
      set status    = excluded.status,
          note      = excluded.note,
          marked_by = excluded.marked_by,
          marked_at = excluded.marked_at;

    v_count := v_count + 1;
  end loop;

  perform app.write_audit(
    'attendance.bulk_mark', 'class_session', p_session_id,
    null, jsonb_build_object('count', v_count)
  );

  return v_count;
end;
$$;

-- --- Công bố kết quả kiểm tra -------------------------------------------------
-- Draft → publish là hành động RIÊNG. Set published_at hàng loạt + sinh thông báo,
-- trong một transaction.

create or replace function public.publish_assessment_results(p_assessment_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_title    text;
  v_count    integer := 0;
begin
  select class_id, title into v_class_id, v_title
  from public.assessments where id = p_assessment_id;

  if v_class_id is null then
    raise exception 'Không tìm thấy bài kiểm tra';
  end if;

  if not (app.is_super_admin() or app.teaches_class(v_class_id)) then
    raise exception 'Không có quyền công bố kết quả bài kiểm tra này';
  end if;

  update public.assessment_results
  set published_at = now()
  where assessment_id = p_assessment_id
    and published_at is null;

  get diagnostics v_count = row_count;

  update public.assessments
  set published_at = coalesce(published_at, now())
  where id = p_assessment_id;

  -- Thông báo cho học viên có kết quả. dedupe_key chống sinh trùng khi publish lại.
  insert into public.notifications
    (user_id, type, title, body, link, resource_type, resource_id, dedupe_key)
  select
    s.user_id,
    'result_published',
    'Kết quả đã được công bố',
    format('Kết quả bài "%s" đã có.', v_title),
    '/student/results',
    'assessment',
    p_assessment_id,
    format('result_published:%s:%s', p_assessment_id, s.user_id)
  from public.assessment_results r
  join public.enrollments e on e.id = r.enrollment_id
  join public.students s on s.id = e.student_id
  where r.assessment_id = p_assessment_id
    and s.user_id is not null
  on conflict do nothing;

  perform app.write_audit(
    'assessment.publish', 'assessment', p_assessment_id,
    null, jsonb_build_object('published_results', v_count)
  );

  return v_count;
end;
$$;

-- --- Ghi nhận thanh toán ------------------------------------------------------
-- MỘT transaction: payment + cập nhật status hóa đơn + sinh ĐÚNG MỘT phiếu thu
-- + thông báo.
--
-- Chốt chặn cuối chống phiếu thu trùng là UNIQUE trên tuition_receipts.payment_id,
-- không phải một câu `if exists` ở app (app-level check luôn thua race).

create or replace function public.record_tuition_payment(
  p_invoice_id uuid,
  p_amount     numeric,
  p_method     public.payment_method,
  p_paid_at    timestamptz default now(),
  p_reference  text default null,
  p_note       text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice    public.tuition_invoices%rowtype;
  v_payment_id uuid;
  v_receipt_id uuid;
  v_paid_total numeric(14, 2);
  v_new_status public.invoice_status;
  v_student_user uuid;
  v_seq        bigint;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ quản trị viên được ghi nhận thanh toán';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Số tiền thanh toán phải lớn hơn 0';
  end if;

  select * into v_invoice
  from public.tuition_invoices where id = p_invoice_id for update;

  if v_invoice.id is null then
    raise exception 'Không tìm thấy hóa đơn';
  end if;

  if v_invoice.status in ('cancelled', 'refunded') then
    raise exception 'Hóa đơn đã % — không ghi nhận thanh toán được', v_invoice.status;
  end if;

  v_seq := nextval('public.tuition_payment_code_seq');

  insert into public.tuition_payments
    (payment_code, invoice_id, student_id, amount, paid_at, method,
     reference, note, recorded_by)
  values
    (format('TT%s-%s', to_char(now(), 'YYMM'), lpad(v_seq::text, 6, '0')),
     p_invoice_id, v_invoice.student_id, p_amount, p_paid_at, p_method,
     p_reference, p_note, auth.uid())
  returning id into v_payment_id;

  select coalesce(sum(amount), 0) into v_paid_total
  from public.tuition_payments where invoice_id = p_invoice_id;

  v_new_status := case
    when v_paid_total >= v_invoice.total then 'paid'
    when v_paid_total > 0 then 'partial'
    else v_invoice.status
  end;

  update public.tuition_invoices
  set status = v_new_status
  where id = p_invoice_id;

  -- ĐÚNG MỘT phiếu thu cho mỗi payment. UNIQUE(payment_id) là chốt chặn.
  insert into public.tuition_receipts
    (receipt_code, payment_id, issued_by, snapshot)
  values
    (format('PT%s-%s', to_char(now(), 'YYMM'), lpad(v_seq::text, 6, '0')),
     v_payment_id, auth.uid(),
     jsonb_build_object(
       'invoice_code', v_invoice.invoice_code,
       'amount', p_amount,
       'paid_at', p_paid_at,
       'method', p_method,
       'invoice_total', v_invoice.total,
       'paid_total', v_paid_total
     ))
  returning id into v_receipt_id;

  select user_id into v_student_user
  from public.students where id = v_invoice.student_id;

  if v_student_user is not null then
    insert into public.notifications
      (user_id, type, title, body, link, resource_type, resource_id, dedupe_key)
    values
      (v_student_user, 'invoice_new', 'Đã ghi nhận thanh toán',
       format('Đã ghi nhận thanh toán cho hóa đơn %s.', v_invoice.invoice_code),
       '/student/profile', 'tuition_payment', v_payment_id,
       format('payment_recorded:%s', v_payment_id))
    on conflict do nothing;
  end if;

  perform app.write_audit(
    'tuition.record_payment', 'tuition_invoice', p_invoice_id,
    jsonb_build_object('status', v_invoice.status),
    jsonb_build_object('status', v_new_status, 'amount', p_amount,
                       'payment_id', v_payment_id, 'receipt_id', v_receipt_id)
  );

  return v_payment_id;
end;
$$;

-- --- Quyền thực thi -----------------------------------------------------------
-- `anon` KHÔNG gọi được RPC nào.

revoke all on function public.enroll_student(uuid, uuid, public.enrollment_status, text) from public, anon;
revoke all on function public.change_enrollment_status(uuid, public.enrollment_status, text) from public, anon;
revoke all on function public.transfer_enrollment(uuid, uuid, text) from public, anon;
revoke all on function public.generate_class_sessions(uuid) from public, anon;
revoke all on function public.bulk_mark_attendance(uuid, jsonb) from public, anon;
revoke all on function public.publish_assessment_results(uuid) from public, anon;
revoke all on function public.record_tuition_payment(uuid, numeric, public.payment_method, timestamptz, text, text) from public, anon;

grant execute on function public.enroll_student(uuid, uuid, public.enrollment_status, text) to authenticated;
grant execute on function public.change_enrollment_status(uuid, public.enrollment_status, text) to authenticated;
grant execute on function public.transfer_enrollment(uuid, uuid, text) to authenticated;
grant execute on function public.generate_class_sessions(uuid) to authenticated;
grant execute on function public.bulk_mark_attendance(uuid, jsonb) to authenticated;
grant execute on function public.publish_assessment_results(uuid) to authenticated;
grant execute on function public.record_tuition_payment(uuid, numeric, public.payment_method, timestamptz, text, text) to authenticated;
