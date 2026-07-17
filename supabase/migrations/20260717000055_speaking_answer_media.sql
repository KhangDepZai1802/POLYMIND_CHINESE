-- 55 — Kỹ năng Nói: chấm tay + bucket/bảng answer-media + RLS + RPC thu âm
--
-- Câu hỏi `speaking` = đề bằng chữ, học viên thu âm trả lời, giáo viên nghe và
-- chấm tay (điểm tự do). Không auto-score. Bài nộp audio lưu ở bucket private
-- `answer-media`; bảng `answer_media` ánh xạ object_path → lượt làm → lớp để
-- storage policy soi đúng phạm vi (giống `question_media_scoped_read`).

-- 1) auto_score: speaking cũng là câu chấm tay như essay_translation.
create or replace function app.auto_score_answer(p_item_id uuid,p_payload jsonb)
returns table(score numeric,is_correct boolean,manual_required boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_points numeric; v_type public.question_type; v_key jsonb; v_config jsonb; v_ok boolean; v_correct_count integer; v_selected_correct integer; v_selected_wrong integer;
begin
  select i.points,qv.question_type,k.answer_key,k.grading_config into v_points,v_type,v_key,v_config
  from public.question_set_items i join public.question_versions qv on qv.id=i.question_version_id join public.question_answer_keys k on k.question_version_id=qv.id where i.id=p_item_id;
  if v_type in ('essay_translation','speaking') then return query select null::numeric,null::boolean,true; return; end if;
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
revoke all on function app.auto_score_answer(uuid,jsonb) from public,anon,authenticated;

-- 2) Bucket private cho bài nộp audio của học viên. 25 MB đủ cho một câu nói.
insert into storage.buckets (id, name, public, file_size_limit)
values ('answer-media', 'answer-media', false, 26214400)
on conflict (id) do nothing;

-- 3) Bảng ánh xạ bài nộp audio → lượt làm. Polymorphic theo attempt_kind vì
--    có hai bảng lượt làm (exercise_attempts / exam_attempts).
--    Quy ước object_path (server sinh): {student_uid}/{attempt_id}/{item_id}/{uuid}.{ext}
create table public.answer_media (
  id uuid primary key default gen_random_uuid(),
  attempt_kind public.question_set_kind not null,
  attempt_id uuid not null,
  set_item_id uuid not null references public.question_set_items(id) on delete cascade,
  object_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null,
  duration_ms integer,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (attempt_kind, attempt_id, set_item_id)
);
create index answer_media_attempt_idx on public.answer_media (attempt_kind, attempt_id);
alter table public.answer_media enable row level security;

-- Học viên chỉ đụng bản ghi audio của chính mình.
create policy answer_media_owner_all on public.answer_media for all to authenticated
  using (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());

-- Giáo viên phụ trách lớp (hoặc super admin) đọc để chấm.
create policy answer_media_teacher_read on public.answer_media for select to authenticated using (
  app.is_super_admin()
  or (attempt_kind = 'exercise' and exists(
    select 1 from public.exercise_attempts a join public.exercise_deliveries d on d.id = a.delivery_id
    where a.id = answer_media.attempt_id and app.teaches_class(d.class_id)))
  or (attempt_kind = 'exam' and exists(
    select 1 from public.exam_attempts a join public.exam_deliveries d on d.id = a.exam_delivery_id
    where a.id = answer_media.attempt_id and app.teaches_class(d.class_id)))
);

-- 4) Storage policies cho bucket answer-media (soi đúng phạm vi qua answer_media).
create policy "bài nói: học viên tải lên bài của mình" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'answer-media' and app.storage_root(name) = auth.uid()::text);

create policy "bài nói: học viên thay/xóa bài của mình" on storage.objects
  for delete to authenticated
  using (bucket_id = 'answer-media' and app.storage_root(name) = auth.uid()::text);

create policy "bài nói: đọc của mình hoặc lớp mình dạy" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'answer-media' and (
      app.storage_root(name) = auth.uid()::text
      or app.is_super_admin()
      or exists(
        select 1 from public.answer_media m
        where m.object_path = storage.objects.name and (
          (m.attempt_kind = 'exercise' and exists(
            select 1 from public.exercise_attempts a join public.exercise_deliveries d on d.id = a.delivery_id
            where a.id = m.attempt_id and app.teaches_class(d.class_id)))
          or (m.attempt_kind = 'exam' and exists(
            select 1 from public.exam_attempts a join public.exam_deliveries d on d.id = a.exam_delivery_id
            where a.id = m.attempt_id and app.teaches_class(d.class_id)))
        )
      )
    )
  );

-- 5) RPC ghi bài nói: tái dùng save_* để kiểm chủ sở hữu/hạn giờ/câu thuộc lượt,
--    đồng thời set answer_payload = { audio_path, mime, duration_ms } và lưu answer_media.
create or replace function public.attach_answer_media(
  p_kind public.question_set_kind,
  p_attempt_id uuid,
  p_set_item_id uuid,
  p_object_path text,
  p_mime text,
  p_size bigint,
  p_duration_ms integer default null
)
returns void language plpgsql security definer set search_path='' as $$
declare v_payload jsonb;
begin
  if app.current_role() <> 'student' then raise exception 'Không có quyền nộp bài nói'; end if;
  if app.storage_root(p_object_path) <> auth.uid()::text then raise exception 'Đường dẫn bài nộp không hợp lệ'; end if;
  v_payload := jsonb_strip_nulls(jsonb_build_object('audio_path', p_object_path, 'mime', p_mime, 'duration_ms', p_duration_ms));
  -- save_* raise nếu không phải chủ lượt / hết hạn / câu không thuộc lượt (fail-closed).
  if p_kind = 'exercise' then
    perform public.save_exercise_answer(p_attempt_id, p_set_item_id, v_payload);
  else
    perform public.save_exam_answer(p_attempt_id, p_set_item_id, v_payload);
  end if;
  insert into public.answer_media(attempt_kind, attempt_id, set_item_id, object_path, mime_type, size_bytes, duration_ms, uploaded_by)
  values (p_kind, p_attempt_id, p_set_item_id, p_object_path, p_mime, p_size, p_duration_ms, auth.uid())
  on conflict (attempt_kind, attempt_id, set_item_id) do update
    set object_path = excluded.object_path, mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes, duration_ms = excluded.duration_ms,
        uploaded_by = excluded.uploaded_by, created_at = now();
end $$;

revoke all on function public.attach_answer_media(public.question_set_kind, uuid, uuid, text, text, bigint, integer) from public, anon;
grant execute on function public.attach_answer_media(public.question_set_kind, uuid, uuid, text, text, bigint, integer) to authenticated;

-- 6) RPC xóa bài nói (học viên thu âm lại từ đầu): reset answer_payload về {}
--    và bỏ bản ghi answer_media. save_* kiểm chủ lượt/hạn giờ (fail-closed).
--    Đối tượng storage do server xóa sau khi lấy object_path.
create or replace function public.clear_answer_media(
  p_kind public.question_set_kind,
  p_attempt_id uuid,
  p_set_item_id uuid
)
returns void language plpgsql security definer set search_path='' as $$
begin
  if app.current_role() <> 'student' then raise exception 'Không có quyền xóa bài nói'; end if;
  if p_kind = 'exercise' then
    perform public.save_exercise_answer(p_attempt_id, p_set_item_id, '{}'::jsonb);
  else
    perform public.save_exam_answer(p_attempt_id, p_set_item_id, '{}'::jsonb);
  end if;
  delete from public.answer_media
  where attempt_kind = p_kind and attempt_id = p_attempt_id
    and set_item_id = p_set_item_id and uploaded_by = auth.uid();
end $$;

revoke all on function public.clear_answer_media(public.question_set_kind, uuid, uuid) from public, anon;
grant execute on function public.clear_answer_media(public.question_set_kind, uuid, uuid) to authenticated;
