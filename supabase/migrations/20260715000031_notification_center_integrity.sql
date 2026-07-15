-- =============================================================================
-- 31 — Notification center integrity
--
-- Tùy chọn in-app phải có hiệu lực ở DB cho mọi nguồn sinh notification.
-- Người nhận chỉ được đổi `read_at`, không được sửa nội dung/link của thông báo.
-- =============================================================================

create or replace function app.notification_in_app_enabled(
  p_user_id uuid,
  p_type public.notification_type
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select preference.in_app_enabled
      from public.notification_preferences preference
      where preference.user_id = p_user_id
        and preference.type = p_type
    ),
    true
  );
$$;

revoke all on function app.notification_in_app_enabled(uuid, public.notification_type)
  from public, anon, authenticated;
grant execute on function app.notification_in_app_enabled(uuid, public.notification_type)
  to service_role;

create or replace function app.apply_notification_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.notification_in_app_enabled(new.user_id, new.type) then
    return null;
  end if;

  return new;
end;
$$;

revoke all on function app.apply_notification_preference() from public, anon, authenticated;

create trigger trg_notifications_apply_preference
  before insert on public.notifications
  for each row execute function app.apply_notification_preference();

create or replace function app.protect_notification_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service role / migration giữ khả năng nạp dữ liệu. User flow luôn gắn với
  -- actor thật; không cho client bật kênh email chưa được triển khai.
  if auth.uid() is not null and not app.is_super_admin() then
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
$$;

revoke all on function app.protect_notification_preference() from public, anon, authenticated;

create trigger trg_notification_preferences_protect
  before insert or update on public.notification_preferences
  for each row execute function app.protect_notification_preference();

-- RLS lọc đúng dòng; column privilege thu hẹp thao tác còn đúng `read_at`.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

