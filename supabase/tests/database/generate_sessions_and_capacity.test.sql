begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- =============================================================================
-- P3-T10 — Test domain: RECURRENCE (sinh 35 buổi) + CAPACITY (chặn vượt sĩ số)
--
-- Vì sao pgTAP chứ không phải unit test TypeScript? Vì logic thật nằm TRONG RPC
-- (`generate_class_sessions`, `enroll_student`). Port công thức sang TS rồi test
-- bản sao thì test xanh cả khi RPC thật sai — nó chỉ chứng minh bản sao đúng với
-- chính nó. Ở đây ta gọi ĐÚNG hàm mà production gọi.
-- =============================================================================

-- --- Nền: admin (RPC yêu cầu super_admin) ------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '80000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'admin.p3t10@polymind.test', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
);

insert into public.profiles (id, role, full_name, email)
values (
  '80000000-0000-0000-0000-000000000001',
  'super_admin', 'Admin P3-T10', 'admin.p3t10@polymind.test'
);

insert into public.courses (id, code, title, course_type, status)
values (
  '81000000-0000-0000-0000-000000000001',
  'TEST-P3T10', 'Khóa kiểm tra recurrence + capacity', 'custom', 'active'
);

-- Lớp 35 buổi, khai giảng Thứ Hai 20/07/2026, học Thứ Ba + Thứ Năm.
insert into public.classes (
  id, code, course_id, name, capacity,
  planned_session_count, session_duration_minutes, start_date,
  delivery_mode, status
)
values (
  '82000000-0000-0000-0000-000000000001',
  'TEST-REC-35', '81000000-0000-0000-0000-000000000001',
  'Lớp 35 buổi', 2, 35, 90, date '2026-07-20', 'offline', 'planned'
);

insert into public.class_schedules (class_id, weekday, start_time, end_time)
values
  ('82000000-0000-0000-0000-000000000001', 2, time '18:00', time '20:00'),  -- Thứ Ba
  ('82000000-0000-0000-0000-000000000001', 4, time '18:00', time '20:00');  -- Thứ Năm

-- Lớp LINH HOẠT: không có lịch lặp (LOP-01 ngoài đời). Đây là hợp lệ.
insert into public.classes (
  id, code, course_id, name, capacity,
  planned_session_count, session_duration_minutes, start_date,
  delivery_mode, status
)
values (
  '82000000-0000-0000-0000-000000000002',
  'TEST-FLEX', '81000000-0000-0000-0000-000000000001',
  'Lớp linh hoạt', 10, 10, 90, date '2026-07-20', 'offline', 'planned'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- =============================================================================
-- RECURRENCE
-- =============================================================================

select is(
  public.generate_class_sessions('82000000-0000-0000-0000-000000000001'),
  35,
  'Sinh ĐÚNG 35 buổi — dừng đúng ở planned_session_count, không sinh lố'
);

select is(
  (select count(*)::int from public.class_sessions
   where class_id = '82000000-0000-0000-0000-000000000001'),
  35,
  'DB có đúng 35 buổi'
);

-- IDEMPOTENT: chạy lại không sinh trùng. Chống trùng bằng unique index +
-- ON CONFLICT ở DB, không phải bằng cách disable nút ở UI.
select is(
  public.generate_class_sessions('82000000-0000-0000-0000-000000000001'),
  0,
  'IDEMPOTENT: gọi lại sinh thêm 0 buổi'
);

select is(
  (select count(*)::int from public.class_sessions
   where class_id = '82000000-0000-0000-0000-000000000001'),
  35,
  'Sau khi gọi lại vẫn đúng 35 buổi — không trùng'
);

-- Buổi chỉ rơi vào Thứ Ba (2) và Thứ Năm (4), tính theo giờ VIỆT NAM.
select is(
  (select array_agg(distinct extract(isodow from starts_at at time zone 'Asia/Ho_Chi_Minh')::int
                    order by extract(isodow from starts_at at time zone 'Asia/Ho_Chi_Minh')::int)
   from public.class_sessions
   where class_id = '82000000-0000-0000-0000-000000000001'),
  array[2, 4],
  'Buổi chỉ rơi vào Thứ Ba và Thứ Năm (theo giờ VN)'
);

-- Buổi đầu: Thứ Ba 21/07/2026, 18:00 giờ VN = 11:00 UTC. DB lưu UTC.
select is(
  (select starts_at from public.class_sessions
   where class_id = '82000000-0000-0000-0000-000000000001' and session_number = 1),
  timestamptz '2026-07-21 11:00:00+00',
  'Buổi 1 = Thứ Ba 21/07 18:00 giờ VN, lưu trong DB là 11:00 UTC'
);

select is(
  (select count(*)::int from public.class_sessions
   where class_id = '82000000-0000-0000-0000-000000000001'
     and ends_at <= starts_at),
  0,
  'Mọi buổi đều có giờ kết thúc SAU giờ bắt đầu'
);

-- Lớp linh hoạt: không có lịch lặp → 0 buổi, và đó KHÔNG phải lỗi.
select is(
  public.generate_class_sessions('82000000-0000-0000-0000-000000000002'),
  0,
  'Lớp linh hoạt (không lịch lặp) → sinh 0 buổi, không ném lỗi'
);

-- =============================================================================
-- CAPACITY — lớp TEST-REC-35 có capacity = 2
-- =============================================================================

insert into public.students (id, student_code, full_name, status)
values
  ('83000000-0000-0000-0000-000000000001', 'HV-CAP1', 'Học viên 1', 'active'),
  ('83000000-0000-0000-0000-000000000002', 'HV-CAP2', 'Học viên 2', 'active'),
  ('83000000-0000-0000-0000-000000000003', 'HV-CAP3', 'Học viên 3', 'active');

select lives_ok(
  $$select public.enroll_student(
      '83000000-0000-0000-0000-000000000001',
      '82000000-0000-0000-0000-000000000001', 'active')$$,
  'Ghi danh HV thứ 1 và thứ 2 vào lớp sĩ số 2 — OK'
);

select public.enroll_student(
  '83000000-0000-0000-0000-000000000002',
  '82000000-0000-0000-0000-000000000001', 'active');

-- Người thứ 3 vượt sĩ số → RPC chặn (kiểm CÓ KHÓA HÀNG `FOR UPDATE`).
select throws_ok(
  $$select public.enroll_student(
      '83000000-0000-0000-0000-000000000003',
      '82000000-0000-0000-0000-000000000001', 'active')$$,
  'P0001',
  'Lớp đã đủ sĩ số (2 / 2)',
  'CAPACITY: học viên thứ 3 bị chặn, báo đúng "2 / 2"'
);

reset role;

select * from finish();

rollback;
