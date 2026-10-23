-- Opt-in permission for center-wide profile completion; no hardcoded account IDs.
alter table public.b2c_teacher_permissions drop constraint known_b2c_permissions;
alter table public.b2c_teacher_permissions add constraint known_b2c_permissions check(permissions <@ array['view_classes','view_students','view_schedule','view_comments','write_comments','mark_attendance','check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition','view_assessments','grade_assessments','share_monthly_comments','manage_admissions','manage_center_tuition','manage_center_student_data']::text[]);
do $$ declare d text; begin
 select pg_get_functiondef('app.has_b2c_permission(text,uuid)'::regprocedure) into d;
 if position('''manage_center_tuition''' in d)=0 then raise exception 'Unexpected permission guard'; end if;
 -- Only add to the known-key list, never to the global tuition-scope condition.
 d:=replace(d,'''manage_admissions'',''manage_center_tuition''','''manage_admissions'',''manage_center_tuition'',''manage_center_student_data''');
 execute d;
 select pg_get_functiondef('public.save_b2c_teacher_permissions(uuid,uuid,text[],timestamptz)'::regprocedure) into d;
 if position('''manage_center_tuition'']' in d)=0 then raise exception 'Unexpected permission editor'; end if;
 execute replace(d,'''manage_center_tuition'']','''manage_center_tuition'',''manage_center_student_data'']');
end $$;

create function public.read_center_b2c_student_data(p_query text default '',p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not coalesce(app.has_b2c_permission('manage_center_student_data'),false) then raise exception 'Không có quyền bổ sung hồ sơ toàn trung tâm.' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 1000000 or p_query is null or char_length(p_query)>200 then raise exception 'Bộ lọc không hợp lệ.' using errcode='22023'; end if;
 with filtered as (
  select e.id as enrollment_id,s.id as student_id,s.code,s.full_name,s.phone,s.customer_source,s.referrer_name,
   e.class_id,c.name as class_name,c.teacher_name,e.salesperson,e.enrollment_date,e.learning_start_date,e.tuition_end_date,
   s.updated_at as student_updated_at,e.updated_at as enrollment_updated_at
  from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id join public.b2c_classes c on c.id=e.class_id
  where btrim(p_query)='' or position(lower(btrim(p_query)) in lower(concat_ws(' ',s.code,s.full_name,s.phone,c.name,c.teacher_name,e.salesperson)))>0
 ), page_rows as(select * from filtered order by full_name,code,enrollment_id limit 50 offset p_page::bigint*50)
 select jsonb_build_object('total',(select count(*) from filtered),'students',(select count(distinct student_id) from filtered),
  'rows',coalesce((select jsonb_agg(to_jsonb(r) order by full_name,code,enrollment_id) from page_rows r),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.save_center_b2c_student_data(p_data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare e public.b2c_enrollments; s public.b2c_students;
 v_phone text:=nullif(btrim(p_data->>'phone'),''); v_source text:=nullif(p_data->>'customer_source','');
 v_ref text:=nullif(btrim(p_data->>'referrer_name'),''); v_sales text:=nullif(btrim(p_data->>'salesperson'),'');
 v_enrolled date:=nullif(p_data->>'enrollment_date','')::date;
 v_start date:=nullif(p_data->>'learning_start_date','')::date; v_end date:=nullif(p_data->>'tuition_end_date','')::date;
begin
 if not coalesce(app.has_b2c_permission('manage_center_student_data'),false) then raise exception 'Không có quyền bổ sung hồ sơ toàn trung tâm.' using errcode='42501'; end if;
 if v_phone is not null and v_phone!~'^[0-9]{10}$' then raise exception 'SĐT phải có đúng 10 chữ số.' using errcode='22023'; end if;
 if (v_source is not null and v_source not in ('facebook','zalo','tiktok','referral','walk_in','school','other'))
  or (v_source='referral' and v_ref is null) or char_length(v_ref)>200 or char_length(v_sales)>200
  or (v_end is not null and (v_start is null or v_end<v_start)) then raise exception 'Kiểm tra nguồn khách, người giới thiệu và ngày học/hết phí.' using errcode='22023'; end if;
 -- Lock student before enrollment, sharing the same order for students in multiple classes.
 select st.* into s from public.b2c_students st join public.b2c_enrollments en on en.student_id=st.id where en.id=(p_data->>'enrollment_id')::uuid for update of st;
 if not found then raise exception 'Không tìm thấy học viên.' using errcode='22023'; end if;
 select * into e from public.b2c_enrollments where id=(p_data->>'enrollment_id')::uuid for update;
 if s.updated_at is distinct from (p_data->>'student_updated_at')::timestamptz or e.updated_at is distinct from (p_data->>'enrollment_updated_at')::timestamptz then raise exception 'Hồ sơ đã thay đổi. Tải lại trước khi lưu.' using errcode='40001'; end if;
 update public.b2c_students set phone=v_phone,customer_source=v_source,referrer_name=case when v_source='referral' then v_ref end where id=s.id;
 update public.b2c_enrollments set salesperson=v_sales,enrollment_date=v_enrolled,learning_start_date=v_start,tuition_end_date=v_end where id=e.id;
end $$;
revoke all on function public.read_center_b2c_student_data(text,integer),public.save_center_b2c_student_data(jsonb) from public,anon;
grant execute on function public.read_center_b2c_student_data(text,integer),public.save_center_b2c_student_data(jsonb) to authenticated;
notify pgrst,'reload schema';
