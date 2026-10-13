begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.b2c_parents'::regclass,'public.b2c_student_parents'::regclass)),'RLS hai bảng bật');
select is((select count(*)::integer from public.b2c_parents where source_student_id is not null),(select count(*)::integer from public.b2c_students where nullif(btrim(guardian_name),'') is not null),'Chuyển đủ tên phụ huynh cũ');
select set_config('request.jwt.claims',json_build_object('sub',(select id from public.profiles where role in ('super_admin','academic_manager') and is_active limit 1),'role','authenticated')::text,true);
set local role authenticated;
insert into public.b2c_students(id,source_key,full_name) values
('45000000-0000-4000-8000-000000000001','test-parent-child-1','Con 1'),
('45000000-0000-4000-8000-000000000002','test-parent-child-2','Con 2');
select lives_ok($$select public.save_b2c_parent(null,'TEST-PARENT','0912345678','Zalo',array(select code from public.b2c_students where source_key like 'test-parent-child-%'),'mother')$$,'Tạo một phụ huynh nhiều con');
select is((select count(*)::integer from public.b2c_student_parents l join public.b2c_parents p on p.id=l.parent_id where p.full_name='TEST-PARENT'),2,'Hai con dùng chung hồ sơ');
select throws_ok($$select public.save_b2c_parent(null,'Không hợp lệ','','',array['B2C-HV999999999999'],'father')$$,'22023',null,'Không tạo liên kết mã không có');
select is((public.get_b2c_parents_page('TEST-PARENT',0)->>'total')::integer,1,'Tìm phụ huynh tại DB');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($$select public.get_b2c_parents_page()$$,'42501',null,'Không có manager bị chặn');
select * from finish();
rollback;
