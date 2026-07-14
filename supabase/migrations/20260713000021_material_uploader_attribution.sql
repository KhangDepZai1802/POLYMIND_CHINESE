-- =============================================================================
-- 21 — Attribution tài liệu: `uploaded_by` LUÔN là actor thật
--
-- Trước migration này, `course_materials.uploaded_by` trông chờ vào việc tầng app
-- nhớ gán đúng. Server action của ta có gán — nhưng RLS cho phép super admin và
-- giáo viên INSERT thẳng qua PostgREST bằng JWT của họ. Đường đó không đi qua
-- server action, nên client tự khai `uploaded_by` là ai cũng được, hoặc bỏ trống
-- (đã kiểm chứng: insert thẳng qua PostgREST → `uploaded_by` = NULL).
--
-- Đây đúng lớp bug đã tốn nhiều phiên QA ở hệ XKLĐ cũ (BUG_M06_01, BUG_M12_01:
-- `CreatedBy` = "user đầu tiên trong DB" thay vì actor thật). Bài học đã ghi ở
-- CLAUDE.md: attribution phải cưỡng chế ở DB, không phải bằng kỷ luật của app.
--
-- Chốt ở đây: client khai gì cũng bị ghi đè bằng `auth.uid()`, và `uploaded_by`
-- là BẤT BIẾN sau khi tạo — không ai sửa lại lịch sử "ai đã tải file này lên".
--
-- Seed chạy bằng role `postgres` (auth.uid() = NULL) và KHÔNG chèn course_materials
-- nên trigger này không ảnh hưởng seed.
-- =============================================================================

create or replace function app.force_material_uploader()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.uploaded_by := auth.uid();
  else
    -- UPDATE: giữ nguyên người tải lên ban đầu, bất kể client gửi gì.
    new.uploaded_by := old.uploaded_by;
  end if;

  return new;
end;
$$;

create trigger trg_course_materials_uploader
  before insert or update on public.course_materials
  for each row execute function app.force_material_uploader();

revoke all on function app.force_material_uploader() from public, anon, authenticated;
