begin;

alter table public.b2c_students
  drop constraint if exists b2c_students_customer_source_check;

alter table public.b2c_students
  add constraint b2c_students_customer_source_check
  check (customer_source is null or customer_source in ('facebook','zalo','tiktok','referral','walk_in','school','other'));

alter table public.b2c_admission_leads
  drop constraint if exists b2c_admissions_pipeline_customer_source_check;

alter table public.b2c_admission_leads
  drop constraint if exists b2c_admission_leads_customer_source_check;

alter table public.b2c_admission_leads
  add constraint b2c_admission_leads_customer_source_check
  check (customer_source is null or customer_source in ('facebook','zalo','tiktok','referral','walk_in','school','other'));

notify pgrst, 'reload schema';

commit;
