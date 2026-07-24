-- 76 — Tạo NHIỀU buổi cùng lúc + xoá hàng loạt buổi/trang (yêu cầu user 2026-07-24).
--
-- ⚠️ "Xoá" ở đây là XOÁ MỀM, cố ý. Hai lý do, cả hai đều có sẵn trong repo:
--   (1) `AGENTS.md` luật cứng: "Không hard delete dữ liệu lịch sử. Dùng
--       status/archive."
--   (2) Migration `…066` đã cài `app.prevent_flashcard_container_delete()` chặn
--       xoá cứng `flashcard_sections`/`flashcard_decks`, và
--       `app.guard_flashcard_page_history()` chặn xoá cứng `flashcard_pages`.
-- Viết một RPC đi vòng qua hai trigger đó là tự tay tháo một quyết định thiết kế
-- đã chốt. Nên hai hàm dưới đây làm đúng thứ trang lẻ đã làm từ `…069`: đặt
-- `archived_at`. Với người dùng thì kết quả giống hệt — nội dung biến mất khỏi
-- màn Quản trị và khỏi màn học viên.
--
-- Hệ quả bắt buộc phải xử lý: `flashcard_sections` CHƯA có `archived_at`, và
-- unique `(deck_id, session_number)` là unique TOÀN BẢNG. Giữ nguyên thì xoá hết
-- buổi xong sẽ KHÔNG tạo lại được "Buổi 1" — hàng cũ vẫn chiếm số. Vì vậy khoá
-- phải thành PARTIAL, đúng cách `ux_flashcard_pages_vocab_key` đang làm.

-- =====================================================================
-- 1. `archived_at` cho buổi + khoá số buổi thành PARTIAL
-- =====================================================================
alter table public.flashcard_sections
  add column archived_at timestamptz;

alter table public.flashcard_sections
  drop constraint uq_flashcard_sections_deck_session;

create unique index ux_flashcard_sections_deck_session
  on public.flashcard_sections (deck_id, session_number)
  where archived_at is null;

comment on column public.flashcard_sections.archived_at is
  'Buổi đã xoá mềm. Không hiện ở màn Quản trị lẫn màn học viên, và KHÔNG chiếm '
  'số buổi nữa (khoá ux_flashcard_sections_deck_session là partial index).';

-- Buổi đã xoá thì không được công bố lại — nếu không, một buổi vô hình vẫn
-- có thể chảy tới học viên qua đúng đường công bố.
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
  v_missing_audio_count integer;
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

  if new.archived_at is not null then
    raise exception 'Buổi flashcard đã xoá thì không công bố được';
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
    count(*) filter (
      where p.kind = 'vocabulary' and p.audio_path is null
    )::integer,
    min(p.order_index),
    max(p.order_index)
  into
    v_page_count,
    v_cover_count,
    v_vocabulary_count,
    v_missing_audio_count,
    v_min_order,
    v_max_order
  from public.flashcard_pages p
  where p.section_id = new.id
    and p.archived_at is null;

  if v_cover_count <> 1 or v_vocabulary_count < 1 then
    raise exception 'Mỗi buổi cần đúng một trang mở đầu và ít nhất một trang từ vựng';
  end if;

  if v_missing_audio_count > 0 then
    raise exception 'Còn % thẻ từ vựng chưa có audio phát âm', v_missing_audio_count;
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

-- Học viên không được thấy buổi đã xoá, kể cả khi nó từng `published`.
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
        and s.archived_at is null
        and s.status = 'published'
        and d.status = 'published'
        and p.media_paths @> array[p_object_path]
        and app.can_student_read_flashcard_course(d.course_id)
    );
$$;

revoke all on function app.can_student_read_flashcard_media(text)
  from public, anon;
grant execute on function app.can_student_read_flashcard_media(text)
  to authenticated;

drop policy flashcard_sections_student_read on public.flashcard_sections;

create policy flashcard_sections_student_read
on public.flashcard_sections
for select
to authenticated
using (
  archived_at is null
  and status = 'published'
  and exists (
    select 1
    from public.flashcard_decks d
    where d.id = flashcard_sections.deck_id
      and d.status = 'published'
      and app.can_student_read_flashcard_course(d.course_id)
  )
);

-- =====================================================================
-- 2. Tạo NHIỀU buổi trong một lượt
-- =====================================================================
-- Báo kết quả THEO TỪNG BUỔI, cùng lý do như `import_flashcard_vocabulary`:
-- người soạn phải thấy buổi nào tạo mới, buổi nào đã có sẵn.
-- `ON CONFLICT DO NOTHING` bám vào partial index ở trên ⇒ idempotent ở TẦNG DB
-- (`BUG_M09_01`), bấm hai lần không sinh buổi trùng.
create or replace function public.create_flashcard_sections(
  p_deck_id uuid,
  p_from integer,
  p_to integer
)
-- ⚠️ Cột trả về đặt tên `session_no` chứ KHÔNG phải `session_number`: tên tham
-- số OUT của PL/pgSQL nằm cùng không gian tên với cột của bảng, nên
-- `on conflict (deck_id, session_number)` bên dưới sẽ báo *"column reference
-- session_number is ambiguous"* ngay lúc chạy. Và ON CONFLICT không cho phép
-- viết tiền tố bảng để gỡ mập mờ.
returns table (session_no integer, row_status text, section_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deck public.flashcard_decks;
  v_max_sessions integer;
  v_number integer;
  v_id uuid;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được tạo buổi flashcard';
  end if;

  if p_from is null or p_to is null or p_from < 1 or p_to < p_from then
    raise exception 'Khoảng buổi không hợp lệ';
  end if;

  select * into v_deck
  from public.flashcard_decks
  where id = p_deck_id
  for update;

  if v_deck.id is null then
    raise exception 'Không tìm thấy bộ flashcard';
  end if;

  select c.default_session_count
  into v_max_sessions
  from public.courses c
  where c.id = v_deck.course_id;

  if v_max_sessions is null then
    raise exception 'Khóa học chưa chốt số buổi mặc định';
  end if;

  if p_to > v_max_sessions then
    raise exception 'Khóa học chỉ có % buổi', v_max_sessions;
  end if;

  for v_number in p_from..p_to loop
    v_id := null;

    insert into public.flashcard_sections (deck_id, session_number, title)
    values (p_deck_id, v_number, 'Buổi ' || v_number)
    on conflict (deck_id, session_number) where archived_at is null
    do nothing
    returning id into v_id;

    session_no := v_number;
    if v_id is null then
      row_status := 'exists';
      section_id := null;
    else
      row_status := 'created';
      section_id := v_id;
    end if;
    return next;
  end loop;

  perform app.write_audit(
    'create_range',
    'flashcard_deck',
    p_deck_id,
    null,
    jsonb_build_object('from', p_from, 'to', p_to)
  );
end;
$$;

revoke all on function public.create_flashcard_sections(uuid, integer, integer)
  from public, anon;
grant execute on function public.create_flashcard_sections(uuid, integer, integer)
  to authenticated;

-- =====================================================================
-- 3. Xoá TẤT CẢ trang trong một buổi
-- =====================================================================
-- Trả về `media_paths` của các trang vừa xoá để tầng app dọn file trong bucket
-- private — giống hệt cách `archiveFlashcardPageAction` đang làm cho trang lẻ.
create or replace function public.archive_flashcard_section_pages(
  p_section_id uuid
)
-- Cột trả về là `removed_paths`, không phải `media_paths`: `media_paths` là tên
-- CỘT của `flashcard_pages`, đặt trùng thì `returning media_paths` bên dưới báo
-- mập mờ. Cùng cái bẫy với `session_no` ở trên.
returns table (archived_count integer, removed_paths text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section public.flashcard_sections;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được xoá trang flashcard';
  end if;

  select * into v_section
  from public.flashcard_sections
  where id = p_section_id
  for update;

  if v_section.id is null or v_section.archived_at is not null then
    raise exception 'Không tìm thấy buổi flashcard';
  end if;

  if v_section.status <> 'draft' then
    raise exception 'Đưa buổi flashcard về nháp trước khi xoá trang';
  end if;

  -- ⚠️ Hai phép đếm phải TÁCH nhau. Gộp `count(*)` vào cùng câu với
  -- `unnest(media_paths)` sẽ đếm theo cặp (trang × đường dẫn): một trang có 3
  -- file thành 3, và số báo về giao diện phồng lên theo số ảnh chứ không theo
  -- số thẻ.
  with removed as (
    update public.flashcard_pages p
    set archived_at = clock_timestamp()
    where p.section_id = p_section_id
      and p.archived_at is null
    returning p.id, p.media_paths as paths
  )
  select
    (select count(*)::integer from removed),
    (
      select coalesce(array_agg(distinct path), '{}'::text[])
      from removed, unnest(removed.paths) as path
    )
  into archived_count, removed_paths;

  perform app.write_audit(
    'archive_all_pages',
    'flashcard_section',
    p_section_id,
    null,
    jsonb_build_object('archived_count', archived_count)
  );

  return next;
end;
$$;

revoke all on function public.archive_flashcard_section_pages(uuid)
  from public, anon;
grant execute on function public.archive_flashcard_section_pages(uuid)
  to authenticated;

-- =====================================================================
-- 4. Xoá TẤT CẢ buổi của một bộ thẻ
-- =====================================================================
-- Chỉ đụng buổi đang NHÁP. Buổi đã công bố được giữ nguyên và đếm riêng, thay vì
-- từ chối cả lượt: admin dọn bản nháp là việc thường ngày, còn buổi đã công bố
-- là thứ học viên đang học — hai nhóm đó không nên chung số phận. Muốn xoá buổi
-- đã công bố thì phải "Đưa về nháp" trước, tức phải nhìn thấy nó một lần nữa.
create or replace function public.archive_flashcard_deck_sections(
  p_deck_id uuid
)
returns table (
  archived_count integer,
  kept_published_count integer,
  removed_paths text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deck public.flashcard_decks;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được xoá buổi flashcard';
  end if;

  select * into v_deck
  from public.flashcard_decks
  where id = p_deck_id
  for update;

  if v_deck.id is null then
    raise exception 'Không tìm thấy bộ flashcard';
  end if;

  select count(*)::integer
  into kept_published_count
  from public.flashcard_sections
  where deck_id = p_deck_id
    and archived_at is null
    and status <> 'draft';

  -- Trang phải xoá TRƯỚC buổi: `guard_flashcard_page_history` đọc trạng thái
  -- buổi để quyết định cho sửa hay không, nên thứ tự ngược lại vẫn chạy nhưng
  -- để lại trang sống trong một buổi vô hình — rác không ai với tới được.
  with target as (
    select id from public.flashcard_sections
    where deck_id = p_deck_id
      and archived_at is null
      and status = 'draft'
  ),
  removed_pages as (
    update public.flashcard_pages p
    set archived_at = clock_timestamp()
    where p.section_id in (select id from target)
      and p.archived_at is null
    returning p.media_paths as paths
  )
  select coalesce(array_agg(distinct path), '{}'::text[])
  into removed_paths
  from removed_pages, unnest(removed_pages.paths) as path;

  with removed as (
    update public.flashcard_sections
    set archived_at = clock_timestamp()
    where deck_id = p_deck_id
      and archived_at is null
      and status = 'draft'
    returning id
  )
  select count(*)::integer into archived_count from removed;

  perform app.write_audit(
    'archive_all_sections',
    'flashcard_deck',
    p_deck_id,
    null,
    jsonb_build_object(
      'archived_count', archived_count,
      'kept_published_count', kept_published_count
    )
  );

  return next;
end;
$$;

revoke all on function public.archive_flashcard_deck_sections(uuid)
  from public, anon;
grant execute on function public.archive_flashcard_deck_sections(uuid)
  to authenticated;
