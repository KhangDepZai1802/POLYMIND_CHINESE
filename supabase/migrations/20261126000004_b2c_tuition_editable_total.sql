-- A manually agreed total is independent of the package's component prices.
-- NULL retains the original automatic calculation; zero is an explicit total.
-- Adding metadata and recomputing the unchanged expression preserves original
-- package IDs, receipts, audit records and created/updated timestamps.
alter table public.b2c_tuition_packages
  add column total_due_override numeric,
  add constraint b2c_tuition_total_override_valid check (
    total_due_override is null or (
      total_due_override = trunc(total_due_override)
      and total_due_override between 0 and 1000000000000
    )
  );
alter table public.b2c_tuition_packages alter column total_due
  set expression as (coalesce(total_due_override, sessions * unit_price - discount));

-- The column has no direct INSERT/UPDATE grant. Only guarded RPCs may set it.
create or replace function app.require_b2c_adjustment_reason() returns trigger
language plpgsql set search_path = '' as $$
declare v_reason text := nullif(btrim(current_setting('app.b2c_adjustment_reason', true)), '');
begin
  if row(new.sessions, new.unit_price, new.discount, new.discount_reason, new.total_due_override)
     is distinct from row(old.sessions, old.unit_price, old.discount, old.discount_reason, old.total_due_override) then
    if v_reason is null or char_length(v_reason) > 1000 then
      raise exception 'Vui lòng nhập lý do điều chỉnh học phí' using errcode = '22023';
    end if;
    new.adjustment_reason := v_reason;
  end if;
  return new;
end;
$$;

do $$
declare v_definition text; v_original text;
begin
  v_original := pg_get_functiondef('app.capture_b2c_change()'::regprocedure);
  v_definition := replace(v_original,
    '''discount_reason'',''total_due'',''adjustment_reason'',''period_no'',''is_current'']',
    '''discount_reason'',''total_due'',''total_due_override'',''adjustment_reason'',''period_no'',''is_current'']');
  if v_definition = v_original then raise exception 'Unexpected tuition audit definition'; end if;
  execute v_definition;
end;
$$;

create function app.validate_b2c_tuition_total(p_total_due numeric) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_total_due is not null and (p_total_due <> trunc(p_total_due)
      or p_total_due not between 0 and 1000000000000) then
    raise exception 'Tổng phải thu phải là VNĐ nguyên từ 0 đến 1.000.000.000.000' using errcode = '22023';
  end if;
end;
$$;
revoke all on function app.validate_b2c_tuition_total(numeric) from public, anon, authenticated;

create function public.save_b2c_tuition_period_amounts(
  p_package_id uuid, p_sessions integer, p_unit_price numeric, p_discount numeric,
  p_discount_reason text, p_reason text, p_expected_due numeric, p_expected_paid numeric,
  p_total_due numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_package public.b2c_tuition_packages%rowtype; v_enrollment uuid; v_class uuid;
  v_paid numeric; v_context text := current_setting('app.b2c_adjustment_reason', true);
begin
  select p.enrollment_id, e.class_id into v_enrollment, v_class
  from public.b2c_tuition_packages p join public.b2c_enrollments e on e.id = p.enrollment_id
  where p.id = p_package_id and p.archived_at is null;
  if v_enrollment is null or not coalesce(app.has_b2c_permission('edit_tuition', v_class), false)
      or (v_class is null and not coalesce(app.is_manager(), false)) then
    raise exception 'Không có quyền quản lý học phí B2C' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'Vui lòng nhập lý do điều chỉnh học phí' using errcode = '22023';
  end if;
  if p_unit_price is null or p_discount is null or p_unit_price <> trunc(p_unit_price)
      or p_discount <> trunc(p_discount) then
    raise exception 'Số tiền phải là VNĐ nguyên' using errcode = '22023';
  end if;
  perform app.validate_b2c_tuition_total(p_total_due);
  perform 1 from public.b2c_enrollments where id = v_enrollment for update;
  select * into v_package from public.b2c_tuition_packages
  where id = p_package_id and archived_at is null for update;
  if not found then raise exception 'Gói học phí đã thay đổi. Vui lòng tải lại.' using errcode = '40001'; end if;
  select coalesce(sum(effective_amount), 0) into v_paid
  from public.b2c_tuition_receipts where package_id = p_package_id;
  if v_package.total_due is distinct from p_expected_due or v_paid is distinct from p_expected_paid then
    raise exception 'Số dư đã thay đổi. Vui lòng tải lại.' using errcode = '40001';
  end if;
  perform set_config('app.b2c_adjustment_reason', btrim(p_reason), true);
  update public.b2c_tuition_packages
  set sessions = p_sessions, unit_price = p_unit_price, discount = p_discount,
    discount_reason = nullif(btrim(p_discount_reason), ''), total_due_override = p_total_due
  where id = p_package_id;
  perform set_config('app.b2c_adjustment_reason', coalesce(v_context, ''), true);
  return p_package_id;
end;
$$;

create function public.save_b2c_tuition_package_amounts(
  p_enrollment_id uuid, p_sessions integer, p_unit_price numeric, p_discount numeric,
  p_discount_reason text, p_reason text, p_expected_due numeric, p_expected_paid numeric,
  p_total_due numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_package public.b2c_tuition_packages%rowtype; v_class uuid; v_id uuid;
begin
  select class_id into v_class from public.b2c_enrollments where id = p_enrollment_id;
  if not found or not coalesce(app.has_b2c_permission('edit_tuition', v_class), false)
      or (v_class is null and not coalesce(app.is_manager(), false)) then
    raise exception 'Không có quyền quản lý học phí B2C' using errcode = '42501';
  end if;
  perform 1 from public.b2c_enrollments where id = p_enrollment_id for update;
  select * into v_package from public.b2c_tuition_packages
  where enrollment_id = p_enrollment_id and archived_at is null and is_current for update;
  if found then
    if v_package.period_no > 1 then
      raise exception 'Học viên có nhiều đợt học phí. Vui lòng tải lại và chọn đúng đợt.' using errcode = '40001';
    end if;
    return public.save_b2c_tuition_period_amounts(v_package.id, p_sessions, p_unit_price,
      p_discount, p_discount_reason, p_reason, p_expected_due, p_expected_paid, p_total_due);
  end if;
  if p_expected_due is not null or p_expected_paid is distinct from 0::numeric then
    raise exception 'Gói học phí đã thay đổi. Vui lòng tải lại.' using errcode = '40001';
  end if;
  if p_unit_price is null or p_discount is null or p_unit_price <> trunc(p_unit_price)
      or p_discount <> trunc(p_discount) then
    raise exception 'Số tiền phải là VNĐ nguyên' using errcode = '22023';
  end if;
  perform app.validate_b2c_tuition_total(p_total_due);
  insert into public.b2c_tuition_packages(enrollment_id, sessions, unit_price, discount,
    discount_reason, total_due_override)
  values(p_enrollment_id, p_sessions, p_unit_price, p_discount,
    nullif(btrim(p_discount_reason), ''), p_total_due) returning id into v_id;
  return v_id;
end;
$$;

create function public.start_b2c_tuition_period_amounts(
  p_enrollment_id uuid, p_previous_package_id uuid, p_request_id uuid,
  p_sessions integer, p_unit_price numeric, p_discount numeric, p_discount_reason text,
  p_reason text, p_expected_due numeric, p_expected_paid numeric, p_total_due numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_package public.b2c_tuition_packages%rowtype; v_existing public.b2c_tuition_packages%rowtype;
  v_class uuid; v_paid numeric; v_id uuid; v_payload jsonb;
begin
  select class_id into v_class from public.b2c_enrollments where id = p_enrollment_id;
  if not found or not coalesce(app.has_b2c_permission('edit_tuition', v_class), false)
      or (v_class is null and not coalesce(app.is_manager(), false)) then
    raise exception 'Không có quyền quản lý học phí B2C' using errcode = '42501';
  end if;
  if p_request_id is null or p_previous_package_id is null or p_reason is null
      or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'Thiếu mã yêu cầu, đợt trước hoặc lý do tạo đợt mới' using errcode = '22023';
  end if;
  if p_unit_price is null or p_discount is null or p_unit_price <> trunc(p_unit_price)
      or p_discount <> trunc(p_discount) then
    raise exception 'Số tiền phải là VNĐ nguyên' using errcode = '22023';
  end if;
  perform app.validate_b2c_tuition_total(p_total_due);
  v_payload := jsonb_build_object('enrollment_id', p_enrollment_id, 'previous_package_id', p_previous_package_id,
    'sessions', p_sessions, 'unit_price', p_unit_price, 'discount', p_discount,
    'discount_reason', nullif(btrim(p_discount_reason), ''), 'reason', btrim(p_reason),
    'expected_due', p_expected_due, 'expected_paid', p_expected_paid, 'total_due_override', p_total_due);
  perform 1 from public.b2c_enrollments where id = p_enrollment_id for update;
  select * into v_existing from public.b2c_tuition_packages where period_request_id = p_request_id;
  if found then
    if v_existing.period_request_payload is distinct from v_payload then
      raise exception 'Mã yêu cầu đã được dùng cho nội dung khác' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;
  select * into v_package from public.b2c_tuition_packages
  where enrollment_id = p_enrollment_id and archived_at is null and is_current for update;
  if not found or v_package.id <> p_previous_package_id then
    raise exception 'Đợt học phí đã thay đổi. Vui lòng tải lại.' using errcode = '40001';
  end if;
  select coalesce(sum(effective_amount), 0) into v_paid
  from public.b2c_tuition_receipts where package_id = v_package.id;
  if v_package.total_due is distinct from p_expected_due or v_paid is distinct from p_expected_paid then
    raise exception 'Số dư đã thay đổi. Vui lòng tải lại.' using errcode = '40001';
  end if;
  update public.b2c_tuition_packages set is_current = false, adjustment_reason = btrim(p_reason)
  where id = v_package.id;
  insert into public.b2c_tuition_packages(enrollment_id, sessions, unit_price, discount, discount_reason,
    adjustment_reason, period_request_id, period_request_payload, total_due_override)
  values(p_enrollment_id, p_sessions, p_unit_price, p_discount, nullif(btrim(p_discount_reason), ''),
    btrim(p_reason), p_request_id, v_payload, p_total_due) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function
  public.save_b2c_tuition_package_amounts(uuid, integer, numeric, numeric, text, text, numeric, numeric, numeric),
  public.save_b2c_tuition_period_amounts(uuid, integer, numeric, numeric, text, text, numeric, numeric, numeric),
  public.start_b2c_tuition_period_amounts(uuid, uuid, uuid, integer, numeric, numeric, text, text, numeric, numeric, numeric)
from public, anon;
grant execute on function
  public.save_b2c_tuition_package_amounts(uuid, integer, numeric, numeric, text, text, numeric, numeric, numeric),
  public.save_b2c_tuition_period_amounts(uuid, integer, numeric, numeric, text, text, numeric, numeric, numeric),
  public.start_b2c_tuition_period_amounts(uuid, uuid, uuid, integer, numeric, numeric, text, text, numeric, numeric, numeric)
to authenticated;

-- Old deployed editors cannot knowingly preserve or reset a manual total.
-- Ask them to reload instead of silently editing beneath a fixed total.
do $$
declare v_definition text; v_needle text;
begin
  v_definition := pg_get_functiondef('public.save_b2c_tuition_package(uuid,integer,numeric,numeric,text)'::regprocedure);
  v_needle := 'if exists(select 1 from public.b2c_tuition_packages where enrollment_id=p_enrollment_id';
  if strpos(v_definition, v_needle) = 0 then raise exception 'Unexpected legacy package writer'; end if;
  execute replace(v_definition, v_needle, $guard$
  if exists(select 1 from public.b2c_tuition_packages where enrollment_id=p_enrollment_id
      and archived_at is null and is_current and total_due_override is not null) then
    raise exception 'Gói đang dùng tổng phải thu nhập tay. Vui lòng tải lại để chỉnh sửa.' using errcode='40001';
  end if;
  $guard$ || v_needle);
  v_definition := pg_get_functiondef('public.save_b2c_tuition_period(uuid,integer,numeric,numeric,text,text,numeric,numeric)'::regprocedure);
  v_needle := 'if not found then raise exception ''Gói học phí đã thay đổi. Vui lòng tải lại.'' using errcode=''40001''; end if;';
  if strpos(v_definition, v_needle) = 0 then raise exception 'Unexpected legacy period writer'; end if;
  execute replace(v_definition, v_needle, v_needle || $guard$
  if v_package.total_due_override is not null then
    raise exception 'Gói đang dùng tổng phải thu nhập tay. Vui lòng tải lại để chỉnh sửa.' using errcode='40001';
  end if;
  $guard$);
end;
$$;

-- Preserve existing correction permissions, snapshots, idempotency and limits.
-- A correction to a manual total changes that total, not the unrelated inputs.
do $$
declare
  v_definition text := pg_get_functiondef('public.correct_b2c_tuition(jsonb)'::regprocedure);
  v_needle text;
begin
  v_needle := 'update public.b2c_tuition_packages set discount=discount+v_amount,discount_reason=v_reason,adjustment_reason=v_reason where id=v_package_id;';
  if strpos(v_definition, v_needle) = 0 then raise exception 'Unexpected tuition refund writer'; end if;
  v_definition := replace(v_definition, v_needle, $refund$
    if v_package.total_due_override is null then
      update public.b2c_tuition_packages set discount=discount+v_amount,discount_reason=v_reason,adjustment_reason=v_reason where id=v_package_id;
    else
      update public.b2c_tuition_packages set total_due_override=total_due_override-v_amount,adjustment_reason=v_reason where id=v_package_id;
    end if;
  $refund$);
  v_needle := 'update public.b2c_tuition_packages set discount=sessions*unit_price-v_amount,discount_reason=v_reason,adjustment_reason=v_reason where id=v_package_id;';
  if strpos(v_definition, v_needle) = 0 then raise exception 'Unexpected tuition adjustment writer'; end if;
  v_definition := replace(v_definition, v_needle, $adjust$
  if v_package.total_due_override is null then
    update public.b2c_tuition_packages set discount=sessions*unit_price-v_amount,discount_reason=v_reason,adjustment_reason=v_reason where id=v_package_id;
  else
    update public.b2c_tuition_packages set total_due_override=v_amount,adjustment_reason=v_reason where id=v_package_id;
  end if;
  $adjust$);
  execute v_definition;
end;
$$;

-- Include the mode in every tuition projection, retaining all guards/filters.
do $$
declare v_function regprocedure; v_original text; v_definition text;
begin
  foreach v_function in array array[
    'public.get_b2c_tuition_page(text,integer)'::regprocedure,
    'public.read_center_b2c_tuition_page(text,integer)'::regprocedure,
    'public.get_b2c_tuition_period_page(text,integer)'::regprocedure,
    'public.read_center_b2c_tuition_period_page(text,integer)'::regprocedure,
    'public.read_b2c_class_tuition_periods(uuid,integer,text)'::regprocedure,
    'public.read_b2c_class_workspace(uuid,text,integer,text,uuid)'::regprocedure,
    'public.read_teacher_b2c_workspace(uuid,text,integer,text,uuid)'::regprocedure
  ] loop
    v_original := pg_get_functiondef(v_function);
    v_definition := regexp_replace(v_original,
      '([pt])\.discount_reason,([[:space:]]*)[pt]\.total_due',
      '\1.discount_reason,\2\1.total_due_override,\2\1.total_due', 'g');
    if v_definition = v_original then raise exception 'Unexpected tuition projection: %', v_function; end if;
    if v_function = 'public.read_teacher_b2c_workspace(uuid,text,integer,text,uuid)'::regprocedure then
      if strpos(v_definition, '''discount_reason'',''total_due'',''paid_amount''') = 0 then
        raise exception 'Unexpected teacher nonfinancial projection';
      end if;
      v_definition := replace(v_definition, '''discount_reason'',''total_due'',''paid_amount''',
        '''discount_reason'',''total_due_override'',''total_due'',''paid_amount''');
    end if;
    execute v_definition;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
