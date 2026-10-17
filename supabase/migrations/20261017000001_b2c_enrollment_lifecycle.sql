alter table public.b2c_enrollments drop constraint b2c_enrollments_status_check;
alter table public.b2c_enrollments add constraint b2c_enrollments_status_check
 check(status in ('studying','on_hold','awaiting_renewal','overdue','withdrawn','completed','transferred'));
alter table public.b2c_enrollments drop constraint uq_b2c_enrollments_class_student;
create unique index b2c_enrollments_open_class_student on public.b2c_enrollments(class_id,student_id)
 where status not in ('withdrawn','completed','transferred');

create table public.b2c_enrollment_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 payload jsonb not null,
 enrollment_id uuid not null references public.b2c_enrollments(id) on delete restrict,
 result_enrollment_id uuid not null references public.b2c_enrollments(id) on delete restrict,
 student_id uuid not null references public.b2c_students(id) on delete restrict,
 action text not null check(action in ('transfer','hold','resume')),
 effective_date date not null,
 expected_return_date date,
 reason text not null check(char_length(btrim(reason)) between 1 and 1000),
 from_status text not null, to_status text not null,
 from_class_id uuid not null references public.b2c_classes(id) on delete restrict,
 to_class_id uuid references public.b2c_classes(id) on delete restrict,
 from_class_name text not null, to_class_name text,
 actor_id uuid not null references auth.users(id) on delete restrict,
 actor_name text not null,
 created_at timestamptz not null default clock_timestamp(),
 transaction_id bigint not null default txid_current(),
 check(expected_return_date is null or (action='hold' and expected_return_date>=effective_date)),
 check((action='transfer' and to_class_id is not null and to_class_id<>from_class_id and result_enrollment_id<>enrollment_id)
   or (action<>'transfer' and to_class_id is null and result_enrollment_id=enrollment_id))
);
alter table public.b2c_enrollment_events enable row level security;
revoke all on public.b2c_enrollment_events from public,anon,authenticated;
grant select on public.b2c_enrollment_events to authenticated;
create policy b2c_enrollment_events_manager_read on public.b2c_enrollment_events for select to authenticated using(app.is_manager());
create index b2c_enrollment_events_student_date on public.b2c_enrollment_events(student_id,created_at desc,id desc);

create function app.guard_b2c_enrollment_lifecycle() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.class_id is distinct from old.class_id or new.student_id is distinct from old.student_id then
  raise exception 'Chuyển lớp bằng thao tác Chuyển lớp để giữ lịch sử.' using errcode='22023';
 end if;
 if old.status='transferred' and new.status<>old.status then
  raise exception 'Ghi danh đã chuyển lớp không được mở lại.' using errcode='22023';
 end if;
 if new.status is distinct from old.status and (new.status in ('on_hold','transferred') or old.status='on_hold')
 and not exists(select 1 from public.b2c_enrollment_events h where h.enrollment_id=old.id
  and h.from_status=old.status and h.to_status=new.status and h.transaction_id=txid_current() and h.actor_id=auth.uid()) then
  raise exception 'Dùng thao tác Chuyển lớp / Bảo lưu để ghi ngày và lý do vào lịch sử.' using errcode='22023';
 end if;
 return new;
end $$;
revoke all on function app.guard_b2c_enrollment_lifecycle() from public,anon,authenticated;
create trigger b2c_enrollment_lifecycle_guard before update on public.b2c_enrollments for each row execute function app.guard_b2c_enrollment_lifecycle();

create function public.write_b2c_enrollment_lifecycle(p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_request uuid:=(p_data->>'request_id')::uuid;
 v_id uuid:=(p_data->>'enrollment_id')::uuid;
 v_target uuid:=nullif(p_data->>'target_class_id','')::uuid;
 v_action text:=p_data->>'action'; v_reason text:=btrim(p_data->>'reason');
 v_date date:=(p_data->>'effective_date')::date;
 v_return date:=nullif(p_data->>'expected_return_date','')::date;
 v_expected timestamptz:=(p_data->>'expected_updated_at')::timestamptz;
 e public.b2c_enrollments; h public.b2c_enrollment_events;
 c public.b2c_classes; t public.b2c_classes;
 v_result uuid; v_status text; v_actor text; v_count integer; v_source uuid;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Chỉ quản trị hoặc giáo vụ được chuyển lớp/bảo lưu.' using errcode='42501'; end if;
 if v_request is null or v_id is null or v_expected is null or v_action is null or v_action not in ('transfer','hold','resume')
 or v_reason is null or char_length(v_reason) not between 1 and 1000 or v_date is null
 or v_date<date '1900-01-01' or v_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date
 or (v_action='transfer' and v_target is null) or (v_action<>'transfer' and v_target is not null)
 or (v_return is not null and (v_action<>'hold' or v_return<v_date)) then
  raise exception 'Kiểm tra thao tác, ngày hiệu lực, lớp đích và lý do. Không đặt ngày hiệu lực trong tương lai.' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_request::text,0));
 select * into h from public.b2c_enrollment_events where request_id=v_request;
 if found then
  if h.payload is distinct from p_data or h.actor_id is distinct from auth.uid() then raise exception 'Mã yêu cầu đã dùng cho nội dung khác.' using errcode='22023'; end if;
  return h.result_enrollment_id;
 end if;
 select class_id into v_source from public.b2c_enrollments where id=v_id;
 if not found then raise exception 'Không tìm thấy ghi danh.' using errcode='22023'; end if;
 perform 1 from public.b2c_classes where id in (v_source,v_target) order by id for update;
 select * into e from public.b2c_enrollments where id=v_id for update;
 if e.updated_at is distinct from v_expected then raise exception 'Ghi danh đã thay đổi. Đóng và mở lại để tải dữ liệu mới.' using errcode='40001'; end if;
 if e.status in ('withdrawn','completed','transferred') then raise exception 'Ghi danh đã kết thúc, không thực hiện được thao tác.' using errcode='22023'; end if;
 if v_date<e.enrollment_date or exists(select 1 from public.b2c_enrollment_events where student_id=e.student_id and (enrollment_id=e.id or result_enrollment_id=e.id) and effective_date>v_date) then
  raise exception 'Ngày hiệu lực không được trước ngày ghi danh hoặc lần xử lý gần nhất.' using errcode='22023';
 end if;
 select * into c from public.b2c_classes where id=e.class_id;
 select full_name into v_actor from public.profiles where id=auth.uid();
 v_result:=e.id;
 if v_action='transfer' then
  select * into t from public.b2c_classes where id=v_target;
  if not found or t.id=e.class_id or t.status not in ('planned','active') then raise exception 'Chọn lớp khác đang học hoặc sắp khai giảng.' using errcode='22023'; end if;
  if exists(select 1 from public.b2c_enrollments where class_id=t.id and student_id=e.student_id and status not in ('withdrawn','completed','transferred')) then raise exception 'Học viên đã có ghi danh đang mở tại lớp đích.' using errcode='22023'; end if;
  select count(*) into v_count from public.b2c_enrollments where class_id=t.id and status not in ('withdrawn','completed','transferred');
  if v_count>=t.capacity then raise exception 'Lớp đích đã đủ sĩ số tối đa.' using errcode='22023'; end if;
  insert into public.b2c_enrollments(source_key,class_id,student_id,salesperson,enrollment_date,learning_start_date,learning_goal,certificate_goal,status)
  values('transfer:'||v_request,t.id,e.student_id,e.salesperson,v_date,v_date,e.learning_goal,e.certificate_goal,'studying') returning id into v_result;
  v_status:='transferred';
 elsif v_action='hold' then
  if e.status='on_hold' then raise exception 'Học viên đã bảo lưu.' using errcode='22023'; end if;
  v_status:='on_hold';
 else
  if e.status<>'on_hold' then raise exception 'Chỉ ghi danh bảo lưu mới được đi học lại.' using errcode='22023'; end if;
  if c.status not in ('active','planned') then raise exception 'Lớp cũ không còn mở. Chọn Chuyển lớp để học tại lớp khác.' using errcode='22023'; end if;
  v_status:='studying';
 end if;
 insert into public.b2c_enrollment_events(request_id,payload,enrollment_id,result_enrollment_id,student_id,action,effective_date,expected_return_date,reason,from_status,to_status,from_class_id,to_class_id,from_class_name,to_class_name,actor_id,actor_name)
 values(v_request,p_data,e.id,v_result,e.student_id,v_action,v_date,v_return,v_reason,e.status,v_status,e.class_id,case when v_action='transfer' then t.id end,c.code||' · '||c.name,case when v_action='transfer' then t.code||' · '||t.name end,auth.uid(),v_actor);
 update public.b2c_enrollments set status=v_status,withdrawal_reason=null where id=e.id;
 -- Hold retains the seat. Tuition and historical attendance remain on their original enrollment.
 update public.b2c_classes k set enrolled_count=(select count(*) from public.b2c_enrollments x where x.class_id=k.id and x.status not in ('withdrawn','completed','transferred')) where k.id in (e.class_id,v_target);
 return v_result;
end $$;
revoke all on function public.write_b2c_enrollment_lifecycle(jsonb) from public,anon;
grant execute on function public.write_b2c_enrollment_lifecycle(jsonb) to authenticated;

create function public.read_b2c_enrollment_lifecycle(p_enrollment_id uuid,p_page integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare e public.b2c_enrollments;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý học viên B2C.' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 1000000 then raise exception 'Trang không hợp lệ.' using errcode='22023'; end if;
 select * into e from public.b2c_enrollments where id=p_enrollment_id;
 if not found then raise exception 'Không tìm thấy ghi danh.' using errcode='22023'; end if;
 return jsonb_build_object('enrollment',jsonb_build_object('id',e.id,'status',e.status,'updated_at',e.updated_at,'class_id',e.class_id),
 'classes',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name) order by code),'[]') from public.b2c_classes where status in ('active','planned') and id<>e.class_id),
 'total',(select count(*) from public.b2c_enrollment_events where student_id=e.student_id),
 'events',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]') from (
  select id,action,effective_date,expected_return_date,reason,actor_name,created_at,from_class_name,to_class_name from public.b2c_enrollment_events where student_id=e.student_id order by created_at desc,id desc limit 20 offset p_page::bigint*20) r));
end $$;
revoke all on function public.read_b2c_enrollment_lifecycle(uuid,integer) from public,anon;
grant execute on function public.read_b2c_enrollment_lifecycle(uuid,integer) to authenticated;

-- Keep capacity checks in the existing add-student RPC consistent with closed transfers.
do $$ declare d text; begin
 select pg_get_functiondef('public.add_b2c_class_student(jsonb)'::regprocedure) into d;
 if position('status not in (''withdrawn'',''completed'')' in d)=0 then raise exception 'Unexpected add-student definition'; end if;
 d:=replace(d,'status not in (''withdrawn'',''completed'')','status not in (''withdrawn'',''completed'',''transferred'')');
 execute d;
end $$;
notify pgrst,'reload schema';
