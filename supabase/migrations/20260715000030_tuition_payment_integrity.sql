-- =============================================================================
-- 30 — Toàn vẹn thanh toán học phí
--
-- Payment chỉ hợp lệ sau khi invoice đã phát hành. Mỗi payment và receipt được
-- tạo trong cùng transaction; UNIQUE(receipts.payment_id) là chốt chặn 1-1.
-- =============================================================================

create or replace function public.record_tuition_payment(
  p_invoice_id uuid,
  p_amount     numeric,
  p_method     public.payment_method,
  p_paid_at    timestamptz default now(),
  p_reference  text default null,
  p_note       text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice    public.tuition_invoices%rowtype;
  v_payment_id uuid;
  v_receipt_id uuid;
  v_paid_total numeric(14, 2);
  v_new_status public.invoice_status;
  v_student_user uuid;
  v_seq        bigint;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ quản trị viên được ghi nhận thanh toán';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Số tiền thanh toán phải lớn hơn 0';
  end if;

  select * into v_invoice
  from public.tuition_invoices
  where id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'Không tìm thấy hóa đơn';
  end if;

  if v_invoice.status = 'draft' then
    raise exception 'Hóa đơn chưa phát hành — không thể ghi nhận thanh toán';
  end if;
  if v_invoice.status = 'paid' then
    raise exception 'Hóa đơn đã thanh toán đủ';
  end if;
  if v_invoice.status in ('cancelled', 'refunded') then
    raise exception 'Hóa đơn đã % — không ghi nhận thanh toán được', v_invoice.status;
  end if;
  if v_invoice.status not in ('issued', 'partial', 'overdue') then
    raise exception 'Trạng thái hóa đơn không cho phép thanh toán';
  end if;

  v_seq := nextval('public.tuition_payment_code_seq');

  insert into public.tuition_payments (
    payment_code, invoice_id, student_id, amount, paid_at, method,
    reference, note, recorded_by
  )
  values (
    format('TT%s-%s', to_char(p_paid_at, 'YYMM'), lpad(v_seq::text, 6, '0')),
    p_invoice_id, v_invoice.student_id, p_amount, p_paid_at, p_method,
    nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), auth.uid()
  )
  returning id into v_payment_id;

  select coalesce(sum(amount), 0) into v_paid_total
  from public.tuition_payments
  where invoice_id = p_invoice_id;

  v_new_status := case
    when v_paid_total >= v_invoice.total then 'paid'
    else 'partial'
  end;

  update public.tuition_invoices
  set status = v_new_status
  where id = p_invoice_id;

  insert into public.tuition_receipts (
    receipt_code, payment_id, issued_by, snapshot
  )
  values (
    format('PT%s-%s', to_char(p_paid_at, 'YYMM'), lpad(v_seq::text, 6, '0')),
    v_payment_id,
    auth.uid(),
    jsonb_build_object(
      'invoice_code', v_invoice.invoice_code,
      'amount', p_amount,
      'paid_at', p_paid_at,
      'method', p_method,
      'invoice_total', v_invoice.total,
      'paid_total', v_paid_total
    )
  )
  returning id into v_receipt_id;

  select user_id into v_student_user
  from public.students
  where id = v_invoice.student_id;

  if v_student_user is not null then
    insert into public.notifications (
      user_id, type, title, body, link, resource_type, resource_id, dedupe_key
    )
    values (
      v_student_user,
      'invoice_new',
      'Đã ghi nhận thanh toán',
      format('Đã ghi nhận thanh toán cho hóa đơn %s.', v_invoice.invoice_code),
      '/student/profile',
      'tuition_payment',
      v_payment_id,
      format('payment_recorded:%s', v_payment_id)
    )
    on conflict do nothing;
  end if;

  perform app.write_audit(
    'tuition.record_payment', 'tuition_invoice', p_invoice_id,
    jsonb_build_object('status', v_invoice.status),
    jsonb_build_object(
      'status', v_new_status,
      'amount', p_amount,
      'payment_id', v_payment_id,
      'receipt_id', v_receipt_id
    )
  );

  return v_payment_id;
end;
$$;

revoke all on function public.record_tuition_payment(
  uuid, numeric, public.payment_method, timestamptz, text, text
) from public, anon;
grant execute on function public.record_tuition_payment(
  uuid, numeric, public.payment_method, timestamptz, text, text
) to authenticated;

