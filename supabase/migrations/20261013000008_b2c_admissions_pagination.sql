begin;
create extension if not exists pg_trgm with schema extensions;
create index b2c_admissions_stage_order_idx on public.b2c_admission_leads(stage,created_at desc,id);
create index b2c_admissions_program_stage_idx on public.b2c_admission_leads(program_slug,stage,created_at desc,id);
create index b2c_admissions_name_search_idx on public.b2c_admission_leads using gin(full_name extensions.gin_trgm_ops);
create index b2c_admissions_phone_search_idx on public.b2c_admission_leads using gin(phone extensions.gin_trgm_ops);
create index b2c_admissions_sales_search_idx on public.b2c_admission_leads using gin(salesperson extensions.gin_trgm_ops);
create index b2c_care_latest_idx on public.b2c_admission_care_logs(lead_id,created_at desc,id) include(next_followup_date);

create function public.get_b2c_admissions_page(
  p_stage text default null, p_program text default null, p_query text default '',
  p_page integer default 0, p_limit integer default 20
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_pattern text; v_result jsonb;
begin
  if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý B2C' using errcode='42501'; end if;
  if p_page is null or p_page < 0 or p_page > 1000000 or p_limit is null or p_limit not between 1 and 50
    or char_length(coalesce(p_query,'')) > 200
    or (p_stage is not null and p_stage not in ('lead','consulted','trial','deposit','enrolled','lost'))
    or (p_program is not null and p_program not in ('tieng-anh','tieng-trung','tieng-viet','lop-ve','kem-1-1'))
  then raise exception 'Bộ lọc không hợp lệ' using errcode='22023'; end if;
  v_pattern := '%' || replace(replace(replace(btrim(coalesce(p_query,'')), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  with filtered as (
    select l.* from public.b2c_admission_leads l
    where (p_stage is null or l.stage=p_stage) and (p_program is null or l.program_slug=p_program)
      and (btrim(coalesce(p_query,''))='' or l.full_name ilike v_pattern or l.phone ilike v_pattern or l.salesperson ilike v_pattern)
  ), page_rows as (
    select * from filtered order by created_at desc,id limit p_limit offset (p_page::bigint*p_limit)
  ), enriched as (
    select p.id,p.full_name,p.phone,p.program_slug,p.salesperson,p.stage,p.customer_source,p.referrer_name,p.notes,p.failure_reason,
      (select c.next_followup_date from public.b2c_admission_care_logs c where c.lead_id=p.id order by c.created_at desc,c.id limit 1) as "nextFollowupDate",
      p.created_at
    from page_rows p
  )
  select jsonb_build_object('total',(select count(*) from filtered),
    'leads',coalesce((select jsonb_agg(to_jsonb(e) - 'created_at' order by e.created_at desc,e.id) from enriched e),'[]'::jsonb)) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_b2c_admissions_page(text,text,text,integer,integer) from public,anon;
grant execute on function public.get_b2c_admissions_page(text,text,text,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
