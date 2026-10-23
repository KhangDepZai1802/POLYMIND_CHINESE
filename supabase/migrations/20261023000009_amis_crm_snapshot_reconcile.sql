begin;
create or replace function public.sync_amis_crm_account_snapshot(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; lead_id uuid; updated_count integer:=0; inserted_count integer:=0; enrolled_count integer:=0;
begin
 if auth.role() is distinct from 'service_role' and current_user<>'postgres' then raise exception 'Forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<>78 then raise exception 'Expected exactly 78 CRM accounts'; end if;
 if (select count(distinct value->>'crm_code') from jsonb_array_elements(p_rows))<>78 then raise exception 'CRM codes must be unique'; end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  select l.id into lead_id from public.b2c_admission_leads l where l.amis_crm_id is not null and (lower(btrim(l.full_name))=lower(btrim(item->>'full_name')) or (nullif(item->>'phone','') is not null and l.phone=item->>'phone' and 1=(select count(*) from public.b2c_admission_leads p where p.amis_crm_id is not null and p.phone=item->>'phone'))) order by (lower(btrim(l.full_name))=lower(btrim(item->>'full_name'))) desc limit 1 for update;
  if lead_id is null then
   insert into public.b2c_admission_leads(full_name,phone,program_slug,salesperson,stage,notes,created_by,amis_crm_code,amis_order_sales,amis_last_purchase_date,amis_days_since_purchase,amis_crm_synced_at)
   values(left(coalesce(nullif(btrim(item->>'full_name'),''),'Chưa có tên CRM'),200),nullif(item->>'phone',''),'tieng-trung','Võ Thị Anh Thy (EDU-TS-001)',case when coalesce((item->>'order_sales')::numeric,0)>0 then 'enrolled' else 'lead' end,'Đồng bộ từ MISA AMIS CRM.',null,item->>'crm_code',coalesce((item->>'order_sales')::numeric,0),nullif(item->>'last_purchase_date','')::date,nullif(item->>'days_since_purchase','')::integer,now()) returning id into lead_id;
   inserted_count:=inserted_count+1;
  else
   update public.b2c_admission_leads set amis_crm_code=item->>'crm_code',phone=coalesce(nullif(item->>'phone',''),phone),amis_order_sales=coalesce((item->>'order_sales')::numeric,0),amis_last_purchase_date=nullif(item->>'last_purchase_date','')::date,amis_days_since_purchase=nullif(item->>'days_since_purchase','')::integer,stage=case when coalesce((item->>'order_sales')::numeric,0)>0 and stage='lead' then 'enrolled' else stage end,amis_crm_synced_at=now(),archived_at=null,archived_by=null where id=lead_id;
   updated_count:=updated_count+1;
  end if;
  if coalesce((item->>'order_sales')::numeric,0)>0 then enrolled_count:=enrolled_count+1; end if;
  lead_id:=null;
 end loop;
 return jsonb_build_object('received',78,'inserted',inserted_count,'updated',updated_count,'with_purchase',enrolled_count,'without_purchase',78-enrolled_count);
end; $$;
revoke all on function public.sync_amis_crm_account_snapshot(jsonb) from public,anon,authenticated;
grant execute on function public.sync_amis_crm_account_snapshot(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
