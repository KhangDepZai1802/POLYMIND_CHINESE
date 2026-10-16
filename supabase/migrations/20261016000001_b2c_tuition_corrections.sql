-- Original receipt amounts remain immutable. Only guarded manager RPCs change settlement.
alter table public.b2c_tuition_receipts
 add column refunded_amount numeric(15,0) not null default 0 check(refunded_amount between 0 and amount),
 add column cancelled_at timestamptz,
 add column correction_reason text,
 add column effective_amount numeric(15,0) generated always as (case when cancelled_at is not null then 0 else amount-refunded_amount end) stored;
alter table public.b2c_tuition_packages add column adjustment_reason text;
-- Column grants prevent callers from forging settlement metadata on a direct INSERT.
revoke insert on public.b2c_tuition_receipts from authenticated;
grant insert(package_id,request_id,paid_date,amount,method,collector_name) on public.b2c_tuition_receipts to authenticated;
revoke update(sessions,unit_price,discount,discount_reason) on public.b2c_tuition_packages from authenticated;

create function app.require_b2c_adjustment_reason() returns trigger language plpgsql set search_path='' as $$
declare v_reason text:=nullif(btrim(current_setting('app.b2c_adjustment_reason',true)),'');
begin
 if row(NEW.sessions,NEW.unit_price,NEW.discount,NEW.discount_reason) is distinct from row(OLD.sessions,OLD.unit_price,OLD.discount,OLD.discount_reason) then
  if v_reason is null or char_length(v_reason)>1000 then raise exception 'Vui lòng nhập lý do điều chỉnh học phí' using errcode='22023'; end if;
  NEW.adjustment_reason:=v_reason;
 end if;
 return NEW;
end $$;
revoke all on function app.require_b2c_adjustment_reason() from public,anon,authenticated;
create trigger b2c_package_adjustment_reason before update on public.b2c_tuition_packages for each row execute function app.require_b2c_adjustment_reason();

create function public.save_b2c_tuition_package_with_reason(p_enrollment_id uuid,p_sessions integer,p_unit_price numeric,p_discount numeric,p_discount_reason text,p_reason text,p_expected_due numeric,p_expected_paid numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_package public.b2c_tuition_packages%rowtype; v_paid numeric; v_id uuid; v_context text:=current_setting('app.b2c_adjustment_reason',true);
begin
 if not coalesce(app.has_b2c_permission('edit_tuition',(select class_id from public.b2c_enrollments where id=p_enrollment_id)),false) then raise exception 'Không có quyền quản lý học phí B2C' using errcode='42501'; end if;
 -- Serialize first creation as well as concurrent edits/receipts on the existing package.
 perform 1 from public.b2c_enrollments where id=p_enrollment_id for update;
 select * into v_package from public.b2c_tuition_packages where enrollment_id=p_enrollment_id for update;
 if found then
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Vui lòng nhập lý do điều chỉnh học phí' using errcode='22023'; end if;
  select coalesce(sum(effective_amount),0) into v_paid from public.b2c_tuition_receipts where package_id=v_package.id;
  if v_package.total_due is distinct from p_expected_due or v_paid is distinct from p_expected_paid then raise exception 'Số dư đã thay đổi. Vui lòng tải lại.' using errcode='40001'; end if;
 elsif p_expected_due is not null then raise exception 'Gói học phí đã thay đổi. Vui lòng tải lại.' using errcode='40001';
 end if;
 perform set_config('app.b2c_adjustment_reason',coalesce(btrim(p_reason),''),true);
 v_id:=public.save_b2c_tuition_package(p_enrollment_id,p_sessions,p_unit_price,p_discount,p_discount_reason);
 perform set_config('app.b2c_adjustment_reason',coalesce(v_context,''),true);
 return v_id;
end $$;
revoke all on function public.save_b2c_tuition_package_with_reason(uuid,integer,numeric,numeric,text,text,numeric,numeric) from public,anon;
grant execute on function public.save_b2c_tuition_package_with_reason(uuid,integer,numeric,numeric,text,text,numeric,numeric) to authenticated;

create table public.b2c_tuition_corrections (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 package_id uuid not null references public.b2c_tuition_packages(id) on delete restrict,
 receipt_id uuid references public.b2c_tuition_receipts(id) on delete restrict,
 kind text not null check(kind in ('cancel','refund','adjust')),
 amount numeric(15,0) not null check(amount between 0 and 1000000000000),
 reason text not null check(char_length(btrim(reason)) between 1 and 1000),
 effective_date date not null,
 method text not null check(method in ('cash','bank_transfer')),
 reduce_fee boolean not null,
 payload jsonb not null,
 before_data jsonb not null,
 after_data jsonb not null,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.b2c_tuition_corrections enable row level security;
create policy b2c_corrections_read on public.b2c_tuition_corrections for select to authenticated using(app.is_manager());
revoke all on public.b2c_tuition_corrections from public,anon,authenticated;
grant select on public.b2c_tuition_corrections to authenticated;
create index b2c_corrections_package_idx on public.b2c_tuition_corrections(package_id,created_at desc,id);

-- Explicit list of current readers/guards: preserve their signatures and all existing permissions.
do $$
declare f record; definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','app') and p.proname in
 ('check_b2c_receipt_balance','check_b2c_package_edit','get_b2c_tuition_page','read_b2c_class_workspace','read_teacher_b2c_workspace')
 loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'sum(amount)','sum(effective_amount)');
  execute definition;
 end loop;
end $$;

-- Include correction metadata in existing super-admin audit without widening read permissions.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('app.capture_b2c_change()'::regprocedure);
 definition:=replace(definition,'''discount_reason'',''total_due'']','''discount_reason'',''total_due'',''adjustment_reason'']');
 definition:=replace(definition,'''method'',''collector_name'']','''method'',''collector_name'',''refunded_amount'',''cancelled_at'',''correction_reason'',''effective_amount'']');
 execute definition;
 definition:=pg_get_functiondef('public.read_b2c_permitted_receipts(uuid,integer)'::regprocedure);
 definition:=replace(definition,'select id,code,paid_date,amount,method,collector_name from','select id,code,paid_date,amount,method,collector_name,refunded_amount,cancelled_at,correction_reason,effective_amount from');
 execute definition;
end $$;

create function public.correct_b2c_tuition(p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_package public.b2c_tuition_packages%rowtype; v_receipt public.b2c_tuition_receipts%rowtype;
 v_old public.b2c_tuition_corrections%rowtype;
 v_request uuid:=(p_payload->>'request_id')::uuid;
 v_package_id uuid:=(p_payload->>'package_id')::uuid;
 v_receipt_id uuid:=(p_payload->>'receipt_id')::uuid;
 v_kind text:=p_payload->>'kind'; v_reason text:=btrim(p_payload->>'reason');
 v_amount numeric:=(p_payload->>'amount')::numeric;
 v_date date:=(p_payload->>'effective_date')::date;
 v_method text:=p_payload->>'method'; v_reduce boolean:=(p_payload->>'reduce_fee')::boolean;
 v_paid numeric; v_before jsonb; v_after jsonb; v_id uuid; v_context text:=current_setting('app.b2c_adjustment_reason',true);
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền điều chỉnh học phí B2C' using errcode='42501'; end if;
 if v_request is null or v_package_id is null or v_kind is null or v_kind not in ('cancel','refund','adjust')
  or v_reason is null or char_length(v_reason) not between 1 and 1000
  or v_amount is null or v_amount<>trunc(v_amount) or v_amount not between 0 and 1000000000000
  or v_date is null or v_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date
  or v_method is null or v_method not in ('cash','bank_transfer') or v_reduce is null
  or p_payload->>'expected_due' is null or p_payload->>'expected_paid' is null then
  raise exception 'Thông tin điều chỉnh không hợp lệ' using errcode='22023';
 end if;
 -- Same request across different packages cannot race past the unique-key retry check.
 perform pg_advisory_xact_lock(hashtextextended(v_request::text,0));
 select * into v_old from public.b2c_tuition_corrections where request_id=v_request;
 if found then
  if v_old.payload is distinct from p_payload then raise exception 'Mã yêu cầu đã dùng cho nội dung khác' using errcode='22023'; end if;
  return v_old.id;
 end if;
 select * into v_package from public.b2c_tuition_packages where id=v_package_id for update;
 if not found then raise exception 'Không tìm thấy gói học phí' using errcode='22023'; end if;
 select coalesce(sum(effective_amount),0) into v_paid from public.b2c_tuition_receipts where package_id=v_package_id;
 if v_package.total_due is distinct from (p_payload->>'expected_due')::numeric or v_paid is distinct from (p_payload->>'expected_paid')::numeric then
  raise exception 'Số dư đã thay đổi. Vui lòng đóng và mở lại để tải số mới.' using errcode='40001';
 end if;
 v_before:=jsonb_build_object('total_due',v_package.total_due,'paid_amount',v_paid);
 perform set_config('app.b2c_adjustment_reason',v_reason,true);
 if v_kind in ('cancel','refund') then
  select * into v_receipt from public.b2c_tuition_receipts where id=v_receipt_id and package_id=v_package_id for update;
  if not found or v_receipt.cancelled_at is not null then raise exception 'Phiếu không tồn tại hoặc đã hủy' using errcode='22023'; end if;
  if v_date<v_receipt.paid_date then raise exception 'Ngày xử lý không được trước ngày thu' using errcode='22023'; end if;
  if v_kind='cancel' then
   if v_receipt.refunded_amount>0 then raise exception 'Phiếu đã hoàn tiền không thể hủy; hãy hoàn phần còn lại nếu cần' using errcode='22023'; end if;
   if v_amount<>v_receipt.amount or v_reduce then raise exception 'Hủy phiếu phải giữ khoản phải thu và đúng số tiền gốc' using errcode='22023'; end if;
   update public.b2c_tuition_receipts set cancelled_at=clock_timestamp(),correction_reason=v_reason where id=v_receipt_id;
  else
   if v_amount<=0 or v_amount>v_receipt.effective_amount then raise exception 'Số hoàn vượt phần còn được hoàn của phiếu' using errcode='22023'; end if;
   if v_reduce and v_amount>v_package.total_due then raise exception 'Số giảm phí vượt tổng phải thu' using errcode='22023'; end if;
   update public.b2c_tuition_receipts set refunded_amount=refunded_amount+v_amount,correction_reason=v_reason where id=v_receipt_id;
   if v_reduce then
    update public.b2c_tuition_packages set discount=discount+v_amount,discount_reason=v_reason,adjustment_reason=v_reason where id=v_package_id;
   end if;
  end if;
 else
  if v_receipt_id is not null or v_reduce or v_amount<v_paid or v_amount>v_package.sessions*v_package.unit_price or v_amount=v_package.total_due then
   raise exception 'Phải thu mới phải khác hiện tại, không thấp hơn thu ròng và không vượt tạm tính' using errcode='22023';
  end if;
  update public.b2c_tuition_packages set discount=sessions*unit_price-v_amount,discount_reason=v_reason,adjustment_reason=v_reason where id=v_package_id;
 end if;
 select jsonb_build_object('total_due',total_due,'paid_amount',(select coalesce(sum(effective_amount),0) from public.b2c_tuition_receipts where package_id=v_package_id)) into v_after from public.b2c_tuition_packages where id=v_package_id;
 insert into public.b2c_tuition_corrections(request_id,package_id,receipt_id,kind,amount,reason,effective_date,method,reduce_fee,payload,before_data,after_data)
 values(v_request,v_package_id,v_receipt_id,v_kind,v_amount,v_reason,v_date,v_method,v_reduce,p_payload,v_before,v_after) returning id into v_id;
 perform set_config('app.b2c_adjustment_reason',coalesce(v_context,''),true);
 return v_id;
end $$;
revoke all on function public.correct_b2c_tuition(jsonb) from public,anon;
grant execute on function public.correct_b2c_tuition(jsonb) to authenticated;

create function public.read_b2c_tuition_corrections(p_package_id uuid,p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý học phí B2C' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 1000000 then raise exception 'Trang không hợp lệ' using errcode='22023'; end if;
 return jsonb_build_object('total',(select count(*) from public.b2c_tuition_corrections where package_id=p_package_id),
 'rows',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]') from
 (select c.id,c.kind,c.amount,c.reason,c.effective_date,c.method,c.reduce_fee,c.before_data,c.after_data,c.created_at,p.full_name as actor_name,r.code as receipt_code
 from public.b2c_tuition_corrections c left join public.profiles p on p.id=c.created_by left join public.b2c_tuition_receipts r on r.id=c.receipt_id
 where c.package_id=p_package_id order by c.created_at desc,c.id limit 20 offset p_page::bigint*20) r));
end $$;
revoke all on function public.read_b2c_tuition_corrections(uuid,integer) from public,anon;
grant execute on function public.read_b2c_tuition_corrections(uuid,integer) to authenticated;
notify pgrst,'reload schema';
