begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Fixtures and all mutations are rolled back. Existing data is also compared
-- byte-for-byte to catch accidental broad writes in the new RPCs.
create temporary table original_tuition_packages as select id, to_jsonb(p) data from public.b2c_tuition_packages p;
create temporary table original_tuition_receipts as select id, to_jsonb(r) data from public.b2c_tuition_receipts r;
insert into auth.users(id) values
 ('dc260004-0000-4000-8000-000000000001'), ('dc260004-0000-4000-8000-000000000002'),
 ('dc260004-0000-4000-8000-000000000021');
insert into public.profiles(id, role, full_name, is_active) values
 ('dc260004-0000-4000-8000-000000000001', 'super_admin', 'TEST TOTAL ADMIN', true),
 ('dc260004-0000-4000-8000-000000000002', 'teacher', 'TEST TOTAL TEACHER', true),
 ('dc260004-0000-4000-8000-000000000021', 'teacher', 'TEST TOTAL FULL ACCESS TEACHER', true);
insert into public.teachers(id, user_id) values
 ('dc260004-0000-4000-8000-000000000003', 'dc260004-0000-4000-8000-000000000002'),
 ('dc260004-0000-4000-8000-000000000022', 'dc260004-0000-4000-8000-000000000021');
insert into public.b2c_teachers(id, full_name, source_teacher_id) values
 ('dc260004-0000-4000-8000-000000000004', 'TEST TOTAL TEACHER', 'dc260004-0000-4000-8000-000000000003'),
 ('dc260004-0000-4000-8000-000000000023', 'TEST TOTAL FULL ACCESS TEACHER', 'dc260004-0000-4000-8000-000000000022');
insert into public.b2c_full_access_teachers(teacher_id) values ('dc260004-0000-4000-8000-000000000023');
insert into public.b2c_classes(id, name, program_slug, teacher_name, teacher_id) values
 ('dc260004-0000-4000-8000-000000000005', 'TEST TOTAL CLASS', 'tieng-anh', 'TEST TOTAL TEACHER', 'dc260004-0000-4000-8000-000000000004'),
 ('dc260004-0000-4000-8000-000000000015', 'TEST TOTAL OTHER CLASS', 'tieng-anh', '', null);
insert into public.b2c_students(id, source_key, full_name) values
 ('dc260004-0000-4000-8000-000000000006', 'TEST-TOTAL-STUDENT', 'TEST TOTAL STUDENT'),
 ('dc260004-0000-4000-8000-000000000016', 'TEST-TOTAL-ZERO', 'TEST TOTAL ZERO');
insert into public.b2c_enrollments(id, source_key, class_id, student_id, status) values
 ('dc260004-0000-4000-8000-000000000007', 'TEST-TOTAL-ENROLLMENT', 'dc260004-0000-4000-8000-000000000005', 'dc260004-0000-4000-8000-000000000006', 'studying'),
 ('dc260004-0000-4000-8000-000000000017', 'TEST-TOTAL-ZERO-ENROLLMENT', 'dc260004-0000-4000-8000-000000000015', 'dc260004-0000-4000-8000-000000000016', 'studying');
select set_config('request.jwt.claims', '{"sub":"dc260004-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.save_b2c_teacher_permissions(
 'dc260004-0000-4000-8000-000000000004', 'dc260004-0000-4000-8000-000000000003',
 array['view_classes', 'view_students', 'view_tuition', 'edit_tuition', 'collect_tuition', 'manage_center_tuition'], null);
select throws_ok($$select public.save_b2c_tuition_package_amounts('dc260004-0000-4000-8000-000000000017',
 1,100,0,'','',null,1,0)$$, '40001', null, 'Initial creation rejects a nonzero paid snapshot');
select set_config('test.zero', public.save_b2c_tuition_package_amounts('dc260004-0000-4000-8000-000000000017',
 1,100,0,'','',null,0,0)::text, true);
select is((select total_due from public.b2c_tuition_packages where id=current_setting('test.zero')::uuid),
 0::numeric, 'Initial manual zero is distinct from automatic calculation');
select is((select total_due_override from public.b2c_tuition_packages where id=current_setting('test.zero')::uuid),
 0::numeric, 'Initial zero retains manual mode');
select throws_ok($$select public.record_b2c_tuition_receipt(current_setting('test.zero')::uuid,
 gen_random_uuid(),'2026-05-20',1,'cash','TEST')$$, '22023', null, 'Receipt cannot exceed an explicit zero total');
select throws_ok($$update public.b2c_tuition_packages set total_due_override=200 where id=current_setting('test.zero')::uuid$$,
 '42501', null, 'Direct override updates have no grant');
select throws_ok($$insert into public.b2c_tuition_packages(enrollment_id,sessions,unit_price,discount,total_due_override)
 values('dc260004-0000-4000-8000-000000000007',1,100,0,100)$$, '42501', null, 'Direct override inserts have no grant');

select set_config('request.jwt.claims', '{"sub":"dc260004-0000-4000-8000-000000000002","role":"authenticated"}', true);
-- The November full-access policy superseded the earlier center-tuition scope:
-- ordinary teachers remain class-scoped; explicit full-access members may edit
-- any class (the permission path used by Co Le/Co Thy, without using real users).
select throws_ok($$select public.save_b2c_tuition_package_amounts('dc260004-0000-4000-8000-000000000017',
 1,100,0,'','Denied outside class',0,0,0)$$, '42501', null, 'Center permission alone does not grant cross-class writes under current policy');
select set_config('request.jwt.claims', '{"sub":"dc260004-0000-4000-8000-000000000021","role":"authenticated"}', true);
select lives_ok($$select public.save_b2c_tuition_package_amounts('dc260004-0000-4000-8000-000000000017',
 1,100,0,'','Explicit full access',0,0,0)$$, 'Explicit full-access teacher retains cross-class amount editing');
select set_config('request.jwt.claims', '{"sub":"dc260004-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('test.period1', public.save_b2c_tuition_package_amounts('dc260004-0000-4000-8000-000000000007',
 10,100000,0,'','',null,0,null)::text, true);
select is((public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->>'total_due')::numeric,
 1000000::numeric, 'Null total automatically calculates the initial package');
select is(public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->'total_due_override',
 'null'::jsonb, 'Reader exposes automatic mode explicitly');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 10,100000,0,'',' ',1000000,0,900000)$$, '22023', null, 'Manual-total-only edit requires a reason');
select lives_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 10,100000,0,'','Agreed total',1000000,0,900000)$$, 'Teacher may save an independent manual total');
select is((public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->>'total_due')::numeric,
 900000::numeric, 'Manual total takes precedence over the formula');
select is((public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->>'total_due_override')::numeric,
 900000::numeric, 'Teacher center projection returns manual mode and value');
select is((public.read_center_b2c_tuition_page('TEST TOTAL STUDENT',0)->'rows'->0->>'total_due_override')::numeric,
 900000::numeric, 'Legacy teacher center projection returns manual total');
select is((public.read_b2c_class_tuition_periods('dc260004-0000-4000-8000-000000000005',0,'')->'rows'->0->>'total_due_override')::numeric,
 900000::numeric, 'Class period projection returns manual total');
select is((public.read_teacher_b2c_workspace('dc260004-0000-4000-8000-000000000005','tuition',0,'',null)->'rows'->0->>'total_due_override')::numeric,
 900000::numeric, 'Legacy teacher class tuition projection returns manual total');
select ok(not (public.read_teacher_b2c_workspace('dc260004-0000-4000-8000-000000000005','students',0,'',null)->'rows'->0 ? 'total_due_override'),
 'Teacher roster does not leak the financial override');
select throws_ok($$select public.save_b2c_tuition_period(current_setting('test.period1')::uuid,
 10,100000,0,'','Old editor',900000,0)$$, '40001', null, 'Legacy period editor cannot accidentally preserve or reset manual total');
select throws_ok($$select public.save_b2c_tuition_package_with_reason('dc260004-0000-4000-8000-000000000007',
 10,100000,0,'','Old editor',900000,0)$$, '40001', null, 'Legacy enrollment editor rejects a manual package');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 10,100000,0,'','Stale',1000000,0,850000)$$, '40001', null, 'Manual edit compares expected effective total');
select lives_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Update components',900000,0,900000)$$, 'Components can change while preserving an explicitly supplied manual total');
select is((public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->>'sessions')::int,12,'Sessions save independently');
select is((public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->>'unit_price')::numeric,125000::numeric,'Unit price saves independently');
select is((public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->>'discount')::numeric,100000::numeric,'Discount saves independently');
select is((public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->>'total_due')::numeric,900000::numeric,'Manual total does not get recomputed on storage');
select lives_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Free agreement',900000,0,0)$$, 'Existing package permits manual zero');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Invalid',0,0,-1)$$, '22023', null, 'Negative manual total rejected');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Invalid',0,0,1.5)$$, '22023', null, 'Fractional total rejected without rounding');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Invalid',0,0,1000000000001)$$, '22023', null, 'Manual total upper bound enforced');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Invalid',0,0,'NaN')$$, '22023', null, 'NaN total rejected');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Invalid',0,0,'Infinity')$$, '22023', null, 'Infinite total rejected');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000.5,100000,'Promotion','Invalid',0,0,900000)$$, '22023', null, 'Manual mode does not bypass integer component validation');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 0,125000,0,'','Invalid',0,0,900000)$$, '23514', null, 'Manual mode does not bypass session validation');
select lives_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Higher agreement',0,0,1600000)$$, 'Manual total may exceed the component subtotal');
select public.record_b2c_tuition_receipt(current_setting('test.period1')::uuid,
 'dc260004-0000-4000-8000-000000000008','2026-05-20',600000,'cash','TEST TOTAL TEACHER');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Stale payment',1600000,0,500000)$$, '40001', null, 'Manual edit checks concurrent receipt snapshot');
select lives_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Lower agreement',1600000,600000,500000)$$, 'Editing total below paid retains the existing signed-balance behavior');
select is((public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->>'balance')::numeric,
 (-100000)::numeric, 'Signed balance uses manual total and original receipt');
select throws_ok($$select public.record_b2c_tuition_receipt(current_setting('test.period1')::uuid,
 gen_random_uuid(),'2026-05-20',1,'cash','TEST')$$, '22023', null, 'Receipt guard uses effective manual total');
select lives_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Return to formula',500000,600000,null)$$, 'Null clears manual mode');
select is((public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->>'total_due')::numeric,
 1400000::numeric, 'Returning to automatic mode recalculates from saved components');
select lives_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period1')::uuid,
 12,125000,100000,'Promotion','Lock same effective total',1400000,600000,1400000)$$, 'Manual mode may equal the formula without losing its meaning');

select set_config('request.jwt.claims', '{"sub":"dc260004-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((public.get_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->>'total_due_override')::numeric,
 1400000::numeric, 'Manager period projection returns manual total');
select is((public.get_b2c_tuition_page('TEST TOTAL STUDENT',0)->'rows'->0->>'total_due_override')::numeric,
 1400000::numeric, 'Legacy manager projection returns manual total');
select is((public.read_b2c_class_workspace('dc260004-0000-4000-8000-000000000005','tuition',0,'',null)->'rows'->0->>'total_due_override')::numeric,
 1400000::numeric, 'Legacy manager class projection returns manual total');
select ok(exists(select 1 from public.b2c_change_history where entity_id=current_setting('test.period1')::uuid
 and before_data->>'total_due'='1000000' and after_data->>'total_due'='900000'
 and after_data->>'total_due_override'='900000' and after_data->>'adjustment_reason'='Agreed total'
 and actor_id='dc260004-0000-4000-8000-000000000002'), 'Manual-only adjustment is audited under real teacher actor');
select ok(exists(select 1 from public.b2c_change_history where entity_id=current_setting('test.period1')::uuid
 and before_data->>'total_due'='1400000' and after_data->>'total_due'='1400000'
 and before_data->'total_due_override'='null'::jsonb and after_data->>'total_due_override'='1400000'),
 'Mode-only change is audited even when effective total is unchanged');
select is((select amount from public.b2c_tuition_receipts where request_id='dc260004-0000-4000-8000-000000000008'),
 600000::numeric, 'Price and mode edits do not change receipts');

select set_config('request.jwt.claims', '{"sub":"dc260004-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.start_b2c_tuition_period_amounts('dc260004-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260004-0000-4000-8000-000000000009',20,100000,200000,'Promotion','New period',1400000,600000,1.5)$$,
 '22023',null,'New-period RPC rejects fractional manual total');
select set_config('test.period2',public.start_b2c_tuition_period_amounts('dc260004-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260004-0000-4000-8000-000000000009',20,100000,200000,'Promotion','New period',1400000,600000,2000000)::text,true);
select is(public.start_b2c_tuition_period_amounts('dc260004-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260004-0000-4000-8000-000000000009',20,100000,200000,'Promotion','New period',1400000,600000,2000000),
 current_setting('test.period2')::uuid, 'Same request and total return the same new period');
select throws_ok($$select public.start_b2c_tuition_period_amounts('dc260004-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260004-0000-4000-8000-000000000009',20,100000,200000,'Promotion','New period',1400000,600000,2100000)$$,
 '22023',null,'Retry cannot change only the total');
select throws_ok($$select public.start_b2c_tuition_period_amounts('dc260004-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260004-0000-4000-8000-000000000009',20,100000,200000,'Promotion','New period',1400000,600000,null)$$,
 '22023',null,'Retry cannot switch from manual to automatic');
select throws_ok($$select public.start_b2c_tuition_period_amounts('dc260004-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260004-0000-4000-8000-000000000010',20,100000,200000,'Promotion','New period',1400000,600000,2000000)$$,
 '40001',null,'A second request against the closed period is stale');
select is((public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->0->>'paid_amount')::numeric,
 0::numeric,'Manual new period starts unpaid');
select is((public.read_center_b2c_tuition_period_page('TEST TOTAL STUDENT',0)->'rows'->1->>'total_due_override')::numeric,
 1400000::numeric,'Previous manual total remains intact');
select lives_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period2')::uuid,
 20,100000,200000,'Promotion','Correct new total',2000000,0,1900000)$$,'Current period can be explicitly edited');
select is(public.start_b2c_tuition_period_amounts('dc260004-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260004-0000-4000-8000-000000000009',20,100000,200000,'Promotion','New period',1400000,600000,2000000),
 current_setting('test.period2')::uuid,'Retry compares immutable creation payload after later edits');
select throws_ok($$select public.save_b2c_tuition_package_amounts('dc260004-0000-4000-8000-000000000007',
 20,100000,200000,'Promotion','Wrong identity',1900000,0,1800000)$$,'40001',null,'Enrollment RPC cannot edit arbitrary later period');
select public.record_b2c_tuition_receipt(current_setting('test.period2')::uuid,
 'dc260004-0000-4000-8000-000000000011','2026-05-20',1000000,'cash','TEST TOTAL TEACHER');
select set_config('test.correction', jsonb_build_object(
 'request_id','dc260004-0000-4000-8000-000000000012','package_id',current_setting('test.period2')::uuid,
 'receipt_id',(public.read_b2c_permitted_receipts(current_setting('test.period2')::uuid,0)->'receipts'->0->>'id')::uuid,
 'kind','refund','amount',200000,'reason','Refund manual fee','effective_date','2026-05-21',
 'method','bank_transfer','reduce_fee',true,'expected_due',1900000,'expected_paid',1000000)::text,true);
select throws_ok($$select public.correct_b2c_tuition(current_setting('test.correction')::jsonb)$$,
 '42501',null,'Edit permission does not grant financial-correction permission');
select set_config('request.jwt.claims', '{"sub":"dc260004-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.correct_b2c_tuition(current_setting('test.correction')::jsonb)$$,
 'Authorized refund reduces manual total');
select is((select total_due from public.b2c_tuition_packages where id=current_setting('test.period2')::uuid),1700000::numeric,
 'Refund effective total decreases by refunded amount');
select is((select total_due_override from public.b2c_tuition_packages where id=current_setting('test.period2')::uuid),1700000::numeric,
 'Refund retains manual mode');
select is((select discount from public.b2c_tuition_packages where id=current_setting('test.period2')::uuid),200000::numeric,
 'Manual refund leaves independently entered discount unchanged');
select is((select effective_amount from public.b2c_tuition_receipts where request_id='dc260004-0000-4000-8000-000000000011'),800000::numeric,
 'Refund changes effective receipt settlement');
select lives_ok($$select public.correct_b2c_tuition(current_setting('test.correction')::jsonb)$$,
 'Refund retry remains idempotent');
select is((select count(*) from public.b2c_tuition_corrections where package_id=current_setting('test.period2')::uuid),1::bigint,
 'Manual refund retry creates one correction');
select lives_ok($$select public.correct_b2c_tuition(current_setting('test.correction')::jsonb ||
 '{"request_id":"dc260004-0000-4000-8000-000000000013","amount":100000,"reduce_fee":false,"expected_due":1700000,"expected_paid":800000}')$$,
 'Refund may retain manual fee');
select is((select total_due from public.b2c_tuition_packages where id=current_setting('test.period2')::uuid),1700000::numeric,
 'Retaining fee leaves manual total unchanged');
select lives_ok($$select public.correct_b2c_tuition(current_setting('test.correction')::jsonb ||
 '{"request_id":"dc260004-0000-4000-8000-000000000014","kind":"adjust","receipt_id":null,"amount":1600000,"reduce_fee":false,"expected_due":1700000,"expected_paid":700000}')$$,
 'Financial adjustment updates manual total');
select is((select total_due from public.b2c_tuition_packages where id=current_setting('test.period2')::uuid),1600000::numeric,
 'Financial adjustment actually changes effective total in manual mode');
select is((select discount from public.b2c_tuition_packages where id=current_setting('test.period2')::uuid),200000::numeric,
 'Manual adjustment preserves component discount');
select throws_ok($$select public.correct_b2c_tuition(current_setting('test.correction')::jsonb ||
 '{"request_id":"dc260004-0000-4000-8000-000000000018","kind":"adjust","receipt_id":null,"amount":699999,"reduce_fee":false,"expected_due":1600000,"expected_paid":700000}')$$,
 '22023',null,'Financial correction retains existing below-net-paid restriction');
select public.record_b2c_tuition_receipt(current_setting('test.period2')::uuid,
 'dc260004-0000-4000-8000-000000000019','2026-05-20',200000,'cash','TEST TOTAL TEACHER');
select lives_ok($$select public.correct_b2c_tuition(current_setting('test.correction')::jsonb || jsonb_build_object(
 'request_id','dc260004-0000-4000-8000-000000000020','kind','cancel','receipt_id',
 (select id from public.b2c_tuition_receipts where request_id='dc260004-0000-4000-8000-000000000019'),
 'amount',200000,'reduce_fee',false,'expected_due',1600000,'expected_paid',900000))$$,
 'Cancellation works with a manual total');
select is((select total_due from public.b2c_tuition_packages where id=current_setting('test.period2')::uuid),1600000::numeric,
 'Cancellation leaves the manual receivable unchanged');
select is((select amount from public.b2c_tuition_receipts where request_id='dc260004-0000-4000-8000-000000000011'),1000000::numeric,
 'All corrections preserve original receipt amount');
select is((select count(*) from public.b2c_tuition_packages where enrollment_id='dc260004-0000-4000-8000-000000000007'),2::bigint,
 'Manual period retry creates no duplicate package');
select is((select count(*) from public.b2c_tuition_packages where enrollment_id='dc260004-0000-4000-8000-000000000007' and is_current),1::bigint,
 'Exactly one manual period is current');
select lives_ok($$select public.archive_b2c_center_record('package',current_setting('test.zero')::uuid,'Archive zero fixture')$$,
 'Manual zero package with no receipts may be archived');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.zero')::uuid,
 1,100,0,'','Archived',0,0,50)$$,'42501',null,'Amount editor cannot mutate an archived package');
reset role;
update public.b2c_teacher_permissions set permissions=array['view_classes','view_students']
where teacher_id='dc260004-0000-4000-8000-000000000004';
select set_config('request.jwt.claims', '{"sub":"dc260004-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select ok(not (public.read_teacher_b2c_workspace('dc260004-0000-4000-8000-000000000005','students',0,'',null)->'rows'->0 ? 'total_due_override'),
 'Roster-only teacher cannot see manual totals');
select throws_ok($$select public.read_b2c_class_tuition_periods('dc260004-0000-4000-8000-000000000005',0,'')$$,
 '42501',null,'Financial period read denied after permission revocation');
select throws_ok($$select public.save_b2c_tuition_period_amounts(current_setting('test.period2')::uuid,
 20,100000,200000,'Promotion','Denied',1600000,700000,1800000)$$,'42501',null,'New period editor respects permission revocation');
select throws_ok($$select public.start_b2c_tuition_period_amounts('dc260004-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260004-0000-4000-8000-000000000009',20,100000,200000,'Promotion','New period',1400000,600000,2000000)$$,
 '42501',null,'Exact retry still requires current permission');
reset role;
set local role anon;
select throws_ok($$select public.save_b2c_tuition_package_amounts('dc260004-0000-4000-8000-000000000007',
 1,1,0,'','',null,0,1)$$,'42501',null,'Anonymous cannot call amount mutation');
reset role;
select ok(not exists(select 1 from original_tuition_packages o full join
 (select id,to_jsonb(p) data from public.b2c_tuition_packages p where id in(select id from original_tuition_packages)) n using(id)
 where o.data is distinct from n.data),'Existing packages, timestamps and metadata remain unchanged');
select ok(not exists(select 1 from original_tuition_receipts o full join
 (select id,to_jsonb(r) data from public.b2c_tuition_receipts r where id in(select id from original_tuition_receipts)) n using(id)
 where o.data is distinct from n.data),'Existing receipts remain unchanged');
select * from finish();
rollback;
