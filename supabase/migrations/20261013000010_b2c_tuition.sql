begin;
create table public.b2c_tuition_packages (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.b2c_enrollments(id) on delete restrict,
  sessions integer not null check(sessions between 1 and 100000),
  unit_price numeric(15,0) not null check(unit_price between 0 and 1000000000000),
  discount numeric(15,0) not null default 0 check(discount>=0),
  discount_reason text,
  total_due numeric(15,0) generated always as (sessions*unit_price-discount) stored,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(sessions*unit_price between 0 and 1000000000000 and discount<=sessions*unit_price),
  check(discount=0 or (discount_reason is not null and char_length(btrim(discount_reason)) between 1 and 1000))
);
create sequence public.b2c_receipt_code_seq;
create table public.b2c_tuition_receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('B2C-PT'||nextval('public.b2c_receipt_code_seq')::text),
  package_id uuid not null references public.b2c_tuition_packages(id) on delete restrict,
  request_id uuid not null unique,
  paid_date date not null,
  amount numeric(15,0) not null check(amount>0 and amount<=1000000000000),
  method text not null check(method in ('cash','bank_transfer')),
  collector_name text not null check(char_length(btrim(collector_name)) between 1 and 200),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index b2c_receipts_package_idx on public.b2c_tuition_receipts(package_id,created_at desc,id);
alter table public.b2c_tuition_packages enable row level security;
alter table public.b2c_tuition_receipts enable row level security;
create policy b2c_packages_read on public.b2c_tuition_packages for select to authenticated using(app.is_manager());
create policy b2c_packages_insert on public.b2c_tuition_packages for insert to authenticated with check(app.is_manager() and created_by=auth.uid());
create policy b2c_packages_update on public.b2c_tuition_packages for update to authenticated using(app.is_manager()) with check(app.is_manager());
create policy b2c_receipts_read on public.b2c_tuition_receipts for select to authenticated using(app.is_manager());
create policy b2c_receipts_insert on public.b2c_tuition_receipts for insert to authenticated with check(app.is_manager() and created_by=auth.uid());
revoke all on public.b2c_tuition_packages,public.b2c_tuition_receipts from public,anon,authenticated;
grant select,insert on public.b2c_tuition_packages,public.b2c_tuition_receipts to authenticated;
grant update(sessions,unit_price,discount,discount_reason) on public.b2c_tuition_packages to authenticated;
grant usage on sequence public.b2c_receipt_code_seq to authenticated;

create function public.check_b2c_receipt_balance() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_due numeric; v_paid numeric;
begin
  select total_due into v_due from public.b2c_tuition_packages where id=NEW.package_id for update;
  if not found then raise exception 'Không tìm thấy gói học phí' using errcode='P0002'; end if;
  select coalesce(sum(amount),0) into v_paid from public.b2c_tuition_receipts where package_id=NEW.package_id;
  if v_paid+NEW.amount>v_due then raise exception 'Số tiền thu vượt số còn phải thu' using errcode='22023'; end if;
  return NEW;
end;
$$;
create trigger b2c_receipt_balance before insert on public.b2c_tuition_receipts for each row execute function public.check_b2c_receipt_balance();
create function public.check_b2c_package_edit() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_paid numeric;
begin
  select coalesce(sum(amount),0) into v_paid from public.b2c_tuition_receipts where package_id=OLD.id;
  if NEW.sessions*NEW.unit_price-NEW.discount<v_paid then raise exception 'Tổng phải thu không được thấp hơn số đã thu' using errcode='22023'; end if;
  return NEW;
end;
$$;
create trigger b2c_package_edit before update on public.b2c_tuition_packages for each row execute function public.check_b2c_package_edit();
create trigger b2c_package_updated_at before update on public.b2c_tuition_packages for each row execute function app.set_updated_at();

create function public.save_b2c_tuition_package(p_enrollment_id uuid,p_sessions integer,p_unit_price numeric,p_discount numeric,p_discount_reason text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
  if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý học phí B2C' using errcode='42501'; end if;
  if p_unit_price is null or p_discount is null or p_unit_price<>trunc(p_unit_price) or p_discount<>trunc(p_discount) then raise exception 'Số tiền phải là VNĐ nguyên' using errcode='22023'; end if;
  insert into public.b2c_tuition_packages(enrollment_id,sessions,unit_price,discount,discount_reason)
  values(p_enrollment_id,p_sessions,p_unit_price,p_discount,nullif(btrim(p_discount_reason),''))
  on conflict(enrollment_id) do update set sessions=excluded.sessions,unit_price=excluded.unit_price,discount=excluded.discount,discount_reason=excluded.discount_reason
  returning id into v_id;
  return v_id;
end;
$$;
create function public.record_b2c_tuition_receipt(p_package_id uuid,p_request_id uuid,p_paid_date date,p_amount numeric,p_method text,p_collector_name text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_old public.b2c_tuition_receipts%rowtype;
begin
  if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý học phí B2C' using errcode='42501'; end if;
  if p_amount is null or p_amount<>trunc(p_amount) then raise exception 'Số tiền phải là VNĐ nguyên' using errcode='22023'; end if;
  perform 1 from public.b2c_tuition_packages where id=p_package_id for update;
  if not found then raise exception 'Không tìm thấy gói học phí' using errcode='P0002'; end if;
  select * into v_old from public.b2c_tuition_receipts where request_id=p_request_id;
  if found then
    if v_old.package_id is distinct from p_package_id or v_old.paid_date is distinct from p_paid_date
      or v_old.amount is distinct from p_amount or v_old.method is distinct from p_method
      or v_old.collector_name is distinct from btrim(p_collector_name) then
      raise exception 'Mã yêu cầu đã được dùng cho phiếu thu khác' using errcode='22023';
    end if;
    return v_old.id;
  end if;
  insert into public.b2c_tuition_receipts(package_id,request_id,paid_date,amount,method,collector_name)
  values(p_package_id,p_request_id,p_paid_date,p_amount,p_method,btrim(p_collector_name)) returning id into v_id;
  return v_id;
end;
$$;

create function public.get_b2c_tuition_page(p_query text default '',p_page integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb; v_pattern text;
begin
  if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý học phí B2C' using errcode='42501'; end if;
  if p_page is null or p_page<0 or p_page>1000000 or char_length(p_query)>200 then raise exception 'Bộ lọc không hợp lệ' using errcode='22023'; end if;
  v_pattern:='%'||replace(replace(replace(btrim(coalesce(p_query,'')),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
  with filtered as (
    select e.id as enrollment_id,s.code as student_code,s.full_name,c.name as class_name,
      p.id as package_id,p.sessions,p.unit_price,p.discount,p.discount_reason,p.total_due
    from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id join public.b2c_classes c on c.id=e.class_id
    left join public.b2c_tuition_packages p on p.enrollment_id=e.id
    where s.full_name ilike v_pattern or s.code ilike v_pattern or c.name ilike v_pattern
  ), paid as (select package_id,sum(amount) as amount from public.b2c_tuition_receipts group by package_id),
  page_rows as (
    select f.*,coalesce(paid.amount,0) as paid_amount,coalesce(f.total_due,0)-coalesce(paid.amount,0) as balance
    from (select * from filtered order by student_code,enrollment_id limit 50 offset p_page::bigint*50) f left join paid on paid.package_id=f.package_id
  )
  select jsonb_build_object('total',(select count(*) from filtered),
    'total_due',(select coalesce(sum(total_due),0) from filtered),
    'paid_amount',(select coalesce(sum(paid.amount),0) from filtered f join paid on paid.package_id=f.package_id),
    'rows',coalesce((select jsonb_agg(to_jsonb(r) order by student_code,enrollment_id) from page_rows r),'[]'::jsonb)) into v_result;
  return v_result;
end;
$$;
revoke all on function public.save_b2c_tuition_package(uuid,integer,numeric,numeric,text),public.record_b2c_tuition_receipt(uuid,uuid,date,numeric,text,text),public.get_b2c_tuition_page(text,integer) from public,anon;
grant execute on function public.save_b2c_tuition_package(uuid,integer,numeric,numeric,text),public.record_b2c_tuition_receipt(uuid,uuid,date,numeric,text,text),public.get_b2c_tuition_page(text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
