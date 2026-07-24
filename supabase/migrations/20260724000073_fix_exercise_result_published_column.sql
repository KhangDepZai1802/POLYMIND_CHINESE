-- Sửa lỗi user gặp khi bấm "Lưu tất cả điểm đã nhập" ở màn chấm bài tập:
--   column "result_published_at" does not exist
--
-- Nguyên nhân, đã dựng lại từ lịch sử migration:
--   * Cột thật của `public.exercise_attempts` là `results_published_at`
--     (SỐ NHIỀU) — `20260716000038_assessment_engine_schema.sql:238`.
--   * `20260716000049_assessment_release_jobs.sql` viết ĐÚNG tên cột.
--   * `20260716000050_fix_exercise_release_mode.sql:18` được viết để sửa một
--     lỗi khác (so enum `result_release_mode` với giá trị 'immediate' không tồn
--     tại), nhưng lúc chép lại thân hàm đã gõ rụng chữ `s`:
--       set result_published_at = coalesce(result_published_at, ...)
--
-- Vì sao không migration nào báo đỏ: thân hàm PL/pgSQL chỉ được kiểm CÚ PHÁP
-- lúc `create or replace`; câu SQL bên trong tới lần chạy đầu tiên mới được
-- phân giải tên cột. Trigger lại nằm sau HAI lớp điều kiện —
-- `new.status = 'graded'` và `result_release_mode = 'after_graded'` — nên lỗi
-- chỉ nổ đúng lúc lượt làm chuyển sang "đã chấm đủ" ở bài tập đặt chế độ trả
-- kết quả tự động. Bấm "Lưu tất cả" là cách phổ biến nhất chạm vào cả hai điều
-- kiện đó cùng lúc, nên user thấy lỗi ở đúng nút này.
--
-- ---------------------------------------------------------------------------
-- Hồi quy THỨ HAI trong cùng bản vá 50, sửa luôn ở đây (user chốt 2026-07-24).
--
-- Bản 49 gốc, sau khi đóng dấu thời điểm công bố, còn gửi thông báo
-- 'exercise_result_published' cho học viên. Bản viết lại ở 50 đánh rơi hẳn khối
-- đó. Hệ quả: `after_graded` là chế độ trả kết quả DUY NHẤT im lặng —
-- `finalize_due_exercise_results` (after_due) và `publish_exercise_results`
-- (manual) đều có gửi. Học viên phải tự mò vào xem mới biết đã có điểm.
--
-- Chống gửi trùng nằm ở DB chứ không ở tầng ứng dụng (`BUG_M09_01`): unique
-- index bán phần `(user_id, dedupe_key) where dedupe_key is not null` cộng với
-- `on conflict ... do nothing`. Chấm đi chấm lại bao nhiêu lần cũng chỉ một
-- thông báo. Giữ NGUYÊN dạng khoá của bản 49 —
-- `exercise-result:<delivery>:<attempt>` — để đây đúng là khôi phục, không phải
-- nhân tiện đổi thiết kế.
create or replace function app.release_immediate_exercise_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.exercise_deliveries%rowtype;
  v_user uuid;
begin
  if new.status = 'graded' and old.status is distinct from new.status then
    select * into v_delivery
    from public.exercise_deliveries
    where id = new.delivery_id;

    if v_delivery.result_release_mode = 'after_graded' then
      update public.exercise_attempts
      set results_published_at = coalesce(results_published_at, clock_timestamp())
      where id = new.id;

      select s.user_id into v_user
      from public.enrollments e
      join public.students s on s.id = e.student_id
      where e.id = new.enrollment_id;

      if v_user is not null then
        insert into public.notifications(
          user_id, type, title, body, link, resource_type, resource_id, dedupe_key
        )
        values(
          v_user, 'exercise_result_published', 'Kết quả bài tập', v_delivery.title,
          '/student/exercises', 'exercise_delivery', v_delivery.id,
          'exercise-result:' || v_delivery.id || ':' || new.id
        )
        on conflict(user_id, dedupe_key) where dedupe_key is not null do nothing;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app.release_immediate_exercise_result() from public, anon, authenticated;
