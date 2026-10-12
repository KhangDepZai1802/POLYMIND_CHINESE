-- Báo cáo hoạt động tháng dành riêng cho B2C.
-- Không tham chiếu classes/students/enrollments của khối doanh nghiệp.

create table public.b2c_monthly_reports (
  id uuid primary key default gen_random_uuid(),
  report_year integer not null check (report_year between 2000 and 2100),
  report_month integer not null check (report_month between 1 and 12),
  revenue bigint not null default 0 check (revenue >= 0),
  electricity_cost bigint not null default 0 check (electricity_cost >= 0),
  water_cost bigint not null default 0 check (water_cost >= 0),
  internet_cost bigint not null default 0 check (internet_cost >= 0),
  payroll_cost bigint not null default 0 check (payroll_cost >= 0),
  rent_cost bigint not null default 0 check (rent_cost >= 0),
  marketing_cost bigint not null default 0 check (marketing_cost >= 0),
  advertising_cost bigint not null default 0 check (advertising_cost >= 0),
  other_cost bigint not null default 0 check (other_cost >= 0),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_b2c_monthly_reports_period unique (report_year, report_month)
);

create table public.b2c_monthly_program_metrics (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.b2c_monthly_reports (id) on delete cascade,
  program_slug text not null references public.b2c_programs (slug) on update cascade on delete restrict,
  opening_students integer not null default 0 check (opening_students >= 0),
  new_students integer not null default 0 check (new_students >= 0),
  departed_students integer not null default 0 check (departed_students >= 0),
  lessons_taught integer not null default 0 check (lessons_taught >= 0),
  lessons_paid integer not null default 0 check (lessons_paid >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_b2c_monthly_program_metrics unique (report_id, program_slug),
  constraint b2c_monthly_program_students_check
    check (opening_students + new_students >= departed_students)
);

create index ix_b2c_monthly_reports_period
  on public.b2c_monthly_reports (report_year desc, report_month desc);
create index ix_b2c_monthly_program_metrics_report
  on public.b2c_monthly_program_metrics (report_id);

create trigger trg_b2c_monthly_reports_updated_at
before update on public.b2c_monthly_reports
for each row execute function app.set_updated_at();

create trigger trg_b2c_monthly_program_metrics_updated_at
before update on public.b2c_monthly_program_metrics
for each row execute function app.set_updated_at();

alter table public.b2c_monthly_reports enable row level security;
alter table public.b2c_monthly_program_metrics enable row level security;

create policy b2c_monthly_reports_manager_all
on public.b2c_monthly_reports for all to authenticated
using (app.is_manager()) with check (app.is_manager());

create policy b2c_monthly_program_metrics_manager_all
on public.b2c_monthly_program_metrics for all to authenticated
using (app.is_manager()) with check (app.is_manager());

grant select, insert, update on public.b2c_monthly_reports to authenticated;
grant select, insert, update, delete on public.b2c_monthly_program_metrics to authenticated;
revoke all on public.b2c_monthly_reports, public.b2c_monthly_program_metrics from anon;

create or replace function public.save_b2c_monthly_report(
  p_year integer,
  p_month integer,
  p_revenue bigint,
  p_costs jsonb,
  p_metrics jsonb,
  p_notes text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_report_id uuid;
  v_metric jsonb;
begin
  if not app.is_manager() then
    raise exception 'Bạn không có quyền cập nhật báo cáo B2C';
  end if;
  if p_year not between 2000 and 2100 or p_month not between 1 and 12 then
    raise exception 'Kỳ báo cáo không hợp lệ';
  end if;
  if p_revenue < 0 or jsonb_typeof(p_costs) <> 'object' or jsonb_typeof(p_metrics) <> 'array' then
    raise exception 'Dữ liệu báo cáo không hợp lệ';
  end if;

  insert into public.b2c_monthly_reports as r (
    report_year, report_month, revenue,
    electricity_cost, water_cost, internet_cost, payroll_cost,
    rent_cost, marketing_cost, advertising_cost, other_cost,
    notes, created_by, updated_by
  ) values (
    p_year, p_month, p_revenue,
    coalesce((p_costs->>'electricity')::bigint, 0),
    coalesce((p_costs->>'water')::bigint, 0),
    coalesce((p_costs->>'internet')::bigint, 0),
    coalesce((p_costs->>'payroll')::bigint, 0),
    coalesce((p_costs->>'rent')::bigint, 0),
    coalesce((p_costs->>'marketing')::bigint, 0),
    coalesce((p_costs->>'advertising')::bigint, 0),
    coalesce((p_costs->>'other')::bigint, 0),
    nullif(btrim(p_notes), ''), auth.uid(), auth.uid()
  )
  on conflict (report_year, report_month) do update set
    revenue = excluded.revenue,
    electricity_cost = excluded.electricity_cost,
    water_cost = excluded.water_cost,
    internet_cost = excluded.internet_cost,
    payroll_cost = excluded.payroll_cost,
    rent_cost = excluded.rent_cost,
    marketing_cost = excluded.marketing_cost,
    advertising_cost = excluded.advertising_cost,
    other_cost = excluded.other_cost,
    notes = excluded.notes,
    updated_by = auth.uid()
  returning r.id into v_report_id;

  delete from public.b2c_monthly_program_metrics where report_id = v_report_id;

  for v_metric in select value from jsonb_array_elements(p_metrics)
  loop
    insert into public.b2c_monthly_program_metrics (
      report_id, program_slug, opening_students, new_students,
      departed_students, lessons_taught, lessons_paid
    ) values (
      v_report_id,
      v_metric->>'program_slug',
      coalesce((v_metric->>'opening_students')::integer, 0),
      coalesce((v_metric->>'new_students')::integer, 0),
      coalesce((v_metric->>'departed_students')::integer, 0),
      coalesce((v_metric->>'lessons_taught')::integer, 0),
      coalesce((v_metric->>'lessons_paid')::integer, 0)
    );
  end loop;

  return v_report_id;
end;
$$;

grant execute on function public.save_b2c_monthly_report(integer, integer, bigint, jsonb, jsonb, text)
to authenticated;
revoke all on function public.save_b2c_monthly_report(integer, integer, bigint, jsonb, jsonb, text)
from anon;

comment on table public.b2c_monthly_reports is
  'Số liệu tài chính theo tháng của module B2C, tách biệt hoàn toàn với doanh nghiệp.';
comment on table public.b2c_monthly_program_metrics is
  'Số học viên và số tiết theo chương trình B2C trong từng tháng.';
