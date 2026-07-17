-- 39 — RPC và transaction cho assessment engine

create or replace function app.require_assessment_author()
returns void language plpgsql stable security definer set search_path='' as $$
begin
  if not app.is_active() or app.current_role() not in ('teacher','super_admin') then
    raise exception 'Không có quyền thực hiện thao tác này';
  end if;
end $$;

create or replace function public.create_question_version(
  p_question_id uuid,
  p_question_type public.question_type,
  p_prompt_text text,
  p_prompt_content jsonb default '{}'::jsonb,
  p_normalization_config jsonb default '{}'::jsonb,
  p_explanation_text text default null,
  p_options jsonb default '[]'::jsonb,
  p_answer_key jsonb default '{}'::jsonb,
  p_grading_config jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_no integer;
begin
  perform app.require_assessment_author();
  if not exists(select 1 from public.questions q where q.id=p_question_id and (q.owner_id=auth.uid() or app.is_super_admin())) then raise exception 'Không tìm thấy câu hỏi'; end if;
  if nullif(trim(p_prompt_text),'') is null or jsonb_typeof(p_prompt_content)<>'object' or jsonb_typeof(p_options)<>'array' then raise exception 'Nội dung câu hỏi không hợp lệ'; end if;
  select coalesce(max(version_no),0)+1 into v_no from public.question_versions where question_id=p_question_id;
  insert into public.question_versions(question_id,version_no,question_type,prompt_text,prompt_content,normalization_config,explanation_text,created_by)
  values(p_question_id,v_no,p_question_type,trim(p_prompt_text),p_prompt_content,p_normalization_config,p_explanation_text,auth.uid()) returning id into v_id;
  insert into public.question_options(question_version_id,option_key,content,order_index)
  select v_id, coalesce(o->>'key',(ord-1)::text), o->>'content', ord-1
  from jsonb_array_elements(p_options) with ordinality x(o,ord)
  where nullif(trim(o->>'content'),'') is not null;
  insert into public.question_answer_keys(question_version_id,answer_key,grading_config,created_by)
  values(v_id,p_answer_key,p_grading_config,auth.uid());
  update public.questions set current_version_id=v_id,status='draft',updated_at=now() where id=p_question_id;
  perform app.write_audit('question.version.create','question',p_question_id,null,jsonb_build_object('version_id',v_id,'version_no',v_no));
  return v_id;
end $$;

create or replace function public.publish_question_version(p_question_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_type public.question_type; v_version uuid; v_option_count integer; v_key jsonb;
begin
  perform app.require_assessment_author();
  select q.current_version_id,qv.question_type into v_version,v_type from public.questions q join public.question_versions qv on qv.id=q.current_version_id where q.id=p_question_id and (q.owner_id=auth.uid() or app.is_super_admin()) for update of q;
  if v_version is null then raise exception 'Câu hỏi chưa có phiên bản'; end if;
  select count(*) into v_option_count from public.question_options where question_version_id=v_version;
  select answer_key into v_key from public.question_answer_keys where question_version_id=v_version;
  if v_key is null or v_key='{}'::jsonb then raise exception 'Câu hỏi thiếu đáp án'; end if;
  if v_type in ('single_choice','multiple_choice','listening_choice') and v_option_count<2 then raise exception 'Câu trắc nghiệm cần ít nhất hai lựa chọn'; end if;
  update public.questions set status='ready',updated_at=now() where id=p_question_id;
end $$;

create or replace function public.submit_question_for_global_review(p_question_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform app.require_assessment_author();
  if not exists(select 1 from public.questions where id=p_question_id and owner_id=auth.uid() and status='ready') then raise exception 'Câu hỏi chưa sẵn sàng hoặc không thuộc sở hữu'; end if;
  update public.questions set visibility='pending_global_review' where id=p_question_id;
  insert into public.question_review_requests(question_id,submitted_by) values(p_question_id,auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.review_global_question(p_request_id uuid,p_approve boolean,p_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_question uuid;
begin
  if not app.is_active() or not app.is_super_admin() then raise exception 'Chỉ Super Admin được duyệt'; end if;
  select question_id into v_question from public.question_review_requests where id=p_request_id and status='pending' for update;
  if v_question is null then raise exception 'Yêu cầu không còn chờ duyệt'; end if;
  update public.question_review_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),review_reason=p_reason,reviewed_at=now() where id=p_request_id;
  update public.questions set visibility=case when p_approve then 'global'::public.question_visibility else 'rejected'::public.question_visibility end where id=v_question;
end $$;

create or replace function public.create_question_set_version(p_question_set_id uuid,p_title text,p_instructions text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_no integer;
begin
  perform app.require_assessment_author();
  if not exists(select 1 from public.question_sets where id=p_question_set_id and (owner_id=auth.uid() or app.is_super_admin())) then raise exception 'Không tìm thấy bộ câu hỏi'; end if;
  select coalesce(max(version_no),0)+1 into v_no from public.question_set_versions where question_set_id=p_question_set_id;
  insert into public.question_set_versions(question_set_id,version_no,title_snapshot,instructions_snapshot,created_by)
  values(p_question_set_id,v_no,trim(p_title),p_instructions,auth.uid()) returning id into v_id;
  update public.question_sets set current_version_id=v_id,status='draft' where id=p_question_set_id;
  return v_id;
end $$;

create or replace function public.lock_question_set_version(p_set_version_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_total numeric; v_count integer;
begin
  perform app.require_assessment_author();
  if not exists(select 1 from public.question_set_versions sv join public.question_sets s on s.id=sv.question_set_id where sv.id=p_set_version_id and (s.owner_id=auth.uid() or app.is_super_admin())) then raise exception 'Không tìm thấy phiên bản bộ'; end if;
  select count(*),coalesce(sum(points),0) into v_count,v_total from public.question_set_items where set_version_id=p_set_version_id;
  if v_count=0 or v_total<=0 then raise exception 'Bộ phải có câu hỏi và tổng điểm lớn hơn 0'; end if;
  if exists(select 1 from public.question_set_items i left join public.question_answer_keys k on k.question_version_id=i.question_version_id where i.set_version_id=p_set_version_id and k.question_version_id is null) then raise exception 'Bộ có câu thiếu đáp án'; end if;
  update public.question_set_versions set raw_max_score=v_total,locked_at=clock_timestamp() where id=p_set_version_id and locked_at is null;
  update public.question_sets s set status='ready' where current_version_id=p_set_version_id;
end $$;

create or replace function app.auto_score_answer(p_item_id uuid,p_payload jsonb)
returns table(score numeric,is_correct boolean,manual_required boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_points numeric; v_type public.question_type; v_key jsonb; v_config jsonb; v_ok boolean; v_correct_count integer; v_selected_correct integer; v_selected_wrong integer;
begin
  select i.points,qv.question_type,k.answer_key,k.grading_config into v_points,v_type,v_key,v_config
  from public.question_set_items i join public.question_versions qv on qv.id=i.question_version_id join public.question_answer_keys k on k.question_version_id=qv.id where i.id=p_item_id;
  if v_type='essay_translation' then return query select null::numeric,null::boolean,true; return; end if;
  if v_type='multiple_choice' then
    select count(*) into v_correct_count from jsonb_array_elements_text(coalesce(v_key->'values','[]'::jsonb));
    select count(*) into v_selected_correct from jsonb_array_elements_text(coalesce(p_payload->'values','[]'::jsonb)) s where exists(select 1 from jsonb_array_elements_text(coalesce(v_key->'values','[]'::jsonb)) k where k.value=s.value);
    select count(*) into v_selected_wrong from jsonb_array_elements_text(coalesce(p_payload->'values','[]'::jsonb)) s where not exists(select 1 from jsonb_array_elements_text(coalesce(v_key->'values','[]'::jsonb)) k where k.value=s.value);
    v_ok := v_correct_count>0 and v_selected_correct=v_correct_count and v_selected_wrong=0;
    if coalesce(v_config->>'scoring_mode','all_or_nothing')='partial_credit' then
      return query select greatest(0,round(v_points*(v_selected_correct::numeric/greatest(v_correct_count,1))*(case when v_selected_wrong>0 and coalesce((v_config->>'wrong_selection_zero')::boolean,false) then 0 else 1 end),2)),v_ok,false;
    else return query select case when v_ok then v_points else 0 end,v_ok,false; end if;
    return;
  end if;
  if v_type in ('fill_blank','short_text','dictation') then
    v_ok := exists(select 1 from jsonb_array_elements_text(coalesce(v_key->'accepted','[]'::jsonb)) a where lower(regexp_replace(trim(a.value),'[[:space:][:punct:]]','','g'))=lower(regexp_replace(trim(coalesce(p_payload->>'value','')),'[[:space:][:punct:]]','','g')));
  else v_ok := coalesce(p_payload->'value','null'::jsonb)=coalesce(v_key->'value','null'::jsonb); end if;
  return query select case when v_ok then v_points else 0 end,v_ok,false;
end $$;

create or replace function public.create_exercise_delivery(p_class_id uuid,p_set_version_id uuid,p_title text,p_available_from timestamptz,p_due_at timestamptz,p_max_score numeric,p_attempt_limit integer default 1,p_allow_late boolean default false,p_late_penalty numeric default 0,p_result_release public.result_release_mode default 'manual',p_answer_release public.answer_release_mode default 'with_results')
returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid;
begin
  perform app.require_assessment_author();
  if not app.is_super_admin() and not app.teaches_class(p_class_id) then raise exception 'Không phụ trách lớp này'; end if;
  if not exists(select 1 from public.question_set_versions sv join public.question_sets s on s.id=sv.question_set_id where sv.id=p_set_version_id and sv.locked_at is not null and s.kind='exercise') then raise exception 'Bộ bài tập chưa được khóa'; end if;
  insert into public.exercise_deliveries(class_id,set_version_id,title,available_from,due_at,max_score,attempt_limit,allow_late_submission,late_penalty_percent,result_release_mode,answer_release_mode,created_by)
  values(p_class_id,p_set_version_id,trim(p_title),p_available_from,p_due_at,p_max_score,p_attempt_limit,p_allow_late,p_late_penalty,p_result_release,p_answer_release,auth.uid()) returning id into v_id; return v_id;
end $$;

create or replace function public.publish_exercise_delivery(p_delivery_id uuid)
returns void language plpgsql security definer set search_path='' as $$ declare v_class uuid;
begin perform app.require_assessment_author(); select class_id into v_class from public.exercise_deliveries where id=p_delivery_id for update; if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không tìm thấy lần giao'; end if;
update public.exercise_deliveries set status=case when available_from>clock_timestamp() then 'scheduled' else 'open' end,published_at=clock_timestamp() where id=p_delivery_id and status='draft';
insert into public.notifications(user_id,type,title,body,link,resource_type,resource_id,dedupe_key)
select s.user_id,'exercise_assigned','Bài tập mới',d.title,'/student/exercises/'||d.id,'exercise_delivery',d.id,'exercise-assigned:'||d.id
from public.exercise_deliveries d join public.enrollments e on e.class_id=d.class_id and e.status in ('active','paused') join public.students s on s.id=e.student_id where d.id=p_delivery_id and s.user_id is not null on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
end $$;

create or replace function public.start_exercise_attempt(p_delivery_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$ declare v_delivery public.exercise_deliveries; v_enrollment uuid; v_existing uuid; v_no integer;
begin
  if not app.is_active() or app.current_role()<>'student' then raise exception 'Không có quyền làm bài'; end if;
  select * into v_delivery from public.exercise_deliveries where id=p_delivery_id for update;
  if v_delivery.id is null or v_delivery.status not in ('scheduled','open','closed','grading','results_published') or clock_timestamp()<v_delivery.available_from or (clock_timestamp()>v_delivery.due_at and not v_delivery.allow_late_submission) then raise exception 'Bài tập chưa mở hoặc đã quá hạn'; end if;
  select e.id into v_enrollment from public.enrollments e where e.class_id=v_delivery.class_id and e.student_id=app.my_student_id() and e.status in ('active','paused') order by e.created_at desc limit 1;
  if v_enrollment is null then raise exception 'Không có ghi danh hợp lệ'; end if;
  select id into v_existing from public.exercise_attempts where delivery_id=p_delivery_id and enrollment_id=v_enrollment and status in ('in_progress','returned_for_revision') order by attempt_no desc limit 1;
  if v_existing is not null then return v_existing; end if;
  select coalesce(max(attempt_no),0)+1 into v_no from public.exercise_attempts where delivery_id=p_delivery_id and enrollment_id=v_enrollment;
  if v_no>v_delivery.attempt_limit then raise exception 'Đã hết lượt làm'; end if;
  insert into public.exercise_attempts(delivery_id,enrollment_id,attempt_no,is_late) values(p_delivery_id,v_enrollment,v_no,clock_timestamp()>v_delivery.due_at) returning id into v_existing; return v_existing;
end $$;

create or replace function public.save_exercise_answer(p_attempt_id uuid,p_set_item_id uuid,p_answer_payload jsonb)
returns timestamptz language plpgsql security definer set search_path='' as $$ declare v_due timestamptz; v_late boolean; v_owner boolean;
begin
  if not app.is_active() or app.current_role()<>'student' then raise exception 'Không có quyền lưu câu trả lời'; end if;
  select d.due_at,d.allow_late_submission,(e.student_id=app.my_student_id()) into v_due,v_late,v_owner from public.exercise_attempts a join public.exercise_deliveries d on d.id=a.delivery_id join public.enrollments e on e.id=a.enrollment_id where a.id=p_attempt_id and a.status in ('in_progress','returned_for_revision');
  if not coalesce(v_owner,false) or (clock_timestamp()>v_due and not v_late) then raise exception 'Lượt làm đã khóa'; end if;
  if not exists(select 1 from public.exercise_attempts a join public.exercise_deliveries d on d.id=a.delivery_id join public.question_set_items i on i.set_version_id=d.set_version_id where a.id=p_attempt_id and i.id=p_set_item_id) then raise exception 'Câu hỏi không thuộc lượt làm'; end if;
  insert into public.exercise_answers(attempt_id,set_item_id,answer_payload,saved_at) values(p_attempt_id,p_set_item_id,p_answer_payload,clock_timestamp()) on conflict(attempt_id,set_item_id) do update set answer_payload=excluded.answer_payload,saved_at=excluded.saved_at,auto_score=null,manual_score=null,final_score=null,graded_by=null,graded_at=null;
  return clock_timestamp();
end $$;

create or replace function public.submit_exercise_attempt(p_attempt_id uuid)
returns public.attempt_status language plpgsql security definer set search_path='' as $$ declare v_attempt public.exercise_attempts; v_delivery public.exercise_deliveries; v_item record; v_score numeric; v_correct boolean; v_manual boolean; v_raw numeric:=0; v_has_manual boolean:=false; v_raw_max numeric;
begin
  select * into v_attempt from public.exercise_attempts where id=p_attempt_id for update;
  if v_attempt.id is null then raise exception 'Không tìm thấy lượt làm'; end if;
  if v_attempt.status in ('submitted','pending_manual_grading','graded') then return v_attempt.status; end if;
  if not exists(select 1 from public.enrollments e where e.id=v_attempt.enrollment_id and e.student_id=app.my_student_id()) then raise exception 'Không có quyền nộp lượt làm'; end if;
  select * into v_delivery from public.exercise_deliveries where id=v_attempt.delivery_id;
  if clock_timestamp()>v_delivery.due_at and not v_delivery.allow_late_submission then raise exception 'Đã quá hạn nộp'; end if;
  for v_item in select i.id,coalesce(a.answer_payload,'{}'::jsonb) payload from public.question_set_items i left join public.exercise_answers a on a.set_item_id=i.id and a.attempt_id=p_attempt_id where i.set_version_id=v_delivery.set_version_id loop
    select * into v_score,v_correct,v_manual from app.auto_score_answer(v_item.id,v_item.payload);
    insert into public.exercise_answers(attempt_id,set_item_id,answer_payload,auto_score,final_score,is_correct) values(p_attempt_id,v_item.id,v_item.payload,v_score,v_score,v_correct) on conflict(attempt_id,set_item_id) do update set auto_score=excluded.auto_score,final_score=excluded.final_score,is_correct=excluded.is_correct;
    v_raw:=v_raw+coalesce(v_score,0); v_has_manual:=v_has_manual or v_manual;
  end loop;
  select raw_max_score into v_raw_max from public.question_set_versions where id=v_delivery.set_version_id;
  update public.exercise_attempts set status=case when v_has_manual then 'pending_manual_grading' else 'graded' end,submitted_at=clock_timestamp(),is_late=clock_timestamp()>v_delivery.due_at,raw_score=v_raw,final_score=round((v_raw/nullif(v_raw_max,0))*v_delivery.max_score*(case when clock_timestamp()>v_delivery.due_at then 1-v_delivery.late_penalty_percent/100 else 1 end),2),graded_at=case when not v_has_manual then clock_timestamp() else null end where id=p_attempt_id returning status into v_attempt.status;
  return v_attempt.status;
end $$;

create or replace function public.grade_exercise_answer(p_answer_id uuid,p_score numeric,p_feedback text default null,p_override_reason text default null)
returns void language plpgsql security definer set search_path='' as $$ declare v_class uuid; v_points numeric; v_attempt uuid;
begin perform app.require_assessment_author(); select d.class_id,i.points,a.attempt_id into v_class,v_points,v_attempt from public.exercise_answers a join public.exercise_attempts ea on ea.id=a.attempt_id join public.exercise_deliveries d on d.id=ea.delivery_id join public.question_set_items i on i.id=a.set_item_id where a.id=p_answer_id; if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không có quyền chấm'; end if; if p_score<0 or p_score>v_points then raise exception 'Điểm vượt giới hạn câu'; end if;
update public.exercise_answers set manual_score=p_score,final_score=p_score,feedback=p_feedback,override_reason=p_override_reason,graded_by=auth.uid(),graded_at=clock_timestamp() where id=p_answer_id;
update public.exercise_attempts ea set raw_score=x.total,final_score=round(x.total/nullif(sv.raw_max_score,0)*d.max_score,2),status=case when x.pending=0 then 'graded' else 'pending_manual_grading' end,graded_at=case when x.pending=0 then clock_timestamp() else null end from (select attempt_id,sum(coalesce(final_score,0)) total,count(*) filter(where final_score is null) pending from public.exercise_answers where attempt_id=v_attempt group by attempt_id)x,public.exercise_deliveries d,public.question_set_versions sv where ea.id=v_attempt and d.id=ea.delivery_id and sv.id=d.set_version_id;
end $$;

create or replace function public.publish_exercise_results(p_delivery_id uuid)
returns integer language plpgsql security definer set search_path='' as $$ declare v_class uuid; v_count integer;
begin perform app.require_assessment_author(); select class_id into v_class from public.exercise_deliveries where id=p_delivery_id for update; if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không có quyền công bố'; end if; if exists(select 1 from public.exercise_attempts where delivery_id=p_delivery_id and status='pending_manual_grading') then raise exception 'Còn câu chưa chấm'; end if;
update public.exercise_attempts set results_published_at=clock_timestamp() where delivery_id=p_delivery_id and status='graded' and results_published_at is null; get diagnostics v_count=row_count; update public.exercise_deliveries set status='results_published' where id=p_delivery_id; return v_count;
end $$;

create or replace function public.create_exam_delivery(p_class_id uuid,p_set_version_id uuid,p_title text,p_exam_type public.assessment_type,p_opens_at timestamptz,p_closes_at timestamptz,p_duration_minutes integer,p_passing_score numeric default null)
returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid;
begin perform app.require_assessment_author(); if not app.is_super_admin() and not app.teaches_class(p_class_id) then raise exception 'Không phụ trách lớp này'; end if; if not exists(select 1 from public.question_set_versions sv join public.question_sets s on s.id=sv.question_set_id where sv.id=p_set_version_id and sv.locked_at is not null and s.kind='exam') then raise exception 'Bộ đề chưa được khóa'; end if;
insert into public.exam_deliveries(class_id,set_version_id,title,exam_type,opens_at,closes_at,duration_minutes,passing_score,created_by) values(p_class_id,p_set_version_id,trim(p_title),p_exam_type,p_opens_at,p_closes_at,p_duration_minutes,p_passing_score,auth.uid()) returning id into v_id; return v_id; end $$;

create or replace function public.publish_exam_delivery(p_delivery_id uuid)
returns void language plpgsql security definer set search_path='' as $$ declare v_class uuid;
begin perform app.require_assessment_author(); select class_id into v_class from public.exam_deliveries where id=p_delivery_id for update; if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không tìm thấy kỳ thi'; end if; update public.exam_deliveries set status='scheduled',published_at=clock_timestamp() where id=p_delivery_id and status='draft'; end $$;

create or replace function public.start_exam_attempt(p_exam_delivery_id uuid)
returns table(attempt_id uuid,server_time timestamptz,deadline_at timestamptz) language plpgsql security definer set search_path='' as $$ declare v_delivery public.exam_deliveries; v_enrollment uuid; v_id uuid; v_now timestamptz:=clock_timestamp(); v_deadline timestamptz;
begin if not app.is_active() or app.current_role()<>'student' then raise exception 'Không có quyền bắt đầu thi'; end if; select * into v_delivery from public.exam_deliveries where id=p_exam_delivery_id for update; if v_delivery.id is null or v_delivery.status not in ('scheduled','open') or v_now<v_delivery.opens_at or v_now>=v_delivery.closes_at then raise exception 'Kỳ thi chưa mở hoặc đã đóng'; end if; select e.id into v_enrollment from public.enrollments e where e.class_id=v_delivery.class_id and e.student_id=app.my_student_id() and e.status='active' order by e.created_at desc limit 1; if v_enrollment is null then raise exception 'Không có ghi danh hợp lệ'; end if; select id,exam_attempts.deadline_at into v_id,v_deadline from public.exam_attempts where exam_delivery_id=p_exam_delivery_id and enrollment_id=v_enrollment and status<>'invalidated' for update; if v_id is null then v_deadline:=least(v_now+make_interval(mins=>v_delivery.duration_minutes),v_delivery.closes_at); insert into public.exam_attempts(exam_delivery_id,enrollment_id,started_at,deadline_at) values(p_exam_delivery_id,v_enrollment,v_now,v_deadline) returning id into v_id; insert into public.exam_integrity_events(attempt_id,event_type) values(v_id,'exam_started'); end if; return query select v_id,v_now,v_deadline; end $$;

create or replace function public.save_exam_answer(p_attempt_id uuid,p_set_item_id uuid,p_answer_payload jsonb)
returns timestamptz language plpgsql security definer set search_path='' as $$ declare v_deadline timestamptz; v_owner boolean;
begin if not app.is_active() or app.current_role()<>'student' then raise exception 'Không có quyền lưu'; end if; select a.deadline_at,(e.student_id=app.my_student_id()) into v_deadline,v_owner from public.exam_attempts a join public.enrollments e on e.id=a.enrollment_id where a.id=p_attempt_id and a.status='in_progress' for update of a; if not coalesce(v_owner,false) or clock_timestamp()>=v_deadline then raise exception 'Lượt thi đã hết hạn'; end if; if not exists(select 1 from public.exam_attempts a join public.exam_deliveries d on d.id=a.exam_delivery_id join public.question_set_items i on i.set_version_id=d.set_version_id where a.id=p_attempt_id and i.id=p_set_item_id) then raise exception 'Câu hỏi không thuộc lượt thi'; end if; insert into public.exam_answers(attempt_id,set_item_id,answer_payload,saved_at) values(p_attempt_id,p_set_item_id,p_answer_payload,clock_timestamp()) on conflict(attempt_id,set_item_id) do update set answer_payload=excluded.answer_payload,saved_at=excluded.saved_at; return clock_timestamp(); end $$;

create or replace function public.submit_exam_attempt(p_attempt_id uuid,p_reason public.submission_reason default 'manual')
returns public.attempt_status language plpgsql security definer set search_path='' as $$ declare v_attempt public.exam_attempts; v_delivery public.exam_deliveries; v_item record; v_score numeric; v_correct boolean; v_manual boolean; v_raw numeric:=0; v_has_manual boolean:=false; v_raw_max numeric;
begin select * into v_attempt from public.exam_attempts where id=p_attempt_id for update; if v_attempt.id is null then raise exception 'Không tìm thấy lượt thi'; end if; if v_attempt.status in ('submitted','pending_manual_grading','graded') then return v_attempt.status; end if; if app.current_role()='student' and not exists(select 1 from public.enrollments where id=v_attempt.enrollment_id and student_id=app.my_student_id()) then raise exception 'Không có quyền nộp'; end if; select * into v_delivery from public.exam_deliveries where id=v_attempt.exam_delivery_id;
for v_item in select i.id,coalesce(a.answer_payload,'{}'::jsonb) payload from public.question_set_items i left join public.exam_answers a on a.set_item_id=i.id and a.attempt_id=p_attempt_id where i.set_version_id=v_delivery.set_version_id loop select * into v_score,v_correct,v_manual from app.auto_score_answer(v_item.id,v_item.payload); insert into public.exam_answers(attempt_id,set_item_id,answer_payload,auto_score,final_score,is_correct) values(p_attempt_id,v_item.id,v_item.payload,v_score,v_score,v_correct) on conflict(attempt_id,set_item_id) do update set auto_score=excluded.auto_score,final_score=excluded.final_score,is_correct=excluded.is_correct; v_raw:=v_raw+coalesce(v_score,0); v_has_manual:=v_has_manual or v_manual; end loop;
select raw_max_score into v_raw_max from public.question_set_versions where id=v_delivery.set_version_id; update public.exam_attempts set status=case when v_has_manual then 'pending_manual_grading' else 'graded' end,submitted_at=clock_timestamp(),submission_reason=case when clock_timestamp()>=least(v_attempt.deadline_at,v_delivery.closes_at) and p_reason='manual' then 'duration_expired' else p_reason end,raw_score=v_raw,final_score_100=round(v_raw/nullif(v_raw_max,0)*100,2),graded_at=case when not v_has_manual then clock_timestamp() else null end where id=p_attempt_id returning status into v_attempt.status; return v_attempt.status; end $$;

create or replace function public.finalize_expired_exam_attempts()
returns integer language plpgsql security definer set search_path='' as $$ declare r record; v_count integer:=0;
begin if current_user not in ('postgres','service_role') then raise exception 'Chỉ job hệ thống'; end if; for r in select a.id from public.exam_attempts a join public.exam_deliveries d on d.id=a.exam_delivery_id where a.status='in_progress' and clock_timestamp()>=least(a.deadline_at,d.closes_at) for update of a skip locked loop perform public.submit_exam_attempt(r.id,'system_finalize'); insert into public.exam_integrity_events(attempt_id,event_type) values(r.id,'auto_submitted'); v_count:=v_count+1; end loop; return v_count; end $$;

create or replace function public.log_exam_integrity_event(p_attempt_id uuid,p_event_type text,p_context jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid;
begin if p_event_type not in ('copy_blocked','paste_blocked','cut_blocked','tab_hidden','window_blurred','window_focused','network_offline','network_online','attempt_resumed') or p_context ?| array['clipboard','content','text'] then raise exception 'Sự kiện không hợp lệ'; end if; if not exists(select 1 from public.exam_attempts a join public.enrollments e on e.id=a.enrollment_id where a.id=p_attempt_id and e.student_id=app.my_student_id()) then raise exception 'Không có quyền ghi sự kiện'; end if; insert into public.exam_integrity_events(attempt_id,event_type,client_context) values(p_attempt_id,p_event_type,p_context) returning id into v_id; return v_id; end $$;

create or replace function public.grade_exam_answer(p_answer_id uuid,p_score numeric,p_feedback text default null,p_override_reason text default null)
returns void language plpgsql security definer set search_path='' as $$ declare v_class uuid; v_points numeric;
begin perform app.require_assessment_author(); select d.class_id,i.points into v_class,v_points from public.exam_answers a join public.exam_attempts ea on ea.id=a.attempt_id join public.exam_deliveries d on d.id=ea.exam_delivery_id join public.question_set_items i on i.id=a.set_item_id where a.id=p_answer_id; if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không có quyền chấm'; end if; if p_score<0 or p_score>v_points then raise exception 'Điểm vượt giới hạn câu'; end if; update public.exam_answers set manual_score=p_score,final_score=p_score,feedback=p_feedback,override_reason=p_override_reason,graded_by=auth.uid(),graded_at=clock_timestamp() where id=p_answer_id; end $$;

create or replace function public.lock_exam_results(p_delivery_id uuid)
returns void language plpgsql security definer set search_path='' as $$ declare v_class uuid;
begin perform app.require_assessment_author(); select class_id into v_class from public.exam_deliveries where id=p_delivery_id for update; if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không có quyền khóa điểm'; end if; if exists(select 1 from public.exam_attempts where exam_delivery_id=p_delivery_id and status='pending_manual_grading') then raise exception 'Còn câu chưa chấm'; end if; update public.exam_deliveries set status='grading' where id=p_delivery_id; end $$;

create or replace function public.publish_exam_results(p_delivery_id uuid)
returns integer language plpgsql security definer set search_path='' as $$ declare v_class uuid;v_count integer;
begin perform app.require_assessment_author(); select class_id into v_class from public.exam_deliveries where id=p_delivery_id for update; if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không có quyền công bố'; end if; if exists(select 1 from public.exam_attempts where exam_delivery_id=p_delivery_id and status='pending_manual_grading') then raise exception 'Còn câu chưa chấm'; end if; update public.exam_deliveries set status='results_published',results_published_at=clock_timestamp() where id=p_delivery_id; get diagnostics v_count=row_count; return v_count; end $$;

create or replace function public.invalidate_exam_attempt(p_attempt_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$ begin if not app.is_active() or not app.is_super_admin() then raise exception 'Chỉ Super Admin'; end if; update public.exam_attempts set status='invalidated',invalidated_at=clock_timestamp(),invalidated_reason=nullif(trim(p_reason),'') where id=p_attempt_id and status<>'invalidated'; if not found then raise exception 'Không tìm thấy lượt thi hợp lệ'; end if; perform app.write_audit('exam.attempt.invalidate','exam_attempt',p_attempt_id,null,jsonb_build_object('reason',p_reason)); end $$;

create or replace function public.run_exam_regrade(p_delivery_id uuid,p_reason text,p_rule_override jsonb)
returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid;v_class uuid;
begin perform app.require_assessment_author(); select class_id into v_class from public.exam_deliveries where id=p_delivery_id; if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không có quyền chấm lại'; end if; insert into public.exam_regrade_runs(exam_delivery_id,reason,rule_override,started_by,status,completed_at) values(p_delivery_id,p_reason,p_rule_override,auth.uid(),'completed',clock_timestamp()) returning id into v_id; perform app.write_audit('exam.regrade','exam_delivery',p_delivery_id,null,jsonb_build_object('run_id',v_id,'reason',p_reason)); return v_id; end $$;

do $$ declare r record; begin
  for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_question_version','publish_question_version','submit_question_for_global_review','review_global_question','create_question_set_version','lock_question_set_version','create_exercise_delivery','publish_exercise_delivery','start_exercise_attempt','save_exercise_answer','submit_exercise_attempt','grade_exercise_answer','publish_exercise_results','create_exam_delivery','publish_exam_delivery','start_exam_attempt','save_exam_answer','submit_exam_attempt','finalize_expired_exam_attempts','log_exam_integrity_event','grade_exam_answer','lock_exam_results','publish_exam_results','invalidate_exam_attempt','run_exam_regrade') loop
    execute format('revoke all on function %s from public, anon',r.signature);
    execute format('grant execute on function %s to authenticated',r.signature);
  end loop;
end $$;
revoke all on function public.finalize_expired_exam_attempts() from authenticated;
grant execute on function public.finalize_expired_exam_attempts() to service_role;
revoke all on function app.require_assessment_author() from public,anon,authenticated;
revoke all on function app.auto_score_answer(uuid,jsonb) from public,anon,authenticated;
