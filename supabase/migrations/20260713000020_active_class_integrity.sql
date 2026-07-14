-- =============================================================================
-- 20 — Chốt chặn tính toàn vẹn khi kích hoạt lớp
--
-- Server Action kiểm trước để trả lỗi thân thiện, nhưng super admin vẫn có thể
-- ghi trực tiếp qua PostgREST. Trigger là chốt chặn DB để lớp `active` luôn có
-- đủ cấu hình và đúng một giáo viên chính.
-- =============================================================================

create or replace function app.enforce_active_class_requirements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    if new.start_date is null then
      raise exception 'Không thể kích hoạt: lớp chưa có ngày khai giảng';
    end if;

    if new.planned_session_count is null then
      raise exception 'Không thể kích hoạt: lớp chưa chốt số buổi';
    end if;

    if new.session_duration_minutes is null then
      raise exception 'Không thể kích hoạt: lớp chưa chốt thời lượng buổi';
    end if;

    if not exists (
      select 1
      from public.class_teachers ct
      where ct.class_id = new.id
        and ct.assignment_role = 'primary'
    ) then
      raise exception 'Không thể kích hoạt: lớp phải có đúng một giáo viên chính';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_classes_active_requirements
  before insert or update on public.classes
  for each row execute function app.enforce_active_class_requirements();

-- Khóa row lớp trước khi gỡ/hạ vai trò GV chính. Việc khóa này tuần tự hóa với
-- thao tác đổi trạng thái lớp, tránh hai request đồng thời cùng vượt qua kiểm tra.
create or replace function app.prevent_active_class_primary_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status      public.class_status;
  v_is_removing boolean := false;
begin
  if old.assignment_role = 'primary' then
    if tg_op = 'DELETE' then
      v_is_removing := true;
    else
      v_is_removing := new.assignment_role is distinct from old.assignment_role
        or new.class_id is distinct from old.class_id;
    end if;
  end if;

  if v_is_removing then
    select c.status
    into v_status
    from public.classes c
    where c.id = old.class_id
    for update;

    if v_status = 'active' then
      raise exception 'Không thể gỡ hoặc đổi vai trò giáo viên chính khi lớp đang hoạt động';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger trg_class_teachers_keep_active_primary
  before update or delete on public.class_teachers
  for each row execute function app.prevent_active_class_primary_removal();

revoke all on function app.enforce_active_class_requirements() from public, anon, authenticated;
revoke all on function app.prevent_active_class_primary_removal() from public, anon, authenticated;
