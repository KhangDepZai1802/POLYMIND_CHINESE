-- =============================================================================
-- 26 — Chấm bài: integrity bài nộp + grade RPC atomic
-- =============================================================================

-- Học viên không được khai sẵn điểm/feedback lúc INSERT. Trigger cũ chỉ chặn
-- UPDATE nên một request INSERT trực tiếp vẫn có thể tự cho mình 100 điểm.
create or replace function app.enforce_submission_initial_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.assignments%rowtype;
  v_enrollment_class_id uuid;
begin
  select * into v_assignment
  from public.assignments
  where id = new.assignment_id;

  select e.class_id into v_enrollment_class_id
  from public.enrollments e
  where e.id = new.enrollment_id;

  if v_assignment.id is null or v_enrollment_class_id is null
     or v_assignment.class_id is distinct from v_enrollment_class_id then
    raise exception 'Bài nộp không khớp lớp của assignment và enrollment';
  end if;

  -- Mọi user flow có JWT (kể cả super admin) đều đi qua cùng trạng thái đầu.
  -- Seed/migration chạy không có auth.uid() vẫn có thể nạp dữ liệu lịch sử.
  if auth.uid() is not null then
    if v_assignment.status <> 'published' or v_assignment.published_at is null then
      raise exception 'Bài tập chưa mở nhận bài nộp';
    end if;

    new.attempt_no := 1;
    new.submitted_at := now();
    new.is_late := v_assignment.due_at is not null and now() > v_assignment.due_at;

    if new.is_late and not v_assignment.allow_late_submission then
      raise exception 'Bài tập đã hết hạn và không cho phép nộp muộn';
    end if;

    new.status := 'submitted';
    new.score := null;
    new.feedback := null;
    new.graded_by := null;
    new.graded_at := null;
  end if;

  return new;
end;
$$;

create trigger trg_submissions_initial_state
  before insert on public.submissions
  for each row execute function app.enforce_submission_initial_state();

-- authenticated chỉ sửa trực tiếp được text_answer. Chấm điểm dùng RPC bên dưới;
-- các cột identity/timestamp/late/status không còn là dữ liệu client tự quyết.
revoke update on public.submissions from authenticated;
grant update (text_answer) on public.submissions to authenticated;

-- Vì teacher và student cùng DB role `authenticated`, column grant một mình chưa
-- đủ: teacher cũng có UPDATE(text_answer). Trigger phân biệt bằng profiles để
-- staff không sửa bằng chứng bài làm; học viên không sửa sau khi đã chấm/đóng.
create or replace function app.prevent_submission_content_tampering()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_assignment_status public.assignment_status;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active;

  if new.text_answer is distinct from old.text_answer then
    if v_role in ('teacher', 'super_admin') then
      raise exception 'Giáo viên/quản trị viên không được sửa nội dung bài làm của học viên';
    end if;

    if v_role = 'student' then
      select a.status into v_assignment_status
      from public.assignments a
      where a.id = old.assignment_id;

      if old.graded_at is not null or v_assignment_status <> 'published' then
        raise exception 'Không thể sửa bài sau khi đã chấm hoặc bài tập đã đóng';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_submissions_no_content_tampering
  before update of text_answer on public.submissions
  for each row execute function app.prevent_submission_content_tampering();

-- Bất kỳ đường ghi grading hợp lệ nào có JWT đều phải attribution về actor thật.
create or replace function app.force_submission_grader()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.score is distinct from old.score
     or new.feedback is distinct from old.feedback
     or new.status is distinct from old.status
     or new.graded_by is distinct from old.graded_by
     or new.graded_at is distinct from old.graded_at then
    if auth.uid() is not null then
      new.graded_by := auth.uid();
      new.graded_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_submissions_grader
  before update of score, feedback, status, graded_by, graded_at on public.submissions
  for each row execute function app.force_submission_grader();

-- File submission phải nằm đúng class/submission. Nếu metadata chấp nhận path
-- khác scope thì giáo viên đúng lớp không ký được URL, hoặc file có thể lộ sang
-- giáo viên của lớp được giả trong segment đầu.
alter table public.submission_files
  add constraint uq_submission_files_object_path unique (object_path);

create or replace function app.enforce_submission_file_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_segments text[];
begin
  select a.class_id into v_class_id
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.id = new.submission_id;

  v_segments := string_to_array(new.object_path, '/');
  if coalesce(array_length(v_segments, 1), 0) <> 3
     or v_segments[1] is distinct from v_class_id::text
     or v_segments[2] is distinct from new.submission_id::text then
    raise exception 'Đường dẫn file bài nộp không đúng lớp hoặc submission';
  end if;

  return new;
end;
$$;

create trigger trg_submission_files_path
  before insert or update on public.submission_files
  for each row execute function app.enforce_submission_file_path();

-- Storage cũng kiểm segment class, không chỉ submission_id ở segment thứ hai.
drop policy "bài nộp: đọc của mình hoặc lớp mình dạy" on storage.objects;
drop policy "bài nộp: học viên tải lên bài của mình" on storage.objects;
drop policy "bài nộp: học viên xóa file bài chưa chấm" on storage.objects;

create policy "bài nộp: đọc đúng lớp và chủ sở hữu" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (
      app.is_super_admin()
      or app.teaches_class(app.storage_root(name)::uuid)
      or exists (
        select 1
        from public.submissions s
        join public.assignments a on a.id = s.assignment_id
        where s.id = (split_part(storage.objects.name, '/', 2))::uuid
          and a.class_id = app.storage_root(storage.objects.name)::uuid
          and app.owns_enrollment(s.enrollment_id)
      )
    )
  );

create policy "bài nộp: học viên tải lên đúng lớp" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (
      app.is_super_admin()
      or exists (
        select 1
        from public.submissions s
        join public.assignments a on a.id = s.assignment_id
        where s.id = (split_part(storage.objects.name, '/', 2))::uuid
          and a.class_id = app.storage_root(storage.objects.name)::uuid
          and a.status = 'published'
          and app.owns_enrollment(s.enrollment_id)
          and s.graded_at is null
      )
    )
  );

create policy "bài nộp: học viên xóa file đúng lớp khi chưa chấm" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (
      app.is_super_admin()
      or exists (
        select 1
        from public.submissions s
        join public.assignments a on a.id = s.assignment_id
        where s.id = (split_part(storage.objects.name, '/', 2))::uuid
          and a.class_id = app.storage_root(storage.objects.name)::uuid
          and app.owns_enrollment(s.enrollment_id)
          and s.graded_at is null
      )
    )
  );

create or replace function public.grade_submission(
  p_submission_id uuid,
  p_score numeric,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.submissions%rowtype;
  v_assignment public.assignments%rowtype;
  v_student_user_id uuid;
  v_before jsonb;
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập';
  end if;

  select * into v_submission
  from public.submissions
  where id = p_submission_id
  for update;

  if v_submission.id is null then
    raise exception 'Không tìm thấy bài nộp';
  end if;

  select * into v_assignment
  from public.assignments
  where id = v_submission.assignment_id;

  if not (app.is_super_admin() or app.teaches_class(v_assignment.class_id)) then
    raise exception 'Không có quyền chấm bài nộp này';
  end if;

  if v_submission.submitted_at is null then
    raise exception 'Học viên chưa nộp bài';
  end if;

  if p_score is null or p_score < 0 or p_score > v_assignment.max_score then
    raise exception 'Điểm phải từ 0 đến %', v_assignment.max_score;
  end if;

  v_before := jsonb_build_object(
    'score', v_submission.score,
    'feedback', v_submission.feedback,
    'status', v_submission.status,
    'graded_by', v_submission.graded_by,
    'graded_at', v_submission.graded_at
  );

  update public.submissions
  set score = p_score,
      feedback = nullif(btrim(p_feedback), ''),
      status = 'graded',
      graded_by = auth.uid(),
      graded_at = now()
  where id = p_submission_id
  returning * into v_submission;

  select st.user_id into v_student_user_id
  from public.enrollments e
  join public.students st on st.id = e.student_id
  where e.id = v_submission.enrollment_id;

  if v_student_user_id is not null then
    insert into public.notifications (
      user_id, type, title, body, link, resource_type, resource_id, dedupe_key
    )
    values (
      v_student_user_id,
      'result_published'::public.notification_type,
      'Đã có điểm: ' || v_assignment.title,
      format('Điểm: %s/%s.', v_submission.score, v_assignment.max_score),
      '/student/assignments/' || v_assignment.id::text,
      'submission',
      v_submission.id,
      'submission_graded:' || v_submission.id::text
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  perform app.write_audit(
    'submission.grade',
    'submission',
    v_submission.id,
    v_before,
    jsonb_build_object(
      'score', v_submission.score,
      'feedback', v_submission.feedback,
      'status', v_submission.status,
      'graded_by', v_submission.graded_by,
      'graded_at', v_submission.graded_at
    )
  );

  return jsonb_build_object(
    'id', v_submission.id,
    'score', v_submission.score,
    'status', v_submission.status,
    'graded_by', v_submission.graded_by,
    'graded_at', v_submission.graded_at
  );
end;
$$;

revoke all on function public.grade_submission(uuid, numeric, text) from public, anon;
grant execute on function public.grade_submission(uuid, numeric, text)
  to authenticated, service_role;
