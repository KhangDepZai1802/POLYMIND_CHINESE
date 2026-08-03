-- =============================================================================
-- 89 — Forward-fix cho `GIAOVU-1`: siết phạm vi ngân hàng câu hỏi + 7 thông báo
--      lỗi nói sai sự thật
--
-- Codex xác minh độc lập 2026-08-03 → `GIAOVU-RLS-001` và `GIAOVU-MIG-005`.
--
-- ⛔ KHÔNG sửa `…088` — nó đã áp lên production. Forward-fix, đúng như `…085`
--    đã làm với `…084`.
--
-- -----------------------------------------------------------------------------
-- PHẦN 1 — `GIAOVU-RLS-001`: ai được đọc/ghi ngân hàng câu hỏi
--
-- Codex báo: giáo vụ đọc được câu hỏi `global` và tự tạo `question_sets` qua
-- PostgREST. Đúng, và truy ra được HAI nguyên nhân khác hẳn nhau:
--
--   (a) LỖI DO `…087` GÂY RA. `…087` nới `app.my_teacher_id()` để nhận
--       `academic_manager` (bắt buộc, nếu không nhánh menu "Lớp được phân công"
--       hiện ra mà mọi trang bên trong đều rỗng). Nhưng `my_teacher_id()` còn
--       được dùng ở ba policy ngân hàng câu hỏi qua nhánh `shared_with_teacher_id`
--       ⇒ giáo vụ đọc ké được câu hỏi/bộ đề chia sẻ. Không ai cố ý mở.
--
--   (b) LỖI CÓ SẴN TỪ `…038`, KHÔNG PHẢI DO `GIAOVU-1`. Ba policy dưới đây
--       KHÔNG kiểm role một chữ nào:
--         questions_teacher_read      : ... or visibility = 'global' or ...
--         question_sets_teacher_write : owner_id = auth.uid()
--         question_sets_teacher_read  : owner_id = auth.uid() or ...
--       ⇒ **HỌC VIÊN cũng đọc được toàn bộ ngân hàng câu hỏi `global`, và tạo
--       được `question_sets` mang tên mình.** Lỗ này có từ trước role giáo vụ;
--       giáo vụ chỉ làm nó lộ ra. Vá luôn ở đây vì đang sửa đúng mấy dòng đó,
--       và biết mà để lại thì lần sau không ai đào ra nữa.
--
-- 🔴 PHẠM VI ĐÚNG của giáo vụ ở ngân hàng câu hỏi — không phải "cấm sạch":
--    Giáo vụ được phân công dạy lớp thì SOẠN bài như một giáo viên, nên có
--    quyền **cấp giáo viên**: câu hỏi của chính mình + câu hỏi `global` + câu
--    hỏi được chia sẻ. Cái họ KHÔNG có là quyền **cấp quản trị**: duyệt câu hỏi
--    vào ngân hàng chung (`/admin/question-bank-review`, RPC
--    `review_global_question`) và `admin_all_question*` — cả hai giữ nguyên
--    `is_super_admin()`, đúng điểm (3) user chốt.
--    Đây là lý do bên dưới dùng `in ('teacher','academic_manager')` chứ không
--    phải `= 'teacher'`.
--
-- -----------------------------------------------------------------------------
-- PHẦN 2 — `GIAOVU-MIG-005`: 7 câu thông báo lỗi nói sai
--
-- 7 RPC đã sang `is_manager()` ở `…088` nhưng thân vẫn ném "Chỉ quản trị viên…".
-- Từ hôm nay câu đó SAI: giáo vụ cũng làm được. `…088` mới sửa 4 câu khác cùng
-- loại; 7 câu này bị sót vì chúng nói "quản trị viên" chứ không "super admin"
-- nên không lọt bộ lọc lúc đó.
-- =============================================================================

-- --- PHẦN 1 ------------------------------------------------------------------

alter policy questions_teacher_read on public.questions
  using (
    app.current_role() in ('teacher', 'academic_manager')
    and (
      owner_id = auth.uid()
      or visibility = 'global'
      or exists (
        select 1 from public.question_shares qs
        where qs.question_id = questions.id
          and qs.shared_with_teacher_id = app.my_teacher_id()
      )
    )
  );

alter policy questions_teacher_insert on public.questions
  with check (
    app.current_role() in ('teacher', 'academic_manager')
    and owner_id = auth.uid()
    and created_by = auth.uid()
  );

alter policy questions_teacher_update on public.questions
  using (app.current_role() in ('teacher', 'academic_manager') and owner_id = auth.uid())
  with check (app.current_role() in ('teacher', 'academic_manager') and owner_id = auth.uid());

alter policy questions_teacher_delete on public.questions
  using (
    app.current_role() in ('teacher', 'academic_manager')
    and owner_id = auth.uid()
    and status = 'draft'
  );

alter policy question_sets_teacher_read on public.question_sets
  using (
    app.current_role() in ('teacher', 'academic_manager')
    and (
      owner_id = auth.uid()
      or exists (
        select 1 from public.question_set_shares s
        where s.question_set_id = question_sets.id
          and s.shared_with_teacher_id = app.my_teacher_id()
      )
    )
  );

alter policy question_sets_teacher_write on public.question_sets
  using (app.current_role() in ('teacher', 'academic_manager') and owner_id = auth.uid())
  with check (app.current_role() in ('teacher', 'academic_manager') and owner_id = auth.uid());

-- Bảng con (`question_versions`, `question_options`, `question_answer_keys`,
-- `question_set_versions/sections/items`) KHÔNG cần đụng: policy của chúng đều
-- là `exists (select 1 from public.questions | question_sets where ...)`, mà
-- subquery trong biểu thức policy VẪN chịu RLS của bảng được tham chiếu. Đóng
-- bảng cha là đóng luôn bảng con. Có bài pgTAP ghim tính chất này để lần sau
-- không ai phải đoán lại.

-- --- PHẦN 2 ------------------------------------------------------------------

do $$
declare
  r          record;
  v_new      text;
  v_count    integer := 0;
begin
  for r in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public')
      and p.prosrc like '%is_manager%'
      and p.prosrc like '%Chỉ quản trị viên được%'
  loop
    v_new := replace(r.def, 'Chỉ quản trị viên được', 'Chỉ quản trị viên hoặc giáo vụ được');
    execute v_new;
    v_count := v_count + 1;
  end loop;

  if v_count <> 7 then
    raise exception
      'GIAOVU-MIG-005: chờ đúng 7 hàm có thông báo "Chỉ quản trị viên được", gặp %. '
      'Danh sách đã đổi so với lúc soạn migration — dừng lại và đếm lại bằng tay.', v_count;
  end if;

  raise notice 'GIAOVU-MIG-005 OK: đã sửa % câu thông báo lỗi.', v_count;
end;
$$;

-- --- CỔNG FAIL-CLOSED --------------------------------------------------------

do $$
declare
  v_open text[];
  v_msg  integer;
begin
  -- Không policy nào của ngân hàng câu hỏi được để lọt người ngoài
  -- teacher/academic_manager/super_admin.
  select coalesce(array_agg(tablename || '.' || policyname order by 1), '{}')
    into v_open
  from pg_policies
  where tablename in ('questions', 'question_sets')
    and policyname not like 'admin_all%'
    and (coalesce(qual, '') || coalesce(with_check, '')) not like '%current_role%';

  if array_length(v_open, 1) > 0 then
    raise exception
      'GIAOVU-RLS-001: % policy ngân hàng câu hỏi không kiểm role: %. '
      'Thiếu vế role là học viên đọc được cả kho câu hỏi global.',
      array_length(v_open, 1), array_to_string(v_open, ', ');
  end if;

  select count(*) into v_msg
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public')
    and p.prosrc like '%is_manager%'
    and p.prosrc like '%Chỉ quản trị viên được%';

  if v_msg <> 0 then
    raise exception 'GIAOVU-MIG-005: còn % hàm ném thông báo sai.', v_msg;
  end if;

  raise notice 'GIAOVU-1 forward-fix OK: ngân hàng câu hỏi đã có vế role, thông báo lỗi đã đúng.';
end;
$$;
