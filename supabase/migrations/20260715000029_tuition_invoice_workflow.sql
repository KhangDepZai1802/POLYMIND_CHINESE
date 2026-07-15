-- =============================================================================
-- 29 — Luồng hóa đơn học phí
--
-- Một hóa đơn và các khoản mục phải được lưu trong cùng một transaction. Tổng
-- tiền do DB tính từ items; client không được tự khai subtotal/line_total/total.
-- Hóa đơn đã phát hành là lịch sử tài chính: không sửa hoặc hard-delete.
-- =============================================================================

create sequence if not exists public.tuition_invoice_code_seq;
revoke all on sequence public.tuition_invoice_code_seq from public, anon;

create or replace function public.save_tuition_invoice(
  p_student_id   uuid,
  p_issue_date   date,
  p_discount     numeric,
  p_items        jsonb,
  p_invoice_id   uuid default null,
  p_enrollment_id uuid default null,
  p_due_date     date default null,
  p_note         text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice       public.tuition_invoices%rowtype;
  v_invoice_id    uuid;
  v_class_id      uuid;
  v_enrollment_student_id uuid;
  v_subtotal      numeric(14, 2);
  v_total         numeric(14, 2);
  v_item_count    integer;
  v_seq           bigint;
  v_before        jsonb;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ quản trị viên được quản lý hóa đơn';
  end if;

  if p_student_id is null
     or not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'Không tìm thấy học viên';
  end if;

  if p_issue_date is null then
    raise exception 'Ngày lập hóa đơn là bắt buộc';
  end if;

  if p_due_date is not null and p_due_date < p_issue_date then
    raise exception 'Hạn thanh toán không được trước ngày lập hóa đơn';
  end if;

  if p_discount is null or p_discount < 0 then
    raise exception 'Giảm trừ không được âm';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Danh sách khoản mục không hợp lệ';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'Hóa đơn phải có từ 1 đến 50 khoản mục';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      description text,
      quantity numeric,
      unit_amount numeric
    )
    where nullif(btrim(item.description), '') is null
       or item.quantity is null or item.quantity <= 0
       or item.unit_amount is null or item.unit_amount < 0
  ) then
    raise exception 'Khoản mục phải có nội dung, số lượng dương và đơn giá không âm';
  end if;

  select coalesce(sum(round(item.quantity * item.unit_amount, 2)), 0)
  into v_subtotal
  from jsonb_to_recordset(p_items) as item(
    description text,
    quantity numeric,
    unit_amount numeric
  );

  if v_subtotal > 999999999999.99 then
    raise exception 'Tạm tính vượt giới hạn cho phép';
  end if;

  if p_discount > v_subtotal then
    raise exception 'Giảm trừ không được vượt tạm tính';
  end if;
  v_total := v_subtotal - p_discount;

  if p_enrollment_id is not null then
    select student_id, class_id
    into v_enrollment_student_id, v_class_id
    from public.enrollments
    where id = p_enrollment_id;

    if v_enrollment_student_id is null then
      raise exception 'Không tìm thấy ghi danh';
    end if;
    if v_enrollment_student_id <> p_student_id then
      raise exception 'Ghi danh không thuộc học viên đã chọn';
    end if;
  end if;

  if p_invoice_id is null then
    v_seq := nextval('public.tuition_invoice_code_seq');
    insert into public.tuition_invoices (
      invoice_code, student_id, enrollment_id, class_id,
      issue_date, due_date, subtotal, discount, total, status, note, created_by
    )
    values (
      format('HD%s-%s', to_char(p_issue_date, 'YYMM'), lpad(v_seq::text, 6, '0')),
      p_student_id, p_enrollment_id, v_class_id,
      p_issue_date, p_due_date, v_subtotal, p_discount, v_total,
      'draft', nullif(btrim(p_note), ''), auth.uid()
    )
    returning id into v_invoice_id;
  else
    select * into v_invoice
    from public.tuition_invoices
    where id = p_invoice_id
    for update;

    if v_invoice.id is null then
      raise exception 'Không tìm thấy hóa đơn';
    end if;
    if v_invoice.status <> 'draft' then
      raise exception 'Chỉ hóa đơn nháp mới được chỉnh sửa';
    end if;

    v_before := jsonb_build_object(
      'student_id', v_invoice.student_id,
      'enrollment_id', v_invoice.enrollment_id,
      'issue_date', v_invoice.issue_date,
      'due_date', v_invoice.due_date,
      'subtotal', v_invoice.subtotal,
      'discount', v_invoice.discount,
      'total', v_invoice.total
    );

    update public.tuition_invoices
    set student_id = p_student_id,
        enrollment_id = p_enrollment_id,
        class_id = v_class_id,
        issue_date = p_issue_date,
        due_date = p_due_date,
        subtotal = v_subtotal,
        discount = p_discount,
        total = v_total,
        note = nullif(btrim(p_note), '')
    where id = p_invoice_id;

    delete from public.tuition_invoice_items where invoice_id = p_invoice_id;
    v_invoice_id := p_invoice_id;
  end if;

  insert into public.tuition_invoice_items (
    invoice_id, description, quantity, unit_amount, line_total
  )
  select
    v_invoice_id,
    btrim(item.description),
    item.quantity,
    item.unit_amount,
    round(item.quantity * item.unit_amount, 2)
  from jsonb_to_recordset(p_items) as item(
    description text,
    quantity numeric,
    unit_amount numeric
  );

  perform app.write_audit(
    case when p_invoice_id is null then 'tuition.invoice.create'
         else 'tuition.invoice.update' end,
    'tuition_invoice',
    v_invoice_id,
    v_before,
    jsonb_build_object(
      'student_id', p_student_id,
      'enrollment_id', p_enrollment_id,
      'issue_date', p_issue_date,
      'due_date', p_due_date,
      'subtotal', v_subtotal,
      'discount', p_discount,
      'total', v_total,
      'item_count', v_item_count,
      'status', 'draft'
    )
  );

  return v_invoice_id;
end;
$$;

create or replace function public.issue_tuition_invoice(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.tuition_invoices%rowtype;
  v_student_user uuid;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ quản trị viên được phát hành hóa đơn';
  end if;

  select * into v_invoice
  from public.tuition_invoices
  where id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'Không tìm thấy hóa đơn';
  end if;

  if v_invoice.status = 'draft' then
    if not exists (
      select 1 from public.tuition_invoice_items where invoice_id = p_invoice_id
    ) then
      raise exception 'Hóa đơn chưa có khoản mục';
    end if;

    update public.tuition_invoices
    set status = 'issued'
    where id = p_invoice_id;

    select user_id into v_student_user
    from public.students
    where id = v_invoice.student_id;

    if v_student_user is not null then
      insert into public.notifications (
        user_id, type, title, body, link,
        resource_type, resource_id, dedupe_key
      )
      values (
        v_student_user,
        'invoice_new',
        'Hóa đơn học phí mới',
        format('Hóa đơn %s đã được phát hành.', v_invoice.invoice_code),
        '/student',
        'tuition_invoice',
        p_invoice_id,
        format('invoice_new:%s', p_invoice_id)
      )
      on conflict do nothing;
    end if;

    perform app.write_audit(
      'tuition.invoice.issue', 'tuition_invoice', p_invoice_id,
      jsonb_build_object('status', 'draft'),
      jsonb_build_object('status', 'issued', 'total', v_invoice.total)
    );
  elsif v_invoice.status not in ('issued', 'partial', 'paid', 'overdue') then
    raise exception 'Không thể phát hành hóa đơn ở trạng thái %', v_invoice.status;
  end if;

  return jsonb_build_object(
    'invoice_id', p_invoice_id,
    'status', case when v_invoice.status = 'draft' then 'issued' else v_invoice.status end
  );
end;
$$;

create or replace function public.delete_tuition_invoice_draft(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.tuition_invoices%rowtype;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ quản trị viên được xóa hóa đơn nháp';
  end if;

  select * into v_invoice
  from public.tuition_invoices
  where id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'Không tìm thấy hóa đơn';
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'Chỉ hóa đơn nháp mới được xóa';
  end if;

  delete from public.tuition_invoices where id = p_invoice_id;

  perform app.write_audit(
    'tuition.invoice.delete_draft', 'tuition_invoice', p_invoice_id,
    jsonb_build_object(
      'invoice_code', v_invoice.invoice_code,
      'student_id', v_invoice.student_id,
      'total', v_invoice.total,
      'status', v_invoice.status
    ),
    null
  );
end;
$$;

-- Một hành động = một đường ghi. Đọc vẫn qua Table API + RLS; mọi mutation học
-- phí đi qua RPC đã kiểm quyền và chạy transaction.
revoke insert, update, delete on public.tuition_invoices from authenticated;
revoke insert, update, delete on public.tuition_invoice_items from authenticated;
revoke insert, update, delete on public.tuition_payments from authenticated;
revoke insert, update, delete on public.tuition_receipts from authenticated;

-- Draft là dữ liệu nội bộ. "Phát hành" phải là ranh giới DB, không chỉ là nút
-- ẩn trên UI; học viên gọi Table API trực tiếp cũng không thấy draft/items.
drop policy if exists "học viên đọc hóa đơn của mình" on public.tuition_invoices;
create policy "học viên đọc hóa đơn đã phát hành của mình"
  on public.tuition_invoices
  for select to authenticated
  using (student_id = app.my_student_id() and status <> 'draft');

drop policy if exists "học viên đọc khoản mục hóa đơn của mình"
  on public.tuition_invoice_items;
create policy "học viên đọc khoản mục hóa đơn phát hành"
  on public.tuition_invoice_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.tuition_invoices invoice
      where invoice.id = invoice_id
        and invoice.student_id = app.my_student_id()
        and invoice.status <> 'draft'
    )
  );

revoke all on function public.save_tuition_invoice(uuid, date, numeric, jsonb, uuid, uuid, date, text) from public, anon;
revoke all on function public.issue_tuition_invoice(uuid) from public, anon;
revoke all on function public.delete_tuition_invoice_draft(uuid) from public, anon;

grant execute on function public.save_tuition_invoice(uuid, date, numeric, jsonb, uuid, uuid, date, text) to authenticated;
grant execute on function public.issue_tuition_invoice(uuid) to authenticated;
grant execute on function public.delete_tuition_invoice_draft(uuid) to authenticated;
