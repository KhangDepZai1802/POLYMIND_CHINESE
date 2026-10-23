begin;
alter table public.b2c_admission_leads
  add column amis_crm_code text,
  add column amis_order_sales numeric(15,2),
  add column amis_last_purchase_date date,
  add column amis_days_since_purchase integer check(amis_days_since_purchase is null or amis_days_since_purchase >= 0);
create unique index b2c_admission_leads_amis_crm_code_uidx on public.b2c_admission_leads(amis_crm_code) where amis_crm_code is not null;

create or replace function public.sync_amis_crm_account_snapshot(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; lead_id uuid; updated_count integer:=0; enrolled_count integer:=0;
begin
  if auth.role() is distinct from 'service_role' and current_user<>'postgres' then raise exception 'Forbidden' using errcode='42501'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<>78 then raise exception 'Expected exactly 78 CRM accounts'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    select id into lead_id from public.b2c_admission_leads
      where amis_crm_id is not null and lower(btrim(full_name))=lower(btrim(item->>'full_name'))
      limit 1 for update;
    if lead_id is null then raise exception 'CRM account not found in admissions: %',item->>'full_name'; end if;
    update public.b2c_admission_leads set
      amis_crm_code=nullif(item->>'crm_code',''),
      phone=coalesce(nullif(item->>'phone',''),phone),
      amis_order_sales=coalesce((item->>'order_sales')::numeric,0),
      amis_last_purchase_date=nullif(item->>'last_purchase_date','')::date,
      amis_days_since_purchase=nullif(item->>'days_since_purchase','')::integer,
      stage=case when coalesce((item->>'order_sales')::numeric,0)>0 and stage='lead' then 'enrolled' else stage end,
      amis_crm_synced_at=now()
    where id=lead_id;
    updated_count:=updated_count+1;
    if coalesce((item->>'order_sales')::numeric,0)>0 then enrolled_count:=enrolled_count+1; end if;
  end loop;
  return jsonb_build_object('received',jsonb_array_length(p_rows),'updated',updated_count,'with_purchase',enrolled_count,'without_purchase',updated_count-enrolled_count);
end; $$;
revoke all on function public.sync_amis_crm_account_snapshot(jsonb) from public,anon,authenticated;
grant execute on function public.sync_amis_crm_account_snapshot(jsonb) to service_role;

create or replace function public.get_b2c_admissions_page(p_stage text default null,p_program text default null,p_query text default '',p_page integer default 0,p_limit integer default 20)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_pattern text; v_result jsonb;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý B2C' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>1000000 or p_limit is null or p_limit not between 1 and 50 or char_length(coalesce(p_query,''))>200 or (p_stage is not null and p_stage not in ('lead','consulted','trial','deposit','enrolled','lost')) or (p_program is not null and p_program not in ('tieng-anh','tieng-trung','tieng-viet','lop-ve','kem-1-1')) then raise exception 'Bộ lọc không hợp lệ' using errcode='22023'; end if;
 v_pattern:='%'||replace(replace(replace(btrim(coalesce(p_query,'')),chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%';
 with filtered as (select l.* from public.b2c_admission_leads l where (p_stage is null or l.stage=p_stage) and (p_program is null or l.program_slug=p_program) and (btrim(coalesce(p_query,''))='' or l.full_name ilike v_pattern or l.phone ilike v_pattern or l.salesperson ilike v_pattern)), page_rows as (select * from filtered order by created_at desc,id limit p_limit offset(p_page::bigint*p_limit)), enriched as (select p.id,p.full_name,p.phone,p.program_slug,p.salesperson,p.stage,p.customer_source,p.referrer_name,p.notes,p.failure_reason,p.amis_order_sales,p.amis_last_purchase_date,p.amis_days_since_purchase,(select c.next_followup_date from public.b2c_admission_care_logs c where c.lead_id=p.id order by c.created_at desc,c.id limit 1) as "nextFollowupDate",p.created_at from page_rows p)
 select jsonb_build_object('total',(select count(*) from filtered),'leads',coalesce((select jsonb_agg(to_jsonb(e)-'created_at' order by e.created_at desc,e.id) from enriched e),'[]'::jsonb)) into v_result;
 return v_result;
end; $$;
notify pgrst,'reload schema';
commit;
