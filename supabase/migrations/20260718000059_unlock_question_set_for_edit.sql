-- 59 — "Chỉnh sửa" bộ đã khóa = MỞ KHÓA SỬA TẠI CHỖ (thay cho clone bản mới)
--
-- User chốt 2026-07-18: khi khóa bộ xong xem preview mới thấy chọn nhầm câu, cần
-- sửa NGAY chính bộ đó — không muốn đẻ ra bản mới. Vì vậy "Chỉnh sửa" = mở khóa
-- (locked_at -> null, status -> draft) để editor hiện lại, sửa xong khóa lại.
--
-- An toàn: CHỈ cho mở khóa khi CHƯA có học viên làm bài trên bản này (không có
-- exercise/exam attempt) — tránh đổi đề giữa chừng khi ai đó đang/đã làm.

-- (a) Trigger bất biến: cho phép DUY NHẤT thao tác mở khóa trên question_set_versions.
--     Mọi sửa nội dung khi đang khóa (kể cả sửa lúc vẫn khóa, và xóa) vẫn bị chặn;
--     bản đã giao vẫn được FK RESTRICT của deliveries bảo vệ khỏi bị xóa.
create or replace function app.prevent_locked_assessment_content_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'question_versions' then
    if exists (
      select 1
      from public.question_set_items i
      join public.question_set_versions sv on sv.id = i.set_version_id
      where i.question_version_id = old.id
        and sv.locked_at is not null
    ) then
      raise exception 'Phiên bản câu hỏi đã được khóa';
    end if;
  elsif tg_table_name in ('question_set_sections', 'question_set_items') then
    if exists (
      select 1
      from public.question_set_versions sv
      where sv.id = old.set_version_id
        and sv.locked_at is not null
    ) then
      raise exception 'Phiên bản bộ câu hỏi đã được khóa';
    end if;
  elsif tg_table_name = 'question_set_versions' and old.locked_at is not null then
    -- Ngoại lệ: cho phép mở khóa (UPDATE đưa locked_at về null). Các thao tác khác
    -- trên bản đang khóa (đổi nội dung khi vẫn khóa, DELETE) vẫn chặn.
    if not (tg_op = 'UPDATE' and new.locked_at is null) then
      raise exception 'Phiên bản bộ câu hỏi đã được khóa';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- (b) RPC mở khóa để chỉnh sửa.
create or replace function public.unlock_question_set_for_edit(p_question_set_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_ver uuid;
begin
  perform app.require_assessment_author();
  select current_version_id into v_ver from public.question_sets
    where id=p_question_set_id and (owner_id=auth.uid() or app.is_super_admin());
  if v_ver is null then raise exception 'Không tìm thấy bộ câu hỏi'; end if;
  if exists(select 1 from public.exercise_deliveries d
              join public.exercise_attempts a on a.delivery_id=d.id
              where d.set_version_id=v_ver)
     or exists(select 1 from public.exam_deliveries d
              join public.exam_attempts a on a.exam_delivery_id=d.id
              where d.set_version_id=v_ver) then
    raise exception 'Bộ đã có học viên làm bài — không thể sửa trực tiếp để tránh đổi đề giữa chừng. Hãy tạo bộ mới thay vì sửa.';
  end if;
  update public.question_set_versions set locked_at=null where id=v_ver;
  update public.question_sets set status='draft' where id=p_question_set_id;
end $$;

revoke all on function public.unlock_question_set_for_edit(uuid) from public,anon;
grant execute on function public.unlock_question_set_for_edit(uuid) to authenticated;

-- (c) Bỏ hướng cũ (clone bản mới) — không dùng nữa.
drop function if exists public.clone_question_set_for_edit(uuid);
