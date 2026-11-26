-- Tuition renewals are independent obligations. Paid packages remain available
-- for receipts, corrections and reporting when a later period starts.
alter table public.b2c_tuition_packages
  add column period_no integer not null default 1,
  add column is_current boolean not null default true,
  add column period_request_id uuid,
  add column period_request_payload jsonb;

-- Backfill only new metadata, including immutable archived rows. Preserve their
-- original timestamps; both guards are restored in the same DDL transaction.
alter table public.b2c_tuition_packages disable trigger guard_package_archive;
alter table public.b2c_tuition_packages disable trigger b2c_package_updated_at;
with numbered as (
  select id, row_number() over (partition by enrollment_id order by created_at,id)::integer n
  from public.b2c_tuition_packages
)
update public.b2c_tuition_packages p
set period_no=n.n, is_current=p.archived_at is null
from numbered n where n.id=p.id;
alter table public.b2c_tuition_packages enable trigger b2c_package_updated_at;
alter table public.b2c_tuition_packages enable trigger guard_package_archive;
alter table public.b2c_tuition_packages
  add constraint b2c_tuition_period_positive check(period_no>0),
  add constraint b2c_tuition_period_number unique(enrollment_id,period_no),
  add constraint b2c_tuition_period_request unique(period_request_id),
  add constraint b2c_tuition_period_request_pair check(
    (period_request_id is null) = (period_request_payload is null));
drop index public.b2c_tuition_active_enrollment;
create unique index b2c_tuition_active_enrollment
on public.b2c_tuition_packages(enrollment_id) where archived_at is null and is_current;

-- Direct clients cannot forge period lifecycle or request metadata.
revoke insert on public.b2c_tuition_packages from authenticated;
grant insert(enrollment_id,sessions,unit_price,discount,discount_reason)
on public.b2c_tuition_packages to authenticated;

create function app.assign_b2c_tuition_period() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.b2c_enrollments where id=new.enrollment_id for update;
  select coalesce(max(period_no),0)+1 into new.period_no
  from public.b2c_tuition_packages where enrollment_id=new.enrollment_id;
  return new;
end;
$$;
revoke all on function app.assign_b2c_tuition_period() from public,anon,authenticated;
create trigger b2c_package_assign_period before insert on public.b2c_tuition_packages
for each row execute function app.assign_b2c_tuition_period();

-- Include period changes in the existing immutable history (real auth.uid actor).
do $$
declare v_definition text; v_original text;
begin
  v_original:=pg_get_functiondef('app.capture_b2c_change()'::regprocedure);
  v_definition:=replace(v_original,
    '''discount_reason'',''total_due'',''adjustment_reason'']',
    '''discount_reason'',''total_due'',''adjustment_reason'',''period_no'',''is_current'']');
  if v_definition=v_original then raise exception 'Unexpected tuition audit definition'; end if;
  execute v_definition;
end;
$$;

create function public.save_b2c_tuition_period(
  p_package_id uuid,p_sessions integer,p_unit_price numeric,p_discount numeric,
  p_discount_reason text,p_reason text,p_expected_due numeric,p_expected_paid numeric
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_package public.b2c_tuition_packages%rowtype; v_enrollment uuid; v_class uuid;
  v_paid numeric; v_context text:=current_setting('app.b2c_adjustment_reason',true);
begin
  select p.enrollment_id,e.class_id into v_enrollment,v_class
  from public.b2c_tuition_packages p join public.b2c_enrollments e on e.id=p.enrollment_id
  where p.id=p_package_id and p.archived_at is null;
  if v_enrollment is null or not coalesce(app.has_b2c_permission('edit_tuition',v_class),false)
     or (v_class is null and not coalesce(app.is_manager(),false)) then
    raise exception 'Không có quyền quản lý học phí B2C' using errcode='42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'Vui lòng nhập lý do điều chỉnh học phí' using errcode='22023';
  end if;
  if p_unit_price is null or p_discount is null or p_unit_price<>trunc(p_unit_price)
     or p_discount<>trunc(p_discount) then
    raise exception 'Số tiền phải là VNĐ nguyên' using errcode='22023';
  end if;
  perform 1 from public.b2c_enrollments where id=v_enrollment for update;
  select * into v_package from public.b2c_tuition_packages
  where id=p_package_id and archived_at is null for update;
  if not found then raise exception 'Gói học phí đã thay đổi. Vui lòng tải lại.' using errcode='40001'; end if;
  select coalesce(sum(effective_amount),0) into v_paid from public.b2c_tuition_receipts where package_id=p_package_id;
  if v_package.total_due is distinct from p_expected_due or v_paid is distinct from p_expected_paid then
    raise exception 'Số dư đã thay đổi. Vui lòng tải lại.' using errcode='40001';
  end if;
  perform set_config('app.b2c_adjustment_reason',btrim(p_reason),true);
  update public.b2c_tuition_packages set sessions=p_sessions,unit_price=p_unit_price,
    discount=p_discount,discount_reason=nullif(btrim(p_discount_reason),'') where id=p_package_id;
  perform set_config('app.b2c_adjustment_reason',coalesce(v_context,''),true);
  return p_package_id;
end;
$$;

create function public.start_b2c_tuition_period(
  p_enrollment_id uuid,p_previous_package_id uuid,p_request_id uuid,
  p_sessions integer,p_unit_price numeric,p_discount numeric,p_discount_reason text,
  p_reason text,p_expected_due numeric,p_expected_paid numeric
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_package public.b2c_tuition_packages%rowtype; v_existing public.b2c_tuition_packages%rowtype;
  v_class uuid; v_paid numeric; v_id uuid; v_payload jsonb;
begin
  select class_id into v_class from public.b2c_enrollments where id=p_enrollment_id;
  if not found or not coalesce(app.has_b2c_permission('edit_tuition',v_class),false)
     or (v_class is null and not coalesce(app.is_manager(),false)) then
    raise exception 'Không có quyền quản lý học phí B2C' using errcode='42501';
  end if;
  if p_request_id is null or p_previous_package_id is null or p_reason is null
     or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'Thiếu mã yêu cầu, đợt trước hoặc lý do tạo đợt mới' using errcode='22023';
  end if;
  if p_unit_price is null or p_discount is null or p_unit_price<>trunc(p_unit_price)
     or p_discount<>trunc(p_discount) then
    raise exception 'Số tiền phải là VNĐ nguyên' using errcode='22023';
  end if;
  v_payload:=jsonb_build_object('enrollment_id',p_enrollment_id,'previous_package_id',p_previous_package_id,
    'sessions',p_sessions,'unit_price',p_unit_price,'discount',p_discount,
    'discount_reason',nullif(btrim(p_discount_reason),''),'reason',btrim(p_reason),
    'expected_due',p_expected_due,'expected_paid',p_expected_paid);
  perform 1 from public.b2c_enrollments where id=p_enrollment_id for update;
  select * into v_existing from public.b2c_tuition_packages where period_request_id=p_request_id;
  if found then
    if v_existing.period_request_payload is distinct from v_payload then
      raise exception 'Mã yêu cầu đã được dùng cho nội dung khác' using errcode='22023';
    end if;
    return v_existing.id;
  end if;
  select * into v_package from public.b2c_tuition_packages
  where enrollment_id=p_enrollment_id and archived_at is null and is_current for update;
  if not found or v_package.id<>p_previous_package_id then
    raise exception 'Đợt học phí đã thay đổi. Vui lòng tải lại.' using errcode='40001';
  end if;
  select coalesce(sum(effective_amount),0) into v_paid from public.b2c_tuition_receipts where package_id=v_package.id;
  if v_package.total_due is distinct from p_expected_due or v_paid is distinct from p_expected_paid then
    raise exception 'Số dư đã thay đổi. Vui lòng tải lại.' using errcode='40001';
  end if;
  update public.b2c_tuition_packages set is_current=false,adjustment_reason=btrim(p_reason) where id=v_package.id;
  insert into public.b2c_tuition_packages(enrollment_id,sessions,unit_price,discount,discount_reason,
    adjustment_reason,period_request_id,period_request_payload)
  values(p_enrollment_id,p_sessions,p_unit_price,p_discount,nullif(btrim(p_discount_reason),''),
    btrim(p_reason),p_request_id,v_payload) returning id into v_id;
  return v_id;
end;
$$;

-- Older clients may create the initial package, but cannot silently edit an
-- arbitrary period after renewal. The new editor always supplies a package ID.
create or replace function public.save_b2c_tuition_package(
 p_enrollment_id uuid,p_sessions integer,p_unit_price numeric,p_discount numeric,p_discount_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not coalesce(app.has_b2c_permission('edit_tuition',(select class_id from public.b2c_enrollments where id=p_enrollment_id)),false)
     or (not coalesce(app.is_manager(),false) and (select class_id from public.b2c_enrollments where id=p_enrollment_id) is null) then
    raise exception 'Không có quyền quản lý học phí B2C' using errcode='42501'; end if;
  perform 1 from public.b2c_enrollments where id=p_enrollment_id for update;
  if exists(select 1 from public.b2c_tuition_packages where enrollment_id=p_enrollment_id
      and archived_at is null and is_current and period_no>1) then
    raise exception 'Học viên có nhiều đợt học phí. Vui lòng tải lại và chọn đúng đợt.' using errcode='40001';
  end if;
  if p_unit_price is null or p_discount is null or p_unit_price<>trunc(p_unit_price) or p_discount<>trunc(p_discount) then
    raise exception 'Số tiền phải là VNĐ nguyên' using errcode='22023'; end if;
  insert into public.b2c_tuition_packages(enrollment_id,sessions,unit_price,discount,discount_reason)
  values(p_enrollment_id,p_sessions,p_unit_price,p_discount,nullif(btrim(p_discount_reason),''))
  on conflict(enrollment_id) where archived_at is null and is_current do update
    set sessions=excluded.sessions,unit_price=excluded.unit_price,discount=excluded.discount,discount_reason=excluded.discount_reason
  returning id into v_id;
  return v_id;
end;
$$;
do $$
declare v_definition text; v_original text;
begin
  v_original:=pg_get_functiondef('public.save_b2c_tuition_package_with_reason(uuid,integer,numeric,numeric,text,text,numeric,numeric)'::regprocedure);
  v_definition:=replace(v_original,'enrollment_id=p_enrollment_id and archived_at is null for update',
    'enrollment_id=p_enrollment_id and archived_at is null and is_current for update');
  if v_definition=v_original then raise exception 'Unexpected tuition save definition'; end if;
  execute v_definition;
end;
$$;
revoke all on function public.save_b2c_tuition_period(uuid,integer,numeric,numeric,text,text,numeric,numeric),
  public.start_b2c_tuition_period(uuid,uuid,uuid,integer,numeric,numeric,text,text,numeric,numeric) from public,anon;
grant execute on function public.save_b2c_tuition_period(uuid,integer,numeric,numeric,text,text,numeric,numeric),
  public.start_b2c_tuition_period(uuid,uuid,uuid,integer,numeric,numeric,text,text,numeric,numeric) to authenticated;
notify pgrst,'reload schema';
