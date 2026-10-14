create sequence public.xkld_order_code_seq;
create function app.next_xkld_order_code() returns text language plpgsql set search_path='' as $$
declare n text := nextval('public.xkld_order_code_seq')::text;
begin return 'DH-' || repeat('0',greatest(0,6-length(n))) || n; end;
$$;
revoke all on function app.next_xkld_order_code() from public, anon;
grant execute on function app.next_xkld_order_code() to authenticated;
grant usage on sequence public.xkld_order_code_seq to authenticated;

create table public.xkld_markets (
  id uuid primary key default gen_random_uuid(),
  create_request_id uuid not null unique,
  country_code text not null unique check (country_code ~ '^[A-Z]{2}$'),
  country_name text not null check (length(btrim(country_name)) between 1 and 100),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  created_by uuid,
  updated_by uuid
);
create unique index xkld_markets_country_name on public.xkld_markets(lower(btrim(country_name)));

create table public.xkld_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default app.next_xkld_order_code(),
  create_request_id uuid not null unique,
  market_id uuid not null references public.xkld_markets(id) on delete restrict,
  employer text not null check(length(btrim(employer)) between 1 and 300),
  industry text not null check(length(btrim(industry)) between 1 and 200),
  recruitment_quantity integer not null check(recruitment_quantity between 1 and 1000000),
  salary_amount numeric not null check(salary_amount > 0 and salary_amount <= 999999999999.99 and salary_amount = trunc(salary_amount,2)),
  salary_currency text not null check(salary_currency ~ '^[A-Z]{3}$'),
  salary_period text not null check(salary_period in ('hour','day','month','year')),
  conditions text not null check(length(btrim(conditions)) between 1 and 5000),
  recruitment_deadline date not null check(recruitment_deadline between date '1900-01-01' and date '9999-12-31'),
  partner text not null check(length(btrim(partner)) between 1 and 300),
  status text not null default 'open' check(status in ('open','paused','closed')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  created_by uuid,
  updated_by uuid,
  search_text text generated always as (code || ' ' || employer || ' ' || industry || ' ' || partner || ' ' || conditions) stored
);
alter table public.xkld_markets enable row level security;
alter table public.xkld_orders enable row level security;

create policy xkld_markets_read on public.xkld_markets for select to authenticated using(app.can_read_xkld_candidates());
create policy xkld_markets_insert on public.xkld_markets for insert to authenticated with check(app.can_edit_xkld_candidates() and created_by=auth.uid());
create policy xkld_markets_update on public.xkld_markets for update to authenticated using(app.can_edit_xkld_candidates()) with check(app.can_edit_xkld_candidates());
create policy xkld_orders_read on public.xkld_orders for select to authenticated using(app.can_read_xkld_candidates());
create policy xkld_orders_insert on public.xkld_orders for insert to authenticated with check(app.can_edit_xkld_candidates() and created_by=auth.uid());
create policy xkld_orders_update on public.xkld_orders for update to authenticated using(app.can_edit_xkld_candidates()) with check(app.can_edit_xkld_candidates());
revoke all on public.xkld_markets, public.xkld_orders from public, anon, authenticated;
grant select on public.xkld_markets, public.xkld_orders to authenticated;
grant insert(create_request_id,country_code,country_name,currency_code,is_active), update(country_code,country_name,currency_code,is_active) on public.xkld_markets to authenticated;
grant insert(create_request_id,market_id,employer,industry,recruitment_quantity,salary_amount,salary_currency,salary_period,conditions,recruitment_deadline,partner,status), update(market_id,employer,industry,recruitment_quantity,salary_amount,salary_currency,salary_period,conditions,recruitment_deadline,partner,status) on public.xkld_orders to authenticated;

create function app.prepare_xkld_market_order() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='xkld_orders' then
    if tg_op='INSERT' or new.market_id is distinct from old.market_id then
      if not exists(select 1 from public.xkld_markets m where m.id=new.market_id and m.is_active) then
        raise exception 'Thị trường không tồn tại hoặc đã ngừng sử dụng' using errcode='23514';
      end if;
    end if;
    if tg_op='UPDATE' then new.code := old.code; end if;
  end if;
  if tg_op='INSERT' then
    new.created_by := auth.uid(); new.created_at := clock_timestamp();
  else
    new.id := old.id; new.create_request_id := old.create_request_id;
    new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid(); new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function app.prepare_xkld_market_order() from public, anon, authenticated;
create trigger prepare_xkld_market before insert or update on public.xkld_markets for each row execute function app.prepare_xkld_market_order();
create trigger prepare_xkld_order before insert or update on public.xkld_orders for each row execute function app.prepare_xkld_market_order();
create index xkld_orders_created on public.xkld_orders(created_at desc,id desc);
create index xkld_orders_market on public.xkld_orders(market_id,created_at desc,id desc);
create index xkld_orders_deadline on public.xkld_orders(status,recruitment_deadline,created_at desc,id desc);

-- Reference countries only, not employers, salaries or recruitment orders.
insert into public.xkld_markets(create_request_id,country_code,country_name,currency_code) values
('70000000-0000-4000-8000-000000000001','SG','Singapore','SGD'),
('70000000-0000-4000-8000-000000000002','JP','Nhật Bản','JPY'),
('70000000-0000-4000-8000-000000000003','TW','Đài Loan','TWD');
notify pgrst, 'reload schema';
