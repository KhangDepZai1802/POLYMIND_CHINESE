-- =============================================================================
-- 95 — Admin sửa lại điểm danh giáo viên đã chốt — `ADMIN-ATTENDANCE-1`
--
-- User chốt 2026-08-19 qua `AskUserQuestion` (→ `D-45`), bốn vế:
--
--   (1) Tab thứ tư "Điểm danh" ở `/admin/reports` — lưới buổi×học viên gom theo
--       lớp, sửa THẲNG trong ô.
--   (2) 🔴 Buổi đã có báo cáo GỬI rồi thì sửa điểm danh phải CẬP NHẬT LUÔN
--       `attendance_snapshot` của báo cáo đó. **Vế này ĐẢO NGƯỢC `D-43` điểm
--       (c)**, vốn ghi rõ "sửa điểm danh về sau KHÔNG làm đổi báo cáo đã ký".
--       Cái giá phải trả: báo cáo giáo viên đã ký đổi nội dung sau lưng họ. Bù
--       lại bằng `revised_*` bên trong chính bản chụp (xem dưới) để bản in nói
--       ra được điều đó thay vì im lặng đổi số.
--   (3) Ghi vết bằng `audit_logs` before/after, KHÔNG thêm cột vào
--       `attendance_records`.
--   (4) Chỉ `super_admin` sửa. Giáo vụ CHỈ XEM.
--
-- ⚠️ VẾ (4) LÀ LÝ DO PHẢI CÓ RPC RIÊNG, KHÔNG PHẢI CỜ TRÊN RPC CŨ.
--
-- `bulk_mark_attendance` đang mở cho `app.is_manager() or app.teaches_class()`
-- (migration 88). Siết nó về `is_super_admin()` là chặn luôn giáo viên điểm
-- danh lớp mình — sai hoàn toàn. Thêm tham số `p_as_admin` thì cổng quyền phụ
-- thuộc vào một giá trị do CLIENT gửi lên, tức là không còn fail-closed.
--
-- Đường đúng: HAI CỔNG, MỘT ĐƯỜNG GHI. Phần ghi vào bảng tách ra
-- `app.upsert_attendance_records()`; `bulk_mark_attendance` (giáo viên + giáo
-- vụ, giữ nguyên cổng cũ) và `admin_override_attendance` (chỉ super_admin) đều
-- gọi đúng hàm đó. Giữ được luật "một hành động = một đường ghi" (`BUG_M10_01`)
-- mà vẫn có hai cổng quyền khác nhau.
--
-- ⛔ KHÔNG THÊM PHÉP KIỂM "GHI DANH CÓ THUỘC LỚP CỦA BUỔI KHÔNG" VÀO ĐÂY.
--
-- Bản đầu của migration này có một phép kiểm như vậy, vì tưởng rằng
-- `attendance_records` không ràng buộc `enrollment.class_id` với
-- `class_sessions.class_id` (hai khoá ngoại rời nhau, unique key chỉ là
-- `(session_id, enrollment_id)`). **Khẳng định đó SAI, và kiểm ngược pgTAP đã
-- bác nó:** gỡ phép kiểm ra thì DB vẫn chặn, bằng một câu lỗi khác.
--
-- Người chặn thật là `app.enforce_attendance_class_match()` — trigger BEFORE
-- INSERT OR UPDATE dựng từ migration `…005`. Nó mạnh hơn hẳn một phép kiểm đặt
-- trong RPC: chạy trên TỪNG HÀNG và trên MỌI đường ghi, kể cả `insert` gõ tay
-- bằng psql. Thêm một phép kiểm nữa ở tầng RPC là dựng luật thứ hai cho cùng
-- một việc — đúng hình dạng `BUG_M10_01`, và tốn thêm một câu query mỗi lượt.
-- =============================================================================

-- --- Đường ghi DUY NHẤT vào attendance_records ------------------------------

create or replace function app.upsert_attendance_records(
  p_session_id uuid,
  p_records    jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_count    integer := 0;
  v_rec      jsonb;
begin
  select class_id into v_class_id
  from public.class_sessions where id = p_session_id;

  if v_class_id is null then
    raise exception 'Không tìm thấy buổi học';
  end if;

  -- Ghi danh thuộc lớp khác bị `trg_attendance_class_match` chặn ở dòng
  -- `insert` ngay dưới đây (xem khối chú thích đầu file — đừng kiểm lại ở đây).
  for v_rec in select * from jsonb_array_elements(p_records)
  loop
    insert into public.attendance_records
      (session_id, enrollment_id, status, note, marked_by, marked_at)
    values
      (p_session_id,
       (v_rec ->> 'enrollment_id')::uuid,
       (v_rec ->> 'status')::public.attendance_status,
       nullif(v_rec ->> 'note', ''),
       auth.uid(),      -- ACTOR THẬT, không phải "user đầu tiên"
       now())
    on conflict (session_id, enrollment_id) do update
      set status    = excluded.status,
          note      = excluded.note,
          marked_by = excluded.marked_by,
          marked_at = excluded.marked_at;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function app.upsert_attendance_records(uuid, jsonb) is
  'Đường ghi DUY NHẤT vào attendance_records. KHÔNG kiểm quyền, KHÔNG ghi audit và '
  'KHÔNG kiểm ghi danh có thuộc lớp không — ba việc đó nằm ở chỗ khác: quyền và audit '
  'ở hàm gọi nó (bulk_mark_attendance · admin_override_attendance) vì hai đường có cổng '
  'khác nhau; toàn vẹn lớp ở trigger trg_attendance_class_match từ migration 005.';

revoke all on function app.upsert_attendance_records(uuid, jsonb) from public, anon, authenticated;

-- --- Bản chụp chuyên cần — MỘT hàm dựng, hai nơi gọi ------------------------
--
-- Trước migration này, câu SQL dựng bản chụp nằm THẲNG trong thân
-- `submit_session_report()`. Nay `admin_override_attendance()` cũng phải dựng
-- lại đúng bản chụp đó; chép câu SQL sang là dựng đúng hình dạng `BUG_M10_01`
-- (hai đường tính cùng một con số, sửa một bên thì bên kia lệch âm thầm).

create or replace function app.build_attendance_snapshot(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'captured_at', now(),
    'roster_size', count(*),
    'present', count(*) filter (where ar.status = 'present'),
    'late', count(*) filter (where ar.status = 'late'),
    'absent', count(*) filter (where ar.status = 'absent'),
    'excused', count(*) filter (where ar.status = 'excused'),
    'students', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'enrollment_id', e.id,
          'student_code', s.student_code,
          'full_name', s.full_name,
          'status', ar.status,
          'note', ar.note
        )
        order by s.full_name
      ) filter (where ar.status is distinct from 'present'),
      '[]'::jsonb
    )
  )
  from public.class_sessions cs
  join public.enrollments e on e.class_id = cs.class_id
  join public.students s on s.id = e.student_id
  left join public.attendance_records ar
    on ar.session_id = cs.id and ar.enrollment_id = e.id
  where cs.id = p_session_id
    and e.status in ('pending', 'active', 'paused');
$$;

comment on function app.build_attendance_snapshot(uuid) is
  'Dựng bản chụp mục 2 của báo cáo buổi dạy. Gọi từ submit_session_report() lúc gửi, '
  'và từ admin_override_attendance() khi admin sửa lại điểm danh của buổi đã có báo cáo.';

revoke all on function app.build_attendance_snapshot(uuid) from public, anon, authenticated;

-- --- bulk_mark_attendance — CỔNG GIỮ NGUYÊN, thân gọi hàm chung -------------

create or replace function public.bulk_mark_attendance(
  p_session_id uuid,
  p_records    jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_count    integer;
begin
  select class_id into v_class_id
  from public.class_sessions where id = p_session_id;

  if v_class_id is null then
    raise exception 'Không tìm thấy buổi học';
  end if;

  -- Cổng KHÔNG ĐỔI so với migration 88: giáo viên/giáo vụ của chính lớp đó vẫn
  -- điểm danh bình thường. Vế "chỉ super_admin" của `D-45` áp cho đường
  -- admin_override_attendance, không áp cho đường điểm danh gốc.
  if not (app.is_manager() or app.teaches_class(v_class_id)) then
    raise exception 'Không có quyền điểm danh buổi học này';
  end if;

  v_count := app.upsert_attendance_records(p_session_id, p_records);

  perform app.write_audit(
    'attendance.bulk_mark', 'class_session', p_session_id,
    null, jsonb_build_object('count', v_count)
  );

  return v_count;
end;
$$;

-- --- submit_session_report — thân dựng bản chụp gọi hàm chung ---------------

create or replace function public.submit_session_report(p_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session  public.class_sessions%rowtype;
  v_report   public.session_reports%rowtype;
  v_snapshot jsonb;
begin
  select * into v_session
  from public.class_sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Không tìm thấy buổi học';
  end if;

  if not (app.teaches_class(v_session.class_id) or app.is_super_admin()) then
    raise exception 'Không có quyền gửi báo cáo cho buổi học này';
  end if;

  select * into v_report
  from public.session_reports
  where session_id = p_session_id
  for update;

  if v_report.id is null then
    raise exception 'Chưa có bản nháp báo cáo cho buổi này';
  end if;

  -- Gửi lại đúng một báo cáo đã gửi: trả về id cũ, KHÔNG ném lỗi và không ghi
  -- đè `submitted_at`. Mạng chập chờn bấm hai lần vẫn ra một kết quả
  -- (`BUG_M09_01`).
  if v_report.status = 'submitted' then
    return v_report.id;
  end if;

  if not v_report.confirmed then
    raise exception 'Cần tích ô xác nhận trước khi gửi báo cáo';
  end if;

  if not app.session_attendance_complete(p_session_id) then
    raise exception 'Cần điểm danh đủ học viên trước khi gửi báo cáo';
  end if;

  -- Chụp lại mục 2 — nay đi qua hàm chung với đường sửa của admin.
  v_snapshot := app.build_attendance_snapshot(p_session_id);

  update public.session_reports
  set status = 'submitted',
      submitted_by = auth.uid(),
      submitted_at = now(),
      attendance_snapshot = v_snapshot
  where id = v_report.id;

  -- Gửi báo cáo = hoàn tất buổi (`D-43` điểm 1). Đi qua đúng RPC cũ để tiến độ
  -- bài học vẫn chỉ có MỘT đường ghi. Buổi đã `completed` từ trước thì bỏ qua —
  -- `save_session_log` sẽ ném lỗi "đã hoàn tất, không thể ghi đè lịch sử".
  if v_session.status = 'scheduled' then
    perform public.save_session_log(
      p_session_id,
      v_session.lesson_id,
      v_session.lesson_log,
      v_session.teacher_note,
      true
    );
  end if;

  perform app.write_audit(
    'session_report.submit',
    'session_report',
    v_report.id,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', 'submitted', 'session_id', p_session_id)
  );

  return v_report.id;
end;
$$;

-- --- RPC MỚI — admin sửa lại điểm danh đã chốt ------------------------------

-- ⚠️ NHẬN NHIỀU BUỔI TRONG MỘT LƯỢT, KHÔNG PHẢI MỘT BUỔI.
--
-- Lưới của admin là buổi×học viên của CẢ MỘT LỚP, nên một lần bấm "Lưu tất cả"
-- thường chạm vài buổi khác nhau. Nếu RPC chỉ nhận một buổi thì server action
-- phải gọi n lần ⇒ n transaction rời nhau ⇒ mạng đứt giữa chừng để lại buổi 3
-- đã sửa còn buổi 5 thì chưa, và không có gì nói cho người bấm biết. Một lệnh
-- RPC là MỘT transaction: hoặc cả lượt vào, hoặc không có gì vào.
--
-- ⛔ Cố tình KHÔNG dùng khuôn "bỏ qua phần hỏng, báo rõ buổi nào" của `D-43`
-- điểm 4. Khuôn đó đúng cho công bố flashcard vì mỗi buổi độc lập nhau và điều
-- kiện hợp lệ khác nhau từng buổi. Ở đây mọi phép kiểm đều tất định và giống
-- nhau cho cả lô (cùng một người bấm, cùng một lớp) — hỏng một buổi nghĩa là
-- dữ liệu gửi lên sai, và lưu nửa vời một bảng điểm danh thì tệ hơn là không lưu.

create or replace function public.admin_override_attendance(
  p_changes jsonb,
  p_reason  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason       text := nullif(btrim(coalesce(p_reason, '')), '');
  v_group        jsonb;
  v_session_id   uuid;
  v_records      jsonb;
  v_class_id     uuid;
  v_ids          uuid[];
  v_before       jsonb;
  v_after        jsonb;
  v_report       public.session_reports%rowtype;
  v_old_snapshot jsonb;
  v_new_snapshot jsonb;
  v_resynced     boolean;
  v_sessions     integer := 0;
  v_records_n    integer := 0;
  v_reports      integer := 0;
begin
  -- 🔴 FAIL-CLOSED, và siết hơn `bulk_mark_attendance` một bậc: GIÁO VỤ BỊ CHẶN
  -- Ở ĐÂY (`D-45` vế 4), kể cả giáo vụ đang được phân công dạy chính lớp đó.
  -- Không có nhánh `return true` mặc định nào (`CR-M14-3`).
  if not app.is_super_admin() then
    raise exception 'Chỉ quản trị viên mới sửa được điểm danh đã chốt';
  end if;

  if p_changes is null or jsonb_typeof(p_changes) <> 'array'
     or jsonb_array_length(p_changes) = 0 then
    raise exception 'Chưa có thay đổi nào để lưu';
  end if;

  for v_group in select * from jsonb_array_elements(p_changes)
  loop
    v_session_id := (v_group ->> 'session_id')::uuid;
    v_records    := v_group -> 'records';
    v_resynced   := false;

    if v_records is null or jsonb_typeof(v_records) <> 'array'
       or jsonb_array_length(v_records) = 0 then
      raise exception 'Danh sách điểm danh của buổi % không hợp lệ', v_session_id;
    end if;

    select class_id into v_class_id
    from public.class_sessions
    where id = v_session_id
    for update;

    if v_class_id is null then
      raise exception 'Không tìm thấy buổi học';
    end if;

    select array_agg((rec ->> 'enrollment_id')::uuid)
    into v_ids
    from jsonb_array_elements(v_records) as rec;

    -- Ảnh TRƯỚC — chỉ những ghi danh nằm trong lượt sửa này. Chụp cả buổi thì
    -- dòng audit phình theo sĩ số lớp mà không nói thêm được gì.
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'enrollment_id', ar.enrollment_id,
          'status', ar.status,
          'note', ar.note,
          'marked_by', ar.marked_by
        )
        order by ar.enrollment_id
      ),
      '[]'::jsonb
    )
    into v_before
    from public.attendance_records ar
    where ar.session_id = v_session_id
      and ar.enrollment_id = any (v_ids);

    perform app.upsert_attendance_records(v_session_id, v_records);

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'enrollment_id', ar.enrollment_id,
          'status', ar.status,
          'note', ar.note,
          'marked_by', ar.marked_by
        )
        order by ar.enrollment_id
      ),
      '[]'::jsonb
    )
    into v_after
    from public.attendance_records ar
    where ar.session_id = v_session_id
      and ar.enrollment_id = any (v_ids);

    -- 🔴 IDEMPOTENT (`BUG_M09_01`). So SAU khi ghi chứ không so trước:
    -- `marked_by`/`marked_at` bị ghi đè mỗi lượt upsert, nên "gửi lại y nguyên"
    -- vẫn chạm vào hàng. Không có phép so này thì bấm Lưu hai lần sinh hai dòng
    -- audit và đóng hai dấu "đã sửa" lên một báo cáo không hề đổi số nào.
    --
    -- `marked_by` nằm TRONG phép so là có chủ đích: admin bấm lại đúng trạng
    -- thái cũ do giáo viên ghi thì quyền tác giả hàng đó CÓ đổi (giáo viên →
    -- admin), và đó là một thay đổi thật, đáng ghi lại.
    if v_before = v_after then
      continue;
    end if;

    -- --- Đồng bộ lại bản chụp của báo cáo đã gửi (`D-45` vế 2) --------------
    select * into v_report
    from public.session_reports
    where session_id = v_session_id
    for update;

    if v_report.id is not null and v_report.status = 'submitted' then
      v_old_snapshot := coalesce(v_report.attendance_snapshot, '{}'::jsonb);

      -- `revised_from` giữ số liệu ĐÚNG LÚC GIÁO VIÊN KÝ, không phải số của lần
      -- sửa liền trước: sửa lần thứ ba mà mốc so sánh trôi theo thì không còn
      -- cách nào đọc lại được bản báo cáo đã ký thật sự trông ra sao.
      v_new_snapshot := app.build_attendance_snapshot(v_session_id)
        || jsonb_build_object(
             'revised_at', now(),
             'revised_by', auth.uid(),
             'revised_reason', v_reason,
             'revised_from', coalesce(
               v_old_snapshot -> 'revised_from',
               jsonb_build_object(
                 'captured_at', v_old_snapshot -> 'captured_at',
                 'roster_size', v_old_snapshot -> 'roster_size',
                 'present', v_old_snapshot -> 'present',
                 'late', v_old_snapshot -> 'late',
                 'absent', v_old_snapshot -> 'absent',
                 'excused', v_old_snapshot -> 'excused'
               )
             )
           );

      update public.session_reports
      set attendance_snapshot = v_new_snapshot
      where id = v_report.id;

      v_resynced := true;
      v_reports  := v_reports + 1;
    end if;

    -- Vết sửa đi vào `audit_logs` với ĐỦ before/after (`D-45` vế 3). Đây là nơi
    -- duy nhất còn giữ được "giáo viên nào điểm danh gốc" sau khi `marked_by`
    -- bị ghi đè — `attendance_records` không có cột nào cho việc đó.
    --
    -- MỘT DÒNG AUDIT MỖI BUỔI, không phải một dòng cho cả lô: tài nguyên bị
    -- chạm là buổi học, và tra ngược "buổi này ai sửa gì" là câu hỏi thật.
    perform app.write_audit(
      'attendance.admin_override',
      'class_session',
      v_session_id,
      v_before,
      jsonb_build_object(
        'records', v_after,
        'reason', v_reason,
        'report_resynced', v_resynced,
        'report_id', v_report.id
      )
    );

    v_sessions  := v_sessions + 1;
    v_records_n := v_records_n + jsonb_array_length(v_after);
  end loop;

  return jsonb_build_object(
    'sessions', v_sessions,
    'records', v_records_n,
    'reports_resynced', v_reports
  );
end;
$$;

comment on function public.admin_override_attendance(jsonb, text) is
  'Admin sửa lại điểm danh giáo viên đã chốt (D-45). CHỈ super_admin — giáo vụ bị chặn '
  'kể cả khi đang dạy chính lớp đó. Nhận nhiều buổi trong MỘT transaction. Idempotent: '
  'buổi nào gửi lại y nguyên thì không ghi audit và không đóng dấu sửa lên báo cáo. Buổi '
  'đã có báo cáo GỬI thì dựng lại attendance_snapshot kèm revised_* — đảo ngược D-43 '
  'điểm (c) theo đúng quyết định của user.';

revoke all on function public.admin_override_attendance(jsonb, text) from public, anon;
grant execute on function public.admin_override_attendance(jsonb, text) to authenticated;

comment on column public.session_reports.attendance_snapshot is
  'Ảnh chụp mục 2 lúc GỬI báo cáo. Từ D-45: admin sửa điểm danh của buổi này thì bản chụp '
  'được DỰNG LẠI, kèm revised_at/revised_by/revised_reason/revised_from để bản in nói ra '
  'được là số liệu đã đổi so với lúc giáo viên ký, thay vì im lặng đổi số.';
