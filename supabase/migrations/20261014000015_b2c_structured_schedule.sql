create extension if not exists btree_gist with schema extensions;
create table public.b2c_class_schedules (
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.b2c_classes(id) on delete restrict,
 weekdays integer[] not null check(cardinality(weekdays) between 1 and 7 and weekdays<@array[1,2,3,4,5,6,7]),
 start_time time not null,end_time time not null,
 room_name text not null default '' check(length(room_name)<=120),
 date_from date not null,date_to date not null,
 created_at timestamptz not null default clock_timestamp(),created_by uuid not null references auth.users(id),
 check(start_time<end_time and end_time-start_time<=interval '12 hours'),
 check(date_from>=date '1900-01-01' and date_to>=date_from and date_to-date_from<=365),
 unique(class_id,weekdays,start_time,end_time,room_name,date_from,date_to)
);
create index b2c_schedules_class on public.b2c_class_schedules(class_id,date_from,date_to);
alter table public.b2c_class_schedules enable row level security;
revoke all on public.b2c_class_schedules from public,anon,authenticated;
grant select on public.b2c_class_schedules to authenticated;
create policy b2c_schedules_manager_read on public.b2c_class_schedules for select to authenticated using(app.is_manager());
alter table public.b2c_class_meetings
 add column schedule_id uuid references public.b2c_class_schedules(id) on delete restrict,
 add column room_name text not null default '' check(length(room_name)<=120),
 add column room_key text generated always as (nullif(upper(regexp_replace(btrim(room_name),'\s+',' ','g')),'')) stored;
-- Half-open ranges allow one class to start exactly when the previous one ends.
alter table public.b2c_class_meetings add constraint b2c_meeting_room_overlap
 exclude using gist (room_key with =,tstzrange(starts_at,ends_at,'[)') with &&)
 where(status<>'cancelled' and room_key is not null);
create index b2c_meetings_schedule on public.b2c_class_meetings(schedule_id) where schedule_id is not null;

create function public.generate_b2c_class_schedule(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_class uuid:=(p_data->>'class_id')::uuid;v_request uuid:=(p_data->>'request_id')::uuid;
 v_days integer[];v_from date:=(p_data->>'date_from')::date;v_to date:=(p_data->>'date_to')::date;
 v_start time:=(p_data->>'start_time')::time;v_end time:=(p_data->>'end_time')::time;
 v_room text:=upper(regexp_replace(btrim(coalesce(p_data->>'room_name','')),'\s+',' ','g'));
 v_teacher text;v_name text;v_open date;s public.b2c_class_schedules;old_request public.b2c_class_requests;
 d date;a timestamptz;b timestamptz;m public.b2c_class_meetings;v_created integer:=0;v_skipped integer:=0;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền xếp lịch B2C.' using errcode='42501'; end if;
 if v_class is null or v_request is null then raise exception 'Thiếu lớp hoặc mã yêu cầu.'; end if;
 select array_agg(distinct x order by x) into v_days from jsonb_array_elements_text(p_data->'weekdays') x0(x_text) cross join lateral(select x_text::integer x) x1;
 if coalesce(cardinality(v_days),0)<1 or cardinality(v_days)>7 or not v_days<@array[1,2,3,4,5,6,7] or v_from is null or v_to is null or v_start is null or v_end is null or v_end<=v_start or v_end-v_start>interval '12 hours' or v_from<date '1900-01-01' or v_to<v_from or v_to-v_from>365 or length(v_room)>120 then raise exception 'Lịch không hợp lệ: chọn thứ, giờ cùng ngày tối đa 12 giờ, khoảng ngày tối đa 366 ngày.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_request::text,0));
 select * into old_request from public.b2c_class_requests where request_id=v_request;
 if old_request.request_id is not null then
  if old_request.actor_id<>auth.uid() or old_request.action<>'generate_schedule' or old_request.payload<>p_data then raise exception 'Mã yêu cầu đã được sử dụng.'; end if;
  return jsonb_build_object('schedule_id',old_request.result_id,'retry',true,'created',0,'skipped',0);
 end if;
 select teacher_name,start_date into v_teacher,v_open from public.b2c_classes where id=v_class for update;
 if not found then raise exception 'Không tìm thấy lớp.'; end if;
 if v_open is not null and v_from<v_open then raise exception 'Không sinh buổi trước ngày khai giảng.'; end if;
 if not exists(select 1 from generate_series(v_from::timestamp,v_to::timestamp,interval '1 day') x where extract(isodow from x)::integer=any(v_days)) then raise exception 'Khoảng ngày không có thứ đã chọn.'; end if;
 insert into public.b2c_class_schedules(class_id,weekdays,start_time,end_time,room_name,date_from,date_to,created_by)
 values(v_class,v_days,v_start,v_end,v_room,v_from,v_to,auth.uid())
 on conflict(class_id,weekdays,start_time,end_time,room_name,date_from,date_to) do update set class_id=excluded.class_id returning * into s;
 for d in select x::date from generate_series(v_from::timestamp,v_to::timestamp,interval '1 day') x where extract(isodow from x)::integer=any(v_days) order by x loop
  a:=(d+v_start) at time zone 'Asia/Ho_Chi_Minh';b:=(d+v_end) at time zone 'Asia/Ho_Chi_Minh';
  select * into m from public.b2c_class_meetings where class_id=v_class and starts_at=a;
  if m.id is not null then
   if m.ends_at<>b or coalesce(m.room_key,'')<>v_room then raise exception 'Đã có buổi khác giờ hoặc phòng vào ngày %. Không ghi đè buổi cũ.',d; end if;
   v_skipped:=v_skipped+1;continue;
  end if;
  if exists(select 1 from public.b2c_class_meetings where class_id=v_class and status<>'cancelled' and starts_at<b and ends_at>a) then raise exception 'Lớp đã có buổi học trùng giờ ngày %.',d; end if;
  insert into public.b2c_class_meetings(request_id,class_id,schedule_id,starts_at,ends_at,teacher_name,room_name,created_by,updated_by)
  values(gen_random_uuid(),v_class,s.id,a,b,coalesce(v_teacher,''),v_room,auth.uid(),auth.uid());
  v_created:=v_created+1;
 end loop;
 select full_name into v_name from public.profiles where id=auth.uid();
 insert into public.b2c_class_requests(request_id,action,payload,result_id,actor_id) values(v_request,'generate_schedule',p_data,s.id,auth.uid());
 insert into public.b2c_class_history(class_id,action,after_data,actor_id,actor_name) values(v_class,'generate_schedule',jsonb_build_object('schedule',to_jsonb(s),'created',v_created,'skipped',v_skipped),auth.uid(),v_name);
 return jsonb_build_object('schedule_id',s.id,'created',v_created,'skipped',v_skipped,'retry',false);
exception when exclusion_violation then raise exception 'Phòng đã được dùng trong khung giờ này. Đổi phòng hoặc giờ; chưa lưu lịch/buổi nào.';
end $$;
revoke all on function public.generate_b2c_class_schedule(jsonb) from public,anon;
grant execute on function public.generate_b2c_class_schedule(jsonb) to authenticated;

create function public.read_my_b2c_today() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;v_rows jsonb;v_override jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('teacher','academic_manager')) then raise exception 'Không có quyền giáo viên.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.starts_at,r.id),'[]'::jsonb) into v_rows from (
  select m.id,m.class_id,c.code,c.name,m.starts_at,m.ends_at,m.room_name,m.status
  from public.b2c_class_meetings m join public.b2c_classes c on c.id=m.class_id
  where app.teaches_b2c_class(c.id) and m.starts_at>=d::timestamp at time zone 'Asia/Ho_Chi_Minh' and m.starts_at<(d+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'
 ) r;
 select coalesce(jsonb_agg(c.id),'[]'::jsonb) into v_override from public.b2c_classes c where app.teaches_b2c_class(c.id) and
 (exists(select 1 from public.b2c_class_schedules s where s.class_id=c.id and d between s.date_from and s.date_to)
 or exists(select 1 from public.b2c_class_meetings m where m.class_id=c.id and m.starts_at>=d::timestamp at time zone 'Asia/Ho_Chi_Minh' and m.starts_at<(d+1)::timestamp at time zone 'Asia/Ho_Chi_Minh'));
 return jsonb_build_object('rows',v_rows,'override_class_ids',v_override);
end $$;
revoke all on function public.read_my_b2c_today() from public,anon;
grant execute on function public.read_my_b2c_today() to authenticated;

-- Forward replacements preserve all existing guards and mutation history.
create or replace function public.write_b2c_class_workspace(p_action text,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_request uuid:=(p_data->>'request_id')::uuid;v_class uuid:=(p_data->>'class_id')::uuid;v_id uuid;v_name text;
 old_request public.b2c_class_requests;m public.b2c_class_meetings;old_m public.b2c_class_meetings;a public.b2c_student_attendance;old_a public.b2c_student_attendance;
 v_start timestamptz;v_end timestamptz;v_enrollment uuid;v_before jsonb;v_after jsonb;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý lớp B2C.' using errcode='42501'; end if;
 if v_request is null or v_class is null then raise exception 'Thiếu lớp hoặc mã yêu cầu.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_request::text,0));
 select * into old_request from public.b2c_class_requests where request_id=v_request;
 if old_request.request_id is not null then
  if old_request.actor_id<>auth.uid() or old_request.action<>p_action or old_request.payload<>p_data then raise exception 'Mã yêu cầu đã được sử dụng.'; end if;
  return old_request.result_id;
 end if;
 select full_name into v_name from public.profiles where id=auth.uid();
 if not exists(select 1 from public.b2c_classes where id=v_class) then raise exception 'Không tìm thấy lớp.'; end if;
 if p_action='save_meeting' then
  perform 1 from public.b2c_classes where id=v_class for update;
  v_start:=(p_data->>'starts_at')::timestamptz;v_end:=(p_data->>'ends_at')::timestamptz;
  if v_start is null or v_end is null or (v_start at time zone 'Asia/Ho_Chi_Minh')::date<date '1900-01-01' or v_end<=v_start or v_end>v_start+interval '12 hours' or (v_start at time zone 'Asia/Ho_Chi_Minh')::date<>(v_end at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Giờ học phải cùng ngày, kết thúc sau bắt đầu và tối đa 12 giờ.'; end if;
  if nullif(p_data->>'id','') is not null then
   select * into m from public.b2c_class_meetings where id=(p_data->>'id')::uuid and class_id=v_class for update;
   if m.id is null then raise exception 'Không tìm thấy buổi học của lớp.'; end if;
   if m.schedule_id is not null and (v_start<>m.starts_at or v_end<>m.ends_at) then raise exception 'Buổi sinh từ lịch lặp giữ nguyên giờ gốc. Hủy buổi và thêm buổi bù khi cần đổi giờ.'; end if;
   if m.teaching_session_id is not null then raise exception 'Buổi liên kết lịch dạy chỉ xem tại đây.'; end if;
   if m.updated_at is distinct from (p_data->>'expected_updated_at')::timestamptz then raise exception 'Buổi học đã thay đổi. Tải lại trước khi sửa.'; end if;
   if (v_start<>m.starts_at or v_end<>m.ends_at or p_data->>'status'='cancelled') and (exists(select 1 from public.b2c_student_attendance where meeting_id=m.id) or exists(select 1 from public.b2c_student_comments where meeting_id=m.id)) then raise exception 'Buổi đã có điểm danh/nhận xét; giữ thời gian và không hủy lịch sử.'; end if;
   old_m:=m;
  end if;
  if coalesce(p_data->>'status','planned')<>'cancelled' and exists(select 1 from public.b2c_class_meetings where class_id=v_class and id is distinct from m.id and status<>'cancelled' and starts_at<v_end and ends_at>v_start) then raise exception 'Lớp đã có buổi học trùng giờ.'; end if;
  if m.id is null then
   insert into public.b2c_class_meetings(request_id,class_id,starts_at,ends_at,teacher_name,room_name,status,note,created_by,updated_by) values(v_request,v_class,v_start,v_end,btrim(coalesce(p_data->>'teacher_name','')),btrim(coalesce(p_data->>'room_name','')),coalesce(p_data->>'status','planned'),coalesce(p_data->>'note',''),auth.uid(),auth.uid()) returning * into m;
  else
   update public.b2c_class_meetings set starts_at=v_start,ends_at=v_end,teacher_name=btrim(coalesce(p_data->>'teacher_name','')),room_name=btrim(coalesce(p_data->>'room_name','')),status=p_data->>'status',note=coalesce(p_data->>'note',''),updated_at=clock_timestamp(),updated_by=auth.uid() where id=m.id returning * into m;
  end if;
  v_id:=m.id;v_before:=case when old_m.id is null then null else to_jsonb(old_m) end;v_after:=to_jsonb(m);
 elsif p_action in ('save_attendance','add_comment') then
  v_enrollment:=(p_data->>'enrollment_id')::uuid;
  if not exists(select 1 from public.b2c_enrollments where id=v_enrollment and class_id=v_class) then raise exception 'Học viên không thuộc lớp.'; end if;
  if nullif(p_data->>'meeting_id','') is not null then
   select * into m from public.b2c_class_meetings where id=(p_data->>'meeting_id')::uuid and class_id=v_class for update;
   if m.id is null or m.status='cancelled' then raise exception 'Buổi học không thuộc lớp hoặc đã hủy.'; end if;
  end if;
  if p_action='save_attendance' then
   if m.id is null then raise exception 'Chọn buổi học trước khi điểm danh.'; end if;
   if (m.starts_at at time zone 'Asia/Ho_Chi_Minh')::date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Chưa đến ngày điểm danh buổi học.'; end if;
   select * into a from public.b2c_student_attendance where meeting_id=m.id and enrollment_id=v_enrollment for update;
   if a.updated_at is distinct from (p_data->>'expected_updated_at')::timestamptz then raise exception 'Điểm danh đã thay đổi. Tải lại trước khi sửa.'; end if;
   old_a:=a;
   insert into public.b2c_student_attendance(meeting_id,enrollment_id,status,note,updated_by) values(m.id,v_enrollment,p_data->>'status',coalesce(p_data->>'note',''),auth.uid())
   on conflict(meeting_id,enrollment_id) do update set status=excluded.status,note=excluded.note,updated_by=auth.uid(),updated_at=clock_timestamp() returning * into a;
   v_id:=a.id;v_before:=case when old_a.id is null then null else to_jsonb(old_a) end;v_after:=to_jsonb(a);
  else
   insert into public.b2c_student_comments(class_id,enrollment_id,meeting_id,content,created_by,actor_name) values(v_class,v_enrollment,m.id,btrim(p_data->>'content'),auth.uid(),v_name) returning id into v_id;
   v_after:=jsonb_build_object('id',v_id,'enrollment_id',v_enrollment,'meeting_id',m.id,'content',btrim(p_data->>'content'));
  end if;
 else raise exception 'Thao tác không hợp lệ.';
 end if;
 insert into public.b2c_class_requests(request_id,action,payload,result_id,actor_id) values(v_request,p_action,p_data,v_id,auth.uid()) on conflict(request_id) do nothing;
 insert into public.b2c_class_history(class_id,action,before_data,after_data,actor_id,actor_name) values(v_class,p_action,v_before,v_after,auth.uid(),v_name);
 return v_id;
end $$;

create or replace function public.read_my_b2c_classes(p_class_id uuid default null,p_tab text default 'students',p_page integer default 0,p_query text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;v_total integer;v_class jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('teacher','academic_manager')) then
  raise exception 'Không có quyền giáo viên.' using errcode='42501';
 end if;
 if p_page is null or p_page<0 or p_page>1000000 or length(coalesce(p_query,''))>200 then raise exception 'Bộ lọc không hợp lệ.'; end if;
 if p_class_id is null then
  select coalesce(jsonb_agg(to_jsonb(r) order by r.code),'[]'::jsonb) into v_rows from (
   select c.id,c.code,c.name,c.program_slug,c.status,c.capacity,c.weekdays_text,c.time_text,c.campus,c.start_date,
    (select count(*) from public.b2c_enrollments e where e.class_id=c.id) as student_count
   from public.b2c_classes c where app.teaches_b2c_class(c.id)
  ) r;
  return jsonb_build_object('rows',v_rows,'total',jsonb_array_length(v_rows));
 end if;
 if not app.teaches_b2c_class(p_class_id) then raise exception 'Bạn không được phân công lớp này.' using errcode='42501'; end if;
 select jsonb_build_object('id',id,'code',code,'name',name,'program_slug',program_slug,'status',status,'capacity',capacity,'weekdays_text',weekdays_text,'time_text',time_text,'campus',campus,'start_date',start_date) into v_class from public.b2c_classes where id=p_class_id;
 if p_tab='students' then
  with filtered as (
   select s.code,s.full_name,e.status,e.enrollment_date from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id
   where e.class_id=p_class_id and strpos(lower(s.code||' '||s.full_name),lower(coalesce(p_query,'')))>0
  ) select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(r) order by r.code) from (select * from filtered order by code limit 25 offset p_page::bigint*25) r),'[]'::jsonb) into v_total,v_rows;
 elsif p_tab='schedule' then
  select count(*) into v_total from public.b2c_class_meetings where class_id=p_class_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.starts_at desc,r.id),'[]'::jsonb) into v_rows from (
   select id,starts_at,ends_at,status,teacher_name,room_name,schedule_id from public.b2c_class_meetings where class_id=p_class_id order by starts_at desc,id limit 25 offset p_page::bigint*25
  ) r;
 elsif p_tab='comments' then
  select count(*) into v_total from public.b2c_student_comments where class_id=p_class_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]'::jsonb) into v_rows from (
   select n.id,s.code,s.full_name,n.content,n.actor_name,n.created_at from public.b2c_student_comments n join public.b2c_enrollments e on e.id=n.enrollment_id join public.b2c_students s on s.id=e.student_id
   where n.class_id=p_class_id order by n.created_at desc,n.id limit 25 offset p_page::bigint*25
  ) r;
 else raise exception 'Mục không hợp lệ.'; end if;
 return jsonb_build_object('class',v_class,'rows',v_rows,'total',v_total);
end $$;

notify pgrst,'reload schema';
