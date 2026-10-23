begin;

create or replace function public.read_center_b2c_student_data(p_query text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not coalesce(app.has_b2c_permission('manage_center_student_data'),false) then raise exception 'Không có quyền bổ sung hồ sơ toàn trung tâm.' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 1000000 or p_query is null or char_length(p_query)>200 then raise exception 'Bộ lọc không hợp lệ.' using errcode='22023'; end if;
 with filtered as (
  select e.id as enrollment_id,s.id as student_id,s.code,s.full_name,s.phone,s.customer_source,s.referrer_name,
   e.class_id,c.name as class_name,c.teacher_name,e.salesperson,e.enrollment_date,e.learning_start_date,e.tuition_end_date,
   s.updated_at as student_updated_at,e.updated_at as enrollment_updated_at
  from public.b2c_students s
  left join public.b2c_enrollments e on e.student_id=s.id
  left join public.b2c_classes c on c.id=e.class_id
  where btrim(p_query)='' or position(lower(btrim(p_query)) in lower(concat_ws(' ',s.code,s.full_name,s.phone,c.name,c.teacher_name,e.salesperson)))>0
 ), page_rows as(
  select * from filtered order by (enrollment_id is null) desc,full_name,code,enrollment_id
  limit 50 offset p_page::bigint*50
 )
 select jsonb_build_object('total',(select count(*) from filtered),'students',(select count(distinct student_id) from filtered),
  'rows',coalesce((select jsonb_agg(to_jsonb(r) order by (enrollment_id is null) desc,full_name,code,enrollment_id) from page_rows r),'[]'::jsonb)) into result;
 return result;
end $$;

create or replace function public.save_center_b2c_student_data(p_data jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
 e public.b2c_enrollments; s public.b2c_students;
 v_student_id uuid:=nullif(p_data->>'student_id','')::uuid; v_enrollment_id uuid:=nullif(p_data->>'enrollment_id','')::uuid;
 v_phone text:=nullif(btrim(p_data->>'phone'),''); v_source text:=nullif(p_data->>'customer_source','');
 v_ref text:=nullif(btrim(p_data->>'referrer_name'),''); v_sales text:=nullif(btrim(p_data->>'salesperson'),'');
 v_enrolled date:=nullif(p_data->>'enrollment_date','')::date;
 v_start date:=nullif(p_data->>'learning_start_date','')::date; v_end date:=nullif(p_data->>'tuition_end_date','')::date;
begin
 if not coalesce(app.has_b2c_permission('manage_center_student_data'),false) then raise exception 'Không có quyền bổ sung hồ sơ toàn trung tâm.' using errcode='42501'; end if;
 if v_student_id is null then raise exception 'Không tìm thấy học viên.' using errcode='22023'; end if;
 if v_phone is not null and v_phone!~'^[0-9]{10}$' then raise exception 'SĐT phải có đúng 10 chữ số.' using errcode='22023'; end if;
 if (v_source is not null and v_source not in ('facebook','zalo','tiktok','referral','walk_in','school','other')) or (v_source='referral' and v_ref is null) or char_length(v_ref)>200 or char_length(v_sales)>200 or (v_end is not null and (v_start is null or v_end<v_start)) then raise exception 'Kiểm tra nguồn khách, người giới thiệu và ngày học/hết phí.' using errcode='22023'; end if;
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
 update public.b2c_students set phone=v_phone,customer_source=v_source,referrer_name=case when v_source='referral' then v_ref end where id=s.id;
end $$;

notify pgrst,'reload schema';
commit;
