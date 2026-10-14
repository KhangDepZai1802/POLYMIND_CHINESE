alter table public.b2c_teachers
  add column source_teacher_id uuid unique references public.teachers(id) on delete restrict,
  alter column employment_type drop not null,
  alter column hourly_rate drop not null,
  alter column created_by drop not null;
-- Legacy imports have no known actor. New UI inserts still require auth.uid()
-- through the existing RLS insert policy. Do not fabricate an import actor.
notify pgrst, 'reload schema';
