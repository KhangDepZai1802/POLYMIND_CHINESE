begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id) values
 ('dc260002-0000-4000-8000-000000000001'),('dc260002-0000-4000-8000-000000000002');
insert into public.profiles(id,role,full_name,is_active) values
 ('dc260002-0000-4000-8000-000000000001','super_admin','TEST PERIOD ADMIN',true),
 ('dc260002-0000-4000-8000-000000000002','teacher','TEST PERIOD TEACHER',true);
insert into public.teachers(id,user_id) values
 ('dc260002-0000-4000-8000-000000000003','dc260002-0000-4000-8000-000000000002');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values
 ('dc260002-0000-4000-8000-000000000004','TEST PERIOD TEACHER','dc260002-0000-4000-8000-000000000003');
insert into public.b2c_classes(id,name,program_slug,teacher_name,teacher_id) values
 ('dc260002-0000-4000-8000-000000000005','TEST PERIOD CLASS','tieng-anh','TEST PERIOD TEACHER','dc260002-0000-4000-8000-000000000004');
insert into public.b2c_students(id,source_key,full_name) values
 ('dc260002-0000-4000-8000-000000000006','TEST-PERIOD-STUDENT','TEST PERIOD STUDENT');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status) values
 ('dc260002-0000-4000-8000-000000000007','TEST-PERIOD-ENROLLMENT','dc260002-0000-4000-8000-000000000005','dc260002-0000-4000-8000-000000000006','studying');
select set_config('request.jwt.claims','{"sub":"dc260002-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.save_b2c_teacher_permissions(
 'dc260002-0000-4000-8000-000000000004','dc260002-0000-4000-8000-000000000003',
 array['view_classes','view_students','view_tuition','edit_tuition','collect_tuition','manage_center_tuition','delete_center_records'],null);
select set_config('test.period1',public.save_b2c_tuition_package_with_reason(
 'dc260002-0000-4000-8000-000000000007',36,108194,199984,'Promotion','',null,0)::text,true);
select public.record_b2c_tuition_receipt(current_setting('test.period1')::uuid,
 'dc260002-0000-4000-8000-000000000008','2026-05-20',3695000,'bank_transfer','TEST PERIOD TEACHER');
select set_config('request.jwt.claims','{"sub":"dc260002-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.start_b2c_tuition_period('dc260002-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260002-0000-4000-8000-000000000009',24,120000,100000,'Promotion','New period',3695000,0)$$,
 '40001',null,'Stale receipt snapshot rejected');
select throws_ok($$select public.start_b2c_tuition_period('dc260002-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260002-0000-4000-8000-000000000009',24,120000,2880001,'Promotion','New period',3695000,3695000)$$,
 '23514',null,'Invalid new package rolls back closure of old period');
select set_config('test.period2',public.start_b2c_tuition_period('dc260002-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260002-0000-4000-8000-000000000009',24,120000,100000,'Promotion','New period',3695000,3695000)::text,true);
select is(public.start_b2c_tuition_period('dc260002-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260002-0000-4000-8000-000000000009',24,120000,100000,'Promotion','New period',3695000,3695000),
 current_setting('test.period2')::uuid,'Identical retry returns same package');
select throws_ok($$select public.start_b2c_tuition_period('dc260002-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260002-0000-4000-8000-000000000009',24,120000,0,'','New period',3695000,3695000)$$,
 '22023',null,'Request ID cannot be reused for another payload');
select throws_ok($$select public.start_b2c_tuition_period('dc260002-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260002-0000-4000-8000-000000000010',24,120000,100000,'Promotion','New period',3695000,3695000)$$,
 '40001',null,'Second request against old period is stale');
select throws_ok($$select public.save_b2c_tuition_package_with_reason('dc260002-0000-4000-8000-000000000007',
 24,120000,0,'','Old client',2780000,0)$$,'40001',null,'Legacy editing cannot overwrite a later period');
select is((public.read_center_b2c_tuition_period_page('TEST PERIOD STUDENT',0)->>'total')::int,2,'Teacher sees both periods');
select is((public.read_center_b2c_tuition_period_page('TEST PERIOD STUDENT',0)->'rows'->0->>'period_no')::int,2,'New period sorted first');
select is((public.read_center_b2c_tuition_period_page('TEST PERIOD STUDENT',0)->'rows'->0->>'paid_amount')::numeric,0::numeric,'New period starts unpaid');
select is((public.read_center_b2c_tuition_period_page('TEST PERIOD STUDENT',0)->'rows'->1->>'balance')::numeric,0::numeric,'Old period remains settled');
select is((public.read_center_b2c_tuition_page('TEST PERIOD STUDENT',0)->>'total')::int,1,'Legacy teacher reader has one current row');
select is((public.read_teacher_b2c_workspace('dc260002-0000-4000-8000-000000000005','students',0,'',null)->>'total')::int,1,'Student count stays one');
select is(jsonb_array_length(public.read_teacher_b2c_workspace('dc260002-0000-4000-8000-000000000005','students',0,'',null)->'rows'),1,'Student rows do not duplicate');
select is((public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000005',0,'')->>'total')::int,2,'Class tuition counts periods');
select is((public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000005',0,'')->'stats'->>'total_due')::numeric
 -(public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000005',0,'')->'stats'->>'paid_amount')::numeric,
 2780000::numeric,'Class debt belongs to new period');
select is((public.read_b2c_permitted_receipts(current_setting('test.period1')::uuid,0)->'receipts'->0->>'paid_date'),'2026-05-20','Old receipt remains readable with original date');
select is((public.read_b2c_permitted_receipts(current_setting('test.period2')::uuid,0)->>'total')::int,0,'No receipt copied to new period');
select lives_ok($$select public.save_b2c_tuition_period(current_setting('test.period2')::uuid,24,120000,0,'','Correct new period',2780000,0)$$,'Explicit ID edits new period');
select lives_ok($$select public.save_b2c_tuition_period(current_setting('test.period1')::uuid,36,108194,199984,'Promotion','Keep old period',3695000,3695000)$$,'Explicit ID supports historical correction');
select throws_ok($$select public.save_b2c_tuition_period(current_setting('test.period2')::uuid,24,120000,0,'','Stale',2780000,0)$$,'40001',null,'Period edit checks stale balance');
select throws_ok($$select public.archive_b2c_center_record('package',current_setting('test.period2')::uuid,'Archive current')$$,'22023',
 'Không thể lưu trữ đợt hiện tại khi còn lịch sử học phí. Hãy điều chỉnh đúng đợt.','Cannot orphan historical periods by archiving current');

select set_config('request.jwt.claims','{"sub":"dc260002-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((public.get_b2c_tuition_period_page('TEST PERIOD STUDENT',0)->>'total')::int,2,'Manager sees both periods');
select is((public.get_b2c_tuition_period_page('TEST PERIOD STUDENT',0)->>'paid_amount')::numeric,3695000::numeric,'Manager historical revenue preserved');
select is((public.get_b2c_tuition_page('TEST PERIOD STUDENT',0)->>'total')::int,1,'Legacy manager reader current only');
select is(jsonb_array_length(public.read_b2c_class_workspace('dc260002-0000-4000-8000-000000000005','students',0,'',null)->'rows'),1,'Manager roster not duplicated');
select is((select count(*) from public.b2c_tuition_packages where enrollment_id='dc260002-0000-4000-8000-000000000007'),2::bigint,'Retry created no duplicate period');
select is((select count(*) from public.b2c_tuition_packages where enrollment_id='dc260002-0000-4000-8000-000000000007' and is_current),1::bigint,'Only one current period');
select ok(exists(select 1 from public.b2c_change_history where entity_id=current_setting('test.period1')::uuid
 and before_data->>'is_current'='true' and after_data->>'is_current'='false'
 and actor_id='dc260002-0000-4000-8000-000000000002'),'Period closure audited under real teacher');
select throws_ok($$update public.b2c_tuition_packages set is_current=true where id=current_setting('test.period1')::uuid$$,'42501',null,'Direct lifecycle metadata updates denied');
select throws_ok($$insert into public.b2c_tuition_packages(enrollment_id,sessions,unit_price,discount,period_no,is_current)
 values('dc260002-0000-4000-8000-000000000007',1,1,0,99,false)$$,'42501',null,'Direct period metadata inserts denied');
reset role;
-- More periods than either reader's page size must be paginated before rows
-- leave SQL. Separate fixtures also cover no package and archived students.
insert into public.b2c_classes(id,name,program_slug,teacher_name,teacher_id) values
 ('dc260002-0000-4000-8000-000000000020','TEST PERIOD PAGE CLASS','tieng-anh','TEST PERIOD TEACHER','dc260002-0000-4000-8000-000000000004'),
 ('dc260002-0000-4000-8000-000000000021','TEST PERIOD OTHER CLASS','tieng-anh','',null);
insert into public.b2c_students(id,source_key,full_name) values
 ('dc260002-0000-4000-8000-000000000022','TEST-PERIOD-PAGINATION','TEST PERIOD PAGINATION'),
 ('dc260002-0000-4000-8000-000000000023','TEST-PERIOD-UNCONFIGURED','TEST PERIOD UNCONFIGURED'),
 ('dc260002-0000-4000-8000-000000000024','TEST-PERIOD-ARCHIVED','TEST PERIOD ARCHIVED');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status) values
 ('dc260002-0000-4000-8000-000000000025','TEST-PERIOD-PAGINATION-ENROLLMENT','dc260002-0000-4000-8000-000000000020','dc260002-0000-4000-8000-000000000022','studying'),
 ('dc260002-0000-4000-8000-000000000026','TEST-PERIOD-UNCONFIGURED-ENROLLMENT','dc260002-0000-4000-8000-000000000020','dc260002-0000-4000-8000-000000000023','studying'),
 ('dc260002-0000-4000-8000-000000000027','TEST-PERIOD-ARCHIVED-ENROLLMENT','dc260002-0000-4000-8000-000000000020','dc260002-0000-4000-8000-000000000024','studying');
create temporary table b2c_period_read_pages(reader text primary key,pages jsonb,expected_sizes integer[]) on commit drop;
grant select,insert on b2c_period_read_pages to authenticated;
set local role authenticated;
do $$
declare v_previous uuid;
begin
 v_previous:=public.save_b2c_tuition_package_with_reason('dc260002-0000-4000-8000-000000000025',1,1000,0,'','',null,0);
 for i in 2..53 loop
  v_previous:=public.start_b2c_tuition_period('dc260002-0000-4000-8000-000000000025',v_previous,gen_random_uuid(),
   1,1000,0,'','Pagination fixture',1000,0);
 end loop;
end;
$$;
select public.save_b2c_tuition_package_with_reason('dc260002-0000-4000-8000-000000000027',1,1000,0,'','',null,0);
select public.archive_b2c_center_record('student','dc260002-0000-4000-8000-000000000024','Archived student fixture');
insert into b2c_period_read_pages
select 'Manager',jsonb_agg(public.get_b2c_tuition_period_page('TEST PERIOD PAGINATION',n) order by n),array[50,3,0]
from generate_series(0,2) n;
select is((public.get_b2c_tuition_period_page('TEST PERIOD UNCONFIGURED',0)->>'total')::int,1,
 'Manager reader retains one unconfigured enrollment');
select is(public.get_b2c_tuition_period_page('TEST PERIOD UNCONFIGURED',0)->'rows'->0->'package_id','null'::jsonb,
 'Manager unconfigured row has no invented package');
select is((public.get_b2c_tuition_period_page('TEST PERIOD ARCHIVED',0)->>'total')::int,1,
 'Manager center history retains archived student tuition');
select ok(public.get_b2c_tuition_period_page('TEST PERIOD ARCHIVED',0)->'rows'->0->>'student_archived_at' is not null,
 'Manager center history marks archived student');
select is((public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000020',0,'TEST PERIOD ARCHIVED')->>'total')::int,0,
 'Manager class tuition hides archived student');

select set_config('request.jwt.claims','{"sub":"dc260002-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into b2c_period_read_pages
select 'Teacher center',jsonb_agg(public.read_center_b2c_tuition_period_page('TEST PERIOD PAGINATION',n) order by n),array[50,3,0]
from generate_series(0,2) n;
insert into b2c_period_read_pages
select 'Class',jsonb_agg(public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000020',n,'TEST PERIOD PAGINATION') order by n),array[25,25,3]
from generate_series(0,2) n;
select is((public.read_center_b2c_tuition_period_page('TEST PERIOD UNCONFIGURED',0)->>'total')::int,1,
 'Teacher center reader retains one unconfigured enrollment');
select is(public.read_center_b2c_tuition_period_page('TEST PERIOD UNCONFIGURED',0)->'rows'->0->'package_id','null'::jsonb,
 'Teacher center unconfigured row has no invented package');
select is((public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000020',0,'TEST PERIOD UNCONFIGURED')->>'total')::int,1,
 'Class reader retains one unconfigured enrollment');
select is(public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000020',0,'TEST PERIOD UNCONFIGURED')->'rows'->0->'package_id','null'::jsonb,
 'Class unconfigured row has no invented package');
select is((public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000020',0,'TEST PERIOD UNCONFIGURED')->'stats'->>'unconfigured')::int,1,
 'Class statistics count the unconfigured enrollment once');
select is((public.read_center_b2c_tuition_period_page('TEST PERIOD ARCHIVED',0)->>'total')::int,1,
 'Teacher center history retains archived student tuition');
select ok(public.read_center_b2c_tuition_period_page('TEST PERIOD ARCHIVED',0)->'rows'->0->>'student_archived_at' is not null,
 'Teacher center history marks archived student');
select is((public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000020',0,'TEST PERIOD ARCHIVED')->>'total')::int,0,
 'Teacher class tuition hides archived student');
select is((public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000020',0,'TEST PERIOD ARCHIVED')->'stats'->>'total_due')::numeric,0::numeric,
 'Hidden archived student contributes no class tuition total');
select throws_ok($$select public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000021',0,'')$$,'42501',null,
 'Teacher cannot read periods for a class outside assigned scope');

select is((select array_agg(jsonb_array_length(p->'rows') order by ordinal)
 from jsonb_array_elements(pages) with ordinality as page(p,ordinal)),expected_sizes,
 reader||' reader limits each page before returning periods') from b2c_period_read_pages;
select ok((select bool_and((p->>'total')::int=53) from jsonb_array_elements(pages) p),
 reader||' reader reports all 53 periods on every page') from b2c_period_read_pages;
select is((select count(*) from jsonb_array_elements(pages) p cross join lateral jsonb_array_elements(p->'rows') r),53::bigint,
 reader||' reader returns all 53 period rows across pages') from b2c_period_read_pages;
select is((select count(distinct r->>'package_id') from jsonb_array_elements(pages) p cross join lateral jsonb_array_elements(p->'rows') r),53::bigint,
 reader||' reader does not repeat package IDs across pages') from b2c_period_read_pages;
select is((select array_agg((r->>'period_no')::int order by page_ordinal,row_ordinal)
 from jsonb_array_elements(pages) with ordinality as page(p,page_ordinal)
 cross join lateral jsonb_array_elements(p->'rows') with ordinality as row_data(r,row_ordinal)),
 array(select generate_series(53,1,-1)),reader||' reader preserves newest-first period order across page boundaries') from b2c_period_read_pages;
select ok((select bool_and((case when reader='Class' then p->'stats'->>'total_due' else p->>'total_due' end)::numeric=53000)
 from jsonb_array_elements(pages) p),reader||' reader totals include periods outside the current page') from b2c_period_read_pages;
select is(jsonb_array_length(public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000020',3,'TEST PERIOD PAGINATION')->'rows'),0,
 'Class page after the last period is empty');
reset role;
update public.b2c_teacher_permissions set permissions=array['view_classes'] where teacher_id='dc260002-0000-4000-8000-000000000004';
select set_config('request.jwt.claims','{"sub":"dc260002-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.read_b2c_class_tuition_periods('dc260002-0000-4000-8000-000000000005',0,'')$$,'42501',null,'Teacher financial read denied after revocation');
select throws_ok($$select public.start_b2c_tuition_period('dc260002-0000-4000-8000-000000000007',
 current_setting('test.period1')::uuid,'dc260002-0000-4000-8000-000000000009',24,120000,100000,'Promotion','New period',3695000,3695000)$$,
 '42501',null,'Idempotent replay still requires permission');
select throws_ok($$select public.save_b2c_tuition_period(current_setting('test.period2')::uuid,24,120000,0,'','Denied',2880000,0)$$,'42501',null,'Edit denied after revocation');
reset role;
set local role anon;
select throws_ok($$select public.get_b2c_tuition_period_page('',0)$$,'42501',null,'Anonymous cannot read financial periods');
reset role;
select * from finish();
rollback;
