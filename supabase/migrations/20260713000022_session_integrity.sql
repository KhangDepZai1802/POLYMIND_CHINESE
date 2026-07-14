-- =============================================================================
-- 22 — Toàn vẹn buổi học: attribution thật + không xóa buổi đã có lịch sử
--
-- Hai chốt chặn ở DB, đi kèm P3-T7 (UI lịch lặp + sinh buổi học).
-- =============================================================================

-- --- (1) created_by LUÔN là actor thật ---------------------------------------
--
-- RPC `generate_class_sessions` đã ghi `auth.uid()`, nhưng RLS còn cho admin và
-- giáo viên INSERT thẳng vào `class_sessions` qua PostgREST (buổi học thêm tay
-- cho lớp linh hoạt). Đường đó không đi qua RPC → client tự khai `created_by` là
-- ai cũng được. Cùng lớp bug BUG_M06_01/BUG_M12_01 đã chốt ở migration 21.
--
-- Chỉ ghi đè KHI CÓ `auth.uid()`. Seed chạy bằng role `postgres` (không JWT) và
-- có chèn `class_sessions` với `created_by` tường minh — giữ nguyên giá trị đó.
-- Mọi request mang JWT thì luôn có `auth.uid()` → luôn bị ghi đè, không ai khai
-- gian được.

create or replace function app.force_session_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
  else
    new.created_by := old.created_by;   -- bất biến: không sửa lại lịch sử
  end if;

  return new;
end;
$$;

create trigger trg_class_sessions_creator
  before insert or update on public.class_sessions
  for each row execute function app.force_session_creator();

-- --- (2) Không xóa buổi học đã có lịch sử ------------------------------------
--
-- `attendance_records.session_id` đang là ON DELETE **CASCADE**. Nghĩa là xóa một
-- buổi học sẽ âm thầm xóa luôn toàn bộ điểm danh của buổi đó — hard delete dữ
-- liệu lịch sử, đúng thứ luật cứng của dự án cấm.
--
-- Không sửa FK của migration cũ (forward-fix). Chặn ở trigger:
--   • buổi đã điểm danh  → không xóa được
--   • buổi đã dạy xong   → không xóa được
-- Muốn bỏ buổi thì HỦY (`status = 'cancelled'`), giữ lại vết.
--
-- Vẫn cho xóa buổi `scheduled` chưa ai điểm danh: đó là buổi sinh nhầm do cấu
-- hình lịch sai, chưa có lịch sử gì để mất.

create or replace function app.prevent_session_delete_with_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'completed' then
    raise exception 'Không thể xóa buổi đã dạy. Hãy hủy buổi (giữ lại lịch sử).';
  end if;

  if exists (
    select 1 from public.attendance_records a where a.session_id = old.id
  ) then
    raise exception 'Không thể xóa buổi đã có điểm danh. Hãy hủy buổi (giữ lại lịch sử).';
  end if;

  return old;
end;
$$;

create trigger trg_class_sessions_no_delete_with_history
  before delete on public.class_sessions
  for each row execute function app.prevent_session_delete_with_history();

revoke all on function app.force_session_creator() from public, anon, authenticated;
revoke all on function app.prevent_session_delete_with_history() from public, anon, authenticated;
