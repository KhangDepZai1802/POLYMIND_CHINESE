-- New capabilities are opt-in. Existing teacher grants and defaults stay unchanged.
alter table public.b2c_teacher_permissions drop constraint known_b2c_permissions;
alter table public.b2c_teacher_permissions add constraint known_b2c_permissions check(permissions <@ array['view_classes','view_students','view_schedule','view_comments','write_comments','mark_attendance','check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition','view_assessments','grade_assessments']::text[]);
do $$ declare d text; begin
 select pg_get_functiondef('app.has_b2c_permission(text,uuid)'::regprocedure) into d;
 if position('''edit_tuition''' in d)=0 then raise exception 'Unexpected permission definition'; end if;
 execute replace(d,'''edit_tuition''','''edit_tuition'',''view_assessments'',''grade_assessments''');
 select pg_get_functiondef('public.save_b2c_teacher_permissions(uuid,uuid,text[],timestamptz)'::regprocedure) into d;
 d:=replace(d,'''edit_tuition'']','''edit_tuition'',''view_assessments'',''grade_assessments'']');
 d:=replace(d,'"edit_tuition":["view_tuition"]','"edit_tuition":["view_tuition"],"view_assessments":["view_students"],"grade_assessments":["view_assessments"]');
 execute d;
end $$;

create table public.b2c_assessments (
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.b2c_classes(id) on delete restrict,
 title text not null check(char_length(btrim(title)) between 1 and 200), kind text not null check(kind in ('midterm','final')),
 exam_date date not null check(exam_date>=date '1900-01-01'), max_score numeric(7,2) not null check(max_score>0 and max_score<=1000),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create index b2c_assessments_class_date on public.b2c_assessments(class_id,exam_date desc,id);
create table public.b2c_assessment_results (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.b2c_assessments(id) on delete restrict,
 enrollment_id uuid not null references public.b2c_enrollments(id) on delete restrict,
 score numeric(7,2) check(score>=0 and score<=1000), feedback text not null default '' check(char_length(feedback)<=2000),
 updated_by uuid not null references auth.users(id), updated_at timestamptz not null default clock_timestamp(), unique(exam_id,enrollment_id)
);
create table public.b2c_assessment_history (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.b2c_assessments(id) on delete restrict,
 entity_type text not null check(entity_type in ('exam','result')), enrollment_id uuid references public.b2c_enrollments(id) on delete restrict,
 student_name text, actor_id uuid not null references auth.users(id), actor_name text not null,
 reason text not null, before_data jsonb, after_data jsonb not null, created_at timestamptz not null default clock_timestamp()
);
create index b2c_assessment_history_exam on public.b2c_assessment_history(exam_id,created_at desc,id desc);
create table public.b2c_assessment_requests (
 request_id uuid primary key, actor_id uuid not null references auth.users(id), payload jsonb not null,
 result_id uuid not null, created_at timestamptz not null default clock_timestamp()
);
alter table public.b2c_assessments enable row level security;
alter table public.b2c_assessment_results enable row level security;
alter table public.b2c_assessment_history enable row level security;
alter table public.b2c_assessment_requests enable row level security;
revoke all on public.b2c_assessments,public.b2c_assessment_results,public.b2c_assessment_history,public.b2c_assessment_requests from public,anon,authenticated;
grant select on public.b2c_assessments,public.b2c_assessment_results,public.b2c_assessment_history to authenticated;
create policy b2c_assessments_read on public.b2c_assessments for select to authenticated using(public.has_b2c_permission('view_assessments',class_id));
create policy b2c_assessment_results_read on public.b2c_assessment_results for select to authenticated using(exists(select 1 from public.b2c_assessments a where a.id=exam_id));
create policy b2c_assessment_history_read on public.b2c_assessment_history for select to authenticated using(exists(select 1 from public.b2c_assessments a where a.id=exam_id));

create function app.b2c_assessment_eligible(p_exam uuid,p_enrollment uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.b2c_assessments a join public.b2c_enrollments e on e.class_id=a.class_id
 where a.id=p_exam and e.id=p_enrollment and
 (exists(select 1 from public.b2c_assessment_results r where r.exam_id=a.id and r.enrollment_id=e.id)
 or (coalesce(e.enrollment_date,date '1900-01-01')<=a.exam_date and e.status<>'withdrawn'
 and (e.status<>'transferred' or exists(select 1 from public.b2c_enrollment_events h where h.enrollment_id=e.id and h.action='transfer' and h.effective_date>a.exam_date)))))
$$;
revoke all on function app.b2c_assessment_eligible(uuid,uuid) from public,anon,authenticated;

create function public.write_b2c_assessment(p_action text,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_request uuid:=(p_data->>'request_id')::uuid; v_class uuid:=(p_data->>'class_id')::uuid;
 v_exam uuid:=nullif(coalesce(p_data->>'exam_id',p_data->>'id'),'')::uuid;
 v_enrollment uuid:=nullif(p_data->>'enrollment_id','')::uuid;
 v_expected timestamptz:=nullif(p_data->>'expected_updated_at','')::timestamptz;
 v_score numeric; v_max numeric; v_date date; v_title text; v_kind text; v_feedback text; v_reason text;
 a public.b2c_assessments; r public.b2c_assessment_results; old_request public.b2c_assessment_requests;
 v_id uuid; v_before jsonb; v_after jsonb; v_actor text; v_student text;
begin
 if not app.has_b2c_permission('grade_assessments',v_class) then raise exception 'Không có quyền tạo bài/nhập điểm tại lớp này.' using errcode='42501'; end if;
 if v_request is null or v_class is null or p_action is null or p_action not in ('exam','result') then raise exception 'Thông tin bài kiểm tra không hợp lệ.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_request::text,0));
 select * into old_request from public.b2c_assessment_requests where request_id=v_request;
 if found then
  if old_request.actor_id is distinct from auth.uid() or old_request.payload is distinct from jsonb_build_object('action',p_action,'data',p_data) then raise exception 'Mã yêu cầu đã dùng cho nội dung khác.' using errcode='22023'; end if;
  return old_request.result_id;
 end if;
 perform 1 from public.b2c_classes where id=v_class for update;
 if not found then raise exception 'Không tìm thấy lớp.' using errcode='22023'; end if;
 select full_name into v_actor from public.profiles where id=auth.uid();
 if v_exam is not null then
  select * into a from public.b2c_assessments where id=v_exam and class_id=v_class for update;
  if not found then raise exception 'Bài kiểm tra không thuộc lớp.' using errcode='22023'; end if;
 end if;
 if p_action='exam' then
  v_title:=btrim(p_data->>'title'); v_kind:=p_data->>'kind'; v_date:=(p_data->>'exam_date')::date; v_max:=(p_data->>'max_score')::numeric;
  if v_title is null or char_length(v_title) not between 1 and 200 or v_kind is null or v_kind not in ('midterm','final') or v_date is null or v_date<date '1900-01-01' or v_max is null or v_max<=0 or v_max>1000 or v_max<>round(v_max,2) then raise exception 'Kiểm tra tên, loại, ngày và thang điểm.' using errcode='22023'; end if;
  if v_exam is null then
   if v_expected is not null then raise exception 'Bài mới không có phiên bản cũ.' using errcode='22023'; end if;
   insert into public.b2c_assessments(class_id,title,kind,exam_date,max_score,created_by) values(v_class,v_title,v_kind,v_date,v_max,auth.uid()) returning * into a;
   v_reason:='Tạo bài kiểm tra';
  else
   if a.updated_at is distinct from v_expected then raise exception 'Bài kiểm tra đã thay đổi. Tải lại trước khi lưu.' using errcode='40001'; end if;
   if (v_max<>a.max_score or v_date<>a.exam_date) and exists(select 1 from public.b2c_assessment_results where exam_id=a.id) then raise exception 'Đã có kết quả; không đổi ngày hoặc thang điểm để giữ ý nghĩa điểm cũ.' using errcode='22023'; end if;
   v_before:=jsonb_build_object('title',a.title,'kind',a.kind,'exam_date',a.exam_date,'max_score',a.max_score);
   update public.b2c_assessments set title=v_title,kind=v_kind,exam_date=v_date,max_score=v_max,updated_at=clock_timestamp() where id=a.id returning * into a;
   v_reason:='Sửa thông tin bài kiểm tra';
  end if;
  v_id:=a.id; v_after:=jsonb_build_object('title',a.title,'kind',a.kind,'exam_date',a.exam_date,'max_score',a.max_score);
 else
  if v_exam is null or v_enrollment is null or not app.b2c_assessment_eligible(v_exam,v_enrollment) then raise exception 'Học viên không thuộc danh sách bài kiểm tra này.' using errcode='22023'; end if;
  perform 1 from public.b2c_enrollments where id=v_enrollment for update;
  if a.exam_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Chưa đến ngày kiểm tra, chưa được nhập kết quả.' using errcode='22023'; end if;
  v_score:=nullif(p_data->>'score','')::numeric; v_feedback:=btrim(coalesce(p_data->>'feedback','')); v_reason:=btrim(coalesce(p_data->>'reason',''));
  if (v_score is not null and (v_score<0 or v_score>a.max_score or v_score<>round(v_score,2))) or char_length(v_feedback)>2000 or char_length(v_reason)>1000 then raise exception 'Điểm phải từ 0 đến điểm tối đa, tối đa 2 số lẻ; kiểm tra độ dài nhận xét/lý do.' using errcode='22023'; end if;
  select * into r from public.b2c_assessment_results where exam_id=a.id and enrollment_id=v_enrollment for update;
  if r.updated_at is distinct from v_expected then raise exception 'Kết quả đã thay đổi. Tải lại trước khi lưu.' using errcode='40001'; end if;
  if r.id is not null then
   if v_reason='' then raise exception 'Nhập lý do sửa kết quả.' using errcode='22023'; end if;
   v_before:=jsonb_build_object('score',r.score,'feedback',r.feedback,'max_score',a.max_score);
  else v_reason:='Nhập kết quả'; end if;
  insert into public.b2c_assessment_results(exam_id,enrollment_id,score,feedback,updated_by) values(a.id,v_enrollment,v_score,v_feedback,auth.uid())
  on conflict(exam_id,enrollment_id) do update set score=excluded.score,feedback=excluded.feedback,updated_by=excluded.updated_by,updated_at=clock_timestamp() returning id into v_id;
  select s.full_name into v_student from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id where e.id=v_enrollment;
  v_after:=jsonb_build_object('score',v_score,'feedback',v_feedback,'max_score',a.max_score);
 end if;
 if v_before is distinct from v_after then
  insert into public.b2c_assessment_history(exam_id,entity_type,enrollment_id,student_name,actor_id,actor_name,reason,before_data,after_data)
  values(a.id,p_action,v_enrollment,v_student,auth.uid(),v_actor,v_reason,v_before,v_after);
 end if;
 insert into public.b2c_assessment_requests(request_id,actor_id,payload,result_id) values(v_request,auth.uid(),jsonb_build_object('action',p_action,'data',p_data),v_id);
 return v_id;
end $$;
revoke all on function public.write_b2c_assessment(text,jsonb) from public,anon;
grant execute on function public.write_b2c_assessment(text,jsonb) to authenticated;

create function public.read_b2c_assessments(p_class_id uuid,p_exam_id uuid default null,p_page integer default 0,p_query text default '',p_exam_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.b2c_assessments; v_rows jsonb; v_total bigint; v_graded bigint;
begin
 if not app.has_b2c_permission('view_assessments',p_class_id) then raise exception 'Không có quyền xem bài kiểm tra của lớp.' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 1000000 or p_exam_page is null or p_exam_page not between 0 and 1000000 or p_query is null or char_length(p_query)>200 then raise exception 'Bộ lọc không hợp lệ.' using errcode='22023'; end if;
 if p_exam_id is null then select * into a from public.b2c_assessments where class_id=p_class_id order by exam_date desc,id limit 1 offset p_exam_page::bigint*10;
 else select * into a from public.b2c_assessments where id=p_exam_id and class_id=p_class_id;
  if not found then raise exception 'Bài kiểm tra không thuộc lớp.' using errcode='22023'; end if;
 end if;
 with roster as (
  select e.id as enrollment_id,s.code as student_code,s.full_name,r.score,coalesce(r.feedback,'') as feedback,r.updated_at
  from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id
  left join public.b2c_assessment_results r on r.exam_id=a.id and r.enrollment_id=e.id
  where e.class_id=p_class_id and app.b2c_assessment_eligible(a.id,e.id)
  and (p_query='' or position(lower(btrim(p_query)) in lower(s.code||' '||s.full_name))>0)
 ), page_rows as (select * from roster order by student_code,enrollment_id limit 20 offset p_page::bigint*20)
 select (select count(*) from roster),(select count(*) from roster where score is not null),coalesce((select jsonb_agg(to_jsonb(r) order by student_code,enrollment_id) from page_rows r),'[]') into v_total,v_graded,v_rows;
 return jsonb_build_object('selected',case when a.id is not null then to_jsonb(a)-'created_by' end,'rows',v_rows,'total',v_total,'graded',v_graded,
 'exam_total',(select count(*) from public.b2c_assessments where class_id=p_class_id),
 'exams',(select coalesce(jsonb_agg(to_jsonb(x) order by exam_date desc,id),'[]') from (select id,title,kind,exam_date,max_score,updated_at from public.b2c_assessments where class_id=p_class_id order by exam_date desc,id limit 10 offset p_exam_page::bigint*10) x));
end $$;
create function public.read_b2c_assessment_history(p_exam_id uuid,p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_class uuid;
begin
 select class_id into v_class from public.b2c_assessments where id=p_exam_id;
 if v_class is null or not app.has_b2c_permission('view_assessments',v_class) then raise exception 'Không có quyền xem lịch sử.' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 1000000 then raise exception 'Trang không hợp lệ.' using errcode='22023'; end if;
 return jsonb_build_object('total',(select count(*) from public.b2c_assessment_history where exam_id=p_exam_id),
 'rows',(select coalesce(jsonb_agg(to_jsonb(h) order by created_at desc,id desc),'[]') from (select id,entity_type,student_name,actor_name,created_at,reason,before_data,after_data from public.b2c_assessment_history where exam_id=p_exam_id order by created_at desc,id desc limit 20 offset p_page::bigint*20) h));
end $$;
revoke all on function public.read_b2c_assessments(uuid,uuid,integer,text,integer),public.read_b2c_assessment_history(uuid,integer) from public,anon;
grant execute on function public.read_b2c_assessments(uuid,uuid,integer,text,integer),public.read_b2c_assessment_history(uuid,integer) to authenticated;
notify pgrst,'reload schema';
