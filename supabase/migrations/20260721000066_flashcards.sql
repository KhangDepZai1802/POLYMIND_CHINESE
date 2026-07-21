-- 66 — Flashcard theo Course/Buổi: schema, publish integrity, RLS và Storage private.

create type public.flashcard_status as enum ('draft', 'published', 'archived');
create type public.flashcard_page_kind as enum ('session_cover', 'vocabulary');

create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses(id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  description text,
  status public.flashcard_status not null default 'draft',
  published_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flashcard_decks_publish_time_check check (
    (status = 'published' and published_at is not null)
    or status <> 'published'
  )
);

create table public.flashcard_sections (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  session_number integer not null check (session_number > 0),
  title text not null check (btrim(title) <> ''),
  status public.flashcard_status not null default 'draft',
  published_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_flashcard_sections_deck_session unique (deck_id, session_number),
  constraint flashcard_sections_publish_time_check check (
    (status = 'published' and published_at is not null)
    or status <> 'published'
  )
);

create table public.flashcard_pages (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.flashcard_sections(id) on delete cascade,
  kind public.flashcard_page_kind not null,
  order_index integer not null,
  term text,
  front_image_path text not null check (btrim(front_image_path) <> ''),
  back_image_path text not null check (btrim(back_image_path) <> ''),
  audio_path text not null check (btrim(audio_path) <> ''),
  front_alt text not null check (btrim(front_alt) <> ''),
  back_alt text not null check (btrim(back_alt) <> ''),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flashcard_pages_kind_order_check check (
    (kind = 'session_cover' and order_index = 0)
    or (
      kind = 'vocabulary'
      and order_index > 0
      and term is not null
      and btrim(term) <> ''
    )
  ),
  constraint flashcard_pages_distinct_media_check check (
    front_image_path <> back_image_path
    and front_image_path <> audio_path
    and back_image_path <> audio_path
  )
);

create index ix_flashcard_decks_course_status
  on public.flashcard_decks(course_id, status);
create index ix_flashcard_sections_deck_status
  on public.flashcard_sections(deck_id, status, session_number);
create index ix_flashcard_pages_section_active
  on public.flashcard_pages(section_id, order_index)
  where archived_at is null;
create unique index ux_flashcard_pages_active_order
  on public.flashcard_pages(section_id, order_index)
  where archived_at is null;
create unique index ux_flashcard_pages_active_cover
  on public.flashcard_pages(section_id)
  where kind = 'session_cover' and archived_at is null;
create unique index ux_flashcard_pages_front_path
  on public.flashcard_pages(front_image_path);
create unique index ux_flashcard_pages_back_path
  on public.flashcard_pages(back_image_path);
create unique index ux_flashcard_pages_audio_path
  on public.flashcard_pages(audio_path);

create trigger trg_flashcard_decks_updated_at
before update on public.flashcard_decks
for each row execute function app.set_updated_at();

create trigger trg_flashcard_sections_updated_at
before update on public.flashcard_sections
for each row execute function app.set_updated_at();

create trigger trg_flashcard_pages_updated_at
before update on public.flashcard_pages
for each row execute function app.set_updated_at();

create or replace function app.force_flashcard_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
  end if;

  if new.created_by is null then
    raise exception 'Không xác định được người tạo flashcard';
  end if;

  return new;
end;
$$;

revoke all on function app.force_flashcard_actor()
  from public, anon, authenticated;

create trigger trg_flashcard_decks_actor
before insert or update on public.flashcard_decks
for each row execute function app.force_flashcard_actor();

create trigger trg_flashcard_sections_actor
before insert or update on public.flashcard_sections
for each row execute function app.force_flashcard_actor();

create trigger trg_flashcard_pages_actor
before insert or update on public.flashcard_pages
for each row execute function app.force_flashcard_actor();

create or replace function app.normalize_flashcard_deck_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    new.published_at := coalesce(new.published_at, clock_timestamp());
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

revoke all on function app.normalize_flashcard_deck_status()
  from public, anon, authenticated;

create trigger trg_flashcard_decks_normalize_status
before insert or update of status, published_at on public.flashcard_decks
for each row execute function app.normalize_flashcard_deck_status();

create or replace function app.validate_flashcard_section_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_default_session_count integer;
  v_page_count integer;
  v_cover_count integer;
  v_vocabulary_count integer;
  v_min_order integer;
  v_max_order integer;
begin
  if new.status = 'draft' then
    new.published_at := null;
    return new;
  end if;

  if new.status <> 'published' then
    return new;
  end if;

  select c.default_session_count
  into v_default_session_count
  from public.flashcard_decks d
  join public.courses c on c.id = d.course_id
  where d.id = new.deck_id;

  if v_default_session_count is null then
    raise exception 'Khóa học chưa chốt số buổi mặc định';
  end if;

  if new.session_number > v_default_session_count then
    raise exception 'Số buổi flashcard vượt số buổi của khóa học';
  end if;

  select
    count(*)::integer,
    count(*) filter (where p.kind = 'session_cover')::integer,
    count(*) filter (where p.kind = 'vocabulary')::integer,
    min(p.order_index),
    max(p.order_index)
  into
    v_page_count,
    v_cover_count,
    v_vocabulary_count,
    v_min_order,
    v_max_order
  from public.flashcard_pages p
  where p.section_id = new.id
    and p.archived_at is null;

  if v_cover_count <> 1 or v_vocabulary_count < 1 then
    raise exception 'Mỗi buổi cần đúng một trang mở đầu và ít nhất một trang từ vựng';
  end if;

  if v_min_order <> 0 or v_max_order <> v_page_count - 1 then
    raise exception 'Thứ tự trang flashcard phải liên tục từ 0';
  end if;

  new.published_at := coalesce(new.published_at, clock_timestamp());
  return new;
end;
$$;

revoke all on function app.validate_flashcard_section_publish()
  from public, anon, authenticated;

create trigger trg_flashcard_sections_validate_publish
before insert or update of status, published_at on public.flashcard_sections
for each row execute function app.validate_flashcard_section_publish();

create or replace function app.guard_flashcard_page_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section_status public.flashcard_status;
  v_old_section_status public.flashcard_status;
begin
  if tg_op = 'DELETE' then
    raise exception 'Không xóa cứng trang flashcard; hãy lưu trữ trang';
  end if;

  select s.status
  into v_section_status
  from public.flashcard_sections s
  where s.id = new.section_id;

  if tg_op = 'UPDATE' then
    select s.status
    into v_old_section_status
    from public.flashcard_sections s
    where s.id = old.section_id;
  end if;

  if v_section_status = 'published'
     or v_old_section_status = 'published' then
    raise exception 'Đưa buổi flashcard về nháp trước khi sửa trang';
  end if;

  return new;
end;
$$;

revoke all on function app.guard_flashcard_page_history()
  from public, anon, authenticated;

create trigger trg_flashcard_pages_guard_history
before insert or update or delete on public.flashcard_pages
for each row execute function app.guard_flashcard_page_history();

create or replace function app.prevent_flashcard_container_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Không xóa cứng flashcard; hãy chuyển trạng thái lưu trữ';
end;
$$;

revoke all on function app.prevent_flashcard_container_delete()
  from public, anon, authenticated;

create trigger trg_flashcard_decks_prevent_delete
before delete on public.flashcard_decks
for each row execute function app.prevent_flashcard_container_delete();

create trigger trg_flashcard_sections_prevent_delete
before delete on public.flashcard_sections
for each row execute function app.prevent_flashcard_container_delete();

create or replace function app.can_student_read_flashcard_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app.is_active()
    and app.current_role() = 'student'
    and p_course_id is not null
    and exists (
      select 1
      from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = app.my_student_id()
        and e.status in ('active', 'paused', 'completed')
        and c.course_id = p_course_id
    );
$$;

revoke all on function app.can_student_read_flashcard_course(uuid)
  from public, anon;
grant execute on function app.can_student_read_flashcard_course(uuid)
  to authenticated;

create or replace function app.can_student_read_flashcard_media(p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app.is_active()
    and app.current_role() = 'student'
    and p_object_path is not null
    and exists (
      select 1
      from public.flashcard_pages p
      join public.flashcard_sections s on s.id = p.section_id
      join public.flashcard_decks d on d.id = s.deck_id
      where p.archived_at is null
        and s.status = 'published'
        and d.status = 'published'
        and p_object_path in (
          p.front_image_path,
          p.back_image_path,
          p.audio_path
        )
        and app.can_student_read_flashcard_course(d.course_id)
    );
$$;

revoke all on function app.can_student_read_flashcard_media(text)
  from public, anon;
grant execute on function app.can_student_read_flashcard_media(text)
  to authenticated;

alter table public.flashcard_decks enable row level security;
alter table public.flashcard_sections enable row level security;
alter table public.flashcard_pages enable row level security;

create policy flashcard_decks_admin_all
on public.flashcard_decks
for all to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

create policy flashcard_sections_admin_all
on public.flashcard_sections
for all to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

create policy flashcard_pages_admin_all
on public.flashcard_pages
for all to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

create policy flashcard_decks_student_read
on public.flashcard_decks
for select to authenticated
using (
  status = 'published'
  and app.can_student_read_flashcard_course(course_id)
);

create policy flashcard_sections_student_read
on public.flashcard_sections
for select to authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.flashcard_decks d
    where d.id = flashcard_sections.deck_id
      and d.status = 'published'
      and app.can_student_read_flashcard_course(d.course_id)
  )
);

create policy flashcard_pages_student_read
on public.flashcard_pages
for select to authenticated
using (
  archived_at is null
  and exists (
    select 1
    from public.flashcard_sections s
    join public.flashcard_decks d on d.id = s.deck_id
    where s.id = flashcard_pages.section_id
      and s.status = 'published'
      and d.status = 'published'
      and app.can_student_read_flashcard_course(d.course_id)
  )
);

grant select, insert, update, delete
  on public.flashcard_decks, public.flashcard_sections, public.flashcard_pages
  to authenticated;
revoke all
  on public.flashcard_decks, public.flashcard_sections, public.flashcard_pages
  from anon;

create or replace function public.publish_flashcard_section(p_section_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section public.flashcard_sections;
  v_deck public.flashcard_decks;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được công bố flashcard';
  end if;

  select * into v_section
  from public.flashcard_sections
  where id = p_section_id
  for update;

  if v_section.id is null then
    raise exception 'Không tìm thấy buổi flashcard';
  end if;

  select * into v_deck
  from public.flashcard_decks
  where id = v_section.deck_id
  for update;

  update public.flashcard_sections
  set status = 'published', published_at = clock_timestamp()
  where id = p_section_id;

  update public.flashcard_decks
  set status = 'published', published_at = coalesce(published_at, clock_timestamp())
  where id = v_section.deck_id;

  perform app.write_audit(
    'publish',
    'flashcard_section',
    p_section_id,
    to_jsonb(v_section),
    (select to_jsonb(s) from public.flashcard_sections s where s.id = p_section_id)
  );
end;
$$;

revoke all on function public.publish_flashcard_section(uuid)
  from public, anon;
grant execute on function public.publish_flashcard_section(uuid)
  to authenticated;

create or replace function public.reorder_flashcard_pages(
  p_section_id uuid,
  p_page_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section public.flashcard_sections;
  v_expected_count integer;
  v_distinct_count integer;
  v_page_id uuid;
  v_index integer := 0;
  v_first_kind public.flashcard_page_kind;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được sắp xếp flashcard';
  end if;

  select * into v_section
  from public.flashcard_sections
  where id = p_section_id
  for update;

  if v_section.id is null or v_section.status <> 'draft' then
    raise exception 'Chỉ sắp xếp được buổi flashcard đang nháp';
  end if;

  select count(*)::integer
  into v_expected_count
  from public.flashcard_pages
  where section_id = p_section_id
    and archived_at is null;

  select count(distinct supplied.id)::integer
  into v_distinct_count
  from unnest(coalesce(p_page_ids, array[]::uuid[])) as supplied(id);

  if coalesce(array_length(p_page_ids, 1), 0) <> v_expected_count
     or v_distinct_count <> v_expected_count
     or exists (
       select 1
       from unnest(coalesce(p_page_ids, array[]::uuid[])) as supplied(id)
       where not exists (
         select 1
         from public.flashcard_pages p
         where p.id = supplied.id
           and p.section_id = p_section_id
           and p.archived_at is null
       )
     ) then
    raise exception 'Danh sách trang không khớp buổi flashcard';
  end if;

  select kind into v_first_kind
  from public.flashcard_pages
  where id = p_page_ids[1];

  if v_first_kind <> 'session_cover' then
    raise exception 'Trang mở đầu phải đứng đầu buổi flashcard';
  end if;

  update public.flashcard_pages
  set order_index = order_index + 1000000
  where section_id = p_section_id
    and kind = 'vocabulary'
    and archived_at is null;

  foreach v_page_id in array p_page_ids loop
    update public.flashcard_pages
    set order_index = v_index
    where id = v_page_id;
    v_index := v_index + 1;
  end loop;

  perform app.write_audit(
    'reorder',
    'flashcard_section',
    p_section_id,
    null,
    jsonb_build_object('page_ids', to_jsonb(p_page_ids))
  );
end;
$$;

revoke all on function public.reorder_flashcard_pages(uuid, uuid[])
  from public, anon;
grant execute on function public.reorder_flashcard_pages(uuid, uuid[])
  to authenticated;

create or replace function public.archive_flashcard_page(p_page_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page public.flashcard_pages;
  v_section public.flashcard_sections;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được lưu trữ trang flashcard';
  end if;

  select * into v_page
  from public.flashcard_pages
  where id = p_page_id
    and archived_at is null
  for update;

  if v_page.id is null then
    return;
  end if;

  select * into v_section
  from public.flashcard_sections
  where id = v_page.section_id
  for update;

  if v_section.status <> 'draft' then
    raise exception 'Đưa buổi flashcard về nháp trước khi lưu trữ trang';
  end if;

  if v_page.kind = 'session_cover' then
    raise exception 'Không lưu trữ trang mở đầu; hãy cập nhật media của trang';
  end if;

  update public.flashcard_pages
  set archived_at = clock_timestamp()
  where id = p_page_id;

  update public.flashcard_pages
  set order_index = order_index - 1
  where section_id = v_page.section_id
    and archived_at is null
    and order_index > v_page.order_index;

  perform app.write_audit(
    'archive',
    'flashcard_page',
    p_page_id,
    to_jsonb(v_page),
    (select to_jsonb(p) from public.flashcard_pages p where p.id = p_page_id)
  );
end;
$$;

revoke all on function public.archive_flashcard_page(uuid)
  from public, anon;
grant execute on function public.archive_flashcard_page(uuid)
  to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'flashcard-media',
  'flashcard-media',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy flashcard_media_admin_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'flashcard-media'
  and app.is_super_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy flashcard_media_admin_read
on storage.objects
for select to authenticated
using (
  bucket_id = 'flashcard-media'
  and app.is_super_admin()
);

create policy flashcard_media_admin_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'flashcard-media'
  and app.is_super_admin()
);

create policy flashcard_media_student_read
on storage.objects
for select to authenticated
using (
  bucket_id = 'flashcard-media'
  and app.can_student_read_flashcard_media(name)
);

comment on table public.flashcard_decks is
  'Một deck flashcard dùng chung cho mỗi Course.';
comment on table public.flashcard_sections is
  'Mục lục flashcard theo số buổi; publish độc lập từng buổi.';
comment on table public.flashcard_pages is
  'Trang mở đầu/từ vựng với hai ảnh và một audio trong bucket private.';
