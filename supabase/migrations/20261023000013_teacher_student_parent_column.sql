begin;

create or replace function public.read_center_b2c_student_data(p_query text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not coalesce(app.has_b2c_permission('manage_center_student_data'),false) then raise exception 'Không có quyền bổ sung hồ sơ toàn trung tâm.' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 1000000 or p_query is null or char_length(p_query)>200 then raise exception 'Bộ lọc không hợp lệ.' using errcode='22023'; end if;
 with student_rows as (
  select s.*,
   coalesce((
    select string_agg(p.full_name||' · '||case l.relationship
      when 'father' then 'Ba/Bố' when 'mother' then 'Mẹ' when 'grandparent' then 'Ông/Bà'
      when 'guardian' then 'Người giám hộ' when 'other' then 'Khác' else 'Chưa xác định' end, E'\n' order by p.full_name,p.id)
    from public.b2c_student_parents l join public.b2c_parents p on p.id=l.parent_id
    where l.student_id=s.id
   ),nullif(btrim(s.guardian_name),'')) as guardian_summary
  from public.b2c_students s
 ), filtered as (
  select e.id as enrollment_id,s.id as student_id,s.code,s.full_name,s.phone,s.customer_source,s.referrer_name,s.guardian_summary,
   e.class_id,c.name as class_name,c.teacher_name,e.salesperson,e.enrollment_date,e.learning_start_date,e.tuition_end_date,
   s.updated_at as student_updated_at,e.updated_at as enrollment_updated_at
  from student_rows s
  left join public.b2c_enrollments e on e.student_id=s.id
  left join public.b2c_classes c on c.id=e.class_id
  where btrim(p_query)='' or position(lower(btrim(p_query)) in lower(concat_ws(' ',s.code,s.full_name,s.phone,s.guardian_summary,c.name,c.teacher_name,e.salesperson)))>0
 ), page_rows as(
  select * from filtered order by (enrollment_id is null) desc,full_name,code,enrollment_id
  limit 50 offset p_page::bigint*50
 )
 select jsonb_build_object('total',(select count(*) from filtered),'students',(select count(distinct student_id) from filtered),
  'rows',coalesce((select jsonb_agg(to_jsonb(r) order by (enrollment_id is null) desc,full_name,code,enrollment_id) from page_rows r),'[]'::jsonb)) into result;
 return result;
end $$;

notify pgrst,'reload schema';
commit;
