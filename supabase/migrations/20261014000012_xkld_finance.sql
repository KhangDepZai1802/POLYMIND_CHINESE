-- VND only. Executive + super admin write; staff sees candidate debt through a restricted RPC.
create function app.can_manage_xkld_finance() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(app.current_role() in ('super_admin','executive'),false);
$$;
revoke all on function app.can_manage_xkld_finance() from public,anon;
grant execute on function app.can_manage_xkld_finance() to authenticated;
create sequence public.xkld_finance_code_seq;
create table public.xkld_finance_installments (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 code text not null unique default ('DT-'||nextval('public.xkld_finance_code_seq')::text),
 candidate_id uuid not null references public.xkld_candidates(id) on delete restrict,
 kind text not null check(kind in ('candidate_fee','partner_fee','commission')),
 title text not null check(length(btrim(title)) between 1 and 200),
 counterparty text not null check(length(btrim(counterparty)) between 1 and 200),
 amount numeric not null check(amount>=0 and amount<=999999999999 and amount=trunc(amount)),
 due_date date not null check(due_date>=date '1900-01-01'),
 note text not null default '' check(length(note)<=2000),
 created_at timestamptz not null default clock_timestamp(), created_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default clock_timestamp(), updated_by uuid not null references public.profiles(id)
);
create table public.xkld_finance_transactions (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 code text not null unique default ('GD-'||nextval('public.xkld_finance_code_seq')::text),
 installment_id uuid not null references public.xkld_finance_installments(id) on delete restrict,
 kind text not null check(kind in ('receipt','refund','commission_payment')),
 receipt_id uuid references public.xkld_finance_transactions(id) on delete restrict,
 amount numeric not null check(amount>0 and amount<=999999999999 and amount=trunc(amount)),
 fee_reduction numeric not null default 0 check(fee_reduction>=0 and fee_reduction<=amount and fee_reduction=trunc(fee_reduction)),
 occurred_on date not null check(occurred_on>=date '1900-01-01'),
 method text not null check(method in ('cash','bank_transfer')),
 note text not null default '' check(length(note)<=2000),
 created_at timestamptz not null default clock_timestamp(),created_by uuid not null references public.profiles(id),actor_name text not null,
 void_request_id uuid unique,voided_at timestamptz,voided_by uuid references public.profiles(id),void_reason text,
 check((kind='refund' and receipt_id is not null) or (kind<>'refund' and receipt_id is null and fee_reduction=0))
);
create table public.xkld_finance_history (
 id uuid primary key default gen_random_uuid(),candidate_id uuid not null references public.xkld_candidates(id) on delete restrict,
 installment_id uuid not null references public.xkld_finance_installments(id) on delete restrict,
 action text not null, before_data jsonb,after_data jsonb,
 actor_id uuid not null references public.profiles(id),actor_name text not null,created_at timestamptz not null default clock_timestamp()
);
create index xkld_finance_candidate on public.xkld_finance_installments(candidate_id,kind,due_date,id);
create index xkld_finance_tx_installment on public.xkld_finance_transactions(installment_id,created_at desc,id);
create index xkld_finance_refunds on public.xkld_finance_transactions(receipt_id) where receipt_id is not null;
create index xkld_finance_history_candidate on public.xkld_finance_history(candidate_id,created_at desc,id);
alter table public.xkld_finance_installments enable row level security;
alter table public.xkld_finance_transactions enable row level security;
alter table public.xkld_finance_history enable row level security;
revoke all on public.xkld_finance_installments,public.xkld_finance_transactions,public.xkld_finance_history from anon,authenticated;
grant select on public.xkld_finance_installments,public.xkld_finance_transactions,public.xkld_finance_history to authenticated;
create policy xkld_finance_installments_read on public.xkld_finance_installments for select to authenticated using(app.can_manage_xkld_finance());
create policy xkld_finance_transactions_read on public.xkld_finance_transactions for select to authenticated using(app.can_manage_xkld_finance());
create policy xkld_finance_history_read on public.xkld_finance_history for select to authenticated using(app.can_manage_xkld_finance());
create view app.xkld_finance_balances as
 select i.*,coalesce(t.paid,0) as paid,coalesce(t.refunded,0) as refunded,
 coalesce(t.paid,0)-coalesce(t.refunded,0) as net_paid,
 i.amount-coalesce(t.paid,0)+coalesce(t.refunded,0) as balance
 from public.xkld_finance_installments i left join lateral (
 select sum(amount) filter(where kind in ('receipt','commission_payment')) as paid,
 sum(amount) filter(where kind='refund') as refunded from public.xkld_finance_transactions where installment_id=i.id and voided_at is null
 ) t on true;
revoke all on app.xkld_finance_balances from public,anon,authenticated;

create function public.read_xkld_finance(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_full boolean:=app.can_manage_xkld_finance();v_page integer:=coalesce((p_data->>'page')::int,0);
 v_kind text:=coalesce(nullif(p_data->>'kind',''),'candidate_fee');v_candidate uuid;v_result jsonb;
begin
 if not app.can_read_xkld_candidates() then raise exception 'Không có quyền xem công nợ.' using errcode='42501'; end if;
 if v_page<0 or v_page>1000000 or length(coalesce(p_data->>'q',''))>200 or v_kind not in ('candidate_fee','partner_fee','commission') then raise exception 'Bộ lọc không hợp lệ.'; end if;
 if not v_full then v_kind:='candidate_fee'; end if;
 if p_action='overview' then
  with candidates as (select id,code,full_name from public.xkld_candidates where strpos(lower(search_text),lower(coalesce(p_data->>'q','')))>0),
  balances as (select b.* from app.xkld_finance_balances b join candidates c on c.id=b.candidate_id where b.kind=v_kind),
  rows as (select c.id,c.code,c.full_name,coalesce(sum(b.amount),0) as amount,coalesce(sum(b.paid),0) as paid,coalesce(sum(b.refunded),0) as refunded,coalesce(sum(b.net_paid),0) as net_paid,coalesce(sum(b.balance),0) as balance,
   coalesce(sum(b.balance) filter(where b.due_date<(now() at time zone 'Asia/Ho_Chi_Minh')::date),0) as overdue
   from candidates c left join balances b on b.candidate_id=c.id group by c.id,c.code,c.full_name order by c.code,c.id limit 25 offset v_page*25)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r)) from rows r),'[]'::jsonb),'total',(select count(*) from candidates),
   'totals',jsonb_build_object('amount',coalesce((select sum(amount) from balances),0),'paid',coalesce((select sum(paid) from balances),0),'refunded',coalesce((select sum(refunded) from balances),0),'net_paid',coalesce((select sum(net_paid) from balances),0),'balance',coalesce((select sum(balance) from balances),0),
   'overdue',coalesce((select sum(balance) from balances where due_date<(now() at time zone 'Asia/Ho_Chi_Minh')::date),0))) into v_result;
  return v_result;
 elsif p_action='detail' then
  v_candidate:=(p_data->>'candidate_id')::uuid;
  if not exists(select 1 from public.xkld_candidates where id=v_candidate) then raise exception 'Không tìm thấy ứng viên.'; end if;
  with balances as (select * from app.xkld_finance_balances where candidate_id=v_candidate and kind=v_kind),
  rows as (select * from balances order by due_date,id limit 25 offset v_page*25)
  select jsonb_build_object('candidate',(select jsonb_build_object('id',id,'code',code,'full_name',full_name) from public.xkld_candidates where id=v_candidate),
   'rows',coalesce((select jsonb_agg(case when v_full then to_jsonb(r) else jsonb_build_object('id',r.id,'code',r.code,'title',r.title,'kind',r.kind,'amount',r.amount,'due_date',r.due_date,'paid',r.paid,'refunded',r.refunded,'net_paid',r.net_paid,'balance',r.balance) end) from rows r),'[]'::jsonb),
   'total',(select count(*) from balances),'totals',jsonb_build_object('amount',coalesce((select sum(amount) from balances),0),'paid',coalesce((select sum(paid) from balances),0),'refunded',coalesce((select sum(refunded) from balances),0),'net_paid',coalesce((select sum(net_paid) from balances),0),'balance',coalesce((select sum(balance) from balances),0),
   'overdue',coalesce((select sum(balance) from balances where due_date<(now() at time zone 'Asia/Ho_Chi_Minh')::date),0))) into v_result;
  return v_result;
 end if;
 if not v_full then raise exception 'Chỉ được xem công nợ ứng viên.' using errcode='42501'; end if;
 if p_action='transactions' then
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(t)) from (select * from public.xkld_finance_transactions where installment_id=(p_data->>'installment_id')::uuid order by created_at desc,id limit 20 offset v_page*20) t),'[]'::jsonb),
  'total',(select count(*) from public.xkld_finance_transactions where installment_id=(p_data->>'installment_id')::uuid));
 elsif p_action='history' then
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.xkld_finance_history where candidate_id=(p_data->>'candidate_id')::uuid order by created_at desc,id limit 20 offset v_page*20) h),'[]'::jsonb),
  'total',(select count(*) from public.xkld_finance_history where candidate_id=(p_data->>'candidate_id')::uuid));
 end if;
 raise exception 'Thao tác không hợp lệ.';
end $$;

create function public.write_xkld_finance(p_action text,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.xkld_finance_installments; old_i public.xkld_finance_installments;t public.xkld_finance_transactions; original public.xkld_finance_transactions;
 v_id uuid;v_request uuid;v_amount numeric;v_net numeric;v_reduction numeric:=0;v_name text;v_today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if not app.can_manage_xkld_finance() then raise exception 'Không có quyền sửa tài chính.' using errcode='42501'; end if;
 select full_name into v_name from public.profiles where id=auth.uid();
 v_request:=(p_data->>'request_id')::uuid;
 if v_request is null then raise exception 'Thiếu mã yêu cầu.'; end if;
 if p_action='save_installment' then
  v_amount:=(p_data->>'amount')::numeric;
  if nullif(p_data->>'id','') is null then
   -- Serialize create retries; payload mismatch must never silently reuse another obligation.
   perform pg_advisory_xact_lock(hashtextextended(v_request::text,0));
   select * into i from public.xkld_finance_installments where request_id=v_request;
   if i.id is not null then
    if i.created_by<>auth.uid() or i.candidate_id<>(p_data->>'candidate_id')::uuid or i.kind<>p_data->>'kind' or i.title<>btrim(p_data->>'title') or i.amount<>v_amount or i.counterparty<>btrim(p_data->>'counterparty') or i.due_date<>(p_data->>'due_date')::date or i.note<>coalesce(p_data->>'note','') then raise exception 'Mã yêu cầu đã được sử dụng.'; end if;
    return i.id;
   end if;
   if v_amount<=0 then raise exception 'Phí mới phải lớn hơn 0.'; end if;
   insert into public.xkld_finance_installments(request_id,candidate_id,kind,title,counterparty,amount,due_date,note,created_by,updated_by)
   values(v_request,(p_data->>'candidate_id')::uuid,p_data->>'kind',btrim(p_data->>'title'),btrim(p_data->>'counterparty'),v_amount,(p_data->>'due_date')::date,coalesce(p_data->>'note',''),auth.uid(),auth.uid()) returning * into i;
  else
   select * into i from public.xkld_finance_installments where id=(p_data->>'id')::uuid for update;
   if i.id is null then raise exception 'Không tìm thấy đợt phí.'; end if;
   old_i:=i;
   if i.updated_at is distinct from (p_data->>'expected_updated_at')::timestamptz then raise exception 'Đợt phí đã thay đổi. Tải lại trước khi sửa.'; end if;
   select net_paid into v_net from app.xkld_finance_balances where id=i.id;
   if v_amount<v_net then raise exception 'Phí không được nhỏ hơn số tiền thực thu/đã chi ròng. Hoàn hoặc hủy phiếu trước.'; end if;
   update public.xkld_finance_installments set title=btrim(p_data->>'title'),counterparty=btrim(p_data->>'counterparty'),amount=v_amount,due_date=(p_data->>'due_date')::date,note=coalesce(p_data->>'note',''),updated_at=clock_timestamp(),updated_by=auth.uid() where id=i.id returning * into i;
  end if;
  insert into public.xkld_finance_history(candidate_id,installment_id,action,before_data,after_data,actor_id,actor_name) values(i.candidate_id,i.id,case when old_i.id is null then 'create_installment' else 'edit_installment' end,case when old_i.id is null then null else to_jsonb(old_i) end,to_jsonb(i),auth.uid(),v_name);
  return i.id;
 elsif p_action='record_transaction' then
  select * into i from public.xkld_finance_installments where id=(p_data->>'installment_id')::uuid for update;
  if i.id is null then raise exception 'Không tìm thấy đợt phí.'; end if;
  select * into t from public.xkld_finance_transactions where request_id=v_request;
  v_amount:=(p_data->>'amount')::numeric;
  if p_data->>'kind'='refund' and coalesce((p_data->>'reduce_fee')::boolean,false) then v_reduction:=v_amount; end if;
  if t.id is not null then
   if t.created_by<>auth.uid() or t.installment_id<>i.id or t.kind<>p_data->>'kind' or t.amount<>v_amount or t.receipt_id is distinct from nullif(p_data->>'receipt_id','')::uuid or t.fee_reduction<>v_reduction or t.occurred_on<>(p_data->>'occurred_on')::date or t.method<>p_data->>'method' or t.note<>coalesce(p_data->>'note','') then raise exception 'Mã yêu cầu đã được sử dụng.'; end if;
   return t.id;
  end if;
  if v_amount is null or v_amount<=0 or v_amount<>trunc(v_amount) then raise exception 'Số tiền phải là số nguyên VNĐ lớn hơn 0.'; end if;
  if (p_data->>'occurred_on')::date>v_today then raise exception 'Ngày thu/chi không được ở tương lai.'; end if;
  select net_paid into v_net from app.xkld_finance_balances where id=i.id;
  if p_data->>'kind' in ('receipt','commission_payment') then
   if (i.kind='commission')<>(p_data->>'kind'='commission_payment') then raise exception 'Loại phiếu không khớp đợt phí.'; end if;
   if v_amount>i.amount-v_net then raise exception 'Số tiền vượt khoản còn phải thu/chi.'; end if;
  elsif p_data->>'kind'='refund' then
   if i.kind='commission' then raise exception 'Không hoàn phí từ khoản hoa hồng.'; end if;
   select * into original from public.xkld_finance_transactions where id=(p_data->>'receipt_id')::uuid and installment_id=i.id and kind='receipt' and voided_at is null;
   if original.id is null then raise exception 'Chọn phiếu thu hợp lệ của đợt phí này.'; end if;
   if (p_data->>'occurred_on')::date<original.occurred_on then raise exception 'Ngày hoàn không được trước ngày thu.'; end if;
   if v_amount>original.amount-coalesce((select sum(amount) from public.xkld_finance_transactions where receipt_id=original.id and voided_at is null),0) then raise exception 'Hoàn vượt số tiền còn lại của phiếu thu.'; end if;
   if length(btrim(coalesce(p_data->>'note','')))=0 then raise exception 'Nhập lý do hoàn phí.'; end if;
   old_i:=i;
   update public.xkld_finance_installments set amount=amount-v_reduction,updated_at=clock_timestamp(),updated_by=auth.uid() where id=i.id returning * into i;
  else raise exception 'Loại phiếu không hợp lệ.';
  end if;
  insert into public.xkld_finance_transactions(request_id,installment_id,kind,receipt_id,amount,fee_reduction,occurred_on,method,note,created_by,actor_name)
  values(v_request,i.id,p_data->>'kind',nullif(p_data->>'receipt_id','')::uuid,v_amount,v_reduction,(p_data->>'occurred_on')::date,p_data->>'method',coalesce(p_data->>'note',''),auth.uid(),v_name) returning * into t;
  -- Advance the version after every movement, even when the nominal fee is unchanged.
  update public.xkld_finance_installments set updated_at=clock_timestamp(),updated_by=auth.uid() where id=i.id;
  insert into public.xkld_finance_history(candidate_id,installment_id,action,before_data,after_data,actor_id,actor_name) values(i.candidate_id,i.id,'record_'||t.kind,case when old_i.id is null then null else to_jsonb(old_i) end,jsonb_build_object('transaction',to_jsonb(t),'fee_amount',i.amount),auth.uid(),v_name);
  return t.id;
 elsif p_action='void_transaction' then
  -- Lock parent first, same order as record/refund, to serialize the entire balance.
  select installment_id into v_id from public.xkld_finance_transactions where id=(p_data->>'id')::uuid;
  select * into i from public.xkld_finance_installments where id=v_id for update;
  select * into t from public.xkld_finance_transactions where id=(p_data->>'id')::uuid for update;
  if t.id is null then raise exception 'Không tìm thấy phiếu.'; end if;
  if t.voided_at is not null then
   if t.void_request_id=v_request and t.voided_by=auth.uid() and t.void_reason=btrim(p_data->>'reason') then return t.id; end if;
   raise exception 'Phiếu đã hủy.';
  end if;
  if length(btrim(coalesce(p_data->>'reason',''))) not between 1 and 2000 then raise exception 'Nhập lý do hủy phiếu.'; end if;
  if t.kind='receipt' and exists(select 1 from public.xkld_finance_transactions where receipt_id=t.id and voided_at is null) then raise exception 'Hủy các phiếu hoàn liên quan trước khi hủy phiếu thu.'; end if;
  if t.kind='refund' then
   select net_paid into v_net from app.xkld_finance_balances where id=i.id;
   if v_net+t.amount>i.amount+t.fee_reduction then raise exception 'Hủy hoàn sẽ làm thu vượt phí. Điều chỉnh phí hoặc phiếu thu trước.'; end if;
   update public.xkld_finance_installments set amount=amount+t.fee_reduction where id=i.id;
  end if;
  update public.xkld_finance_transactions set void_request_id=v_request,voided_at=clock_timestamp(),voided_by=auth.uid(),void_reason=btrim(p_data->>'reason') where id=t.id;
  update public.xkld_finance_installments set updated_at=clock_timestamp(),updated_by=auth.uid() where id=i.id;
  insert into public.xkld_finance_history(candidate_id,installment_id,action,before_data,after_data,actor_id,actor_name) values(i.candidate_id,i.id,'void_'||t.kind,to_jsonb(t),jsonb_build_object('reason',btrim(p_data->>'reason'),'transaction_id',t.id),auth.uid(),v_name);
  return t.id;
 end if;
 raise exception 'Thao tác không hợp lệ.';
end $$;
revoke all on function public.read_xkld_finance(text,jsonb),public.write_xkld_finance(text,jsonb) from public,anon;
grant execute on function public.read_xkld_finance(text,jsonb),public.write_xkld_finance(text,jsonb) to authenticated;
