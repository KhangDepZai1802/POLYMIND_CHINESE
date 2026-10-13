begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
insert into public.b2c_students(id, source_key, full_name)
values ('40000000-0000-4000-8000-000000000001', 'test-b2c-multi-class', 'Học viên kiểm tra');
select matches((select code from public.b2c_students where source_key='test-b2c-multi-class'), '^B2C-HV[0-9]{6,}$', 'Mã do DB cấp');
select throws_ok($$update public.b2c_students set code='B2C-HV999999' where source_key='test-b2c-multi-class'$$, '23514', null, 'Mã không được đổi');
insert into public.b2c_classes(id, program_slug, name) values
('40000000-0000-4000-8000-000000000002', 'tieng-anh', 'Lớp kiểm tra Anh'),
('40000000-0000-4000-8000-000000000003', 'lop-ve', 'Lớp kiểm tra Vẽ');
insert into public.b2c_enrollments(source_key, class_id, student_id) values
('test-b2c-multi-class-a', '40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001'),
('test-b2c-multi-class-b', '40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001');
select is((select count(distinct student_id)::integer from public.b2c_enrollments where source_key like 'test-b2c-multi-class-%'), 1, 'Hai lớp dùng cùng học viên');
update public.b2c_enrollments set status='withdrawn', withdrawal_reason='Chuyển lịch' where source_key='test-b2c-multi-class-a';
select is((select status from public.b2c_enrollments where source_key='test-b2c-multi-class-a'), 'withdrawn', 'Lớp Anh đã nghỉ');
select is((select status from public.b2c_enrollments where source_key='test-b2c-multi-class-b'), 'studying', 'Lớp Vẽ vẫn đang học');
select throws_ok($$update public.b2c_enrollments set status='invalid' where source_key='test-b2c-multi-class-b'$$, '23514', null, 'Từ chối trạng thái sai');
select throws_ok($$update public.b2c_enrollments set withdrawal_reason='Lý do' where source_key='test-b2c-multi-class-b'$$, '23514', null, 'Chỉ trạng thái nghỉ có lý do');
select * from finish();
rollback;
