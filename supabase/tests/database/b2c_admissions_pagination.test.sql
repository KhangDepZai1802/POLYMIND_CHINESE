begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
select set_config('request.jwt.claims',json_build_object('sub',(select id from public.profiles where role in ('super_admin','academic_manager') and is_active limit 1),'role','authenticated')::text,true);
set local role authenticated;
insert into public.b2c_admission_leads(full_name,phone,program_slug,salesperson,stage)
select 'TEST-B2C-PAGE-'||lpad(n::text,3,'0'),'0912345678','tieng-anh','Test','lead' from generate_series(1,25) n;
select is((public.get_b2c_admissions_page('lead','tieng-anh','TEST-B2C-PAGE-',0,20)->>'total')::integer,25,'Tổng không bị giới hạn bởi trang');
select is(jsonb_array_length(public.get_b2c_admissions_page('lead','tieng-anh','TEST-B2C-PAGE-',0,20)->'leads'),20,'Trang đầu giới hạn 20');
select is(jsonb_array_length(public.get_b2c_admissions_page('lead','tieng-anh','TEST-B2C-PAGE-',1,20)->'leads'),5,'Trang sau còn 5');
select is((public.get_b2c_admissions_page('trial','tieng-anh','TEST-B2C-PAGE-',0,20)->>'total')::integer,0,'Lọc giai đoạn ở DB');
select is((public.get_b2c_admissions_page('lead','lop-ve','TEST-B2C-PAGE-',0,20)->>'total')::integer,0,'Lọc chương trình ở DB');
select throws_ok($$select public.get_b2c_admissions_page('lead',null,'',0,1000)$$,'22023',null,'Không vượt giới hạn trang');
insert into public.b2c_admission_care_logs(lead_id,channel,contact_date,caretaker_name,content,next_followup_date,created_at)
select id,'call','2026-10-13','Test','Cũ','2026-10-20',now()-interval '1 minute' from public.b2c_admission_leads where full_name='TEST-B2C-PAGE-001';
insert into public.b2c_admission_care_logs(lead_id,channel,contact_date,caretaker_name,content,next_followup_date)
select id,'message','2026-10-13','Test','Mới',null from public.b2c_admission_leads where full_name='TEST-B2C-PAGE-001';
select is(public.get_b2c_admissions_page('lead',null,'TEST-B2C-PAGE-001',0,20)->'leads'->0->>'nextFollowupDate',null::text,'Lấy lịch mới nhất kể cả khi bỏ hẹn');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($$select public.get_b2c_admissions_page()$$,'42501',null,'Không có quyền manager bị chặn');
select * from finish();
rollback;
