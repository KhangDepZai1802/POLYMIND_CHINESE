-- =============================================================================
-- 92 — Báo cáo sau buổi dạy của giáo viên (`TEACHER-REPORT-1`, `D-43`)
--     + công bố / bỏ công bố flashcard hàng loạt (`FLASHCARD-BULKPUB-1`)
--
-- Nội dung biểu mẫu bám đúng `docs/BaoCao.pdf` — 9 mục + phần XÁC NHẬN.
--
-- ⚠️ BA VẾ SỐNG CÒN CỦA `D-43`, đừng nới ở bất kỳ đợt refactor nào:
--
--   (a) CỔNG ĐIỂM DANH nằm ở `submit_session_report()`, KHÔNG phải ở UI.
--       Giáo viên gọi thẳng RPC khi mới điểm danh 3/18 vẫn phải bị từ chối.
--
--   (b) MỤC 2 KHÔNG CÓ CỘT NÀO CHỨA SĨ SỐ / CÓ MẶT / VẮNG do người dùng gõ.
--       Lúc còn nháp, số liệu đọc thẳng từ `attendance_records`. Cho gõ tay là
--       mở đường cho hai con số khác nhau về cùng một buổi (`BUG_M10_01`).
--
--   (c) LÚC GỬI PHẢI CHỤP LẠI mục 2 vào `attendance_snapshot`. Sửa điểm danh
--       sau đó KHÔNG được làm đổi bản báo cáo đã ký — báo cáo phải dựng lại
--       được đúng như lúc gửi.
--
-- 📌 MỤC 3 KHÔNG CÓ CỘT RIÊNG cho "bài học đã dạy" / "nội dung đã giảng" /
--    "ghi chú". Ba thứ đó đã sống ở `class_sessions` và đi qua đúng một đường
--    ghi là `save_session_log()`. Nhân bản sang bảng này là dựng lại đúng hình
--    dạng `BUG_M10_01` mà `CLAUDE.md` liệt kê. Gửi báo cáo = hoàn tất buổi,
--    nên `submit_session_report()` gọi lại chính RPC đó.
-- =============================================================================

-- --- Enum --------------------------------------------------------------------

create type public.session_report_status as enum ('draft', 'submitted');

create type public.session_report_mode as enum ('offline', 'online', 'hybrid');

-- Sáu nhóm học viên cần đánh dấu. Năm nhóm đầu thuộc mục 5; `follow_up_next`
-- thuộc mục 7 ("Học viên cần theo dõi thêm") — gom chung một bảng vì hình dạng
-- dữ liệu y hệt nhau, phân biệt bằng cột `category`.
create type public.session_report_student_category as enum (
  'outstanding',
  'needs_support',
  'low_engagement',
  'missing_homework',
  'escalate',
  'follow_up_next'
);

-- --- Bảng chính --------------------------------------------------------------

create table public.session_reports (
  id uuid primary key default gen_random_uuid(),

  -- 🔴 UNIQUE Ở DB, không phải kiểm ở app (`BUG_M09_01`). Hai request đồng thời
  -- cùng tạo báo cáo cho một buổi thì cái thứ hai va vào index này, không sinh
  -- ra hai bản báo cáo cho cùng một buổi dạy.
  session_id uuid not null unique
    references public.class_sessions(id) on delete cascade,

  -- Nhân bản có chủ đích từ `class_sessions.class_id`: policy RLS gọi
  -- `app.teaches_class()` trên từng hàng, để nguyên thì mỗi lần kiểm quyền phải
  -- join thêm một bảng. Trigger bên dưới giữ cột này luôn đúng.
  class_id uuid not null references public.classes(id) on delete cascade,

  status public.session_report_status not null default 'draft',

  -- Mục 1 — thông tin buổi học (5 ô còn lại là dữ liệu tự động, không lưu lại)
  mode public.session_report_mode,
  topic text check (char_length(coalesce(topic, '')) <= 500),

  -- Mục 2 — ảnh chụp chuyên cần, CHỈ ghi lúc gửi. Còn nháp thì null và giao
  -- diện đọc trực tiếp từ `attendance_records` (vế (b) + (c) ở đầu file).
  attendance_snapshot jsonb,

  -- Mục 3 — phần KHÔNG thuộc nhật ký buổi học
  plan_completion text check (
    plan_completion in ('lt_50', '50_69', '70_89', '90_100')
  ),
  has_unfinished boolean,
  unfinished_content text check (char_length(coalesce(unfinished_content, '')) <= 2000),
  unfinished_reason text check (char_length(coalesce(unfinished_reason, '')) <= 2000),
  has_homework boolean,
  homework_assigned text check (char_length(coalesce(homework_assigned, '')) <= 2000),

  -- Mục 4 — ba thang 1–5 và một thang phần trăm.
  -- 4.4 KHÔNG phải thang 1–5: bốn mốc phần trăm là một thang, còn
  -- `no_homework` là trạng thái "không áp dụng". Gộp thành 5 mức cùng cỡ là
  -- nói dối về hình dạng dữ liệu.
  comprehension_level smallint check (comprehension_level between 1 and 5),
  interaction_level smallint check (interaction_level between 1 and 5),
  focus_level smallint check (focus_level between 1 and 5),
  homework_completion text check (
    homework_completion in ('gt_90', '70_89', '50_69', 'lt_50', 'no_homework')
  ),

  -- Mục 5 — "không có học viên cần lưu ý". Học viên nằm ở bảng con.
  no_students_of_note boolean not null default false,

  -- Mục 6 — vấn đề phát sinh
  has_issue boolean,
  issue_categories text[] not null default '{}',
  issue_other text check (char_length(coalesce(issue_other, '')) <= 500),
  issue_description text check (char_length(coalesce(issue_description, '')) <= 2000),
  issue_impact text check (
    issue_impact in ('negligible', 'completed_anyway', 'major')
  ),
  issue_severity text check (issue_severity in ('low', 'medium', 'high')),

  -- Mục 7 — kế hoạch buổi sau
  next_content text check (char_length(coalesce(next_content, '')) <= 2000),
  review_content text check (char_length(coalesce(review_content, '')) <= 2000),
  teacher_watch_note text check (char_length(coalesce(teacher_watch_note, '')) <= 2000),
  needs_support boolean,
  support_request text check (char_length(coalesce(support_request, '')) <= 2000),

  -- Mục 8 — minh chứng (file nằm ở bảng con)
  evidence_kinds text[] not null default '{}',

  -- Mục 9 — nhận xét tổng kết
  overall_rating text check (
    overall_rating in ('excellent', 'good', 'satisfactory', 'needs_improvement', 'unsatisfactory')
  ),
  closing_note text check (char_length(coalesce(closing_note, '')) <= 3000),

  -- XÁC NHẬN
  confirmed boolean not null default false,

  -- 🔴 Actor THẬT (`BUG_M06_01`). Không bao giờ là "giáo viên đầu tiên của lớp".
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  submitted_by uuid references auth.users(id) on delete restrict,
  submitted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Đã gửi thì buộc phải có đủ dấu vết ký: ai gửi, lúc nào, đã tick xác nhận,
  -- và ảnh chụp chuyên cần. Thiếu một thứ là hàng đó vô nghĩa về mặt đối soát.
  constraint session_reports_submitted_shape_check check (
    status <> 'submitted'
    or (
      submitted_by is not null
      and submitted_at is not null
      and confirmed
      and attendance_snapshot is not null
    )
  ),

  -- Nhóm vấn đề phải nằm trong danh sách đóng. `text[]` không tự kiểm được nên
  -- phải ghi ra đây; sai chính tả một giá trị là bộ lọc của giáo vụ im lặng bỏ
  -- sót hàng đó.
  constraint session_reports_issue_categories_check check (
    issue_categories <@ array[
      'student', 'curriculum', 'teacher', 'facility',
      'connection', 'schedule', 'other'
    ]::text[]
  ),

  constraint session_reports_evidence_kinds_check check (
    evidence_kinds <@ array[
      'classroom_photo', 'student_homework', 'materials', 'other'
    ]::text[]
  )
);

create index idx_session_reports_class on public.session_reports (class_id);
create index idx_session_reports_status on public.session_reports (status);
create index idx_session_reports_submitted_at on public.session_reports (submitted_at desc);

create trigger trg_session_reports_updated_at
before update on public.session_reports
for each row execute function app.set_updated_at();

-- `class_id` luôn suy từ buổi học, KHÔNG tin giá trị client gửi lên: đặt sai
-- class_id là tự cấp cho mình quyền đọc báo cáo của lớp khác qua RLS.
create or replace function app.sync_session_report_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select cs.class_id into new.class_id
  from public.class_sessions cs
  where cs.id = new.session_id;

  if new.class_id is null then
    raise exception 'Không tìm thấy buổi học của báo cáo';
  end if;

  return new;
end;
$$;

revoke all on function app.sync_session_report_class() from public, anon, authenticated;

create trigger trg_session_reports_sync_class
before insert or update of session_id on public.session_reports
for each row execute function app.sync_session_report_class();

-- --- Bảng con: học viên được nhắc tên -----------------------------------------

create table public.session_report_students (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null
    references public.session_reports(id) on delete cascade,
  category public.session_report_student_category not null,
  enrollment_id uuid not null
    references public.enrollments(id) on delete cascade,
  note text check (char_length(coalesce(note, '')) <= 1000),
  created_at timestamptz not null default now(),

  -- Cùng một học viên, cùng một nhóm, trong cùng một báo cáo chỉ được một hàng.
  constraint uq_session_report_students
    unique (report_id, category, enrollment_id)
);

create index idx_session_report_students_report
  on public.session_report_students (report_id);

-- --- Bảng con: minh chứng (mục 8) ---------------------------------------------

create table public.session_report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null
    references public.session_reports(id) on delete cascade,
  storage_path text not null unique check (btrim(storage_path) <> ''),
  bytes integer not null check (bytes > 0),
  uploaded_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index idx_session_report_evidence_report
  on public.session_report_evidence (report_id);

-- =============================================================================
-- HELPER — fail-closed, không có nhánh `return true` mặc định (`CR-M14-3`)
-- =============================================================================

-- Người đang đăng nhập có được SỬA báo cáo này không?
--
-- Ba vế cùng phải đúng: báo cáo còn nháp · người đó dạy lớp đó · (hoặc là super
-- admin đi sửa hộ). Giáo vụ KHÔNG tự động sửa được — giáo vụ chỉ sửa báo cáo
-- của lớp chính mình đứng, và khi đó `teaches_class()` đã đúng rồi.
create or replace function app.can_write_session_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select r.status = 'draft'
         and (app.teaches_class(r.class_id) or app.is_super_admin())
      from public.session_reports r
      where r.id = p_report_id
    ),
    false
  );
$$;

-- Người đang đăng nhập có được ĐỌC báo cáo này không?
create or replace function app.can_read_session_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select app.is_manager() or app.teaches_class(r.class_id)
      from public.session_reports r
      where r.id = p_report_id
    ),
    false
  );
$$;

-- Buổi này đã điểm danh xong chưa? "Xong" = mọi ghi danh ĐANG MỞ đều có một
-- hàng `attendance_records`. Lớp rỗng (0 ghi danh mở) trả `false`: không có ai
-- để điểm danh thì cũng không có buổi dạy để báo cáo.
create or replace function app.session_attendance_complete(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select count(*) filter (where ar.enrollment_id is not null) = count(*)
         and count(*) > 0
      from public.class_sessions cs
      join public.enrollments e
        on e.class_id = cs.class_id
       and e.status in ('pending', 'active', 'paused')
      left join public.attendance_records ar
        on ar.session_id = cs.id
       and ar.enrollment_id = e.id
      where cs.id = p_session_id
    ),
    false
  );
$$;

revoke all on function app.can_write_session_report(uuid) from public, anon;
revoke all on function app.can_read_session_report(uuid) from public, anon;
revoke all on function app.session_attendance_complete(uuid) from public, anon;
grant execute on function app.can_write_session_report(uuid) to authenticated, service_role;
grant execute on function app.can_read_session_report(uuid) to authenticated, service_role;
grant execute on function app.session_attendance_complete(uuid) to authenticated, service_role;

-- =============================================================================
-- RLS — mọi bảng, không ngoại lệ (`D-13`)
-- =============================================================================

alter table public.session_reports enable row level security;
alter table public.session_report_students enable row level security;
alter table public.session_report_evidence enable row level security;

-- 🔴 GRANT/REVOKE TƯỜNG MINH — đừng tin `20260713000015_grants.sql` đã lo hộ.
--
-- Cả hai câu `… on all tables in schema public …` ở migration 15 chỉ có hiệu
-- lực **một lần, tại thời điểm nó chạy**; bảng tạo sau đó không được đụng tới.
-- Hệ quả đo được trên chính local ngay sau khi tạo ba bảng này:
--   • `authenticated` KHÔNG có quyền nào ⇒ mọi câu select trả "permission denied"
--     (bài pgTAP đỏ ngay ở phép đo đầu tiên — đó là cách phát hiện ra).
--   • `anon` LẠI CÓ 9 quyền, vì `pg_default_acl` của project này vẫn cấp cho
--     bảng mới trong schema `public` — đúng nguyên nhân gốc của `BLK-6`.
--
-- Chưa rò dữ liệu vì RLS đang bật và không policy nào nhắc `anon`. Nhưng lớp
-- phòng thủ thứ hai thì mất: chỉ cần một policy permissive `to public` lọt vào
-- sau này là anon đọc được thật. Ba bảng này chứa nhận xét nội bộ về học viên.
--
-- ⛔ KHÔNG cấp `delete` trên `session_reports`: báo cáo là dữ liệu lịch sử. Hai
-- bảng con thì có — bỏ một tên học viên hay gỡ một ảnh khỏi bản nháp là thao
-- tác soạn thảo, không phải xoá lịch sử.
grant select, insert, update on public.session_reports to authenticated;
grant select, insert, update, delete on public.session_report_students to authenticated;
grant select, insert, delete on public.session_report_evidence to authenticated;

revoke all on public.session_reports from anon;
revoke all on public.session_report_students from anon;
revoke all on public.session_report_evidence from anon;

-- ⛔ KHÔNG có policy nào cho học viên ⇒ học viên đọc trả 0 hàng. Đó là hành vi
-- đúng: báo cáo có nhận xét nội bộ về chính học viên.

create policy "quản lý và giáo viên của lớp đọc báo cáo"
on public.session_reports
for select to authenticated
using (app.is_manager() or app.teaches_class(class_id));

-- Tạo bản nháp: chỉ giáo viên của lớp, chỉ ở trạng thái nháp, và `created_by`
-- phải là chính mình. Không cho tạo thẳng hàng `submitted` — cửa đó chỉ mở qua
-- `submit_session_report()`.
create policy "giáo viên tạo bản nháp báo cáo lớp mình"
on public.session_reports
for insert to authenticated
with check (
  (app.teaches_class(class_id) or app.is_super_admin())
  and status = 'draft'
  and created_by = auth.uid()
  and submitted_by is null
  and submitted_at is null
  and attendance_snapshot is null
);

-- 🔴 Sửa được KHI VÀ CHỈ KHI còn nháp, và sau khi sửa VẪN phải là nháp.
-- Vế `with check` mới là vế chặn client tự set `status = 'submitted'` để nhảy
-- qua cổng điểm danh. Bỏ vế đó là mở toang cửa hậu.
create policy "giáo viên sửa bản nháp báo cáo lớp mình"
on public.session_reports
for update to authenticated
using (
  status = 'draft'
  and (app.teaches_class(class_id) or app.is_super_admin())
)
with check (
  status = 'draft'
  and (app.teaches_class(class_id) or app.is_super_admin())
  and submitted_by is null
  and submitted_at is null
);

-- ⛔ KHÔNG có policy DELETE: báo cáo là dữ liệu lịch sử, không hard delete.

create policy "đọc học viên được nhắc trong báo cáo"
on public.session_report_students
for select to authenticated
using (app.can_read_session_report(report_id));

create policy "giáo viên ghi học viên vào bản nháp"
on public.session_report_students
for insert to authenticated
with check (app.can_write_session_report(report_id));

create policy "giáo viên sửa học viên trong bản nháp"
on public.session_report_students
for update to authenticated
using (app.can_write_session_report(report_id))
with check (app.can_write_session_report(report_id));

-- Bảng con này thì XOÁ ĐƯỢC khi còn nháp — bỏ tên một học viên khỏi danh sách
-- là thao tác soạn thảo bình thường, không phải xoá dữ liệu lịch sử.
create policy "giáo viên bỏ học viên khỏi bản nháp"
on public.session_report_students
for delete to authenticated
using (app.can_write_session_report(report_id));

create policy "đọc minh chứng của báo cáo"
on public.session_report_evidence
for select to authenticated
using (app.can_read_session_report(report_id));

create policy "giáo viên thêm minh chứng vào bản nháp"
on public.session_report_evidence
for insert to authenticated
with check (
  app.can_write_session_report(report_id)
  and uploaded_by = auth.uid()
);

create policy "giáo viên gỡ minh chứng khỏi bản nháp"
on public.session_report_evidence
for delete to authenticated
using (app.can_write_session_report(report_id));

-- =============================================================================
-- RPC — lưu nháp
-- =============================================================================

-- Một lượt lưu nháp ghi cả hàng báo cáo lẫn danh sách học viên được nhắc tên.
-- Gom vào một RPC để hai phần không bao giờ lệch nhau, và để `class_id` được
-- suy ở server chứ không nhận từ client.
--
-- `p_students` có dạng: [{"category":"needs_support","enrollment_id":"…","note":"…"}, …]
create or replace function public.save_session_report(
  p_session_id uuid,
  p_form       jsonb,
  p_students   jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id  uuid;
  v_report    public.session_reports%rowtype;
  v_report_id uuid;
begin
  select cs.class_id into v_class_id
  from public.class_sessions cs
  where cs.id = p_session_id;

  if v_class_id is null then
    raise exception 'Không tìm thấy buổi học';
  end if;

  if not (app.teaches_class(v_class_id) or app.is_super_admin()) then
    raise exception 'Không có quyền báo cáo buổi học này';
  end if;

  select * into v_report
  from public.session_reports
  where session_id = p_session_id
  for update;

  if v_report.id is not null and v_report.status = 'submitted' then
    raise exception 'Báo cáo đã gửi, không sửa được nữa';
  end if;

  insert into public.session_reports as r (
    session_id, class_id,
    mode, topic,
    plan_completion, has_unfinished, unfinished_content, unfinished_reason,
    has_homework, homework_assigned,
    comprehension_level, interaction_level, focus_level, homework_completion,
    no_students_of_note,
    has_issue, issue_categories, issue_other, issue_description,
    issue_impact, issue_severity,
    next_content, review_content, teacher_watch_note, needs_support, support_request,
    evidence_kinds,
    overall_rating, closing_note,
    confirmed
  )
  values (
    p_session_id, v_class_id,
    (p_form ->> 'mode')::public.session_report_mode,
    nullif(btrim(coalesce(p_form ->> 'topic', '')), ''),
    nullif(p_form ->> 'plan_completion', ''),
    (p_form ->> 'has_unfinished')::boolean,
    nullif(btrim(coalesce(p_form ->> 'unfinished_content', '')), ''),
    nullif(btrim(coalesce(p_form ->> 'unfinished_reason', '')), ''),
    (p_form ->> 'has_homework')::boolean,
    nullif(btrim(coalesce(p_form ->> 'homework_assigned', '')), ''),
    (p_form ->> 'comprehension_level')::smallint,
    (p_form ->> 'interaction_level')::smallint,
    (p_form ->> 'focus_level')::smallint,
    nullif(p_form ->> 'homework_completion', ''),
    coalesce((p_form ->> 'no_students_of_note')::boolean, false),
    (p_form ->> 'has_issue')::boolean,
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(p_form -> 'issue_categories')),
      '{}'::text[]
    ),
    nullif(btrim(coalesce(p_form ->> 'issue_other', '')), ''),
    nullif(btrim(coalesce(p_form ->> 'issue_description', '')), ''),
    nullif(p_form ->> 'issue_impact', ''),
    nullif(p_form ->> 'issue_severity', ''),
    nullif(btrim(coalesce(p_form ->> 'next_content', '')), ''),
    nullif(btrim(coalesce(p_form ->> 'review_content', '')), ''),
    nullif(btrim(coalesce(p_form ->> 'teacher_watch_note', '')), ''),
    (p_form ->> 'needs_support')::boolean,
    nullif(btrim(coalesce(p_form ->> 'support_request', '')), ''),
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(p_form -> 'evidence_kinds')),
      '{}'::text[]
    ),
    nullif(p_form ->> 'overall_rating', ''),
    nullif(btrim(coalesce(p_form ->> 'closing_note', '')), ''),
    coalesce((p_form ->> 'confirmed')::boolean, false)
  )
  on conflict (session_id) do update
  set mode = excluded.mode,
      topic = excluded.topic,
      plan_completion = excluded.plan_completion,
      has_unfinished = excluded.has_unfinished,
      unfinished_content = excluded.unfinished_content,
      unfinished_reason = excluded.unfinished_reason,
      has_homework = excluded.has_homework,
      homework_assigned = excluded.homework_assigned,
      comprehension_level = excluded.comprehension_level,
      interaction_level = excluded.interaction_level,
      focus_level = excluded.focus_level,
      homework_completion = excluded.homework_completion,
      no_students_of_note = excluded.no_students_of_note,
      has_issue = excluded.has_issue,
      issue_categories = excluded.issue_categories,
      issue_other = excluded.issue_other,
      issue_description = excluded.issue_description,
      issue_impact = excluded.issue_impact,
      issue_severity = excluded.issue_severity,
      next_content = excluded.next_content,
      review_content = excluded.review_content,
      teacher_watch_note = excluded.teacher_watch_note,
      needs_support = excluded.needs_support,
      support_request = excluded.support_request,
      evidence_kinds = excluded.evidence_kinds,
      overall_rating = excluded.overall_rating,
      closing_note = excluded.closing_note,
      confirmed = excluded.confirmed
  returning r.id into v_report_id;

  -- Danh sách học viên được nhắc tên: thay TOÀN BỘ theo payload. Giáo viên bỏ
  -- một tên ra khỏi form thì hàng đó phải biến mất, nên không dùng upsert.
  delete from public.session_report_students where report_id = v_report_id;

  insert into public.session_report_students (report_id, category, enrollment_id, note)
  select
    v_report_id,
    (item ->> 'category')::public.session_report_student_category,
    (item ->> 'enrollment_id')::uuid,
    nullif(btrim(coalesce(item ->> 'note', '')), '')
  from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) as item
  -- Chỉ nhận học viên THẬT SỰ thuộc lớp này. Thiếu vế này thì giáo viên gọi
  -- thẳng RPC có thể gắn học viên lớp khác vào báo cáo của mình.
  where exists (
    select 1
    from public.enrollments e
    where e.id = (item ->> 'enrollment_id')::uuid
      and e.class_id = v_class_id
  )
  on conflict (report_id, category, enrollment_id) do nothing;

  return v_report_id;
end;
$$;

revoke all on function public.save_session_report(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_session_report(uuid, jsonb, jsonb) to authenticated;

-- =============================================================================
-- RPC — gửi báo cáo (cổng chặn thật)
-- =============================================================================

-- 🔴 ĐÂY LÀ CHỐT CHẶN, không phải một bước xác nhận cho đẹp.
--
-- Bốn điều kiện, kiểm lại TỪ ĐẦU chứ không tin cờ nào của trình duyệt:
--   1. người gọi thật sự dạy lớp đó
--   2. báo cáo còn ở trạng thái nháp
--   3. ĐÃ ĐIỂM DANH ĐỦ  ← vế mà cả module này dựng lên để bảo vệ
--   4. đã tick ô xác nhận
--
-- Phần "đủ 9 mục chưa" cố ý KHÔNG kiểm ở đây: đó là luật hình thức của biểu
-- mẫu, sống ở `src/features/session-reports/domain/completion.ts` cùng với luật
-- vẽ mục lục — một luật, một nơi. Chép sang plpgsql là có hai bản sẽ lệch nhau.
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

  -- --- Chụp lại mục 2 (vế (c) ở đầu file) -----------------------------------
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
  into v_snapshot
  from public.enrollments e
  join public.students s on s.id = e.student_id
  left join public.attendance_records ar
    on ar.session_id = p_session_id and ar.enrollment_id = e.id
  where e.class_id = v_session.class_id
    and e.status in ('pending', 'active', 'paused');

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

revoke all on function public.submit_session_report(uuid) from public, anon;
grant execute on function public.submit_session_report(uuid) to authenticated;

-- =============================================================================
-- RPC — công bố / bỏ công bố flashcard HÀNG LOẠT (`FLASHCARD-BULKPUB-1`)
-- =============================================================================

-- Trả về từng buổi một dòng để hộp thoại kết quả nói đúng buổi nào hỏng vì lý
-- do gì — lý do lấy từ CHÍNH thông báo của trigger `validate_flashcard_section_publish`,
-- app không nhân bản luật hợp lệ (`D-43` điểm 4).
--
-- 🔴 Mỗi buổi chạy trong MỘT KHỐI `exception` RIÊNG. Postgres coi đó là một
-- subtransaction, nên một buổi thiếu trang mở đầu chỉ làm hỏng đúng dòng của
-- nó, không kéo đổ 34 buổi còn lại.
create or replace function public.bulk_set_flashcard_section_status(
  p_deck_id uuid,
  p_target  public.flashcard_status
)
returns table (
  section_id     uuid,
  session_number integer,
  outcome        text,
  reason         text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  if not app.is_super_admin() then
    raise exception 'Không có quyền thao tác hàng loạt trên bộ flashcard';
  end if;

  if p_target not in ('draft', 'published') then
    raise exception 'Chỉ công bố hoặc đưa về nháp được';
  end if;

  if not exists (select 1 from public.flashcard_decks d where d.id = p_deck_id) then
    raise exception 'Không tìm thấy bộ flashcard';
  end if;

  for v_row in
    select s.id, s.session_number, s.status
    from public.flashcard_sections s
    where s.deck_id = p_deck_id
      and s.archived_at is null
    order by s.session_number
  loop
    section_id := v_row.id;
    session_number := v_row.session_number;

    -- Đã ở đúng trạng thái đích ⇒ BỎ QUA, không phải lỗi, và quan trọng nhất
    -- là KHÔNG chạm vào `published_at` của buổi đã công bố.
    if v_row.status = p_target then
      outcome := 'skipped';
      reason := null;
      return next;
      continue;
    end if;

    begin
      if p_target = 'published' then
        update public.flashcard_sections
        set status = 'published'
        where id = v_row.id;
      else
        update public.flashcard_sections
        set status = 'draft', published_at = null
        where id = v_row.id;
      end if;

      outcome := 'changed';
      reason := null;
    exception
      when others then
        outcome := 'failed';
        reason := sqlerrm;
    end;

    return next;
  end loop;

  perform app.write_audit(
    case when p_target = 'published'
      then 'flashcard.deck.bulk_publish'
      else 'flashcard.deck.bulk_unpublish'
    end,
    'flashcard_deck',
    p_deck_id,
    null,
    jsonb_build_object('target', p_target)
  );

  return;
end;
$$;

revoke all on function public.bulk_set_flashcard_section_status(uuid, public.flashcard_status)
  from public, anon;
grant execute on function public.bulk_set_flashcard_section_status(uuid, public.flashcard_status)
  to authenticated;

-- =============================================================================
-- STORAGE — minh chứng buổi học (mục 8)
-- =============================================================================

-- 5MB/file là trần CỨNG ở tầng bucket, không phải lời khuyên ở client. Ảnh đã
-- được nén ở trình duyệt (`compress-image.ts`, ~200KB), nên chạm trần nghĩa là
-- nén đã fail-open — vẫn cho qua, chỉ chặn file thật sự lớn.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-report-evidence',
  'session-report-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Đường dẫn: <auth.uid()>/<session_id>/<tên file>. Vế thư mục đầu = uid chặn
-- giáo viên ghi đè file của người khác.
create policy session_report_evidence_teacher_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'session-report-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
  and app.my_teacher_id() is not null
);

create policy session_report_evidence_owner_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'session-report-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Đọc: người tải lên, hoặc quản lý (giáo vụ/super admin) đi xem báo cáo.
create policy session_report_evidence_read
on storage.objects
for select to authenticated
using (
  bucket_id = 'session-report-evidence'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or app.is_manager()
  )
);

-- =============================================================================
-- Chú thích
-- =============================================================================

comment on table public.session_reports is
  'Báo cáo sau buổi dạy của giáo viên — 9 mục theo docs/BaoCao.pdf (D-43). '
  'Mục 3 KHÔNG có cột riêng: bài học/nội dung thực dạy/ghi chú sống ở class_sessions '
  'và đi qua save_session_log(). Mục 2 chỉ được chụp lại lúc gửi.';

comment on column public.session_reports.attendance_snapshot is
  'Ảnh chụp chuyên cần tại thời điểm gửi. Null khi còn nháp (giao diện đọc trực '
  'tiếp từ attendance_records). Sửa điểm danh sau khi gửi KHÔNG làm đổi cột này.';

comment on function public.submit_session_report(uuid) is
  'Cổng chặn thật của module: kiểm quyền dạy lớp, còn nháp, ĐÃ ĐIỂM DANH ĐỦ và '
  'đã tick xác nhận. Gọi thẳng RPC bỏ qua UI vẫn bị chặn.';

comment on function public.bulk_set_flashcard_section_status(uuid, public.flashcard_status) is
  'Công bố/bỏ công bố mọi buổi của một bộ. Mỗi buổi chạy trong subtransaction '
  'riêng nên buổi hỏng không kéo đổ cả lô; trả về outcome changed/skipped/failed '
  'kèm lý do lấy từ chính trigger validate_flashcard_section_publish.';
