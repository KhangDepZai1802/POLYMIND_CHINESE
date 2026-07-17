-- 46 — Giao một bộ cho nhiều lớp, mỗi lớp một delivery trong cùng transaction

create or replace function public.create_multi_class_exercise_deliveries(
  p_class_ids uuid[],p_set_version_id uuid,p_title text,p_available_from timestamptz,p_due_at timestamptz,
  p_max_score numeric,p_attempt_limit integer,p_allow_late boolean,p_late_penalty numeric,p_publish boolean default true
)
returns uuid[] language plpgsql security definer set search_path='' as $$
declare v_class uuid; v_id uuid; v_ids uuid[] := '{}';
begin
  perform app.require_assessment_author();
  if coalesce(array_length(p_class_ids,1),0)=0 then raise exception 'Phải chọn ít nhất một lớp'; end if;
  foreach v_class in array p_class_ids loop
    v_id := public.create_exercise_delivery(v_class,p_set_version_id,p_title,p_available_from,p_due_at,p_max_score,p_attempt_limit,p_allow_late,p_late_penalty);
    if p_publish then perform public.publish_exercise_delivery(v_id); end if;
    v_ids := array_append(v_ids,v_id);
  end loop;
  return v_ids;
end $$;
revoke all on function public.create_multi_class_exercise_deliveries(uuid[],uuid,text,timestamptz,timestamptz,numeric,integer,boolean,numeric,boolean) from public,anon;
grant execute on function public.create_multi_class_exercise_deliveries(uuid[],uuid,text,timestamptz,timestamptz,numeric,integer,boolean,numeric,boolean) to authenticated;
