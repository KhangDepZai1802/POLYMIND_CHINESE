-- 56 — Forward-fix: ép kiểu enum cho CASE gán cột `status` trong RPC đánh giá
--
-- BUG (user báo 2026-07-18 khi "giao bài tập"):
--   ERROR: column "status" is of type public.exercise_delivery_status
--          but expression is of type text
--
-- NGUYÊN NHÂN: `set status = case when ... then 'scheduled' else 'open' end`.
-- Khi MỌI nhánh của CASE là literal `unknown`, PostgreSQL giải kiểu kết quả CASE
-- thành `text` (§10.5). Không có implicit assignment cast text→enum, nên gán vào
-- cột enum thì lỗi. (So sánh: `save_session_log` từ đầu đã ép `::session_status`
-- nên không dính; các RPC đánh giá viết sau quên ép kiểu.)
--
-- Cùng một lỗi ở 5 hàm — tất cả đều thuộc luồng Bài tập/Thi chưa smoke runtime,
-- nên sẽ hỏng y hệt ngay khi chạy thật. Sửa trọn cả nhóm ở đây:
--   public.publish_exercise_delivery   (giao bài tập — lỗi user gặp)
--   public.submit_exercise_attempt     (học viên nộp bài tập)
--   public.grade_exercise_answer       (giáo viên chấm bài tập)
--   public.submit_exam_attempt         (học viên nộp bài thi)
--   app.recalculate_exam_attempt       (tính lại điểm/xếp loại bài thi)
--
-- Chỉ thêm ép kiểu; phần thân còn lại giữ NGUYÊN so với định nghĩa đang chạy.
-- (`review_global_question` KHÔNG dính vì question_review_requests.status là text;
--  `submit_exam_attempt.submission_reason` KHÔNG dính vì nhánh else `p_reason`
--  đã mang kiểu enum submission_reason.)

create or replace function public.publish_exercise_delivery(p_delivery_id uuid)
returns void language plpgsql security definer set search_path='' as $$ declare v_class uuid;
begin perform app.require_assessment_author(); select class_id into v_class from public.exercise_deliveries where id=p_delivery_id for update; if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không tìm thấy lần giao'; end if;
update public.exercise_deliveries set status=(case when available_from>clock_timestamp() then 'scheduled' else 'open' end)::public.exercise_delivery_status,published_at=clock_timestamp() where id=p_delivery_id and status='draft';
insert into public.notifications(user_id,type,title,body,link,resource_type,resource_id,dedupe_key)
select s.user_id,'exercise_assigned','Bài tập mới',d.title,'/student/exercises/'||d.id,'exercise_delivery',d.id,'exercise-assigned:'||d.id
from public.exercise_deliveries d join public.enrollments e on e.class_id=d.class_id and e.status in ('active','paused') join public.students s on s.id=e.student_id where d.id=p_delivery_id and s.user_id is not null on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
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
  update public.exercise_attempts set status=(case when v_has_manual then 'pending_manual_grading' else 'graded' end)::public.attempt_status,submitted_at=clock_timestamp(),is_late=clock_timestamp()>v_delivery.due_at,raw_score=v_raw,final_score=round((v_raw/nullif(v_raw_max,0))*v_delivery.max_score*(case when clock_timestamp()>v_delivery.due_at then 1-v_delivery.late_penalty_percent/100 else 1 end),2),graded_at=case when not v_has_manual then clock_timestamp() else null end where id=p_attempt_id returning status into v_attempt.status;
  return v_attempt.status;
end $$;

create or replace function public.grade_exercise_answer(p_answer_id uuid,p_score numeric,p_feedback text default null,p_override_reason text default null)
returns void language plpgsql security definer set search_path='' as $$ declare v_class uuid; v_points numeric; v_attempt uuid;
begin perform app.require_assessment_author(); select d.class_id,i.points,a.attempt_id into v_class,v_points,v_attempt from public.exercise_answers a join public.exercise_attempts ea on ea.id=a.attempt_id join public.exercise_deliveries d on d.id=ea.delivery_id join public.question_set_items i on i.id=a.set_item_id where a.id=p_answer_id; if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then raise exception 'Không có quyền chấm'; end if; if p_score<0 or p_score>v_points then raise exception 'Điểm vượt giới hạn câu'; end if;
update public.exercise_answers set manual_score=p_score,final_score=p_score,feedback=p_feedback,override_reason=p_override_reason,graded_by=auth.uid(),graded_at=clock_timestamp() where id=p_answer_id;
update public.exercise_attempts ea set raw_score=x.total,final_score=round(x.total/nullif(sv.raw_max_score,0)*d.max_score,2),status=(case when x.pending=0 then 'graded' else 'pending_manual_grading' end)::public.attempt_status,graded_at=case when x.pending=0 then clock_timestamp() else null end from (select attempt_id,sum(coalesce(final_score,0)) total,count(*) filter(where final_score is null) pending from public.exercise_answers where attempt_id=v_attempt group by attempt_id)x,public.exercise_deliveries d,public.question_set_versions sv where ea.id=v_attempt and d.id=ea.delivery_id and sv.id=d.set_version_id;
end $$;

create or replace function public.submit_exam_attempt(p_attempt_id uuid,p_reason public.submission_reason default 'manual')
returns public.attempt_status language plpgsql security definer set search_path='' as $$ declare v_attempt public.exam_attempts; v_delivery public.exam_deliveries; v_item record; v_score numeric; v_correct boolean; v_manual boolean; v_raw numeric:=0; v_has_manual boolean:=false; v_raw_max numeric;
begin select * into v_attempt from public.exam_attempts where id=p_attempt_id for update; if v_attempt.id is null then raise exception 'Không tìm thấy lượt thi'; end if; if v_attempt.status in ('submitted','pending_manual_grading','graded') then return v_attempt.status; end if; if app.current_role()='student' and not exists(select 1 from public.enrollments where id=v_attempt.enrollment_id and student_id=app.my_student_id()) then raise exception 'Không có quyền nộp'; end if; select * into v_delivery from public.exam_deliveries where id=v_attempt.exam_delivery_id;
for v_item in select i.id,coalesce(a.answer_payload,'{}'::jsonb) payload from public.question_set_items i left join public.exam_answers a on a.set_item_id=i.id and a.attempt_id=p_attempt_id where i.set_version_id=v_delivery.set_version_id loop select * into v_score,v_correct,v_manual from app.auto_score_answer(v_item.id,v_item.payload); insert into public.exam_answers(attempt_id,set_item_id,answer_payload,auto_score,final_score,is_correct) values(p_attempt_id,v_item.id,v_item.payload,v_score,v_score,v_correct) on conflict(attempt_id,set_item_id) do update set auto_score=excluded.auto_score,final_score=excluded.final_score,is_correct=excluded.is_correct; v_raw:=v_raw+coalesce(v_score,0); v_has_manual:=v_has_manual or v_manual; end loop;
select raw_max_score into v_raw_max from public.question_set_versions where id=v_delivery.set_version_id; update public.exam_attempts set status=(case when v_has_manual then 'pending_manual_grading' else 'graded' end)::public.attempt_status,submitted_at=clock_timestamp(),submission_reason=case when clock_timestamp()>=least(v_attempt.deadline_at,v_delivery.closes_at) and p_reason='manual' then 'duration_expired' else p_reason end,raw_score=v_raw,final_score_100=round(v_raw/nullif(v_raw_max,0)*100,2),graded_at=case when not v_has_manual then clock_timestamp() else null end where id=p_attempt_id returning status into v_attempt.status; return v_attempt.status; end $$;

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
    status=(case when v_pending=0 then 'graded' else 'pending_manual_grading' end)::public.attempt_status,graded_at=case when v_pending=0 then clock_timestamp() else null end where id=p_attempt_id;
end $$;

revoke all on function app.recalculate_exam_attempt(uuid) from public,anon,authenticated;
