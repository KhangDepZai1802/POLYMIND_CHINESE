-- 42 — Chia sẻ/clone/import transaction và quyền media theo scope câu hỏi/lượt làm

create policy question_shares_teacher_read on public.question_shares for select using (
  shared_by = auth.uid() or shared_with_teacher_id = app.my_teacher_id()
  or exists(select 1 from public.questions q where q.id = question_shares.question_id and q.owner_id = auth.uid())
);
create policy question_reviews_owner_read on public.question_review_requests for select using (
  submitted_by = auth.uid()
  or exists(select 1 from public.questions q where q.id = question_review_requests.question_id and q.owner_id = auth.uid())
);
create policy question_media_teacher_read on public.question_media for select using (
  exists(select 1 from public.question_versions qv join public.questions q on q.id = qv.question_id where qv.id = question_media.question_version_id)
);
create policy question_media_owner_write on public.question_media for all using (
  uploaded_by = auth.uid()
  and exists(select 1 from public.question_versions qv join public.questions q on q.id = qv.question_id where qv.id = question_media.question_version_id and q.owner_id = auth.uid())
) with check (
  uploaded_by = auth.uid()
  and exists(select 1 from public.question_versions qv join public.questions q on q.id = qv.question_id where qv.id = question_media.question_version_id and q.owner_id = auth.uid())
);

create or replace function public.share_question(
  p_question_id uuid,
  p_teacher_id uuid,
  p_permission public.question_share_permission default 'read'
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_assessment_author();
  if not exists(select 1 from public.questions q where q.id = p_question_id and (q.owner_id = auth.uid() or app.is_super_admin())) then
    raise exception 'Không có quyền chia sẻ câu hỏi';
  end if;
  if not exists(select 1 from public.teachers t join public.profiles p on p.id = t.user_id where t.id = p_teacher_id and p.is_active) then
    raise exception 'Giáo viên nhận không hợp lệ';
  end if;
  insert into public.question_shares(question_id, shared_with_teacher_id, permission, shared_by)
  values(p_question_id, p_teacher_id, p_permission, auth.uid())
  on conflict(question_id, shared_with_teacher_id)
  do update set permission = excluded.permission, shared_by = auth.uid();
end $$;

create or replace function public.clone_question(p_question_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_source public.questions;
  v_source_version public.question_versions;
  v_new_question uuid;
  v_new_version uuid;
begin
  perform app.require_assessment_author();
  select * into v_source from public.questions q where q.id = p_question_id and (
    q.owner_id = auth.uid() or q.visibility = 'global'
    or exists(select 1 from public.question_shares s where s.question_id = q.id and s.shared_with_teacher_id = app.my_teacher_id())
    or app.is_super_admin()
  );
  if v_source.id is null or v_source.current_version_id is null then raise exception 'Không tìm thấy câu hỏi có thể clone'; end if;
  select * into v_source_version from public.question_versions where id = v_source.current_version_id;

  insert into public.questions(owner_id, title, skill, difficulty, created_by)
  values(auth.uid(), v_source.title || ' — bản sao', v_source.skill, v_source.difficulty, auth.uid())
  returning id into v_new_question;
  insert into public.question_versions(question_id, version_no, question_type, prompt_text, prompt_content, normalization_config, explanation_text, created_by)
  values(v_new_question, 1, v_source_version.question_type, v_source_version.prompt_text, v_source_version.prompt_content, v_source_version.normalization_config, v_source_version.explanation_text, auth.uid())
  returning id into v_new_version;
  insert into public.question_options(question_version_id, option_key, content, order_index)
  select v_new_version, option_key, content, order_index from public.question_options where question_version_id = v_source_version.id;
  insert into public.question_answer_keys(question_version_id, answer_key, grading_config, created_by)
  select v_new_version, answer_key, grading_config, auth.uid() from public.question_answer_keys where question_version_id = v_source_version.id;
  update public.questions set current_version_id = v_new_version, status = 'ready' where id = v_new_question;
  perform app.write_audit('question.clone', 'question', v_new_question, null, jsonb_build_object('source_question_id', p_question_id));
  return v_new_question;
end $$;

create or replace function public.import_questions(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb;
  v_question uuid;
  v_ids jsonb := '[]'::jsonb;
begin
  perform app.require_assessment_author();
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 500 then
    raise exception 'Batch import phải có 1–500 dòng';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if nullif(trim(v_row->>'title'), '') is null or nullif(trim(v_row->>'prompt_text'), '') is null then raise exception 'Dòng import thiếu tiêu đề hoặc nội dung'; end if;
    insert into public.questions(owner_id, title, skill, difficulty, created_by)
    values(auth.uid(), trim(v_row->>'title'), (v_row->>'skill')::public.question_skill, (v_row->>'difficulty')::public.question_difficulty, auth.uid())
    returning id into v_question;
    perform public.create_question_version(
      v_question, (v_row->>'question_type')::public.question_type, v_row->>'prompt_text',
      coalesce(v_row->'prompt_content', '{}'::jsonb), coalesce(v_row->'normalization_config', '{}'::jsonb),
      v_row->>'explanation_text', coalesce(v_row->'options', '[]'::jsonb),
      coalesce(v_row->'answer_key', '{}'::jsonb), coalesce(v_row->'grading_config', '{}'::jsonb)
    );
    perform public.publish_question_version(v_question);
    v_ids := v_ids || jsonb_build_array(v_question);
  end loop;
  return jsonb_build_object('count', jsonb_array_length(v_ids), 'question_ids', v_ids);
end $$;

create policy question_media_scoped_read on storage.objects for select to authenticated using (
  bucket_id = 'question-media' and exists(
    select 1 from public.question_media m
    join public.question_versions qv on qv.id = m.question_version_id
    join public.questions q on q.id = qv.question_id
    where m.object_path = storage.objects.name and (
      q.owner_id = auth.uid() or q.visibility = 'global'
      or exists(select 1 from public.question_shares s where s.question_id = q.id and s.shared_with_teacher_id = app.my_teacher_id())
      or exists(
        select 1 from public.question_set_items i
        join public.exercise_deliveries d on d.set_version_id = i.set_version_id
        join public.exercise_attempts a on a.delivery_id = d.id and a.status in ('in_progress', 'returned_for_revision')
        join public.enrollments e on e.id = a.enrollment_id
        where i.question_version_id = qv.id and e.student_id = app.my_student_id()
      )
      or exists(
        select 1 from public.question_set_items i
        join public.exam_deliveries d on d.set_version_id = i.set_version_id
        join public.exam_attempts a on a.exam_delivery_id = d.id and a.status = 'in_progress' and clock_timestamp() < a.deadline_at
        join public.enrollments e on e.id = a.enrollment_id
        where i.question_version_id = qv.id and e.student_id = app.my_student_id()
      )
    )
  )
);

revoke all on function public.share_question(uuid, uuid, public.question_share_permission) from public, anon;
revoke all on function public.clone_question(uuid) from public, anon;
revoke all on function public.import_questions(jsonb) from public, anon;
grant execute on function public.share_question(uuid, uuid, public.question_share_permission) to authenticated;
grant execute on function public.clone_question(uuid) to authenticated;
grant execute on function public.import_questions(jsonb) to authenticated;
