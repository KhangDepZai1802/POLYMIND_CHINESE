-- =============================================================================
-- 88 — Role "Giáo vụ": 26 RPC nghiệp vụ đổi cổng sang `app.is_manager()`
--
-- Task `GIAOVU-1c`, quyết định `D-2` (user chốt 2026-08-03).
--
-- -----------------------------------------------------------------------------
-- VÌ SAO PHẢI CÓ FILE NÀY
--
-- `…087` mới mở RLS. Nhưng phần lớn thao tác GHI của hệ này không đi thẳng vào
-- bảng — nó đi qua RPC `security definer`, và mỗi RPC tự gác bằng
-- `app.is_super_admin()` BÊN TRONG THÂN HÀM. `security definer` chạy dưới quyền
-- chủ hàm nên RLS không đụng tới được: mở policy mà không sửa thân hàm thì giáo
-- vụ vào được đủ 9 trang, thấy đủ dữ liệu, và bấm nút nào cũng bị từ chối.
--
-- 48 hàm đang nhắc `is_super_admin`. Chia đôi:
--   26 hàm nghiệp vụ  → `is_manager()`  (file này)
--   22 hàm flashcard/ngân hàng câu hỏi → GIỮ NGUYÊN (user chốt điểm 3)
--
-- -----------------------------------------------------------------------------
-- VÌ SAO THÂN HÀM Ở ĐÂY LÀ BẢN SINH TỰ ĐỘNG
--
-- Thân 26 hàm này dài ~1.530 dòng. Gõ tay lại từng hàm là 1.530 cơ hội để lỡ
-- tay đổi một dấu, và cái sai đó sẽ không bị bài kiểm nào bắt vì nó nằm trong
-- nghiệp vụ chứ không nằm ở cổng quyền.
--
-- Nên: lấy `pg_get_functiondef()` của bản đang chạy rồi thay ĐÚNG MỘT chuỗi
-- `app.is_super_admin()` → `app.is_manager()`. Cách này chứng minh được là
-- không có thay đổi nào khác lọt vào — điều mà bản gõ tay không chứng minh nổi.
--
-- Ngoài phép thay đó, chỉ sửa thêm 4 câu thông báo lỗi đang nói
-- "Chỉ super admin…" — để nguyên thì thông báo nói sai sự thật kể từ hôm nay.
--
-- ⚠️ Định dạng vì thế là dạng chuẩn hoá của Postgres (`CREATE OR REPLACE
-- FUNCTION`, chữ hoa, thụt lề khác bản gốc), KHÔNG phải phong cách viết tay của
-- các migration trước. Comment trong thân hàm được giữ nguyên vẹn.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.protect_notification_preference()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Service role / migration giữ khả năng nạp dữ liệu. User flow luôn gắn với
  -- actor thật; không cho client bật kênh email chưa được triển khai.
  if auth.uid() is not null and not app.is_manager() then
    if tg_op = 'INSERT' then
      new.user_id := auth.uid();
      new.email_enabled := false;
    else
      if new.user_id is distinct from old.user_id
         or new.type is distinct from old.type then
        raise exception 'Không được đổi chủ sở hữu hoặc loại tùy chọn thông báo';
      end if;
      new.email_enabled := old.email_enabled;
    end if;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bulk_mark_attendance(p_session_id uuid, p_records jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if not (app.is_manager() or app.teaches_class(v_class_id)) then
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
$function$
;

CREATE OR REPLACE FUNCTION public.change_enrollment_status(p_enrollment_id uuid, p_new_status enrollment_status, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    app.is_manager()
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_exam_delivery(p_class_id uuid, p_set_version_id uuid, p_title text, p_exam_type assessment_type, p_opens_at timestamp with time zone, p_closes_at timestamp with time zone, p_duration_minutes integer, p_passing_score numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_id uuid;
begin perform app.require_assessment_author(); if not app.is_manager() and not app.teaches_class(p_class_id) then raise exception 'Không phụ trách lớp này'; end if; if not exists(select 1 from public.question_set_versions sv join public.question_sets s on s.id=sv.question_set_id where sv.id=p_set_version_id and sv.locked_at is not null and s.kind='exam') then raise exception 'Bộ đề chưa được khóa'; end if;
insert into public.exam_deliveries(class_id,set_version_id,title,exam_type,opens_at,closes_at,duration_minutes,passing_score,created_by) values(p_class_id,p_set_version_id,trim(p_title),p_exam_type,p_opens_at,p_closes_at,p_duration_minutes,p_passing_score,auth.uid()) returning id into v_id; return v_id; end $function$
;

CREATE OR REPLACE FUNCTION public.create_exercise_delivery(p_class_id uuid, p_set_version_id uuid, p_title text, p_available_from timestamp with time zone, p_due_at timestamp with time zone, p_max_score numeric, p_attempt_limit integer DEFAULT 1, p_allow_late boolean DEFAULT false, p_late_penalty numeric DEFAULT 0, p_result_release result_release_mode DEFAULT 'manual'::result_release_mode, p_answer_release answer_release_mode DEFAULT 'with_results'::answer_release_mode)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_id uuid;
begin
  perform app.require_assessment_author();
  if not app.is_manager() and not app.teaches_class(p_class_id) then raise exception 'Không phụ trách lớp này'; end if;
  if not exists(select 1 from public.question_set_versions sv join public.question_sets s on s.id=sv.question_set_id where sv.id=p_set_version_id and sv.locked_at is not null and s.kind='exercise') then raise exception 'Bộ bài tập chưa được khóa'; end if;
  insert into public.exercise_deliveries(class_id,set_version_id,title,available_from,due_at,max_score,attempt_limit,allow_late_submission,late_penalty_percent,result_release_mode,answer_release_mode,created_by)
  values(p_class_id,p_set_version_id,trim(p_title),p_available_from,p_due_at,p_max_score,p_attempt_limit,p_allow_late,p_late_penalty,p_result_release,p_answer_release,auth.uid()) returning id into v_id; return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.delete_tuition_invoice_draft(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_invoice public.tuition_invoices%rowtype;
begin
  if not app.is_manager() then
    raise exception 'Chỉ quản trị viên được xóa hóa đơn nháp';
  end if;

  select * into v_invoice
  from public.tuition_invoices
  where id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'Không tìm thấy hóa đơn';
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'Chỉ hóa đơn nháp mới được xóa';
  end if;

  delete from public.tuition_invoices where id = p_invoice_id;

  perform app.write_audit(
    'tuition.invoice.delete_draft', 'tuition_invoice', p_invoice_id,
    jsonb_build_object(
      'invoice_code', v_invoice.invoice_code,
      'student_id', v_invoice.student_id,
      'total', v_invoice.total,
      'status', v_invoice.status
    ),
    null
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enroll_student(p_student_id uuid, p_class_id uuid, p_status enrollment_status DEFAULT 'active'::enrollment_status, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_capacity      integer;
  v_active_count  integer;
  v_enrollment_id uuid;
  v_open_class    text;
begin
  if not app.is_manager() then
    raise exception 'Chỉ quản trị viên được ghi danh học viên';
  end if;

  -- Học viên đã có lớp đang mở chưa?
  -- Kiểm ở đây để BÁO LỖI DỄ HIỂU. Chốt chặn thật vẫn là unique index bên dưới —
  -- kiểm ở app không chặn được hai request đồng thời.
  select c.code into v_open_class
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  where e.student_id = p_student_id
    and e.status in ('pending', 'active', 'paused')
  limit 1;

  if v_open_class is not null then
    raise exception
      'Học viên đang học lớp %. Mỗi học viên chỉ học một lớp tại một thời điểm — hãy hoàn thành, rút học, hoặc chuyển lớp trước.',
      v_open_class;
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
    (student_id, class_id, status, reason, created_by, started_on)
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
$function$
;

CREATE OR REPLACE FUNCTION public.expire_announcement(p_announcement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_announcement public.announcements%rowtype;
  v_expires_at timestamptz;
begin
  if not app.is_manager() then
    raise exception 'Chỉ quản trị viên hoặc giáo vụ được kết thúc announcement';
  end if;

  select * into v_announcement
  from public.announcements
  where id = p_announcement_id
  for update;

  if not found then
    raise exception 'Announcement không tồn tại';
  end if;
  if v_announcement.published_at is null then
    raise exception 'Announcement chưa phát hành';
  end if;
  if v_announcement.expires_at is not null
     and v_announcement.expires_at <= clock_timestamp() then
    raise exception 'Announcement đã hết hiệu lực';
  end if;

  v_expires_at := greatest(
    v_announcement.published_at + interval '1 microsecond',
    clock_timestamp() - interval '1 microsecond'
  );

  update public.announcements
  set expires_at = v_expires_at
  where id = p_announcement_id;

  perform app.write_audit(
    'announcement.expire',
    'announcement',
    p_announcement_id,
    jsonb_build_object('expires_at', v_announcement.expires_at),
    jsonb_build_object('expires_at', v_expires_at)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_class_sessions(p_class_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not app.is_manager() then
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
$function$
;

CREATE OR REPLACE FUNCTION public.grade_exam_answer(p_answer_id uuid, p_score numeric, p_feedback text DEFAULT NULL::text, p_override_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_class uuid;
  v_points numeric;
  v_attempt uuid;
  v_before jsonb;
begin
  perform app.require_assessment_author();
  select d.class_id, i.points, a.attempt_id, to_jsonb(a)
  into v_class, v_points, v_attempt, v_before
  from public.exam_answers a
  join public.exam_attempts ea on ea.id = a.attempt_id
  join public.exam_deliveries d on d.id = ea.exam_delivery_id
  join public.question_set_items i on i.id = a.set_item_id
  where a.id = p_answer_id;

  if v_class is null or (not app.is_manager() and not app.teaches_class(v_class)) then
    raise exception 'Không có quyền chấm';
  end if;
  if p_score < 0 or p_score > v_points then
    raise exception 'Điểm vượt giới hạn câu';
  end if;

  update public.exam_answers
  set manual_score = p_score,
      final_score = p_score,
      feedback = nullif(trim(p_feedback), ''),
      override_reason = nullif(trim(p_override_reason), ''),
      graded_by = auth.uid(),
      graded_at = clock_timestamp()
  where id = p_answer_id;

  perform app.recalculate_exam_attempt(v_attempt);
  perform app.write_audit(
    'exam.answer.grade',
    'exam_answer',
    p_answer_id,
    v_before,
    (select to_jsonb(a) from public.exam_answers a where a.id = p_answer_id)
  );
end
$function$
;

CREATE OR REPLACE FUNCTION public.grade_exercise_answer(p_answer_id uuid, p_score numeric, p_feedback text DEFAULT NULL::text, p_override_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_class uuid; v_points numeric; v_attempt uuid;
begin perform app.require_assessment_author(); select d.class_id,i.points,a.attempt_id into v_class,v_points,v_attempt from public.exercise_answers a join public.exercise_attempts ea on ea.id=a.attempt_id join public.exercise_deliveries d on d.id=ea.delivery_id join public.question_set_items i on i.id=a.set_item_id where a.id=p_answer_id; if v_class is null or (not app.is_manager() and not app.teaches_class(v_class)) then raise exception 'Không có quyền chấm'; end if; if p_score<0 or p_score>v_points then raise exception 'Điểm vượt giới hạn câu'; end if;
update public.exercise_answers set manual_score=p_score,final_score=p_score,feedback=p_feedback,override_reason=p_override_reason,graded_by=auth.uid(),graded_at=clock_timestamp() where id=p_answer_id;
update public.exercise_attempts ea set raw_score=x.total,final_score=round(x.total/nullif(sv.raw_max_score,0)*d.max_score,2),status=(case when x.pending=0 then 'graded' else 'pending_manual_grading' end)::public.attempt_status,graded_at=case when x.pending=0 then clock_timestamp() else null end from (select attempt_id,sum(coalesce(final_score,0)) total,count(*) filter(where final_score is null) pending from public.exercise_answers where attempt_id=v_attempt group by attempt_id)x,public.exercise_deliveries d,public.question_set_versions sv where ea.id=v_attempt and d.id=ea.delivery_id and sv.id=d.set_version_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.invalidate_exam_attempt(p_attempt_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if not app.is_active() or not app.is_manager() then raise exception 'Chỉ quản trị viên hoặc giáo vụ'; end if; update public.exam_attempts set status='invalidated',invalidated_at=clock_timestamp(),invalidated_reason=nullif(trim(p_reason),'') where id=p_attempt_id and status<>'invalidated'; if not found then raise exception 'Không tìm thấy lượt thi hợp lệ'; end if; perform app.write_audit('exam.attempt.invalidate','exam_attempt',p_attempt_id,null,jsonb_build_object('reason',p_reason)); end $function$
;

CREATE OR REPLACE FUNCTION public.issue_tuition_invoice(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_invoice public.tuition_invoices%rowtype;
  v_student_user uuid;
begin
  if not app.is_manager() then
    raise exception 'Chỉ quản trị viên được phát hành hóa đơn';
  end if;

  select * into v_invoice
  from public.tuition_invoices
  where id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'Không tìm thấy hóa đơn';
  end if;

  if v_invoice.status = 'draft' then
    if not exists (
      select 1 from public.tuition_invoice_items where invoice_id = p_invoice_id
    ) then
      raise exception 'Hóa đơn chưa có khoản mục';
    end if;

    update public.tuition_invoices
    set status = 'issued'
    where id = p_invoice_id;

    select user_id into v_student_user
    from public.students
    where id = v_invoice.student_id;

    if v_student_user is not null then
      insert into public.notifications (
        user_id, type, title, body, link,
        resource_type, resource_id, dedupe_key
      )
      values (
        v_student_user,
        'invoice_new',
        'Hóa đơn học phí mới',
        format('Hóa đơn %s đã được phát hành.', v_invoice.invoice_code),
        '/student',
        'tuition_invoice',
        p_invoice_id,
        format('invoice_new:%s', p_invoice_id)
      )
      on conflict do nothing;
    end if;

    perform app.write_audit(
      'tuition.invoice.issue', 'tuition_invoice', p_invoice_id,
      jsonb_build_object('status', 'draft'),
      jsonb_build_object('status', 'issued', 'total', v_invoice.total)
    );
  elsif v_invoice.status not in ('issued', 'partial', 'paid', 'overdue') then
    raise exception 'Không thể phát hành hóa đơn ở trạng thái %', v_invoice.status;
  end if;

  return jsonb_build_object(
    'invoice_id', p_invoice_id,
    'status', case when v_invoice.status = 'draft' then 'issued' else v_invoice.status end
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.lock_exam_results(p_delivery_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_class uuid;
begin
  perform app.require_assessment_author();
  select class_id into v_class from public.exam_deliveries where id=p_delivery_id for update;
  if v_class is null or (not app.is_manager() and not app.teaches_class(v_class)) then raise exception 'Không có quyền khóa điểm'; end if;
  if exists(select 1 from public.exam_attempts where exam_delivery_id=p_delivery_id and status in ('in_progress','pending_manual_grading')) then raise exception 'Còn lượt thi chưa nộp hoặc câu chưa chấm'; end if;
  update public.exam_deliveries set status='grading' where id=p_delivery_id and status<>'results_published';
end $function$
;

CREATE OR REPLACE FUNCTION public.publish_announcement(p_announcement_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_announcement public.announcements%rowtype;
  v_published_at timestamptz := clock_timestamp();
  v_notification_count integer := 0;
begin
  if not app.is_manager() then
    raise exception 'Chỉ quản trị viên hoặc giáo vụ được phát hành announcement';
  end if;

  select * into v_announcement
  from public.announcements
  where id = p_announcement_id
  for update;

  if not found then
    raise exception 'Announcement không tồn tại';
  end if;
  if v_announcement.published_at is not null then
    raise exception 'Announcement đã được phát hành';
  end if;
  if v_announcement.expires_at is not null
     and v_announcement.expires_at <= v_published_at then
    raise exception 'Thời điểm hết hạn phải sau thời điểm phát hành';
  end if;

  update public.announcements
  set published_at = v_published_at
  where id = p_announcement_id;

  with recipients as (
    select profile.id, profile.role
    from public.profiles profile
    where profile.is_active
      and profile.role in ('teacher', 'student')
      and (
        v_announcement.class_id is null
        or (
          profile.role = 'teacher'
          and exists (
            select 1
            from public.teachers teacher
            join public.class_teachers assignment
              on assignment.teacher_id = teacher.id
            where teacher.user_id = profile.id
              and assignment.class_id = v_announcement.class_id
          )
        )
        or (
          profile.role = 'student'
          and exists (
            select 1
            from public.students student
            join public.enrollments enrollment
              on enrollment.student_id = student.id
            where student.user_id = profile.id
              and enrollment.class_id = v_announcement.class_id
              and enrollment.status in ('active', 'paused', 'completed')
          )
        )
      )
  )
  insert into public.notifications (
    user_id, type, title, body, link,
    resource_type, resource_id, dedupe_key
  )
  select
    recipient.id,
    'announcement',
    v_announcement.title,
    v_announcement.body,
    case recipient.role
      when 'teacher' then '/teacher/notifications'
      when 'student' then '/student/notifications'
      else null
    end,
    'announcement',
    p_announcement_id,
    'announcement:' || p_announcement_id::text
  from recipients recipient
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics v_notification_count = row_count;

  perform app.write_audit(
    'announcement.publish',
    'announcement',
    p_announcement_id,
    jsonb_build_object('published_at', null),
    jsonb_build_object(
      'published_at', v_published_at,
      'notification_count', v_notification_count
    )
  );

  return v_notification_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.publish_evaluation(p_evaluation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_evaluation public.learning_evaluations%rowtype;
  v_class_id uuid;
  v_student_user_id uuid;
  v_was_published timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập';
  end if;

  select * into v_evaluation
  from public.learning_evaluations
  where id = p_evaluation_id
  for update;

  if v_evaluation.id is null then
    raise exception 'Không tìm thấy đánh giá';
  end if;

  select e.class_id, s.user_id into v_class_id, v_student_user_id
  from public.enrollments e
  join public.students s on s.id = e.student_id
  where e.id = v_evaluation.enrollment_id;

  if not (app.is_manager() or app.teaches_class(v_class_id)) then
    raise exception 'Không có quyền công bố đánh giá này';
  end if;

  v_was_published := v_evaluation.published_at;

  update public.learning_evaluations
  set published_at = coalesce(published_at, now()),
      visible_to_student = true
  where id = p_evaluation_id
  returning * into v_evaluation;

  if v_student_user_id is not null then
    insert into public.notifications (
      user_id, type, title, body, link, resource_type, resource_id, dedupe_key
    )
    values (
      v_student_user_id,
      'result_published'::public.notification_type,
      'Đánh giá học tập mới',
      'Giáo viên đã gửi bản đánh giá học tập của bạn.',
      '/student/evaluations',
      'learning_evaluation',
      v_evaluation.id,
      'evaluation_published:' || v_evaluation.id::text
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  perform app.write_audit(
    'evaluation.publish',
    'learning_evaluation',
    v_evaluation.id,
    jsonb_build_object('published_at', v_was_published),
    jsonb_build_object(
      'published_at', v_evaluation.published_at,
      'visible_to_student', v_evaluation.visible_to_student
    )
  );

  return jsonb_build_object(
    'id', v_evaluation.id,
    'published_at', v_evaluation.published_at,
    'visible_to_student', v_evaluation.visible_to_student,
    'already_published', v_was_published is not null
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.publish_exam_delivery(p_delivery_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_class uuid;
begin
  perform app.require_assessment_author(); select class_id into v_class from public.exam_deliveries where id=p_delivery_id for update;
  if v_class is null or (not app.is_manager() and not app.teaches_class(v_class)) then raise exception 'Không tìm thấy kỳ thi'; end if;
  update public.exam_deliveries set status='scheduled',published_at=clock_timestamp() where id=p_delivery_id and status='draft';
  insert into public.notifications(user_id,type,title,body,link,resource_type,resource_id,dedupe_key)
  select s.user_id,'exam_scheduled','Lịch kỳ thi mới',d.title,'/student/exams','exam_delivery',d.id,'exam-scheduled:'||d.id
  from public.exam_deliveries d join public.enrollments e on e.class_id=d.class_id and e.status='active' join public.students s on s.id=e.student_id
  where d.id=p_delivery_id and s.user_id is not null on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
end $function$
;

CREATE OR REPLACE FUNCTION public.publish_exam_results(p_delivery_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_class uuid;v_status public.exam_delivery_status;v_count integer;
begin
  perform app.require_assessment_author();
  select class_id,status into v_class,v_status from public.exam_deliveries where id=p_delivery_id for update;
  if v_class is null or (not app.is_manager() and not app.teaches_class(v_class)) then raise exception 'Không có quyền công bố'; end if;
  if v_status='results_published' then return 0; end if;
  if v_status<>'grading' then raise exception 'Phải khóa điểm trước khi công bố'; end if;
  update public.exam_deliveries set status='results_published',results_published_at=clock_timestamp() where id=p_delivery_id;
  get diagnostics v_count=row_count;
  insert into public.notifications(user_id,type,title,body,link,resource_type,resource_id,dedupe_key)
  select s.user_id,'exam_result_published','Kết quả kỳ thi',d.title,'/student/exams','exam_delivery',d.id,'exam-result:'||d.id
  from public.exam_deliveries d join public.enrollments e on e.class_id=d.class_id and e.status in ('active','paused') join public.students s on s.id=e.student_id
  where d.id=p_delivery_id and s.user_id is not null on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
  return v_count;
end $function$
;

CREATE OR REPLACE FUNCTION public.publish_exercise_delivery(p_delivery_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_class uuid;
begin perform app.require_assessment_author(); select class_id into v_class from public.exercise_deliveries where id=p_delivery_id for update; if v_class is null or (not app.is_manager() and not app.teaches_class(v_class)) then raise exception 'Không tìm thấy lần giao'; end if;
update public.exercise_deliveries set status=(case when available_from>clock_timestamp() then 'scheduled' else 'open' end)::public.exercise_delivery_status,published_at=clock_timestamp() where id=p_delivery_id and status='draft';
insert into public.notifications(user_id,type,title,body,link,resource_type,resource_id,dedupe_key)
select s.user_id,'exercise_assigned','Bài tập mới',d.title,'/student/exercises/'||d.id,'exercise_delivery',d.id,'exercise-assigned:'||d.id
from public.exercise_deliveries d join public.enrollments e on e.class_id=d.class_id and e.status in ('active','paused') join public.students s on s.id=e.student_id where d.id=p_delivery_id and s.user_id is not null on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
end $function$
;

CREATE OR REPLACE FUNCTION public.publish_exercise_results(p_delivery_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_class uuid;
  v_count integer;
begin
  perform app.require_assessment_author();
  select class_id into v_class from public.exercise_deliveries where id = p_delivery_id for update;
  if v_class is null or (not app.is_manager() and not app.teaches_class(v_class)) then
    raise exception 'Không có quyền công bố';
  end if;
  if exists(select 1 from public.exercise_attempts where delivery_id = p_delivery_id and status = 'pending_manual_grading') then
    raise exception 'Còn câu chưa chấm';
  end if;

  update public.exercise_attempts
  set results_published_at = clock_timestamp()
  where delivery_id = p_delivery_id and status = 'graded' and results_published_at is null;
  get diagnostics v_count = row_count;
  update public.exercise_deliveries set status = 'results_published' where id = p_delivery_id;

  insert into public.notifications(user_id, type, title, body, link, resource_type, resource_id, dedupe_key)
  select s.user_id, 'exercise_result_published', 'Kết quả bài tập', d.title,
         '/student/exercises', 'exercise_delivery', d.id, 'exercise-result:' || d.id
  from public.exercise_deliveries d
  join public.enrollments e on e.class_id = d.class_id and e.status in ('active', 'paused')
  join public.students s on s.id = e.student_id
  where d.id = p_delivery_id and s.user_id is not null
  on conflict(user_id, dedupe_key) where dedupe_key is not null do nothing;
  return v_count;
end
$function$
;

CREATE OR REPLACE FUNCTION public.record_tuition_payment(p_invoice_id uuid, p_amount numeric, p_method payment_method, p_paid_at timestamp with time zone DEFAULT now(), p_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_invoice    public.tuition_invoices%rowtype;
  v_payment_id uuid;
  v_receipt_id uuid;
  v_paid_total numeric(14, 2);
  v_new_status public.invoice_status;
  v_student_user uuid;
  v_seq        bigint;
begin
  if not app.is_manager() then
    raise exception 'Chỉ quản trị viên được ghi nhận thanh toán';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Số tiền thanh toán phải lớn hơn 0';
  end if;

  select * into v_invoice
  from public.tuition_invoices
  where id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'Không tìm thấy hóa đơn';
  end if;

  if v_invoice.status = 'draft' then
    raise exception 'Hóa đơn chưa phát hành — không thể ghi nhận thanh toán';
  end if;
  if v_invoice.status = 'paid' then
    raise exception 'Hóa đơn đã thanh toán đủ';
  end if;
  if v_invoice.status in ('cancelled', 'refunded') then
    raise exception 'Hóa đơn đã % — không ghi nhận thanh toán được', v_invoice.status;
  end if;
  if v_invoice.status not in ('issued', 'partial', 'overdue') then
    raise exception 'Trạng thái hóa đơn không cho phép thanh toán';
  end if;

  v_seq := nextval('public.tuition_payment_code_seq');

  insert into public.tuition_payments (
    payment_code, invoice_id, student_id, amount, paid_at, method,
    reference, note, recorded_by
  )
  values (
    format('TT%s-%s', to_char(p_paid_at, 'YYMM'), lpad(v_seq::text, 6, '0')),
    p_invoice_id, v_invoice.student_id, p_amount, p_paid_at, p_method,
    nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), auth.uid()
  )
  returning id into v_payment_id;

  select coalesce(sum(amount), 0) into v_paid_total
  from public.tuition_payments
  where invoice_id = p_invoice_id;

  v_new_status := case
    when v_paid_total >= v_invoice.total then 'paid'
    else 'partial'
  end;

  update public.tuition_invoices
  set status = v_new_status
  where id = p_invoice_id;

  insert into public.tuition_receipts (
    receipt_code, payment_id, issued_by, snapshot
  )
  values (
    format('PT%s-%s', to_char(p_paid_at, 'YYMM'), lpad(v_seq::text, 6, '0')),
    v_payment_id,
    auth.uid(),
    jsonb_build_object(
      'invoice_code', v_invoice.invoice_code,
      'amount', p_amount,
      'paid_at', p_paid_at,
      'method', p_method,
      'invoice_total', v_invoice.total,
      'paid_total', v_paid_total
    )
  )
  returning id into v_receipt_id;

  select user_id into v_student_user
  from public.students
  where id = v_invoice.student_id;

  if v_student_user is not null then
    insert into public.notifications (
      user_id, type, title, body, link, resource_type, resource_id, dedupe_key
    )
    values (
      v_student_user,
      'invoice_new',
      'Đã ghi nhận thanh toán',
      format('Đã ghi nhận thanh toán cho hóa đơn %s.', v_invoice.invoice_code),
      '/student/profile',
      'tuition_payment',
      v_payment_id,
      format('payment_recorded:%s', v_payment_id)
    )
    on conflict do nothing;
  end if;

  perform app.write_audit(
    'tuition.record_payment', 'tuition_invoice', p_invoice_id,
    jsonb_build_object('status', v_invoice.status),
    jsonb_build_object(
      'status', v_new_status,
      'amount', p_amount,
      'payment_id', v_payment_id,
      'receipt_id', v_receipt_id
    )
  );

  return v_payment_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.run_exam_regrade(p_delivery_id uuid, p_reason text, p_rule_override jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_class uuid;
  v_answer record;
  v_score numeric;
  v_correct boolean;
  v_manual boolean;
  v_before jsonb;
  v_after jsonb;
begin
  perform app.require_assessment_author();
  select class_id into v_class from public.exam_deliveries where id = p_delivery_id;
  if v_class is null or (not app.is_manager() and not app.teaches_class(v_class)) then
    raise exception 'Không có quyền chấm lại';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Phải nhập lý do chấm lại';
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
  into v_before
  from public.exam_attempts a
  where a.exam_delivery_id = p_delivery_id;

  insert into public.exam_regrade_runs(
    exam_delivery_id, reason, rule_override, started_by, status
  ) values (
    p_delivery_id, trim(p_reason), coalesce(p_rule_override, '{}'::jsonb), auth.uid(), 'running'
  ) returning id into v_id;

  for v_answer in
    select a.id, a.attempt_id, a.set_item_id, a.answer_payload, a.manual_score
    from public.exam_answers a
    join public.exam_attempts ea on ea.id = a.attempt_id
    where ea.exam_delivery_id = p_delivery_id
    for update of a
  loop
    if v_answer.manual_score is null then
      select score, is_correct, requires_manual
      into v_score, v_correct, v_manual
      from app.auto_score_answer(v_answer.set_item_id, v_answer.answer_payload);
      update public.exam_answers
      set auto_score = v_score,
          final_score = case when v_manual then null else v_score end,
          is_correct = v_correct
      where id = v_answer.id;
    end if;
  end loop;

  for v_answer in
    select id from public.exam_attempts where exam_delivery_id = p_delivery_id
  loop
    perform app.recalculate_exam_attempt(v_answer.id);
  end loop;

  update public.exam_regrade_runs
  set status = 'completed', completed_at = clock_timestamp()
  where id = v_id;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
  into v_after
  from public.exam_attempts a
  where a.exam_delivery_id = p_delivery_id;

  perform app.write_audit(
    'exam.regrade',
    'exam_delivery',
    p_delivery_id,
    v_before,
    jsonb_build_object('run_id', v_id, 'reason', trim(p_reason), 'attempts', v_after)
  );
  return v_id;
exception when others then
  if v_id is not null then
    update public.exam_regrade_runs set status = 'failed', completed_at = clock_timestamp() where id = v_id;
  end if;
  raise;
end
$function$
;

CREATE OR REPLACE FUNCTION public.save_announcement(p_title text, p_body text, p_class_id uuid DEFAULT NULL::uuid, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_announcement_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_announcement public.announcements%rowtype;
  v_id uuid;
  v_title text := nullif(btrim(p_title), '');
  v_body text := nullif(btrim(p_body), '');
begin
  if not app.is_manager() then
    raise exception 'Chỉ quản trị viên hoặc giáo vụ được quản lý announcement';
  end if;

  if v_title is null or char_length(v_title) > 200 then
    raise exception 'Tiêu đề announcement phải có từ 1 đến 200 ký tự';
  end if;
  if v_body is null or char_length(v_body) > 5000 then
    raise exception 'Nội dung announcement phải có từ 1 đến 5000 ký tự';
  end if;

  if p_class_id is not null
     and not exists (select 1 from public.classes where id = p_class_id) then
    raise exception 'Lớp nhận announcement không tồn tại';
  end if;

  if p_announcement_id is null then
    insert into public.announcements (
      class_id, title, body, expires_at, created_by
    )
    values (
      p_class_id, v_title, v_body, p_expires_at, auth.uid()
    )
    returning id into v_id;
  else
    select * into v_announcement
    from public.announcements
    where id = p_announcement_id
    for update;

    if not found then
      raise exception 'Announcement không tồn tại';
    end if;
    if v_announcement.published_at is not null then
      raise exception 'Announcement đã phát hành — không thể sửa';
    end if;

    update public.announcements
    set class_id = p_class_id,
        title = v_title,
        body = v_body,
        expires_at = p_expires_at
    where id = p_announcement_id;

    v_id := p_announcement_id;
  end if;

  perform app.write_audit(
    case when p_announcement_id is null
      then 'announcement.create_draft'
      else 'announcement.update_draft'
    end,
    'announcement',
    v_id,
    null,
    jsonb_build_object(
      'title', v_title,
      'class_id', p_class_id,
      'expires_at', p_expires_at
    )
  );

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_session_log(p_session_id uuid, p_lesson_id uuid, p_lesson_log text, p_teacher_note text, p_complete boolean)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session        public.class_sessions%rowtype;
  v_course_id      uuid;
  v_log            text;
  v_note           text;
  v_progress_count integer := 0;
  v_now            timestamptz := now();
begin
  select * into v_session
  from public.class_sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Không tìm thấy buổi học';
  end if;

  if not (app.is_manager() or app.teaches_class(v_session.class_id)) then
    raise exception 'Không có quyền cập nhật nhật ký buổi học này';
  end if;

  v_log := nullif(btrim(coalesce(p_lesson_log, '')), '');
  v_note := nullif(btrim(coalesce(p_teacher_note, '')), '');

  if char_length(coalesce(v_log, '')) > 5000 then
    raise exception 'Nội dung thực dạy không được vượt quá 5000 ký tự';
  end if;

  if char_length(coalesce(v_note, '')) > 2000 then
    raise exception 'Ghi chú giáo viên không được vượt quá 2000 ký tự';
  end if;

  select course_id into v_course_id
  from public.classes
  where id = v_session.class_id;

  if p_lesson_id is not null and not exists (
    select 1
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    where l.id = p_lesson_id
      and m.course_id = v_course_id
  ) then
    raise exception 'Bài học không thuộc khóa học của lớp';
  end if;

  -- Request hoàn tất bị gửi lại với đúng payload: trả kết quả hiện có, không
  -- ghi đè completed_at/updated_by và không sinh thêm audit row.
  if v_session.status = 'completed' then
    if p_complete
       and v_session.lesson_id is not distinct from p_lesson_id
       and v_session.lesson_log is not distinct from v_log
       and v_session.teacher_note is not distinct from v_note then
      select count(*)::integer into v_progress_count
      from public.lesson_progress lp
      join public.enrollments e on e.id = lp.enrollment_id
      where e.class_id = v_session.class_id
        and e.status in ('pending', 'active', 'paused')
        and lp.lesson_id = v_session.lesson_id
        and lp.status = 'completed';

      return v_progress_count;
    end if;

    raise exception 'Buổi học đã hoàn tất, không thể ghi đè lịch sử';
  end if;

  if v_session.status in ('cancelled', 'rescheduled') then
    raise exception 'Buổi học đã hủy hoặc đổi lịch, không thể ghi nhật ký';
  end if;

  if p_complete and p_lesson_id is null then
    raise exception 'Chọn bài học đã dạy trước khi hoàn tất buổi';
  end if;

  if p_complete and v_log is null then
    raise exception 'Nhập nội dung thực dạy trước khi hoàn tất buổi';
  end if;

  update public.class_sessions
  set lesson_id   = p_lesson_id,
      lesson_log  = v_log,
      teacher_note = v_note,
      status       = case when p_complete then 'completed'::public.session_status else status end,
      completed_at = case when p_complete then v_now else completed_at end,
      completed_by = case when p_complete then auth.uid() else completed_by end
  where id = p_session_id;

  if p_complete then
    insert into public.lesson_progress
      (enrollment_id, lesson_id, status, completed_at, updated_by)
    select
      e.id,
      p_lesson_id,
      'completed'::public.lesson_progress_status,
      v_now,
      auth.uid()
    from public.enrollments e
    where e.class_id = v_session.class_id
      and e.status in ('pending', 'active', 'paused')
    on conflict (enrollment_id, lesson_id) do update
      set status       = 'completed'::public.lesson_progress_status,
          completed_at = coalesce(public.lesson_progress.completed_at, excluded.completed_at),
          updated_by   = case
            when public.lesson_progress.status = 'completed'
              then public.lesson_progress.updated_by
            else excluded.updated_by
          end;

    get diagnostics v_progress_count = row_count;
  end if;

  perform app.write_audit(
    case when p_complete then 'session.complete' else 'session.log_save' end,
    'class_session',
    p_session_id,
    jsonb_build_object(
      'status', v_session.status,
      'lesson_id', v_session.lesson_id
    ),
    jsonb_build_object(
      'status', case when p_complete then 'completed' else v_session.status::text end,
      'lesson_id', p_lesson_id,
      'progress_updated', v_progress_count
    )
  );

  return v_progress_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_tuition_invoice(p_student_id uuid, p_issue_date date, p_discount numeric, p_items jsonb, p_invoice_id uuid DEFAULT NULL::uuid, p_enrollment_id uuid DEFAULT NULL::uuid, p_due_date date DEFAULT NULL::date, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_invoice       public.tuition_invoices%rowtype;
  v_invoice_id    uuid;
  v_class_id      uuid;
  v_enrollment_student_id uuid;
  v_subtotal      numeric(14, 2);
  v_total         numeric(14, 2);
  v_item_count    integer;
  v_seq           bigint;
  v_before        jsonb;
begin
  if not app.is_manager() then
    raise exception 'Chỉ quản trị viên được quản lý hóa đơn';
  end if;

  if p_student_id is null
     or not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'Không tìm thấy học viên';
  end if;

  if p_issue_date is null then
    raise exception 'Ngày lập hóa đơn là bắt buộc';
  end if;

  if p_due_date is not null and p_due_date < p_issue_date then
    raise exception 'Hạn thanh toán không được trước ngày lập hóa đơn';
  end if;

  if p_discount is null or p_discount < 0 then
    raise exception 'Giảm trừ không được âm';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Danh sách khoản mục không hợp lệ';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'Hóa đơn phải có từ 1 đến 50 khoản mục';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      description text,
      quantity numeric,
      unit_amount numeric
    )
    where nullif(btrim(item.description), '') is null
       or item.quantity is null or item.quantity <= 0
       or item.unit_amount is null or item.unit_amount < 0
  ) then
    raise exception 'Khoản mục phải có nội dung, số lượng dương và đơn giá không âm';
  end if;

  select coalesce(sum(round(item.quantity * item.unit_amount, 2)), 0)
  into v_subtotal
  from jsonb_to_recordset(p_items) as item(
    description text,
    quantity numeric,
    unit_amount numeric
  );

  if v_subtotal > 999999999999.99 then
    raise exception 'Tạm tính vượt giới hạn cho phép';
  end if;

  if p_discount > v_subtotal then
    raise exception 'Giảm trừ không được vượt tạm tính';
  end if;
  v_total := v_subtotal - p_discount;

  if p_enrollment_id is not null then
    select student_id, class_id
    into v_enrollment_student_id, v_class_id
    from public.enrollments
    where id = p_enrollment_id;

    if v_enrollment_student_id is null then
      raise exception 'Không tìm thấy ghi danh';
    end if;
    if v_enrollment_student_id <> p_student_id then
      raise exception 'Ghi danh không thuộc học viên đã chọn';
    end if;
  end if;

  if p_invoice_id is null then
    v_seq := nextval('public.tuition_invoice_code_seq');
    insert into public.tuition_invoices (
      invoice_code, student_id, enrollment_id, class_id,
      issue_date, due_date, subtotal, discount, total, status, note, created_by
    )
    values (
      format('HD%s-%s', to_char(p_issue_date, 'YYMM'), lpad(v_seq::text, 6, '0')),
      p_student_id, p_enrollment_id, v_class_id,
      p_issue_date, p_due_date, v_subtotal, p_discount, v_total,
      'draft', nullif(btrim(p_note), ''), auth.uid()
    )
    returning id into v_invoice_id;
  else
    select * into v_invoice
    from public.tuition_invoices
    where id = p_invoice_id
    for update;

    if v_invoice.id is null then
      raise exception 'Không tìm thấy hóa đơn';
    end if;
    if v_invoice.status <> 'draft' then
      raise exception 'Chỉ hóa đơn nháp mới được chỉnh sửa';
    end if;

    v_before := jsonb_build_object(
      'student_id', v_invoice.student_id,
      'enrollment_id', v_invoice.enrollment_id,
      'issue_date', v_invoice.issue_date,
      'due_date', v_invoice.due_date,
      'subtotal', v_invoice.subtotal,
      'discount', v_invoice.discount,
      'total', v_invoice.total
    );

    update public.tuition_invoices
    set student_id = p_student_id,
        enrollment_id = p_enrollment_id,
        class_id = v_class_id,
        issue_date = p_issue_date,
        due_date = p_due_date,
        subtotal = v_subtotal,
        discount = p_discount,
        total = v_total,
        note = nullif(btrim(p_note), '')
    where id = p_invoice_id;

    delete from public.tuition_invoice_items where invoice_id = p_invoice_id;
    v_invoice_id := p_invoice_id;
  end if;

  insert into public.tuition_invoice_items (
    invoice_id, description, quantity, unit_amount, line_total
  )
  select
    v_invoice_id,
    btrim(item.description),
    item.quantity,
    item.unit_amount,
    round(item.quantity * item.unit_amount, 2)
  from jsonb_to_recordset(p_items) as item(
    description text,
    quantity numeric,
    unit_amount numeric
  );

  perform app.write_audit(
    case when p_invoice_id is null then 'tuition.invoice.create'
         else 'tuition.invoice.update' end,
    'tuition_invoice',
    v_invoice_id,
    v_before,
    jsonb_build_object(
      'student_id', p_student_id,
      'enrollment_id', p_enrollment_id,
      'issue_date', p_issue_date,
      'due_date', p_due_date,
      'subtotal', v_subtotal,
      'discount', p_discount,
      'total', v_total,
      'item_count', v_item_count,
      'status', 'draft'
    )
  );

  return v_invoice_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.transfer_enrollment(p_enrollment_id uuid, p_to_class_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_student_id   uuid;
  v_old_status   public.enrollment_status;
  v_from_class   uuid;
  v_capacity     integer;
  v_active_count integer;
  v_new_id       uuid;
begin
  if not app.is_manager() then
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
$function$
;

-- =============================================================================
-- CỔNG FAIL-CLOSED
--
-- Cùng hình dạng với cổng của `…085` và `…087`. Điều kiện:
--   • KHÔNG còn hàm nghiệp vụ nào gác bằng `is_super_admin` (sót ⇒ giáo vụ gặp
--     nút bấm không ăn, rất khó truy vì trang vẫn hiện đủ dữ liệu)
--   • Nhóm flashcard/câu hỏi VẪN gác bằng `is_super_admin` (mất ⇒ vừa cấp cho
--     giáo vụ đúng hai thứ user loại ra ở điểm 3)
-- =============================================================================

do $$
declare
  v_business text[];
  v_kept     integer;
begin
  select coalesce(array_agg(n.nspname || '.' || p.proname order by 1), '{}')
    into v_business
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prosrc like '%is_super_admin%'
    and p.proname !~ 'flashcard|question'
    and n.nspname in ('app', 'public');

  if array_length(v_business, 1) > 0 then
    raise exception
      'GIAOVU-1c: còn % hàm nghiệp vụ gác bằng is_super_admin(): %',
      array_length(v_business, 1), array_to_string(v_business, ', ');
  end if;

  select count(*) into v_kept
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prosrc like '%is_super_admin%'
    and p.proname ~ 'flashcard|question'
    and n.nspname in ('app', 'public');

  if v_kept <> 23 then
    raise exception
      'GIAOVU-1c: nhóm flashcard/câu hỏi phải còn ĐÚNG 23 hàm gác bằng is_super_admin(), đang là %. '
      'Ít hơn = vừa cấp quyền user đã loại ở điểm 3.', v_kept;
  end if;

  raise notice 'GIAOVU-1c OK: 26 hàm nghiệp vụ sang is_manager(), 23 hàm flashcard/câu hỏi giữ nguyên.';
end;
$$;
