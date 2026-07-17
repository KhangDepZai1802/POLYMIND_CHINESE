-- 45 — Forward-fix vòng lặp RLS questions ↔ question_shares

drop policy if exists question_shares_teacher_read on public.question_shares;
create policy question_shares_teacher_read on public.question_shares for select using (
  shared_by = auth.uid() or shared_with_teacher_id = app.my_teacher_id()
);
