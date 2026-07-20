-- 63 — Học viên đọc media đề bài thuộc đúng lượt Bài tập/Thi đang mở.
--
-- Trước migration này, `get_*_attempt_payload` trả câu hỏi nhưng truy vấn
-- `question_media` ở app bị RLS lọc sạch (chỉ có policy cho giáo viên). Storage
-- policy cũ cũng join qua các bảng mà học viên không được SELECT trực tiếp, nên
-- không thể ký URL dù giáo viên preview cùng file bình thường.

create or replace function app.can_student_read_question_media(p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app.is_active()
    and app.current_role() = 'student'
    and p_object_path is not null
    and (
      exists (
        select 1
        from public.question_media m
        join public.question_set_items i
          on i.question_version_id = m.question_version_id
        join public.exercise_deliveries d
          on d.set_version_id = i.set_version_id
        join public.exercise_attempts a
          on a.delivery_id = d.id
         and a.status in ('in_progress', 'returned_for_revision')
        join public.enrollments e
          on e.id = a.enrollment_id
        where m.object_path = p_object_path
          and e.student_id = app.my_student_id()
      )
      or exists (
        select 1
        from public.question_media m
        join public.question_set_items i
          on i.question_version_id = m.question_version_id
        join public.exam_deliveries d
          on d.set_version_id = i.set_version_id
        join public.exam_attempts a
          on a.exam_delivery_id = d.id
         and a.status = 'in_progress'
         and clock_timestamp() < a.deadline_at
        join public.enrollments e
          on e.id = a.enrollment_id
        where m.object_path = p_object_path
          and e.student_id = app.my_student_id()
      )
    );
$$;

revoke all on function app.can_student_read_question_media(text)
  from public, anon;
grant execute on function app.can_student_read_question_media(text)
  to authenticated;

create policy question_media_student_attempt_read
on public.question_media
for select
to authenticated
using (app.can_student_read_question_media(object_path));

create policy question_media_student_attempt_storage_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'question-media'
  and app.can_student_read_question_media(name)
);
