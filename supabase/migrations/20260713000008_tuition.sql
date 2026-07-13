-- =============================================================================
-- 08 — Học phí cơ bản
--
-- RANH GIỚI CỨNG: "Còn phải thu" = SỐ DƯ HÓA ĐƠN (total − đã thanh toán), tính ở
-- view `v_tuition_balance`. KHÔNG có bảng "công nợ" riêng.
--
-- Hệ cũ để khái niệm này mọc thành cả module vay/nợ/thu hồi nợ. Ở đây nó dừng
-- lại ở hóa đơn. Không thêm bảng loan/debt/repayment — đó là sản phẩm khác.
-- =============================================================================

create table public.tuition_invoices (
  id           uuid primary key default gen_random_uuid(),
  invoice_code text not null unique,

  student_id    uuid not null references public.students (id) on delete restrict,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  class_id      uuid references public.classes (id) on delete set null,

  issue_date date not null default current_date,
  due_date   date,

  subtotal numeric(14, 2) not null check (subtotal >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  total    numeric(14, 2) not null check (total >= 0),

  status public.invoice_status not null default 'draft',
  note   text,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_invoice_due_after_issue
    check (due_date is null or due_date >= issue_date)
);

create index ix_tuition_invoices_student on public.tuition_invoices (student_id);
create index ix_tuition_invoices_enrollment on public.tuition_invoices (enrollment_id);
create index ix_tuition_invoices_status on public.tuition_invoices (status);
create index ix_tuition_invoices_due_date on public.tuition_invoices (due_date);

create trigger trg_tuition_invoices_updated_at
  before update on public.tuition_invoices
  for each row execute function app.set_updated_at();

-- --- tuition_invoice_items ----------------------------------------------------

create table public.tuition_invoice_items (
  id         uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.tuition_invoices (id) on delete cascade,

  description text not null,
  quantity    numeric(10, 2) not null default 1 check (quantity > 0),
  unit_amount numeric(14, 2) not null check (unit_amount >= 0),
  line_total  numeric(14, 2) not null check (line_total >= 0),

  created_at timestamptz not null default now()
);

create index ix_tuition_invoice_items_invoice on public.tuition_invoice_items (invoice_id);

-- --- tuition_payments ---------------------------------------------------------

create table public.tuition_payments (
  id           uuid primary key default gen_random_uuid(),
  payment_code text not null unique,

  invoice_id uuid not null references public.tuition_invoices (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,

  amount  numeric(14, 2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  method  public.payment_method not null,

  reference text,
  note      text,

  -- ACTOR THẬT. Không phải "user đầu tiên".
  recorded_by uuid not null references auth.users (id) on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_tuition_payments_invoice on public.tuition_payments (invoice_id);
create index ix_tuition_payments_student on public.tuition_payments (student_id);
create index ix_tuition_payments_paid_at on public.tuition_payments (paid_at);

create trigger trg_tuition_payments_updated_at
  before update on public.tuition_payments
  for each row execute function app.set_updated_at();

-- Tổng thanh toán không được vượt số phải thu.
-- Muốn hoàn tiền/điều chỉnh → đi qua flow refund tường minh (đổi invoice.status),
-- không phải bằng cách ghi một payment âm hay ghi vượt rồi "trừ lại sau".
create or replace function app.enforce_payment_not_exceed_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total     numeric(14, 2);
  v_paid      numeric(14, 2);
  v_status    public.invoice_status;
begin
  select total, status into v_total, v_status
  from public.tuition_invoices
  where id = new.invoice_id
  for update;   -- khóa hàng: hai payment đồng thời không cùng lọt qua

  if v_status = 'refunded' then
    return new;   -- flow hoàn tiền có luật riêng
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.tuition_payments
  where invoice_id = new.invoice_id
    and id is distinct from new.id;

  if v_paid + new.amount > v_total then
    raise exception
      'Tổng thanh toán (%) vượt số phải thu của hóa đơn (%)',
      v_paid + new.amount, v_total;
  end if;

  return new;
end;
$$;

create trigger trg_payments_not_exceed_total
  before insert or update on public.tuition_payments
  for each row execute function app.enforce_payment_not_exceed_total();

-- --- tuition_receipts ---------------------------------------------------------

create table public.tuition_receipts (
  id           uuid primary key default gen_random_uuid(),
  receipt_code text not null unique,

  -- UNIQUE = chốt chặn cuối chống sinh phiếu thu TRÙNG.
  -- Hệ cũ từng thu-trùng vì chỉ kiểm ở app-level; app-level check luôn thua race.
  payment_id uuid not null unique references public.tuition_payments (id) on delete restrict,

  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users (id) on delete set null,

  snapshot    jsonb,   -- bản chụp để in lại y nguyên dù dữ liệu gốc đổi
  object_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_tuition_receipts_payment on public.tuition_receipts (payment_id);

create trigger trg_tuition_receipts_updated_at
  before update on public.tuition_receipts
  for each row execute function app.set_updated_at();
