begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- --- Dữ liệu nền -------------------------------------------------------------

insert into public.courses (id, code, title, course_type, status)
values (
  '70000000-0000-0000-0000-000000000001',
  'TEST-RETAKE',
  'Khóa kiểm tra học lại',
  'custom',
  'active'
);

insert into public.classes (
  id, code, course_id, name, capacity,
  planned_session_count, session_duration_minutes, start_date,
  delivery_mode, status
)
values
  ('71000000-0000-0000-0000-000000000001', 'TEST-RETAKE-01',
   '70000000-0000-0000-0000-000000000001', 'Lớp học lại', 10, 10, 90,
   date '2026-07-20', 'offline', 'planned'),
  ('71000000-0000-0000-0000-000000000002', 'TEST-RETAKE-02',
   '70000000-0000-0000-0000-000000000001', 'Lớp khác', 10, 10, 90,
   date '2026-07-20', 'offline', 'planned');

insert into public.students (id, student_code, full_name, status)
values (
  '72000000-0000-0000-0000-000000000001',
  'HV-RETAKE',
  'Học viên rớt phải học lại',
  'active'
);

-- --- 1. Lần học đầu: ghi danh rồi RỚT (withdrawn) -----------------------------

insert into public.enrollments (id, student_id, class_id, status)
values (
  '73000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  'active'
);

select lives_ok(
  $$update public.enrollments
    set status = 'withdrawn', ended_on = current_date
    where id = '73000000-0000-0000-0000-000000000001'$$,
  'Lần học đầu: rút học (rớt) — đóng ghi danh'
);

-- --- 2. D-19: GHI DANH LẠI ĐÚNG LỚP CŨ → PHẢI ĐƯỢC ---------------------------

select lives_ok(
  $$insert into public.enrollments (id, student_id, class_id, status)
    values (
      '73000000-0000-0000-0000-000000000002',
      '72000000-0000-0000-0000-000000000001',
      '71000000-0000-0000-0000-000000000001',
      'active'
    )$$,
  'D-19: học viên rớt được GHI DANH LẠI vào CHÍNH lớp cũ'
);

-- Lịch sử lần học trước KHÔNG bị trộn: hai enrollment tách bạch.
select is(
  (select count(*)::int from public.enrollments
   where student_id = '72000000-0000-0000-0000-000000000001'
     and class_id = '71000000-0000-0000-0000-000000000001'),
  2,
  'Hai lần học là hai enrollment riêng — lịch sử lần trước được giữ nguyên'
);

-- --- 3. D-18 KHÔNG ĐƯỢC VỠ ---------------------------------------------------

-- Đang có ghi danh mở ở lớp cũ → không mở thêm ghi danh ở lớp KHÁC.
select throws_ok(
  $$insert into public.enrollments (student_id, class_id, status)
    values (
      '72000000-0000-0000-0000-000000000001',
      '71000000-0000-0000-0000-000000000002',
      'active'
    )$$,
  '23505',
  null,
  'D-18 vẫn giữ: đang có lớp mở → không ghi danh được lớp khác'
);

-- Và cũng không mở được HAI ghi danh cùng lúc trong CHÍNH lớp đó.
select throws_ok(
  $$insert into public.enrollments (student_id, class_id, status)
    values (
      '72000000-0000-0000-0000-000000000001',
      '71000000-0000-0000-0000-000000000001',
      'active'
    )$$,
  '23505',
  null,
  'Không thể có HAI ghi danh cùng mở trong cùng một lớp'
);

select * from finish();

rollback;
