create table public.b2c_certificate_results (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.b2c_students(id) on delete restrict,
 certificate_type text not null check(char_length(btrim(certificate_type)) between 1 and 100),
 level text not null default '' check(char_length(level)<=100), score text not null check(char_length(btrim(score)) between 1 and 100),
 exam_date date not null check(exam_date>=date '1900-01-01'),
 marketing_allowed boolean not null default false, marketing_note text not null default '' check(char_length(marketing_note)<=500),
 marketing_selected_by uuid references auth.users(id), marketing_selected_at timestamptz,
 notes text not null default '' check(char_length(notes)<=2000), is_archived boolean not null default false,
 created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 check((marketing_allowed and marketing_selected_by is not null and marketing_selected_at is not null)
  or (not marketing_allowed and marketing_selected_by is null and marketing_selected_at is null))
);
create unique index b2c_certificate_unique_attempt on public.b2c_certificate_results(student_id,lower(btrim(certificate_type)),lower(btrim(level)),exam_date) where not is_archived;
create index b2c_certificates_date on public.b2c_certificate_results(exam_date desc,id);
create table public.b2c_certificate_history (
 id uuid primary key default gen_random_uuid(), result_id uuid not null references public.b2c_certificate_results(id) on delete restrict,
 action text not null check(action in ('save','archive','restore')), before_data jsonb, after_data jsonb not null,
 actor_id uuid not null references auth.users(id), actor_name text not null, created_at timestamptz not null default clock_timestamp()
);
create index b2c_certificate_history_result on public.b2c_certificate_history(result_id,created_at desc,id desc);
create table public.b2c_certificate_requests (
 request_id uuid primary key, actor_id uuid not null references auth.users(id), payload jsonb not null, result_id uuid not null references public.b2c_certificate_results(id)
);
alter table public.b2c_certificate_results enable row level security;
alter table public.b2c_certificate_history enable row level security;
alter table public.b2c_certificate_requests enable row level security;
revoke all on public.b2c_certificate_results,public.b2c_certificate_history,public.b2c_certificate_requests from public,anon,authenticated;
grant select on public.b2c_certificate_results,public.b2c_certificate_history to authenticated;
create policy b2c_certificates_manager_read on public.b2c_certificate_results for select to authenticated using(app.is_manager());
create policy b2c_certificate_history_manager_read on public.b2c_certificate_history for select to authenticated using(app.is_manager());

create function public.write_b2c_certificate_result(p_action text,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_request uuid:=(p_data->>'request_id')::uuid; v_id uuid:=nullif(p_data->>'id','')::uuid;
 v_student uuid:=nullif(p_data->>'student_id','')::uuid; v_expected timestamptz:=nullif(p_data->>'expected_updated_at','')::timestamptz;
 r public.b2c_certificate_results; old_request public.b2c_certificate_requests;
 v_type text; v_level text; v_score text; v_date date; v_marketing boolean; v_note text; v_marketing_note text;
 v_before jsonb; v_after jsonb; v_actor text;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Chỉ quản trị hoặc giáo vụ quản lý kết quả chứng chỉ.' using errcode='42501'; end if;
 if v_request is null or p_action is null or p_action not in ('save','archive','restore') then raise exception 'Thao tác kết quả chứng chỉ không hợp lệ.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_request::text,0));
 select * into old_request from public.b2c_certificate_requests where request_id=v_request;
 if found then
  if old_request.actor_id is distinct from auth.uid() or old_request.payload is distinct from jsonb_build_object('action',p_action,'data',p_data) then raise exception 'Mã yêu cầu đã dùng cho nội dung khác.' using errcode='22023'; end if;
  return old_request.result_id;
 end if;
 if v_id is not null then
  select * into r from public.b2c_certificate_results where id=v_id for update;
  if not found then raise exception 'Không tìm thấy kết quả chứng chỉ.' using errcode='22023'; end if;
  if r.updated_at is distinct from v_expected then raise exception 'Kết quả đã thay đổi. Tải lại trước khi lưu.' using errcode='40001'; end if;
  v_before:=to_jsonb(r)-array['created_at','updated_at','created_by','updated_by'];
 end if;
 select full_name into v_actor from public.profiles where id=auth.uid();
 if p_action='save' then
  if r.id is not null and r.is_archived then raise exception 'Khôi phục kết quả trước khi chỉnh sửa.' using errcode='22023'; end if;
  v_type:=btrim(p_data->>'certificate_type'); v_level:=btrim(coalesce(p_data->>'level','')); v_score:=btrim(p_data->>'score');
  v_date:=(p_data->>'exam_date')::date; v_note:=btrim(coalesce(p_data->>'notes','')); v_marketing_note:=btrim(coalesce(p_data->>'marketing_note',''));
  if jsonb_typeof(p_data->'marketing_allowed') is distinct from 'boolean' then raise exception 'Chọn rõ trạng thái sử dụng marketing.' using errcode='22023'; end if;
  v_marketing:=(p_data->>'marketing_allowed')::boolean;
  if v_student is null or v_type is null or char_length(v_type) not between 1 and 100 or char_length(v_level)>100
   or v_score is null or char_length(v_score) not between 1 and 100 or v_date is null or v_date<date '1900-01-01' or v_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date
   or char_length(v_note)>2000 or char_length(v_marketing_note)>500 then raise exception 'Kiểm tra loại chứng chỉ, cấp độ, điểm/xếp loại và ngày thi thực tế.' using errcode='22023'; end if;
  if not exists(select 1 from public.b2c_students where id=v_student) then raise exception 'Chọn hồ sơ học viên B2C có sẵn.' using errcode='22023'; end if;
  if r.id is null then
   if v_expected is not null then raise exception 'Kết quả mới không có phiên bản cũ.' using errcode='22023'; end if;
   insert into public.b2c_certificate_results(student_id,certificate_type,level,score,exam_date,marketing_allowed,marketing_note,marketing_selected_by,marketing_selected_at,notes,created_by,updated_by)
   values(v_student,v_type,v_level,v_score,v_date,v_marketing,v_marketing_note,case when v_marketing then auth.uid() end,case when v_marketing then clock_timestamp() end,v_note,auth.uid(),auth.uid()) returning * into r;
  else
   if r.student_id<>v_student then raise exception 'Không đổi học viên của kết quả đã lưu.' using errcode='22023'; end if;
   update public.b2c_certificate_results set certificate_type=v_type,level=v_level,score=v_score,exam_date=v_date,marketing_allowed=v_marketing,marketing_note=v_marketing_note,
    marketing_selected_by=case when v_marketing then coalesce(marketing_selected_by,auth.uid()) end,
    marketing_selected_at=case when v_marketing then coalesce(marketing_selected_at,clock_timestamp()) end,
    notes=v_note,updated_by=auth.uid(),updated_at=clock_timestamp() where id=r.id returning * into r;
  end if;
 else
  if r.id is null then raise exception 'Chọn kết quả cần lưu trữ/khôi phục.' using errcode='22023'; end if;
  update public.b2c_certificate_results set is_archived=(p_action='archive'),updated_by=auth.uid(),updated_at=clock_timestamp() where id=r.id returning * into r;
 end if;
 v_after:=to_jsonb(r)-array['created_at','updated_at','created_by','updated_by'];
 if v_before is distinct from v_after then
  insert into public.b2c_certificate_history(result_id,action,before_data,after_data,actor_id,actor_name) values(r.id,p_action,v_before,v_after,auth.uid(),v_actor);
 end if;
 insert into public.b2c_certificate_requests(request_id,actor_id,payload,result_id) values(v_request,auth.uid(),jsonb_build_object('action',p_action,'data',p_data),r.id);
 return r.id;
exception when unique_violation then raise exception 'Học viên đã có kết quả cùng loại, cấp độ và ngày thi. Hãy sửa kết quả hiện có.' using errcode='22023';
end $$;
revoke all on function public.write_b2c_certificate_result(text,jsonb) from public,anon;
grant execute on function public.write_b2c_certificate_result(text,jsonb) to authenticated;

create function public.find_b2c_certificate_students(p_query text,p_page integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền chọn học viên.' using errcode='42501'; end if;
 if p_query is null or char_length(btrim(p_query)) not between 1 and 200 or p_page is null or p_page not between 0 and 1000000 then raise exception 'Nhập mã hoặc tên học viên.' using errcode='22023'; end if;
 return (with filtered as (select id,code,full_name from public.b2c_students where position(lower(btrim(p_query)) in lower(code||' '||full_name))>0), rows as (select * from filtered order by full_name,code limit 20 offset p_page::bigint*20)
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(s) order by full_name,code) from rows s),'[]')));
end $$;

create function public.read_b2c_certificate_results(p_filters jsonb,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_query text:=btrim(coalesce(p_filters->>'query','')); v_type text:=btrim(coalesce(p_filters->>'certificateType',''));
 v_from date:=nullif(p_filters->>'from','')::date; v_to date:=nullif(p_filters->>'to','')::date;
 v_marketing text:=coalesce(p_filters->>'marketing','all'); v_archived boolean:=coalesce((p_filters->>'archived')::boolean,false);
 v_student uuid:=nullif(p_filters->>'studentId','')::uuid; v_page integer:=coalesce((p_filters->>'page')::integer,0);
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền xem kết quả chứng chỉ.' using errcode='42501'; end if;
 if char_length(v_query)>200 or char_length(v_type)>100 or v_page not between 0 and 1000000 or p_limit is null or p_limit not between 1 and 5000 or v_marketing not in ('all','yes','no') or v_to<v_from then raise exception 'Bộ lọc không hợp lệ.' using errcode='22023'; end if;
 if v_student is not null and not exists(select 1 from public.b2c_students where id=v_student) then raise exception 'Không tìm thấy học viên.' using errcode='22023'; end if;
 return (with filtered as (
  select r.id,r.student_id,s.code as student_code,s.full_name,r.certificate_type,r.level,r.score,r.exam_date,r.marketing_allowed,r.marketing_note,r.notes,r.is_archived,r.updated_at
  from public.b2c_certificate_results r join public.b2c_students s on s.id=r.student_id
  where r.is_archived=v_archived and (v_student is null or r.student_id=v_student)
   and (v_type='' or lower(r.certificate_type)=lower(v_type)) and (v_from is null or r.exam_date>=v_from) and (v_to is null or r.exam_date<=v_to)
   and (v_marketing='all' or r.marketing_allowed=(v_marketing='yes'))
   and (v_query='' or position(lower(v_query) in lower(concat_ws(' ',s.code,s.full_name,r.certificate_type,r.level,r.score)))>0)
 ), rows as (select * from filtered order by exam_date desc,id limit p_limit offset v_page::bigint*p_limit)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x) order by exam_date desc,id) from rows x),'[]'),
  'total',(select count(*) from filtered),'student_count',(select count(distinct student_id) from filtered),'marketing_count',(select count(*) from filtered where marketing_allowed),'type_count',(select count(distinct lower(certificate_type)) from filtered),
  'types',coalesce((select jsonb_agg(x.name order by x.name) from (select min(certificate_type) as name from public.b2c_certificate_results where not is_archived group by lower(certificate_type)) x),'[]'),
  'student_filter',(select jsonb_build_object('id',id,'code',code,'full_name',full_name) from public.b2c_students where id=v_student)));
end $$;
create function public.read_b2c_certificate_history(p_result_id uuid,p_page integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền xem lịch sử chứng chỉ.' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 1000000 then raise exception 'Trang không hợp lệ.' using errcode='22023'; end if;
 return jsonb_build_object('total',(select count(*) from public.b2c_certificate_history where result_id=p_result_id),
  'rows',(select coalesce(jsonb_agg(to_jsonb(h) order by created_at desc,id desc),'[]') from (select id,action,before_data,after_data,actor_name,created_at from public.b2c_certificate_history where result_id=p_result_id order by created_at desc,id desc limit 20 offset p_page::bigint*20) h));
end $$;
revoke all on function public.find_b2c_certificate_students(text,integer),public.read_b2c_certificate_results(jsonb,integer),public.read_b2c_certificate_history(uuid,integer) from public,anon;
grant execute on function public.find_b2c_certificate_students(text,integer),public.read_b2c_certificate_results(jsonb,integer),public.read_b2c_certificate_history(uuid,integer) to authenticated;
notify pgrst,'reload schema';
