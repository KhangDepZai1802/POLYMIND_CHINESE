-- =============================================================================
-- SEED — dữ liệu nghiệp vụ THẬT (chạy ở MỌI môi trường, kể cả production)
--
-- IDEMPOTENT: khớp theo business code (`code`), không theo uuid ngẫu nhiên →
-- chạy lại không nhân đôi dữ liệu.
--
-- ⚠️ KHÔNG có user demo, KHÔNG có mật khẩu mặc định ở đây.
--    Dữ liệu demo (giáo viên/học viên giả) nằm ở `seed.dev.sql` — chỉ chạy ở dev.
-- =============================================================================

-- --- Level: HSK 1–6 -----------------------------------------------------------

insert into public.levels (code, name, framework, order_index, description)
values
  ('HSK1', 'HSK 1', 'HSK', 1, 'Khoảng 150 từ vựng. Giao tiếp cơ bản nhất.'),
  ('HSK2', 'HSK 2', 'HSK', 2, 'Khoảng 300 từ vựng. Giao tiếp đơn giản hằng ngày.'),
  ('HSK3', 'HSK 3', 'HSK', 3, 'Khoảng 600 từ vựng. Giao tiếp trong đa số tình huống.'),
  ('HSK4', 'HSK 4', 'HSK', 4, 'Khoảng 1200 từ vựng. Thảo luận nhiều chủ đề.'),
  ('HSK5', 'HSK 5', 'HSK', 5, 'Khoảng 2500 từ vựng. Đọc báo, xem phim, thuyết trình.'),
  ('HSK6', 'HSK 6', 'HSK', 6, 'Trên 5000 từ vựng. Nghe/đọc thành thạo, diễn đạt trôi chảy.')
on conflict (code) do update
  set name        = excluded.name,
      framework   = excluded.framework,
      order_index = excluded.order_index,
      description = excluded.description;

-- --- Thang xếp loại -----------------------------------------------------------
-- Ngưỡng không chồng lấn, phủ kín 0–100 (EXCLUDE constraint cưỡng chế điều này).
-- Xếp loại được server tra từ đây — không hard-code label trong UI.

insert into public.grading_scale_rules (label, min_score, max_score, order_index)
select * from (values
  ('Yếu',        0::numeric,  50::numeric, 1),
  ('Trung bình', 50::numeric, 65::numeric, 2),
  ('Khá',        65::numeric, 80::numeric, 3),
  ('Giỏi',       80::numeric, 90::numeric, 4),
  ('Xuất sắc',   90::numeric, 100::numeric, 5)
) as v(label, min_score, max_score, order_index)
where not exists (select 1 from public.grading_scale_rules);

-- =============================================================================
-- COURSE CATALOG — DÒNG CỐT LÕI của trung tâm
--
-- Đây là danh mục THƯỜNG XUYÊN giảng dạy, không phải dữ liệu demo.
--
-- default_session_count / duration / tuition để NULL: trung tâm chưa cung cấp
-- số liệu. KHÔNG BỊA. Số buổi và thời lượng thật được chốt ở từng lớp triển khai.
-- =============================================================================

insert into public.courses
  (code, title, title_en, course_type, level_id, target_audience, objectives, status)
values
  ('HSK1', 'Tiếng Trung HSK 1', 'Chinese HSK 1', 'hsk',
   (select id from public.levels where code = 'HSK1'),
   'Người mới bắt đầu',
   'Nắm bảng chữ cái pinyin, khoảng 150 từ vựng, giao tiếp cơ bản.', 'active'),

  ('HSK2', 'Tiếng Trung HSK 2', 'Chinese HSK 2', 'hsk',
   (select id from public.levels where code = 'HSK2'),
   'Học viên đã hoàn thành HSK 1',
   'Khoảng 300 từ vựng, giao tiếp đơn giản hằng ngày.', 'active'),

  ('HSK3', 'Tiếng Trung HSK 3', 'Chinese HSK 3', 'hsk',
   (select id from public.levels where code = 'HSK3'),
   'Học viên đã hoàn thành HSK 2',
   'Khoảng 600 từ vựng, giao tiếp trong đa số tình huống thường gặp.', 'active'),

  ('HSK4', 'Tiếng Trung HSK 4', 'Chinese HSK 4', 'hsk',
   (select id from public.levels where code = 'HSK4'),
   'Học viên đã hoàn thành HSK 3',
   'Khoảng 1200 từ vựng, thảo luận được nhiều chủ đề.', 'active'),

  ('HSK5', 'Tiếng Trung HSK 5', 'Chinese HSK 5', 'hsk',
   (select id from public.levels where code = 'HSK5'),
   'Học viên đã hoàn thành HSK 4',
   'Khoảng 2500 từ vựng, đọc báo và thuyết trình.', 'active'),

  ('HSK6', 'Tiếng Trung HSK 6', 'Chinese HSK 6', 'hsk',
   (select id from public.levels where code = 'HSK6'),
   'Học viên đã hoàn thành HSK 5',
   'Trên 5000 từ vựng, nghe/đọc thành thạo, diễn đạt trôi chảy.', 'active'),

  ('GT', 'Tiếng Trung giao tiếp', 'Conversational Chinese', 'communication',
   null,
   'Người đi làm, người cần giao tiếp thực tế',
   'Tập trung phản xạ nghe–nói trong tình huống thực tế.', 'active'),

  ('TN', 'Tiếng Trung thiếu nhi', 'Chinese for Kids', 'kids',
   null,
   'Trẻ em',
   'Học qua trò chơi, bài hát, hình ảnh. Xây nền phát âm và hứng thú.', 'active'),

  ('LT-HSK', 'Luyện thi HSK', 'HSK Exam Preparation', 'exam_prep',
   null,
   'Học viên chuẩn bị thi HSK',
   'Luyện đề, chiến thuật làm bài, quản lý thời gian. Cấp độ đích cấu hình theo từng lớp.',
   'active')
on conflict (code) do update
  set title           = excluded.title,
      title_en        = excluded.title_en,
      course_type     = excluded.course_type,
      level_id        = excluded.level_id,
      target_audience = excluded.target_audience,
      objectives      = excluded.objectives,
      status          = excluded.status;

-- =============================================================================
-- DÒNG B2B — 2 chương trình đang triển khai cho Vietcombank
--
-- ⚠️ Đây là dữ liệu ĐỐI TÁC, KHÔNG phải toàn bộ danh mục của trung tâm.
--    Nó nằm SONG SONG với dòng cốt lõi ở trên, không thay thế.
-- =============================================================================

insert into public.courses
  (code, title, title_en, program, course_type, level_id, target_audience, objectives,
   default_session_count, default_session_duration_minutes, status)
values
  ('VCB-EXEC',
   'Tiếng Trung Đàm Phán Tài Chính Chiến Lược',
   'Business Chinese for Executives',
   'business', null, null,
   'Ban Giám đốc',
   'Đàm phán tài chính, thuật ngữ chuyên ngành, giao tiếp cấp lãnh đạo.',
   35, 90, 'active'),

  ('VCB-BANK',
   'Tiếng Trung ngân hàng',
   'Banking Chinese',
   'business', null, null,
   'Lãnh đạo phòng / Cán bộ nhân viên',
   'Từ vựng và tình huống nghiệp vụ ngân hàng, giao tiếp với khách hàng.',
   35, 90, 'active')
on conflict (code) do update
  set title                            = excluded.title,
      title_en                         = excluded.title_en,
      program                          = excluded.program,
      course_type                      = excluded.course_type,
      target_audience                  = excluded.target_audience,
      objectives                       = excluded.objectives,
      default_session_count            = excluded.default_session_count,
      default_session_duration_minutes = excluded.default_session_duration_minutes,
      status                           = excluded.status;

-- --- 3 lớp Vietcombank --------------------------------------------------------

insert into public.classes
  (code, course_id, name, target_audience, capacity,
   planned_session_count, session_duration_minutes,
   start_date, delivery_mode, location_name, address, location_note, status)
values
  -- LOP-01: Ban Giám đốc. LỊCH LINH HOẠT — cố tình KHÔNG có class_schedules.
  -- Địa điểm mô tả tự do: ưu tiên bảo mật và thuận tiện cho khách hàng.
  ('LOP-01',
   (select id from public.courses where code = 'VCB-EXEC'),
   'VCB — Đàm phán tài chính (Ban Giám đốc)',
   'Ban Giám đốc',
   3, 35, 90,
   date '2026-07-20',
   'in_house',
   'Trụ sở Vietcombank',
   null,
   'Lịch linh hoạt theo lịch Ban Giám đốc. Địa điểm: trụ sở VCB hoặc địa điểm riêng tư do khách hàng chỉ định. Ưu tiên bảo mật và thuận tiện.',
   'planned'),

  ('LOP-02',
   (select id from public.courses where code = 'VCB-BANK'),
   'VCB — Tiếng Trung ngân hàng (Lớp 02)',
   'Lãnh đạo phòng / Cán bộ nhân viên',
   26, 35, 90,
   date '2026-07-20',
   'offline',
   'Cơ sở Tây Thạnh',
   '108 Tây Thạnh, Phường Tây Thạnh, TP. HCM',
   'Lịch dự kiến: 08:00–09:30, thứ Hai và thứ Tư hằng tuần.',
   'planned'),

  ('LOP-03',
   (select id from public.courses where code = 'VCB-BANK'),
   'VCB — Tiếng Trung ngân hàng (Lớp 03)',
   'Lãnh đạo phòng / Cán bộ nhân viên',
   26, 35, 90,
   date '2026-07-21',
   'offline',
   'Cơ sở Tây Thạnh',
   '108 Tây Thạnh, Phường Tây Thạnh, TP. HCM',
   'Lịch dự kiến: 08:00–09:30, thứ Ba và thứ Năm hằng tuần.',
   'planned')
on conflict (code) do update
  set course_id                = excluded.course_id,
      name                     = excluded.name,
      target_audience          = excluded.target_audience,
      capacity                 = excluded.capacity,
      planned_session_count    = excluded.planned_session_count,
      session_duration_minutes = excluded.session_duration_minutes,
      start_date               = excluded.start_date,
      delivery_mode            = excluded.delivery_mode,
      location_name            = excluded.location_name,
      address                  = excluded.address,
      location_note            = excluded.location_note;

-- --- Lịch lặp: CHỈ cho LOP-02 và LOP-03 ---------------------------------------
--
-- LOP-01 KHÔNG có row nào ở đây — đó là YÊU CẦU NGHIỆP VỤ (lịch linh hoạt theo
-- Ban Giám đốc), không phải dữ liệu bị thiếu. Đừng "sửa" bằng cách thêm lịch giả.
--
-- weekday theo ISO: 1 = Thứ Hai … 7 = Chủ Nhật.

insert into public.class_schedules (class_id, weekday, start_time, end_time)
select c.id, v.weekday, v.start_time, v.end_time
from (values
  ('LOP-02', 1, time '08:00', time '09:30'),   -- Thứ Hai
  ('LOP-02', 3, time '08:00', time '09:30'),   -- Thứ Tư
  ('LOP-03', 2, time '08:00', time '09:30'),   -- Thứ Ba
  ('LOP-03', 4, time '08:00', time '09:30')    -- Thứ Năm
) as v(class_code, weekday, start_time, end_time)
join public.classes c on c.code = v.class_code
where not exists (
  select 1 from public.class_schedules s
  where s.class_id = c.id
    and s.weekday = v.weekday
    and s.start_time = v.start_time
);
