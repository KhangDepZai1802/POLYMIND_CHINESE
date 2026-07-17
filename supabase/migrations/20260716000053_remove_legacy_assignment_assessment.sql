-- Destructive cleanup is intentionally guarded. The production inventory and
-- backup were completed before this migration; abort if data appeared since.
do $$
begin
  if exists (select 1 from public.assignments limit 1)
     or exists (select 1 from public.assignment_attachments limit 1)
     or exists (select 1 from public.submissions limit 1)
     or exists (select 1 from public.submission_files limit 1)
     or exists (select 1 from public.assessments limit 1)
     or exists (select 1 from public.assessment_results limit 1) then
    raise exception 'Legacy assignment/assessment data is not empty; cleanup aborted';
  end if;

  if exists (
    select 1 from storage.objects
    where bucket_id in ('assignment-files', 'submissions')
  ) then
    raise exception 'Legacy Storage buckets are not empty; cleanup aborted';
  end if;
end;
$$;

drop view if exists public.v_at_risk_students;
drop view if exists public.v_class_progress;
drop view if exists public.v_enrollment_progress;

drop function if exists public.close_assignment(uuid);
drop function if exists public.grade_submission(uuid, numeric, text);
drop function if exists public.publish_assessment_results(uuid);
drop function if exists public.publish_assignment(uuid);
drop function if exists public.run_assignment_due_reminders(timestamptz);
drop function if exists public.save_assessment_result(uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text);

drop policy if exists "bài nộp: học viên tải lên đúng lớp" on storage.objects;
drop policy if exists "bài nộp: học viên xóa file đúng lớp khi chưa chấm" on storage.objects;
drop policy if exists "bài nộp: đọc đúng lớp và chủ sở hữu" on storage.objects;
drop policy if exists "file bài tập: giáo viên/admin tải lên" on storage.objects;
drop policy if exists "file bài tập: giáo viên/admin xóa" on storage.objects;
drop policy if exists "file bài tập: đọc đúng phạm vi publish" on storage.objects;

drop table public.submission_files;
drop table public.submissions;
drop table public.assignment_attachments;
drop table public.assignments;
drop table public.assessment_results;
drop table public.assessments;

drop function if exists app.compute_classification();
drop function if exists app.enforce_assessment_initial_state();
drop function if exists app.enforce_assessment_result_integrity();
drop function if exists app.enforce_assessment_update();
drop function if exists app.enforce_assignment_attachment_integrity();
drop function if exists app.enforce_assignment_publication_state();
drop function if exists app.enforce_assignment_scope();
drop function if exists app.enforce_submission_file_path();
drop function if exists app.enforce_submission_initial_state();
drop function if exists app.enforce_submission_score();
drop function if exists app.force_assignment_actor();
drop function if exists app.force_submission_grader();
drop function if exists app.prevent_assignment_history_delete();
drop function if exists app.prevent_published_assessment_delete();
drop function if exists app.prevent_published_result_delete();
drop function if exists app.prevent_student_grading();
drop function if exists app.prevent_submission_content_tampering();

alter table public.courses drop column completion_require_all_assignments;
drop type public.assignment_status;
drop type public.submission_status;
