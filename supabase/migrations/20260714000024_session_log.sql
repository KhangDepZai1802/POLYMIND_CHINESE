-- =============================================================================
-- 24 — Nhật ký buổi học + tiến độ bài học (P4-T3)
--
-- Một lần hoàn tất buổi phải ghi đồng thời:
--   1. nội dung thực dạy + lesson + actor/thời điểm hoàn tất trên class_sessions
--   2. lesson_progress của mọi enrollment đang mở trong lớp
--
-- Hai phần này không được tách thành nhiều request vì request thứ hai lỗi sẽ để
-- session đã hoàn tất nhưng progress chưa cập nhật. RPC giữ chúng trong một
-- transaction và khóa row session để hai lần bấm không giẫm lên nhau.
-- =============================================================================

create or replace function public.save_session_log(
  p_session_id  uuid,
  p_lesson_id   uuid,
  p_lesson_log  text,
  p_teacher_note text,
  p_complete    boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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

  if not (app.is_super_admin() or app.teaches_class(v_session.class_id)) then
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
$$;

-- Giáo viên chỉ cập nhật session qua RPC ở trên. Nếu còn UPDATE policy trực tiếp,
-- client có thể set status='completed' mà không tạo lesson_progress trong cùng
-- transaction. Admin vẫn có policy toàn quyền cho công cụ quản trị lịch.
drop policy if exists "giáo viên cập nhật buổi lớp mình" on public.class_sessions;

-- Vẫn cho giáo viên tạo buổi linh hoạt, nhưng row mới phải là scheduled và chưa
-- được tự khai nội dung/actor hoàn tất. Nhật ký đi qua save_session_log().
drop policy if exists "giáo viên tạo buổi cho lớp mình" on public.class_sessions;
create policy "giáo viên tạo buổi cho lớp mình" on public.class_sessions
  for insert to authenticated
  with check (
    app.teaches_class(class_id)
    and status = 'scheduled'
    and lesson_log is null
    and teacher_note is null
    and completed_at is null
    and completed_by is null
  );

revoke all on function public.save_session_log(uuid, uuid, text, text, boolean)
  from public, anon;
grant execute on function public.save_session_log(uuid, uuid, text, text, boolean)
  to authenticated;

