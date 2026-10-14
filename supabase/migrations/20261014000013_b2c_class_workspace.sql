create table public.b2c_class_meetings (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 class_id uuid not null references public.b2c_classes(id) on delete restrict,
 teaching_session_id uuid unique references public.b2c_teaching_sessions(id) on delete restrict,
 starts_at timestamptz not null,ends_at timestamptz not null,
 teacher_name text not null default '' check(length(teacher_name)<=200),
 status text not null default 'planned' check(status in ('planned','completed','cancelled')),
 note text not null default '' check(length(note)<=2000),
 created_at timestamptz not null default clock_timestamp(),created_by uuid not null references auth.users(id),
 updated_at timestamptz not null default clock_timestamp(),updated_by uuid not null references auth.users(id),
 check(ends_at>starts_at and ends_at<=starts_at+interval '12 hours'),unique(class_id,starts_at)
);
create table public.b2c_student_attendance (
 id uuid primary key default gen_random_uuid(),meeting_id uuid not null references public.b2c_class_meetings(id) on delete restrict,
 enrollment_id uuid not null references public.b2c_enrollments(id) on delete restrict,
 status text not null check(status in ('present','late','absent','excused')),
 note text not null default '' check(length(note)<=1000),
 updated_at timestamptz not null default clock_timestamp(),updated_by uuid not null references auth.users(id),
 unique(meeting_id,enrollment_id)
);
create table public.b2c_student_comments (
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.b2c_classes(id) on delete restrict,
 enrollment_id uuid not null references public.b2c_enrollments(id) on delete restrict,
 meeting_id uuid references public.b2c_class_meetings(id) on delete restrict,
 content text not null check(length(btrim(content)) between 1 and 4000),
 created_at timestamptz not null default clock_timestamp(),created_by uuid not null references auth.users(id),actor_name text not null
);
create table public.b2c_class_requests (
 request_id uuid primary key,action text not null,payload jsonb not null,result_id uuid not null,
 actor_id uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
create table public.b2c_class_history (
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.b2c_classes(id) on delete restrict,
 action text not null,before_data jsonb,after_data jsonb,actor_id uuid not null references auth.users(id),
 actor_name text not null,created_at timestamptz not null default clock_timestamp()
);
create index b2c_meetings_class_time on public.b2c_class_meetings(class_id,starts_at,id);
create index b2c_comments_class_time on public.b2c_student_comments(class_id,created_at desc,id);
create index b2c_comments_meeting on public.b2c_student_comments(meeting_id) where meeting_id is not null;
create index b2c_class_history_time on public.b2c_class_history(class_id,created_at desc,id);
alter table public.b2c_class_meetings enable row level security;
alter table public.b2c_student_attendance enable row level security;
alter table public.b2c_student_comments enable row level security;
alter table public.b2c_class_requests enable row level security;
alter table public.b2c_class_history enable row level security;
revoke all on public.b2c_class_meetings,public.b2c_student_attendance,public.b2c_student_comments,public.b2c_class_requests,public.b2c_class_history from public,anon,authenticated;
grant select on public.b2c_class_meetings,public.b2c_student_attendance,public.b2c_student_comments,public.b2c_class_history to authenticated;
create policy b2c_meetings_read on public.b2c_class_meetings for select to authenticated using(app.is_manager());
create policy b2c_attendance_read on public.b2c_student_attendance for select to authenticated using(app.is_manager());
create policy b2c_comments_read on public.b2c_student_comments for select to authenticated using(app.is_manager());
create policy b2c_class_history_read on public.b2c_class_history for select to authenticated using(app.is_manager());

-- Preserve the actual creator and date when mirroring existing payroll sessions.
insert into public.b2c_class_meetings(id,request_id,class_id,teaching_session_id,starts_at,ends_at,teacher_name,created_at,created_by,updated_by)
 select s.id,s.id,s.class_id,s.id,s.starts_at,s.ends_at,t.full_name,s.created_at,s.created_by,s.created_by
 from public.b2c_teaching_sessions s join public.b2c_teachers t on t.id=s.teacher_id;
create function app.sync_b2c_class_meeting() returns trigger language plpgsql security definer set search_path='' as $$
declare v public.b2c_class_meetings;v_teacher text;
begin
 perform 1 from public.b2c_classes where id=new.class_id for update;
 select full_name into v_teacher from public.b2c_teachers where id=new.teacher_id;
 select * into v from public.b2c_class_meetings where class_id=new.class_id and starts_at=new.starts_at for update;
 if v.id is not null then
  if v.ends_at<>new.ends_at or v.status='cancelled' then raise exception 'Lịch lớp đã có buổi khác giờ kết thúc hoặc đã hủy.'; end if;
  update public.b2c_class_meetings set teaching_session_id=new.id,teacher_name=v_teacher,updated_at=clock_timestamp(),updated_by=new.created_by where id=v.id;
 else
  if exists(select 1 from public.b2c_class_meetings where class_id=new.class_id and status<>'cancelled' and starts_at<new.ends_at and ends_at>new.starts_at) then raise exception 'Lớp đã có buổi học trùng giờ.'; end if;
  insert into public.b2c_class_meetings(id,request_id,class_id,teaching_session_id,starts_at,ends_at,teacher_name,created_at,created_by,updated_by)
   values(new.id,new.id,new.class_id,new.id,new.starts_at,new.ends_at,v_teacher,new.created_at,new.created_by,new.created_by);
 end if;
 return new;
end $$;
revoke all on function app.sync_b2c_class_meeting() from public,anon,authenticated;
create trigger sync_b2c_class_meeting after insert on public.b2c_teaching_sessions for each row execute function app.sync_b2c_class_meeting();

create function public.read_b2c_class_workspace(p_class_id uuid,p_tab text,p_page integer default 0,p_query text default '',p_meeting_id uuid default null)
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
 return jsonb_build_object('rows',v_rows,'total',v_total,'stats',v_stats,'meeting',(select to_jsonb(m) from public.b2c_class_meetings m where id=p_meeting_id and class_id=p_class_id));
end $$;

create function public.write_b2c_class_workspace(p_action text,p_data jsonb) returns uuid
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
   if m.teaching_session_id is not null then raise exception 'Buổi liên kết lịch dạy chỉ xem tại đây.'; end if;
   if m.updated_at is distinct from (p_data->>'expected_updated_at')::timestamptz then raise exception 'Buổi học đã thay đổi. Tải lại trước khi sửa.'; end if;
   if (v_start<>m.starts_at or v_end<>m.ends_at or p_data->>'status'='cancelled') and (exists(select 1 from public.b2c_student_attendance where meeting_id=m.id) or exists(select 1 from public.b2c_student_comments where meeting_id=m.id)) then raise exception 'Buổi đã có điểm danh/nhận xét; giữ thời gian và không hủy lịch sử.'; end if;
   old_m:=m;
  end if;
  if coalesce(p_data->>'status','planned')<>'cancelled' and exists(select 1 from public.b2c_class_meetings where class_id=v_class and id is distinct from m.id and status<>'cancelled' and starts_at<v_end and ends_at>v_start) then raise exception 'Lớp đã có buổi học trùng giờ.'; end if;
  if m.id is null then
   insert into public.b2c_class_meetings(request_id,class_id,starts_at,ends_at,teacher_name,status,note,created_by,updated_by) values(v_request,v_class,v_start,v_end,btrim(coalesce(p_data->>'teacher_name','')),coalesce(p_data->>'status','planned'),coalesce(p_data->>'note',''),auth.uid(),auth.uid()) returning * into m;
  else
   update public.b2c_class_meetings set starts_at=v_start,ends_at=v_end,teacher_name=btrim(coalesce(p_data->>'teacher_name','')),status=p_data->>'status',note=coalesce(p_data->>'note',''),updated_at=clock_timestamp(),updated_by=auth.uid() where id=m.id returning * into m;
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
revoke all on function public.read_b2c_class_workspace(uuid,text,integer,text,uuid),public.write_b2c_class_workspace(text,jsonb) from public,anon;
grant execute on function public.read_b2c_class_workspace(uuid,text,integer,text,uuid),public.write_b2c_class_workspace(text,jsonb) to authenticated;
notify pgrst,'reload schema';
