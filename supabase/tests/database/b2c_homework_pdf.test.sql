begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
-- Fixtures, synthetic Storage metadata and every assertion run in rollback.
-- File signatures are verified separately by the server-action tests.
create function pg_temp.hw_id(n integer) returns uuid language sql immutable as $$
  select ('de270001-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.hw_actor(n integer) returns text language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.hw_id(n),'role','authenticated')::text,true);
$$;
create function pg_temp.hw_upload(key text) returns uuid language sql stable as $$
  select (current_setting('test.'||key)::jsonb->>'id')::uuid;
$$;
create function pg_temp.hw_path(key text) returns text language sql stable as $$
  select current_setting('test.'||key)::jsonb->>'object_path';
$$;
create temporary table original_b2c_students as select id,to_jsonb(s) data from public.b2c_students s;
create temporary table original_legacy_students as select id,to_jsonb(s) data from public.students s;
create temporary table original_b2c_accounts as select student_id,to_jsonb(a) data from public.b2c_student_accounts a;
insert into auth.users(id) select pg_temp.hw_id(n) from generate_series(1,10) n;
insert into public.profiles(id,role,full_name,username,email,is_active) values
 (pg_temp.hw_id(1),'super_admin','HW ADMIN','hw_admin','hw.admin@example.test',true),
 (pg_temp.hw_id(2),'teacher','HW TEACHER','hw_teacher','hw.teacher@example.test',true),
 (pg_temp.hw_id(3),'teacher','HW OTHER TEACHER','hw_other','hw.other@example.test',true),
 (pg_temp.hw_id(4),'student','HW STUDENT A','hw_student_a','hw.student.a@example.test',true),
 (pg_temp.hw_id(5),'student','HW STUDENT B','hw_student_b','hw.student.b@example.test',true),
 (pg_temp.hw_id(6),'student','HW UNLINKED','hw_unlinked','hw.unlinked@example.test',true),
 (pg_temp.hw_id(7),'student','HW INACTIVE','hw_inactive','hw.inactive@example.test',false),
 (pg_temp.hw_id(8),'teacher','HW FULL ACCESS','hw_full','hw.full@example.test',true),
 (pg_temp.hw_id(9),'teacher','HW VIEWER','hw_viewer','hw.viewer@example.test',true),
 (pg_temp.hw_id(10),'student','HW OTHER CLASS','hw_other_student','hw.other.student@example.test',true);
insert into public.teachers(id,user_id) values
 (pg_temp.hw_id(20),pg_temp.hw_id(2)),(pg_temp.hw_id(21),pg_temp.hw_id(3)),
 (pg_temp.hw_id(22),pg_temp.hw_id(8)),(pg_temp.hw_id(23),pg_temp.hw_id(9));
insert into public.b2c_teachers(id,full_name,source_teacher_id) values
 (pg_temp.hw_id(30),'HW TEACHER',pg_temp.hw_id(20)),(pg_temp.hw_id(31),'HW OTHER',pg_temp.hw_id(21)),
 (pg_temp.hw_id(32),'HW FULL',pg_temp.hw_id(22)),(pg_temp.hw_id(33),'HW VIEWER',pg_temp.hw_id(23));
insert into public.b2c_full_access_teachers(teacher_id) values(pg_temp.hw_id(32));
insert into public.b2c_classes(id,name,program_slug,teacher_name,teacher_id,notes) values
 (pg_temp.hw_id(40),'HW CLASS A','tieng-anh','HW TEACHER',pg_temp.hw_id(30),'STAFF ONLY'),
 (pg_temp.hw_id(41),'HW CLASS B','tieng-anh','HW OTHER',pg_temp.hw_id(31),'');
insert into public.b2c_students(id,source_key,full_name) values
 (pg_temp.hw_id(50),'HW-TEST-A','HW STUDENT A'),(pg_temp.hw_id(51),'HW-TEST-B','HW STUDENT B'),
 (pg_temp.hw_id(52),'HW-TEST-NOLINK','HW NO ACCOUNT'),(pg_temp.hw_id(53),'HW-TEST-ARCHIVED','HW ARCHIVED'),
 (pg_temp.hw_id(54),'HW-TEST-OTHER','HW OTHER CLASS');
update public.b2c_students set archived_at=now() where id=pg_temp.hw_id(53);
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status) values
 (pg_temp.hw_id(60),'HW-TEST-EA',pg_temp.hw_id(40),pg_temp.hw_id(50),'studying'),
 (pg_temp.hw_id(61),'HW-TEST-EB',pg_temp.hw_id(40),pg_temp.hw_id(51),'studying'),
 (pg_temp.hw_id(62),'HW-TEST-ENOLINK',pg_temp.hw_id(40),pg_temp.hw_id(52),'studying'),
 (pg_temp.hw_id(64),'HW-TEST-EOTHER',pg_temp.hw_id(41),pg_temp.hw_id(54),'studying');
select pg_temp.hw_actor(1);
set local role authenticated;
select public.save_b2c_teacher_permissions(pg_temp.hw_id(30),pg_temp.hw_id(20),array['view_classes','view_students','view_assessments','grade_assessments'],null);
select public.save_b2c_teacher_permissions(pg_temp.hw_id(31),pg_temp.hw_id(21),array['view_classes','view_students','view_assessments','grade_assessments'],null);
select public.save_b2c_teacher_permissions(pg_temp.hw_id(33),pg_temp.hw_id(23),array['view_classes','view_students','view_assessments'],null);
select is(public.read_b2c_student_account(pg_temp.hw_id(50))->'account','null'::jsonb,'Existing B2C student is not automatically linked');
select is(public.find_b2c_student_login('  HW_STUDENT_A  ')->>'id',pg_temp.hw_id(4)::text,'Exact username lookup ignores case and outer spaces');
select is(public.find_b2c_student_login('hw.student.a@example.test')->>'id',pg_temp.hw_id(4)::text,'Exact email lookup finds an active student account');
select is(public.find_b2c_student_login('HW STUDENT A'),null::jsonb,'Name is never used to match a login');
select is(public.find_b2c_student_login('hw_inactive'),null::jsonb,'Inactive account is not offered for linking');
select is(public.find_b2c_student_login('hw_teacher'),null::jsonb,'Teacher account is not offered for student linking');
select throws_ok($$select public.link_b2c_student_account(pg_temp.hw_id(50),pg_temp.hw_id(2))$$,'22023',null,'Link rejects a nonstudent account');
select throws_ok($$select public.link_b2c_student_account(pg_temp.hw_id(50),pg_temp.hw_id(7))$$,'22023',null,'Link rejects an inactive account');
select throws_ok($$select public.link_b2c_student_account(pg_temp.hw_id(53),pg_temp.hw_id(6))$$,'22023',null,'Link rejects an archived B2C student');
select is(public.link_b2c_student_account(pg_temp.hw_id(50),pg_temp.hw_id(4)),pg_temp.hw_id(4),'Admin explicitly links an active student account');
select is(public.link_b2c_student_account(pg_temp.hw_id(50),pg_temp.hw_id(4)),pg_temp.hw_id(4),'Same account link is idempotent');
select throws_ok($$select public.link_b2c_student_account(pg_temp.hw_id(50),pg_temp.hw_id(6))$$,'40001',null,'Existing link cannot silently change identity');
select throws_ok($$select public.link_b2c_student_account(pg_temp.hw_id(51),pg_temp.hw_id(4))$$,'22023',null,'One login cannot own two B2C students');
select public.link_b2c_student_account(pg_temp.hw_id(51),pg_temp.hw_id(5));
select public.link_b2c_student_account(pg_temp.hw_id(54),pg_temp.hw_id(10));
select is(public.read_b2c_student_account(pg_temp.hw_id(50))->'account'->>'username','hw_student_a','Linked account projection retains username');
select throws_ok($$insert into public.b2c_student_accounts(student_id,user_id,linked_by) values(pg_temp.hw_id(52),pg_temp.hw_id(6),auth.uid())$$,'42501',null,'Account links cannot be inserted directly');
select pg_temp.hw_actor(2);
select throws_ok($$select public.read_b2c_student_account(pg_temp.hw_id(50))$$,'42501',null,'Teacher cannot read account management');
select throws_ok($$select public.find_b2c_student_login('hw_student_a')$$,'42501',null,'Teacher cannot enumerate logins');
select throws_ok($$select public.link_b2c_student_account(pg_temp.hw_id(52),pg_temp.hw_id(6))$$,'42501',null,'Teacher cannot link student identity');
select throws_ok($$select public.prepare_b2c_homework_upload(pg_temp.hw_id(41),null,'assignment','x.pdf','application/pdf',100,gen_random_uuid())$$,'42501',null,'Teacher cannot stage assignment for another class');
select throws_ok($$select public.prepare_b2c_homework_upload(pg_temp.hw_id(40),null,'assignment','x.png','image/png',100,gen_random_uuid())$$,'22023',null,'Assignment must be PDF');
select throws_ok($$select public.prepare_b2c_homework_upload(pg_temp.hw_id(40),null,'assignment','x.exe','application/pdf',100,gen_random_uuid())$$,'22023',null,'Filename extension must match declared type');
select throws_ok($$select public.prepare_b2c_homework_upload(pg_temp.hw_id(40),null,'assignment','../x.pdf','application/pdf',100,gen_random_uuid())$$,'22023',null,'Filename cannot contain a path');
select throws_ok($$select public.prepare_b2c_homework_upload(pg_temp.hw_id(40),null,'assignment','x'||chr(10)||'.pdf','application/pdf',100,gen_random_uuid())$$,'22023',null,'Filename rejects control characters');
select throws_ok($$select public.prepare_b2c_homework_upload(pg_temp.hw_id(40),null,'assignment','x.pdf','application/pdf',20971521,gen_random_uuid())$$,'22023',null,'Upload cap is enforced before storage');
select throws_ok($$select public.prepare_b2c_homework_upload(pg_temp.hw_id(40),null,'assignment','x.pdf','application/pdf',0,gen_random_uuid())$$,'22023',null,'Empty upload is rejected');
select set_config('test.assignment',public.prepare_b2c_homework_upload(pg_temp.hw_id(40),null,'assignment','Homework.PDF','application/pdf',100,pg_temp.hw_id(100))::text,true);
select is(public.prepare_b2c_homework_upload(pg_temp.hw_id(40),null,'assignment','Homework.PDF','application/pdf',100,pg_temp.hw_id(100)),current_setting('test.assignment')::jsonb,'Prepare retry returns the same server-issued ticket');
select throws_ok($$select public.prepare_b2c_homework_upload(pg_temp.hw_id(40),null,'assignment','changed.pdf','application/pdf',100,pg_temp.hw_id(100))$$,'22023',null,'Prepare request cannot change filename');
select is(split_part(pg_temp.hw_path('assignment'),'/',1),pg_temp.hw_id(40)::text,'Storage path starts with the authorized class');
select is(split_part(pg_temp.hw_path('assignment'),'/',2),pg_temp.hw_id(2)::text,'Storage path binds the current actor');
select ok(app.can_delete_b2c_homework_object(pg_temp.hw_path('assignment')),'Own pending upload can be cleaned up');
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values('b2c-homework-files','forged/path.pdf','{"size":100,"mimetype":"application/pdf"}')$$,'42501',null,'Storage denies arbitrary object paths');
select set_config('test.due',(clock_timestamp()+interval '2 days')::text,true);
select throws_ok($$select public.create_b2c_homework(pg_temp.hw_upload('assignment'),'Exercise','Description',current_setting('test.due')::timestamptz,pg_temp.hw_id(101))$$,'22023',null,'Publication requires the actual stored object');
select lives_ok($$insert into storage.objects(bucket_id,name,metadata) values('b2c-homework-files',pg_temp.hw_path('assignment'),'{"size":99,"mimetype":"application/pdf"}')$$,'Prepared path permits storage insertion');
select throws_ok($$select public.create_b2c_homework(pg_temp.hw_upload('assignment'),'Exercise','Description',current_setting('test.due')::timestamptz,pg_temp.hw_id(101))$$,'22023',null,'Finalizer validates actual storage size');
with changed as (update storage.objects set metadata='{"size":100,"mimetype":"application/pdf"}' where bucket_id='b2c-homework-files' and name=pg_temp.hw_path('assignment') returning id)
select is((select count(*) from changed),0::bigint,'No storage overwrite policy');
reset role;
update storage.objects set metadata='{"size":100,"mimetype":"image/png"}' where bucket_id='b2c-homework-files' and name=pg_temp.hw_path('assignment');
set local role authenticated;
select throws_ok($$select public.create_b2c_homework(pg_temp.hw_upload('assignment'),'Exercise','Description',current_setting('test.due')::timestamptz,pg_temp.hw_id(101))$$,'22023',null,'Finalizer validates actual storage MIME');
reset role;
update storage.objects set metadata='{"size":100,"mimetype":"application/pdf"}' where bucket_id='b2c-homework-files' and name=pg_temp.hw_path('assignment');
set local role authenticated;
select throws_ok($$select public.create_b2c_homework(pg_temp.hw_upload('assignment'),'Exercise','Description',now()-interval '1 day',pg_temp.hw_id(101))$$,'22023',null,'New homework requires a future deadline');
select set_config('test.homework',public.create_b2c_homework(pg_temp.hw_upload('assignment'),'Exercise','Description',current_setting('test.due')::timestamptz,pg_temp.hw_id(101))::text,true);
select is(public.create_b2c_homework(pg_temp.hw_upload('assignment'),'Exercise','Description',current_setting('test.due')::timestamptz,pg_temp.hw_id(101)),current_setting('test.homework')::uuid,'Publication retry returns the same assignment');
select throws_ok($$select public.create_b2c_homework(pg_temp.hw_upload('assignment'),'Changed','Description',current_setting('test.due')::timestamptz,pg_temp.hw_id(101))$$,'22023',null,'Publication retry cannot replace content');
select ok(not app.can_delete_b2c_homework_object(pg_temp.hw_path('assignment')),'Attached assignment object cannot be deleted');
select throws_ok($$update public.b2c_homework set title='Direct write' where id=current_setting('test.homework')::uuid$$,'42501',null,'Assignment direct writes are denied');
select is((public.read_b2c_homework_page(pg_temp.hw_id(40),0)->>'total')::int,1,'Assigned teacher sees published homework');
select is((public.read_b2c_homework_page(pg_temp.hw_id(40),0)->'rows'->0->>'student_count')::int,3,'Roster includes students without login');
select is(public.read_b2c_homework_page(pg_temp.hw_id(40),0)->'class'->>'notes','STAFF ONLY','Teacher class metadata retains existing workspace fields');
select is((public.read_b2c_homework_submissions(current_setting('test.homework')::uuid,0)->>'total')::int,3,'Submission roster includes every eligible enrollment');
select ok(exists(select 1 from jsonb_array_elements(public.read_b2c_homework_submissions(current_setting('test.homework')::uuid,0)->'rows') r where r->>'student_id'=pg_temp.hw_id(52)::text and not (r->>'has_account')::boolean),'Roster explicitly marks a student without login');
select set_config('test.updated',(public.read_b2c_homework_page(pg_temp.hw_id(40),0)->'rows'->0->>'updated_at'),true);
select throws_ok($$select public.update_b2c_homework(current_setting('test.homework')::uuid,'Changed','Description',current_setting('test.due')::timestamptz,'2000-01-01')$$,'40001',null,'Stale assignment edits fail');
select lives_ok($$select public.update_b2c_homework(current_setting('test.homework')::uuid,'Updated exercise','Updated description',current_setting('test.due')::timestamptz,current_setting('test.updated')::timestamptz)$$,'Current assignment metadata can be updated');
select is(public.read_b2c_homework_file('assignment',current_setting('test.homework')::uuid)->>'object_path',pg_temp.hw_path('assignment'),'Metadata edits preserve the original immutable PDF');
select is(public.create_b2c_homework(pg_temp.hw_upload('assignment'),'Exercise','Description',current_setting('test.due')::timestamptz,pg_temp.hw_id(101)),current_setting('test.homework')::uuid,'Create retry compares immutable payload after subsequent edits');
select pg_temp.hw_actor(3);
select throws_ok($$select public.read_b2c_homework_page(pg_temp.hw_id(40),0)$$,'42501',null,'Unassigned teacher cannot read class homework');
select throws_ok($$select public.read_b2c_homework_file('assignment',current_setting('test.homework')::uuid)$$,'42501',null,'Unassigned teacher cannot sign assignment URL');
select is((select count(*) from storage.objects where bucket_id='b2c-homework-files' and name=pg_temp.hw_path('assignment')),0::bigint,'Private storage also denies an unassigned teacher');
select pg_temp.hw_actor(8);
select lives_ok($$select public.read_b2c_homework_submissions(current_setting('test.homework')::uuid,0)$$,'Explicit full-access teacher may inspect class submissions');
select ok((public.read_b2c_homework_page(pg_temp.hw_id(40),0)->'rows'->0->>'can_manage')::boolean,'Explicit full-access teacher retains homework management capability');

select pg_temp.hw_actor(6);
select is(public.read_b2c_homework_page(null,0)->'linked_student','null'::jsonb,'Unlinked student receives a clear unlinked state');
select is((public.read_b2c_homework_page(null,0)->>'total')::int,0,'Unlinked student sees no homework');
select throws_ok($$select public.read_b2c_homework_page(pg_temp.hw_id(40),0)$$,'42501',null,'Unlinked student cannot request arbitrary class');
select pg_temp.hw_actor(10);
select throws_ok($$select public.read_b2c_homework_file('assignment',current_setting('test.homework')::uuid)$$,'42501',null,'Linked student in another class cannot download assignment');
select pg_temp.hw_actor(4);
select is((public.read_b2c_homework_page(pg_temp.hw_id(40),0)->>'total')::int,1,'Linked enrolled student sees class assignment');
select is(public.read_b2c_homework_page(pg_temp.hw_id(40),0)->'class'->'notes','null'::jsonb,'Student projection does not expose internal class notes');
select is(public.read_b2c_homework_page(pg_temp.hw_id(40),0)->'rows'->0->'student_count','null'::jsonb,'Student projection does not expose class roster counts');
select ok((public.read_b2c_homework_page(pg_temp.hw_id(40),0)->'rows'->0->>'can_submit')::boolean,'Student can_submit uses database deadline and enrollment');
select is(public.read_b2c_homework_file('assignment',current_setting('test.homework')::uuid)->>'object_path',pg_temp.hw_path('assignment'),'Student may download only an accessible published assignment');
select throws_ok($$select public.read_b2c_homework_submissions(current_setting('test.homework')::uuid,0)$$,'42501',null,'Student cannot inspect the roster');
select throws_ok($$select public.prepare_b2c_homework_upload(pg_temp.hw_id(40),null,'assignment','x.pdf','application/pdf',100,gen_random_uuid())$$,'42501',null,'Student cannot publish assignments');
select throws_ok($$select public.prepare_b2c_homework_upload(pg_temp.hw_id(41),current_setting('test.homework')::uuid,'submission','x.pdf','application/pdf',100,gen_random_uuid())$$,'42501',null,'Submission ticket class must match assignment');
select set_config('test.answer1',public.prepare_b2c_homework_upload(pg_temp.hw_id(40),current_setting('test.homework')::uuid,'submission','answer.pdf','application/pdf',100,pg_temp.hw_id(110))::text,true);
select is(public.read_b2c_homework_file('upload',pg_temp.hw_upload('answer1'))->>'object_path',pg_temp.hw_path('answer1'),'Own staged upload can be verified by server action');
select throws_ok($$select public.submit_b2c_homework(current_setting('test.homework')::uuid,pg_temp.hw_upload('answer1'),pg_temp.hw_id(111))$$,'22023',null,'Submission finalizer requires completed upload');
select lives_ok($$insert into storage.objects(bucket_id,name,metadata) values('b2c-homework-files',pg_temp.hw_path('answer1'),'{"size":100,"mimetype":"application/pdf"}')$$,'Student may upload only the prepared submission path');
select pg_temp.hw_actor(5);
select throws_ok($$select public.read_b2c_homework_file('upload',pg_temp.hw_upload('answer1'))$$,'42501',null,'Another student cannot read the pending upload ticket');
select throws_ok($$select public.submit_b2c_homework(current_setting('test.homework')::uuid,pg_temp.hw_upload('answer1'),pg_temp.hw_id(112))$$,'22023',null,'Another enrolled student cannot attach someone else upload');
select pg_temp.hw_actor(4);
select set_config('test.submission1',public.submit_b2c_homework(current_setting('test.homework')::uuid,pg_temp.hw_upload('answer1'),pg_temp.hw_id(111))::text,true);
select is(public.submit_b2c_homework(current_setting('test.homework')::uuid,pg_temp.hw_upload('answer1'),pg_temp.hw_id(111)),current_setting('test.submission1')::uuid,'Submit retry is idempotent');
select ok(not app.can_delete_b2c_homework_object(pg_temp.hw_path('answer1')),'Submitted file cannot be deleted');
select is(public.read_b2c_homework_file('upload',pg_temp.hw_upload('answer1'))->>'object_path',pg_temp.hw_path('answer1'),'Attached own ticket remains verifiable for retries');
select set_config('test.answer2',public.prepare_b2c_homework_upload(pg_temp.hw_id(40),current_setting('test.homework')::uuid,'submission','photo.JPEG','image/jpeg',90,pg_temp.hw_id(113))::text,true);
insert into storage.objects(bucket_id,name,metadata) values('b2c-homework-files',pg_temp.hw_path('answer2'),'{"size":90,"mimetype":"image/jpeg"}');
select set_config('test.submission2',public.submit_b2c_homework(current_setting('test.homework')::uuid,pg_temp.hw_upload('answer2'),pg_temp.hw_id(114))::text,true);
select is((public.read_b2c_homework_page(pg_temp.hw_id(40),0)->'rows'->0->'latest_submission'->>'revision')::int,2,'Resubmission creates the second revision');
select is((public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,null,0)->>'total')::int,2,'Own history retains both submissions');
select is(public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,null,0)->'rows'->0->>'id',current_setting('test.submission2'),'History is newest first');
select is(public.read_b2c_homework_file('submission',current_setting('test.submission1')::uuid)->>'object_path',pg_temp.hw_path('answer1'),'Previous revision remains downloadable by its student');
select throws_ok($$select public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,pg_temp.hw_id(61),0)$$,'42501',null,'Student cannot enumerate another enrollment history');
select throws_ok($$select public.submit_b2c_homework(current_setting('test.homework')::uuid,pg_temp.hw_upload('answer2'),pg_temp.hw_id(111))$$,'22023',null,'Submit retry cannot swap the uploaded file');
select throws_ok($$update public.b2c_homework_submissions set revision=99 where id=current_setting('test.submission1')::uuid$$,'42501',null,'Student cannot alter submission history directly');
select pg_temp.hw_actor(5);
select is((public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,null,0)->>'total')::int,0,'A classmate sees only their own empty history');
select throws_ok($$select public.read_b2c_homework_file('submission',current_setting('test.submission1')::uuid)$$,'42501',null,'A classmate cannot sign another student submission');
select is((select count(*) from public.b2c_homework_submissions where homework_id=current_setting('test.homework')::uuid),0::bigint,'Submission table RLS also isolates classmates');
select is((select count(*) from storage.objects where bucket_id='b2c-homework-files' and name in(pg_temp.hw_path('answer1'),pg_temp.hw_path('answer2'))),0::bigint,'Private storage denies other students submissions');
select pg_temp.hw_actor(2);
select is((public.read_b2c_homework_page(pg_temp.hw_id(40),0)->'rows'->0->>'submission_count')::int,1,'Teacher count counts students rather than revisions');
select is((public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,pg_temp.hw_id(60),0)->>'total')::int,2,'Teacher may inspect one enrollment revision history');
select is(public.read_b2c_homework_file('submission',current_setting('test.submission2')::uuid)->>'object_path',pg_temp.hw_path('answer2'),'Assigned teacher may download student submission');
select throws_ok($$select public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,pg_temp.hw_id(64),0)$$,'42501',null,'Teacher history filter cannot reference another class enrollment');

-- Deadline is checked again during publication/submission, not only when the
-- upload ticket was issued. A committed retry still works after the deadline.
select pg_temp.hw_actor(4);
select set_config('test.answer3',public.prepare_b2c_homework_upload(pg_temp.hw_id(40),current_setting('test.homework')::uuid,'submission','answer.png','image/png',80,pg_temp.hw_id(115))::text,true);
insert into storage.objects(bucket_id,name,metadata) values('b2c-homework-files',pg_temp.hw_path('answer3'),'{"size":80,"mimetype":"image/png"}');
reset role;
update public.b2c_homework set due_at=clock_timestamp()-interval '1 second' where id=current_setting('test.homework')::uuid;
set local role authenticated;
select ok(not (public.read_b2c_homework_page(pg_temp.hw_id(40),0)->'rows'->0->>'can_submit')::boolean,'Expired homework exposes can_submit false');
select throws_ok($$select public.prepare_b2c_homework_upload(pg_temp.hw_id(40),current_setting('test.homework')::uuid,'submission','late.pdf','application/pdf',100,gen_random_uuid())$$,'42501',null,'Expired homework rejects new upload tickets');
select throws_ok($$select public.submit_b2c_homework(current_setting('test.homework')::uuid,pg_temp.hw_upload('answer3'),pg_temp.hw_id(116))$$,'22023',null,'Already uploaded file cannot be submitted after deadline');
select is(public.submit_b2c_homework(current_setting('test.homework')::uuid,pg_temp.hw_upload('answer2'),pg_temp.hw_id(114)),current_setting('test.submission2')::uuid,'Committed identical retry works after deadline');
select ok(not app.can_insert_b2c_homework_object(pg_temp.hw_path('answer3')),'Storage insert rechecks deadline on previously prepared ticket');
select is((public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,null,0)->>'total')::int,2,'Deadline does not remove own historical submissions');
reset role;
update public.b2c_homework set due_at=current_setting('test.due')::timestamptz where id=current_setting('test.homework')::uuid;
update public.b2c_homework_uploads set expires_at=now()-interval '1 minute' where id=pg_temp.hw_upload('answer3');
set local role authenticated;
select throws_ok($$select public.submit_b2c_homework(current_setting('test.homework')::uuid,pg_temp.hw_upload('answer3'),pg_temp.hw_id(116))$$,'22023',null,'Unattached expired ticket cannot finalize after deadline extension');
select ok(app.can_delete_b2c_homework_object(pg_temp.hw_path('answer3')),'Own expired unattached upload may be cleaned up');
reset role;
update public.b2c_enrollments set status='withdrawn' where id=pg_temp.hw_id(60);
set local role authenticated;
select throws_ok($$select public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,null,0)$$,'42501',null,'Withdrawn student loses homework history access');
select throws_ok($$select public.read_b2c_homework_file('submission',current_setting('test.submission1')::uuid)$$,'42501',null,'Withdrawn student loses submission downloads');
select throws_ok($$select public.submit_b2c_homework(current_setting('test.homework')::uuid,pg_temp.hw_upload('answer2'),pg_temp.hw_id(114))$$,'42501',null,'Even committed retry requires current enrollment');
select pg_temp.hw_actor(2);
select is((public.read_b2c_homework_submissions(current_setting('test.homework')::uuid,0)->>'total')::int,3,'Teacher retains roster row for withdrawn student with submissions');
select is((public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,pg_temp.hw_id(60),0)->>'total')::int,2,'Teacher retains withdrawn student history');
reset role;
update public.b2c_enrollments set status='studying' where id=pg_temp.hw_id(60);
-- Archive a separate student permanently; the existing archive guard rightly
-- forbids restoring a deleted profile even for fixture administrators.
update public.b2c_students set archived_at=now() where id=pg_temp.hw_id(51);
select pg_temp.hw_actor(5);
set local role authenticated;
select is(app.my_b2c_student_id(),null::uuid,'Archived student mapping is ineligible');
select throws_ok($$select public.read_b2c_homework_file('assignment',current_setting('test.homework')::uuid)$$,'42501',null,'Archived student cannot download homework');
reset role;
select pg_temp.hw_actor(1);
set local role service_role;
update public.profiles set is_active=false where id=pg_temp.hw_id(4);
reset role;
select pg_temp.hw_actor(4);
set local role authenticated;
select throws_ok($$select public.read_b2c_homework_page(null,0)$$,'42501',null,'Inactive student cannot read homework page');
select throws_ok($$select public.read_b2c_homework_file('upload',pg_temp.hw_upload('answer2'))$$,'42501',null,'Inactive student cannot read attached upload ticket');
reset role;
select pg_temp.hw_actor(1);
set local role service_role;
update public.profiles set is_active=true where id=pg_temp.hw_id(4);
reset role;
update public.b2c_teacher_permissions set permissions=array['view_classes'] where teacher_id=pg_temp.hw_id(30);
select pg_temp.hw_actor(2);
set local role authenticated;
select throws_ok($$select public.read_b2c_homework_submissions(current_setting('test.homework')::uuid,0)$$,'42501',null,'Permission revocation blocks class roster');
select throws_ok($$select public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,null,0)$$,'42501',null,'Permission revocation blocks submission history');
select throws_ok($$select public.create_b2c_homework(pg_temp.hw_upload('assignment'),'Exercise','Description',current_setting('test.due')::timestamptz,pg_temp.hw_id(101))$$,'42501',null,'Create retry requires current teacher permission');
select is((select count(*) from public.b2c_homework_uploads where id=pg_temp.hw_upload('assignment')),0::bigint,'Revoked teacher cannot read upload metadata directly');
reset role;
update public.b2c_teacher_permissions set permissions=array['view_classes','view_students','view_assessments'] where teacher_id=pg_temp.hw_id(30);
set local role authenticated;
select lives_ok($$select public.read_b2c_homework_page(pg_temp.hw_id(40),0)$$,'Read permission allows teacher to inspect homework');
select ok(not (public.read_b2c_homework_page(pg_temp.hw_id(40),0)->'rows'->0->>'can_manage')::boolean,'Read-only teacher cannot manage homework');
select throws_ok($$select public.archive_b2c_homework(current_setting('test.homework')::uuid,null)$$,'42501',null,'Read permission alone cannot archive homework');
reset role;
update public.b2c_teacher_permissions set permissions=array['view_classes','view_students','view_assessments','grade_assessments'] where teacher_id=pg_temp.hw_id(30);
set local role authenticated;
select throws_ok($$select public.archive_b2c_homework(current_setting('test.homework')::uuid,'2000-01-01')$$,'40001',null,'Archive checks the displayed update timestamp');
select lives_ok($$select public.archive_b2c_homework(current_setting('test.homework')::uuid,(select updated_at from public.b2c_homework where id=current_setting('test.homework')::uuid))$$,'Teacher may archive homework with current timestamp');
select is((public.read_b2c_homework_page(pg_temp.hw_id(40),0)->>'total')::int,0,'Archived assignment leaves the active list');
select is((public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,pg_temp.hw_id(60),0)->>'total')::int,2,'Staff can still inspect archived submission history');
select pg_temp.hw_actor(4);
select throws_ok($$select public.read_b2c_homework_file('assignment',current_setting('test.homework')::uuid)$$,'42501',null,'Archived homework cannot be downloaded by students');
select throws_ok($$select public.read_b2c_homework_submission_history(current_setting('test.homework')::uuid,null,0)$$,'42501',null,'Archived homework history is not exposed to students');
select throws_ok($$select public.submit_b2c_homework(current_setting('test.homework')::uuid,pg_temp.hw_upload('answer2'),pg_temp.hw_id(114))$$,'42501',null,'Archived homework cannot be submitted even as a retry');
reset role;
set local role anon;
select throws_ok($$select public.read_b2c_homework_page(null,0)$$,'42501',null,'Anonymous users cannot call homework reader');
select throws_ok($$select public.read_b2c_student_account(pg_temp.hw_id(50))$$,'42501',null,'Anonymous users cannot call account reader');
reset role;
select is((select public from storage.buckets where id='b2c-homework-files'),false,'Homework bucket is private');
select ok(not has_table_privilege('authenticated','public.b2c_homework_submissions','DELETE'),'No direct submission history deletion grant');
select ok(not has_function_privilege('authenticated','app.check_b2c_homework_upload(uuid,text)','EXECUTE'),'Storage validation internal is not callable directly');
select ok(not has_function_privilege('authenticated','app.b2c_homework_submission_json(uuid)','EXECUTE'),'Submission JSON helper is not callable as a cross-student data leak');
select ok(exists(select 1 from public.audit_logs where action='b2c.student.account_link' and resource_id=pg_temp.hw_id(50) and actor_id=pg_temp.hw_id(1)),'Account link records real administrator actor');
select ok(exists(select 1 from public.audit_logs where action='b2c.homework.update' and resource_id=current_setting('test.homework')::uuid and actor_id=pg_temp.hw_id(2) and before->>'title'='Exercise' and after->>'title'='Updated exercise'),'Assignment metadata edit records before/after under real teacher');
select ok(exists(select 1 from public.audit_logs where action='b2c.homework.archive' and resource_id=current_setting('test.homework')::uuid and actor_id=pg_temp.hw_id(2)),'Archive is audited');
select is((select count(*) from public.audit_logs where action='b2c.homework.submit' and actor_id=pg_temp.hw_id(4)),2::bigint,'Submission retries add no duplicate audit records');
select ok(not exists(select 1 from original_b2c_students o full join
 (select id,to_jsonb(s) data from public.b2c_students s where id in(select id from original_b2c_students)) n using(id)
 where o.data is distinct from n.data),'Existing B2C student records remain byte-for-byte unchanged');
select ok(not exists(select 1 from original_legacy_students o full join
 (select id,to_jsonb(s) data from public.students s where id in(select id from original_legacy_students)) n using(id)
 where o.data is distinct from n.data),'Legacy students and their auth links remain unchanged');
select ok(not exists(select 1 from original_b2c_accounts o full join
 (select student_id,to_jsonb(a) data from public.b2c_student_accounts a where student_id in(select student_id from original_b2c_accounts)) n using(student_id)
 where o.data is distinct from n.data),'Existing B2C account links remain unchanged');
select * from finish();
rollback;
