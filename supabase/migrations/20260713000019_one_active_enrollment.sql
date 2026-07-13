-- =============================================================================
-- 19 — MỘT HỌC VIÊN CHỈ HỌC MỘT LỚP TẠI MỘT THỜI ĐIỂM
--
-- Thay đổi nghiệp vụ (user chốt 2026-07-13, đảo ngược D-10 của đặc tả gốc).
--
-- "Một thời điểm" là mấu chốt:
--   • Chỉ được có TỐI ĐA MỘT enrollment đang mở (pending/active/paused).
--   • Enrollment đã đóng (completed / withdrawn / transferred) KHÔNG tính →
--     học xong HSK1 vẫn đăng ký được HSK2, và lịch sử lớp cũ giữ nguyên.
--   • Chuyển lớp vẫn chạy: lớp cũ thành `transferred` (đã đóng), lớp mới
--     `active` → vẫn chỉ một enrollment mở.
--
-- Cưỡng chế bằng PARTIAL UNIQUE INDEX ở DB, không phải bằng `if` ở app:
-- hai admin ghi danh đồng thời cho cùng một học viên vào hai lớp khác nhau sẽ
-- cùng đọc thấy "học viên chưa có lớp" rồi cùng insert. Chỉ DB chặn được.
-- =============================================================================

-- Dọn dữ liệu vi phạm trước khi tạo index (seed cũ cho HV001 học 2 lớp).
-- Giữ enrollment CŨ NHẤT đang mở, đóng các cái sau bằng `withdrawn`.
with ranked as (
  select
    id,
    row_number() over (
      partition by student_id
      order by enrolled_on, created_at
    ) as rn
  from public.enrollments
  where status in ('pending', 'active', 'paused')
)
update public.enrollments e
set status = 'withdrawn',
    ended_on = current_date,
    reason = coalesce(reason, 'Tự động đóng: mỗi học viên chỉ học một lớp tại một thời điểm')
from ranked r
where e.id = r.id and r.rn > 1;

create unique index ux_enrollments_one_open_per_student
  on public.enrollments (student_id)
  where status in ('pending', 'active', 'paused');

comment on index public.ux_enrollments_one_open_per_student is
  'Mỗi học viên chỉ có TỐI ĐA MỘT lớp đang mở. Lớp đã completed/withdrawn/transferred không tính → vẫn học được lớp tiếp theo và vẫn chuyển lớp được.';

-- --- Cập nhật RPC ghi danh: báo lỗi rõ ràng thay vì "unique violation" -------

create or replace function public.enroll_student(
  p_student_id uuid,
  p_class_id   uuid,
  p_status     public.enrollment_status default 'active',
  p_reason     text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity      integer;
  v_active_count  integer;
  v_enrollment_id uuid;
  v_open_class    text;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ quản trị viên được ghi danh học viên';
  end if;

  -- Học viên đã có lớp đang mở chưa?
  -- Kiểm ở đây để BÁO LỖI DỄ HIỂU. Chốt chặn thật vẫn là unique index bên dưới —
  -- kiểm ở app không chặn được hai request đồng thời.
  select c.code into v_open_class
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  where e.student_id = p_student_id
    and e.status in ('pending', 'active', 'paused')
  limit 1;

  if v_open_class is not null then
    raise exception
      'Học viên đang học lớp %. Mỗi học viên chỉ học một lớp tại một thời điểm — hãy hoàn thành, rút học, hoặc chuyển lớp trước.',
      v_open_class;
  end if;

  -- Khóa hàng lớp: hai lời gọi đồng thời sẽ tuần tự hóa tại đây.
  select capacity into v_capacity
  from public.classes
  where id = p_class_id
  for update;

  if v_capacity is null then
    raise exception 'Không tìm thấy lớp học';
  end if;

  select count(*) into v_active_count
  from public.enrollments
  where class_id = p_class_id
    and status in ('pending', 'active', 'paused');

  if p_status in ('pending', 'active', 'paused')
     and v_active_count >= v_capacity then
    raise exception 'Lớp đã đủ sĩ số (% / %)', v_active_count, v_capacity;
  end if;

  insert into public.enrollments
    (student_id, class_id, status, reason, created_by, started_on)
  values
    (p_student_id, p_class_id, p_status, p_reason, auth.uid(),
     case when p_status = 'active' then current_date end)
  returning id into v_enrollment_id;

  insert into public.enrollment_status_history
    (enrollment_id, old_status, new_status, reason, changed_by)
  values
    (v_enrollment_id, null, p_status, p_reason, auth.uid());

  perform app.write_audit(
    'enrollment.create', 'enrollment', v_enrollment_id,
    null,
    jsonb_build_object('student_id', p_student_id, 'class_id', p_class_id,
                       'status', p_status)
  );

  return v_enrollment_id;
end;
$$;

revoke all on function public.enroll_student(uuid, uuid, public.enrollment_status, text) from public, anon;
grant execute on function public.enroll_student(uuid, uuid, public.enrollment_status, text) to authenticated;
