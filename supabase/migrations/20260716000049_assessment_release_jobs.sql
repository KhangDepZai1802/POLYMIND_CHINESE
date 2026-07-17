-- 49 — Release mode bài tập, cron tổng hợp, thông báo lịch thi và xếp loại

create or replace function public.consume_rate_limit(p_scope text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid();v_limit integer;v_window_seconds integer;v_window_start timestamptz;v_count integer;
begin
  if v_user_id is null then return false; end if;
  case p_scope
    when 'material_upload' then v_limit:=20;v_window_seconds:=3600;
    when 'assignment_upload' then v_limit:=20;v_window_seconds:=3600;
    when 'submission_upload' then v_limit:=20;v_window_seconds:=3600;
    when 'report_export' then v_limit:=10;v_window_seconds:=60;
    when 'question_import' then v_limit:=5;v_window_seconds:=3600;
    when 'question_media' then v_limit:=30;v_window_seconds:=3600;
    when 'exam_integrity' then v_limit:=600;v_window_seconds:=60;
    else return false;
  end case;
  v_window_start:=to_timestamp(floor(extract(epoch from clock_timestamp())/v_window_seconds)*v_window_seconds);
  insert into app.rate_limit_windows(user_id,scope,window_start,request_count) values(v_user_id,p_scope,v_window_start,1)
  on conflict(user_id,scope,window_start) do update set request_count=app.rate_limit_windows.request_count+1 returning request_count into v_count;
  return v_count<=v_limit;
end $$;

create or replace function public.log_exam_integrity_event(p_attempt_id uuid,p_event_type text,p_context jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid;
begin
  if not public.consume_rate_limit('exam_integrity') then raise exception 'Quá nhiều sự kiện'; end if;
  if p_event_type not in ('copy_blocked','paste_blocked','cut_blocked','tab_hidden','window_blurred','window_focused','network_offline','network_online','attempt_resumed') or p_context ?| array['clipboard','content','text'] then raise exception 'Sự kiện không hợp lệ'; end if;
  if not exists(select 1 from public.exam_attempts a join public.enrollments e on e.id=a.enrollment_id where a.id=p_attempt_id and e.student_id=app.my_student_id()) then raise exception 'Không có quyền ghi sự kiện'; end if;
  insert into public.exam_integrity_events(attempt_id,event_type,client_context) values(p_attempt_id,p_event_type,p_context) returning id into v_id; return v_id;
end $$;

create or replace function app.release_immediate_exercise_result()
returns trigger language plpgsql security definer set search_path='' as $$ declare v_delivery public.exercise_deliveries;v_user uuid;
begin
  if new.status='graded' and old.status is distinct from 'graded' then
    select * into v_delivery from public.exercise_deliveries where id=new.delivery_id;
    if v_delivery.result_release_mode='immediate' then
      update public.exercise_attempts set results_published_at=clock_timestamp() where id=new.id and results_published_at is null;
      select s.user_id into v_user from public.enrollments e join public.students s on s.id=e.student_id where e.id=new.enrollment_id;
      if v_user is not null then insert into public.notifications(user_id,type,title,body,link,resource_type,resource_id,dedupe_key)
        values(v_user,'exercise_result_published','Kết quả bài tập',v_delivery.title,'/student/exercises','exercise_delivery',v_delivery.id,'exercise-result:'||v_delivery.id||':'||new.id)
        on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing; end if;
    end if;
  end if;
  return new;
end $$;
create trigger trg_exercise_result_immediate after update of status on public.exercise_attempts for each row execute function app.release_immediate_exercise_result();

create or replace function app.finalize_due_exercise_results()
returns integer language plpgsql security definer set search_path='' as $$ declare v_count integer;
begin
  update public.exercise_attempts a set results_published_at=clock_timestamp()
  from public.exercise_deliveries d where d.id=a.delivery_id and d.result_release_mode='after_due' and clock_timestamp()>=d.due_at and a.status='graded' and a.results_published_at is null;
  get diagnostics v_count=row_count;
  insert into public.notifications(user_id,type,title,body,link,resource_type,resource_id,dedupe_key)
  select s.user_id,'exercise_result_published','Kết quả bài tập',d.title,'/student/exercises','exercise_delivery',d.id,'exercise-result:'||d.id||':'||a.id
  from public.exercise_attempts a join public.exercise_deliveries d on d.id=a.delivery_id join public.enrollments e on e.id=a.enrollment_id join public.students s on s.id=e.student_id
  where a.results_published_at is not null and d.result_release_mode='after_due' and s.user_id is not null
  on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
  return v_count;
end $$;

create or replace function public.finalize_assessment_attempts()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if current_user not in ('postgres','service_role') then raise exception 'Chỉ job hệ thống'; end if;
  return jsonb_build_object('exam_attempts',public.finalize_expired_exam_attempts(),'exercise_results',app.finalize_due_exercise_results());
end $$;

create or replace function public.publish_exam_delivery(p_delivery_id uuid)
returns void language plpgsql security definer set search_path='' as $$ declare v_class uuid;
begin
  perform app.require_assessment_author(); select class_id into v_class from public.exam_deliveries where id=p_delivery_id for update;
  if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không tìm thấy kỳ thi'; end if;
  update public.exam_deliveries set status='scheduled',published_at=clock_timestamp() where id=p_delivery_id and status='draft';
  insert into public.notifications(user_id,type,title,body,link,resource_type,resource_id,dedupe_key)
  select s.user_id,'exam_scheduled','Lịch kỳ thi mới',d.title,'/student/exams','exam_delivery',d.id,'exam-scheduled:'||d.id
  from public.exam_deliveries d join public.enrollments e on e.class_id=d.class_id and e.status='active' join public.students s on s.id=e.student_id
  where d.id=p_delivery_id and s.user_id is not null on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
end $$;

create or replace function app.recalculate_exam_attempt(p_attempt_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_total numeric;v_pending integer;v_raw_max numeric;v_score numeric;v_rule uuid;
begin
  select coalesce(sum(coalesce(a.final_score,0)),0),count(*) filter(where a.final_score is null),sv.raw_max_score
  into v_total,v_pending,v_raw_max from public.exam_attempts ea join public.exam_deliveries d on d.id=ea.exam_delivery_id join public.question_set_versions sv on sv.id=d.set_version_id left join public.exam_answers a on a.attempt_id=ea.id
  where ea.id=p_attempt_id group by sv.raw_max_score;
  if v_raw_max is null then raise exception 'Không tìm thấy lượt thi'; end if;
  v_score:=round(v_total/nullif(v_raw_max,0)*100,2);
  select id into v_rule from public.grading_scale_rules where is_active and v_score>=min_score and (v_score<max_score or (v_score=100 and max_score=100)) order by order_index limit 1;
  update public.exam_attempts set raw_score=v_total,final_score_100=v_score,classification_rule_id=v_rule,
    status=case when v_pending=0 then 'graded' else 'pending_manual_grading' end,graded_at=case when v_pending=0 then clock_timestamp() else null end where id=p_attempt_id;
end $$;

create or replace function app.assign_exam_classification()
returns trigger language plpgsql security definer set search_path='' as $$ declare v_rule uuid;
begin
  if new.final_score_100 is not null then
    select id into v_rule from public.grading_scale_rules where is_active and new.final_score_100>=min_score and (new.final_score_100<max_score or (new.final_score_100=100 and max_score=100)) order by order_index limit 1;
    update public.exam_attempts set classification_rule_id=v_rule where id=new.id and classification_rule_id is distinct from v_rule;
  end if;
  return new;
end $$;
create trigger trg_exam_attempt_classification after update of final_score_100 on public.exam_attempts for each row execute function app.assign_exam_classification();

revoke all on function app.release_immediate_exercise_result() from public,anon,authenticated;
revoke all on function public.consume_rate_limit(text) from public,anon;
grant execute on function public.consume_rate_limit(text) to authenticated;
revoke all on function public.log_exam_integrity_event(uuid,text,jsonb) from public,anon;
grant execute on function public.log_exam_integrity_event(uuid,text,jsonb) to authenticated;
revoke all on function app.finalize_due_exercise_results() from public,anon,authenticated;
revoke all on function public.finalize_assessment_attempts() from public,anon,authenticated;
grant execute on function public.finalize_assessment_attempts() to service_role;
revoke all on function app.recalculate_exam_attempt(uuid) from public,anon,authenticated;
revoke all on function app.assign_exam_classification() from public,anon,authenticated;
