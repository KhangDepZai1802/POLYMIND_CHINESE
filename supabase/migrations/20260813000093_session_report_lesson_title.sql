-- =============================================================================
-- TEACHER-REPORT-2 — mục 3: "Bài học đã dạy" chuyển sang GIÁO VIÊN TỰ NHẬP
-- =============================================================================
--
-- 🔴 VÌ SAO: bản đầu bắt chọn từ giáo trình (`class_sessions.lesson_id` → bảng
-- `lessons`). Khoá học chưa nhập giáo trình thì ô đó chỉ hiện được câu "Khóa
-- học chưa có bài học" và `lesson_id` KHÔNG BAO GIỜ set được ⇒ mục 3 mãi ở
-- trạng thái "chưa xong" ⇒ nút Gửi báo cáo bị chặn vĩnh viễn. User gặp đúng ca
-- đó trên production 2026-08-13: *"dòng đó khiến tôi không thể lưu báo cáo…
-- dòng đó để giáo viên nhập tay là xong"*.
--
-- Đây là bài học `CR-M14-3` lật ngược: một ràng buộc fail-closed đặt SAI CHỖ.
-- Chặn gửi báo cáo vì thiếu dữ liệu của một module KHÁC (giáo trình) là bắt
-- giáo viên trả giá cho việc quản trị chưa nhập bài học.
--
-- ⛔ KHÔNG đụng `class_sessions.lesson_id`: cột đó vẫn là đường liên kết tiến
-- độ bài học (`lesson_progress`) và vẫn đi qua `save_session_log()`. Biểu mẫu
-- báo cáo thôi không ghi vào nó nữa, chứ cột không bị bỏ và dữ liệu cũ không bị
-- xoá — `saveSessionReportAction` vẫn truyền lại nguyên giá trị đang có.
--
-- Cột mới nằm ở `session_reports` chứ không ở `class_sessions`: đây là câu chữ
-- giáo viên khai trong BÁO CÁO, chụp lại tại thời điểm ký. Ghi vào
-- `class_sessions` là để một bảng dùng chung mang chữ của một biểu mẫu.

alter table public.session_reports
  add column if not exists lesson_title text;

alter table public.session_reports
  drop constraint if exists session_reports_lesson_title_len;
alter table public.session_reports
  add constraint session_reports_lesson_title_len
  check (lesson_title is null or char_length(lesson_title) <= 500);

comment on column public.session_reports.lesson_title is
  'Mục 3 — "Bài học đã dạy", giáo viên tự nhập (TEACHER-REPORT-2). Không tra '
  'bảng lessons: khoá chưa có giáo trình thì báo cáo vẫn phải gửi được. Liên '
  'kết tiến độ bài học vẫn nằm ở class_sessions.lesson_id.';

-- Cột mới trên bảng CŨ nên không cần grant lại (grant ở `…092` là cấp trên
-- BẢNG, không phải trên từng cột). Vẫn đo lại `anon` ở dưới cho chắc.
create or replace function public.save_session_report(
  p_session_id uuid,
  p_form       jsonb,
  p_students   jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id  uuid;
  v_report    public.session_reports%rowtype;
  v_report_id uuid;
begin
  select cs.class_id into v_class_id
  from public.class_sessions cs
  where cs.id = p_session_id;

  if v_class_id is null then
    raise exception 'Không tìm thấy buổi học';
  end if;

  if not (app.teaches_class(v_class_id) or app.is_super_admin()) then
    raise exception 'Không có quyền báo cáo buổi học này';
  end if;

  select * into v_report
  from public.session_reports
  where session_id = p_session_id
  for update;

  if v_report.id is not null and v_report.status = 'submitted' then
    raise exception 'Báo cáo đã gửi, không sửa được nữa';
  end if;

  insert into public.session_reports as r (
    session_id, class_id,
    mode, topic,
    lesson_title,
    plan_completion, has_unfinished, unfinished_content, unfinished_reason,
    has_homework, homework_assigned,
    comprehension_level, interaction_level, focus_level, homework_completion,
    no_students_of_note,
    has_issue, issue_categories, issue_other, issue_description,
    issue_impact, issue_severity,
    next_content, review_content, teacher_watch_note, needs_support, support_request,
    evidence_kinds,
    overall_rating, closing_note,
    confirmed
  )
  values (
    p_session_id, v_class_id,
    (p_form ->> 'mode')::public.session_report_mode,
    nullif(btrim(coalesce(p_form ->> 'topic', '')), ''),
    nullif(btrim(coalesce(p_form ->> 'lesson_title', '')), ''),
    nullif(p_form ->> 'plan_completion', ''),
    (p_form ->> 'has_unfinished')::boolean,
    nullif(btrim(coalesce(p_form ->> 'unfinished_content', '')), ''),
    nullif(btrim(coalesce(p_form ->> 'unfinished_reason', '')), ''),
    (p_form ->> 'has_homework')::boolean,
    nullif(btrim(coalesce(p_form ->> 'homework_assigned', '')), ''),
    (p_form ->> 'comprehension_level')::smallint,
    (p_form ->> 'interaction_level')::smallint,
    (p_form ->> 'focus_level')::smallint,
    nullif(p_form ->> 'homework_completion', ''),
    coalesce((p_form ->> 'no_students_of_note')::boolean, false),
    (p_form ->> 'has_issue')::boolean,
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(p_form -> 'issue_categories')),
      '{}'::text[]
    ),
    nullif(btrim(coalesce(p_form ->> 'issue_other', '')), ''),
    nullif(btrim(coalesce(p_form ->> 'issue_description', '')), ''),
    nullif(p_form ->> 'issue_impact', ''),
    nullif(p_form ->> 'issue_severity', ''),
    nullif(btrim(coalesce(p_form ->> 'next_content', '')), ''),
    nullif(btrim(coalesce(p_form ->> 'review_content', '')), ''),
    nullif(btrim(coalesce(p_form ->> 'teacher_watch_note', '')), ''),
    (p_form ->> 'needs_support')::boolean,
    nullif(btrim(coalesce(p_form ->> 'support_request', '')), ''),
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(p_form -> 'evidence_kinds')),
      '{}'::text[]
    ),
    nullif(p_form ->> 'overall_rating', ''),
    nullif(btrim(coalesce(p_form ->> 'closing_note', '')), ''),
    coalesce((p_form ->> 'confirmed')::boolean, false)
  )
  on conflict (session_id) do update
  set mode = excluded.mode,
      topic = excluded.topic,
      lesson_title = excluded.lesson_title,
      plan_completion = excluded.plan_completion,
      has_unfinished = excluded.has_unfinished,
      unfinished_content = excluded.unfinished_content,
      unfinished_reason = excluded.unfinished_reason,
      has_homework = excluded.has_homework,
      homework_assigned = excluded.homework_assigned,
      comprehension_level = excluded.comprehension_level,
      interaction_level = excluded.interaction_level,
      focus_level = excluded.focus_level,
      homework_completion = excluded.homework_completion,
      no_students_of_note = excluded.no_students_of_note,
      has_issue = excluded.has_issue,
      issue_categories = excluded.issue_categories,
      issue_other = excluded.issue_other,
      issue_description = excluded.issue_description,
      issue_impact = excluded.issue_impact,
      issue_severity = excluded.issue_severity,
      next_content = excluded.next_content,
      review_content = excluded.review_content,
      teacher_watch_note = excluded.teacher_watch_note,
      needs_support = excluded.needs_support,
      support_request = excluded.support_request,
      evidence_kinds = excluded.evidence_kinds,
      overall_rating = excluded.overall_rating,
      closing_note = excluded.closing_note,
      confirmed = excluded.confirmed
  returning r.id into v_report_id;

  -- Danh sách học viên được nhắc tên: thay TOÀN BỘ theo payload. Giáo viên bỏ
  -- một tên ra khỏi form thì hàng đó phải biến mất, nên không dùng upsert.
  delete from public.session_report_students where report_id = v_report_id;

  insert into public.session_report_students (report_id, category, enrollment_id, note)
  select
    v_report_id,
    (item ->> 'category')::public.session_report_student_category,
    (item ->> 'enrollment_id')::uuid,
    nullif(btrim(coalesce(item ->> 'note', '')), '')
  from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) as item
  -- Chỉ nhận học viên THẬT SỰ thuộc lớp này. Thiếu vế này thì giáo viên gọi
  -- thẳng RPC có thể gắn học viên lớp khác vào báo cáo của mình.
  where exists (
    select 1
    from public.enrollments e
    where e.id = (item ->> 'enrollment_id')::uuid
      and e.class_id = v_class_id
  )
  on conflict (report_id, category, enrollment_id) do nothing;

  return v_report_id;
end;
$$;

-- =============================================================================
-- Cổng "phải chọn bài học mới hoàn tất buổi" — nới ĐÚNG chỗ không thoả được
-- =============================================================================
--
-- 🔴 ĐÂY LÀ TẦNG THỨ HAI CỦA CÙNG MỘT LỖI, chỉ lộ ra khi đo bằng trình duyệt.
--
-- `submit_session_report` gọi `save_session_log(..., p_complete => true)` để
-- "gửi báo cáo = hoàn tất buổi" (`D-43` điểm 1, một đường ghi — `BUG_M10_01`).
-- Mà `save_session_log` đòi `p_lesson_id is not null` VÔ ĐIỀU KIỆN. Sau khi mục
-- 3 chuyển sang gõ tay, `lesson_id` là null ⇒ hàm raise ⇒ **cuộn ngược cả giao
-- dịch gửi**: hàng báo cáo vừa được set `submitted` lại quay về `draft`.
--
-- Triệu chứng đúng như user mô tả — "không lưu được báo cáo" — nhưng nguyên
-- nhân nằm ở một RPC KHÁC, và chỉ bài e2e bấm thật mới lộ ra. Bài pgTAP của
-- `…092` không bắt được vì fixture của nó dùng khoá CÓ giáo trình.
--
-- ⛔ KHÔNG bỏ hẳn cổng: khoá có giáo trình mà giáo viên bỏ trống thì vẫn là
-- thiếu sót thật, và tiến độ `lesson_progress` phụ thuộc vào nó.

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

  -- 🔴 TEACHER-REPORT-2 — GỠ HẲN cổng "phải chọn bài học mới hoàn tất buổi".
  --
  -- Cổng cũ đòi `p_lesson_id is not null` vô điều kiện. Nó chặn được đúng một
  -- thứ: giáo viên quên gắn bài. Nhưng nó KHÔNG THOẢ ĐƯỢC khi khoá chưa nhập
  -- giáo trình, và từ khi `submit_session_report` gọi hàm này với
  -- `p_complete => true`, nó kéo theo việc không ai gửi được báo cáo —
  -- raise ở đây cuộn ngược cả giao dịch gửi, hàng `session_reports` vừa được
  -- set `submitted` lại quay về `draft`. Người dùng không có đường tự gỡ.
  --
  -- ⚠️ KHÔNG phải là nới lỏng luồng nhật ký buổi học đứng riêng: màn đó vẫn
  -- đòi bài học ở tầng app (`sessionLogSchema.lesson_id` là `z.uuid()` bắt
  -- buộc), nên bỏ trống vẫn bị chặn trước khi chạm tới RPC.
  --
  -- Điều kiện THẬT của "buổi đã hoàn tất" là có ghi lại đã dạy gì — và vế đó
  -- vẫn nguyên ở ngay dưới (`v_log is null`). `lesson_id` chỉ là đường liên
  -- kết tiến độ, có thì cập nhật `lesson_progress`, không có thì thôi.

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

  -- 🔴 CHỈ ghi tiến độ khi THẬT SỰ có bài học.
  --
  -- `lesson_progress.lesson_id` là NOT NULL. Bỏ cổng "phải chọn bài học" ở trên
  -- mà để nguyên khối này thì hoàn tất buổi không có bài sẽ chết ở
  -- `null value in column "lesson_id" ... violates not-null constraint` —
  -- một lỗi DB thô, không nói được gì cho người dùng, và vẫn cuộn ngược cả
  -- giao dịch gửi báo cáo. Không có bài học thì đơn giản là không có tiến độ
  -- bài nào để cập nhật; `v_progress_count` giữ 0 và audit ghi đúng con số đó.
  if p_complete and p_lesson_id is not null then
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
$function$;

-- =============================================================================
-- ĐO NGAY TRONG MIGRATION — không tin "chắc là ổn"
-- =============================================================================
do $$
declare
  v_anon integer;
begin
  select count(*) into v_anon
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'
    and table_name = 'session_reports';

  if v_anon <> 0 then
    raise exception 'TEACHER-REPORT-2: anon có % quyền trên session_reports', v_anon;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'session_reports'
      and column_name = 'lesson_title'
  ) then
    raise exception 'TEACHER-REPORT-2: chưa thêm được cột lesson_title';
  end if;

  raise notice 'TEACHER-REPORT-2 OK: lesson_title đã có, anon vẫn 0 quyền.';
end;
$$;
