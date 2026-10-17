create extension if not exists pgcrypto with schema extensions;
create table public.b2c_nps_surveys (
 id uuid primary key default gen_random_uuid(), class_id uuid not null unique references public.b2c_classes(id) on delete restrict,
 title text not null check(char_length(btrim(title)) between 1 and 200), status text not null default 'open' check(status in ('open','closed')),
 expires_at timestamptz not null, created_by uuid not null references auth.users(id), updated_at timestamptz not null default clock_timestamp()
);
create table public.b2c_nps_invitations (
 id uuid primary key default gen_random_uuid(), survey_id uuid not null references public.b2c_nps_surveys(id) on delete restrict,
 parent_id uuid not null references public.b2c_parents(id) on delete restrict, parent_name text not null,
 token_hash text not null unique check(token_hash~'^[a-f0-9]{64}$'), revoked boolean not null default false,
 created_by uuid not null references auth.users(id), updated_at timestamptz not null default clock_timestamp(), unique(survey_id,parent_id)
);
create table public.b2c_nps_responses (
 id uuid primary key default gen_random_uuid(), invitation_id uuid not null unique references public.b2c_nps_invitations(id) on delete restrict,
 request_id uuid not null unique, score integer not null check(score between 0 and 10), reason text not null default '' check(char_length(reason)<=2000),
 teacher_feedback text not null default '' check(char_length(teacher_feedback)<=2000), service_feedback text not null default '' check(char_length(service_feedback)<=2000), created_at timestamptz not null default clock_timestamp()
);
create table public.b2c_nps_history (
 id uuid primary key default gen_random_uuid(), survey_id uuid not null references public.b2c_nps_surveys(id), action text not null,
 parent_id uuid references public.b2c_parents(id), actor_id uuid not null references auth.users(id), actor_name text not null, created_at timestamptz not null default clock_timestamp()
);
create table public.b2c_nps_requests (
 request_id uuid primary key, actor_id uuid not null references auth.users(id), payload jsonb not null, result_id uuid not null
);
create index b2c_nps_responses_date on public.b2c_nps_responses(created_at desc,id);
alter table public.b2c_nps_surveys enable row level security;
alter table public.b2c_nps_invitations enable row level security;
alter table public.b2c_nps_responses enable row level security;
alter table public.b2c_nps_history enable row level security;
alter table public.b2c_nps_requests enable row level security;
revoke all on public.b2c_nps_surveys,public.b2c_nps_invitations,public.b2c_nps_responses,public.b2c_nps_history,public.b2c_nps_requests from public,anon,authenticated;
grant select on public.b2c_nps_surveys,public.b2c_nps_responses,public.b2c_nps_history to authenticated;
create policy b2c_nps_surveys_manager_read on public.b2c_nps_surveys for select to authenticated using(app.is_manager());
create policy b2c_nps_responses_manager_read on public.b2c_nps_responses for select to authenticated using(app.is_manager());
create policy b2c_nps_history_manager_read on public.b2c_nps_history for select to authenticated using(app.is_manager());
-- Invitations and token hashes are intentionally available only through guarded RPC projections.
create function app.b2c_nps_parent_eligible(p_survey uuid,p_parent uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.b2c_nps_surveys s join public.b2c_enrollments e on e.class_id=s.class_id join public.b2c_student_parents l on l.student_id=e.student_id where s.id=p_survey and l.parent_id=p_parent)
$$;
revoke all on function app.b2c_nps_parent_eligible(uuid,uuid) from public,anon,authenticated;

create function public.save_b2c_nps_survey(p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_request uuid:=(p_data->>'request_id')::uuid; v_id uuid:=nullif(p_data->>'id','')::uuid; v_class uuid:=nullif(p_data->>'class_id','')::uuid;
 v_expected timestamptz:=nullif(p_data->>'expected_updated_at','')::timestamptz; v_expires timestamptz:=(p_data->>'expires_at')::timestamptz;
 v_status text:=coalesce(p_data->>'status','open'); v_title text:=btrim(p_data->>'title'); s public.b2c_nps_surveys; old_request public.b2c_nps_requests;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Chỉ quản trị hoặc giáo vụ quản lý khảo sát NPS.' using errcode='42501'; end if;
 if v_request is null or v_expires is null or v_status not in ('open','closed') or (v_status='open' and (v_expires<=now() or v_expires>now()+interval '90 days')) then raise exception 'Kiểm tra trạng thái và hạn khảo sát (tối đa 90 ngày từ hôm nay).' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_request::text,0));
 select * into old_request from public.b2c_nps_requests where request_id=v_request;
 if found then
  if old_request.actor_id is distinct from auth.uid() or old_request.payload is distinct from p_data then raise exception 'Mã yêu cầu đã dùng cho nội dung khác.' using errcode='22023'; end if;
  return old_request.result_id;
 end if;
 if v_id is null then
  if v_title is null or char_length(v_title) not between 1 and 200 or v_expected is not null or not exists(select 1 from public.b2c_classes where id=v_class and status<>'cancelled') then raise exception 'Chọn lớp B2C có sẵn và nhập tên khảo sát.' using errcode='22023'; end if;
  insert into public.b2c_nps_surveys(class_id,title,status,expires_at,created_by) values(v_class,v_title,v_status,v_expires,auth.uid()) returning * into s;
 else
  select * into s from public.b2c_nps_surveys where id=v_id for update;
  if not found then raise exception 'Không tìm thấy khảo sát.' using errcode='22023'; end if;
  if s.updated_at is distinct from v_expected then raise exception 'Khảo sát đã thay đổi. Tải lại trước khi lưu.' using errcode='40001'; end if;
  update public.b2c_nps_surveys set status=v_status,expires_at=v_expires,updated_at=clock_timestamp() where id=s.id returning * into s;
 end if;
 insert into public.b2c_nps_history(survey_id,action,actor_id,actor_name) values(s.id,case when v_id is null then 'create' else v_status end,auth.uid(),(select full_name from public.profiles where id=auth.uid()));
 insert into public.b2c_nps_requests(request_id,actor_id,payload,result_id) values(v_request,auth.uid(),p_data,s.id);
 return s.id;
exception when unique_violation then raise exception 'Lớp này đã có khảo sát NPS. Chọn khảo sát hiện có để mở lại hoặc gia hạn.' using errcode='22023';
end $$;

create function public.issue_b2c_nps_invitation(p_survey_id uuid,p_parent_id uuid,p_token_hash text,p_expected_updated_at timestamptz default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.b2c_nps_surveys; i public.b2c_nps_invitations; v_id uuid;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền tạo đường dẫn khảo sát.' using errcode='42501'; end if;
 if p_token_hash is null or p_token_hash!~'^[a-f0-9]{64}$' then raise exception 'Mã đường dẫn không hợp lệ.' using errcode='22023'; end if;
 select * into s from public.b2c_nps_surveys where id=p_survey_id for update;
 if not found or s.status<>'open' or s.expires_at<=now() then raise exception 'Khảo sát đang đóng hoặc đã hết hạn.' using errcode='22023'; end if;
 if not app.b2c_nps_parent_eligible(s.id,p_parent_id) then raise exception 'Phụ huynh chưa liên kết với học viên của lớp.' using errcode='22023'; end if;
 select * into i from public.b2c_nps_invitations where survey_id=s.id and parent_id=p_parent_id for update;
 if i.updated_at is distinct from p_expected_updated_at then raise exception 'Đường dẫn đã thay đổi. Tải lại trước khi cấp lại.' using errcode='40001'; end if;
 if exists(select 1 from public.b2c_nps_responses where invitation_id=i.id) then raise exception 'Phụ huynh đã phản hồi; không tạo phiếu thứ hai.' using errcode='22023'; end if;
 insert into public.b2c_nps_invitations(survey_id,parent_id,parent_name,token_hash,created_by) values(s.id,p_parent_id,(select full_name from public.b2c_parents where id=p_parent_id),p_token_hash,auth.uid())
 on conflict(survey_id,parent_id) do update set token_hash=excluded.token_hash,revoked=false,updated_at=clock_timestamp() returning id into v_id;
 insert into public.b2c_nps_history(survey_id,parent_id,action,actor_id,actor_name) values(s.id,p_parent_id,case when i.id is null then 'issue_link' else 'rotate_link' end,auth.uid(),(select full_name from public.profiles where id=auth.uid()));
 return v_id;
end $$;
create function public.revoke_b2c_nps_invitation(p_id uuid,p_expected_updated_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare i public.b2c_nps_invitations; v_survey uuid;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền thu hồi đường dẫn.' using errcode='42501'; end if;
 select survey_id into v_survey from public.b2c_nps_invitations where id=p_id;
 -- Match issue/submit lock order, including the history foreign-key check.
 perform 1 from public.b2c_nps_surveys where id=v_survey for share;
 select * into i from public.b2c_nps_invitations where id=p_id for update;
 if not found or i.updated_at is distinct from p_expected_updated_at then raise exception 'Đường dẫn đã thay đổi. Tải lại trước khi thu hồi.' using errcode='40001'; end if;
 update public.b2c_nps_invitations set revoked=true,updated_at=clock_timestamp() where id=i.id;
 insert into public.b2c_nps_history(survey_id,parent_id,action,actor_id,actor_name) values(i.survey_id,i.parent_id,'revoke_link',auth.uid(),(select full_name from public.profiles where id=auth.uid()));
end $$;

create function public.read_public_b2c_nps(p_token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.b2c_nps_invitations; s public.b2c_nps_surveys;
begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' then return jsonb_build_object('state','invalid'); end if;
 select * into i from public.b2c_nps_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if not found then return jsonb_build_object('state','invalid'); end if;
 if exists(select 1 from public.b2c_nps_responses where invitation_id=i.id) then return jsonb_build_object('state','submitted'); end if;
 if i.revoked or not app.b2c_nps_parent_eligible(i.survey_id,i.parent_id) then return jsonb_build_object('state','invalid'); end if;
 select * into s from public.b2c_nps_surveys where id=i.survey_id;
 if s.status<>'open' then return jsonb_build_object('state','closed'); end if;
 if s.expires_at<=now() then return jsonb_build_object('state','expired'); end if;
 return jsonb_build_object('state','open','title',s.title,'class_name',(select name from public.b2c_classes where id=s.class_id),'expires_at',s.expires_at);
end $$;
create function public.submit_public_b2c_nps(p_token text,p_data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare i public.b2c_nps_invitations; s public.b2c_nps_surveys; r public.b2c_nps_responses; v_survey uuid;
 v_request uuid:=(p_data->>'request_id')::uuid; v_score numeric:=(p_data->>'score')::numeric;
 v_reason text:=btrim(coalesce(p_data->>'reason','')); v_teacher text:=btrim(coalesce(p_data->>'teacher_feedback','')); v_service text:=btrim(coalesce(p_data->>'service_feedback',''));
begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' then raise exception 'Đường dẫn khảo sát không hợp lệ.' using errcode='22023'; end if;
 if v_request is null or v_score is null or v_score<0 or v_score>10 or v_score<>trunc(v_score) or char_length(v_reason)>2000 or char_length(v_teacher)>2000 or char_length(v_service)>2000 then raise exception 'Chọn điểm từ 0 đến 10; mỗi góp ý tối đa 2000 ký tự.' using errcode='22023'; end if;
 select survey_id into v_survey from public.b2c_nps_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if not found then raise exception 'Đường dẫn khảo sát không hợp lệ.' using errcode='22023'; end if;
 select * into s from public.b2c_nps_surveys where id=v_survey for share;
 select * into i from public.b2c_nps_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found then raise exception 'Đường dẫn đã được cấp lại hoặc thu hồi.' using errcode='22023'; end if;
 select * into r from public.b2c_nps_responses where invitation_id=i.id;
 if found then
  if r.request_id=v_request and r.score=v_score and r.reason=v_reason and r.teacher_feedback=v_teacher and r.service_feedback=v_service then return; end if;
  raise exception 'Khảo sát này đã được gửi phản hồi.' using errcode='22023';
 end if;
 if i.revoked or not app.b2c_nps_parent_eligible(s.id,i.parent_id) or s.status<>'open' or s.expires_at<=now() then raise exception 'Khảo sát đã đóng, hết hạn hoặc đường dẫn không còn hiệu lực.' using errcode='22023'; end if;
 insert into public.b2c_nps_responses(invitation_id,request_id,score,reason,teacher_feedback,service_feedback) values(i.id,v_request,v_score::integer,v_reason,v_teacher,v_service);
end $$;

create function public.find_b2c_nps_classes(p_query text,p_page integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền chọn lớp.' using errcode='42501'; end if;
 if p_query is null or char_length(p_query)>200 or p_page is null or p_page not between 0 and 1000000 then raise exception 'Bộ lọc không hợp lệ.' using errcode='22023'; end if;
 return (with filtered as (select id,code,name from public.b2c_classes where status<>'cancelled' and (p_query='' or position(lower(btrim(p_query)) in lower(code||' '||name))>0)), rows as (select * from filtered order by code limit 20 offset p_page::bigint*20)
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(x) order by code) from rows x),'[]')));
end $$;
create function public.read_b2c_nps_admin(p_survey_id uuid default null,p_page integer default 0,p_query text default '',p_survey_page integer default 0,p_response_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.b2c_nps_surveys; v_stats jsonb; v_rows jsonb; v_total bigint;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền xem phản hồi phụ huynh.' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 1000000 or p_survey_page is null or p_survey_page not between 0 and 1000000 or p_response_page is null or p_response_page not between 0 and 1000000 or p_query is null or char_length(p_query)>200 then raise exception 'Bộ lọc không hợp lệ.' using errcode='22023'; end if;
 if p_survey_id is null then select * into s from public.b2c_nps_surveys order by updated_at desc,id limit 1 offset p_survey_page::bigint*10;
 else select * into s from public.b2c_nps_surveys where id=p_survey_id;
  if not found then raise exception 'Không tìm thấy khảo sát.' using errcode='22023'; end if;
 end if;
 select jsonb_build_object('responses',count(*),'invitations',(select count(*) from public.b2c_nps_invitations where survey_id=s.id),
  'promoters',count(*) filter(where r.score>=9),'passives',count(*) filter(where r.score between 7 and 8),'detractors',count(*) filter(where r.score<=6),
  'nps',round(100.0*(count(*) filter(where r.score>=9)-count(*) filter(where r.score<=6))/nullif(count(*),0),1)) into v_stats
 from public.b2c_nps_responses r join public.b2c_nps_invitations i on i.id=r.invitation_id where i.survey_id=s.id;
 with parents as (
  select p.id as parent_id,p.full_name as parent_name,p.zalo,p.email,string_agg(distinct st.code||' · '||st.full_name,', ') as children
  from public.b2c_enrollments e join public.b2c_students st on st.id=e.student_id join public.b2c_student_parents l on l.student_id=e.student_id join public.b2c_parents p on p.id=l.parent_id
  where e.class_id=s.class_id group by p.id
 ), filtered as (
  select p.*,i.id as invite_id,i.updated_at as invite_updated_at,coalesce(i.revoked,false) as revoked,r.score,r.created_at as answered_at
  from parents p left join public.b2c_nps_invitations i on i.survey_id=s.id and i.parent_id=p.parent_id left join public.b2c_nps_responses r on r.invitation_id=i.id
  where p_query='' or position(lower(btrim(p_query)) in lower(concat_ws(' ',p.parent_name,p.children)))>0
 ), rows as (select * from filtered order by parent_name,parent_id limit 20 offset p_page::bigint*20)
 select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(x) order by parent_name,parent_id) from rows x),'[]') into v_total,v_rows;
 return jsonb_build_object('selected',case when s.id is not null then to_jsonb(s)||jsonb_build_object('class_code',(select code from public.b2c_classes where id=s.class_id),'class_name',(select name from public.b2c_classes where id=s.class_id)) end,
 'surveys',(select coalesce(jsonb_agg(to_jsonb(x) order by updated_at desc,id),'[]') from (select a.id,a.class_id,a.title,a.status,a.expires_at,a.updated_at,c.code as class_code,c.name as class_name from public.b2c_nps_surveys a join public.b2c_classes c on c.id=a.class_id order by a.updated_at desc,a.id limit 10 offset p_survey_page::bigint*10) x),
 'survey_total',(select count(*) from public.b2c_nps_surveys),'stats',v_stats,'rows',v_rows,'total',v_total,
 'unlinked_students',(select count(distinct e.student_id) from public.b2c_enrollments e where e.class_id=s.class_id and not exists(select 1 from public.b2c_student_parents l where l.student_id=e.student_id)),
 'response_total',(select count(*) from public.b2c_nps_responses r join public.b2c_nps_invitations i on i.id=r.invitation_id where i.survey_id=s.id),
 'responses',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id desc),'[]') from (select r.id,i.parent_name,r.score,r.reason,r.teacher_feedback,r.service_feedback,r.created_at from public.b2c_nps_responses r join public.b2c_nps_invitations i on i.id=r.invitation_id where i.survey_id=s.id order by r.created_at desc,r.id desc limit 20 offset p_response_page::bigint*20) x));
end $$;
revoke all on function public.save_b2c_nps_survey(jsonb),public.issue_b2c_nps_invitation(uuid,uuid,text,timestamptz),public.revoke_b2c_nps_invitation(uuid,timestamptz),public.find_b2c_nps_classes(text,integer),public.read_b2c_nps_admin(uuid,integer,text,integer,integer) from public,anon;
grant execute on function public.save_b2c_nps_survey(jsonb),public.issue_b2c_nps_invitation(uuid,uuid,text,timestamptz),public.revoke_b2c_nps_invitation(uuid,timestamptz),public.find_b2c_nps_classes(text,integer),public.read_b2c_nps_admin(uuid,integer,text,integer,integer) to authenticated;
revoke all on function public.read_public_b2c_nps(text),public.submit_public_b2c_nps(text,jsonb) from public;
grant execute on function public.read_public_b2c_nps(text),public.submit_public_b2c_nps(text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
