-- =============================================================================
-- 14 — Storage: 5 bucket PRIVATE + policy
--
-- KHÔNG bucket nào public. Truy cập qua signed URL thời hạn ngắn (≤ 5 phút).
--
-- Policy ở đây soi ĐÚNG CÙNG điều kiện class/student như RLS của DB. Nếu chỉ
-- kiểm `auth.uid() IS NOT NULL` thì bất kỳ ai đăng nhập cũng tải được bài nộp
-- của bất kỳ ai — đó là IDOR.
--
-- Quy ước object_path (do SERVER sinh, không tin path client gửi lên):
--   avatars/           {user_id}/{uuid}.{ext}
--   course-materials/  {course_id}/{uuid}.{ext}
--   assignment-files/  {class_id}/{assignment_id}/{uuid}.{ext}
--   submissions/       {class_id}/{submission_id}/{uuid}.{ext}
--   student-documents/ {student_id}/{uuid}.{ext}
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('avatars',           'avatars',           false, 5242880),    -- 5 MB
  ('course-materials',  'course-materials',  false, 52428800),   -- 50 MB
  ('assignment-files',  'assignment-files',  false, 20971520),   -- 20 MB
  ('submissions',       'submissions',       false, 52428800),   -- 50 MB (bài nói có audio)
  ('student-documents', 'student-documents', false, 20971520)    -- 20 MB
on conflict (id) do nothing;

-- Lấy segment đầu của object_path (thư mục gốc).
create or replace function app.storage_root(p_name text)
returns text
language sql
immutable
as $$
  select split_part(p_name, '/', 1);
$$;

-- =============================================================================
-- avatars — mỗi người quản lý ảnh của chính mình; admin quản tất
-- =============================================================================

create policy "avatar: đọc của chính mình" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (app.storage_root(name) = auth.uid()::text or app.is_super_admin())
  );

create policy "avatar: tải lên của chính mình" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (app.storage_root(name) = auth.uid()::text or app.is_super_admin())
  );

create policy "avatar: cập nhật của chính mình" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (app.storage_root(name) = auth.uid()::text or app.is_super_admin())
  );

create policy "avatar: xóa của chính mình" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (app.storage_root(name) = auth.uid()::text or app.is_super_admin())
  );

-- =============================================================================
-- course-materials — thư mục gốc là course_id
-- =============================================================================

create policy "tài liệu: đọc course liên quan" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'course-materials'
    and (
      app.is_super_admin()
      or app.teaches_course(app.storage_root(name)::uuid)
      -- Học viên: phải có bản ghi metadata với visibility = enrolled_students.
      -- Chỉ học course thôi thì CHƯA đủ — tài liệu `staff_only` vẫn phải vô hình.
      or exists (
        select 1 from public.course_materials m
        where m.object_path = storage.objects.name
          and m.visibility = 'enrolled_students'
          and app.studies_course(m.course_id)
      )
    )
  );

create policy "tài liệu: giáo viên/admin tải lên" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-materials'
    and (app.is_super_admin() or app.teaches_course(app.storage_root(name)::uuid))
  );

create policy "tài liệu: giáo viên/admin xóa" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'course-materials'
    and (app.is_super_admin() or app.teaches_course(app.storage_root(name)::uuid))
  );

-- =============================================================================
-- assignment-files — thư mục gốc là class_id
-- =============================================================================

create policy "file bài tập: đọc lớp liên quan" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assignment-files'
    and (
      app.is_super_admin()
      or app.teaches_class(app.storage_root(name)::uuid)
      or app.studies_class(app.storage_root(name)::uuid)
    )
  );

create policy "file bài tập: giáo viên/admin tải lên" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assignment-files'
    and (app.is_super_admin() or app.teaches_class(app.storage_root(name)::uuid))
  );

create policy "file bài tập: giáo viên/admin xóa" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'assignment-files'
    and (app.is_super_admin() or app.teaches_class(app.storage_root(name)::uuid))
  );

-- =============================================================================
-- submissions — thư mục gốc là class_id, thư mục con là submission_id
--
-- Học viên chỉ đụng được file của bài nộp CỦA CHÍNH MÌNH (soi qua submission_id
-- ở segment thứ 2), không phải mọi file trong lớp.
-- =============================================================================

create policy "bài nộp: đọc của mình hoặc lớp mình dạy" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (
      app.is_super_admin()
      or app.teaches_class(app.storage_root(name)::uuid)
      or exists (
        select 1 from public.submissions s
        where s.id = (split_part(name, '/', 2))::uuid
          and app.owns_enrollment(s.enrollment_id)
      )
    )
  );

create policy "bài nộp: học viên tải lên bài của mình" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (
      app.is_super_admin()
      or exists (
        select 1 from public.submissions s
        where s.id = (split_part(name, '/', 2))::uuid
          and app.owns_enrollment(s.enrollment_id)
          and s.graded_at is null    -- chấm rồi thì không thêm file nữa
      )
    )
  );

create policy "bài nộp: học viên xóa file bài chưa chấm" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (
      app.is_super_admin()
      or exists (
        select 1 from public.submissions s
        where s.id = (split_part(name, '/', 2))::uuid
          and app.owns_enrollment(s.enrollment_id)
          and s.graded_at is null
      )
    )
  );

-- =============================================================================
-- student-documents — thư mục gốc là student_id. Admin quản; học viên chỉ đọc.
-- =============================================================================

create policy "hồ sơ HV: đọc của mình hoặc admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-documents'
    and (
      app.is_super_admin()
      or app.storage_root(name)::uuid = app.my_student_id()
    )
  );

create policy "hồ sơ HV: chỉ admin tải lên" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'student-documents' and app.is_super_admin());

create policy "hồ sơ HV: chỉ admin xóa" on storage.objects
  for delete to authenticated
  using (bucket_id = 'student-documents' and app.is_super_admin());
