-- Expand B2C attendance only; preserve historical late marks and permissions.
alter table public.b2c_student_attendance drop constraint b2c_student_attendance_status_check;
alter table public.b2c_student_attendance add constraint b2c_student_attendance_status_check check(status in ('present','late','absent','excused','makeup'));

create or replace function public.read_b2c_class_workspace(p_class_id uuid,p_tab text,p_page integer default 0,p_query text default '',p_meeting_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;v_total integer;v_stats jsonb;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý lớp B2C.' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>1000000 or length(coalesce(p_query,''))>200 then raise exception 'Bộ lọc không hợp lệ.'; end if;
 if not exists(select 1 from public.b2c_classes where id=p_class_id) then raise exception 'Không tìm thấy lớp.' using errcode='P0002'; end if;
 if p_meeting_id is not null and not exists(select 1 from public.b2c_class_meetings where id=p_meeting_id and class_id=p_class_id) then raise exception 'Buổi học không thuộc lớp.'; end if;
 if p_tab in ('students','attendance','tuition') then
  with filtered as (
   select e.id as enrollment_id,s.id as student_id,s.code as student_code,s.full_name,s.phone,e.status as student_status,e.enrollment_date,e.tuition_end_date,e.registered_sessions,c.name as class_name,
   (select string_agg(p.full_name,', ' order by p.full_name) from public.b2c_student_parents l join public.b2c_parents p on p.id=l.parent_id where l.student_id=s.id) as guardian_name
   from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id join public.b2c_classes c on c.id=e.class_id
   where e.class_id=p_class_id and strpos(lower(s.code||' '||s.full_name||' '||coalesce(s.phone,'')),lower(coalesce(p_query,'')))>0
  ), rows as (
   select f.*,a.id as attendance_id,a.status as attendance_status,a.note as attendance_note,a.updated_at as attendance_updated_at,
   t.id as package_id,t.sessions,t.unit_price,t.discount,t.discount_reason,t.total_due,
   case when t.id is null then null else coalesce(paid.amount,0) end as paid_amount,
   case when t.id is null then null else t.total_due-coalesce(paid.amount,0) end as balance
   from (select * from filtered order by student_code,enrollment_id limit 25 offset p_page::bigint*25) f
   left join public.b2c_student_attendance a on a.enrollment_id=f.enrollment_id and a.meeting_id=p_meeting_id
   left join public.b2c_tuition_packages t on t.enrollment_id=f.enrollment_id
   left join lateral (select sum(amount) as amount from public.b2c_tuition_receipts where package_id=t.id) paid on true
  ) select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(r) order by r.student_code,r.enrollment_id) from rows r),'[]'::jsonb) into v_total,v_rows;
  if p_tab='attendance' then
   select jsonb_build_object('present',count(*) filter(where status='present'),'late',count(*) filter(where status='late'),'absent',count(*) filter(where status='absent'),'excused',count(*) filter(where status='excused'),'makeup',count(*) filter(where status='makeup')) into v_stats from public.b2c_student_attendance where meeting_id=p_meeting_id;
  elsif p_tab='tuition' then
   select jsonb_build_object('total_due',coalesce(sum(t.total_due),0),'paid_amount',coalesce(sum(p.amount),0),'unconfigured',count(*) filter(where t.id is null)) into v_stats
   from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id left join public.b2c_tuition_packages t on t.enrollment_id=e.id
   left join lateral(select sum(amount) as amount from public.b2c_tuition_receipts where package_id=t.id) p on true
   where e.class_id=p_class_id and strpos(lower(s.code||' '||s.full_name||' '||coalesce(s.phone,'')),lower(coalesce(p_query,'')))>0;
  end if;
 elsif p_tab='schedule' then
  select count(*) into v_total from public.b2c_class_meetings where class_id=p_class_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.starts_at desc,r.id),'[]'::jsonb) into v_rows from (select * from public.b2c_class_meetings where class_id=p_class_id order by starts_at desc,id limit 25 offset p_page::bigint*25) r;
 elsif p_tab='comments' then
  select count(*) into v_total from public.b2c_student_comments where class_id=p_class_id and (p_meeting_id is null or meeting_id=p_meeting_id);
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]'::jsonb) into v_rows from (
   select n.*,s.code as student_code,s.full_name,m.starts_at as meeting_starts_at from public.b2c_student_comments n join public.b2c_enrollments e on e.id=n.enrollment_id join public.b2c_students s on s.id=e.student_id left join public.b2c_class_meetings m on m.id=n.meeting_id
   where n.class_id=p_class_id and (p_meeting_id is null or n.meeting_id=p_meeting_id) order by n.created_at desc,n.id limit 25 offset p_page::bigint*25
  ) r;
 else raise exception 'Mục không hợp lệ.';
 end if;
 return jsonb_build_object('rows',v_rows,'total',v_total,'stats',v_stats,'meeting',(select to_jsonb(m) from public.b2c_class_meetings m where id=p_meeting_id and class_id=p_class_id));
end $$;


create or replace function public.read_teacher_b2c_workspace(p_class_id uuid,p_tab text,p_page integer default 0,p_query text default '',p_meeting_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;v_total integer;v_stats jsonb;
begin
 if p_meeting_id is not null and not app.has_b2c_permission('view_schedule',p_class_id) then raise exception 'Không có quyền xem buổi học.' using errcode='42501'; end if;
 if not app.has_b2c_permission('view_classes',p_class_id) or not app.has_b2c_permission(case p_tab when 'students' then 'view_students' when 'attendance' then 'mark_attendance' when 'tuition' then 'view_tuition' when 'schedule' then 'view_schedule' when 'comments' then 'view_comments' else '' end,p_class_id) then raise exception 'Không có quyền quản lý lớp B2C.' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>1000000 or length(coalesce(p_query,''))>200 then raise exception 'Bộ lọc không hợp lệ.'; end if;
 if not exists(select 1 from public.b2c_classes where id=p_class_id) then raise exception 'Không tìm thấy lớp.' using errcode='P0002'; end if;
 if p_meeting_id is not null and not exists(select 1 from public.b2c_class_meetings where id=p_meeting_id and class_id=p_class_id) then raise exception 'Buổi học không thuộc lớp.'; end if;
 if p_tab in ('students','attendance','tuition') then
  with filtered as (
   select e.id as enrollment_id,s.id as student_id,s.code as student_code,s.full_name,s.phone,e.status as student_status,e.enrollment_date,e.tuition_end_date,e.registered_sessions,c.name as class_name,
   (select string_agg(p.full_name,', ' order by p.full_name) from public.b2c_student_parents l join public.b2c_parents p on p.id=l.parent_id where l.student_id=s.id) as guardian_name
   from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id join public.b2c_classes c on c.id=e.class_id
   where e.class_id=p_class_id and strpos(lower(s.code||' '||s.full_name||' '||coalesce(s.phone,'')),lower(coalesce(p_query,'')))>0
  ), rows as (
   select f.*,a.id as attendance_id,a.status as attendance_status,a.note as attendance_note,a.updated_at as attendance_updated_at,
   t.id as package_id,t.sessions,t.unit_price,t.discount,t.discount_reason,t.total_due,
   case when t.id is null then null else coalesce(paid.amount,0) end as paid_amount,
   case when t.id is null then null else t.total_due-coalesce(paid.amount,0) end as balance
   from (select * from filtered order by student_code,enrollment_id limit 25 offset p_page::bigint*25) f
   left join public.b2c_student_attendance a on a.enrollment_id=f.enrollment_id and a.meeting_id=p_meeting_id
   left join public.b2c_tuition_packages t on t.enrollment_id=f.enrollment_id
   left join lateral (select sum(amount) as amount from public.b2c_tuition_receipts where package_id=t.id) paid on true
  ) select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(r) order by r.student_code,r.enrollment_id) from rows r),'[]'::jsonb) into v_total,v_rows;
  if p_tab='attendance' then
   select jsonb_build_object('present',count(*) filter(where status='present'),'late',count(*) filter(where status='late'),'absent',count(*) filter(where status='absent'),'excused',count(*) filter(where status='excused'),'makeup',count(*) filter(where status='makeup')) into v_stats from public.b2c_student_attendance where meeting_id=p_meeting_id;
  elsif p_tab='tuition' then
   select jsonb_build_object('total_due',coalesce(sum(t.total_due),0),'paid_amount',coalesce(sum(p.amount),0),'unconfigured',count(*) filter(where t.id is null)) into v_stats
   from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id left join public.b2c_tuition_packages t on t.enrollment_id=e.id
   left join lateral(select sum(amount) as amount from public.b2c_tuition_receipts where package_id=t.id) p on true
   where e.class_id=p_class_id and strpos(lower(s.code||' '||s.full_name||' '||coalesce(s.phone,'')),lower(coalesce(p_query,'')))>0;
  end if;
 elsif p_tab='schedule' then
  select count(*) into v_total from public.b2c_class_meetings where class_id=p_class_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.starts_at desc,r.id),'[]'::jsonb) into v_rows from (select * from public.b2c_class_meetings where class_id=p_class_id order by starts_at desc,id limit 25 offset p_page::bigint*25) r;
 elsif p_tab='comments' then
  select count(*) into v_total from public.b2c_student_comments where class_id=p_class_id and (p_meeting_id is null or meeting_id=p_meeting_id);
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]'::jsonb) into v_rows from (
   select n.*,s.code as student_code,s.full_name,m.starts_at as meeting_starts_at from public.b2c_student_comments n join public.b2c_enrollments e on e.id=n.enrollment_id join public.b2c_students s on s.id=e.student_id left join public.b2c_class_meetings m on m.id=n.meeting_id
   where n.class_id=p_class_id and (p_meeting_id is null or n.meeting_id=p_meeting_id) order by n.created_at desc,n.id limit 25 offset p_page::bigint*25
  ) r;
 else raise exception 'Mục không hợp lệ.';
 end if;
 if p_tab in ('students','attendance') then
  select coalesce(jsonb_agg(r-array['package_id','sessions','unit_price','discount','discount_reason','total_due','paid_amount','balance','phone','guardian_name','tuition_end_date']),'[]') into v_rows from jsonb_array_elements(v_rows) r;
 end if;
 return jsonb_build_object('class',(select jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'program_slug',c.program_slug,'teacher_name',c.teacher_name,'weekdays_text',case when app.has_b2c_permission('view_schedule',c.id) then c.weekdays_text end,'time_text',case when app.has_b2c_permission('view_schedule',c.id) then c.time_text end,'capacity',c.capacity,'enrolled_count',case when app.has_b2c_permission('view_students',c.id) then c.enrolled_count end,'start_date',c.start_date,'campus',c.campus,'delivery_mode',c.delivery_mode,'notes',c.notes) from public.b2c_classes c where c.id=p_class_id),'schedules',case when p_tab='schedule' then (select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.b2c_class_schedules s where s.class_id=p_class_id) else '[]'::jsonb end,'rows',v_rows,'total',v_total,'stats',v_stats,'meeting',(select to_jsonb(m) from public.b2c_class_meetings m where id=p_meeting_id and class_id=p_class_id));
end $$;


