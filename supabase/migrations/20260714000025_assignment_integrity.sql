-- =============================================================================
-- 25 — Assignment: toàn vẹn, attribution, publish atomic và Storage fail-closed
-- =============================================================================

-- Một object chỉ được gắn vào đúng một metadata row. UUID trong path đã do server
-- sinh nên trùng path là dấu hiệu client gửi lại ticket cũ hoặc request bị replay.
alter table public.assignment_attachments
  add constraint uq_assignment_attachments_object_path unique (object_path);

-- `created_by` và `uploaded_by` là actor thật. Client có khai UUID khác thì DB
-- ghi đè; UPDATE không được đổi lịch sử attribution.
create or replace function app.force_assignment_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_by := old.created_by;
  end if;

  return new;
end;
$$;

create trigger trg_assignments_actor
  before insert or update on public.assignments
  for each row execute function app.force_assignment_actor();

create or replace function app.enforce_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
  v_lesson_course_id uuid;
  v_session_class_id uuid;
begin
  select c.course_id into v_course_id
  from public.classes c
  where c.id = new.class_id;

  if new.lesson_id is not null then
    select cm.course_id into v_lesson_course_id
    from public.lessons l
    join public.course_modules cm on cm.id = l.module_id
    where l.id = new.lesson_id;

    if v_lesson_course_id is distinct from v_course_id then
      raise exception 'Bài học không thuộc khóa học của lớp';
    end if;
  end if;

  if new.session_id is not null then
    select cs.class_id into v_session_class_id
    from public.class_sessions cs
    where cs.id = new.session_id;

    if v_session_class_id is distinct from new.class_id then
      raise exception 'Buổi học không thuộc lớp của bài tập';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_assignments_scope
  before insert or update of class_id, lesson_id, session_id on public.assignments
  for each row execute function app.enforce_assignment_scope();

-- INSERT luôn là draft. Publish/close là hành động tách biệt qua RPC bên dưới.
-- Trigger vẫn giữ invariant nếu mutation chạy từ service role hoặc SQL nội bộ.
create or replace function app.enforce_assignment_publication_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.published_at := null;
    return new;
  end if;

  if new.status = 'draft' then
    new.published_at := null;
  elsif new.status = 'published' then
    if old.status = 'closed' then
      raise exception 'Bài tập đã đóng, không thể mở lại';
    end if;
    new.published_at := coalesce(old.published_at, new.published_at, now());
  elsif new.status = 'closed' then
    if old.status = 'draft' then
      raise exception 'Bài tập nháp phải được publish trước khi đóng';
    end if;
    new.published_at := old.published_at;
  end if;

  return new;
end;
$$;

create trigger trg_assignments_publication_state
  before insert or update of status, published_at on public.assignments
  for each row execute function app.enforce_assignment_publication_state();

-- Chỉ draft chưa có lịch sử mới được hard-delete. Bài đã giao phải chuyển sang
-- `closed`; nếu không, ON DELETE CASCADE sẽ cuốn theo bài nộp và file metadata.
create or replace function app.prevent_assignment_history_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.published_at is not null
     or exists (
       select 1 from public.submissions s where s.assignment_id = old.id
     ) then
    raise exception 'Không thể xóa bài tập đã giao hoặc đã có bài nộp. Hãy đóng bài để giữ lịch sử.';
  end if;

  return old;
end;
$$;

create trigger trg_assignments_keep_history
  before delete on public.assignments
  for each row execute function app.prevent_assignment_history_delete();

create or replace function app.enforce_assignment_attachment_integrity()
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
  from public.assignments a
  where a.id = new.assignment_id;

  v_segments := string_to_array(new.object_path, '/');
  if coalesce(array_length(v_segments, 1), 0) <> 3
     or v_segments[1] is distinct from v_class_id::text
     or v_segments[2] is distinct from new.assignment_id::text then
    raise exception 'Đường dẫn file bài tập không đúng lớp hoặc bài tập';
  end if;

  if tg_op = 'INSERT' then
    new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
  else
    new.uploaded_by := old.uploaded_by;
  end if;

  return new;
end;
$$;

create trigger trg_assignment_attachments_integrity
  before insert or update on public.assignment_attachments
  for each row execute function app.enforce_assignment_attachment_integrity();

-- Storage phải soi metadata + trạng thái publish, giống hệt RLS bảng. Policy cũ
-- chỉ soi class_id nên học viên đoán được path có thể tải file của bài còn draft.
drop policy "file bài tập: đọc lớp liên quan" on storage.objects;

create policy "file bài tập: đọc đúng phạm vi publish" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assignment-files'
    and (
      app.is_super_admin()
      or app.teaches_class(app.storage_root(name)::uuid)
      or exists (
        select 1
        from public.assignment_attachments aa
        join public.assignments a on a.id = aa.assignment_id
        where aa.object_path = storage.objects.name
          and a.published_at is not null
          and app.studies_class(a.class_id)
      )
    )
  );

-- authenticated không được đổi status/published_at bằng table API. Các cột nội
-- dung vẫn CRUD theo RLS; publish/close phải đi qua RPC để notification không bị
-- bỏ quên và toàn bộ thao tác là một transaction.
revoke update on public.assignments from authenticated;
grant update (
  title,
  instructions,
  due_at,
  max_score,
  allow_late_submission,
  max_attempts,
  lesson_id,
  session_id
) on public.assignments to authenticated;

-- `closed` phải có hiệu lực ở DB, không chỉ ẩn nút Nộp. Policy cũ chỉ kiểm
-- published_at nên bài đã đóng vẫn nhận submission mới qua API trực tiếp.
drop policy "học viên nộp bài của mình" on public.submissions;

create policy "học viên nộp bài của mình" on public.submissions
  for insert to authenticated
  with check (
    app.owns_enrollment(enrollment_id)
    and exists (
      select 1
      from public.assignments a
      join public.enrollments e on e.id = enrollment_id
      where a.id = assignment_id
        and a.status = 'published'
        and a.published_at is not null
        and a.class_id = e.class_id
    )
  );

create or replace function public.publish_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.assignments%rowtype;
  v_class_code text;
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập';
  end if;

  select a.*
  into v_assignment
  from public.assignments a
  where a.id = p_assignment_id
  for update;

  if v_assignment.id is null then
    raise exception 'Không tìm thấy bài tập';
  end if;

  if not (app.is_super_admin() or app.teaches_class(v_assignment.class_id)) then
    raise exception 'Không có quyền publish bài tập này';
  end if;

  select c.code into v_class_code
  from public.classes c
  where c.id = v_assignment.class_id;

  if v_assignment.status = 'closed' then
    raise exception 'Bài tập đã đóng, không thể publish lại';
  end if;

  update public.assignments
  set status = 'published',
      published_at = coalesce(published_at, now())
  where id = p_assignment_id
  returning * into v_assignment;

  insert into public.notifications (
    user_id, type, title, body, link, resource_type, resource_id, dedupe_key
  )
  select distinct
    s.user_id,
    'assignment_new'::public.notification_type,
    'Bài tập mới: ' || v_assignment.title,
    'Lớp ' || v_class_code || ' vừa có bài tập mới.',
    '/student/assignments/' || v_assignment.id::text,
    'assignment',
    v_assignment.id,
    'assignment_new:' || v_assignment.id::text
  from public.enrollments e
  join public.students s on s.id = e.student_id
  where e.class_id = v_assignment.class_id
    and e.status in ('active', 'paused', 'completed')
    and s.user_id is not null
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  perform app.write_audit(
    'assignment.publish',
    'assignment',
    v_assignment.id,
    null,
    jsonb_build_object('status', v_assignment.status, 'published_at', v_assignment.published_at)
  );

  return jsonb_build_object(
    'id', v_assignment.id,
    'status', v_assignment.status,
    'published_at', v_assignment.published_at
  );
end;
$$;

create or replace function public.close_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.assignments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập';
  end if;

  select * into v_assignment
  from public.assignments
  where id = p_assignment_id
  for update;

  if v_assignment.id is null then
    raise exception 'Không tìm thấy bài tập';
  end if;

  if not (app.is_super_admin() or app.teaches_class(v_assignment.class_id)) then
    raise exception 'Không có quyền đóng bài tập này';
  end if;

  if v_assignment.status = 'draft' then
    raise exception 'Bài tập nháp chưa cần đóng; có thể sửa hoặc xóa bản nháp';
  end if;

  update public.assignments
  set status = 'closed'
  where id = p_assignment_id
  returning * into v_assignment;

  perform app.write_audit(
    'assignment.close',
    'assignment',
    v_assignment.id,
    null,
    jsonb_build_object('status', v_assignment.status)
  );

  return jsonb_build_object('id', v_assignment.id, 'status', v_assignment.status);
end;
$$;

revoke all on function public.publish_assignment(uuid) from public, anon;
revoke all on function public.close_assignment(uuid) from public, anon;
grant execute on function public.publish_assignment(uuid) to authenticated, service_role;
grant execute on function public.close_assignment(uuid) to authenticated, service_role;
