-- Keep historical combined payroll unchanged until a manager classifies it.
alter table public.b2c_monthly_reports
  add column teacher_payroll_cost bigint check(teacher_payroll_cost >= 0),
  add column office_payroll_cost bigint check(office_payroll_cost >= 0),
  add constraint b2c_payroll_split_complete check(
    (teacher_payroll_cost is null and office_payroll_cost is null)
    or (teacher_payroll_cost is not null and office_payroll_cost is not null
      and payroll_cost = teacher_payroll_cost + office_payroll_cost)
  );

create or replace function public.save_b2c_monthly_report(
  p_year integer, p_month integer, p_revenue bigint,
  p_costs jsonb, p_metrics jsonb, p_notes text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_report_id uuid; v_metric jsonb; v_teacher bigint; v_office bigint; v_payroll bigint;
begin
  if not coalesce(app.is_manager(),false) then raise exception 'Bạn không có quyền cập nhật báo cáo B2C' using errcode='42501'; end if;
  if p_year is null or p_month is null or p_year not between 2000 and 2100 or p_month not between 1 and 12 then
    raise exception 'Kỳ báo cáo không hợp lệ' using errcode='22023';
  end if;
  if p_revenue is null or p_revenue < 0 or jsonb_typeof(p_costs) is distinct from 'object' or jsonb_typeof(p_metrics) is distinct from 'array' then
    raise exception 'Dữ liệu báo cáo không hợp lệ' using errcode='22023';
  end if;
  v_teacher := (p_costs->>'teacher_payroll')::bigint;
  v_office := (p_costs->>'office_payroll')::bigint;
  if (v_teacher is null) <> (v_office is null) then
    raise exception 'Phải nhập cả lương GV và lương NV văn phòng' using errcode='22023';
  end if;
  v_payroll := case when v_teacher is not null then v_teacher + v_office else coalesce((p_costs->>'payroll')::bigint,0) end;
  insert into public.b2c_monthly_reports as r (
    report_year,report_month,revenue,electricity_cost,water_cost,internet_cost,payroll_cost,
    teacher_payroll_cost,office_payroll_cost,rent_cost,marketing_cost,advertising_cost,other_cost,
    notes,created_by,updated_by
  ) values (
    p_year,p_month,p_revenue,coalesce((p_costs->>'electricity')::bigint,0),coalesce((p_costs->>'water')::bigint,0),
    coalesce((p_costs->>'internet')::bigint,0),v_payroll,v_teacher,v_office,
    coalesce((p_costs->>'rent')::bigint,0),coalesce((p_costs->>'marketing')::bigint,0),
    coalesce((p_costs->>'advertising')::bigint,0),coalesce((p_costs->>'other')::bigint,0),
    nullif(btrim(p_notes),''),auth.uid(),auth.uid()
  ) on conflict(report_year,report_month) do update set
    revenue=excluded.revenue,electricity_cost=excluded.electricity_cost,water_cost=excluded.water_cost,
    internet_cost=excluded.internet_cost,payroll_cost=excluded.payroll_cost,
    teacher_payroll_cost=case when v_teacher is null then r.teacher_payroll_cost else excluded.teacher_payroll_cost end,
    office_payroll_cost=case when v_office is null then r.office_payroll_cost else excluded.office_payroll_cost end,
    rent_cost=excluded.rent_cost,marketing_cost=excluded.marketing_cost,advertising_cost=excluded.advertising_cost,
    other_cost=excluded.other_cost,notes=excluded.notes,updated_by=auth.uid()
  returning r.id into v_report_id;
  delete from public.b2c_monthly_program_metrics where report_id=v_report_id;
  for v_metric in select value from jsonb_array_elements(p_metrics) loop
    insert into public.b2c_monthly_program_metrics(report_id,program_slug,opening_students,new_students,departed_students,lessons_taught,lessons_paid)
    values(v_report_id,v_metric->>'program_slug',coalesce((v_metric->>'opening_students')::integer,0),
      coalesce((v_metric->>'new_students')::integer,0),coalesce((v_metric->>'departed_students')::integer,0),
      coalesce((v_metric->>'lessons_taught')::integer,0),coalesce((v_metric->>'lessons_paid')::integer,0));
  end loop;
  return v_report_id;
end;
$$;
revoke all on function public.save_b2c_monthly_report(integer,integer,bigint,jsonb,jsonb,text) from public,anon;
grant execute on function public.save_b2c_monthly_report(integer,integer,bigint,jsonb,jsonb,text) to authenticated;
comment on column public.b2c_monthly_reports.payroll_cost is 'Total payroll; historical combined values preserved. New UI stores teacher + office exactly once.';
notify pgrst,'reload schema';
