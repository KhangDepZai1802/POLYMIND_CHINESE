-- =============================================================================
-- 27 — Assessment: integrity bài kiểm tra + nhập điểm/công bố qua RPC
-- =============================================================================

-- Thang điểm phân loại (`grading_scale_rules`) chạy trên 0..100, và mọi cột điểm
-- của `assessment_results` đã CHECK 0..100. Nếu để giáo viên đặt max_score = 300
-- thì họ tạo được bài KT mà không bao giờ nhập nổi điểm đúng thang — bẫy im lặng.
-- Chốt luôn ở DB: bài kiểm tra chấm theo thang 0..100.
alter table public.assessments
  add constraint assessments_max_score_scale_check check (max_score <= 100);

-- -----------------------------------------------------------------------------
-- Assessment: draft ≠ published, actor thật, lesson/module đúng khóa
-- -----------------------------------------------------------------------------

-- Chuẩn hóa scope: lesson/module gắn vào bài KT phải thuộc đúng khóa học của lớp.
-- Không có ràng buộc này thì bài KT của LOP-01 gắn được vào bài học của khóa khác.
create or replace function app.assert_assessment_scope(
  p_class_id uuid,
  p_lesson_id uuid,
  p_module_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  select c.course_id into v_course_id
  from public.classes c
  where c.id = p_class_id;

  if v_course_id is null then
    raise exception 'Lớp của bài kiểm tra không tồn tại hoặc chưa gắn khóa học';
  end if;

  if p_module_id is not null and not exists (
    select 1 from public.course_modules m
    where m.id = p_module_id and m.course_id = v_course_id
  ) then
    raise exception 'Chương không thuộc khóa học của lớp này';
  end if;

  if p_lesson_id is not null and not exists (
    select 1
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    where l.id = p_lesson_id and m.course_id = v_course_id
  ) then
    raise exception 'Bài học không thuộc khóa học của lớp này';
  end if;
end;
$$;

-- Bài KT luôn sinh ra ở trạng thái nháp. `published_at` do client gửi lên bị bỏ:
-- công bố là một hành động riêng (RPC), không phải một cột form.
create or replace function app.enforce_assessment_initial_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.assert_assessment_scope(new.class_id, new.lesson_id, new.module_id);

  -- Mọi user flow có JWT (kể cả super admin) đi qua cùng một trạng thái đầu.
  -- Seed/migration chạy không có auth.uid() vẫn nạp được dữ liệu lịch sử.
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.published_at := null;
  end if;

  return new;
end;
$$;

create trigger trg_assessments_initial_state
  before insert on public.assessments
  for each row execute function app.enforce_assessment_initial_state();

create or replace function app.enforce_assessment_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.class_id is distinct from old.class_id then
      raise exception 'Không thể chuyển bài kiểm tra sang lớp khác';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'Không thể đổi người tạo bài kiểm tra';
    end if;
  end if;

  perform app.assert_assessment_scope(new.class_id, new.lesson_id, new.module_id);
  return new;
end;
$$;

create trigger trg_assessments_update_integrity
  before update on public.assessments
  for each row execute function app.enforce_assessment_update();

-- Bài KT đã công bố là lịch sử điểm của học viên: không hard delete.
create or replace function app.prevent_published_assessment_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and old.published_at is not null then
    raise exception 'Bài kiểm tra đã công bố kết quả nên không thể xóa';
  end if;
  return old;
end;
$$;

create trigger trg_assessments_no_delete_published
  before delete on public.assessments
  for each row execute function app.prevent_published_assessment_delete();

-- Column grant: `published_at`/`created_by`/`class_id` không còn là dữ liệu client
-- tự quyết. Trigger ở trên là lưới thứ hai; RPC (SECURITY DEFINER) đi vòng qua
-- được column grant nên vẫn công bố được.
revoke update on public.assessments from authenticated;
grant update (
  lesson_id, module_id, type, title, assessment_date, max_score, skill_weights
) on public.assessments to authenticated;

-- -----------------------------------------------------------------------------
-- Assessment results: một hành động = một đường ghi (RPC)
-- -----------------------------------------------------------------------------

-- Điểm là dữ liệu học viên nhìn thấy và khiếu nại được. Đóng hẳn đường INSERT/
-- UPDATE trực tiếp: mọi lần nhập điểm đều qua `save_assessment_result` để không
-- có ba đường code cùng set điểm theo ba cách khác nhau (bài học BUG_M10_01).
revoke insert, update on public.assessment_results from authenticated;

create or replace function app.enforce_assessment_result_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assessment public.assessments%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_score numeric;
begin
  select * into v_assessment
  from public.assessments where id = new.assessment_id;

  select * into v_enrollment
  from public.enrollments where id = new.enrollment_id;

  if v_assessment.id is null or v_enrollment.id is null
     or v_enrollment.class_id is distinct from v_assessment.class_id then
    raise exception 'Kết quả không khớp lớp của bài kiểm tra và ghi danh';
  end if;

  -- Học viên đã rút/chuyển lớp không còn thuộc lớp: chấm điểm cho họ là ghi sai
  -- vào lịch sử. Ghi danh `completed` vẫn nhận điểm — bài cuối kỳ chấm sau khi
  -- học viên đã hoàn thành khóa là chuyện bình thường.
  if v_enrollment.status in ('withdrawn', 'transferred') then
    raise exception 'Học viên không còn thuộc lớp này';
  end if;

  foreach v_score in array array[
    new.overall_score, new.listening_score, new.speaking_score,
    new.reading_score, new.writing_score, new.vocabulary_score, new.grammar_score
  ] loop
    if v_score is not null and (v_score < 0 or v_score > v_assessment.max_score) then
      raise exception 'Điểm phải từ 0 đến %', v_assessment.max_score;
    end if;
  end loop;

  if auth.uid() is not null then
    new.graded_by := auth.uid();
    new.graded_at := now();
  end if;

  return new;
end;
$$;

create trigger trg_assessment_results_integrity
  before insert or update on public.assessment_results
  for each row execute function app.enforce_assessment_result_integrity();

-- Kết quả đã công bố học viên đã nhìn thấy → không xóa để "sửa điểm cho gọn".
create or replace function app.prevent_published_result_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and old.published_at is not null then
    raise exception 'Kết quả đã công bố nên không thể xóa';
  end if;
  return old;
end;
$$;

create trigger trg_assessment_results_no_delete_published
  before delete on public.assessment_results
  for each row execute function app.prevent_published_result_delete();

-- Nhập/sửa điểm: nguyên tử, actor thật, idempotent theo (assessment, enrollment).
-- Bấm Lưu hai lần không sinh hai dòng điểm — chống trùng bằng UNIQUE ở DB
-- (`uq_assessment_results`) + ON CONFLICT, không bằng disable nút ở client.
create or replace function public.save_assessment_result(
  p_assessment_id uuid,
  p_enrollment_id uuid,
  p_overall_score numeric default null,
  p_listening_score numeric default null,
  p_speaking_score numeric default null,
  p_reading_score numeric default null,
  p_writing_score numeric default null,
  p_vocabulary_score numeric default null,
  p_grammar_score numeric default null,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assessment public.assessments%rowtype;
  v_result public.assessment_results%rowtype;
  v_before jsonb;
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập';
  end if;

  select * into v_assessment
  from public.assessments
  where id = p_assessment_id
  for update;

  if v_assessment.id is null then
    raise exception 'Không tìm thấy bài kiểm tra';
  end if;

  if not (app.is_super_admin() or app.teaches_class(v_assessment.class_id)) then
    raise exception 'Không có quyền nhập điểm cho bài kiểm tra này';
  end if;

  select * into v_result
  from public.assessment_results
  where assessment_id = p_assessment_id and enrollment_id = p_enrollment_id;

  v_before := case when v_result.id is null then null else jsonb_build_object(
    'overall_score', v_result.overall_score,
    'classification', v_result.classification,
    'published_at', v_result.published_at
  ) end;

  insert into public.assessment_results as r (
    assessment_id, enrollment_id,
    overall_score, listening_score, speaking_score, reading_score,
    writing_score, vocabulary_score, grammar_score, feedback
  )
  values (
    p_assessment_id, p_enrollment_id,
    p_overall_score, p_listening_score, p_speaking_score, p_reading_score,
    p_writing_score, p_vocabulary_score, p_grammar_score,
    nullif(btrim(p_feedback), '')
  )
  on conflict (assessment_id, enrollment_id) do update
  set overall_score    = excluded.overall_score,
      listening_score  = excluded.listening_score,
      speaking_score   = excluded.speaking_score,
      reading_score    = excluded.reading_score,
      writing_score    = excluded.writing_score,
      vocabulary_score = excluded.vocabulary_score,
      grammar_score    = excluded.grammar_score,
      feedback         = excluded.feedback
  -- `published_at` KHÔNG nằm trong SET: sửa điểm sau khi công bố không âm thầm
  -- thu hồi kết quả học viên đã thấy, và cũng không tự công bố bản nháp.
  returning r.* into v_result;

  perform app.write_audit(
    'assessment.save_result',
    'assessment_result',
    v_result.id,
    v_before,
    jsonb_build_object(
      'assessment_id', v_result.assessment_id,
      'enrollment_id', v_result.enrollment_id,
      'overall_score', v_result.overall_score,
      'classification', v_result.classification,
      'graded_by', v_result.graded_by
    )
  );

  return jsonb_build_object(
    'id', v_result.id,
    'overall_score', v_result.overall_score,
    'classification', v_result.classification,
    'graded_by', v_result.graded_by,
    'graded_at', v_result.graded_at,
    'published_at', v_result.published_at
  );
end;
$$;

revoke all on function public.save_assessment_result(
  uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) from public, anon;
grant execute on function public.save_assessment_result(
  uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) to authenticated, service_role;

-- Công bố: RPC cũ đã đúng phần quyền/dedupe, nhưng cho phép công bố một bài KT
-- CHƯA CÓ kết quả nào — khi đó `assessments.published_at` được set, học viên nhận
-- thông báo... rỗng, và bài KT bị khóa không xóa được. Chốt lại: không có điểm thì
-- không có gì để công bố. Thêm khóa hàng để hai lần bấm đồng thời không đua nhau.
create or replace function public.publish_assessment_results(p_assessment_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assessment public.assessments%rowtype;
  v_scored  integer := 0;
  v_count   integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập';
  end if;

  select * into v_assessment
  from public.assessments
  where id = p_assessment_id
  for update;

  if v_assessment.id is null then
    raise exception 'Không tìm thấy bài kiểm tra';
  end if;

  if not (app.is_super_admin() or app.teaches_class(v_assessment.class_id)) then
    raise exception 'Không có quyền công bố kết quả bài kiểm tra này';
  end if;

  select count(*) into v_scored
  from public.assessment_results
  where assessment_id = p_assessment_id
    and overall_score is not null;

  if v_scored = 0 then
    raise exception 'Chưa có điểm nào để công bố';
  end if;

  -- Chỉ công bố dòng đã có điểm tổng: học viên chưa được chấm thì không nhận
  -- thông báo "đã có kết quả" rồi mở ra thấy ô trống.
  update public.assessment_results
  set published_at = now()
  where assessment_id = p_assessment_id
    and published_at is null
    and overall_score is not null;

  get diagnostics v_count = row_count;

  update public.assessments
  set published_at = coalesce(published_at, now())
  where id = p_assessment_id;

  -- Thông báo cho học viên đã có kết quả công bố. dedupe_key chống sinh trùng khi
  -- công bố lại (chấm bù thêm học viên rồi bấm Công bố lần hai).
  insert into public.notifications
    (user_id, type, title, body, link, resource_type, resource_id, dedupe_key)
  select
    s.user_id,
    'result_published',
    'Kết quả đã được công bố',
    format('Kết quả bài "%s" đã có.', v_assessment.title),
    '/student/results',
    'assessment',
    p_assessment_id,
    format('result_published:%s:%s', p_assessment_id, s.user_id)
  from public.assessment_results r
  join public.enrollments e on e.id = r.enrollment_id
  join public.students s on s.id = e.student_id
  where r.assessment_id = p_assessment_id
    and r.published_at is not null
    and s.user_id is not null
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  perform app.write_audit(
    'assessment.publish', 'assessment', p_assessment_id,
    jsonb_build_object('published_at', v_assessment.published_at),
    jsonb_build_object('newly_published_results', v_count, 'scored_results', v_scored)
  );

  return v_count;
end;
$$;

revoke all on function public.publish_assessment_results(uuid) from public, anon;
grant execute on function public.publish_assessment_results(uuid)
  to authenticated, service_role;
