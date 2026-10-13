begin;
alter table public.b2c_students
 add column customer_source text,
 add column referrer_name text,
 add constraint b2c_students_customer_source_check check(customer_source is null or customer_source in ('facebook','zalo','referral','walk_in','school','other')),
 add constraint b2c_students_referrer_check check(
 (customer_source = 'referral' and referrer_name is not null and char_length(btrim(referrer_name)) between 1 and 200)
 or (customer_source is distinct from 'referral' and referrer_name is null));
drop function public.update_b2c_enrollment(uuid,text,text,date,text,text,date,date,text);
create function public.update_b2c_enrollment(
  p_enrollment_id uuid, p_phone text, p_salesperson text,
  p_enrollment_date date, p_program_slug text,
  p_status text, p_learning_start_date date default null,
  p_tuition_end_date date default null, p_withdrawal_reason text default null,
  p_customer_source text default null, p_referrer_name text default null
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_student_id uuid; v_program text;
begin
  if not coalesce(app.is_manager(), false) then
    raise exception 'Chỉ quản trị hoặc giáo vụ được sửa ghi danh B2C' using errcode='42501';
  end if;
  if p_phone is null or btrim(p_phone) !~ '^[0-9]{10}$' then
    raise exception 'SĐT phải có đúng 10 chữ số' using errcode='22023';
  end if;
  if p_salesperson is null or char_length(btrim(p_salesperson)) not between 1 and 200 then
    raise exception 'Vui lòng nhập người chốt (tối đa 200 ký tự)' using errcode='22023';
  end if;
  if p_enrollment_date is null then
    raise exception 'Vui lòng nhập ngày nhập học' using errcode='22023';
  end if;
  if p_program_slug is null or p_program_slug not in ('tieng-anh','tieng-trung','tieng-viet','lop-ve','kem-1-1') then
    raise exception 'Vui lòng chọn chương trình' using errcode='22023';
  end if;
  if p_tuition_end_date is not null and (p_learning_start_date is null or p_tuition_end_date < p_learning_start_date) then
    raise exception 'Ngày hết phí không được trước ngày bắt đầu học; cần nhập ngày bắt đầu học' using errcode='22023';
  end if;
  select e.student_id, c.program_slug into v_student_id, v_program
  from public.b2c_enrollments e join public.b2c_classes c on c.id=e.class_id
  where e.id=p_enrollment_id for update of e, c;
  if not found then raise exception 'Không tìm thấy ghi danh' using errcode='P0002'; end if;
  if v_program is distinct from p_program_slug then
    raise exception 'Chương trình phải trùng với lớp đã ghi danh' using errcode='22023';
  end if;
  update public.b2c_students set phone=btrim(p_phone), customer_source=p_customer_source,
    referrer_name=case when p_customer_source='referral' then nullif(btrim(p_referrer_name),'') else null end
  where id=v_student_id;
  if not found then raise exception 'Không tìm thấy học viên' using errcode='P0002'; end if;
  update public.b2c_enrollments set salesperson=btrim(p_salesperson),
    enrollment_date=p_enrollment_date, learning_start_date=p_learning_start_date,
    tuition_end_date=p_tuition_end_date, status=p_status,
    withdrawal_reason=case when p_status='withdrawn' then nullif(btrim(p_withdrawal_reason),'') else null end
  where id=p_enrollment_id;
end;
$$;
revoke all on function public.update_b2c_enrollment(uuid,text,text,date,text,text,date,date,text,text,text) from public, anon;
grant execute on function public.update_b2c_enrollment(uuid,text,text,date,text,text,date,date,text,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
