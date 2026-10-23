-- Run in a rollback transaction, including against cloud; no real lead is modified.
insert into auth.users(id) values('ac230000-0000-4000-8000-000000000001'),('ac230000-0000-4000-8000-000000000002');
insert into public.profiles(id,role,full_name,is_active) values
 ('ac230000-0000-4000-8000-000000000001','teacher','TEST ADMISSION TEACHER',true),
 ('ac230000-0000-4000-8000-000000000002','super_admin','TEST ADMISSION ADMIN',true);
insert into public.teachers(id,user_id) values('ac230000-0000-4000-8000-000000000003','ac230000-0000-4000-8000-000000000001');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values('ac230000-0000-4000-8000-000000000004','TEST ADMISSION TEACHER','ac230000-0000-4000-8000-000000000003');
select set_config('request.jwt.claims','{"sub":"ac230000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert not public.has_b2c_permission('manage_admissions'), 'Permission defaults off';
 assert (select count(*)=0 from public.b2c_admission_leads), 'Raw leads hidden without grant';
 begin perform public.get_b2c_admissions_page(); raise exception 'Unauthorized RPC allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.b2c_admission_leads(full_name,phone,program_slug,salesperson,stage) values('TEST DENIED','0901234567','tieng-anh','Test','lead'); raise exception 'Unauthorized insert allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"ac230000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.save_b2c_teacher_permissions('ac230000-0000-4000-8000-000000000004','ac230000-0000-4000-8000-000000000003',array['manage_admissions'],null);
reset role;
select set_config('request.jwt.claims','{"sub":"ac230000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare lead_id uuid; s text; begin
 assert public.has_b2c_permission('manage_admissions'), 'Explicit permission works without teaching classes';
 assert not public.has_b2c_permission('view_tuition'), 'Admissions does not grant tuition';
 insert into public.b2c_admission_leads(full_name,phone,program_slug,salesperson,stage) values('TEST ADMISSIONS ACCESS','0901234567','tieng-anh','Test','lead') returning id into lead_id;
 foreach s in array array['consulted','trial','deposit','enrolled'] loop
  update public.b2c_admission_leads set stage=s where id=lead_id;
  assert (select stage=s from public.b2c_admission_leads where id=lead_id), 'Stage update works';
 end loop;
 insert into public.b2c_admission_care_logs(lead_id,channel,contact_date,caretaker_name,content) values(lead_id,'call',current_date,'Test','TEST CARE');
 assert (public.get_b2c_admissions_page(null,null,'TEST ADMISSIONS ACCESS')->>'total')::int=1, 'Search RPC reads inserted lead';
 assert (select count(*)=1 from public.b2c_admission_care_logs where content='TEST CARE'), 'Care logs visible';
 begin insert into public.b2c_admission_leads(full_name,phone,program_slug,salesperson,stage,created_by) values('TEST SPOOF','0901234567','tieng-anh','Test','lead','ac230000-0000-4000-8000-000000000002'); raise exception 'Spoofed actor accepted'; exception when insufficient_privilege then null; end;
 begin perform public.save_b2c_teacher_permissions('ac230000-0000-4000-8000-000000000004','ac230000-0000-4000-8000-000000000003',array['view_tuition'],null); raise exception 'Self escalation accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"ac230000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role service_role;
update public.profiles set is_active=false where id='ac230000-0000-4000-8000-000000000001';
reset role;
select set_config('request.jwt.claims','{"sub":"ac230000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert not public.has_b2c_permission('manage_admissions'), 'Disabled account denied';
 assert (select count(*)=0 from public.b2c_admission_leads), 'Disabled account cannot read leads';
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"ac230000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role service_role;
update public.profiles set is_active=true where id='ac230000-0000-4000-8000-000000000001';
reset role;
update public.b2c_teacher_permissions set permissions='{}' where teacher_id='ac230000-0000-4000-8000-000000000004';
select set_config('request.jwt.claims','{"sub":"ac230000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert not public.has_b2c_permission('manage_admissions'), 'Revocation takes effect';
 begin perform public.get_b2c_admissions_page(); raise exception 'Revoked RPC accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'ok: admissions defaults, RLS, pipeline, care, attribution, disabled account and revocation';
