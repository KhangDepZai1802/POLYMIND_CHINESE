-- =============================================================================
-- 16 — RPC ghi audit từ tầng ứng dụng
--
-- `app.write_audit()` nằm trong schema `app`, mà PostgREST chỉ expose `public`
-- → server action không gọi được. File này mở một cửa duy nhất ở `public`.
--
-- Vì sao không cho INSERT thẳng vào audit_logs?
--   Cho INSERT nghĩa là cho luôn khả năng GHI AUDIT GIẢ (mạo actor, bịa action).
--   Qua RPC này, actor LUÔN là auth.uid() của người đang đăng nhập — không tham
--   số nào cho phép ghi đè nó.
-- =============================================================================

create or replace function public.log_audit(
  p_action        text,
  p_resource_type text,
  p_resource_id   uuid default null,
  p_before        jsonb default null,
  p_after         jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Phải đăng nhập mới ghi được audit';
  end if;

  perform app.write_audit(p_action, p_resource_type, p_resource_id, p_before, p_after);
end;
$$;

revoke all on function public.log_audit(text, text, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.log_audit(text, text, uuid, jsonb, jsonb) to authenticated;
