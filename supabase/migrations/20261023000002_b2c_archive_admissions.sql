-- Remove leads from operational views while preserving their care history.
alter table public.b2c_admission_leads
 add column archived_at timestamptz,
 add column archived_by uuid references public.profiles(id),
 add constraint b2c_admission_archive_actor check ((archived_at is null) = (archived_by is null));

-- Restrictive policies also cover the existing manager policies and invoker RPC.
create policy b2c_admissions_active_select on public.b2c_admission_leads
 as restrictive for select to authenticated using(archived_at is null);
create policy b2c_admissions_active_insert on public.b2c_admission_leads
 as restrictive for insert to authenticated with check(archived_at is null and archived_by is null);
create policy b2c_care_active_insert on public.b2c_admission_care_logs
 as restrictive for insert to authenticated with check(exists(select 1 from public.b2c_admission_leads l where l.id=lead_id));

create function public.archive_b2c_admission(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.has_b2c_permission('manage_admissions'),false) then
  raise exception 'Không có quyền xóa khách tuyển sinh.' using errcode='42501';
 end if;
 if p_id is null then raise exception 'Thiếu khách tuyển sinh.' using errcode='22023'; end if;
 perform 1 from public.b2c_admission_leads where id=p_id for update;
 if not found then raise exception 'Không tìm thấy khách tuyển sinh.' using errcode='22023'; end if;
 update public.b2c_admission_leads set archived_at=clock_timestamp(),archived_by=auth.uid()
 where id=p_id and archived_at is null;
end $$;
revoke all on function public.archive_b2c_admission(uuid) from public,anon;
grant execute on function public.archive_b2c_admission(uuid) to authenticated;
notify pgrst,'reload schema';
