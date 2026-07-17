-- 48 — Khóa điểm là gate bắt buộc trước khi công bố kỳ thi

create or replace function public.lock_exam_results(p_delivery_id uuid)
returns void language plpgsql security definer set search_path='' as $$ declare v_class uuid;
begin
  perform app.require_assessment_author();
  select class_id into v_class from public.exam_deliveries where id=p_delivery_id for update;
  if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không có quyền khóa điểm'; end if;
  if exists(select 1 from public.exam_attempts where exam_delivery_id=p_delivery_id and status in ('in_progress','pending_manual_grading')) then raise exception 'Còn lượt thi chưa nộp hoặc câu chưa chấm'; end if;
  update public.exam_deliveries set status='grading' where id=p_delivery_id and status<>'results_published';
end $$;

create or replace function public.publish_exam_results(p_delivery_id uuid)
returns integer language plpgsql security definer set search_path='' as $$ declare v_class uuid;v_status public.exam_delivery_status;v_count integer;
begin
  perform app.require_assessment_author();
  select class_id,status into v_class,v_status from public.exam_deliveries where id=p_delivery_id for update;
  if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không có quyền công bố'; end if;
  if v_status='results_published' then return 0; end if;
  if v_status<>'grading' then raise exception 'Phải khóa điểm trước khi công bố'; end if;
  update public.exam_deliveries set status='results_published',results_published_at=clock_timestamp() where id=p_delivery_id;
  get diagnostics v_count=row_count;
  insert into public.notifications(user_id,type,title,body,link,resource_type,resource_id,dedupe_key)
  select s.user_id,'exam_result_published','Kết quả kỳ thi',d.title,'/student/exams','exam_delivery',d.id,'exam-result:'||d.id
  from public.exam_deliveries d join public.enrollments e on e.class_id=d.class_id and e.status in ('active','paused') join public.students s on s.id=e.student_id
  where d.id=p_delivery_id and s.user_id is not null on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
  return v_count;
end $$;

revoke all on function public.lock_exam_results(uuid) from public,anon;
revoke all on function public.publish_exam_results(uuid) from public,anon;
grant execute on function public.lock_exam_results(uuid) to authenticated;
grant execute on function public.publish_exam_results(uuid) to authenticated;
