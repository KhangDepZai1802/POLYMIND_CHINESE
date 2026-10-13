-- Chạy trong Supabase SQL Editor trước khi dùng chức năng trạng thái học viên.
begin;
alter table public.b2c_students
  add column status text not null default 'studying',
  add column withdrawal_reason text;

alter table public.b2c_students
  add constraint b2c_students_status_check
    check (status in ('studying', 'on_hold', 'awaiting_renewal', 'overdue', 'withdrawn', 'completed')),
  add constraint b2c_students_withdrawal_reason_check
    check (withdrawal_reason is null or (
      status = 'withdrawn' and char_length(btrim(withdrawal_reason)) between 1 and 1000
    ));

-- Giữ nguyên RLS manager-only và trigger updated_at hiện có.
notify pgrst, 'reload schema';
commit;
