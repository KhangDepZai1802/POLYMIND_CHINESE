-- Run inside a rollback transaction; all records below are disposable fixtures.
insert into auth.users(id) values('ac230002-0000-4000-8000-000000000001'),('ac230002-0000-4000-8000-000000000002');
insert into public.profiles(id,role,full_name,is_active) values
 ('ac230002-0000-4000-8000-000000000001','teacher','TEST ARCHIVE TEACHER',true),
 ('ac230002-0000-4000-8000-000000000002','super_admin','TEST ARCHIVE ADMIN',true);
insert into public.teachers(id,user_id) values('ac230002-0000-4000-8000-000000000003','ac230002-0000-4000-8000-000000000001');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values('ac230002-0000-4000-8000-000000000004','TEST ARCHIVE TEACHER','ac230002-0000-4000-8000-000000000003');
insert into public.b2c_teacher_permissions(teacher_id,permissions,updated_by) values('ac230002-0000-4000-8000-000000000004',array['manage_admissions'],'ac230002-0000-4000-8000-000000000002');
select set_config('request.jwt.claims','{"sub":"ac230002-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into public.b2c_admission_leads(id,full_name,phone,program_slug,salesperson,stage) values('ac230002-0000-4000-8000-000000000005','TEST ARCHIVE LEAD','0901234567','tieng-anh','Test','trial');
insert into public.b2c_admission_care_logs(lead_id,channel,contact_date,caretaker_name,content) values('ac230002-0000-4000-8000-000000000005','call',current_date,'Test','TEST ARCHIVE CARE');
do $$ begin
 assert (public.get_b2c_admissions_page(null,null,'TEST ARCHIVE LEAD')->>'total')::int=1, 'Lead initially visible';
 begin update public.b2c_admission_leads set archived_at=now(),archived_by=auth.uid() where id='ac230002-0000-4000-8000-000000000005'; raise exception 'Direct archive allowed'; exception when insufficient_privilege then null; end;
end $$;
select public.archive_b2c_admission('ac230002-0000-4000-8000-000000000005');
select public.archive_b2c_admission('ac230002-0000-4000-8000-000000000005');
do $$ begin
 assert (public.get_b2c_admissions_page(null,null,'TEST ARCHIVE LEAD')->>'total')::int=0, 'Archived lead removed from total/search';
 assert (select count(*)=0 from public.b2c_admission_leads where id='ac230002-0000-4000-8000-000000000005'), 'Archived lead hidden from operational queries';
 update public.b2c_admission_leads set stage='enrolled' where id='ac230002-0000-4000-8000-000000000005';
 assert not found, 'Stale edit cannot change archived lead';
 begin insert into public.b2c_admission_care_logs(lead_id,channel,contact_date,caretaker_name,content) values('ac230002-0000-4000-8000-000000000005','call',current_date,'Test','STALE CARE'); raise exception 'Stale care insert allowed'; exception when insufficient_privilege then null; end;
 begin perform public.archive_b2c_admission('ac230002-0000-4000-8000-000000000099'); raise exception 'Missing lead accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
 assert (select archived_at is not null and archived_by='ac230002-0000-4000-8000-000000000001' and stage='trial' from public.b2c_admission_leads where id='ac230002-0000-4000-8000-000000000005'), 'Preserved lead and actual actor';
 assert (select count(*)=1 from public.b2c_admission_care_logs where lead_id='ac230002-0000-4000-8000-000000000005'), 'Care history retained';
end $$;
select set_config('request.jwt.claims','{"sub":"ac230002-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert (select count(*)=0 from public.b2c_admission_leads where id='ac230002-0000-4000-8000-000000000005'), 'Manager list also hides archived leads';
end $$;
reset role;
update public.b2c_teacher_permissions set permissions='{}' where teacher_id='ac230002-0000-4000-8000-000000000004';
select set_config('request.jwt.claims','{"sub":"ac230002-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.archive_b2c_admission('ac230002-0000-4000-8000-000000000005'); raise exception 'Revoked teacher archived lead'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'ok: archive permission, attribution, retry, totals, stale writes and history preservation';
