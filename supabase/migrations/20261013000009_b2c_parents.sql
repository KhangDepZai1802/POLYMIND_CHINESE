begin;
create table public.b2c_parents (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check(char_length(btrim(full_name)) between 1 and 200),
  phone text check(phone ~ '^[0-9]{10}$'),
  zalo text check(char_length(zalo) <= 200),
  source_student_id uuid unique references public.b2c_students(id),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.b2c_student_parents (
  parent_id uuid not null references public.b2c_parents(id) on delete restrict,
  student_id uuid not null references public.b2c_students(id) on delete restrict,
  relationship text not null default 'unknown' check(relationship in ('unknown','father','mother','grandparent','guardian','other')),
  primary key(parent_id,student_id)
);
create index b2c_student_parents_student_idx on public.b2c_student_parents(student_id);
-- Chuyển tên phụ huynh đã có, mỗi hồ sơ học viên một hồ sơ phụ huynh ban đầu.
-- Không tự gộp theo tên, không suy đoán SĐT học viên là SĐT phụ huynh.
insert into public.b2c_parents(full_name,source_student_id)
select btrim(guardian_name),id from public.b2c_students
where nullif(btrim(guardian_name),'') is not null;
insert into public.b2c_student_parents(parent_id,student_id)
select id,source_student_id from public.b2c_parents where source_student_id is not null;
alter table public.b2c_parents enable row level security;
alter table public.b2c_student_parents enable row level security;
create policy b2c_parents_manager on public.b2c_parents for all to authenticated
  using(app.is_manager()) with check(app.is_manager());
create policy b2c_student_parents_manager on public.b2c_student_parents for all to authenticated
  using(app.is_manager()) with check(app.is_manager());
revoke all on public.b2c_parents,public.b2c_student_parents from public,anon,authenticated;
grant select,insert on public.b2c_parents to authenticated;
grant update(full_name,phone,zalo) on public.b2c_parents to authenticated;
grant select,insert,update,delete on public.b2c_student_parents to authenticated;
create trigger b2c_parents_updated_at before update on public.b2c_parents for each row execute function app.set_updated_at();

create function public.save_b2c_parent(p_id uuid,p_name text,p_phone text,p_zalo text,p_student_codes text[],p_relationship text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_codes text[]; v_students uuid[];
begin
  if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý B2C' using errcode='42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 200 then raise exception 'Vui lòng nhập tên phụ huynh' using errcode='22023'; end if;
  if nullif(btrim(p_phone),'') is not null and btrim(p_phone) !~ '^[0-9]{10}$' then raise exception 'SĐT phải có 10 chữ số' using errcode='22023'; end if;
  if char_length(p_zalo)>200 or p_relationship is null or p_relationship not in ('unknown','father','mother','grandparent','guardian','other') then raise exception 'Thông tin phụ huynh không hợp lệ' using errcode='22023'; end if;
  select coalesce(array_agg(distinct upper(btrim(code))),'{}'::text[]) into v_codes from unnest(p_student_codes) code where btrim(code)<>'';
  select coalesce(array_agg(id),'{}'::uuid[]) into v_students from public.b2c_students where code=any(v_codes);
  if cardinality(v_students)<>cardinality(v_codes) then raise exception 'Có mã học viên không tồn tại hoặc không có quyền truy cập' using errcode='22023'; end if;
  if p_id is null then
    insert into public.b2c_parents(full_name,phone,zalo) values(btrim(p_name),nullif(btrim(p_phone),''),nullif(btrim(p_zalo),'')) returning id into v_id;
  else
    update public.b2c_parents set full_name=btrim(p_name),phone=nullif(btrim(p_phone),''),zalo=nullif(btrim(p_zalo),'') where id=p_id returning id into v_id;
    if not found then raise exception 'Không tìm thấy phụ huynh' using errcode='P0002'; end if;
  end if;
  delete from public.b2c_student_parents where parent_id=v_id and not(student_id=any(v_students));
  insert into public.b2c_student_parents(parent_id,student_id,relationship)
  select v_id,student_id,p_relationship from unnest(v_students) student_id
  on conflict(parent_id,student_id) do update set relationship=excluded.relationship;
  return v_id;
end;
$$;
revoke all on function public.save_b2c_parent(uuid,text,text,text,text[],text) from public,anon;
grant execute on function public.save_b2c_parent(uuid,text,text,text,text[],text) to authenticated;
notify pgrst,'reload schema';
create function public.get_b2c_parents_page(p_query text default '',p_page integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb; v_pattern text;
begin
  if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền quản lý B2C' using errcode='42501'; end if;
  if p_page is null or p_page<0 or p_page>1000000 or char_length(p_query)>200 then raise exception 'Bộ lọc không hợp lệ' using errcode='22023'; end if;
  v_pattern:='%'||replace(replace(replace(btrim(coalesce(p_query,'')),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
  with filtered as (
    select p.* from public.b2c_parents p where p.full_name ilike v_pattern or p.phone ilike v_pattern
      or exists(select 1 from public.b2c_student_parents l join public.b2c_students s on s.id=l.student_id where l.parent_id=p.id and (s.full_name ilike v_pattern or s.code ilike v_pattern))
  ), page_rows as (select * from filtered order by full_name,id limit 50 offset p_page::bigint*50)
  select jsonb_build_object('total',(select count(*) from filtered),'parents',coalesce((select jsonb_agg(
    jsonb_build_object('id',p.id,'full_name',p.full_name,'phone',p.phone,'zalo',p.zalo,'children',coalesce((
      select jsonb_agg(jsonb_build_object('code',s.code,'full_name',s.full_name,'relationship',l.relationship) order by s.full_name,s.id)
      from public.b2c_student_parents l join public.b2c_students s on s.id=l.student_id where l.parent_id=p.id
    ),'[]'::jsonb)) order by p.full_name,p.id) from page_rows p),'[]'::jsonb)) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_b2c_parents_page(text,integer) from public,anon;
grant execute on function public.get_b2c_parents_page(text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
