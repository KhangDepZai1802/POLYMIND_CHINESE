-- =============================================================================
-- 28 — Đánh giá học tập & ghi chú: actor thật + công bố là hành động riêng
-- =============================================================================
--
-- RLS đã đúng từ migration nền: học viên chỉ đọc `learning_evaluations` khi
-- `published_at IS NOT NULL AND visible_to_student`, và chỉ đọc `student_notes`
-- khi `visibility = 'student_visible'`. Migration này bịt các lỗ ở tầng GHI:
-- attribution giả, và "công bố" bị hạ cấp thành một cột form.

-- -----------------------------------------------------------------------------
-- Ghi chú học viên (student_notes)
-- -----------------------------------------------------------------------------

-- `created_by` là bằng chứng ai viết ghi chú về một học viên — không thể để client
-- khai. Enrollment cũng bất biến: đổi enrollment là chuyển ghi chú sang hồ sơ
-- người khác, không phải "sửa".
create or replace function app.enforce_student_note_attribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
  else
    if auth.uid() is not null then
      if new.created_by is distinct from old.created_by then
        raise exception 'Không thể đổi người viết ghi chú';
      end if;
      if new.enrollment_id is distinct from old.enrollment_id then
        raise exception 'Không thể chuyển ghi chú sang học viên khác';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_student_notes_attribution
  before insert or update on public.student_notes
  for each row execute function app.enforce_student_note_attribution();

-- -----------------------------------------------------------------------------
-- Đánh giá học tập (learning_evaluations)
-- -----------------------------------------------------------------------------

-- Hai cột cùng quyết định "học viên có thấy không" (`published_at` và
-- `visible_to_student`) là một cái bẫy: bật một cột, quên cột kia → giáo viên tin
-- là đã gửi đánh giá cho học viên, học viên thì không thấy gì (hoặc ngược lại,
-- tưởng còn nháp mà học viên đã đọc được). Chốt: **chỉ RPC được đặt hai cột này,
-- và luôn đặt CÙNG NHAU.**
create or replace function app.enforce_evaluation_initial_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.published_at := null;
    new.visible_to_student := false;
  end if;

  return new;
end;
$$;

create trigger trg_learning_evaluations_initial_state
  before insert on public.learning_evaluations
  for each row execute function app.enforce_evaluation_initial_state();

create or replace function app.enforce_evaluation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.created_by is distinct from old.created_by then
      raise exception 'Không thể đổi người tạo đánh giá';
    end if;
    if new.enrollment_id is distinct from old.enrollment_id then
      raise exception 'Không thể chuyển đánh giá sang học viên khác';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_learning_evaluations_update_integrity
  before update on public.learning_evaluations
  for each row execute function app.enforce_evaluation_update();

-- Đánh giá đã gửi cho học viên là lịch sử: không hard delete để "sửa cho gọn".
create or replace function app.prevent_published_evaluation_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and old.published_at is not null then
    raise exception 'Đánh giá đã công bố nên không thể xóa';
  end if;
  return old;
end;
$$;

create trigger trg_learning_evaluations_no_delete_published
  before delete on public.learning_evaluations
  for each row execute function app.prevent_published_evaluation_delete();

-- `published_at` / `visible_to_student` / `created_by` / `enrollment_id` không còn
-- là dữ liệu client tự quyết. RPC (SECURITY DEFINER) đi vòng qua column grant.
revoke update on public.learning_evaluations from authenticated;
grant update (
  period_start, period_end, evaluation_date,
  overall_rating, listening_rating, speaking_rating, reading_rating,
  writing_rating, vocabulary_rating, grammar_rating,
  strengths, areas_for_improvement, action_plan, teacher_comment
) on public.learning_evaluations to authenticated;

-- Công bố đánh giá: đặt CẢ HAI cột hiển thị + thông báo + audit trong một
-- transaction. `dedupe_key` chặn thông báo trùng khi công bố lại.
create or replace function public.publish_evaluation(p_evaluation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evaluation public.learning_evaluations%rowtype;
  v_class_id uuid;
  v_student_user_id uuid;
  v_was_published timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập';
  end if;

  select * into v_evaluation
  from public.learning_evaluations
  where id = p_evaluation_id
  for update;

  if v_evaluation.id is null then
    raise exception 'Không tìm thấy đánh giá';
  end if;

  select e.class_id, s.user_id into v_class_id, v_student_user_id
  from public.enrollments e
  join public.students s on s.id = e.student_id
  where e.id = v_evaluation.enrollment_id;

  if not (app.is_super_admin() or app.teaches_class(v_class_id)) then
    raise exception 'Không có quyền công bố đánh giá này';
  end if;

  v_was_published := v_evaluation.published_at;

  update public.learning_evaluations
  set published_at = coalesce(published_at, now()),
      visible_to_student = true
  where id = p_evaluation_id
  returning * into v_evaluation;

  if v_student_user_id is not null then
    insert into public.notifications (
      user_id, type, title, body, link, resource_type, resource_id, dedupe_key
    )
    values (
      v_student_user_id,
      'result_published'::public.notification_type,
      'Đánh giá học tập mới',
      'Giáo viên đã gửi bản đánh giá học tập của bạn.',
      '/student/evaluations',
      'learning_evaluation',
      v_evaluation.id,
      'evaluation_published:' || v_evaluation.id::text
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  perform app.write_audit(
    'evaluation.publish',
    'learning_evaluation',
    v_evaluation.id,
    jsonb_build_object('published_at', v_was_published),
    jsonb_build_object(
      'published_at', v_evaluation.published_at,
      'visible_to_student', v_evaluation.visible_to_student
    )
  );

  return jsonb_build_object(
    'id', v_evaluation.id,
    'published_at', v_evaluation.published_at,
    'visible_to_student', v_evaluation.visible_to_student,
    'already_published', v_was_published is not null
  );
end;
$$;

revoke all on function public.publish_evaluation(uuid) from public, anon;
grant execute on function public.publish_evaluation(uuid) to authenticated, service_role;
