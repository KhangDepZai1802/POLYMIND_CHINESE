-- Permanently remove only unused, ordinary teacher accounts. Auth deletion is
-- completed by the trusted server action after this transactional DB cleanup.
create or replace function public.delete_unused_b2c_teacher_account(p_teacher_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_teacher public.teachers;
  v_b2c_teacher_id uuid;
  v_user_id uuid;
begin
  if not coalesce(public.can_create_b2c_teacher_accounts(), false) then
    raise exception 'Không có quyền xóa tài khoản giáo viên.' using errcode = '42501';
  end if;

  select * into v_teacher from public.teachers where id = p_teacher_id for update;
  if not found then raise exception 'Không tìm thấy giáo viên.' using errcode = '22023'; end if;

  v_user_id := v_teacher.user_id;
  if v_user_id = auth.uid() then
    raise exception 'Không thể tự xóa tài khoản đang đăng nhập.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_user_id and role = 'teacher') then
    raise exception 'Chỉ được xóa tài khoản có vai trò Giáo viên.' using errcode = '42501';
  end if;

  select id into v_b2c_teacher_id
  from public.b2c_teachers where source_teacher_id = p_teacher_id for update;
  if v_b2c_teacher_id is null then
    raise exception 'Tài khoản chưa liên kết hồ sơ giáo viên B2C.' using errcode = '22023';
  end if;

  if exists (select 1 from public.b2c_teacher_account_creators where teacher_id = v_b2c_teacher_id)
  or exists (select 1 from public.b2c_full_access_teachers where teacher_id = v_b2c_teacher_id)
  or exists (select 1 from public.b2c_student_name_editors where teacher_id = v_b2c_teacher_id) then
    raise exception 'Không thể xóa tài khoản giáo viên đặc quyền.' using errcode = '42501';
  end if;

  if exists (select 1 from public.class_teachers where teacher_id = p_teacher_id)
  or exists (select 1 from public.b2c_classes where teacher_id = v_b2c_teacher_id)
  or exists (select 1 from public.b2c_teaching_sessions where teacher_id = v_b2c_teacher_id)
  or exists (select 1 from public.b2c_teacher_permission_history where teacher_id = v_b2c_teacher_id) then
    raise exception 'Giáo viên đã có lớp hoặc lịch sử giảng dạy. Hãy khóa tài khoản thay vì xóa.' using errcode = '23503';
  end if;

  delete from public.b2c_teacher_permissions where teacher_id = v_b2c_teacher_id;
  delete from public.b2c_teachers where id = v_b2c_teacher_id;
  delete from public.teachers where id = p_teacher_id;
  return v_user_id;
end
$$;

revoke all on function public.delete_unused_b2c_teacher_account(uuid) from public, anon;
grant execute on function public.delete_unused_b2c_teacher_account(uuid) to authenticated;
notify pgrst, 'reload schema';
