-- =============================================================================
-- 09 — Thông báo, announcement, audit
--
-- MỘT CHIỀU. Không reply, không thread, không chat (D-5).
-- =============================================================================

create table public.announcements (
  id       uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes (id) on delete cascade,  -- null = toàn hệ thống

  title text not null,
  body  text not null,

  published_at timestamptz,
  expires_at   timestamptz,

  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_announcement_expiry
    check (expires_at is null or published_at is null or expires_at > published_at)
);

create index ix_announcements_class on public.announcements (class_id);
create index ix_announcements_published on public.announcements (published_at desc);

create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute function app.set_updated_at();

-- --- notifications ------------------------------------------------------------

create table public.notifications (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  type  public.notification_type not null,
  title text not null,
  body  text,

  -- Route NỘI BỘ. Click vào link vẫn phải qua authorization — link không phải là quyền.
  link          text,
  resource_type text,
  resource_id   uuid,

  dedupe_key text,

  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index ix_notifications_user on public.notifications (user_id, created_at desc);
create index ix_notifications_unread on public.notifications (user_id) where read_at is null;

-- Chống cron sinh thông báo trùng khi chạy lại.
-- Partial: chỉ áp dụng khi dedupe_key khác null (thông báo tức thời không cần dedupe).
create unique index ux_notifications_dedupe
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

-- --- notification_preferences -------------------------------------------------
-- email_enabled là CHỖ MỞ cho phase sau. Không thêm SMS/Zalo giả lập.

create table public.notification_preferences (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type    public.notification_type not null,

  in_app_enabled boolean not null default true,
  email_enabled  boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_notification_preferences unique (user_id, type)
);

create index ix_notification_preferences_user on public.notification_preferences (user_id);

create trigger trg_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function app.set_updated_at();

-- --- audit_logs ---------------------------------------------------------------
-- APPEND-ONLY. Không có policy INSERT/UPDATE/DELETE cho role app.
-- Chỉ ghi qua RPC SECURITY DEFINER hoặc admin client. CHỈ super_admin đọc.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  actor_id   uuid references auth.users (id) on delete set null,
  actor_role public.user_role,

  action        text not null,          -- 'enrollment.transfer', 'payment.record', …
  resource_type text not null,
  resource_id   uuid,

  before jsonb,
  after  jsonb,

  ip         inet,
  user_agent text,

  created_at timestamptz not null default now()
);

create index ix_audit_logs_created_at on public.audit_logs (created_at desc);
create index ix_audit_logs_actor on public.audit_logs (actor_id);
create index ix_audit_logs_resource on public.audit_logs (resource_type, resource_id);

-- Ghi audit. SECURITY DEFINER để role app ghi được mà không cần policy INSERT
-- (nếu cho INSERT trực tiếp thì cũng cho luôn khả năng ghi audit giả).
create or replace function app.write_audit(
  p_action        text,
  p_resource_type text,
  p_resource_id   uuid,
  p_before        jsonb default null,
  p_after         jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  select role into v_role from public.profiles where id = auth.uid();

  insert into public.audit_logs
    (actor_id, actor_role, action, resource_type, resource_id, before, after)
  values
    (auth.uid(), v_role, p_action, p_resource_type, p_resource_id, p_before, p_after);
end;
$$;

revoke all on function app.write_audit(text, text, uuid, jsonb, jsonb) from public, anon;
grant execute on function app.write_audit(text, text, uuid, jsonb, jsonb) to authenticated, service_role;
