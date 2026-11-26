begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Isolated identities and financial fixtures; everything rolls back.
insert into auth.users(id) values
 ('dc260001-0000-4000-8000-000000000001'),
 ('dc260001-0000-4000-8000-000000000002');
insert into public.profiles(id,role,full_name,is_active) values
 ('dc260001-0000-4000-8000-000000000001','super_admin','TEST OVERPAY ADMIN',true),
 ('dc260001-0000-4000-8000-000000000002','teacher','TEST OVERPAY TEACHER',true);
insert into public.teachers(id,user_id) values
 ('dc260001-0000-4000-8000-000000000003','dc260001-0000-4000-8000-000000000002');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values
 ('dc260001-0000-4000-8000-000000000004','TEST OVERPAY TEACHER','dc260001-0000-4000-8000-000000000003');
insert into public.b2c_classes(id,name,program_slug,teacher_name,teacher_id) values
 ('dc260001-0000-4000-8000-000000000005','TEST OVERPAY CLASS','tieng-anh','TEST OVERPAY TEACHER','dc260001-0000-4000-8000-000000000004');
insert into public.b2c_students(id,source_key,full_name) values
 ('dc260001-0000-4000-8000-000000000006','TEST-OVERPAY-STUDENT','TEST OVERPAY STUDENT');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status) values
 ('dc260001-0000-4000-8000-000000000007','TEST-OVERPAY-ENROLLMENT','dc260001-0000-4000-8000-000000000005','dc260001-0000-4000-8000-000000000006','studying');

select set_config('request.jwt.claims','{"sub":"dc260001-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.save_b2c_teacher_permissions(
 'dc260001-0000-4000-8000-000000000004','dc260001-0000-4000-8000-000000000003',
 array['view_classes','view_tuition','edit_tuition','collect_tuition','manage_center_tuition'],null);
select set_config('test.overpay_package',public.save_b2c_tuition_package_with_reason(
 'dc260001-0000-4000-8000-000000000007',32,120000,145000,'Promotion','',null,0)::text,true);
select public.record_b2c_tuition_receipt(current_setting('test.overpay_package')::uuid,
 'dc260001-0000-4000-8000-000000000008',current_date,3695000,'cash','TEST OVERPAY ADMIN');

-- Exercise the same edit capability used in a teacher's class workspace.
select set_config('request.jwt.claims','{"sub":"dc260001-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.save_b2c_tuition_package_with_reason(
 'dc260001-0000-4000-8000-000000000007',24,120000,100000,'Promotion','Correct package',3695000,3695000)$$,
 'Permitted teacher saves fee below paid');
select is((public.read_center_b2c_tuition_page('TEST OVERPAY STUDENT',0)->'rows'->0->>'total_due')::numeric,2780000::numeric,'New fee saved');
select is((public.read_center_b2c_tuition_page('TEST OVERPAY STUDENT',0)->'rows'->0->>'paid_amount')::numeric,3695000::numeric,'Net paid unchanged');
select is((public.read_center_b2c_tuition_page('TEST OVERPAY STUDENT',0)->'rows'->0->>'balance')::numeric,(-915000)::numeric,'Signed balance preserves credit');
select throws_ok($$select public.record_b2c_tuition_receipt(current_setting('test.overpay_package')::uuid,
 'dc260001-0000-4000-8000-000000000009',current_date,1,'cash','TEST')$$,'22023',null,'Cannot collect more on an overpaid package');
select lives_ok($$select public.record_b2c_tuition_receipt(current_setting('test.overpay_package')::uuid,
 'dc260001-0000-4000-8000-000000000008',current_date,3695000,'cash','TEST OVERPAY ADMIN')$$,'Original receipt retry remains idempotent');
select throws_ok($$select public.save_b2c_tuition_package_with_reason(
 'dc260001-0000-4000-8000-000000000007',24,120000,0,'',' ',2780000,3695000)$$,'22023',null,'Reason still required');
select throws_ok($$select public.save_b2c_tuition_package_with_reason(
 'dc260001-0000-4000-8000-000000000007',24,120000,0,'','Correct package',3695000,3695000)$$,'40001',null,'Stale due rejected');
select throws_ok($$select public.save_b2c_tuition_package_with_reason(
 'dc260001-0000-4000-8000-000000000007',24,120000,0,'','Correct package',2780000,3694999)$$,'40001',null,'Stale paid rejected');
select throws_ok($$select public.save_b2c_tuition_package_with_reason(
 'dc260001-0000-4000-8000-000000000007',24,120000,2880001,'Promotion','Correct package',2780000,3695000)$$,'23514',null,'Negative fee rejected');
select lives_ok($$select public.save_b2c_tuition_package_with_reason(
 'dc260001-0000-4000-8000-000000000007',24,120000,0,'','Correct again',2780000,3695000)$$,'Can edit an already overpaid package');

select set_config('request.jwt.claims','{"sub":"dc260001-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select amount from public.b2c_tuition_receipts where request_id='dc260001-0000-4000-8000-000000000008'),3695000::numeric,'Original receipt amount preserved');
select is((select count(*) from public.b2c_tuition_receipts where package_id=current_setting('test.overpay_package')::uuid),1::bigint,'No extra receipt from correction or retry');
select ok(exists(select 1 from public.b2c_change_history
 where enrollment_id='dc260001-0000-4000-8000-000000000007' and entity_type='tuition_package'
 and before_data->>'total_due'='3695000' and after_data->>'total_due'='2780000'
 and after_data->>'adjustment_reason'='Correct package'), 'Package correction retains before/after and reason in audit');
select is((public.get_b2c_tuition_page('TEST OVERPAY STUDENT',0)->'rows'->0->>'balance')::numeric,(-815000)::numeric,'Manager reads the same credit');
select is((public.read_b2c_class_workspace('dc260001-0000-4000-8000-000000000005','tuition',0,'',null)->'stats'->>'paid_amount')::numeric,3695000::numeric,'Class workspace preserves paid amount');

-- An actual refund remains a separate action and uses effective/net paid.
select lives_ok($$select public.correct_b2c_tuition(jsonb_build_object(
 'request_id','dc260001-0000-4000-8000-000000000010','package_id',current_setting('test.overpay_package'),
 'receipt_id',(select id from public.b2c_tuition_receipts where request_id='dc260001-0000-4000-8000-000000000008'),
 'kind','refund','amount',100000,'reason','Return part of credit','effective_date',current_date,
 'method','cash','reduce_fee',false,'expected_due',2880000,'expected_paid',3695000))$$,'Can refund part of credit without changing package');
select is((public.get_b2c_tuition_page('TEST OVERPAY STUDENT',0)->'rows'->0->>'balance')::numeric,(-715000)::numeric,'Credit uses net paid after refund');
select lives_ok($$select public.save_b2c_tuition_package_with_reason(
 'dc260001-0000-4000-8000-000000000007',32,120000,245000,'Promotion','Match net paid',2880000,3595000)$$,'Can set fee equal to net paid');
select is((public.get_b2c_tuition_page('TEST OVERPAY STUDENT',0)->'rows'->0->>'balance')::numeric,0::numeric,'Equal fee clears credit');
select lives_ok($$select public.save_b2c_tuition_package_with_reason(
 'dc260001-0000-4000-8000-000000000007',32,120000,0,'','Restore full package',3595000,3595000)$$,'Can increase fee above net paid');
select lives_ok($$select public.record_b2c_tuition_receipt(current_setting('test.overpay_package')::uuid,
 'dc260001-0000-4000-8000-000000000011',current_date,245000,'cash','TEST')$$,'Collection works again up to remaining fee');

reset role;
update public.b2c_teacher_permissions set permissions=array['view_classes'] where teacher_id='dc260001-0000-4000-8000-000000000004';
select set_config('request.jwt.claims','{"sub":"dc260001-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.save_b2c_tuition_package_with_reason(
 'dc260001-0000-4000-8000-000000000007',24,120000,0,'','No permission',3840000,3840000)$$,'42501',null,'Revoked teacher cannot reduce package');
reset role;
set local role anon;
select throws_ok($$select public.save_b2c_tuition_package_with_reason(
 'dc260001-0000-4000-8000-000000000007',24,120000,0,'','Anonymous',3840000,3840000)$$,'42501',null,'Anonymous caller rejected');
reset role;
select * from finish();
rollback;
