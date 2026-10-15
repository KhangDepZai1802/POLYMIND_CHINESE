-- Per-teacher B2C permissions. Existing teacher identity and manager roles stay intact.
create table public.b2c_teacher_permissions (
 teacher_id uuid primary key references public.b2c_teachers(id) on delete restrict,
 permissions text[] not null,
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null references public.profiles(id),
 constraint known_b2c_permissions check (permissions <@ array['view_classes','view_students','view_schedule','view_comments','write_comments','mark_attendance','check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition']::text[])
);
alter table public.b2c_teacher_permissions enable row level security;
create policy b2c_permissions_read on public.b2c_teacher_permissions for select to authenticated using(app.is_manager());
revoke all on public.b2c_teacher_permissions from public,anon,authenticated;
grant select on public.b2c_teacher_permissions to authenticated;
create table public.b2c_teacher_permission_history (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.b2c_teachers(id),
 before_data jsonb, after_data jsonb not null, actor_id uuid not null references public.profiles(id), created_at timestamptz not null default clock_timestamp()
);
alter table public.b2c_teacher_permission_history enable row level security;
create policy b2c_permissions_history_read on public.b2c_teacher_permission_history for select to authenticated using(app.is_manager());
revoke all on public.b2c_teacher_permission_history from public,anon,authenticated;
grant select on public.b2c_teacher_permission_history to authenticated;

create function app.my_b2c_teacher_id() returns uuid language sql stable security definer set search_path='' as $$
 select b.id from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id join public.profiles p on p.id=t.user_id
 where p.id=auth.uid() and p.is_active and t.is_active and p.role in ('teacher','academic_manager')
$$;
create function public.get_my_b2c_permissions() returns text[] language sql stable security definer set search_path='' as $$
 select case when app.my_b2c_teacher_id() is null then array[]::text[] else coalesce((select permissions from public.b2c_teacher_permissions where teacher_id=app.my_b2c_teacher_id()),array['view_classes','view_students','view_schedule','view_comments','check_teaching','view_pay']::text[]) end
$$;
create function app.has_b2c_permission(p_key text,p_class uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(p_key=any(array['view_classes','view_students','view_schedule','view_comments','write_comments','mark_attendance','check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition']) and
 (app.is_manager() or (p_key=any(public.get_my_b2c_permissions()) and (p_class is null or app.teaches_b2c_class(p_class)))),false)
$$;
create function public.has_b2c_permission(p_key text,p_class uuid default null) returns boolean language sql stable security definer set search_path='' as $$ select app.has_b2c_permission(p_key,p_class) $$;
revoke all on function app.my_b2c_teacher_id(),app.has_b2c_permission(text,uuid) from public,anon,authenticated;
revoke all on function public.get_my_b2c_permissions(),public.has_b2c_permission(text,uuid) from public,anon;
grant execute on function public.get_my_b2c_permissions(),public.has_b2c_permission(text,uuid) to authenticated;

create function public.read_b2c_permission_admin() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền phân quyền B2C.' using errcode='42501'; end if;
 return jsonb_build_object('teachers',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'full_name',b.full_name,'source_teacher_id',b.source_teacher_id,'account_name',p.full_name,'active',coalesce(p.is_active and t.is_active and p.role in ('teacher','academic_manager'),false),'permissions',coalesce(g.permissions,array['view_classes','view_students','view_schedule','view_comments','check_teaching','view_pay']::text[]),'updated_at',g.updated_at) order by b.full_name,b.id),'[]') from public.b2c_teachers b left join public.teachers t on t.id=b.source_teacher_id left join public.profiles p on p.id=t.user_id left join public.b2c_teacher_permissions g on g.teacher_id=b.id),
 'accounts',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'full_name',p.full_name) order by p.full_name,t.id),'[]') from public.teachers t join public.profiles p on p.id=t.user_id where t.is_active and p.is_active and p.role in ('teacher','academic_manager')));
end $$;
create function public.save_b2c_teacher_permissions(p_teacher_id uuid,p_source_teacher_id uuid,p_permissions text[],p_expected_updated_at timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare old public.b2c_teacher_permissions; v_before jsonb; v_source uuid; deps jsonb:='{"view_students":["view_classes"],"view_schedule":["view_classes"],"view_comments":["view_classes"],"write_comments":["view_comments","view_students"],"mark_attendance":["view_students","view_schedule"],"create_classes":["view_classes"],"edit_classes":["view_classes"],"edit_schedule":["view_schedule"],"edit_students":["view_students"],"view_tuition":["view_classes"],"collect_tuition":["view_tuition"],"edit_tuition":["view_tuition"]}'; k text;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền phân quyền B2C.' using errcode='42501'; end if;
 if p_permissions is null or array_position(p_permissions,null) is not null or not p_permissions <@ array['view_classes','view_students','view_schedule','view_comments','write_comments','mark_attendance','check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition']::text[] then raise exception 'Quyền không hợp lệ.'; end if;
 foreach k in array p_permissions loop
  if exists(select 1 from jsonb_array_elements_text(coalesce(deps->k,'[]')) dep where not dep=any(p_permissions)) then raise exception 'Thiếu quyền xem liên quan.'; end if;
 end loop;
 select source_teacher_id into v_source from public.b2c_teachers where id=p_teacher_id for update;
 if not found then raise exception 'Không tìm thấy giáo viên B2C.'; end if;
 if not exists(select 1 from public.teachers t join public.profiles p on p.id=t.user_id where t.id=p_source_teacher_id and t.is_active and p.is_active and p.role in ('teacher','academic_manager')) then raise exception 'Chọn tài khoản giáo viên đang hoạt động.'; end if;
 select * into old from public.b2c_teacher_permissions where teacher_id=p_teacher_id;
 if old.updated_at is distinct from p_expected_updated_at then raise exception 'Quyền đã thay đổi. Tải lại trước khi lưu.' using errcode='40001'; end if;
 v_before:=jsonb_build_object('source_teacher_id',v_source,'permissions',coalesce(old.permissions,array['view_classes','view_students','view_schedule','view_comments','check_teaching','view_pay']));
 update public.b2c_teachers set source_teacher_id=p_source_teacher_id where id=p_teacher_id;
 insert into public.b2c_teacher_permissions(teacher_id,permissions,updated_by) values(p_teacher_id,array(select distinct unnest(p_permissions) order by 1),auth.uid())
 on conflict(teacher_id) do update set permissions=excluded.permissions,updated_by=auth.uid(),updated_at=clock_timestamp();
 insert into public.b2c_teacher_permission_history(teacher_id,before_data,after_data,actor_id) values(p_teacher_id,v_before,jsonb_build_object('source_teacher_id',p_source_teacher_id,'permissions',p_permissions),auth.uid());
end $$;
revoke all on function public.read_b2c_permission_admin(),public.save_b2c_teacher_permissions(uuid,uuid,text[],timestamptz) from public,anon;
grant execute on function public.read_b2c_permission_admin(),public.save_b2c_teacher_permissions(uuid,uuid,text[],timestamptz) to authenticated;

-- Preserve the existing safe teacher projection behind a private implementation.
alter function public.read_my_b2c_classes(uuid,text,integer,text) set schema app;
revoke all on function app.read_my_b2c_classes(uuid,text,integer,text) from public,anon,authenticated;
create function public.read_my_b2c_classes(p_class_id uuid default null,p_tab text default 'students',p_page integer default 0,p_query text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; required text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('teacher','academic_manager')) then raise exception 'Không có quyền giáo viên.' using errcode='42501'; end if;
 if p_tab not in ('students','schedule','comments') then raise exception 'Mục không hợp lệ.'; end if;
 if p_class_id is null then
  if not app.has_b2c_permission('view_classes') then return jsonb_build_object('rows','[]'::jsonb,'total',0); end if;
 else
  required:=case p_tab when 'students' then 'view_students' when 'schedule' then 'view_schedule' when 'comments' then 'view_comments' end;
  if not app.has_b2c_permission('view_classes',p_class_id) or not app.has_b2c_permission(required,p_class_id) then raise exception 'Không có quyền xem mục này.' using errcode='42501'; end if;
 end if;
 result:=app.read_my_b2c_classes(p_class_id,p_tab,p_page,p_query);
 if p_class_id is null and not app.has_b2c_permission('view_students') then
  result:=jsonb_set(result,'{rows}',coalesce((select jsonb_agg(r-'student_count') from jsonb_array_elements(result->'rows') r),'[]'));
 end if;
 if not app.has_b2c_permission('view_schedule') then
  if p_class_id is null then result:=jsonb_set(result,'{rows}',coalesce((select jsonb_agg(r-'weekdays_text'-'time_text') from jsonb_array_elements(result->'rows') r),'[]'));
  else result:=jsonb_set(result,'{class}',(result->'class')-'weekdays_text'-'time_text'); end if;
 end if;
 return result;
end $$;
revoke all on function public.read_my_b2c_classes(uuid,text,integer,text) from public,anon;
grant execute on function public.read_my_b2c_classes(uuid,text,integer,text) to authenticated;

alter function public.read_my_b2c_today() set schema app;
revoke all on function app.read_my_b2c_today() from public,anon,authenticated;
create function public.read_my_b2c_today() returns jsonb language sql stable security definer set search_path='' as $$
 select case when app.has_b2c_permission('view_classes') and app.has_b2c_permission('view_schedule') then app.read_my_b2c_today() else jsonb_build_object('rows','[]'::jsonb,'override_class_ids','[]'::jsonb) end
$$;
revoke all on function public.read_my_b2c_today() from public,anon;
grant execute on function public.read_my_b2c_today() to authenticated;

create or replace function public.write_b2c_class_workspace(p_action text,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_request uuid:=(p_data->>'request_id')::uuid;v_class uuid:=(p_data->>'class_id')::uuid;v_id uuid;v_name text;
 old_request public.b2c_class_requests;m public.b2c_class_meetings;old_m public.b2c_class_meetings;a public.b2c_student_attendance;old_a public.b2c_student_attendance;
 v_start timestamptz;v_end timestamptz;v_enrollment uuid;v_before jsonb;v_after jsonb;
begin
 if not app.has_b2c_permission(case p_action when 'save_meeting' then 'edit_schedule' when 'save_attendance' then 'mark_attendance' when 'add_comment' then 'write_comments' else '' end,v_class) then raise exception 'Không có quyền quản lý lớp B2C.' using errcode='42501'; end if;
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

create or replace function public.generate_b2c_class_schedule(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_class uuid:=(p_data->>'class_id')::uuid;v_request uuid:=(p_data->>'request_id')::uuid;
 v_days integer[];v_from date:=(p_data->>'date_from')::date;v_to date:=(p_data->>'date_to')::date;
 v_start time:=(p_data->>'start_time')::time;v_end time:=(p_data->>'end_time')::time;
 v_room text:=upper(regexp_replace(btrim(coalesce(p_data->>'room_name','')),'\s+',' ','g'));
 v_teacher text;v_name text;v_open date;s public.b2c_class_schedules;old_request public.b2c_class_requests;
 d date;a timestamptz;b timestamptz;m public.b2c_class_meetings;v_created integer:=0;v_skipped integer:=0;
begin
 if not app.has_b2c_permission('edit_schedule',v_class) then raise exception 'Không có quyền xếp lịch B2C.' using errcode='42501'; end if;
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

create function public.read_teacher_b2c_workspace(p_class_id uuid,p_tab text,p_page integer default 0,p_query text default '',p_meeting_id uuid default null)
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
   select jsonb_build_object('present',count(*) filter(where status='present'),'late',count(*) filter(where status='late'),'absent',count(*) filter(where status='absent'),'excused',count(*) filter(where status='excused')) into v_stats from public.b2c_student_attendance where meeting_id=p_meeting_id;
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
revoke all on function public.read_teacher_b2c_workspace(uuid,text,integer,text,uuid) from public,anon;
grant execute on function public.read_teacher_b2c_workspace(uuid,text,integer,text,uuid) to authenticated;

create or replace function public.save_b2c_tuition_package(p_enrollment_id uuid,p_sessions integer,p_unit_price numeric,p_discount numeric,p_discount_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not app.has_b2c_permission('edit_tuition',(select class_id from public.b2c_enrollments where id=p_enrollment_id)) or (not coalesce(app.is_manager(),false) and (select class_id from public.b2c_enrollments where id=p_enrollment_id) is null) then raise exception 'Không có quyền quản lý học phí B2C' using errcode='42501'; end if;
  if p_unit_price is null or p_discount is null or p_unit_price<>trunc(p_unit_price) or p_discount<>trunc(p_discount) then raise exception 'Số tiền phải là VNĐ nguyên' using errcode='22023'; end if;
  insert into public.b2c_tuition_packages(enrollment_id,sessions,unit_price,discount,discount_reason)
  values(p_enrollment_id,p_sessions,p_unit_price,p_discount,nullif(btrim(p_discount_reason),''))
  on conflict(enrollment_id) do update set sessions=excluded.sessions,unit_price=excluded.unit_price,discount=excluded.discount,discount_reason=excluded.discount_reason
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.record_b2c_tuition_receipt(p_package_id uuid,p_request_id uuid,p_paid_date date,p_amount numeric,p_method text,p_collector_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old public.b2c_tuition_receipts%rowtype;
begin
  if not app.has_b2c_permission('collect_tuition',(select e.class_id from public.b2c_tuition_packages t join public.b2c_enrollments e on e.id=t.enrollment_id where t.id=p_package_id)) or (not coalesce(app.is_manager(),false) and (select e.class_id from public.b2c_tuition_packages t join public.b2c_enrollments e on e.id=t.enrollment_id where t.id=p_package_id) is null) then raise exception 'Không có quyền quản lý học phí B2C' using errcode='42501'; end if;
  if p_amount is null or p_amount<>trunc(p_amount) then raise exception 'Số tiền phải là VNĐ nguyên' using errcode='22023'; end if;
  perform 1 from public.b2c_tuition_packages where id=p_package_id for update;
  if not found then raise exception 'Không tìm thấy gói học phí' using errcode='P0002'; end if;
  select * into v_old from public.b2c_tuition_receipts where request_id=p_request_id;
  if found then
    if v_old.package_id is distinct from p_package_id or v_old.paid_date is distinct from p_paid_date
      or v_old.amount is distinct from p_amount or v_old.method is distinct from p_method
      or v_old.collector_name is distinct from btrim(p_collector_name) then
      raise exception 'Mã yêu cầu đã được dùng cho phiếu thu khác' using errcode='22023';
    end if;
    return v_old.id;
  end if;
  insert into public.b2c_tuition_receipts(package_id,request_id,paid_date,amount,method,collector_name)
  values(p_package_id,p_request_id,p_paid_date,p_amount,p_method,btrim(p_collector_name)) returning id into v_id;
  return v_id;
end;
$$;
-- This file is appended to the forward migration during development.
alter function public.can_check_b2c_session(uuid) set schema app;
revoke all on function app.can_check_b2c_session(uuid) from public,anon,authenticated;
create function public.can_check_b2c_session(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select app.can_check_b2c_session(p_id) and (app.has_b2c_permission('check_teaching') or app.has_b2c_permission('view_pay'))
$$;
revoke all on function public.can_check_b2c_session(uuid) from public,anon;
grant execute on function public.can_check_b2c_session(uuid) to authenticated;
-- Policies resolve function OIDs at creation: explicitly rebuild them against the gated helper.
drop policy b2c_teaching_read on public.b2c_teaching_sessions;
create policy b2c_teaching_read on public.b2c_teaching_sessions for select to authenticated using(app.is_manager());
drop policy b2c_check_photo_insert on storage.objects;
create policy b2c_check_photo_insert on storage.objects for insert to authenticated with check(
 bucket_id='b2c-check-photos' and (storage.foldername(name))[2]=auth.uid()::text
 and case when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$' then public.can_check_b2c_session(((storage.foldername(name))[1])::uuid) and public.has_b2c_permission('check_teaching') else false end
);
drop policy b2c_check_photo_read on storage.objects;
create function public.can_read_b2c_check_photo(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.b2c_teaching_sessions s where p_name in(s.check_in_photo,s.check_out_photo) and public.can_check_b2c_session(s.id))
$$;
revoke all on function public.can_read_b2c_check_photo(text) from public,anon;
grant execute on function public.can_read_b2c_check_photo(text) to authenticated;
create policy b2c_check_photo_read on storage.objects for select to authenticated using(
 bucket_id='b2c-check-photos' and exists(select 1 from public.b2c_teaching_sessions s where name in(s.check_in_photo,s.check_out_photo) and app.is_manager())
 or bucket_id='b2c-check-photos' and public.can_read_b2c_check_photo(name)
);

alter function public.check_b2c_teaching_session(uuid,text,text) set schema app;
revoke all on function app.check_b2c_teaching_session(uuid,text,text) from public,anon,authenticated;
create function public.check_b2c_teaching_session(p_id uuid,p_kind text,p_photo text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not app.has_b2c_permission('check_teaching') or not public.can_check_b2c_session(p_id) then raise exception 'Không có quyền chấm công buổi này.' using errcode='42501'; end if;
 perform app.check_b2c_teaching_session(p_id,p_kind,p_photo);
end $$;
revoke all on function public.check_b2c_teaching_session(uuid,text,text) from public,anon;
grant execute on function public.check_b2c_teaching_session(uuid,text,text) to authenticated;

alter function public.get_b2c_teaching_page(date,integer,boolean) set schema app;
revoke all on function app.get_b2c_teaching_page(date,integer,boolean) from public,anon,authenticated;
create function public.get_b2c_teaching_page(p_month date,p_page integer default 0,p_mine boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 if not app.has_b2c_permission('check_teaching') and not app.has_b2c_permission('view_pay') then raise exception 'Không có quyền xem chấm công.' using errcode='42501'; end if;
 r:=app.get_b2c_teaching_page(p_month,p_page,p_mine);
 if not app.has_b2c_permission('view_pay') then
  r:=(r-'hours'-'salary')||jsonb_build_object('hours',null,'salary',null,'rows',(select coalesce(jsonb_agg(x-array['hourly_rate','salary','teaching_hours']),'[]') from jsonb_array_elements(r->'rows') x));
 end if;
 return r;
end $$;
revoke all on function public.get_b2c_teaching_page(date,integer,boolean) from public,anon;
grant execute on function public.get_b2c_teaching_page(date,integer,boolean) to authenticated;

create function public.read_b2c_permitted_receipts(p_package_id uuid,p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_class uuid;
begin
 select e.class_id into v_class from public.b2c_tuition_packages t join public.b2c_enrollments e on e.id=t.enrollment_id where t.id=p_package_id;
 if v_class is null or not app.has_b2c_permission('view_tuition',v_class) then raise exception 'Không có quyền xem phiếu thu.' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>1000000 then raise exception 'Bộ lọc không hợp lệ.'; end if;
 return jsonb_build_object('total',(select count(*) from public.b2c_tuition_receipts where package_id=p_package_id),'receipts',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,code,paid_date,amount,method,collector_name from public.b2c_tuition_receipts where package_id=p_package_id order by created_at desc,id limit 20 offset p_page::bigint*20) r));
end $$;
revoke all on function public.read_b2c_permitted_receipts(uuid,integer) from public,anon;
grant execute on function public.read_b2c_permitted_receipts(uuid,integer) to authenticated;

create function public.save_teacher_b2c_class(p_id uuid,p_data jsonb,p_request_id uuid,p_expected_updated_at timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.b2c_classes; v_teacher uuid; v_name text; v_result uuid; old public.b2c_class_requests;
begin
 if p_id is null then
  if not app.has_b2c_permission('create_classes') then raise exception 'Không có quyền tạo lớp.' using errcode='42501'; end if;
 else
  if not app.has_b2c_permission('edit_classes',p_id) then raise exception 'Không có quyền sửa lớp.' using errcode='42501'; end if;
 end if;
 if p_request_id is null then raise exception 'Thiếu mã yêu cầu.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into old from public.b2c_class_requests where request_id=p_request_id;
 if found then
  if old.actor_id<>auth.uid() or old.action<>'save_class' or old.payload is distinct from jsonb_build_object('id',p_id,'data',p_data) then raise exception 'Mã yêu cầu đã được sử dụng.'; end if;
  return old.result_id;
 end if;
 if length(btrim(coalesce(p_data->>'name','')))<3 or length(p_data->>'name')>200 or length(coalesce(p_data->>'notes',''))>4000 or length(coalesce(p_data->>'campus',''))>200 then raise exception 'Thông tin lớp không hợp lệ.'; end if;
 v_teacher:=app.my_b2c_teacher_id();
 if v_teacher is null then raise exception 'Tài khoản chưa liên kết giáo viên B2C.' using errcode='42501'; end if;
 if p_id is null then
  select full_name into v_name from public.b2c_teachers where id=v_teacher;
  insert into public.b2c_classes(name,program_slug,teacher_name,capacity,campus,delivery_mode,start_date,status,notes,created_by)
  values(btrim(p_data->>'name'),p_data->>'program_slug',v_name,(p_data->>'capacity')::integer,nullif(btrim(p_data->>'campus'),''),p_data->>'delivery_mode',nullif(p_data->>'start_date','')::date,p_data->>'status',nullif(p_data->>'notes',''),auth.uid()) returning id into v_result;
  update public.b2c_classes set teacher_id=v_teacher where id=v_result;
 else
  select * into c from public.b2c_classes where id=p_id for update;
  if c.updated_at is distinct from p_expected_updated_at then raise exception 'Lớp đã thay đổi. Tải lại trước khi lưu.' using errcode='40001'; end if;
  update public.b2c_classes set name=btrim(p_data->>'name'),capacity=(p_data->>'capacity')::integer,campus=nullif(btrim(p_data->>'campus'),''),delivery_mode=p_data->>'delivery_mode',start_date=nullif(p_data->>'start_date','')::date,status=p_data->>'status',notes=nullif(p_data->>'notes','') where id=p_id;
  v_result:=p_id;
 end if;
 insert into public.b2c_class_requests(request_id,action,payload,result_id,actor_id) values(p_request_id,'save_class',jsonb_build_object('id',p_id,'data',p_data),v_result,auth.uid());
 insert into public.b2c_class_history(class_id,action,before_data,after_data,actor_id,actor_name) values(v_result,'save_class',case when c.id is null then null else to_jsonb(c) end,(select to_jsonb(x) from public.b2c_classes x where id=v_result),auth.uid(),(select full_name from public.profiles where id=auth.uid()));
 return v_result;
end $$;
create function public.read_teacher_b2c_class_edit(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not app.has_b2c_permission('edit_classes',p_id) then raise exception 'Không có quyền sửa lớp.' using errcode='42501'; end if;
 return (select jsonb_build_object('id',id,'name',name,'program_slug',program_slug,'capacity',capacity,'campus',campus,'delivery_mode',delivery_mode,'start_date',start_date,'status',status,'notes',notes,'updated_at',updated_at) from public.b2c_classes where id=p_id);
end $$;
create function public.read_teacher_b2c_student_edit(p_class_id uuid,p_enrollment_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not app.has_b2c_permission('edit_students',p_class_id) then raise exception 'Không có quyền sửa học viên.' using errcode='42501'; end if;
 return (select jsonb_build_object('full_name',s.full_name,'phone',s.phone,'status',e.status,'withdrawal_reason',e.withdrawal_reason,'enrollment_date',e.enrollment_date,'updated_at',e.updated_at,'student_updated_at',s.updated_at,'can_edit_profile',not exists(select 1 from public.b2c_enrollments other where other.student_id=s.id and not app.has_b2c_permission('edit_students',other.class_id))) from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id where e.id=p_enrollment_id and e.class_id=p_class_id);
end $$;
create function public.save_teacher_b2c_student(p_class_id uuid,p_enrollment_id uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare e public.b2c_enrollments; s public.b2c_students;
begin
 if not app.has_b2c_permission('edit_students',p_class_id) then raise exception 'Không có quyền sửa học viên.' using errcode='42501'; end if;
 select * into e from public.b2c_enrollments where id=p_enrollment_id and class_id=p_class_id for update;
 if e.id is null then raise exception 'Học viên không thuộc lớp.' using errcode='42501'; end if;
 select * into s from public.b2c_students where id=e.student_id for update;
 if e.updated_at is distinct from (p_data->>'updated_at')::timestamptz or s.updated_at is distinct from (p_data->>'student_updated_at')::timestamptz then raise exception 'Hồ sơ đã thay đổi. Tải lại trước khi lưu.' using errcode='40001'; end if;
 if length(btrim(coalesce(p_data->>'full_name','')))<1 or length(p_data->>'full_name')>200 or (coalesce(p_data->>'phone','')<>'' and (p_data->>'phone')!~ '^[0-9]{10}$') or length(coalesce(p_data->>'withdrawal_reason',''))>1000 then raise exception 'Thông tin học viên không hợp lệ.'; end if;
 if btrim(p_data->>'full_name') is distinct from s.full_name or nullif(p_data->>'phone','') is distinct from s.phone then
  if exists(select 1 from public.b2c_enrollments other where other.student_id=s.id and not app.has_b2c_permission('edit_students',other.class_id)) then raise exception 'Học viên còn thuộc lớp khác. Quản lý cập nhật thông tin chung.' using errcode='42501'; end if;
  update public.b2c_students set full_name=btrim(p_data->>'full_name'),phone=nullif(p_data->>'phone','') where id=s.id;
 end if;
 update public.b2c_enrollments set status=p_data->>'status',withdrawal_reason=case when p_data->>'status'='withdrawn' then nullif(btrim(p_data->>'withdrawal_reason'),'') end,enrollment_date=nullif(p_data->>'enrollment_date','')::date where id=e.id;
 insert into public.b2c_class_history(class_id,action,before_data,after_data,actor_id,actor_name) values(p_class_id,'edit_student',jsonb_build_object('full_name',s.full_name,'phone',s.phone,'enrollment',to_jsonb(e)),p_data,auth.uid(),(select full_name from public.profiles where id=auth.uid()));
end $$;
revoke all on function public.save_teacher_b2c_class(uuid,jsonb,uuid,timestamptz),public.read_teacher_b2c_class_edit(uuid),public.read_teacher_b2c_student_edit(uuid,uuid),public.save_teacher_b2c_student(uuid,uuid,jsonb) from public,anon;
grant execute on function public.save_teacher_b2c_class(uuid,jsonb,uuid,timestamptz),public.read_teacher_b2c_class_edit(uuid),public.read_teacher_b2c_student_edit(uuid,uuid),public.save_teacher_b2c_student(uuid,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
