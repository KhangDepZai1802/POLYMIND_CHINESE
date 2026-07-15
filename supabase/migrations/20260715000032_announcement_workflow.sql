-- =============================================================================
-- 32 — Announcement workflow
--
-- Draft/save/publish/expire chỉ qua RPC. Publish phân phối notification đúng
-- audience và giữ mô hình một chiều: không reply, thread hay chat.
-- =============================================================================

drop policy if exists "đọc announcement liên quan" on public.announcements;
create policy "đọc announcement liên quan" on public.announcements
  for select to authenticated
  using (
    published_at is not null
    and (expires_at is null or expires_at > clock_timestamp())
    and (
      class_id is null
      or app.teaches_class(class_id)
      or app.studies_class(class_id)
    )
  );

create or replace function public.save_announcement(
  p_title text,
  p_body text,
  p_class_id uuid default null,
  p_expires_at timestamptz default null,
  p_announcement_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_announcement public.announcements%rowtype;
  v_id uuid;
  v_title text := nullif(btrim(p_title), '');
  v_body text := nullif(btrim(p_body), '');
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ super admin được quản lý announcement';
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
$$;

create or replace function public.publish_announcement(p_announcement_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_announcement public.announcements%rowtype;
  v_published_at timestamptz := clock_timestamp();
  v_notification_count integer := 0;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ super admin được phát hành announcement';
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
$$;

create or replace function public.expire_announcement(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_announcement public.announcements%rowtype;
  v_expires_at timestamptz;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ super admin được kết thúc announcement';
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
$$;

revoke insert, update, delete on public.announcements from authenticated;

revoke all on function public.save_announcement(text, text, uuid, timestamptz, uuid)
  from public, anon;
revoke all on function public.publish_announcement(uuid) from public, anon;
revoke all on function public.expire_announcement(uuid) from public, anon;

grant execute on function public.save_announcement(text, text, uuid, timestamptz, uuid)
  to authenticated;
grant execute on function public.publish_announcement(uuid) to authenticated;
grant execute on function public.expire_announcement(uuid) to authenticated;

