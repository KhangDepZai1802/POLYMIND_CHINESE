-- B2C homework is separate from the legacy classes/students exercise engine.
-- Account links are explicit administrator decisions; no name/email backfill.
create table public.b2c_student_accounts (
  student_id uuid primary key references public.b2c_students(id) on delete restrict,
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  linked_by uuid not null references auth.users(id) on delete restrict,
  linked_at timestamptz not null default clock_timestamp()
);
create table public.b2c_homework_uploads (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.b2c_classes(id) on delete restrict,
  homework_id uuid,
  kind text not null check(kind in ('assignment','submission')),
  actor_id uuid not null references auth.users(id) on delete restrict,
  object_path text not null unique,
  file_name text not null check(char_length(file_name) between 1 and 180),
  mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check(size_bytes between 1 and 20971520),
  request_id uuid not null unique,
  request_payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '30 minutes',
  attached_at timestamptz,
  check((kind='assignment' and homework_id is null and mime_type='application/pdf')
    or (kind='submission' and homework_id is not null))
);
create table public.b2c_homework (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.b2c_classes(id) on delete restrict,
  title text not null check(char_length(btrim(title)) between 1 and 200),
  description text not null default '' check(char_length(description)<=4000),
  due_at timestamptz not null check(isfinite(due_at)),
  upload_id uuid not null unique references public.b2c_homework_uploads(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,
  request_id uuid not null unique,
  request_payload jsonb not null
);
alter table public.b2c_homework_uploads add constraint b2c_homework_upload_homework_fk
  foreign key(homework_id) references public.b2c_homework(id) on delete restrict;
create table public.b2c_homework_submissions (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.b2c_homework(id) on delete restrict,
  enrollment_id uuid not null references public.b2c_enrollments(id) on delete restrict,
  upload_id uuid not null unique references public.b2c_homework_uploads(id) on delete restrict,
  revision integer not null check(revision>0),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default clock_timestamp(),
  due_at_snapshot timestamptz not null,
  request_id uuid not null unique,
  request_payload jsonb not null,
  unique(homework_id,enrollment_id,revision)
);
create index b2c_homework_class_page on public.b2c_homework(class_id,created_at desc,id) where archived_at is null;
create index b2c_homework_submission_latest on public.b2c_homework_submissions(homework_id,enrollment_id,revision desc);
create index b2c_homework_upload_actor on public.b2c_homework_uploads(actor_id,created_at desc);
alter table public.b2c_student_accounts enable row level security;
alter table public.b2c_homework_uploads enable row level security;
alter table public.b2c_homework enable row level security;
alter table public.b2c_homework_submissions enable row level security;
revoke all on public.b2c_student_accounts,public.b2c_homework_uploads,public.b2c_homework,public.b2c_homework_submissions from public,anon,authenticated;
grant select on public.b2c_student_accounts,public.b2c_homework_uploads,public.b2c_homework,public.b2c_homework_submissions to authenticated;

create function app.my_b2c_student_id() returns uuid language sql stable security definer set search_path='' as $$
  select a.student_id from public.b2c_student_accounts a
  join public.profiles p on p.id=a.user_id and p.role='student' and p.is_active
  join public.b2c_students s on s.id=a.student_id and s.archived_at is null
  where a.user_id=auth.uid();
$$;
create function app.b2c_homework_enrollment(p_class_id uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select e.id from public.b2c_enrollments e
  where e.class_id=p_class_id and e.student_id=app.my_b2c_student_id()
    and e.status in ('studying','on_hold','awaiting_renewal','overdue')
  order by e.created_at,e.id limit 1;
$$;
create function app.can_read_b2c_homework_class(p_class_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.b2c_classes where id=p_class_id)
    and coalesce(app.has_b2c_permission('view_classes',p_class_id),false)
    and coalesce(app.has_b2c_permission('view_assessments',p_class_id),false);
$$;
create function app.can_manage_b2c_homework_class(p_class_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select app.can_read_b2c_homework_class(p_class_id)
    and coalesce(app.has_b2c_permission('grade_assessments',p_class_id),false);
$$;
create function app.can_read_b2c_homework(p_homework_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.b2c_homework h where h.id=p_homework_id and
    (app.can_read_b2c_homework_class(h.class_id) or
      (h.archived_at is null and app.b2c_homework_enrollment(h.class_id) is not null)));
$$;
create function app.can_submit_b2c_homework(p_homework_id uuid) returns boolean
language sql volatile security definer set search_path='' as $$
  select exists(select 1 from public.b2c_homework h where h.id=p_homework_id
    and h.archived_at is null and clock_timestamp()<h.due_at
    and app.b2c_homework_enrollment(h.class_id) is not null);
$$;
create function app.can_read_b2c_homework_submission(p_submission_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.b2c_homework_submissions x
    join public.b2c_homework h on h.id=x.homework_id
    join public.b2c_enrollments e on e.id=x.enrollment_id
    where x.id=p_submission_id and (app.can_read_b2c_homework_class(h.class_id)
      or (app.can_read_b2c_homework(h.id) and e.student_id=app.my_b2c_student_id())));
$$;
create policy b2c_student_accounts_read on public.b2c_student_accounts for select to authenticated
  using(app.is_super_admin() or (user_id=auth.uid() and app.my_b2c_student_id()=student_id));
create policy b2c_homework_read on public.b2c_homework for select to authenticated using(app.can_read_b2c_homework(id));
create policy b2c_homework_submission_read on public.b2c_homework_submissions for select to authenticated
  using(app.can_read_b2c_homework_submission(id));

create function public.read_b2c_student_account(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if not app.is_super_admin() then raise exception 'Chỉ quản trị viên được quản lý tài khoản học viên.' using errcode='42501'; end if;
  select jsonb_build_object('student_id',s.id,'full_name',s.full_name,'phone',s.phone,'email',s.email,
    'account',case when p.id is null then null else jsonb_build_object('id',p.id,'username',p.username,'email',p.email,'full_name',p.full_name) end)
  into v_result from public.b2c_students s left join public.b2c_student_accounts a on a.student_id=s.id
  left join public.profiles p on p.id=a.user_id where s.id=p_student_id and s.archived_at is null;
  if v_result is null then raise exception 'Không tìm thấy học viên đang hoạt động.' using errcode='22023'; end if;
  return v_result;
end;
$$;
create function public.find_b2c_student_login(p_login text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_count integer;
begin
  if not app.is_super_admin() then raise exception 'Chỉ quản trị viên được quản lý tài khoản học viên.' using errcode='42501'; end if;
  if p_login is null or char_length(btrim(p_login)) not between 3 and 254 then raise exception 'Nhập chính xác tên đăng nhập hoặc email.' using errcode='22023'; end if;
  select count(*),jsonb_agg(jsonb_build_object('id',id,'username',username,'email',email,'full_name',full_name))->0
  into v_count,v_result from public.profiles where role='student' and is_active
    and (lower(username)=lower(btrim(p_login)) or lower(email)=lower(btrim(p_login)));
  if v_count>1 then raise exception 'Email có nhiều tài khoản. Hãy dùng tên đăng nhập chính xác.' using errcode='22023'; end if;
  return v_result;
end;
$$;
create function public.link_b2c_student_account(p_student_id uuid,p_user_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_existing uuid;
begin
  if not app.is_super_admin() then raise exception 'Chỉ quản trị viên được quản lý tài khoản học viên.' using errcode='42501'; end if;
  perform 1 from public.b2c_students where id=p_student_id and archived_at is null for update;
  if not found then raise exception 'Không tìm thấy học viên đang hoạt động.' using errcode='22023'; end if;
  perform 1 from public.profiles where id=p_user_id and role='student' and is_active for update;
  if not found then raise exception 'Chỉ liên kết tài khoản học viên đang hoạt động.' using errcode='22023'; end if;
  select user_id into v_existing from public.b2c_student_accounts where student_id=p_student_id;
  if found then
    if v_existing=p_user_id then return p_user_id; end if;
    raise exception 'Học viên đã có tài khoản liên kết. Vui lòng tải lại.' using errcode='40001';
  end if;
  if exists(select 1 from public.b2c_student_accounts where user_id=p_user_id) then
    raise exception 'Tài khoản đã liên kết với học viên B2C khác.' using errcode='22023';
  end if;
  insert into public.b2c_student_accounts(student_id,user_id,linked_by) values(p_student_id,p_user_id,auth.uid());
  perform app.write_audit('b2c.student.account_link','b2c_student',p_student_id,null,jsonb_build_object('user_id',p_user_id));
  return p_user_id;
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('b2c-homework-files','b2c-homework-files',false,20971520,array['application/pdf','image/jpeg','image/png']);

create function public.prepare_b2c_homework_upload(p_class_id uuid,p_homework_id uuid,p_kind text,
  p_file_name text,p_mime_type text,p_size_bytes bigint,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_upload public.b2c_homework_uploads%rowtype; v_payload jsonb; v_id uuid:=gen_random_uuid(); v_ext text;
begin
  if p_kind='assignment' then
    if not app.can_manage_b2c_homework_class(p_class_id) then raise exception 'Không có quyền giao bài tập cho lớp.' using errcode='42501'; end if;
  elsif p_kind='submission' then
    if not app.can_submit_b2c_homework(p_homework_id)
      or not exists(select 1 from public.b2c_homework where id=p_homework_id and class_id=p_class_id) then
      raise exception 'Bạn không thể nộp bài cho lớp này hoặc đã hết hạn.' using errcode='42501';
    end if;
  else raise exception 'Loại tệp không hợp lệ.' using errcode='22023'; end if;
  if p_request_id is null or p_file_name is null or char_length(btrim(p_file_name)) not between 1 and 180
    or p_file_name ~ '[[:cntrl:]]' or strpos(p_file_name,'/')>0 or strpos(p_file_name,chr(92))>0
    or p_size_bytes is null or p_size_bytes not between 1 and 20971520
    or p_mime_type is null or p_mime_type not in ('application/pdf','image/jpeg','image/png')
    or (p_kind='assignment' and (p_homework_id is not null or p_mime_type<>'application/pdf')) then
    raise exception 'Chọn tệp hợp lệ tối đa 20 MB; đề bài phải là PDF.' using errcode='22023';
  end if;
  v_ext:=case p_mime_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' else 'png' end;
  if (v_ext='jpg' and lower(btrim(p_file_name)) !~ '\.(jpg|jpeg)$')
    or (v_ext<>'jpg' and lower(btrim(p_file_name)) !~ ('\.'||v_ext||'$')) then
    raise exception 'Đuôi tệp không khớp định dạng đã chọn.' using errcode='22023';
  end if;
  v_payload:=jsonb_build_object('class_id',p_class_id,'homework_id',p_homework_id,'kind',p_kind,
    'file_name',btrim(p_file_name),'mime_type',p_mime_type,'size_bytes',p_size_bytes,'actor_id',auth.uid());
  perform pg_advisory_xact_lock(hashtextextended('b2c-homework-upload:'||p_request_id::text,0));
  select * into v_upload from public.b2c_homework_uploads where request_id=p_request_id;
  if found then
    if v_upload.request_payload is distinct from v_payload then raise exception 'Mã tải lên đã dùng cho nội dung khác.' using errcode='22023'; end if;
    if v_upload.attached_at is null and v_upload.expires_at<=clock_timestamp() then raise exception 'Lượt tải lên đã hết hạn. Hãy chọn lại tệp.' using errcode='22023'; end if;
  else
    insert into public.b2c_homework_uploads(id,class_id,homework_id,kind,actor_id,object_path,file_name,mime_type,size_bytes,request_id,request_payload)
    values(v_id,p_class_id,p_homework_id,p_kind,auth.uid(),p_class_id::text||'/'||auth.uid()::text||'/'||v_id::text||'.'||v_ext,
      btrim(p_file_name),p_mime_type,p_size_bytes,p_request_id,v_payload) returning * into v_upload;
  end if;
  return jsonb_build_object('id',v_upload.id,'object_path',v_upload.object_path,'bucket','b2c-homework-files');
end;
$$;

create function app.can_read_b2c_homework_upload(p_upload_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.b2c_homework_uploads u where u.id=p_upload_id and u.actor_id=auth.uid() and app.is_active()
    and ((u.kind='assignment' and app.can_manage_b2c_homework_class(u.class_id))
      or (u.kind='submission' and app.can_read_b2c_homework(u.homework_id)
        and app.b2c_homework_enrollment(u.class_id) is not null)));
$$;
create policy b2c_homework_upload_read on public.b2c_homework_uploads for select to authenticated
  using(app.can_read_b2c_homework_upload(id));
create function app.can_insert_b2c_homework_object(p_name text) returns boolean
language sql volatile security definer set search_path='' as $$
  select exists(select 1 from public.b2c_homework_uploads u where u.object_path=p_name
    and u.actor_id=auth.uid() and u.attached_at is null and u.expires_at>clock_timestamp()
    and ((u.kind='assignment' and app.can_manage_b2c_homework_class(u.class_id))
      or (u.kind='submission' and app.can_submit_b2c_homework(u.homework_id))));
$$;
create function app.can_read_b2c_homework_object(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.b2c_homework_uploads u where u.object_path=p_name and
    (app.can_read_b2c_homework_upload(u.id)
      or exists(select 1 from public.b2c_homework h where h.upload_id=u.id and app.can_read_b2c_homework(h.id))
      or exists(select 1 from public.b2c_homework_submissions s where s.upload_id=u.id and app.can_read_b2c_homework_submission(s.id))));
$$;
create function app.can_delete_b2c_homework_object(p_name text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare u public.b2c_homework_uploads%rowtype;
begin
  -- Serialize cleanup with finalization. After waiting for publication the
  -- ticket must be re-read, so a formerly pending object cannot be deleted.
  select * into u from public.b2c_homework_uploads where object_path=p_name
    and actor_id=auth.uid() and app.is_active() for update;
  return found and u.attached_at is null;
end;
$$;
create policy b2c_homework_file_insert on storage.objects for insert to authenticated
  with check(bucket_id='b2c-homework-files' and app.can_insert_b2c_homework_object(name));
create policy b2c_homework_file_read on storage.objects for select to authenticated
  using(bucket_id='b2c-homework-files' and app.can_read_b2c_homework_object(name));
create policy b2c_homework_file_cleanup on storage.objects for delete to authenticated
  using(bucket_id='b2c-homework-files' and app.can_delete_b2c_homework_object(name));

create function app.check_b2c_homework_upload(p_upload_id uuid,p_kind text) returns public.b2c_homework_uploads
language plpgsql security definer set search_path='' as $$
declare u public.b2c_homework_uploads%rowtype;
begin
  select * into u from public.b2c_homework_uploads where id=p_upload_id for update;
  if not found or u.actor_id is distinct from auth.uid() or u.kind<>p_kind
    or u.attached_at is not null or u.expires_at<=clock_timestamp() then
    raise exception 'Tệp tải lên không hợp lệ, đã dùng hoặc đã hết hạn.' using errcode='22023';
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='b2c-homework-files' and o.name=u.object_path
    and o.metadata->>'mimetype'=u.mime_type and o.metadata->>'size' ~ '^[0-9]+$'
    and (o.metadata->>'size')::numeric=u.size_bytes) then
    raise exception 'Chưa tìm thấy tệp đầy đủ hoặc định dạng/kích thước không khớp.' using errcode='22023';
  end if;
  return u;
end;
$$;
revoke all on function app.check_b2c_homework_upload(uuid,text) from public,anon,authenticated;

create function public.create_b2c_homework(p_upload_id uuid,p_title text,p_description text,p_due_at timestamptz,p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare u public.b2c_homework_uploads%rowtype; h public.b2c_homework%rowtype; v_payload jsonb; v_id uuid; v_class uuid;
begin
  select class_id into v_class from public.b2c_homework_uploads where id=p_upload_id and actor_id=auth.uid();
  if not app.can_manage_b2c_homework_class(v_class) then raise exception 'Không có quyền giao bài tập cho lớp.' using errcode='42501'; end if;
  if p_request_id is null or p_title is null or char_length(btrim(p_title)) not between 1 and 200
    or char_length(coalesce(p_description,''))>4000 or p_due_at is null or not isfinite(p_due_at) then
    raise exception 'Nhập tên bài tập, nội dung và hạn nộp hợp lệ.' using errcode='22023';
  end if;
  v_payload:=jsonb_build_object('upload_id',p_upload_id,'title',btrim(p_title),'description',coalesce(p_description,''),
    'due_at',p_due_at,'actor_id',auth.uid());
  perform pg_advisory_xact_lock(hashtextextended('b2c-homework-create:'||p_request_id::text,0));
  select * into h from public.b2c_homework where request_id=p_request_id;
  if found then
    if h.request_payload is distinct from v_payload then raise exception 'Mã yêu cầu đã dùng cho nội dung khác.' using errcode='22023'; end if;
    return h.id;
  end if;
  if p_due_at<=clock_timestamp() then raise exception 'Hạn nộp phải ở thời điểm tương lai.' using errcode='22023'; end if;
  u:=app.check_b2c_homework_upload(p_upload_id,'assignment');
  if not app.can_manage_b2c_homework_class(u.class_id) then raise exception 'Không có quyền giao bài tập cho lớp.' using errcode='42501'; end if;
  insert into public.b2c_homework(class_id,title,description,due_at,upload_id,created_by,updated_by,request_id,request_payload)
  values(u.class_id,btrim(p_title),coalesce(p_description,''),p_due_at,u.id,auth.uid(),auth.uid(),p_request_id,v_payload) returning id into v_id;
  update public.b2c_homework_uploads set attached_at=clock_timestamp() where id=u.id;
  perform app.write_audit('b2c.homework.create','b2c_homework',v_id,null,
    jsonb_build_object('class_id',u.class_id,'title',btrim(p_title),'due_at',p_due_at,'upload_id',u.id));
  return v_id;
end;
$$;
create function public.update_b2c_homework(p_id uuid,p_title text,p_description text,p_due_at timestamptz,p_expected_updated_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare h public.b2c_homework%rowtype;
begin
  select * into h from public.b2c_homework where id=p_id for update;
  if not found or not app.can_manage_b2c_homework_class(h.class_id) then raise exception 'Không có quyền sửa bài tập.' using errcode='42501'; end if;
  if h.archived_at is not null or h.updated_at is distinct from p_expected_updated_at then
    raise exception 'Bài tập đã thay đổi. Vui lòng tải lại.' using errcode='40001'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 200 or char_length(coalesce(p_description,''))>4000
    or p_due_at is null or not isfinite(p_due_at) or p_due_at<=clock_timestamp() then
    raise exception 'Nhập tên bài tập và hạn nộp ở thời điểm tương lai.' using errcode='22023'; end if;
  update public.b2c_homework set title=btrim(p_title),description=coalesce(p_description,''),due_at=p_due_at,
    updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_id;
  perform app.write_audit('b2c.homework.update','b2c_homework',p_id,
    jsonb_build_object('title',h.title,'description',h.description,'due_at',h.due_at),
    jsonb_build_object('title',btrim(p_title),'description',coalesce(p_description,''),'due_at',p_due_at));
  return p_id;
end;
$$;
create function public.archive_b2c_homework(p_id uuid,p_expected_updated_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare h public.b2c_homework%rowtype;
begin
  select * into h from public.b2c_homework where id=p_id for update;
  if not found or not app.can_manage_b2c_homework_class(h.class_id) then raise exception 'Không có quyền lưu trữ bài tập.' using errcode='42501'; end if;
  if h.archived_at is not null then return p_id; end if;
  if h.updated_at is distinct from p_expected_updated_at then raise exception 'Bài tập đã thay đổi. Vui lòng tải lại.' using errcode='40001'; end if;
  update public.b2c_homework set archived_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=auth.uid() where id=p_id;
  perform app.write_audit('b2c.homework.archive','b2c_homework',p_id,jsonb_build_object('title',h.title),jsonb_build_object('archived',true));
  return p_id;
end;
$$;
create function public.submit_b2c_homework(p_homework_id uuid,p_upload_id uuid,p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare h public.b2c_homework%rowtype; u public.b2c_homework_uploads%rowtype; s public.b2c_homework_submissions%rowtype;
  v_enrollment uuid; v_revision integer; v_id uuid; v_payload jsonb;
begin
  if p_request_id is null then raise exception 'Thiếu mã yêu cầu nộp bài.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('b2c-homework-submit:'||p_request_id::text,0));
  select * into h from public.b2c_homework where id=p_homework_id for update;
  if not found or h.archived_at is not null or app.b2c_homework_enrollment(h.class_id) is null then
    raise exception 'Bạn không có quyền nộp bài tập này.' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('homework_id',p_homework_id,'upload_id',p_upload_id,'actor_id',auth.uid());
  select * into s from public.b2c_homework_submissions where request_id=p_request_id;
  if found then
    if s.request_payload is distinct from v_payload then raise exception 'Mã yêu cầu đã dùng cho nội dung khác.' using errcode='22023'; end if;
    return s.id;
  end if;
  if clock_timestamp()>=h.due_at then raise exception 'Đã hết hạn nộp bài.' using errcode='22023'; end if;
  v_enrollment:=app.b2c_homework_enrollment(h.class_id);
  perform 1 from public.b2c_enrollments where id=v_enrollment for update;
  if app.b2c_homework_enrollment(h.class_id) is distinct from v_enrollment then raise exception 'Ghi danh đã thay đổi. Vui lòng tải lại.' using errcode='40001'; end if;
  u:=app.check_b2c_homework_upload(p_upload_id,'submission');
  if u.homework_id<>h.id or u.class_id<>h.class_id then raise exception 'Tệp tải lên không thuộc bài tập này.' using errcode='22023'; end if;
  -- Recheck after acquiring every lock; an upload begun before the deadline
  -- cannot bypass it by finishing or waiting for another transaction later.
  if clock_timestamp()>=h.due_at then raise exception 'Đã hết hạn nộp bài.' using errcode='22023'; end if;
  select coalesce(max(revision),0)+1 into v_revision from public.b2c_homework_submissions where homework_id=h.id and enrollment_id=v_enrollment;
  insert into public.b2c_homework_submissions(homework_id,enrollment_id,upload_id,revision,submitted_by,due_at_snapshot,request_id,request_payload)
  values(h.id,v_enrollment,u.id,v_revision,auth.uid(),h.due_at,p_request_id,v_payload) returning id into v_id;
  update public.b2c_homework_uploads set attached_at=clock_timestamp() where id=u.id;
  perform app.write_audit('b2c.homework.submit','b2c_homework_submission',v_id,null,
    jsonb_build_object('homework_id',h.id,'enrollment_id',v_enrollment,'revision',v_revision));
  return v_id;
end;
$$;

create function app.b2c_homework_submission_json(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',s.id,'revision',s.revision,'file_name',u.file_name,'mime_type',u.mime_type,
    'size_bytes',u.size_bytes,'submitted_at',s.submitted_at,'due_at_snapshot',s.due_at_snapshot)
  from public.b2c_homework_submissions s join public.b2c_homework_uploads u on u.id=s.upload_id where s.id=p_id;
$$;
revoke all on function app.b2c_homework_submission_json(uuid) from public,anon,authenticated;

create function public.read_b2c_homework_page(p_class_id uuid default null,p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_student uuid:=app.my_b2c_student_id(); v_is_student boolean; v_rows jsonb; v_total bigint; v_classes jsonb;
begin
  if not app.is_active() then raise exception 'Vui lòng đăng nhập bằng tài khoản đang hoạt động.' using errcode='42501'; end if;
  select role='student' into v_is_student from public.profiles where id=auth.uid();
  if p_page is null or p_page not between 0 and 1000000 then raise exception 'Trang không hợp lệ.' using errcode='22023'; end if;
  if p_class_id is not null and not (case when v_is_student then app.b2c_homework_enrollment(p_class_id) is not null
    else app.can_read_b2c_homework_class(p_class_id) end) then raise exception 'Không có quyền xem bài tập lớp này.' using errcode='42501'; end if;
  if not v_is_student and not app.is_manager() and not exists(select 1 from public.b2c_classes c where app.can_read_b2c_homework_class(c.id)) then
    raise exception 'Không có quyền xem bài tập B2C.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name) order by c.name,c.id),'[]') into v_classes
  from public.b2c_classes c where case when v_is_student then app.b2c_homework_enrollment(c.id) is not null else app.can_read_b2c_homework_class(c.id) end;
  with filtered as (
    select h.* from public.b2c_homework h where h.archived_at is null and (p_class_id is null or h.class_id=p_class_id)
      and case when v_is_student then app.b2c_homework_enrollment(h.class_id) is not null else app.can_read_b2c_homework_class(h.class_id) end
  ), page_rows as (
    select h.*,c.name class_name,u.file_name,u.mime_type,u.size_bytes,p.full_name created_by_name
    from (select * from filtered order by created_at desc,id limit 20 offset p_page::bigint*20) h
    join public.b2c_classes c on c.id=h.class_id join public.b2c_homework_uploads u on u.id=h.upload_id
    left join public.profiles p on p.id=h.created_by
  ) select (select count(*) from filtered),coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'class_id',r.class_id,'class_name',r.class_name,'title',r.title,'description',r.description,'due_at',r.due_at,
      'created_at',r.created_at,'updated_at',r.updated_at,'file_name',r.file_name,'mime_type',r.mime_type,'size_bytes',r.size_bytes,
      'created_by_name',r.created_by_name,'can_manage',not v_is_student and app.can_manage_b2c_homework_class(r.class_id),
      'can_submit',v_is_student and app.can_submit_b2c_homework(r.id),
      'student_count',case when v_is_student then null else (select count(*) from public.b2c_enrollments e join public.b2c_students st on st.id=e.student_id
        where e.class_id=r.class_id and ((st.archived_at is null and e.status in ('studying','on_hold','awaiting_renewal','overdue'))
          or exists(select 1 from public.b2c_homework_submissions ss where ss.homework_id=r.id and ss.enrollment_id=e.id))) end,
      'submission_count',case when v_is_student then null else (select count(distinct enrollment_id) from public.b2c_homework_submissions where homework_id=r.id) end,
      'latest_submission',case when v_is_student then app.b2c_homework_submission_json((select ss.id from public.b2c_homework_submissions ss
        join public.b2c_enrollments e on e.id=ss.enrollment_id where ss.homework_id=r.id and e.student_id=v_student
        order by ss.submitted_at desc,ss.id limit 1)) else null end
    ) order by r.created_at desc,r.id) from page_rows r),'[]') into v_total,v_rows;
  return jsonb_build_object('rows',v_rows,'total',v_total,'classes',v_classes,'server_now',clock_timestamp(),
    'linked_student',(select jsonb_build_object('id',id,'full_name',full_name) from public.b2c_students where id=v_student),
    'class',(select jsonb_build_object('id',id,'code',code,'name',name,'program_slug',program_slug,'teacher_name',teacher_name,
      'weekdays_text',weekdays_text,'time_text',time_text,'capacity',capacity,'enrolled_count',enrolled_count,
      'start_date',start_date,'end_date',end_date,'campus',campus,'delivery_mode',delivery_mode,
      'notes',case when v_is_student then null else notes end)
      from public.b2c_classes where id=p_class_id),'schedules','[]'::jsonb);
end;
$$;
create function public.read_b2c_homework_submissions(p_homework_id uuid,p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_class uuid; v_rows jsonb; v_total bigint;
begin
  select class_id into v_class from public.b2c_homework where id=p_homework_id;
  if not app.can_read_b2c_homework_class(v_class) then raise exception 'Không có quyền xem bài nộp của lớp.' using errcode='42501'; end if;
  if p_page is null or p_page not between 0 and 1000000 then raise exception 'Trang không hợp lệ.' using errcode='22023'; end if;
  with roster as (
    select e.id enrollment_id,s.id student_id,s.code student_code,s.full_name,
      exists(select 1 from public.b2c_student_accounts a where a.student_id=s.id) has_account
    from public.b2c_enrollments e join public.b2c_students s on s.id=e.student_id where e.class_id=v_class
      and ((s.archived_at is null and e.status in ('studying','on_hold','awaiting_renewal','overdue'))
        or exists(select 1 from public.b2c_homework_submissions ss where ss.homework_id=p_homework_id and ss.enrollment_id=e.id))
  ), page_rows as (
    select r.*,app.b2c_homework_submission_json((select id from public.b2c_homework_submissions
      where homework_id=p_homework_id and enrollment_id=r.enrollment_id order by revision desc limit 1)) submission
    from (select * from roster order by student_code,enrollment_id limit 20 offset p_page::bigint*20) r
  ) select (select count(*) from roster),coalesce((select jsonb_agg(to_jsonb(r) order by student_code,enrollment_id) from page_rows r),'[]')
  into v_total,v_rows;
  return jsonb_build_object('rows',v_rows,'total',v_total);
end;
$$;
create function public.read_b2c_homework_submission_history(p_homework_id uuid,p_enrollment_id uuid default null,p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_class uuid; v_staff boolean; v_student uuid:=app.my_b2c_student_id(); v_rows jsonb; v_total bigint;
begin
  select class_id into v_class from public.b2c_homework where id=p_homework_id;
  v_staff:=app.can_read_b2c_homework_class(v_class);
  if not v_staff and (v_student is null or not app.can_read_b2c_homework(p_homework_id)) then
    raise exception 'Không có quyền xem lịch sử nộp bài.' using errcode='42501'; end if;
  if p_page is null or p_page not between 0 and 1000000 then raise exception 'Trang không hợp lệ.' using errcode='22023'; end if;
  if p_enrollment_id is not null and not exists(select 1 from public.b2c_enrollments where id=p_enrollment_id
    and class_id=v_class and (v_staff or student_id=v_student)) then raise exception 'Ghi danh không thuộc phạm vi được xem.' using errcode='42501'; end if;
  with filtered as (
    select s.* from public.b2c_homework_submissions s join public.b2c_enrollments e on e.id=s.enrollment_id
    where s.homework_id=p_homework_id and (p_enrollment_id is null or s.enrollment_id=p_enrollment_id)
      and (v_staff or e.student_id=v_student)
  ) select (select count(*) from filtered),coalesce((select jsonb_agg(app.b2c_homework_submission_json(r.id) order by r.submitted_at desc,r.id)
    from (select * from filtered order by submitted_at desc,id limit 20 offset p_page::bigint*20) r),'[]') into v_total,v_rows;
  return jsonb_build_object('rows',v_rows,'total',v_total);
end;
$$;
create function public.read_b2c_homework_file(p_kind text,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_upload uuid; v_result jsonb;
begin
  if p_kind='assignment' then
    if not app.can_read_b2c_homework(p_id) then raise exception 'Không có quyền tải đề bài.' using errcode='42501'; end if;
    select upload_id into v_upload from public.b2c_homework where id=p_id;
  elsif p_kind='submission' then
    if not app.can_read_b2c_homework_submission(p_id) then raise exception 'Không có quyền tải bài nộp.' using errcode='42501'; end if;
    select upload_id into v_upload from public.b2c_homework_submissions where id=p_id;
  elsif p_kind='upload' then
    if not app.can_read_b2c_homework_upload(p_id) then raise exception 'Không có quyền đọc lượt tải lên.' using errcode='42501'; end if;
    v_upload:=p_id;
  else raise exception 'Loại tệp không hợp lệ.' using errcode='22023'; end if;
  select jsonb_build_object('object_path',object_path,'file_name',file_name,'mime_type',mime_type,'size_bytes',size_bytes,'bucket','b2c-homework-files')
  into v_result from public.b2c_homework_uploads where id=v_upload;
  return v_result;
end;
$$;

-- Policy helpers expose booleans/own identity only. Data-producing internals
-- remain private; every public RPC also checks its current caller explicitly.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app' and p.proname in ('my_b2c_student_id','b2c_homework_enrollment','can_read_b2c_homework_class',
      'can_manage_b2c_homework_class','can_read_b2c_homework','can_submit_b2c_homework','can_read_b2c_homework_submission',
      'can_read_b2c_homework_upload','can_insert_b2c_homework_object','can_read_b2c_homework_object','can_delete_b2c_homework_object')
  loop execute format('revoke all on function %s from public,anon',f.signature); execute format('grant execute on function %s to authenticated',f.signature); end loop;
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('read_b2c_student_account','find_b2c_student_login','link_b2c_student_account',
      'prepare_b2c_homework_upload','create_b2c_homework','update_b2c_homework','archive_b2c_homework','submit_b2c_homework',
      'read_b2c_homework_page','read_b2c_homework_submissions','read_b2c_homework_submission_history','read_b2c_homework_file')
  loop execute format('revoke all on function %s from public,anon',f.signature); execute format('grant execute on function %s to authenticated',f.signature); end loop;
end;
$$;
notify pgrst,'reload schema';
