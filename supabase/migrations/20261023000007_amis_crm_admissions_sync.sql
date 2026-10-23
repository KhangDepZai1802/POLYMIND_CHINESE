begin;
alter table public.b2c_admission_leads alter column phone drop not null, alter column created_by drop not null;
alter table public.b2c_admission_leads drop constraint if exists b2c_admission_leads_phone_check;
alter table public.b2c_admission_leads add constraint b2c_admission_leads_phone_check check (phone is null or phone ~ '^[0-9]{10}$'), add column amis_crm_id bigint, add column amis_crm_modified_at timestamptz, add column amis_crm_synced_at timestamptz;
create unique index b2c_admission_leads_amis_crm_id_uidx on public.b2c_admission_leads(amis_crm_id) where amis_crm_id is not null;
create or replace function public.sync_amis_crm_admissions(p_rows jsonb,p_program_slug text default 'tieng-trung') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; lead_id uuid; inserted_count integer:=0; updated_count integer:=0;
begin
 if auth.role() is distinct from 'service_role' and current_user<>'postgres' then raise exception 'Forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then raise exception 'Invalid CRM batch'; end if;
 if not exists(select 1 from public.b2c_programs where slug=p_program_slug and is_active) then raise exception 'Invalid B2C program'; end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  if coalesce((item->>'crm_id')::bigint,0)<=0 then raise exception 'Invalid CRM id'; end if;
  select id into lead_id from public.b2c_admission_leads where amis_crm_id=(item->>'crm_id')::bigint or (amis_crm_id is null and lower(btrim(full_name))=lower(btrim(item->>'full_name')) and phone is not distinct from nullif(item->>'phone','')) order by (amis_crm_id is not null) desc,created_at limit 1 for update;
  if lead_id is null then
   insert into public.b2c_admission_leads(full_name,phone,program_slug,salesperson,stage,customer_source,notes,created_by,amis_crm_id,amis_crm_modified_at,amis_crm_synced_at) values(left(coalesce(nullif(btrim(item->>'full_name'),''),'Chưa có tên (CRM #'||(item->>'crm_id')||')'),200),nullif(item->>'phone',''),p_program_slug,left(coalesce(nullif(btrim(item->>'salesperson'),''),'AMIS CRM'),200),'lead',nullif(item->>'customer_source',''),'Đồng bộ từ MISA AMIS CRM.',null,(item->>'crm_id')::bigint,nullif(item->>'modified_at','')::timestamptz,now()); inserted_count:=inserted_count+1;
  else
   update public.b2c_admission_leads set full_name=left(coalesce(nullif(btrim(item->>'full_name'),''),full_name),200),phone=nullif(item->>'phone',''),salesperson=left(coalesce(nullif(btrim(item->>'salesperson'),''),salesperson),200),customer_source=nullif(item->>'customer_source',''),amis_crm_id=(item->>'crm_id')::bigint,amis_crm_modified_at=nullif(item->>'modified_at','')::timestamptz,amis_crm_synced_at=now() where id=lead_id; updated_count:=updated_count+1;
  end if; lead_id:=null;
 end loop;
 return jsonb_build_object('received',jsonb_array_length(p_rows),'inserted',inserted_count,'updated',updated_count);
end; $$;
revoke all on function public.sync_amis_crm_admissions(jsonb,text) from public,anon,authenticated;
grant execute on function public.sync_amis_crm_admissions(jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
