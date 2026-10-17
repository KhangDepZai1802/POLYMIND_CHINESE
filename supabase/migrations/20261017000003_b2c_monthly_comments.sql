alter table public.b2c_parents add column email text check(email is null or (char_length(email)<=254 and email~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'));
create function public.save_b2c_parent_with_email(p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_email text:=nullif(btrim(p_data->>'email'),''); v_codes text[];
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý phụ huynh.' using errcode='42501'; end if;
 if v_email is not null and (char_length(v_email)>254 or v_email!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then raise exception 'Email phụ huynh không hợp lệ.' using errcode='22023'; end if;
 select array_agg(value) into v_codes from jsonb_array_elements_text(p_data->'student_codes');
 v_id:=public.save_b2c_parent(nullif(p_data->>'id','')::uuid,p_data->>'full_name',p_data->>'phone',p_data->>'zalo',coalesce(v_codes,array[]::text[]),p_data->>'relationship');
 update public.b2c_parents set email=v_email where id=v_id;
 return v_id;
end $$;
revoke all on function public.save_b2c_parent_with_email(jsonb) from public,anon;
grant execute on function public.save_b2c_parent_with_email(jsonb) to authenticated;
do $$ declare d text; begin
 select pg_get_functiondef('public.get_b2c_parents_page(text,integer)'::regprocedure) into d;
 if position('''zalo'',p.zalo' in d)=0 then raise exception 'Unexpected parent list definition'; end if;
 execute replace(d,'''zalo'',p.zalo','''zalo'',p.zalo,''email'',p.email');
end $$;

alter table public.b2c_teacher_permissions drop constraint known_b2c_permissions;
alter table public.b2c_teacher_permissions add constraint known_b2c_permissions check(permissions <@ array['view_classes','view_students','view_schedule','view_comments','write_comments','mark_attendance','check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition','view_assessments','grade_assessments','share_monthly_comments']::text[]);
do $$ declare d text; begin
 select pg_get_functiondef('app.has_b2c_permission(text,uuid)'::regprocedure) into d;
 if position('''grade_assessments''' in d)=0 then raise exception 'Assessment permissions migration required'; end if;
 execute replace(d,'''grade_assessments''','''grade_assessments'',''share_monthly_comments''');
 select pg_get_functiondef('public.save_b2c_teacher_permissions(uuid,uuid,text[],timestamptz)'::regprocedure) into d;
 d:=replace(d,'''grade_assessments'']','''grade_assessments'',''share_monthly_comments'']');
 d:=replace(d,'"grade_assessments":["view_assessments"]','"grade_assessments":["view_assessments"],"share_monthly_comments":["write_comments"]');
 execute d;
end $$;

create table public.b2c_monthly_comments (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.b2c_classes(id) on delete restrict,
 enrollment_id uuid not null references public.b2c_enrollments(id) on delete restrict,
 report_month date not null check(report_month>=date '1900-01-01' and extract(day from report_month)=1),
 content jsonb not null, status text not null check(status in ('draft','ready')),
 author_name text not null, created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(), unique(enrollment_id,report_month)
);
create index b2c_monthly_comments_class_month on public.b2c_monthly_comments(class_id,report_month);
create table public.b2c_monthly_comment_history (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references public.b2c_monthly_comments(id) on delete restrict,
 actor_id uuid not null references auth.users(id), actor_name text not null, before_data jsonb, after_data jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create index b2c_monthly_comment_history_report on public.b2c_monthly_comment_history(report_id,created_at desc,id desc);
create table public.b2c_monthly_comment_deliveries (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references public.b2c_monthly_comments(id) on delete restrict,
 report_updated_at timestamptz not null, channel text not null check(channel in ('zalo','email')),
 recipient_key text not null, recipient_name text not null, destination text not null,
 message text not null, actor_id uuid not null references auth.users(id), actor_name text not null,
 created_at timestamptz not null default clock_timestamp(),
 delivery_method text not null default 'manual_confirmation' check(delivery_method='manual_confirmation')
);
create index b2c_monthly_comment_deliveries_report on public.b2c_monthly_comment_deliveries(report_id,created_at desc,id desc);
create table public.b2c_monthly_comment_requests (
 request_id uuid primary key, actor_id uuid not null references auth.users(id), payload jsonb not null, result_id uuid not null
);
alter table public.b2c_monthly_comments enable row level security;
alter table public.b2c_monthly_comment_history enable row level security;
alter table public.b2c_monthly_comment_deliveries enable row level security;
alter table public.b2c_monthly_comment_requests enable row level security;
revoke all on public.b2c_monthly_comments,public.b2c_monthly_comment_history,public.b2c_monthly_comment_deliveries,public.b2c_monthly_comment_requests from public,anon,authenticated;
grant select on public.b2c_monthly_comments,public.b2c_monthly_comment_history,public.b2c_monthly_comment_deliveries to authenticated;
create policy b2c_monthly_comments_read on public.b2c_monthly_comments for select to authenticated using(public.has_b2c_permission('view_comments',class_id));
create policy b2c_monthly_comment_history_read on public.b2c_monthly_comment_history for select to authenticated using(exists(select 1 from public.b2c_monthly_comments r where r.id=report_id));
create policy b2c_monthly_deliveries_read on public.b2c_monthly_comment_deliveries for select to authenticated using(exists(select 1 from public.b2c_monthly_comments r where r.id=report_id and public.has_b2c_permission('share_monthly_comments',r.class_id)));

create function app.b2c_monthly_comment_recipients(p_report uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by name,key),'[]') from (
  select p.id::text as key,p.full_name as name,p.zalo,p.email
  from public.b2c_monthly_comments r join public.b2c_enrollments e on e.id=r.enrollment_id join public.b2c_student_parents l on l.student_id=e.student_id join public.b2c_parents p on p.id=l.parent_id where r.id=p_report
  union all
  select 'guardian',coalesce(nullif(btrim(s.guardian_name),''),'Phụ huynh của '||s.full_name),s.guardian_zalo,null::text
  from public.b2c_monthly_comments r join public.b2c_enrollments e on e.id=r.enrollment_id join public.b2c_students s on s.id=e.student_id
  where r.id=p_report and nullif(btrim(s.guardian_zalo),'') is not null
  and not exists(select 1 from public.b2c_student_parents l join public.b2c_parents p on p.id=l.parent_id where l.student_id=s.id and p.zalo=s.guardian_zalo)
 ) x
$$;
create function app.render_b2c_monthly_comment(p_report uuid) returns text
language sql stable security definer set search_path='' as $$
 select concat_ws(E'\n\n','NHẬN XÉT THÁNG '||to_char(r.report_month,'MM/YYYY'),
 'Kính gửi Quý phụ huynh của học viên '||s.full_name||',','Lớp: '||c.name,
 'Chuyên cần: '||(r.content->>'attendance'),'Thái độ học tập: '||(r.content->>'attitude'),
 'Nội dung và tiến bộ trong tháng: '||(r.content->>'learning'),'Điểm mạnh: '||(r.content->>'strengths'),
 'Nội dung cần cải thiện: '||(r.content->>'improvements'),'Kế hoạch tháng tới / phối hợp phụ huynh: '||(r.content->>'next_plan'),
 'Giáo viên/người nhận xét: '||r.author_name,'Trân trọng.')
 from public.b2c_monthly_comments r join public.b2c_enrollments e on e.id=r.enrollment_id join public.b2c_students s on s.id=e.student_id join public.b2c_classes c on c.id=r.class_id where r.id=p_report
$$;
revoke all on function app.b2c_monthly_comment_recipients(uuid),app.render_b2c_monthly_comment(uuid) from public,anon,authenticated;

create function public.write_b2c_monthly_comment(p_action text,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_request uuid:=(p_data->>'request_id')::uuid; v_class uuid:=(p_data->>'class_id')::uuid;
 v_enrollment uuid:=nullif(p_data->>'enrollment_id','')::uuid; v_report uuid:=nullif(p_data->>'report_id','')::uuid;
 v_expected timestamptz:=nullif(p_data->>'expected_updated_at','')::timestamptz;
 v_month date; v_content jsonb; v_status text; v_key text; v_actor text; v_before jsonb; v_after jsonb; v_id uuid;
 r public.b2c_monthly_comments; old_request public.b2c_monthly_comment_requests; v_recipient jsonb; v_channel text; v_destination text;
begin
 if p_action is null or p_action not in ('save','confirm_delivery') or not app.has_b2c_permission(case when p_action='save' then 'write_comments' else 'share_monthly_comments' end,v_class) then raise exception 'Không có quyền nhận xét/chia sẻ tại lớp này.' using errcode='42501'; end if;
 if v_request is null or v_class is null then raise exception 'Thiếu lớp hoặc mã yêu cầu.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_request::text,0));
 select * into old_request from public.b2c_monthly_comment_requests where request_id=v_request;
 if found then
  if old_request.actor_id is distinct from auth.uid() or old_request.payload is distinct from jsonb_build_object('action',p_action,'data',p_data) then raise exception 'Mã yêu cầu đã dùng cho nội dung khác.' using errcode='22023'; end if;
  return old_request.result_id;
 end if;
 perform 1 from public.b2c_classes where id=v_class for update;
 select full_name into v_actor from public.profiles where id=auth.uid();
 if p_action='save' then
  if coalesce(p_data->>'month','')!~'^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Tháng không hợp lệ.' using errcode='22023'; end if;
  v_month:=((p_data->>'month')||'-01')::date; v_content:=p_data->'content'; v_status:=p_data->>'status';
  if v_month<date '1900-01-01' or v_month>date_trunc('month',now() at time zone 'Asia/Ho_Chi_Minh')::date or v_status is null or v_status not in ('draft','ready') or jsonb_typeof(v_content) is distinct from 'object' then raise exception 'Kiểm tra tháng, trạng thái và mẫu nhận xét.' using errcode='22023'; end if;
  if v_content-array['attendance','attitude','learning','strengths','improvements','next_plan']<>'{}'::jsonb then raise exception 'Mẫu nhận xét không hợp lệ.' using errcode='22023'; end if;
  foreach v_key in array array['attendance','attitude','learning','strengths','improvements','next_plan'] loop
   if jsonb_typeof(v_content->v_key) is distinct from 'string' or char_length(v_content->>v_key)>1000 or (v_status='ready' and btrim(v_content->>v_key)='') then raise exception 'Nhập đủ sáu mục trước khi hoàn tất, mỗi mục tối đa 1000 ký tự.' using errcode='22023'; end if;
  end loop;
  perform 1 from public.b2c_enrollments e where e.id=v_enrollment and e.class_id=v_class and coalesce(e.enrollment_date,date '1900-01-01')<v_month+interval '1 month'
   and (e.status<>'transferred' or exists(select 1 from public.b2c_monthly_comments x where x.enrollment_id=e.id and x.report_month=v_month) or exists(select 1 from public.b2c_enrollment_events h where h.enrollment_id=e.id and h.action='transfer' and h.effective_date>=v_month)) for update;
  if not found then raise exception 'Học viên không thuộc lớp/tháng được chọn.' using errcode='22023'; end if;
  select * into r from public.b2c_monthly_comments where enrollment_id=v_enrollment and report_month=v_month for update;
  if r.updated_at is distinct from v_expected then raise exception 'Nhận xét đã thay đổi. Tải lại trước khi lưu.' using errcode='40001'; end if;
  if r.id is not null then v_before:=jsonb_build_object('status',r.status,'content',r.content); end if;
  if r.id is not null and r.content=v_content and r.status=v_status then
   v_id:=r.id;
  else
  insert into public.b2c_monthly_comments(class_id,enrollment_id,report_month,content,status,author_name,created_by,updated_by)
  values(v_class,v_enrollment,v_month,v_content,v_status,v_actor,auth.uid(),auth.uid())
  on conflict(enrollment_id,report_month) do update set content=excluded.content,status=excluded.status,author_name=excluded.author_name,updated_by=excluded.updated_by,updated_at=clock_timestamp() returning * into r;
  v_id:=r.id; v_after:=jsonb_build_object('status',r.status,'content',r.content);
  if v_before is distinct from v_after then insert into public.b2c_monthly_comment_history(report_id,actor_id,actor_name,before_data,after_data) values(r.id,auth.uid(),v_actor,v_before,v_after); end if;
  end if;
 else
  select * into r from public.b2c_monthly_comments where id=v_report and class_id=v_class for update;
  if not found or r.status<>'ready' then raise exception 'Chỉ bản nhận xét hoàn tất mới chia sẻ được.' using errcode='22023'; end if;
  if r.updated_at is distinct from v_expected then raise exception 'Nội dung nhận xét đã thay đổi. Mở lại bản gửi.' using errcode='40001'; end if;
  if p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'Cần xác nhận đã gửi thủ công.' using errcode='22023'; end if;
  v_channel:=p_data->>'channel';
  select value into v_recipient from jsonb_array_elements(app.b2c_monthly_comment_recipients(r.id)) where value->>'key'=p_data->>'recipient_key';
  if v_recipient is null or v_channel is null or v_channel not in ('zalo','email') then raise exception 'Chọn phụ huynh đã liên kết và kênh gửi hợp lệ.' using errcode='22023'; end if;
  v_destination:=nullif(btrim(v_recipient->>v_channel),'');
  if v_destination is null then raise exception 'Chưa có thông tin liên hệ phụ huynh cho kênh này.' using errcode='22023'; end if;
  insert into public.b2c_monthly_comment_deliveries(report_id,report_updated_at,channel,recipient_key,recipient_name,destination,message,actor_id,actor_name)
  values(r.id,r.updated_at,v_channel,v_recipient->>'key',v_recipient->>'name',v_destination,app.render_b2c_monthly_comment(r.id),auth.uid(),v_actor) returning id into v_id;
 end if;
 insert into public.b2c_monthly_comment_requests(request_id,actor_id,payload,result_id) values(v_request,auth.uid(),jsonb_build_object('action',p_action,'data',p_data),v_id);
 return v_id;
end $$;
revoke all on function public.write_b2c_monthly_comment(text,jsonb) from public,anon;
grant execute on function public.write_b2c_monthly_comment(text,jsonb) to authenticated;

create function public.read_b2c_monthly_comments(p_class_id uuid,p_month text,p_page integer default 0,p_query text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_month date;
begin
 if not app.has_b2c_permission('view_comments',p_class_id) then raise exception 'Không có quyền xem nhận xét của lớp.' using errcode='42501'; end if;
 if p_month is null or p_month!~'^[0-9]{4}-(0[1-9]|1[0-2])$' or p_page is null or p_page not between 0 and 1000000 or p_query is null or char_length(p_query)>200 then raise exception 'Bộ lọc không hợp lệ.' using errcode='22023'; end if;
 v_month:=(p_month||'-01')::date;
 if v_month<date '1900-01-01' or v_month>date_trunc('month',now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Chọn tháng hiện tại hoặc trước đó.' using errcode='22023'; end if;
 return (with filtered as (
  select e.id as enrollment_id,s.code as student_code,s.full_name,
   case when r.id is not null then jsonb_build_object('id',r.id,'status',r.status,'content',r.content,'updated_at',r.updated_at,'author_name',r.author_name) end as report,
   case when app.has_b2c_permission('share_monthly_comments',p_class_id) then (select jsonb_build_object('channel',d.channel,'recipient_name',d.recipient_name,'destination',d.destination,'created_at',d.created_at,'report_updated_at',d.report_updated_at) from public.b2c_monthly_comment_deliveries d where d.report_id=r.id order by created_at desc,id desc limit 1) end as last_delivery
  from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id left join public.b2c_monthly_comments r on r.enrollment_id=e.id and r.report_month=v_month
  where e.class_id=p_class_id and coalesce(e.enrollment_date,date '1900-01-01')<v_month+interval '1 month'
  and (r.id is not null or e.status<>'transferred' or exists(select 1 from public.b2c_enrollment_events h where h.enrollment_id=e.id and h.action='transfer' and h.effective_date>=v_month))
  and (p_query='' or position(lower(btrim(p_query)) in lower(s.code||' '||s.full_name))>0)
 ), rows as (select * from filtered order by student_code,enrollment_id limit 20 offset p_page::bigint*20)
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(x) order by student_code,enrollment_id) from rows x),'[]')));
end $$;
create function public.read_b2c_monthly_comment_detail(p_report_id uuid,p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.b2c_monthly_comments; v_share boolean;
begin
 select * into r from public.b2c_monthly_comments where id=p_report_id;
 if not found or not app.has_b2c_permission('view_comments',r.class_id) then raise exception 'Không có quyền xem nhận xét.' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 1000000 then raise exception 'Trang không hợp lệ.' using errcode='22023'; end if;
 v_share:=app.has_b2c_permission('share_monthly_comments',r.class_id);
 return jsonb_build_object('updated_at',r.updated_at,'status',r.status,'message',app.render_b2c_monthly_comment(r.id),
 'recipients',case when v_share then app.b2c_monthly_comment_recipients(r.id) else '[]'::jsonb end,
 'history_total',(select count(*) from public.b2c_monthly_comment_history where report_id=r.id),
 'history',(select coalesce(jsonb_agg(to_jsonb(h) order by created_at desc,id desc),'[]') from (select id,actor_name,created_at,before_data,after_data from public.b2c_monthly_comment_history where report_id=r.id order by created_at desc,id desc limit 20 offset p_page::bigint*20) h),
 'delivery_total',case when v_share then (select count(*) from public.b2c_monthly_comment_deliveries where report_id=r.id) else 0 end,
 'deliveries',case when v_share then (select coalesce(jsonb_agg(to_jsonb(d) order by created_at desc,id desc),'[]') from (select id,actor_name,created_at,channel,recipient_name,destination,message,report_updated_at from public.b2c_monthly_comment_deliveries where report_id=r.id order by created_at desc,id desc limit 20 offset p_page::bigint*20) d) else '[]'::jsonb end);
end $$;
revoke all on function public.read_b2c_monthly_comments(uuid,text,integer,text),public.read_b2c_monthly_comment_detail(uuid,integer) from public,anon;
grant execute on function public.read_b2c_monthly_comments(uuid,text,integer,text),public.read_b2c_monthly_comment_detail(uuid,integer) to authenticated;
notify pgrst,'reload schema';
