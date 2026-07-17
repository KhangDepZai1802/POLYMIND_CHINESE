-- Vercel Hobby only permits daily cron schedules. Run the deadline-sensitive
-- assessment finalizer beside the data so browser closure still cannot orphan
-- an attempt and no paid application scheduler is required.
create extension if not exists pg_cron;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'assessment-attempt-finalizer';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'assessment-attempt-finalizer',
    '* * * * *',
    'select public.finalize_assessment_attempts();'
  );
end;
$$;
