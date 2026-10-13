begin;
create sequence public.b2c_student_code_seq;
create function public.next_b2c_student_code() returns text
language sql volatile set search_path = '' as $$
  select 'B2C-HV' || lpad(n::text, greatest(6, length(n::text)), '0')
  from (select nextval('public.b2c_student_code_seq'::regclass) as n) seq;
$$;

alter table public.b2c_students
  add column code text not null default public.next_b2c_student_code(),
  add constraint b2c_students_code_unique unique (code),
  add constraint b2c_students_code_format check (code ~ '^B2C-HV[0-9]{6,}$');

-- Mã do DB cấp và không thay đổi sau khi tạo hồ sơ.
create function public.protect_b2c_student_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    NEW.code := public.next_b2c_student_code();
  elsif NEW.code is distinct from OLD.code then
    raise exception 'Không được thay đổi mã học viên B2C' using errcode = '23514';
  end if;
  return NEW;
end;
$$;
create trigger b2c_student_code_immutable
before insert or update of code on public.b2c_students
for each row execute function public.protect_b2c_student_code();
grant usage on sequence public.b2c_student_code_seq to authenticated, service_role;

alter table public.b2c_enrollments
  add column status text not null default 'studying',
  add column withdrawal_reason text;

-- Giữ trạng thái/lý do đã nhập trước đây khi chuyển sang từng lượt ghi danh.
update public.b2c_enrollments e
set status = s.status, withdrawal_reason = s.withdrawal_reason
from public.b2c_students s where e.student_id = s.id;

alter table public.b2c_enrollments
  add constraint b2c_enrollments_status_check
    check (status in ('studying', 'on_hold', 'awaiting_renewal', 'overdue', 'withdrawn', 'completed')),
  add constraint b2c_enrollments_withdrawal_reason_check
    check (withdrawal_reason is null or (
      status = 'withdrawn' and char_length(btrim(withdrawal_reason)) between 1 and 1000
    ));

-- Giữ cột cũ trên hồ sơ để bảo toàn dữ liệu; ứng dụng chỉ dùng trạng thái ghi danh.
notify pgrst, 'reload schema';
commit;
