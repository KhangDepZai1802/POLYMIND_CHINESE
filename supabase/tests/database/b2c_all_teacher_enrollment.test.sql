-- Run inside a rollback transaction. No actual student/enrollment is changed.
insert into auth.users(id) values('ac230004-0000-4000-8000-000000000001'),('ac230004-0000-4000-8000-000000000002');
insert into public.profiles(id,role,full_name,is_active) values
 ('ac230004-0000-4000-8000-000000000001','teacher','TEST B2C ENROLLER',true),
 ('ac230004-0000-4000-8000-000000000002','teacher','TEST B2B ONLY',true);
insert into public.teachers(id,user_id) values
 ('ac230004-0000-4000-8000-000000000003','ac230004-0000-4000-8000-000000000001'),
 ('ac230004-0000-4000-8000-000000000004','ac230004-0000-4000-8000-000000000002');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values('ac230004-0000-4000-8000-000000000005','TEST B2C ENROLLER','ac230004-0000-4000-8000-000000000003');
insert into public.b2c_classes(id,name,program_slug,teacher_name,capacity,status) values
 ('ac230004-0000-4000-8000-000000000006','TEST ENROLL OPEN','tieng-anh','OTHER TEACHER',2,'active'),
 ('ac230004-0000-4000-8000-000000000007','TEST ENROLL CLOSED','tieng-anh','OTHER TEACHER',2,'completed');
select set_config('request.jwt.claims','{"sub":"ac230004-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert not public.can_add_b2c_students(), 'B2B-only teacher denied';
 begin perform public.read_b2c_enrollment_classes(); raise exception 'B2B-only class list allowed'; exception when insufficient_privilege then null; end;
 begin perform public.add_b2c_class_student('{}'::jsonb); raise exception 'B2B-only enrollment allowed'; exception when insufficient_privilege then null; end;
 begin perform public.find_b2c_enrollment_students('ac230004-0000-4000-8000-000000000006'); raise exception 'B2B-only search allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"ac230004-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare payload jsonb; e uuid; student uuid; opts jsonb; begin
 assert public.can_add_b2c_students(), 'New active linked B2C teacher automatically allowed';
 assert not public.has_b2c_permission('edit_tuition','ac230004-0000-4000-8000-000000000006'), 'Tuition permissions unchanged';
 assert exists(select 1 from jsonb_array_elements(public.read_b2c_enrollment_classes()) c where c->>'id'='ac230004-0000-4000-8000-000000000006'), 'Open class available without teaching assignment';
 assert not exists(select 1 from jsonb_array_elements(public.read_b2c_enrollment_classes()) c where c->>'id'='ac230004-0000-4000-8000-000000000007'), 'Closed class excluded';
 payload:=jsonb_build_object('request_id','ac230004-0000-4000-8000-000000000010','class_id','ac230004-0000-4000-8000-000000000006','mode','new','full_name','TEST NEW ENROLLED STUDENT','salesperson','TEST B2C ENROLLER','enrollment_date',current_date);
 e:=public.add_b2c_class_student(payload);
 assert public.add_b2c_class_student(payload)=e, 'Retry returns same enrollment';
 -- Search uses another target class to show a student already in the first class.
 opts:=public.find_b2c_enrollment_students('ac230004-0000-4000-8000-000000000007','TEST NEW ENROLLED STUDENT',0);
 assert (opts->>'total')::int=1, 'Limited search projection finds existing student';
 student:=(opts->'rows'->0->>'id')::uuid;
 assert (public.find_b2c_enrollment_students('ac230004-0000-4000-8000-000000000006','TEST NEW ENROLLED STUDENT',0)->>'total')::int=0, 'Already enrolled student excluded';
 begin perform public.add_b2c_class_student(payload||jsonb_build_object('request_id',gen_random_uuid(),'mode','existing','student_id',student)); raise exception 'Duplicate enrollment accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.add_b2c_class_student(payload||jsonb_build_object('request_id',gen_random_uuid(),'class_id','ac230004-0000-4000-8000-000000000007')); raise exception 'Closed class enrollment accepted'; exception when invalid_parameter_value then null; end;
 assert (select count(*)=0 from public.b2c_students where id=student), 'No raw student table access added';
end $$;
reset role;
do $$ begin
 assert (select count(*)=1 from public.b2c_enrollment_requests where request_id='ac230004-0000-4000-8000-000000000010' and created_by='ac230004-0000-4000-8000-000000000001'), 'Actual enrollment actor retained';
 assert (select enrolled_count=1 from public.b2c_classes where id='ac230004-0000-4000-8000-000000000006'), 'Enrollment count updated once';
end $$;
set local role service_role;
update public.profiles set is_active=false where id='ac230004-0000-4000-8000-000000000001';
reset role;
set local role authenticated;
do $$ begin
 assert not public.can_add_b2c_students(), 'Disabled B2C account denied immediately';
 begin perform public.add_b2c_class_student('{}'); raise exception 'Disabled teacher enrollment allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'ok: all active B2C teachers, future accounts, B2B denial, new/existing search, retries, closed classes and attribution';
