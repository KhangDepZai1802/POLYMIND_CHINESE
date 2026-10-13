begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_column('public', 'b2c_students', 'status', 'B2C có trạng thái');
select has_column('public', 'b2c_students', 'withdrawal_reason', 'B2C có lý do nghỉ');
insert into public.b2c_students (source_key, full_name)
values ('test-b2c-student-status', 'Học viên kiểm tra');
select is((select status from public.b2c_students where source_key = 'test-b2c-student-status'), 'studying', 'Mặc định đang học');
select throws_ok($$update public.b2c_students set status = 'invalid' where source_key = 'test-b2c-student-status'$$,
  '23514', null, 'Từ chối trạng thái ngoài danh sách');
select throws_ok($$update public.b2c_students set withdrawal_reason = 'Lý do' where source_key = 'test-b2c-student-status'$$,
  '23514', null, 'Chỉ lưu lý do cho trạng thái nghỉ');
select lives_ok($$update public.b2c_students set status = 'withdrawn', withdrawal_reason = 'Chuyển nơi ở' where source_key = 'test-b2c-student-status'$$,
  'Lưu được trạng thái nghỉ và lý do');
select * from finish();
rollback;
