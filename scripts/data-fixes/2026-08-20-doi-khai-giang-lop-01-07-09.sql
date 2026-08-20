-- =============================================================================
-- SỬA DỮ LIỆU PRODUCTION — 2026-08-20
-- LOP-01 “Đàm phán tài chính (Ban Giám đốc)” — dời khai giảng 17/08 → 07/09/2026
--
-- KHÔNG phải migration schema. Đây là sửa DỮ LIỆU một lần, chạy tay.
--
--   Bối cảnh (user báo 2026-08-20): lớp Ban Giám đốc bị dời, khai giảng thật là
--   Thứ Hai 07/09/2026. 35 buổi đã lỡ sinh theo mốc 17/08 nên phải dời.
--
--   Trạng thái ĐÍCH — giống hệt màn hình hiện tại, chỉ khác mốc bắt đầu/kết thúc:
--     • Lịch lặp:  Thứ Hai 14:00–15:30  +  Thứ Tư 14:00–15:30
--     • Áp dụng:   07/09/2026 → 04/01/2027   (đang là 17/08/2026 → 23/12/2026)
--     • Khai giảng lớp: 07/09/2026 ·  Dự kiến kết thúc: 04/01/2027
--     • 35 buổi, buổi 1 = T2 07/09/2026 … buổi 35 = T2 04/01/2027
--
--   VÌ SAO PHẢI NỚI HẠN 23/12 → 04/01/2027 (user chốt 2026-08-20):
--   đếm thật từ T2 07/09, hai buổi/tuần, thì tới 23/12/2026 mới được **32** buổi.
--   Buổi 33 = T2 28/12, buổi 34 = T4 30/12, buổi 35 = T2 04/01/2027. Giữ nguyên
--   `effective_to = 23/12` thì `generate_class_sessions` dừng ở 32 buổi — lớp
--   thiếu 3 buổi mà không ai thấy vì nút “Sinh buổi học” không báo lỗi.
--
--   CÁCH LÀM: **UPDATE tại chỗ, KHÔNG xóa-sinh-lại** (user chốt 2026-08-20).
--     Giữ nguyên `class_sessions.id`
--       → không đụng FK `class_session_schedule_changes.source_session_id`
--         (ON DELETE **RESTRICT**) — chính ràng buộc này làm nút “Xóa tất cả”
--         trả về “Không thể thực hiện vì dữ liệu đang được sử dụng ở nơi khác”:
--         DELETE cả mẻ là MỘT câu lệnh, một buổi vướng thì cả 35 buổi rollback.
--       → điểm danh / báo cáo buổi học (nếu lỡ có) không mất bản ghi nào.
--     Giữ nguyên `session_number`
--       → `video_items` và liên kết QR flashcard map theo SỐ BUỔI, không theo ngày.
--
--   Logic sinh ngày ở BƯỚC 3 sao chép NGUYÊN VẸN từ RPC `generate_class_sessions`
--   (migration 20260803000088) để lịch sửa tay và lịch sinh tự động không lệch nhau.
--
--   ⚠️ HỆ QUẢ PHẢI BIẾT TRƯỚC: nếu lớp từng có “Nghỉ học / xếp lịch bù”, BƯỚC 3
--   **nắn toàn bộ 35 buổi về lưới T2/T4 chuẩn**, tức xoá bố trí bù đó khỏi lịch
--   (dòng lịch sử trong `class_session_schedule_changes` vẫn còn nguyên, chỉ là
--   ngày trong đó không còn khớp buổi nào). Đúng ý user — họ muốn lịch sạch như
--   vừa sinh mới — nhưng phần “xem trước” in ra các dòng đó để đối chiếu trước
--   khi commit.
--
-- CHẠY:
--   xem trước (tự rollback):  psql "$DB_URL" -v apply=false -f <file này>
--   ghi thật:                 psql "$DB_URL" -v apply=true  -f <file này>
-- =============================================================================

\set ON_ERROR_STOP on
\timing off

-- File này là UTF-8. Không khai báo thì psql trên Windows dùng codepage của
-- console và chuỗi `ly_do` trong audit_logs xuống DB thành ký tự rác.
\encoding UTF8

-- Quên -v apply=… thì mặc định là XEM TRƯỚC. Fail-safe: lỡ tay không ghi nhầm.
\if :{?apply}
\else
  \set apply false
\endif

begin;

\echo ''
\echo '########## TRƯỚC KHI SỬA — lớp ##########'

select c.code,
       c.name,
       c.status,
       c.start_date        as khai_giang,
       c.expected_end_date as du_kien_ket_thuc,
       c.planned_session_count as so_buoi_du_kien,
       (select count(*) from public.class_sessions s where s.class_id = c.id) as so_buoi_da_sinh
from public.classes c
where c.code = 'LOP-01';

\echo ''
\echo '########## TRƯỚC KHI SỬA — lịch lặp ##########'

select case s.weekday when 1 then 'Thu 2' when 2 then 'Thu 3' when 3 then 'Thu 4'
                      when 4 then 'Thu 5' when 5 then 'Thu 6' when 6 then 'Thu 7'
                      else 'CN' end as thu,
       s.start_time, s.end_time, s.effective_from, s.effective_to, s.timezone
from public.class_schedules s
join public.classes c on c.id = s.class_id
where c.code = 'LOP-01'
order by s.weekday, s.start_time;

\echo ''
\echo '########## TRƯỚC KHI SỬA — 35 buổi (ngày, trạng thái, lịch sử bám theo) ##########'

select se.session_number as buoi,
       (se.starts_at at time zone 'Asia/Ho_Chi_Minh')::date as ngay,
       case extract(isodow from se.starts_at at time zone 'Asia/Ho_Chi_Minh')
            when 1 then 'Thu 2' when 2 then 'Thu 3' when 3 then 'Thu 4'
            when 4 then 'Thu 5' when 5 then 'Thu 6' when 6 then 'Thu 7'
            else 'CN' end as thu,
       (se.starts_at at time zone 'Asia/Ho_Chi_Minh')::time as gio,
       se.status,
       (select count(*) from public.attendance_records a where a.session_id = se.id) as diem_danh,
       (select count(*) from public.session_reports r where r.session_id = se.id)    as bao_cao,
       (select count(*) from public.class_session_schedule_changes h
         where h.source_session_id = se.id)                                          as vet_lich_bu
from public.class_sessions se
join public.classes c on c.id = se.class_id
where c.code = 'LOP-01'
order by se.session_number;

\echo ''
\echo '########## Vết “Nghỉ học / xếp lịch bù” — NGUYÊN NHÂN nút “Xóa tất cả” báo lỗi ##########'

select h.created_at,
       h.reason,
       h.old_starts_at at time zone 'Asia/Ho_Chi_Minh'   as ngay_nghi,
       h.makeup_starts_at at time zone 'Asia/Ho_Chi_Minh' as ngay_bu,
       h.affected_session_count as so_buoi_bi_doi,
       se.session_number        as buoi_goc
from public.class_session_schedule_changes h
join public.classes c on c.id = h.class_id
left join public.class_sessions se on se.id = h.source_session_id
where c.code = 'LOP-01'
order by h.created_at;

-- ---------------------------------------------------------------------------
-- CỔNG AN TOÀN — fail-closed
--
-- Không đo được production trước khi soạn file này, nên mọi giả định phải tự
-- kiểm. Sai một điểm ⇒ raise ⇒ cả giao dịch rollback. Thà không sửa được còn
-- hơn dời nhầm lịch một lớp đang chạy.
-- ---------------------------------------------------------------------------
do $$
declare
  v_class    public.classes%rowtype;
  n          integer;
  v_bad      text;
begin
  select * into v_class from public.classes where code = 'LOP-01';
  if v_class.id is null then
    raise exception 'Không tìm thấy lớp LOP-01';
  end if;

  if v_class.name not ilike '%m ph%n%' then
    raise exception 'LOP-01 tên là "%" — không phải lớp Đàm phán tài chính như mong đợi', v_class.name;
  end if;

  if v_class.planned_session_count is distinct from 35 then
    raise exception 'LOP-01 có planned_session_count = % (cần 35)', v_class.planned_session_count;
  end if;

  -- Lịch lặp: đúng 2 khuôn, T2 + T4, 14:00–15:30 (đúng như màn hình user gửi).
  select count(*) into n from public.class_schedules where class_id = v_class.id;
  if n <> 2 then
    raise exception 'LOP-01 có % lịch lặp (cần đúng 2: Thứ Hai và Thứ Tư)', n;
  end if;

  select count(*) into n
  from public.class_schedules
  where class_id = v_class.id
    and weekday in (1, 3)
    and start_time = time '14:00'
    and end_time   = time '15:30';
  if n <> 2 then
    raise exception 'Lịch lặp LOP-01 không phải "T2 + T4, 14:00-15:30" (khớp % / 2 dòng)', n;
  end if;

  -- Số buổi đã sinh phải đúng 35 — ta dời TẠI CHỖ nên phải có đủ chỗ để dời.
  select count(*) into n from public.class_sessions where class_id = v_class.id;
  if n <> 35 then
    raise exception 'LOP-01 đang có % buổi (cần đúng 35 để dời tại chỗ)', n;
  end if;

  -- Buổi đã dạy thì KHÔNG được dời sang tương lai — đó là bịa lại lịch sử.
  select count(*) into n
  from public.class_sessions
  where class_id = v_class.id and status <> 'scheduled';
  if n <> 0 then
    select string_agg(session_number || ':' || status, ', ' order by session_number)
      into v_bad
    from public.class_sessions
    where class_id = v_class.id and status <> 'scheduled';
    raise exception 'LOP-01 có % buổi không còn ở trạng thái scheduled (%). Dừng — xem lại bằng tay.', n, v_bad;
  end if;

  -- Đã điểm danh / đã có báo cáo nghĩa là lớp ĐÃ HỌC thật → tiền đề "lớp chưa
  -- khai giảng" sai → dừng, hỏi lại user thay vì dời cả 35 buổi.
  select count(*) into n
  from public.attendance_records a
  join public.class_sessions se on se.id = a.session_id
  where se.class_id = v_class.id;
  if n <> 0 then
    raise exception 'LOP-01 đã có % bản ghi điểm danh — lớp đã học thật, KHÔNG dời hàng loạt được.', n;
  end if;

  select count(*) into n
  from public.session_reports r
  join public.class_sessions se on se.id = r.session_id
  where se.class_id = v_class.id;
  if n <> 0 then
    raise exception 'LOP-01 đã có % báo cáo buổi học — lớp đã học thật, KHÔNG dời hàng loạt được.', n;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- BƯỚC 1 — Khuôn lịch lặp: dời khoảng áp dụng
--
-- Chỉ đổi `effective_from`/`effective_to`. Thứ và giờ giữ nguyên — user muốn
-- “y chang, chỉ khác ngày khai giảng”.
-- ---------------------------------------------------------------------------
do $$
declare n integer;
begin
  update public.class_schedules s
     set effective_from = date '2026-09-07',
         effective_to   = date '2027-01-04'
    from public.classes c
   where c.id = s.class_id
     and c.code = 'LOP-01';
  get diagnostics n = row_count;
  if n <> 2 then
    raise exception 'Cập nhật % dòng lịch lặp (cần đúng 2)', n;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- BƯỚC 2 — Ngày khai giảng + ngày dự kiến kết thúc của lớp
--
-- `generate_class_sessions` LUÔN đếm từ `classes.start_date`. Để nguyên mốc cũ
-- thì lần bấm “Sinh buổi học” sau này ra chuỗi ngày khác chuỗi ta vừa sửa tay —
-- hai nguồn sự thật lệch nhau, đúng hình dạng bug `BUG_M10_01`.
-- ---------------------------------------------------------------------------
do $$
declare n integer;
begin
  update public.classes
     set start_date        = date '2026-09-07',
         expected_end_date = date '2027-01-04'
   where code = 'LOP-01';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Cập nhật % dòng lớp (cần đúng 1)', n;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- BƯỚC 3 — Dời 35 buổi sang chuỗi ngày mới
--
-- Trải lịch từ `start_date` mới, lọc ngày trùng weekday của khuôn (cùng điều
-- kiện `effective_from`/`effective_to` như RPC), đánh số thứ tự rồi ghép 1-1 với
-- `session_number`. Buổi thứ N nhận ngày hợp lệ thứ N.
--
-- Chỉ UPDATE `starts_at`/`ends_at`/`schedule_id`. Không đụng `id`,
-- `session_number`, `status`, `lesson_id`, `topic`, `created_by`.
-- Giờ VN → UTC bằng `at time zone`, giống hệt RPC. DB luôn lưu UTC.
-- ---------------------------------------------------------------------------
with slot as (
  select c.id            as class_id,
         d::date         as ngay,
         s.id            as schedule_id,
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
  where c.code = 'LOP-01'
)
update public.class_sessions se
set starts_at   = (slot.ngay + slot.start_time) at time zone 'Asia/Ho_Chi_Minh',
    ends_at     = (slot.ngay + slot.end_time)   at time zone 'Asia/Ho_Chi_Minh',
    schedule_id = slot.schedule_id
from slot
where slot.class_id = se.class_id
  and slot.rn       = se.session_number;

-- ---------------------------------------------------------------------------
-- KIỂM CHỨNG TRONG GIAO DỊCH — sai một điểm là rollback, không commit nửa vời
-- ---------------------------------------------------------------------------
do $$
declare
  v_class_id uuid;
  n          integer;
  v_min      date;
  v_max      date;
begin
  select id into v_class_id from public.classes where code = 'LOP-01';

  -- (a) Đủ 35 buổi rơi đúng T2/T4 lúc 14:00.
  select count(*) into n
  from public.class_sessions se
  where se.class_id = v_class_id
    and extract(isodow from se.starts_at at time zone 'Asia/Ho_Chi_Minh') in (1, 3)
    and (se.starts_at at time zone 'Asia/Ho_Chi_Minh')::time = time '14:00'
    and (se.ends_at   at time zone 'Asia/Ho_Chi_Minh')::time = time '15:30';
  if n <> 35 then
    raise exception 'Chỉ % / 35 buổi rơi đúng T2/T4 14:00-15:30', n;
  end if;

  -- (b) Buổi đầu 07/09/2026, buổi cuối 04/01/2027 — đúng con số đã tính tay.
  select min((starts_at at time zone 'Asia/Ho_Chi_Minh')::date),
         max((starts_at at time zone 'Asia/Ho_Chi_Minh')::date)
    into v_min, v_max
  from public.class_sessions where class_id = v_class_id;

  if v_min <> date '2026-09-07' then
    raise exception 'Buổi đầu là % (cần 2026-09-07)', v_min;
  end if;
  if v_max <> date '2027-01-04' then
    raise exception 'Buổi cuối là % (cần 2027-01-04)', v_max;
  end if;

  -- (c) Không buổi nào trùng ngày-giờ với buổi khác.
  select count(*) into n from (
    select starts_at from public.class_sessions
    where class_id = v_class_id
    group by starts_at having count(*) > 1
  ) t;
  if n <> 0 then
    raise exception '% mốc thời gian bị trùng giữa các buổi', n;
  end if;

  -- (d) Không buổi nào còn nằm ngoài khoảng áp dụng của khuôn lịch.
  select count(*) into n
  from public.class_sessions se
  where se.class_id = v_class_id
    and ((se.starts_at at time zone 'Asia/Ho_Chi_Minh')::date < date '2026-09-07'
      or (se.starts_at at time zone 'Asia/Ho_Chi_Minh')::date > date '2027-01-04');
  if n <> 0 then
    raise exception '% buổi nằm ngoài khoảng 07/09/2026 - 04/01/2027', n;
  end if;

  -- (e) Mọi buổi phải trỏ về một khuôn lịch có thật (không còn schedule_id rỗng).
  select count(*) into n
  from public.class_sessions
  where class_id = v_class_id and schedule_id is null;
  if n <> 0 then
    raise exception '% buổi không gắn được vào khuôn lịch nào', n;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- BƯỚC 4 — Ghi vết vào audit_logs
--
-- `actor_id` để NULL có chủ ý: đây là sửa tay ở tầng DB, không phải hành động
-- của một user nào trong app. Khai bừa một user vào đây chính là lỗi
-- `BUG_M06_01` (“CreatedBy = user đầu tiên trong DB”) mà dự án đã cấm.
-- ---------------------------------------------------------------------------
insert into public.audit_logs (action, resource_type, resource_id, before, after)
select 'class.schedule.data_fix',
       'class',
       c.id,
       jsonb_build_object(
         'start_date',        '2026-08-17',
         'expected_end_date', '2026-12-23',
         'effective_from',    '2026-08-17',
         'effective_to',      '2026-12-23'
       ),
       jsonb_build_object(
         'start_date',        '2026-09-07',
         'expected_end_date', '2027-01-04',
         'effective_from',    '2026-09-07',
         'effective_to',      '2027-01-04',
         'ly_do',             'Lớp Ban Giám đốc bị dời khai giảng sang 07/09/2026. Dời tại chỗ toàn bộ 35 buổi (giữ nguyên session_id và session_number). Nới hạn lịch lặp tới 04/01/2027 vì 35 buổi hai buổi/tuần từ 07/09 chỉ đạt 32 buổi trước 23/12/2026.',
         'nguon',             'scripts/data-fixes/2026-08-20-doi-khai-giang-lop-01-07-09.sql'
       )
from public.classes c
where c.code = 'LOP-01';

-- ---------------------------------------------------------------------------
-- SAU KHI SỬA
-- ---------------------------------------------------------------------------
\echo ''
\echo '########## SAU KHI SỬA — lớp + lịch lặp ##########'

select c.code, c.start_date as khai_giang, c.expected_end_date as du_kien_ket_thuc,
       case s.weekday when 1 then 'Thu 2' when 3 then 'Thu 4' else s.weekday::text end as thu,
       s.start_time, s.end_time, s.effective_from, s.effective_to
from public.classes c
join public.class_schedules s on s.class_id = c.id
where c.code = 'LOP-01'
order by s.weekday;

\echo ''
\echo '########## SAU KHI SỬA — cả 35 buổi ##########'

select se.session_number as buoi,
       (se.starts_at at time zone 'Asia/Ho_Chi_Minh')::date as ngay,
       case extract(isodow from se.starts_at at time zone 'Asia/Ho_Chi_Minh')
            when 1 then 'Thu 2' when 3 then 'Thu 4' else 'SAI THU' end as thu,
       (se.starts_at at time zone 'Asia/Ho_Chi_Minh')::time as bat_dau,
       (se.ends_at   at time zone 'Asia/Ho_Chi_Minh')::time as ket_thuc,
       se.status
from public.class_sessions se
join public.classes c on c.id = se.class_id
where c.code = 'LOP-01'
order by se.session_number;

\echo ''
\echo '########## Điểm danh / báo cáo của LOP-01 (phải vẫn là 0 / 0) ##########'

select (select count(*) from public.attendance_records a
         join public.class_sessions se on se.id = a.session_id
         join public.classes c on c.id = se.class_id where c.code = 'LOP-01') as diem_danh,
       (select count(*) from public.session_reports r
         join public.class_sessions se on se.id = r.session_id
         join public.classes c on c.id = se.class_id where c.code = 'LOP-01') as bao_cao;

\echo ''
\echo '########## Tổng buổi toàn hệ thống (phải KHÔNG đổi — ta chỉ dời, không xóa/thêm) ##########'

select c.code, count(se.id) as so_buoi
from public.classes c
left join public.class_sessions se on se.class_id = c.id
group by c.code
order by c.code;

\if :apply
  \echo ''
  \echo '>>> apply=true — GHI THẬT (COMMIT)'
  commit;
\else
  \echo ''
  \echo '>>> apply=false — XEM TRƯỚC, KHÔNG GHI GÌ (ROLLBACK)'
  rollback;
\endif
