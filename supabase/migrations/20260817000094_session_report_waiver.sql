-- =============================================================================
-- `TEACHER-REPORT-5` — "BUỔI NÀY KHÔNG CẦN BÁO CÁO" (user chốt 2026-08-17)
-- =============================================================================
--
-- User mở tab *Báo cáo của giáo viên* thấy khối đỏ *"3 buổi đã dạy nhưng chưa có
-- báo cáo"* và nói: **ba buổi này không cần làm báo cáo**. Trước đợt này không
-- có cách nào nói câu đó với hệ thống: mọi buổi đã qua giờ và chưa bị huỷ đều
-- vào danh sách nợ, nên khối đỏ đó nợ vĩnh viễn và giáo viên bị "quá hạn 13
-- ngày" cho một việc không ai cần.
--
-- -----------------------------------------------------------------------------
-- VÌ SAO ĐẶT CỜ Ở `class_sessions`, KHÔNG THÊM `status = 'waived'` VÀO BÁO CÁO
-- -----------------------------------------------------------------------------
--
-- "Buổi này không cần báo cáo" là một câu nói về BUỔI HỌC, không phải về một bản
-- báo cáo — và đúng những buổi cần miễn lại là những buổi **chưa có hàng
-- `session_reports` nào cả**. Thêm giá trị vào `session_report_status` là phải
-- dựng một hàng báo cáo rỗng chỉ để mang một cái cờ, rồi mọi policy/RPC/luật
-- "9 mục đã xong" phải học thêm một trạng thái không có nội dung. Ba cột trên
-- `class_sessions` thì không đụng gì tới đường đi của báo cáo thật.
--
-- -----------------------------------------------------------------------------
-- THAY ĐỔI THUẦN MỞ RỘNG (`D-37`)
-- -----------------------------------------------------------------------------
--
-- Chỉ thêm cột nullable + một RPC mới. Không đụng cột cũ, không đổi kiểu, không
-- backfill. Mã cũ đang chạy trên production đọc `class_sessions` vẫn đúng —
-- `report_waived_at` là null cho toàn bộ 105 buổi hiện có, tức "không buổi nào
-- được miễn", đúng hiện trạng.

alter table public.class_sessions
  add column if not exists report_waived_at   timestamptz,
  add column if not exists report_waived_by   uuid references auth.users (id) on delete set null,
  add column if not exists report_waive_reason text;

-- Ba cột đi cùng nhau hoặc cùng trống. Một buổi có `report_waived_at` mà không
-- ai đứng tên là dữ liệu không trả lời được câu "ai quyết định miễn buổi này" —
-- đúng cái hố `BUG_M06_01` đã rơi xuống ở hệ cũ (`CreatedBy` = user đầu tiên
-- trong DB). Lý do thì được phép trống: user chỉ yêu cầu một cái nút.
alter table public.class_sessions
  drop constraint if exists ck_class_sessions_report_waiver_pair;
alter table public.class_sessions
  add constraint ck_class_sessions_report_waiver_pair
  check (
    (report_waived_at is null and report_waived_by is null and report_waive_reason is null)
    or (report_waived_at is not null and report_waived_by is not null)
  );

comment on column public.class_sessions.report_waived_at is
  'Mốc giáo vụ đánh dấu buổi này KHÔNG CẦN báo cáo buổi dạy (TEACHER-REPORT-5). Null = vẫn cần báo cáo.';
comment on column public.class_sessions.report_waived_by is
  'auth.uid() của người đánh dấu — KHÔNG BAO GIỜ là "user đầu tiên trong DB" (BUG_M06_01).';
comment on column public.class_sessions.report_waive_reason is
  'Lý do miễn, tuỳ chọn. Giáo viên đọc được để biết vì sao buổi rời khỏi hàng đợi của mình.';

-- =============================================================================
-- RPC — MỘT HÀNH ĐỘNG, MỘT ĐƯỜNG GHI (`BUG_M10_01`)
-- =============================================================================
--
-- Giáo vụ đã có policy toàn quyền trên `class_sessions`, nên về mặt RLS họ
-- UPDATE thẳng được. Vẫn đi qua RPC vì ba vế mà một câu UPDATE từ client không
-- bao giờ tự làm:
--
--   1. `report_waived_by` = `auth.uid()`, client không chọn được người khác;
--   2. chặn miễn một buổi ĐÃ CÓ báo cáo đã gửi — hai sự thật mâu thuẫn trên
--      cùng một buổi;
--   3. bấm nhiều lần không ghi lại mốc thời gian và không sinh thêm dòng audit
--      (`BUG_M09_01` — idempotency phải ở DB, không ở nút bấm).
--
-- ⚠️ KHÔNG chặn theo "đã điểm danh xong chưa". Nút trên màn hình chỉ hiện ở buổi
-- đã điểm danh (đúng yêu cầu của user), nhưng cổng ở DB thì không được: buổi
-- không cần báo cáo lại thường chính là buổi không ai điểm danh, và giáo vụ
-- KHÔNG kiểm soát được việc điểm danh — giáo viên mới kiểm soát. Đặt cổng vào
-- thứ người bấm không nắm là lặp lại `TEACHER-REPORT-2`/`3c` lần thứ ba.
create or replace function public.set_session_report_waiver(
  p_session_id uuid,
  p_waived boolean,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions%rowtype;
  v_report_status public.session_report_status;
  v_reason text := nullif(trim(p_reason), '');
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
begin
  if not app.is_active() or not app.is_manager() then
    raise exception 'Chỉ quản trị viên hoặc giáo vụ được đánh dấu buổi không cần báo cáo';
  end if;

  if p_waived is null then
    raise exception 'Thiếu trạng thái cần đặt';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Lý do tối đa 500 ký tự';
  end if;

  -- Khoá hàng trước khi đọc trạng thái: hai giáo vụ bấm cùng lúc thì xếp hàng,
  -- không cùng thấy "chưa miễn" rồi cùng ghi hai dòng audit.
  select * into v_session
  from public.class_sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Không tìm thấy buổi học';
  end if;

  select r.status into v_report_status
  from public.session_reports r
  where r.session_id = p_session_id;

  if p_waived and v_report_status = 'submitted' then
    raise exception 'Buổi này đã có báo cáo đã gửi, không đánh dấu "không cần báo cáo" được';
  end if;

  -- Đã ở đúng trạng thái cần đặt ⇒ ra ngay. `false` nghĩa là "không có gì đổi",
  -- KHÔNG phải "thất bại"; tầng app đọc nó để nói đúng chuyện đã xảy ra.
  if (v_session.report_waived_at is not null) = p_waived then
    return false;
  end if;

  update public.class_sessions
  set report_waived_at    = case when p_waived then v_now end,
      report_waived_by    = case when p_waived then v_actor end,
      report_waive_reason = case when p_waived then v_reason end
  where id = p_session_id;

  perform app.write_audit(
    case
      when p_waived then 'class_session.report_waived'
      else 'class_session.report_waiver_cleared'
    end,
    'class_session',
    p_session_id,
    jsonb_build_object(
      'report_waived_at', v_session.report_waived_at,
      'report_waive_reason', v_session.report_waive_reason
    ),
    jsonb_build_object(
      'report_waived_at', case when p_waived then v_now end,
      'report_waive_reason', case when p_waived then v_reason end
    )
  );

  return true;
end;
$$;

revoke all on function public.set_session_report_waiver(uuid, boolean, text) from public, anon;
grant execute on function public.set_session_report_waiver(uuid, boolean, text) to authenticated, service_role;

comment on function public.set_session_report_waiver(uuid, boolean, text) is
  'Giáo vụ đánh dấu / bỏ đánh dấu một buổi là KHÔNG CẦN báo cáo buổi dạy. Fail-closed theo app.is_manager(); chặn khi báo cáo đã gửi; idempotent (trả false khi không có gì đổi). TEACHER-REPORT-5.';
