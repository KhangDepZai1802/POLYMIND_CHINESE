create table public.b2c_enrollment_requests (
 request_id uuid primary key,
 payload jsonb not null,
 enrollment_id uuid not null references public.b2c_enrollments(id) on delete restrict,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.b2c_enrollment_requests enable row level security;
revoke all on public.b2c_enrollment_requests from public,anon,authenticated;
create policy b2c_enrollment_requests_manager_read on public.b2c_enrollment_requests for select to authenticated using(app.is_manager());
grant select on public.b2c_enrollment_requests to authenticated;

create function public.find_b2c_enrollment_students(p_class_id uuid,p_query text default '',p_page integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý học viên B2C' using errcode='42501'; end if;
 if p_query is null or char_length(p_query)>200 or p_page is null or p_page not between 0 and 1000000 then raise exception 'Bộ lọc không hợp lệ' using errcode='22023'; end if;
 if not exists(select 1 from public.b2c_classes where id=p_class_id) then raise exception 'Không tìm thấy lớp' using errcode='22023'; end if;
 with filtered as (
  select s.id,s.code,s.full_name,s.phone,s.guardian_name,s.date_of_birth from public.b2c_students s
  where not exists(select 1 from public.b2c_enrollments e where e.student_id=s.id and e.class_id=p_class_id)
  and (btrim(p_query)='' or position(lower(btrim(p_query)) in lower(concat_ws(' ',s.code,s.full_name,s.phone,s.guardian_name)))>0)
 ), page_rows as (select * from filtered order by full_name,code,id limit 20 offset p_page::bigint*20)
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(r) order by full_name,code,id) from page_rows r),'[]')) into v_result;
 return v_result;
end $$;
revoke all on function public.find_b2c_enrollment_students(uuid,text,integer) from public,anon;
grant execute on function public.find_b2c_enrollment_students(uuid,text,integer) to authenticated;

create function public.add_b2c_class_student(p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_request uuid:=(p_data->>'request_id')::uuid; v_class uuid:=(p_data->>'class_id')::uuid;
 v_mode text:=p_data->>'mode'; v_student uuid:=nullif(p_data->>'student_id','')::uuid;
 v_name text:=btrim(p_data->>'full_name'); v_phone text:=nullif(btrim(p_data->>'phone'),'');
 v_source text:=nullif(p_data->>'customer_source',''); v_referrer text:=nullif(btrim(p_data->>'referrer_name'),'');
 v_goal text:=nullif(p_data->>'learning_goal',''); v_certificate text:=nullif(btrim(p_data->>'certificate_goal'),'');
 v_enrolled date:=(p_data->>'enrollment_date')::date;
 v_start date:=nullif(p_data->>'learning_start_date','')::date;
 v_end date:=nullif(p_data->>'tuition_end_date','')::date;
 v_birth date:=nullif(p_data->>'date_of_birth','')::date;
 v_sales text:=btrim(p_data->>'salesperson'); v_notes text:=nullif(btrim(p_data->>'notes'),'');
 v_capacity integer; v_status text; v_count integer; v_id uuid; v_old public.b2c_enrollment_requests%rowtype;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Chỉ quản trị hoặc giáo vụ được thêm học viên B2C' using errcode='42501'; end if;
 if v_request is null or v_class is null or v_mode is null or v_mode not in ('new','existing')
 or v_enrolled is null or v_sales is null or char_length(v_sales) not between 1 and 200
 or coalesce(char_length(v_notes),0)>2000
 or (v_end is not null and (v_start is null or v_end<v_start))
 or (v_goal is not null and v_goal not in ('certificate','school','communication','work'))
 or (v_goal='certificate' and (v_certificate is null or char_length(v_certificate)>200)) then
  raise exception 'Thông tin ghi danh không hợp lệ; kiểm tra người chốt, ngày học và mục tiêu' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_request::text,0));
 select * into v_old from public.b2c_enrollment_requests where request_id=v_request;
 if found then
  if v_old.payload is distinct from p_data or v_old.created_by is distinct from auth.uid() then raise exception 'Mã yêu cầu đã dùng cho nội dung khác' using errcode='22023'; end if;
  return v_old.enrollment_id;
 end if;
 select capacity,status into v_capacity,v_status from public.b2c_classes where id=v_class for update;
 if not found then raise exception 'Không tìm thấy lớp B2C' using errcode='22023'; end if;
 if v_status in ('completed','cancelled') then raise exception 'Không thể ghi danh vào lớp đã hoàn thành hoặc hủy' using errcode='22023'; end if;
 if v_mode='existing' then
  if v_student is null or not exists(select 1 from public.b2c_students where id=v_student) then raise exception 'Không tìm thấy học viên đã chọn' using errcode='22023'; end if;
  if exists(select 1 from public.b2c_enrollments where class_id=v_class and student_id=v_student) then raise exception 'Học viên đã được ghi danh vào lớp này; hãy sửa ghi danh hiện có' using errcode='22023'; end if;
 else
  if v_student is not null or v_name is null or char_length(v_name) not between 2 and 200
   or (v_phone is not null and v_phone!~'^[0-9]{10}$')
   or (v_birth is not null and (v_birth>(now() at time zone 'Asia/Ho_Chi_Minh')::date or v_birth<'1900-01-01'))
   or coalesce(char_length(p_data->>'guardian_name'),0)>200 or coalesce(char_length(p_data->>'address'),0)>1000
   or coalesce(char_length(p_data->>'email'),0)>254
   or (nullif(p_data->>'email','') is not null and (p_data->>'email')!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
   or (v_source is not null and v_source not in ('facebook','zalo','referral','walk_in','school','other','tiktok'))
   or (v_source='referral' and (v_referrer is null or char_length(v_referrer)>200)) then
    raise exception 'Thông tin hồ sơ học viên không hợp lệ' using errcode='22023';
  end if;
 end if;
 select count(*) into v_count from public.b2c_enrollments where class_id=v_class and status not in ('withdrawn','completed');
 if v_count>=v_capacity then raise exception 'Lớp đã đủ sĩ số tối đa. Vui lòng tăng sức chứa hoặc chọn lớp khác.' using errcode='22023'; end if;
 if v_mode='new' then
  insert into public.b2c_students(source_key,full_name,date_of_birth,birth_year,guardian_name,phone,email,address,customer_source,referrer_name)
  values('manual:'||v_request::text,v_name,v_birth,extract(year from v_birth)::integer,nullif(btrim(p_data->>'guardian_name'),''),v_phone,nullif(btrim(p_data->>'email'),''),nullif(btrim(p_data->>'address'),''),v_source,case when v_source='referral' then v_referrer end)
  returning id into v_student;
 end if;
 insert into public.b2c_enrollments(source_key,class_id,student_id,salesperson,enrollment_date,learning_start_date,tuition_end_date,learning_goal,certificate_goal,notes,status)
 values('manual:'||v_request::text,v_class,v_student,v_sales,v_enrolled,v_start,v_end,v_goal,case when v_goal='certificate' then v_certificate end,v_notes,'studying') returning id into v_id;
 update public.b2c_classes set enrolled_count=v_count+1 where id=v_class;
 insert into public.b2c_enrollment_requests(request_id,payload,enrollment_id) values(v_request,p_data,v_id);
 return v_id;
end $$;
revoke all on function public.add_b2c_class_student(jsonb) from public,anon;
grant execute on function public.add_b2c_class_student(jsonb) to authenticated;
notify pgrst,'reload schema';
