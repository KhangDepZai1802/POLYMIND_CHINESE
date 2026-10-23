begin;

alter table public.b2c_admission_leads
  add column b2c_student_id uuid references public.b2c_students(id) on delete set null;

create unique index b2c_admission_leads_b2c_student_id_uidx
  on public.b2c_admission_leads(b2c_student_id)
  where b2c_student_id is not null;

create or replace function public.promote_amis_crm_buyers_to_students()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  lead_row public.b2c_admission_leads;
  student_id uuid;
  clean_name text;
  matched_count integer:=0;
  inserted_count integer:=0;
  linked_count integer:=0;
begin
  if auth.role() is distinct from 'service_role' and current_user<>'postgres' then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  for lead_row in
    select *
    from public.b2c_admission_leads
    where amis_crm_code is not null
      and coalesce(amis_order_sales,0)>0
      and archived_at is null
    order by amis_crm_code,id
    for update
  loop
    student_id:=lead_row.b2c_student_id;
    clean_name:=btrim(regexp_replace(lead_row.full_name,'\s*\((ph|phụ huynh)[^)]*\)\s*$','','i'));
    if clean_name='' then clean_name:=btrim(lead_row.full_name); end if;

    if student_id is null then
      select s.id into student_id
      from public.b2c_students s
      where s.source_key='amis-crm:'||lead_row.amis_crm_code
      limit 1;
    end if;

    -- Chỉ ghép theo tên khi tên đó xác định duy nhất. Không ghép theo SĐT vì
    -- CRM thường lưu số phụ huynh dùng chung cho nhiều anh/chị/em.
    if student_id is null and (
      select count(*) from public.b2c_students s
      where lower(btrim(s.full_name))=lower(clean_name)
    )=1 then
      select s.id into student_id
      from public.b2c_students s
      where lower(btrim(s.full_name))=lower(clean_name)
      limit 1;
      matched_count:=matched_count+1;
    end if;

    if student_id is null then
      insert into public.b2c_students(source_key,full_name,phone,notes,status)
      values(
        'amis-crm:'||lead_row.amis_crm_code,
        left(clean_name,200),
        lead_row.phone,
        'Đồng bộ từ MISA AMIS CRM; đã mua hàng, chưa xếp lớp.',
        'studying'
      )
      returning id into student_id;
      inserted_count:=inserted_count+1;
    else
      update public.b2c_students
      set phone=coalesce(phone,lead_row.phone)
      where id=student_id;
    end if;

    update public.b2c_admission_leads
    set b2c_student_id=student_id
    where id=lead_row.id;
    linked_count:=linked_count+1;
  end loop;

  return jsonb_build_object(
    'buyers',linked_count,
    'matched_existing',matched_count,
    'created_students',inserted_count,
    'unassigned_class',linked_count
  );
end;
$$;

revoke all on function public.promote_amis_crm_buyers_to_students() from public,anon,authenticated;
grant execute on function public.promote_amis_crm_buyers_to_students() to service_role;

notify pgrst,'reload schema';
commit;
