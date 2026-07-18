-- 60 — Lên lịch một bộ đề cho nhiều lớp, mỗi lớp một kỳ thi trong cùng transaction.

create or replace function public.create_multi_class_exam_deliveries(
  p_class_ids uuid[],
  p_set_version_id uuid,
  p_title text,
  p_exam_type public.assessment_type,
  p_opens_at timestamptz,
  p_closes_at timestamptz,
  p_duration_minutes integer,
  p_passing_score numeric default null,
  p_answer_release_mode public.answer_release_mode default 'never',
  p_publish boolean default true
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_delivery_id uuid;
  v_delivery_ids uuid[] := '{}';
begin
  perform app.require_assessment_author();

  if coalesce(array_length(p_class_ids, 1), 0) = 0 then
    raise exception 'Phải chọn ít nhất một lớp';
  end if;

  for v_class_id in select distinct unnest(p_class_ids)
  loop
    v_delivery_id := public.create_exam_delivery(
      v_class_id,
      p_set_version_id,
      p_title,
      p_exam_type,
      p_opens_at,
      p_closes_at,
      p_duration_minutes,
      p_passing_score
    );

    update public.exam_deliveries
    set answer_release_mode = p_answer_release_mode
    where id = v_delivery_id;

    if p_publish then
      perform public.publish_exam_delivery(v_delivery_id);
    end if;

    v_delivery_ids := array_append(v_delivery_ids, v_delivery_id);
  end loop;

  return v_delivery_ids;
end;
$$;

revoke all on function public.create_multi_class_exam_deliveries(
  uuid[], uuid, text, public.assessment_type, timestamptz, timestamptz,
  integer, numeric, public.answer_release_mode, boolean
) from public, anon;
grant execute on function public.create_multi_class_exam_deliveries(
  uuid[], uuid, text, public.assessment_type, timestamptz, timestamptz,
  integer, numeric, public.answer_release_mode, boolean
) to authenticated;
