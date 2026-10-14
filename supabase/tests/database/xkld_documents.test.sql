begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(28);
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('73000000-0000-4000-8000-000000000001','authenticated','authenticated','docs-staff@example.test',now(),now()),
('73000000-0000-4000-8000-000000000002','authenticated','authenticated','docs-exec@example.test',now(),now()),
('73000000-0000-4000-8000-000000000003','authenticated','authenticated','docs-other@example.test',now(),now());
insert into public.profiles(id,role,full_name,is_active) values
('73000000-0000-4000-8000-000000000001','xkld_staff','TEST DOC STAFF',true),
('73000000-0000-4000-8000-000000000002','executive','TEST DOC EXEC',true),
('73000000-0000-4000-8000-000000000003','consultant','TEST DOC OTHER',true);
select ok((select relrowsecurity from pg_class where oid='public.xkld_document_requirements'::regclass),'Requirement RLS');
select ok((select relrowsecurity from pg_class where oid='public.xkld_candidate_documents'::regclass),'Document RLS');
select ok((select relrowsecurity from pg_class where oid='public.xkld_document_files'::regclass),'File RLS');
select is((select public from storage.buckets where id='xkld-documents'),false,'Bucket private');
select ok(not has_table_privilege('authenticated','public.xkld_document_files','UPDATE'),'No file tampering');
select ok(not has_table_privilege('authenticated','public.xkld_candidate_documents','DELETE'),'No history delete');
select set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into public.xkld_candidates(create_request_id,full_name,date_of_birth,phone,hometown,education,occupation,health_status,source,assignee_id) values('73000000-0000-4000-8000-000000000030','TEST DOCUMENT CANDIDATE','2000-01-01','0901234567','TEST','TEST','TEST','passed','employee','73000000-0000-4000-8000-000000000001');
select lives_ok($$select public.xkld_documents_command('save_requirement',jsonb_build_object('request_id','73000000-0000-4000-8000-000000000010','market_id',(select id from public.xkld_markets where country_code='SG'),'name','TEST passport','is_required',true,'expects_expiry',true,'sort_order',1))$$,'Create checklist');
select lives_ok($$select public.xkld_documents_command('save_requirement',jsonb_build_object('request_id','73000000-0000-4000-8000-000000000010','market_id',(select id from public.xkld_markets where country_code='SG'),'name','TEST passport','is_required',true,'expects_expiry',true,'sort_order',1))$$,'Create retry');
select is((select count(*)::int from public.xkld_document_requirements where request_id='73000000-0000-4000-8000-000000000010'),1,'One checklist');
select lives_ok($$select public.xkld_documents_command('save_document',jsonb_build_object('candidate_id',(select id from public.xkld_candidates where create_request_id='73000000-0000-4000-8000-000000000030'),'requirement_id',(select id from public.xkld_document_requirements where request_id='73000000-0000-4000-8000-000000000010'),'submitted_on','2026-01-01','expires_on','2025-12-31','note','expired retained'))$$,'Expired document can be recorded');
select throws_ok($$select public.xkld_documents_command('save_document',jsonb_build_object('candidate_id',(select id from public.xkld_candidates where create_request_id='73000000-0000-4000-8000-000000000030'),'requirement_id',(select id from public.xkld_document_requirements where request_id='73000000-0000-4000-8000-000000000010'),'submitted_on','2099-01-01'))$$,'P0001',null,'Future submission rejected');
select throws_ok($$select public.xkld_documents_command('save_document',jsonb_build_object('candidate_id',(select id from public.xkld_candidates where create_request_id='73000000-0000-4000-8000-000000000030'),'requirement_id',(select id from public.xkld_document_requirements where request_id='73000000-0000-4000-8000-000000000010'),'submitted_on','2026-01-02','expected_updated_at','2000-01-01'))$$,'P0001',null,'Stale write rejected');
select lives_ok($$select public.xkld_documents_command('prepare',jsonb_build_object('candidate_id',(select id from public.xkld_candidates where create_request_id='73000000-0000-4000-8000-000000000030'),'requirement_id',(select id from public.xkld_document_requirements where request_id='73000000-0000-4000-8000-000000000010'),'request_id','73000000-0000-4000-8000-000000000020','file_name','TEST.pdf','mime_type','application/pdf','size_bytes',100))$$,'Prepare private upload');
select throws_ok($$select public.xkld_documents_command('finalize',jsonb_build_object('id',(select id from public.xkld_document_files where request_id='73000000-0000-4000-8000-000000000020')))$$,'P0001',null,'Missing object cannot finalize');
select throws_ok($$insert into storage.objects(bucket_id,name) values('xkld-documents','forged/path.pdf')$$,'42501',null,'Unclaimed path blocked');
select throws_ok($$update public.xkld_document_files set state='ready'$$,'42501',null,'Direct finalize blocked');
select lives_ok($$insert into storage.objects(bucket_id,name,metadata) select 'xkld-documents',storage_path,'{"size":100,"mimetype":"application/pdf"}'::jsonb from public.xkld_document_files where request_id='73000000-0000-4000-8000-000000000020'$$,'Only prepared path permits insert');
select lives_ok($$select public.xkld_documents_command('finalize',jsonb_build_object('id',(select id from public.xkld_document_files where request_id='73000000-0000-4000-8000-000000000020')))$$,'Matching object can finalize');
select lives_ok($$select public.xkld_documents_command('finalize',jsonb_build_object('id',(select id from public.xkld_document_files where request_id='73000000-0000-4000-8000-000000000020')))$$,'Finalize retry safe');
select throws_ok($$select public.xkld_documents_command('cancel',jsonb_build_object('id',(select id from public.xkld_document_files where request_id='73000000-0000-4000-8000-000000000020')))$$,'P0001',null,'Ready historical file cannot cancel');
select throws_ok($$delete from storage.objects where bucket_id='xkld-documents'$$,'42501',null,'Direct object deletion blocked; API tested separately');
with changed as (update storage.objects set name='overwrite.pdf' where bucket_id='xkld-documents' returning id) select is((select count(*)::int from changed),0,'No overwrite storage policy');
reset role;
select set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.xkld_candidate_documents),1,'Executive reads documents');
select is((select count(*)::int from public.xkld_document_files where state='pending'),0,'Executive cannot read pending uploads');
select is((select count(*)::int from storage.objects where bucket_id='xkld-documents'),1,'Executive can read ready attachment');
select throws_ok($$select public.xkld_documents_command('save_requirement','{}')$$,'42501',null,'Executive cannot edit');
reset role;
select set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.xkld_candidate_documents),0,'Consultant denied RLS');
select throws_ok($$select public.xkld_documents_command('checklists','{}')$$,'42501',null,'Consultant denied RPC');
reset role;
select * from finish();
rollback;
