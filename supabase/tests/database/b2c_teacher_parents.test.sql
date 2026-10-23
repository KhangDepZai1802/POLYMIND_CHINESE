-- All fixtures are rolled back; real parent contact details are never changed.
insert into auth.users(id) values('ac230005-0000-4000-8000-000000000001'),('ac230005-0000-4000-8000-000000000002');
insert into public.profiles(id,role,full_name,is_active) values
 ('ac230005-0000-4000-8000-000000000001','teacher','TEST PARENT B2C TEACHER',true),
 ('ac230005-0000-4000-8000-000000000002','teacher','TEST PARENT B2B ONLY',true);
insert into public.teachers(id,user_id) values
 ('ac230005-0000-4000-8000-000000000003','ac230005-0000-4000-8000-000000000001'),
 ('ac230005-0000-4000-8000-000000000004','ac230005-0000-4000-8000-000000000002');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values('ac230005-0000-4000-8000-000000000005','TEST PARENT B2C TEACHER','ac230005-0000-4000-8000-000000000003');
insert into public.b2c_classes(id,name,program_slug,teacher_name) values('ac230005-0000-4000-8000-000000000006','TEST PARENT CHILD CLASS','tieng-anh','OTHER TEACHER');
insert into public.b2c_students(id,source_key,full_name,phone) values('ac230005-0000-4000-8000-000000000007','TEST-PARENT-CHILD','TEST PARENT CHILD','0901234567');
insert into public.b2c_enrollments(source_key,class_id,student_id,status) values('TEST-PARENT-ENROLL','ac230005-0000-4000-8000-000000000006','ac230005-0000-4000-8000-000000000007','studying');
insert into public.b2c_parents(full_name) select 'TEST-PARENT-DYNAMIC-'||lpad(n::text,3,'0') from generate_series(1,55) n;
select set_config('request.jwt.claims','{"sub":"ac230005-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert not public.can_manage_b2c_parents(), 'B2B-only teacher denied';
 begin perform public.read_teacher_b2c_parents_page(); raise exception 'B2B parent read accepted'; exception when insufficient_privilege then null; end;
 begin perform public.save_b2c_parent_with_email('{}'); raise exception 'B2B parent write accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"ac230005-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare p uuid; data jsonb; payload jsonb; begin
 assert public.can_manage_b2c_parents(), 'New linked B2C teacher automatically eligible';
 assert (public.read_teacher_b2c_parents_page('TEST-PARENT-DYNAMIC-',0)->>'total')::int=55, 'More than 33 parents visible dynamically';
 assert jsonb_array_length(public.read_teacher_b2c_parents_page('TEST-PARENT-DYNAMIC-',0)->'parents')=50, 'First page bound to 50';
 assert jsonb_array_length(public.read_teacher_b2c_parents_page('TEST-PARENT-DYNAMIC-',1)->'parents')=5, 'Remaining parents available on next page';
 p:=public.save_b2c_parent_with_email(jsonb_build_object('full_name','TEST-PARENT-DYNAMIC-NEW','phone','0901234567','zalo','TEST ZALO','email','parent@example.test','student_codes','[]'::jsonb,'relationship','mother'));
 assert (public.read_teacher_b2c_parents_page('TEST-PARENT-DYNAMIC-',0)->>'total')::int=56, 'New parent increases live total';
 data:=public.read_teacher_b2c_parents_page('TEST-PARENT-DYNAMIC-NEW',0)->'parents'->0;
 assert data->>'phone'='0901234567' and data->>'zalo'='TEST ZALO' and data->>'email'='parent@example.test', 'Contact fields saved and returned';
 payload:=jsonb_build_object('id',p,'full_name','TEST-PARENT-DYNAMIC-NEW','phone','0907654321','zalo','NEW ZALO','email','parent2@example.test','student_codes','[]'::jsonb,'relationship','mother');
 perform public.save_b2c_parent_with_email(payload);
 data:=public.read_teacher_b2c_parents_page('TEST-PARENT-DYNAMIC-NEW',0)->'parents'->0;
 assert data->>'phone'='0907654321' and data->>'zalo'='NEW ZALO', 'Existing parent contact editable';
 begin perform public.save_b2c_parent_with_email(payload||'{"phone":"bad"}'::jsonb); raise exception 'Invalid phone accepted'; exception when invalid_parameter_value then null; end;
 assert (select count(*)=0 from public.b2c_parents where id=p), 'No raw parent table access added';
end $$;
reset role;
do $$ declare p uuid; code text; data jsonb; begin
 select id into p from public.b2c_parents where full_name='TEST-PARENT-DYNAMIC-NEW';
 select s.code into code from public.b2c_students s where id='ac230005-0000-4000-8000-000000000007';
 assert (select created_by='ac230005-0000-4000-8000-000000000001' from public.b2c_parents where id=p), 'Actual creator retained';
 -- Invoke as the teacher with the fixture student code to verify relationship and class projection.
 perform public.save_b2c_parent_with_email(jsonb_build_object('id',p,'full_name','TEST-PARENT-DYNAMIC-NEW','phone','0907654321','zalo','NEW ZALO','student_codes',jsonb_build_array(code),'relationship','mother'));
 data:=public.read_teacher_b2c_parents_page('TEST-PARENT-DYNAMIC-NEW',0)->'parents'->0->'children'->0;
 assert data->>'code'=code and data->>'relationship'='mother', 'Parent linked to child';
 assert data->'classes'->0->>'id'='ac230005-0000-4000-8000-000000000006', 'Child class in limited projection';
end $$;
set local role service_role;
update public.profiles set is_active=false where id='ac230005-0000-4000-8000-000000000001';
reset role;
set local role authenticated;
do $$ begin
 assert not public.can_manage_b2c_parents(), 'Disabled teacher denied';
 begin perform public.read_teacher_b2c_parents_page(); raise exception 'Disabled parent read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'ok: all B2C parent access, dynamic totals over 33, paging, contacts, relationships, actor and disabled accounts';
