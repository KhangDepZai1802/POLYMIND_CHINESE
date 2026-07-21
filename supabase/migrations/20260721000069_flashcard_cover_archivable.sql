-- 69 — Flashcard: cho phép lưu trữ (xóa mềm) trang mở đầu như mọi trang khác.
-- Trang mở đầu giữ order_index = 0; khi lưu trữ KHÔNG dồn thứ tự để trang từ vựng
-- không rơi về 0 (vi phạm flashcard_pages_kind_order_check). Buổi thiếu cover vẫn
-- không publish được vì validate_flashcard_section_publish yêu cầu đúng 1 cover.

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

  update public.flashcard_pages
  set archived_at = clock_timestamp()
  where id = p_page_id;

  -- Chỉ dồn thứ tự khi bỏ trang từ vựng; bỏ trang mở đầu để lại chỗ trống ở 0.
  if v_page.kind = 'vocabulary' then
    update public.flashcard_pages
    set order_index = order_index - 1
    where section_id = v_page.section_id
      and archived_at is null
      and order_index > v_page.order_index;
  end if;

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

-- Reorder: khi buổi còn cover thì cover phải đứng đầu và đánh số từ 0.
-- Khi cover đã bị lưu trữ, danh sách chỉ còn trang từ vựng nên đánh số từ 1.
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
  v_has_cover boolean;
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

  select exists (
    select 1
    from public.flashcard_pages p
    where p.section_id = p_section_id
      and p.archived_at is null
      and p.kind = 'session_cover'
  )
  into v_has_cover;

  select kind into v_first_kind
  from public.flashcard_pages
  where id = p_page_ids[1];

  if v_has_cover then
    if v_first_kind <> 'session_cover' then
      raise exception 'Trang mở đầu phải đứng đầu buổi flashcard';
    end if;
  else
    -- Không còn cover: trang từ vựng phải giữ order_index > 0.
    v_index := 1;
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
