-- 37 — Mỗi lớp đúng tối đa một giáo viên phụ trách; bỏ hoàn toàn trợ giảng

-- Lớp chưa có primary: nâng phân công lâu nhất thành người phụ trách, có audit.
with promoted as (
  select distinct on (ct.class_id) ct.id, ct.class_id, ct.teacher_id
  from public.class_teachers ct
  where ct.assignment_role = 'assistant'
    and not exists (
      select 1 from public.class_teachers current_primary
      where current_primary.class_id = ct.class_id
        and current_primary.assignment_role = 'primary'
    )
  order by ct.class_id, ct.created_at, ct.id
), audited as (
  insert into public.audit_logs (action, resource_type, resource_id, before, after)
  select
    'migration.assistant_promoted',
    'class_teacher',
    id,
    jsonb_build_object('class_id', class_id, 'teacher_id', teacher_id, 'assignment_role', 'assistant'),
    jsonb_build_object('class_id', class_id, 'teacher_id', teacher_id, 'assignment_role', 'primary')
  from promoted
  returning resource_id
)
update public.class_teachers ct
set assignment_role = 'primary'
from audited
where ct.id = audited.resource_id;

-- Những assistant còn lại không còn hợp lệ: snapshot vào audit trước khi xóa.
insert into public.audit_logs (action, resource_type, resource_id, before, after)
select
  'migration.assistant_assignment_removed',
  'class_teacher',
  ct.id,
  jsonb_build_object(
    'class_id', ct.class_id,
    'teacher_id', ct.teacher_id,
    'assignment_role', ct.assignment_role,
    'created_at', ct.created_at
  ),
  jsonb_build_object('reason', 'assistant_role_removed_by_D22')
from public.class_teachers ct
where ct.assignment_role = 'assistant';

delete from public.class_teachers where assignment_role = 'assistant';

drop trigger if exists trg_class_teachers_keep_active_primary on public.class_teachers;
drop function if exists app.prevent_active_class_primary_removal();

drop index if exists public.ux_class_teachers_one_primary;
alter table public.class_teachers drop constraint if exists uq_class_teachers;
alter table public.class_teachers
  add constraint uq_class_teachers_one_teacher unique (class_id);
alter table public.class_teachers drop column assignment_role;
drop type public.assignment_role;

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
      select 1 from public.class_teachers ct where ct.class_id = new.id
    ) then
      raise exception 'Không thể kích hoạt: lớp phải có một giáo viên phụ trách';
    end if;
  end if;
  return new;
end;
$$;

create or replace function app.prevent_active_class_teacher_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.class_status;
begin
  select c.status into v_status
  from public.classes c
  where c.id = old.class_id
  for update;

  if v_status = 'active' and (
    tg_op = 'DELETE'
    or new.class_id is distinct from old.class_id
    or new.teacher_id is distinct from old.teacher_id
  ) then
    raise exception 'Không thể gỡ hoặc đổi giáo viên phụ trách khi lớp đang hoạt động';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger trg_class_teachers_keep_active_teacher
  before update or delete on public.class_teachers
  for each row execute function app.prevent_active_class_teacher_removal();

revoke all on function app.enforce_active_class_requirements() from public, anon, authenticated;
revoke all on function app.prevent_active_class_teacher_removal() from public, anon, authenticated;
