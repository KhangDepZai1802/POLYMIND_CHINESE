-- Explicit opt-in deletion for center records, preserving all historical rows.
alter table public.b2c_teacher_permissions drop constraint known_b2c_permissions;
alter table public.b2c_teacher_permissions add constraint known_b2c_permissions check(permissions <@ array['view_classes','view_students','view_schedule','view_comments','write_comments','mark_attendance','check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition','view_assessments','grade_assessments','share_monthly_comments','manage_admissions','manage_center_tuition','manage_center_student_data','delete_center_records']::text[]);
do $$ declare d text; begin
 select pg_get_functiondef('app.has_b2c_permission(text,uuid)'::regprocedure) into d;
 if position('''manage_center_student_data''' in d)=0 then raise exception 'Unexpected permission guard'; end if;
 execute replace(d,'''manage_center_student_data''','''manage_center_student_data'',''delete_center_records''');
 select pg_get_functiondef('public.save_b2c_teacher_permissions(uuid,uuid,text[],timestamptz)'::regprocedure) into d;
 if position('''manage_center_student_data'']' in d)=0 then raise exception 'Unexpected permission editor'; end if;
 execute replace(d,'''manage_center_student_data'']','''manage_center_student_data'',''delete_center_records'']');
end $$;

alter table public.b2c_students add column archived_at timestamptz;
alter table public.b2c_parents add column archived_at timestamptz;
alter table public.b2c_tuition_packages add column archived_at timestamptz;
create policy b2c_parents_archive_hidden on public.b2c_parents as restrictive for select to authenticated using(archived_at is null);
create table public.b2c_record_archives (
 id uuid primary key default gen_random_uuid(),
 entity text not null check(entity in ('student','parent','package')),
 record_id uuid not null,
 reason text not null check(char_length(btrim(reason)) between 1 and 1000),
 before_data jsonb not null,
 actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(entity,record_id)
);
alter table public.b2c_record_archives enable row level security;
create policy b2c_record_archives_read on public.b2c_record_archives for select to authenticated using(app.is_manager());
revoke all on public.b2c_record_archives from public,anon,authenticated;
grant select on public.b2c_record_archives to authenticated;
-- Archive metadata must never be set through a raw-table insert/update.
create function app.guard_b2c_archive_metadata() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' and OLD.archived_at is not null then
  raise exception 'Hồ sơ đã xóa, không thể chỉnh sửa.' using errcode='22023';
 end if;
 if (TG_OP='INSERT' and NEW.archived_at is not null)
 or (TG_OP='UPDATE' and NEW.archived_at is distinct from OLD.archived_at) then
  if current_user in ('authenticated','anon') then raise exception 'Dùng thao tác xóa hồ sơ.' using errcode='42501'; end if;
 end if;
 return NEW;
end $$;
revoke all on function app.guard_b2c_archive_metadata() from public,anon,authenticated;
create trigger guard_student_archive before insert or update on public.b2c_students for each row execute function app.guard_b2c_archive_metadata();
create trigger guard_parent_archive before insert or update on public.b2c_parents for each row execute function app.guard_b2c_archive_metadata();
create trigger guard_package_archive before insert or update on public.b2c_tuition_packages for each row execute function app.guard_b2c_archive_metadata();

create function public.archive_b2c_center_record(p_entity text,p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare d jsonb; v_table text; v_enrollment uuid;
begin
 if not coalesce(app.has_b2c_permission('delete_center_records'),false) then raise exception 'Không có quyền xóa hồ sơ toàn trung tâm.' using errcode='42501'; end if;
 if p_entity is null or p_entity not in ('student','parent','package') or p_id is null or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Chọn hồ sơ và nhập lý do xóa.' using errcode='22023'; end if;
 v_table:=case p_entity when 'student' then 'b2c_students' when 'parent' then 'b2c_parents' when 'package' then 'b2c_tuition_packages' end;
 -- The same enrollment lock used by package creation serializes delete/recreate.
 if p_entity='package' then
  select enrollment_id into v_enrollment from public.b2c_tuition_packages where id=p_id;
  perform 1 from public.b2c_enrollments where id=v_enrollment for update;
 end if;
 execute format('select to_jsonb(r) from public.%I r where id=$1 for update',v_table) into d using p_id;
 if d is null then raise exception 'Không tìm thấy hồ sơ.' using errcode='22023'; end if;
 if d->>'archived_at' is not null then return; end if;
 if p_entity='package' and exists(select 1 from public.b2c_tuition_receipts where package_id=p_id and effective_amount>0) then
  raise exception 'Gói còn tiền đã thu. Hủy phiếu thu nhầm hoặc ghi nhận hoàn tiền trước khi xóa gói.' using errcode='22023';
 end if;
 execute format('update public.%I set archived_at=clock_timestamp() where id=$1',v_table) using p_id;
 insert into public.b2c_record_archives(entity,record_id,reason,before_data,actor_id) values(p_entity,p_id,btrim(p_reason),d,auth.uid());
end $$;
revoke all on function public.archive_b2c_center_record(text,uuid,text) from public,anon;
grant execute on function public.archive_b2c_center_record(text,uuid,text) to authenticated;

create function app.reject_archived_b2c_dependencies() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='b2c_tuition_receipts' then
  perform 1 from public.b2c_tuition_packages where id=NEW.package_id and archived_at is null for update;
 else
  perform 1 from public.b2c_students where id=NEW.student_id and archived_at is null for update;
 end if;
 if not found then raise exception 'Hồ sơ đã xóa hoặc không tồn tại.' using errcode='22023'; end if;
 return NEW;
end $$;
revoke all on function app.reject_archived_b2c_dependencies() from public,anon,authenticated;
create trigger reject_archived_receipt_package before insert on public.b2c_tuition_receipts for each row execute function app.reject_archived_b2c_dependencies();
create trigger reject_archived_enrollment_student before insert on public.b2c_enrollments for each row execute function app.reject_archived_b2c_dependencies();

-- Financial history retains old packages; a new package may be created after archive.
alter table public.b2c_tuition_packages drop constraint b2c_tuition_packages_enrollment_id_key;
create unique index b2c_tuition_active_enrollment on public.b2c_tuition_packages(enrollment_id) where archived_at is null;
do $$ declare d text; begin
 select pg_get_functiondef('public.save_b2c_tuition_package(uuid,integer,numeric,numeric,text)'::regprocedure) into d;
 if position('on conflict(enrollment_id)' in d)=0 then raise exception 'Unexpected package upsert'; end if;
 execute replace(d,'on conflict(enrollment_id)','on conflict(enrollment_id) where archived_at is null');
 select pg_get_functiondef('public.save_b2c_tuition_package_with_reason(uuid,integer,numeric,numeric,text,text,numeric,numeric)'::regprocedure) into d;
 execute replace(d,'where enrollment_id=p_enrollment_id for update','where enrollment_id=p_enrollment_id and archived_at is null for update');
 -- Existing correction workflow now available to explicitly authorized center editors.
 select pg_get_functiondef('public.correct_b2c_tuition(jsonb)'::regprocedure) into d;
 execute replace(d,'app.is_manager()','(app.is_manager() or app.has_b2c_permission(''delete_center_records''))');
 select pg_get_functiondef('public.read_b2c_tuition_corrections(uuid,integer)'::regprocedure) into d;
 execute replace(d,'app.is_manager()','(app.is_manager() or app.has_b2c_permission(''delete_center_records''))');
 -- A concurrent receipt cannot enter an archived package, even by calling the old RPC.
 select pg_get_functiondef('public.record_b2c_tuition_receipt(uuid,uuid,date,numeric,text,text)'::regprocedure) into d;
 execute replace(d,'where id=p_package_id for update','where id=p_package_id and archived_at is null for update');
end $$;

-- Hide archives in operational projections, including SECURITY DEFINER teacher reads.
-- Tuition still shows students archived from the student list, preserving receivables.
do $$ declare f record; d text; begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'read_%b2c%' or p.proname like 'get_b2c%' or p.proname like 'find_b2c%')
 loop
  d:=pg_get_functiondef(f.oid);
  d:=regexp_replace(d,'(from|join) public\.b2c_parents\s+([a-z][a-z0-9_]*)','\1 (select * from public.b2c_parents where archived_at is null) \2','gi');
  -- All tuition package projections use explicit table aliases.
  d:=regexp_replace(d,'(from|join) public\.b2c_tuition_packages\s+([a-z][a-z0-9_]*)','\1 (select * from public.b2c_tuition_packages where archived_at is null) \2','gi');
  if f.proname not like '%tuition%' and f.proname not like '%receipt%' and f.proname not like '%history%' then
   d:=regexp_replace(d,'(from|join) public\.b2c_students\s+([a-z][a-z0-9_]*)','\1 (select * from public.b2c_students where archived_at is null) \2','gi');
  end if;
  execute d;
 end loop;
end $$;
notify pgrst,'reload schema';
