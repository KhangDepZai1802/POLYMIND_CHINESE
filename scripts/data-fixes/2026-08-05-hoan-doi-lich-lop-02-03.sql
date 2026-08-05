-- =============================================================================
-- SỬA DỮ LIỆU PRODUCTION — 2026-08-05
-- Hoán đổi lịch học LOP-02 ⇄ LOP-03 (bị nhập ngược nhau khi khởi tạo)
--
-- KHÔNG phải migration schema. Đây là sửa DỮ LIỆU một lần, chạy tay.
--
--   Lịch đúng (user xác nhận 2026-08-05):
--     LOP-01  Đàm phán tài chính (BGĐ)   Thứ 3 + Thứ 5   → ĐANG ĐÚNG, không đụng
--     LOP-02  TT ngân hàng 02            Thứ 3 + Thứ 5   → đang là Thứ 2 + Thứ 4
--     LOP-03  TT ngân hàng 03            Thứ 2 + Thứ 4   → đang là Thứ 3 + Thứ 5
--
--   User xác nhận thêm:
--     • Buổi 1 của cả hai lớp ĐANG GHI SAI NGÀY. Thực tế LOP-02 học Thứ 3 04/08,
--       LOP-03 học Thứ 2 03/08. Giáo viên bấm điểm danh vào ô buổi sai.
--       → DỜI ngày buổi 1. Điểm danh bám theo `session_id` nên không mất bản ghi nào.
--     • LOP-03 CÓ học sáng Thứ 4 05/08 → buổi 2 của LOP-03 rơi đúng vào ngày này.
--
--   Cách làm: UPDATE tại chỗ, KHÔNG xóa-sinh-lại.
--     Giữ nguyên `class_sessions.id`  → 52 bản ghi `attendance_records` còn nguyên
--                                        (FK đang ON DELETE CASCADE — xóa buổi là
--                                        mất điểm danh, đúng thứ luật cứng cấm).
--     Giữ nguyên `session_number`     → `video_items` map theo SỐ BUỔI, không theo ngày.
--
--   Logic sinh ngày ở bước 3 sao chép NGUYÊN VẸN từ RPC `generate_class_sessions`
--   (migration 20260713000013) để lịch sửa tay và lịch sinh tự động không lệch nhau.
--
-- CHẠY:
--   xem trước (tự rollback):  psql "$DB_URL" -v apply=false -f <file này>
--   ghi thật:                 psql "$DB_URL" -v apply=true  -f <file này>
-- =============================================================================

\set ON_ERROR_STOP on
\timing off

begin;

\echo ''
\echo '########## TRƯỚC KHI SỬA ##########'

select c.code,
       s.weekday,
       case s.weekday when 1 then 'Thu 2' when 2 then 'Thu 3' when 3 then 'Thu 4'
                      when 4 then 'Thu 5' when 5 then 'Thu 6' when 6 then 'Thu 7'
                      else 'CN' end as thu,
       s.start_time, s.end_time
from public.class_schedules s
join public.classes c on c.id = s.class_id
where c.code in ('LOP-02', 'LOP-03')
order by c.code, s.weekday;

-- ---------------------------------------------------------------------------
-- BƯỚC 1 — Khuôn lịch lặp (`class_schedules`)
--
-- Mỗi UPDATE khóa theo ID **và** weekday hiện tại. Nếu dữ liệu production đã
-- khác lúc tôi đo → 0 dòng → raise → cả giao dịch rollback. Fail-closed: thà
-- không sửa được còn hơn sửa nhầm lên dữ liệu đã đổi.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  procedure_note text;
begin
  -- LOP-02: Thứ 2 (1) → Thứ 3 (2)
  update public.class_schedules set weekday = 2
   where id = '6ea27e01-6be5-4cf7-80aa-8e8487df42e5' and weekday = 1;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'LOP-02 / lịch Thứ 2 không ở trạng thái mong đợi (cập nhật % dòng, cần 1)', n;
  end if;

  -- LOP-02: Thứ 4 (3) → Thứ 5 (4)
  update public.class_schedules set weekday = 4
   where id = '5aaa1591-4aba-45ff-ac38-3399f1320387' and weekday = 3;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'LOP-02 / lịch Thứ 4 không ở trạng thái mong đợi (cập nhật % dòng, cần 1)', n;
  end if;

  -- LOP-03: Thứ 3 (2) → Thứ 2 (1)
  update public.class_schedules set weekday = 1
   where id = '06747bc4-ad57-4035-b57b-d21548f5f62a' and weekday = 2;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'LOP-03 / lịch Thứ 3 không ở trạng thái mong đợi (cập nhật % dòng, cần 1)', n;
  end if;

  -- LOP-03: Thứ 5 (4) → Thứ 4 (3)
  update public.class_schedules set weekday = 3
   where id = '86c9d720-5cd0-41c8-a386-b336e924b7e2' and weekday = 4;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'LOP-03 / lịch Thứ 5 không ở trạng thái mong đợi (cập nhật % dòng, cần 1)', n;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- BƯỚC 2 — Ngày khai giảng
--
-- `generate_class_sessions` luôn đếm từ `classes.start_date`. Để nguyên
-- start_date cũ thì lần bấm "Sinh buổi học" sau này sẽ ra chuỗi ngày khác với
-- chuỗi ta vừa sửa tay — hai nguồn sự thật lệch nhau, đúng loại bug dự án này
-- đã dính ở `Payment→Paid`. Sửa luôn cho một hành động chỉ có một kết quả.
-- ---------------------------------------------------------------------------
do $$
declare n integer;
begin
  -- LOP-02 khai giảng Thứ 3 04/08 (buổi 1 thật)
  update public.classes set start_date = date '2026-08-04'
   where code = 'LOP-02' and start_date = date '2026-08-03';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'LOP-02 / start_date không ở trạng thái mong đợi (cập nhật % dòng, cần 1)', n;
  end if;

  -- LOP-03 khai giảng Thứ 2 03/08 (buổi 1 thật)
  update public.classes set start_date = date '2026-08-03'
   where code = 'LOP-03' and start_date = date '2026-08-04';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'LOP-03 / start_date không ở trạng thái mong đợi (cập nhật % dòng, cần 1)', n;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- BƯỚC 3 — Dời buổi học sang đúng thứ
--
-- Trải lịch từ `start_date`, lọc ngày trùng weekday của khuôn (cùng điều kiện
-- `effective_from`/`effective_to` như RPC), đánh số thứ tự rồi ghép 1-1 với
-- `session_number`. Buổi thứ N của lớp nhận ngày hợp lệ thứ N.
--
-- Chỉ UPDATE `starts_at`/`ends_at`/`schedule_id`. Không đụng `id`,
-- `session_number`, `status`, `lesson_id`, `topic`, `created_by`.
-- Giờ VN → UTC bằng `at time zone`, giống hệt RPC. DB luôn lưu UTC.
-- ---------------------------------------------------------------------------
with slot as (
  select c.id                        as class_id,
         d::date                     as ngay,
         s.id                        as schedule_id,
         s.start_time,
         s.end_time,
         row_number() over (partition by c.id order by d::date, s.start_time) as rn
  from public.classes c
  cross join lateral generate_series(
    c.start_date::timestamp,
    (c.start_date + interval '2 years')::timestamp,
    interval '1 day'
  ) as d
  join public.class_schedules s
    on  s.class_id = c.id
    and s.weekday  = extract(isodow from d)
    and (s.effective_from is null or d::date >= s.effective_from)
    and (s.effective_to   is null or d::date <= s.effective_to)
  where c.code in ('LOP-02', 'LOP-03')
)
update public.class_sessions se
set starts_at   = (slot.ngay + slot.start_time) at time zone 'Asia/Ho_Chi_Minh',
    ends_at     = (slot.ngay + slot.end_time)   at time zone 'Asia/Ho_Chi_Minh',
    schedule_id = slot.schedule_id
from slot
where slot.class_id = se.class_id
  and slot.rn       = se.session_number;

-- Cả hai lớp 35 buổi → phải đúng 70 dòng. Thiếu dòng nào nghĩa là có buổi không
-- tìm được ngày tương ứng → lịch vẫn sai ở chỗ khác → dừng, đừng commit.
do $$
declare
  n integer;
begin
  select count(*) into n
  from public.class_sessions se
  join public.classes c on c.id = se.class_id
  where c.code in ('LOP-02', 'LOP-03')
    and extract(isodow from se.starts_at at time zone 'Asia/Ho_Chi_Minh') in (
      select weekday from public.class_schedules s where s.class_id = se.class_id
    );

  if n <> 70 then
    raise exception 'Chỉ % / 70 buổi rơi đúng thứ theo khuôn lịch mới', n;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- BƯỚC 4 — Ghi vết vào audit_logs
--
-- `actor_id` để NULL có chủ ý: đây là sửa tay ở tầng DB, không phải hành động
-- của một user nào trong app. Khai một user bất kỳ vào đây chính là lỗi
-- BUG_M06_01 ("CreatedBy = user đầu tiên trong DB") mà dự án đã cấm.
-- ---------------------------------------------------------------------------
insert into public.audit_logs (action, resource_type, resource_id, before, after)
select 'class.schedule.data_fix',
       'class',
       c.id,
       jsonb_build_object(
         'weekdays',   case c.code when 'LOP-02' then jsonb_build_array(1, 3) else jsonb_build_array(2, 4) end,
         'start_date', case c.code when 'LOP-02' then '2026-08-03' else '2026-08-04' end
       ),
       jsonb_build_object(
         'weekdays',   case c.code when 'LOP-02' then jsonb_build_array(2, 4) else jsonb_build_array(1, 3) end,
         'start_date', case c.code when 'LOP-02' then '2026-08-04' else '2026-08-03' end,
         'ly_do',      'Lịch LOP-02 và LOP-03 bị nhập ngược nhau lúc khởi tạo. Sửa tay ở DB ngày 2026-08-05 theo xác nhận của user. Dời 35 buổi/lớp, giữ nguyên session_id nên toàn bộ điểm danh còn nguyên.',
         'nguon',      'scripts/data-fixes/2026-08-05-hoan-doi-lich-lop-02-03.sql'
       )
from public.classes c
where c.code in ('LOP-02', 'LOP-03');

-- ---------------------------------------------------------------------------
-- KIỂM CHỨNG
-- ---------------------------------------------------------------------------
\echo ''
\echo '########## SAU KHI SỬA — khuôn lịch lặp ##########'

select c.code,
       case s.weekday when 1 then 'Thu 2' when 2 then 'Thu 3' when 3 then 'Thu 4'
                      when 4 then 'Thu 5' when 5 then 'Thu 6' when 6 then 'Thu 7'
                      else 'CN' end as thu,
       s.start_time, s.end_time, c.start_date as khai_giang
from public.class_schedules s
join public.classes c on c.id = s.class_id
order by c.code, s.weekday;

\echo ''
\echo '########## SAU KHI SỬA — 8 buổi đầu mỗi lớp ##########'

select c.code,
       se.session_number as buoi,
       (se.starts_at at time zone 'Asia/Ho_Chi_Minh')::date as ngay,
       case extract(isodow from se.starts_at at time zone 'Asia/Ho_Chi_Minh')
            when 1 then 'Thu 2' when 2 then 'Thu 3' when 3 then 'Thu 4'
            when 4 then 'Thu 5' when 5 then 'Thu 6' when 6 then 'Thu 7'
            else 'CN' end as thu,
       (se.starts_at at time zone 'Asia/Ho_Chi_Minh')::time as gio,
       (select count(*) from public.attendance_records a where a.session_id = se.id) as diem_danh
from public.class_sessions se
join public.classes c on c.id = se.class_id
where se.session_number <= 8
order by c.code, se.session_number;

\echo ''
\echo '########## ĐIỂM DANH — phải vẫn đủ 52 bản ghi / 2 buổi ##########'

select count(*) as tong_ban_ghi, count(distinct session_id) as so_buoi
from public.attendance_records;

\echo ''
\echo '########## BUỔI SAI THỨ CÒN SÓT (phải rỗng cả 3 lớp) ##########'

select c.code, se.session_number, (se.starts_at at time zone 'Asia/Ho_Chi_Minh')::date as ngay
from public.class_sessions se
join public.classes c on c.id = se.class_id
where extract(isodow from se.starts_at at time zone 'Asia/Ho_Chi_Minh') not in (
        select s.weekday from public.class_schedules s where s.class_id = se.class_id
      )
order by c.code, se.session_number;

\if :apply
  \echo ''
  \echo '>>> apply=true — GHI THẬT (COMMIT)'
  commit;
\else
  \echo ''
  \echo '>>> apply=false — XEM TRƯỚC, KHÔNG GHI GÌ (ROLLBACK)'
  rollback;
\endif
