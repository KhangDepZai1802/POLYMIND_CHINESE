-- Name correction is narrower than center-wide data completion. Keep a separate
-- DB allowlist so a future manage_center_student_data grant cannot silently gain
-- the ability to rename every student.
create table if not exists public.b2c_student_name_editors (
 teacher_id uuid primary key references public.b2c_teachers(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.b2c_student_name_editors enable row level security;
revoke all on public.b2c_student_name_editors from public,anon,authenticated;

do $$
declare matched integer;
begin
 select count(*) into matched
 from public.b2c_teachers b
 join public.teachers t on t.id=b.source_teacher_id
 join public.profiles p on p.id=t.user_id
 where b.full_name in ('Cô Lê','Cô Thy') and p.full_name=b.full_name
   and p.is_active and t.is_active and p.role='teacher';
 if matched<>2 then raise exception 'Không xác định đúng hai tài khoản Cô Lê/Cô Thy.'; end if;
 insert into public.b2c_student_name_editors(teacher_id)
 select b.id from public.b2c_teachers b
 join public.teachers t on t.id=b.source_teacher_id
 join public.profiles p on p.id=t.user_id
 where b.full_name in ('Cô Lê','Cô Thy') and p.full_name=b.full_name
   and p.is_active and t.is_active and p.role='teacher'
 on conflict (teacher_id) do nothing;
end $$;

create or replace function public.save_center_b2c_student_data(p_data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare e public.b2c_enrollments; s public.b2c_students;
 v_student_id uuid:=nullif(p_data->>'student_id','')::uuid; v_enrollment_id uuid:=nullif(p_data->>'enrollment_id','')::uuid;
 v_name text:=btrim(coalesce(p_data->>'full_name',''));
 v_phone text:=nullif(btrim(p_data->>'phone'),''); v_source text:=nullif(p_data->>'customer_source','');
 v_ref text:=nullif(btrim(p_data->>'referrer_name'),''); v_sales text:=nullif(btrim(p_data->>'salesperson'),'');
 v_enrolled date:=nullif(p_data->>'enrollment_date','')::date;
 v_start date:=nullif(p_data->>'learning_start_date','')::date; v_end date:=nullif(p_data->>'tuition_end_date','')::date;
begin
 if not coalesce(app.has_b2c_permission('manage_center_student_data'),false) then raise exception 'Không có quyền bổ sung hồ sơ toàn trung tâm.' using errcode='42501'; end if;
 if not exists(select 1 from public.b2c_student_name_editors where teacher_id=app.my_b2c_teacher_id()) then raise exception 'Không có quyền sửa tên học viên.' using errcode='42501'; end if;
 if v_student_id is null then raise exception 'Không tìm thấy học viên.' using errcode='22023'; end if;
 if char_length(v_name) not between 2 and 200 then raise exception 'Họ tên phải có từ 2 đến 200 ký tự.' using errcode='22023'; end if;
 if v_phone is not null and v_phone!~'^[0-9]{10}$' then raise exception 'SĐT phải có đúng 10 chữ số.' using errcode='22023'; end if;
 if (v_source is not null and v_source not in ('facebook','zalo','tiktok','referral','walk_in','school','other'))
  or (v_source='referral' and v_ref is null) or char_length(v_ref)>200 or char_length(v_sales)>200
  or (v_end is not null and (v_start is null or v_end<v_start)) then raise exception 'Kiểm tra nguồn khách, người giới thiệu và ngày học/hết phí.' using errcode='22023'; end if;
 select * into s from public.b2c_students where id=v_student_id for update;
 if not found then raise exception 'Không tìm thấy học viên.' using errcode='22023'; end if;
 if s.updated_at is distinct from (p_data->>'student_updated_at')::timestamptz then raise exception 'Hồ sơ đã thay đổi. Tải lại trước khi lưu.' using errcode='40001'; end if;
 if v_enrollment_id is null then
  if v_sales is not null or v_enrolled is not null or v_start is not null or v_end is not null then raise exception 'Học viên chưa xếp lớp nên chưa thể lưu thông tin ghi danh.' using errcode='22023'; end if;
 else
  select * into e from public.b2c_enrollments where id=v_enrollment_id and student_id=v_student_id for update;
  if not found then raise exception 'Không tìm thấy ghi danh.' using errcode='22023'; end if;
  if e.updated_at is distinct from (p_data->>'enrollment_updated_at')::timestamptz then raise exception 'Hồ sơ đã thay đổi. Tải lại trước khi lưu.' using errcode='40001'; end if;
  update public.b2c_enrollments set salesperson=v_sales,enrollment_date=v_enrolled,learning_start_date=v_start,tuition_end_date=v_end where id=e.id;
 end if;
 update public.b2c_students set full_name=v_name,phone=v_phone,customer_source=v_source,referrer_name=case when v_source='referral' then v_ref end where id=s.id;
end $$;

notify pgrst,'reload schema';
