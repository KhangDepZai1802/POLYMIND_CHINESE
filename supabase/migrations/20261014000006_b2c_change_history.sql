create table public.b2c_change_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  actor_name text,
  actor_role public.user_role,
  entity_type text not null check(entity_type in ('enrollment','tuition_package','tuition_receipt')),
  entity_id uuid not null,
  operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
  enrollment_id uuid,
  student_id uuid,
  student_code text,
  student_name text,
  class_id uuid,
  class_code text,
  class_name text,
  before_data jsonb,
  after_data jsonb,
  search_text text generated always as (
    coalesce(student_code,'') || ' ' || coalesce(student_name,'') || ' ' || coalesce(class_code,'') || ' ' || coalesce(class_name,'')
  ) stored,
  check(before_data is not null or after_data is not null)
);
alter table public.b2c_change_history enable row level security;
create policy b2c_change_history_admin_read on public.b2c_change_history
  for select to authenticated using(app.is_super_admin());
revoke all on public.b2c_change_history from public,anon,authenticated;
grant select on public.b2c_change_history to authenticated;
create index b2c_history_created_idx on public.b2c_change_history(created_at desc,id desc);
create index b2c_history_enrollment_idx on public.b2c_change_history(enrollment_id,created_at desc,id desc);
create index b2c_history_entity_idx on public.b2c_change_history(entity_type,created_at desc,id desc);

create function app.capture_b2c_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_old jsonb; v_new jsonb; v_row jsonb; v_before jsonb; v_after jsonb;
  v_kind text; v_fields text[]; v_key text; v_enrollment uuid;
  v_student uuid; v_class uuid; v_student_code text; v_student_name text; v_class_code text; v_class_name text;
  v_actor_name text; v_actor_role public.user_role;
begin
  if TG_OP <> 'INSERT' then v_old := to_jsonb(OLD); end if;
  if TG_OP <> 'DELETE' then v_new := to_jsonb(NEW); end if;
  v_row := coalesce(v_new,v_old);
  if TG_TABLE_NAME = 'b2c_enrollments' then
    v_kind := 'enrollment'; v_enrollment := (v_row->>'id')::uuid;
    v_student := (v_row->>'student_id')::uuid; v_class := (v_row->>'class_id')::uuid;
    v_fields := array['status','withdrawal_reason','class_id','enrollment_date','payment_date','learning_start_date','tuition_end_date','registered_sessions','sessions_per_week','salesperson','learning_goal','certificate_goal','notes'];
  elsif TG_TABLE_NAME = 'b2c_tuition_packages' then
    v_kind := 'tuition_package'; v_enrollment := (v_row->>'enrollment_id')::uuid;
    v_fields := array['sessions','unit_price','discount','discount_reason','total_due'];
  elsif TG_TABLE_NAME = 'b2c_tuition_receipts' then
    v_kind := 'tuition_receipt';
    select enrollment_id into v_enrollment from public.b2c_tuition_packages where id=(v_row->>'package_id')::uuid;
    v_fields := array['code','paid_date','amount','method','collector_name'];
  else
    raise exception 'Unsupported B2C history source';
  end if;
  if v_old is not null then
    v_before := '{}'::jsonb;
    foreach v_key in array v_fields loop v_before := v_before || jsonb_build_object(v_key,v_old->v_key); end loop;
  end if;
  if v_new is not null then
    v_after := '{}'::jsonb;
    foreach v_key in array v_fields loop v_after := v_after || jsonb_build_object(v_key,v_new->v_key); end loop;
  end if;
  -- Saving unchanged values, including an idempotent retry, creates no new event.
  if v_before is not distinct from v_after then return NEW; end if;
  if v_kind <> 'enrollment' then
    select student_id,class_id into v_student,v_class from public.b2c_enrollments where id=v_enrollment;
  end if;
  select code,full_name into v_student_code,v_student_name from public.b2c_students where id=v_student;
  select code,name into v_class_code,v_class_name from public.b2c_classes where id=v_class;
  select full_name,role into v_actor_name,v_actor_role from public.profiles where id=auth.uid();
  insert into public.b2c_change_history(
    actor_id,actor_name,actor_role,entity_type,entity_id,operation,enrollment_id,
    student_id,student_code,student_name,class_id,class_code,class_name,before_data,after_data
  ) values(
    auth.uid(),v_actor_name,v_actor_role,v_kind,(v_row->>'id')::uuid,TG_OP,v_enrollment,
    v_student,v_student_code,v_student_name,v_class,v_class_code,v_class_name,v_before,v_after
  );
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;
revoke all on function app.capture_b2c_change() from public,anon,authenticated;
create trigger b2c_enrollment_change_history after insert or update or delete on public.b2c_enrollments
  for each row execute function app.capture_b2c_change();
create trigger b2c_package_change_history after insert or update or delete on public.b2c_tuition_packages
  for each row execute function app.capture_b2c_change();
create trigger b2c_receipt_change_history after insert or update or delete on public.b2c_tuition_receipts
  for each row execute function app.capture_b2c_change();
comment on table public.b2c_change_history is 'Append-only B2C tuition/enrollment history from DB triggers. Actor and context snapshots; super-admin-only read. No backfill of unknown historical actors.';
notify pgrst,'reload schema';
