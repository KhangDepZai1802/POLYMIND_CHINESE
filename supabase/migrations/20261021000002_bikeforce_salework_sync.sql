create table public.bikeforce_salework_snapshots (
  person_slug text not null check (person_slug in ('co-le', 'co-thy')),
  work_date date not null,
  snapshot jsonb not null check (
    jsonb_typeof(snapshot) = 'object'
    and snapshot ?& array['conversations','sentMessages','receivedMessages','incomingCalls','outgoingCalls','missedCalls','callDurationSeconds','syncedAt']
    and snapshot - array['conversations','sentMessages','receivedMessages','incomingCalls','outgoingCalls','missedCalls','callDurationSeconds','syncedAt'] = '{}'::jsonb
    and jsonb_typeof(snapshot->'syncedAt') = 'string'
    and (snapshot->>'syncedAt') ~ '^\d{4}-\d{2}-\d{2}T'
    and jsonb_typeof(snapshot->'conversations') = 'number' and (snapshot->>'conversations')::numeric >= 0 and trunc((snapshot->>'conversations')::numeric) = (snapshot->>'conversations')::numeric
    and jsonb_typeof(snapshot->'sentMessages') = 'number' and (snapshot->>'sentMessages')::numeric >= 0 and trunc((snapshot->>'sentMessages')::numeric) = (snapshot->>'sentMessages')::numeric
    and jsonb_typeof(snapshot->'receivedMessages') = 'number' and (snapshot->>'receivedMessages')::numeric >= 0 and trunc((snapshot->>'receivedMessages')::numeric) = (snapshot->>'receivedMessages')::numeric
    and jsonb_typeof(snapshot->'incomingCalls') = 'number' and (snapshot->>'incomingCalls')::numeric >= 0 and trunc((snapshot->>'incomingCalls')::numeric) = (snapshot->>'incomingCalls')::numeric
    and jsonb_typeof(snapshot->'outgoingCalls') = 'number' and (snapshot->>'outgoingCalls')::numeric >= 0 and trunc((snapshot->>'outgoingCalls')::numeric) = (snapshot->>'outgoingCalls')::numeric
    and jsonb_typeof(snapshot->'missedCalls') = 'number' and (snapshot->>'missedCalls')::numeric >= 0 and trunc((snapshot->>'missedCalls')::numeric) = (snapshot->>'missedCalls')::numeric
    and jsonb_typeof(snapshot->'callDurationSeconds') = 'number' and (snapshot->>'callDurationSeconds')::numeric >= 0 and trunc((snapshot->>'callDurationSeconds')::numeric) = (snapshot->>'callDurationSeconds')::numeric
  ),
  received_at timestamptz not null default clock_timestamp(),
  primary key (person_slug, work_date)
);

alter table public.bikeforce_salework_snapshots enable row level security;

revoke all on table public.bikeforce_salework_snapshots from anon, authenticated;
grant select, insert, update on table public.bikeforce_salework_snapshots to service_role;
grant select on table public.bikeforce_salework_snapshots to authenticated;

create policy bikeforce_salework_manager_read
on public.bikeforce_salework_snapshots for select
to authenticated
using ((select app.is_manager()));

create or replace function public.upsert_bikeforce_salework_snapshot(
  p_person_slug text,
  p_work_date date,
  p_snapshot jsonb
) returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_received_at timestamptz := clock_timestamp();
begin
  if current_user <> 'service_role' then
    raise exception 'Chỉ tích hợp hệ thống được phép đồng bộ SaleWork';
  end if;

  if p_person_slug not in ('co-le', 'co-thy') then
    raise exception 'Mã người không hợp lệ';
  end if;

  if p_work_date is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Ngày hoặc snapshot không hợp lệ';
  end if;

  insert into public.bikeforce_salework_snapshots(person_slug, work_date, snapshot, received_at)
  values (p_person_slug, p_work_date, p_snapshot, v_received_at)
  on conflict (person_slug, work_date) do update
    set snapshot = excluded.snapshot,
        received_at = excluded.received_at;

  return v_received_at;
end;
$$;

revoke all on function public.upsert_bikeforce_salework_snapshot(text, date, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_bikeforce_salework_snapshot(text, date, jsonb) to service_role;

comment on table public.bikeforce_salework_snapshots is
  'Snapshot SaleWork nhận từ BikeForce; một bản ghi cho mỗi người/ngày, gửi lại sẽ thay thế.';
