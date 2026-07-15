-- =============================================================================
-- 34 — Rate limit bền vững cho action nhạy cảm
-- Counter ở schema app nên không expose qua Data API và dùng chung giữa mọi
-- serverless instance.
-- =============================================================================

create table app.rate_limit_windows (
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (user_id, scope, window_start)
);

revoke all on app.rate_limit_windows from public, anon, authenticated;

create or replace function public.consume_rate_limit(p_scope text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_window_seconds integer;
  v_window_start timestamptz;
  v_count integer;
begin
  if v_user_id is null then return false; end if;

  case p_scope
    when 'material_upload' then v_limit := 20; v_window_seconds := 3600;
    when 'assignment_upload' then v_limit := 20; v_window_seconds := 3600;
    when 'submission_upload' then v_limit := 20; v_window_seconds := 3600;
    when 'report_export' then v_limit := 10; v_window_seconds := 60;
    else return false;
  end case;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / v_window_seconds) * v_window_seconds
  );
  insert into app.rate_limit_windows (user_id, scope, window_start, request_count)
  values (v_user_id, p_scope, v_window_start, 1)
  on conflict (user_id, scope, window_start)
  do update set request_count = app.rate_limit_windows.request_count + 1
  returning request_count into v_count;

  return v_count <= v_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;
