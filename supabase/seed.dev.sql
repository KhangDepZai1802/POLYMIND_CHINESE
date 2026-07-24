-- =============================================================================
-- SEED DEV — CHỈ DÙNG CHO MÔI TRƯỜNG PHÁT TRIỂN LOCAL
--
-- ⚠️⚠️  TUYỆT ĐỐI KHÔNG CHẠY FILE NÀY TRÊN PRODUCTION.  ⚠️⚠️
--
-- File này tạo tài khoản demo với MẬT KHẨU BIẾT TRƯỚC. Production phải:
--   • Không có user demo.
--   • Không có mật khẩu mặc định.
--   • Tài khoản đầu tiên do người thật tạo qua Supabase Dashboard, rồi invite.
--
-- Danh tính ở đây cố tình để RÕ LÀ GIẢ (@polymind.test, "Demo A", "Demo 1").
-- Không dùng tên thật của giáo viên hoặc học viên.
--
-- Đăng nhập demo:
--   admin@polymind.test   / Polymind@2026   (super_admin)
--   gv.a@polymind.test    / Polymind@2026   (teacher)
--   gv.b@polymind.test    / Polymind@2026   (teacher)
--   hv1@polymind.test     / Polymind@2026   (student)  … hv5
-- =============================================================================

-- --- Tài khoản auth -----------------------------------------------------------

-- ⚠️ BẪY: các cột token dưới đây PHẢI là chuỗi rỗng '', KHÔNG được để NULL.
-- GoTrue đọc chúng vào kiểu `string` của Go và sẽ crash khi gặp NULL:
--   "Scan error on column index 3, name confirmation_token:
--    converting NULL to string is unsupported"
-- → đăng nhập trả 500 "Database error querying schema".
-- Bỏ qua chúng (để DB dùng default NULL) là lỗi seed kinh điển của Supabase.

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
   confirmation_token, recovery_token, email_change_token_new, email_change,
   email_change_token_current, phone_change, phone_change_token,
   reauthentication_token)
select
  '00000000-0000-0000-0000-000000000000',
  v.id,
  'authenticated',
  'authenticated',
  v.email,
  extensions.crypt('Polymind@2026', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '', '', '', '', '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'admin@polymind.test'),
  ('22222222-2222-2222-2222-222222222221'::uuid, 'gv.a@polymind.test'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'gv.b@polymind.test'),
  ('33333333-3333-3333-3333-333333333331'::uuid, 'hv1@polymind.test'),
  ('33333333-3333-3333-3333-333333333332'::uuid, 'hv2@polymind.test'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'hv3@polymind.test'),
  ('33333333-3333-3333-3333-333333333334'::uuid, 'hv4@polymind.test'),
  ('33333333-3333-3333-3333-333333333335'::uuid, 'hv5@polymind.test')
) as v(id, email)
where not exists (select 1 from auth.users u where u.id = v.id);

-- Identity: bắt buộc để đăng nhập email/password hoạt động.
insert into auth.identities
  (provider_id, user_id, identity_data, provider, last_sign_in_at,
   created_at, updated_at)
select
  u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@polymind.test'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- --- profiles -----------------------------------------------------------------

insert into public.profiles (id, role, full_name, phone)
values
  ('11111111-1111-1111-1111-111111111111', 'super_admin', 'Quản trị viên Demo', '0900000001'),
  ('22222222-2222-2222-2222-222222222221', 'teacher',     'Giáo viên Demo A',   '0900000011'),
  ('22222222-2222-2222-2222-222222222222', 'teacher',     'Giáo viên Demo B',   '0900000012'),
  ('33333333-3333-3333-3333-333333333331', 'student',     'Học viên Demo 1',    '0900000101'),
  ('33333333-3333-3333-3333-333333333332', 'student',     'Học viên Demo 2',    '0900000102'),
  ('33333333-3333-3333-3333-333333333333', 'student',     'Học viên Demo 3',    '0900000103'),
  ('33333333-3333-3333-3333-333333333334', 'student',     'Học viên Demo 4',    '0900000104'),
  ('33333333-3333-3333-3333-333333333335', 'student',     'Học viên Demo 5',    '0900000105')
on conflict (id) do update
  set role = excluded.role, full_name = excluded.full_name;

-- --- teachers -----------------------------------------------------------------

insert into public.teachers (user_id, teacher_code, specialization)
values
  ('22222222-2222-2222-2222-222222222221', 'GV001', 'HSK, Tiếng Trung thương mại'),
  ('22222222-2222-2222-2222-222222222222', 'GV002', 'Giao tiếp, Tiếng Trung thiếu nhi')
on conflict (teacher_code) do update
  set specialization = excluded.specialization;

-- --- students -----------------------------------------------------------------

insert into public.students
  (user_id, student_code, full_name, phone, email, current_level_id, learning_goal)
values
  ('33333333-3333-3333-3333-333333333331', 'HV001', 'Học viên Demo 1', '0900000101',
   'hv1@polymind.test', (select id from public.levels where code = 'HSK2'),
   'Giao tiếp nghiệp vụ ngân hàng với khách hàng Trung Quốc'),
  ('33333333-3333-3333-3333-333333333332', 'HV002', 'Học viên Demo 2', '0900000102',
   'hv2@polymind.test', (select id from public.levels where code = 'HSK1'),
   'Đạt HSK 3 trong 6 tháng'),
  ('33333333-3333-3333-3333-333333333333', 'HV003', 'Học viên Demo 3', '0900000103',
   'hv3@polymind.test', (select id from public.levels where code = 'HSK2'),
   'Giao tiếp cơ bản trong công việc'),
  ('33333333-3333-3333-3333-333333333334', 'HV004', 'Học viên Demo 4', '0900000104',
   'hv4@polymind.test', (select id from public.levels where code = 'HSK3'),
   'Đàm phán hợp đồng bằng tiếng Trung'),
  ('33333333-3333-3333-3333-333333333335', 'HV005', 'Học viên Demo 5', '0900000105',
   'hv5@polymind.test', null,
   'Bắt đầu từ con số 0')
on conflict (student_code) do update
  set full_name = excluded.full_name, learning_goal = excluded.learning_goal;

-- --- Phân công giáo viên ------------------------------------------------------
-- LOP-01 và LOP-02: GV A phụ trách. LOP-03: GV B phụ trách.
--
-- Cấu hình này cố tình tạo ra ranh giới để kiểm RLS:
--   GV A KHÔNG dạy LOP-03 → không được thấy học viên/dữ liệu của LOP-03.

insert into public.class_teachers (class_id, teacher_id)
select c.id, t.id
from (values
  ('LOP-01', 'GV001'),
  ('LOP-02', 'GV001'),
  ('LOP-03', 'GV002')
) as v(class_code, teacher_code)
join public.classes c on c.code = v.class_code
join public.teachers t on t.teacher_code = v.teacher_code
on conflict (class_id) do update set teacher_id = excluded.teacher_id;

-- --- Ghi danh -----------------------------------------------------------------
-- MỖI HỌC VIÊN CHỈ MỘT LỚP đang mở (user chốt 2026-07-13).
--
-- Phân bổ cố tình tạo ranh giới để kiểm RLS:
--   GV A dạy LOP-01 + LOP-02 → thấy HV001, HV002, HV004
--                             → KHÔNG thấy HV003, HV005 (chỉ học LOP-03)

insert into public.enrollments
  (student_id, class_id, status, enrolled_on, started_on, created_by)
select s.id, c.id, v.status::public.enrollment_status,
       date '2026-07-01', date '2026-07-20',
       '11111111-1111-1111-1111-111111111111'
from (values
  ('HV001', 'LOP-02', 'active'),
  ('HV002', 'LOP-02', 'active'),
  ('HV003', 'LOP-03', 'active'),
  ('HV004', 'LOP-01', 'active'),
  ('HV005', 'LOP-03', 'active')
) as v(student_code, class_code, status)
join public.students s on s.student_code = v.student_code
join public.classes c on c.code = v.class_code
-- Idempotent bằng NOT EXISTS, KHÔNG bằng ON CONFLICT: từ migration 23 (D-19 —
-- học viên rớt được học lại) không còn unique (student_id, class_id) để bám vào.
where not exists (
  select 1 from public.enrollments e
  where e.student_id = s.id and e.class_id = c.id
);

-- Lịch sử trạng thái cho các enrollment vừa tạo
insert into public.enrollment_status_history
  (enrollment_id, old_status, new_status, reason, changed_by)
select e.id, null, e.status, 'Seed dev', '11111111-1111-1111-1111-111111111111'
from public.enrollments e
where not exists (
  select 1 from public.enrollment_status_history h where h.enrollment_id = e.id
);

-- --- Kích hoạt lớp ------------------------------------------------------------

update public.classes set status = 'active' where code in ('LOP-01', 'LOP-02', 'LOP-03');

-- --- Giáo trình mẫu cho VCB-BANK ----------------------------------------------

insert into public.course_modules (course_id, title, description, order_index)
select c.id, v.title, v.description, v.order_index
from (values
  ('Chương 1: Chào hỏi & Giới thiệu ngân hàng', 'Chào hỏi, giới thiệu bản thân và đơn vị công tác.', 1),
  ('Chương 2: Nghiệp vụ tài khoản', 'Mở tài khoản, gửi tiết kiệm, rút tiền.', 2),
  ('Chương 3: Tín dụng & Cho vay', 'Tư vấn khoản vay, lãi suất, hồ sơ.', 3)
) as v(title, description, order_index)
cross join (select id from public.courses where code = 'VCB-BANK') c
on conflict (course_id, order_index) do nothing;

insert into public.lessons (module_id, title, objectives, planned_duration_minutes, order_index)
select m.id, v.title, v.objectives, 90, v.order_index
from (values
  (1, 1, 'Bài 1: 你好！我是银行职员', 'Chào hỏi, giới thiệu nghề nghiệp.'),
  (1, 2, 'Bài 2: 欢迎光临', 'Đón tiếp khách hàng tại quầy.'),
  (2, 1, 'Bài 3: 开户', 'Từ vựng và mẫu câu mở tài khoản.'),
  (2, 2, 'Bài 4: 存款和取款', 'Gửi tiền và rút tiền.'),
  (3, 1, 'Bài 5: 贷款咨询', 'Tư vấn vay vốn.')
) as v(module_order, order_index, title, objectives)
join public.course_modules m
  on m.order_index = v.module_order
  and m.course_id = (select id from public.courses where code = 'VCB-BANK')
on conflict (module_id, order_index) do nothing;

-- --- Sinh buổi học cho LOP-02 và LOP-03 ---------------------------------------
-- Gọi thẳng logic sinh buổi (không qua RPC vì RPC yêu cầu auth.uid() là admin,
-- mà seed chạy dưới quyền postgres không có JWT).
--
-- LOP-01 KHÔNG sinh buổi: lớp linh hoạt, chưa có lịch → đúng như thiết kế.

do $$
declare
  v_class      record;
  v_schedule   record;
  v_cursor     date;
  v_num        integer;
  v_created    integer;
  v_admin      uuid := '11111111-1111-1111-1111-111111111111';
begin
  for v_class in
    select id, start_date, planned_session_count
    from public.classes
    where code in ('LOP-02', 'LOP-03')
  loop
    select coalesce(max(session_number), 0) into v_num
    from public.class_sessions where class_id = v_class.id;

    v_created := v_num;
    v_cursor  := v_class.start_date;

    while v_created < v_class.planned_session_count
          and v_cursor <= v_class.start_date + interval '2 years'
    loop
      for v_schedule in
        select * from public.class_schedules
        where class_id = v_class.id
          and weekday = extract(isodow from v_cursor)
        order by start_time
      loop
        exit when v_created >= v_class.planned_session_count;
        v_created := v_created + 1;

        insert into public.class_sessions
          (class_id, schedule_id, session_number, starts_at, ends_at, created_by)
        values
          (v_class.id, v_schedule.id, v_created,
           (v_cursor + v_schedule.start_time) at time zone 'Asia/Ho_Chi_Minh',
           (v_cursor + v_schedule.end_time)   at time zone 'Asia/Ho_Chi_Minh',
           v_admin)
        on conflict (class_id, session_number) do nothing;
      end loop;

      v_cursor := v_cursor + 1;
    end loop;
  end loop;
end $$;

-- =====================================================================
-- Flashcard mẫu (Phase 16 / `P16-T9`)
-- =====================================================================
-- Lý do phải có: bài học `P18-T10` — `/admin/reports` giấu lỗi ISO suốt nhiều
-- tháng vì seed rỗng nên bảng luôn trống. Màn Flashcard cũng vậy: không có thẻ
-- mẫu thì không đo được gì bằng trình duyệt.
--
-- ⛔ Nội dung KHÔNG nhân bản thẻ mẫu 胡萝卜 (`DS-050` điểm 4): hai ảnh mẫu là
-- chuẩn cho CÁCH DỰNG thẻ, không phải chuẩn cho nội dung thẻ.
--
-- ⚠️ File media chỉ có HÀNG trong `storage.objects`, không có byte thật — đủ để
-- giao diện render đúng trạng thái bình thường (mục đích của seed này là đo bố
-- cục), nhưng ảnh/audio sẽ không hiện/không phát.

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  false
);

insert into public.flashcard_decks (id, course_id, title, description)
values (
  'a1000000-0000-4000-8000-000000000001',
  (select id from public.courses where code = 'VCB-BANK'),
  'Flashcard — Tiếng Trung ngân hàng',
  'Từ vựng theo từng buổi cho lớp VCB-BANK.'
)
on conflict (course_id) do nothing;

insert into public.flashcard_sections (id, deck_id, session_number, title)
values
  ('a1100000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 1, 'Buổi 1 — Ở ngân hàng'),
  ('a1100000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 2, 'Buổi 2 — Giao dịch (bản nháp)')
-- Khoá số buổi là PARTIAL index từ migration `…076` (buổi đã xoá không chiếm
-- số nữa), nên `ON CONFLICT` phải kèm đúng vế `where` mới suy ra được index.
on conflict (deck_id, session_number) where archived_at is null do nothing;

insert into public.flashcard_pages (
  id, section_id, kind, order_index,
  hanzi, pinyin_syllables, meaning_vi,
  example_sentences, common_phrases,
  front_image_path, back_image_path, audio_path, front_alt, back_alt
)
values
  (
    'a1200000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000001',
    'session_cover', 0, null, null, null,
    '[]'::jsonb, '[]'::jsonb,
    '11111111-1111-1111-1111-111111111111/a1000000-0000-4000-8000-000000000001/a1100000-0000-4000-8000-000000000001/a1200000-0000-4000-8000-000000000001/front-a1300000-0000-4000-8000-000000000001.png',
    '11111111-1111-1111-1111-111111111111/a1000000-0000-4000-8000-000000000001/a1100000-0000-4000-8000-000000000001/a1200000-0000-4000-8000-000000000001/back-a1300000-0000-4000-8000-000000000002.png',
    null,
    'Mặt trước trang mở đầu Buổi 1 — Ở ngân hàng',
    'Mặt sau trang mở đầu Buổi 1 — Ở ngân hàng'
  ),
  (
    'a1200000-0000-4000-8000-000000000002',
    'a1100000-0000-4000-8000-000000000001',
    'vocabulary', 1,
    '银行', 'yín háng', 'Ngân hàng',
    '[{"hanzi":"我去银行取钱。","pinyin":"wǒ qù yínháng qǔ qián","meaning_vi":"Tôi đến ngân hàng rút tiền."},
      {"hanzi":"这家银行几点开门？","pinyin":"zhè jiā yínháng jǐ diǎn kāimén","meaning_vi":"Ngân hàng này mấy giờ mở cửa?"}]'::jsonb,
    '[{"hanzi":"银行卡","pinyin":"yínháng kǎ","meaning_vi":"thẻ ngân hàng"},
      {"hanzi":"中国银行","pinyin":"Zhōngguó Yínháng","meaning_vi":"Ngân hàng Trung Quốc"},
      {"hanzi":"去银行","pinyin":"qù yínháng","meaning_vi":"đi ngân hàng"}]'::jsonb,
    '11111111-1111-1111-1111-111111111111/a1000000-0000-4000-8000-000000000001/a1100000-0000-4000-8000-000000000001/a1200000-0000-4000-8000-000000000002/front-a1300000-0000-4000-8000-000000000003.png',
    '11111111-1111-1111-1111-111111111111/a1000000-0000-4000-8000-000000000001/a1100000-0000-4000-8000-000000000001/a1200000-0000-4000-8000-000000000002/back-a1300000-0000-4000-8000-000000000004.png',
    '11111111-1111-1111-1111-111111111111/a1000000-0000-4000-8000-000000000001/a1100000-0000-4000-8000-000000000001/a1200000-0000-4000-8000-000000000002/audio-a1300000-0000-4000-8000-000000000005.mp3',
    'Mặt trước thẻ từ vựng 银行 — Ngân hàng',
    'Mặt sau thẻ từ vựng 银行 — Ngân hàng'
  ),
  (
    'a1200000-0000-4000-8000-000000000003',
    'a1100000-0000-4000-8000-000000000001',
    'vocabulary', 2,
    '客户', 'kè hù', 'Khách hàng',
    '[{"hanzi":"这位客户要开户。","pinyin":"zhè wèi kèhù yào kāihù","meaning_vi":"Vị khách hàng này muốn mở tài khoản."}]'::jsonb,
    '[{"hanzi":"新客户","pinyin":"xīn kèhù","meaning_vi":"khách hàng mới"},
      {"hanzi":"客户服务","pinyin":"kèhù fúwù","meaning_vi":"dịch vụ khách hàng"}]'::jsonb,
    null, null,
    '11111111-1111-1111-1111-111111111111/a1000000-0000-4000-8000-000000000001/a1100000-0000-4000-8000-000000000001/a1200000-0000-4000-8000-000000000003/audio-a1300000-0000-4000-8000-000000000006.mp3',
    null, null
  ),
  (
    'a1200000-0000-4000-8000-000000000004',
    'a1100000-0000-4000-8000-000000000001',
    'vocabulary', 3,
    '存钱', 'cún qián', 'Gửi tiền',
    '[{"hanzi":"我想存钱。","pinyin":"wǒ xiǎng cún qián","meaning_vi":"Tôi muốn gửi tiền."},
      {"hanzi":"存钱要带身份证吗？","pinyin":"cún qián yào dài shēnfènzhèng ma","meaning_vi":"Gửi tiền có cần mang chứng minh thư không?"}]'::jsonb,
    '[{"hanzi":"存钱进去","pinyin":"cún qián jìnqù","meaning_vi":"gửi tiền vào"},
      {"hanzi":"取钱","pinyin":"qǔ qián","meaning_vi":"rút tiền"}]'::jsonb,
    null, null,
    '11111111-1111-1111-1111-111111111111/a1000000-0000-4000-8000-000000000001/a1100000-0000-4000-8000-000000000001/a1200000-0000-4000-8000-000000000004/audio-a1300000-0000-4000-8000-000000000007.mp3',
    null, null
  ),
  -- Buổi 2 giữ NHÁP: để màn Quản trị có sẵn cả trạng thái nháp lẫn đã công bố.
  (
    'a1200000-0000-4000-8000-000000000005',
    'a1100000-0000-4000-8000-000000000002',
    'vocabulary', 1,
    '汇款', 'huì kuǎn', 'Chuyển khoản',
    '[]'::jsonb, '[]'::jsonb,
    null, null, null, null, null
  )
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
select
  'flashcard-media',
  media.path,
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  jsonb_build_object(
    'mimetype', case when media.path like '%.mp3' then 'audio/mpeg' else 'image/png' end,
    'size', 1024
  )
from (
  select distinct unnest(media_paths) as path
  from public.flashcard_pages
  where section_id in (
    'a1100000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000002'
  )
) media
on conflict (bucket_id, name) do nothing;

-- Công bố buổi 1 (buổi 2 giữ nháp). Trigger `validate_flashcard_section_publish`
-- vẫn chạy, nên nếu seed thiếu cover/audio thì lệnh này sẽ đỏ chứ không im lặng.
update public.flashcard_sections
set status = 'published', published_at = now()
where id = 'a1100000-0000-4000-8000-000000000001';

update public.flashcard_decks
set status = 'published', published_at = now()
where id = 'a1000000-0000-4000-8000-000000000001';
