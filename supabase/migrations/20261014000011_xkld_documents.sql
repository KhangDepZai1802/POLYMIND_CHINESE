-- User-authorized XKLĐ documents. No legal checklist is inferred or seeded.
create table public.xkld_document_requirements (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 market_id uuid not null references public.xkld_markets(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 200),
 is_required boolean not null default true, expects_expiry boolean not null default false,
 is_active boolean not null default true, sort_order integer not null default 0 check(sort_order between 0 and 10000),
 updated_at timestamptz not null default clock_timestamp(), updated_by uuid not null references public.profiles(id)
);
create unique index xkld_requirement_name on public.xkld_document_requirements(market_id,lower(btrim(name)));
create table public.xkld_candidate_documents (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references public.xkld_candidates(id) on delete restrict,
 requirement_id uuid not null references public.xkld_document_requirements(id) on delete restrict,
 submitted_on date check(submitted_on >= date '1900-01-01'),
 expires_on date check(expires_on >= date '1900-01-01'), note text not null default '' check(length(note)<=2000),
 updated_at timestamptz not null default clock_timestamp(), updated_by uuid not null references public.profiles(id),
 unique(candidate_id,requirement_id)
);
create table public.xkld_document_files (
 id uuid primary key, request_id uuid not null unique,
 document_id uuid not null references public.xkld_candidate_documents(id) on delete restrict,
 file_name text not null check(length(file_name) between 1 and 200 and file_name !~ '[\\/[:cntrl:]]'),
 storage_path text not null unique, mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg')),
 size_bytes bigint not null check(size_bytes between 1 and 10485760),
 state text not null default 'pending' check(state in ('pending','ready','cancelled')),
 uploaded_by uuid not null references public.profiles(id), uploaded_at timestamptz not null default clock_timestamp()
);
create index xkld_documents_candidate on public.xkld_candidate_documents(candidate_id);
create index xkld_files_document on public.xkld_document_files(document_id,uploaded_at desc);
alter table public.xkld_document_requirements enable row level security;
alter table public.xkld_candidate_documents enable row level security;
alter table public.xkld_document_files enable row level security;
revoke all on public.xkld_document_requirements,public.xkld_candidate_documents,public.xkld_document_files from anon,authenticated;
grant select on public.xkld_document_requirements,public.xkld_candidate_documents,public.xkld_document_files to authenticated;
create policy xkld_requirements_read on public.xkld_document_requirements for select to authenticated using(app.can_read_xkld_candidates());
create policy xkld_documents_read on public.xkld_candidate_documents for select to authenticated using(app.can_read_xkld_candidates());
create policy xkld_files_read on public.xkld_document_files for select to authenticated using(app.can_read_xkld_candidates() and (state='ready' or (uploaded_by=auth.uid() and app.can_edit_xkld_candidates())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('xkld-documents','xkld-documents',false,10485760,array['application/pdf','image/png','image/jpeg']);
create policy xkld_storage_insert on storage.objects for insert to authenticated with check(
 bucket_id='xkld-documents' and app.can_edit_xkld_candidates() and exists(
 select 1 from public.xkld_document_files f where f.storage_path=name and f.state='pending' and f.uploaded_by=auth.uid()));
create policy xkld_storage_read on storage.objects for select to authenticated using(
 bucket_id='xkld-documents' and app.can_read_xkld_candidates() and exists(
 select 1 from public.xkld_document_files f where f.storage_path=name and (f.state='ready' or (f.state in ('pending','cancelled') and f.uploaded_by=auth.uid() and app.can_edit_xkld_candidates()))));
create policy xkld_storage_cleanup on storage.objects for delete to authenticated using(
 bucket_id='xkld-documents' and app.can_edit_xkld_candidates() and exists(
 select 1 from public.xkld_document_files f where f.storage_path=name and f.state in ('pending','cancelled') and f.uploaded_by=auth.uid()));

-- All writes through one guarded RPC; the caller cannot set actor, path, or bypass concurrency.
create function public.xkld_documents_command(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.xkld_document_requirements; d public.xkld_candidate_documents; f public.xkld_document_files;
 v_id uuid; v_request uuid; v_candidate uuid; v_requirement uuid; v_path text; v_ext text; v_page integer;
begin
 if not app.can_read_xkld_candidates() then raise exception 'Không có quyền xem hồ sơ.' using errcode='42501'; end if;
 if p_action in ('checklists','documents') then
  v_page:=coalesce((p_data->>'page')::integer,0);
  if v_page<0 or v_page>1000000 then raise exception 'Trang không hợp lệ.'; end if;
 end if;
 if p_action='checklists' then
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order,x.name) from (select * from public.xkld_document_requirements where market_id=(p_data->>'market_id')::uuid order by sort_order,name,id limit 25 offset v_page*25) x),'[]'::jsonb);
 elsif p_action='documents' then
  v_candidate:=(p_data->>'candidate_id')::uuid;
  if not exists(select 1 from public.xkld_candidates where id=v_candidate) then raise exception 'Không tìm thấy ứng viên.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('requirement',to_jsonb(r1),'document',to_jsonb(d1),'file_count',(select count(*) from public.xkld_document_files f1 where f1.document_id=d1.id and f1.state='ready')) order by r1.sort_order,r1.name)
   from (select r2.* from public.xkld_document_requirements r2 where r2.market_id=(p_data->>'market_id')::uuid and (r2.is_active or exists(select 1 from public.xkld_candidate_documents d2 where d2.requirement_id=r2.id and d2.candidate_id=v_candidate)) order by r2.sort_order,r2.name,r2.id limit 25 offset v_page*25) r1 left join public.xkld_candidate_documents d1 on d1.requirement_id=r1.id and d1.candidate_id=v_candidate
   where r1.market_id=(p_data->>'market_id')::uuid and (r1.is_active or d1.id is not null)),'[]'::jsonb);
 elsif p_action='files' then
  v_page:=coalesce((p_data->>'page')::integer,0);
  if v_page<0 or v_page>1000000 then raise exception 'Trang không hợp lệ.'; end if;
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,file_name,mime_type,size_bytes,uploaded_at,uploaded_by from public.xkld_document_files where document_id=(p_data->>'document_id')::uuid and state='ready' order by uploaded_at desc,id limit 20 offset v_page*20) x),'[]'::jsonb),
   'total',(select count(*) from public.xkld_document_files where document_id=(p_data->>'document_id')::uuid and state='ready'));
 elsif p_action='download' then
  select * into f from public.xkld_document_files where id=(p_data->>'id')::uuid and state='ready';
  if f.id is null then raise exception 'Không tìm thấy tệp.'; end if;
  return to_jsonb(f);
 end if;
 if not app.can_edit_xkld_candidates() then raise exception 'Không có quyền sửa hồ sơ.' using errcode='42501'; end if;
 if p_action='upload_info' then
  select * into f from public.xkld_document_files where id=(p_data->>'id')::uuid and uploaded_by=auth.uid();
  if f.id is null then raise exception 'Không tìm thấy lượt tải tệp.'; end if;
  return to_jsonb(f);
 elsif p_action='save_requirement' then
  v_request:=(p_data->>'request_id')::uuid;
  if v_request is null then raise exception 'Thiếu mã yêu cầu.'; end if;
  if nullif(p_data->>'id','') is null then
   if not exists(select 1 from public.xkld_markets where id=(p_data->>'market_id')::uuid and is_active) then raise exception 'Thị trường không còn sử dụng.'; end if;
   insert into public.xkld_document_requirements(request_id,market_id,name,is_required,expects_expiry,is_active,sort_order,updated_by)
    values(v_request,(p_data->>'market_id')::uuid,btrim(p_data->>'name'),(p_data->>'is_required')::boolean,(p_data->>'expects_expiry')::boolean,true,(p_data->>'sort_order')::int,auth.uid()) on conflict(request_id) do nothing returning * into r;
   if r.id is null then
    select * into r from public.xkld_document_requirements where request_id=v_request;
    if r.updated_by<>auth.uid() or r.market_id<>(p_data->>'market_id')::uuid or r.name<>btrim(p_data->>'name') or r.is_required<>(p_data->>'is_required')::boolean or r.expects_expiry<>(p_data->>'expects_expiry')::boolean or r.sort_order<>(p_data->>'sort_order')::int then raise exception 'Mã yêu cầu đã được sử dụng.'; end if;
   end if;
  else
   update public.xkld_document_requirements set name=btrim(p_data->>'name'),is_required=(p_data->>'is_required')::boolean,expects_expiry=(p_data->>'expects_expiry')::boolean,is_active=(p_data->>'is_active')::boolean,sort_order=(p_data->>'sort_order')::int,updated_at=clock_timestamp(),updated_by=auth.uid()
   where id=(p_data->>'id')::uuid and updated_at=(p_data->>'expected_updated_at')::timestamptz returning * into r;
   if r.id is null then raise exception 'Checklist đã thay đổi. Tải lại trang trước khi sửa.'; end if;
  end if;
  return to_jsonb(r);
 elsif p_action in ('save_document','prepare') then
  v_candidate:=(p_data->>'candidate_id')::uuid; v_requirement:=(p_data->>'requirement_id')::uuid;
  perform 1 from public.xkld_candidates where id=v_candidate for update;
  if not found then raise exception 'Không tìm thấy ứng viên.'; end if;
  select * into r from public.xkld_document_requirements where id=v_requirement;
  select * into d from public.xkld_candidate_documents where candidate_id=v_candidate and requirement_id=v_requirement for update;
  if r.id is null or (d.id is null and (not r.is_active or not exists(select 1 from public.xkld_markets where id=r.market_id and is_active))) then raise exception 'Checklist hoặc thị trường không còn sử dụng.'; end if;
  if p_action='save_document' then
   if nullif(p_data->>'submitted_on','')::date > (now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Ngày nộp không được ở tương lai.'; end if;
   if d.id is not null and d.updated_at is distinct from (p_data->>'expected_updated_at')::timestamptz then
    if d.submitted_on is not distinct from nullif(p_data->>'submitted_on','')::date and d.expires_on is not distinct from nullif(p_data->>'expires_on','')::date and d.note=coalesce(p_data->>'note','') then return to_jsonb(d); end if;
    raise exception 'Hồ sơ đã thay đổi. Tải lại trang trước khi sửa.';
   end if;
   insert into public.xkld_candidate_documents(candidate_id,requirement_id,submitted_on,expires_on,note,updated_by)
   values(v_candidate,v_requirement,nullif(p_data->>'submitted_on','')::date,nullif(p_data->>'expires_on','')::date,coalesce(p_data->>'note',''),auth.uid())
   on conflict(candidate_id,requirement_id) do update set submitted_on=excluded.submitted_on,expires_on=excluded.expires_on,note=excluded.note,updated_at=clock_timestamp(),updated_by=auth.uid() returning * into d;
   return to_jsonb(d);
  end if;
  if d.id is null then
   insert into public.xkld_candidate_documents(candidate_id,requirement_id,updated_by) values(v_candidate,v_requirement,auth.uid()) returning * into d;
  end if;
  v_request:=(p_data->>'request_id')::uuid;
  if v_request is null then raise exception 'Thiếu mã yêu cầu.'; end if;
  v_ext:=case p_data->>'mime_type' when 'application/pdf' then 'pdf' when 'image/png' then 'png' when 'image/jpeg' then 'jpg' else null end;
  if v_ext is null or lower(p_data->>'file_name') !~ (case v_ext when 'jpg' then '\.(jpg|jpeg)$' else '\.'||v_ext||'$' end) then raise exception 'Chỉ nhận PDF, PNG, JPG đúng định dạng.'; end if;
  v_id:=gen_random_uuid(); v_path:=auth.uid()::text||'/'||v_candidate::text||'/'||d.id::text||'/'||v_id::text||'.'||v_ext;
  insert into public.xkld_document_files(id,request_id,document_id,file_name,storage_path,mime_type,size_bytes,uploaded_by)
   values(v_id,v_request,d.id,p_data->>'file_name',v_path,p_data->>'mime_type',(p_data->>'size_bytes')::bigint,auth.uid()) on conflict(request_id) do nothing returning * into f;
  if f.id is null then
   select * into f from public.xkld_document_files where request_id=v_request;
   if f.document_id<>d.id or f.uploaded_by<>auth.uid() or f.file_name<>p_data->>'file_name' or f.mime_type<>p_data->>'mime_type' or f.size_bytes<>(p_data->>'size_bytes')::bigint then raise exception 'Mã tải tệp đã được sử dụng.'; end if;
  end if;
  return to_jsonb(f);
 elsif p_action in ('finalize','cancel') then
  select * into f from public.xkld_document_files where id=(p_data->>'id')::uuid for update;
  if f.id is null or f.uploaded_by<>auth.uid() then raise exception 'Không có quyền cập nhật tệp.' using errcode='42501'; end if;
  if p_action='cancel' then
   if f.state='ready' then raise exception 'Không được xóa tệp lịch sử.'; end if;
   update public.xkld_document_files set state='cancelled' where id=f.id;
  else
   if f.state='cancelled' then raise exception 'Lượt tải đã bị hủy.'; end if;
   if not exists(select 1 from storage.objects o where o.bucket_id='xkld-documents' and o.name=f.storage_path and (o.metadata->>'size')::bigint=f.size_bytes and o.metadata->>'mimetype'=f.mime_type) then raise exception 'Tệp chưa tải đủ hoặc không đúng định dạng/kích thước.'; end if;
   update public.xkld_document_files set state='ready' where id=f.id;
  end if;
  return jsonb_build_object('id',f.id);
 end if;
 raise exception 'Thao tác không hợp lệ.';
end $$;
revoke all on function public.xkld_documents_command(text,jsonb) from public,anon;
grant execute on function public.xkld_documents_command(text,jsonb) to authenticated;
