-- 72 — Phase 16 / `P16-T4`: nhập hàng loạt thẻ từ vựng, idempotent ở TẦNG DB.

-- =====================================================================
-- 1. Khóa chống trùng — chỗ để `ON CONFLICT` bám vào
-- =====================================================================
-- `BUG_M09_01`: chặn lặp phải nằm ở DB, không chỉ ở app. Trước migration này
-- `flashcard_pages` không có khóa nghiệp vụ nào, nên dán lại đúng danh sách cũ
-- sẽ sinh ra một bộ thẻ trùng thứ hai mà không gì cản.
--
-- Khóa gồm CẢ pinyin (user chốt 2026-07-23): chữ đa âm phải được làm hai thẻ
-- riêng trong cùng một buổi — 行 đọc `xíng` (đi) và 行 đọc `háng` (hàng, nghề)
-- là hai từ khác hẳn. Khóa chỉ có `hanzi` sẽ chặn oan trường hợp đó.
create unique index ux_flashcard_pages_vocab_key
  on public.flashcard_pages (section_id, hanzi, pinyin_syllables)
  where kind = 'vocabulary' and archived_at is null;

-- =====================================================================
-- 2. "Thẻ từ vựng phải có audio" — chuyển từ mức HÀNG sang mức CÔNG BỐ
-- =====================================================================
-- Definition of Done của `P16-T4` ghi rõ: đường nhập hàng loạt **không** nhập
-- được ảnh/audio. Nhưng `flashcard_pages_audio_kind_check` lại ép MỌI thẻ từ
-- vựng phải có `audio_path` ngay lúc ghi — hai điều đó không thể cùng đúng, và
-- nếu giữ nguyên thì không nhập hàng loạt được dòng nào.
--
-- Lời hứa với học viên vẫn nguyên vẹn: thẻ thiếu audio chỉ tồn tại được khi
-- buổi còn NHÁP, và học viên không đọc được buổi nháp. Chỗ cưỡng chế chuyển
-- xuống `validate_flashcard_section_publish` bên dưới.
alter table public.flashcard_pages
  drop constraint flashcard_pages_audio_kind_check;

alter table public.flashcard_pages
  add constraint flashcard_pages_audio_kind_check check (
    kind = 'vocabulary' or audio_path is null
  );

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

  -- Chỗ cưỡng chế MỚI của luật audio (trước đây là CHECK ở mức hàng).
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

-- =====================================================================
-- 3. RPC nhập hàng loạt
-- =====================================================================
-- Trả về kết quả THEO TỪNG DÒNG chứ không phải một câu "thành công/thất bại"
-- cho cả lô — Definition of Done cấm nuốt lỗi cả lô.
--
-- Hình dạng từng dòng do **Zod ở app kiểm trước khi gọi** (`DS-050`: Zod là chỗ
-- cưỡng chế duy nhất cho dữ liệu không có CHECK ở DB). RPC này chỉ lo chèn và
-- xử lý trùng, nên dòng tới đây đã chắc chắn đủ ba trường.
create or replace function public.import_flashcard_vocabulary(
  p_section_id uuid,
  p_rows jsonb
)
returns table (row_index integer, row_status text, page_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section public.flashcard_sections;
  v_next_order integer;
  v_row jsonb;
  v_index integer := 0;
  v_id uuid;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được nhập flashcard';
  end if;

  select * into v_section
  from public.flashcard_sections
  where id = p_section_id
  for update;

  if v_section.id is null or v_section.status <> 'draft' then
    raise exception 'Chỉ nhập được vào buổi flashcard đang nháp';
  end if;

  select coalesce(max(order_index), 0)
  into v_next_order
  from public.flashcard_pages
  where section_id = p_section_id
    and archived_at is null;

  for v_row in
    select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_id := null;
    v_next_order := v_next_order + 1;

    insert into public.flashcard_pages (
      section_id, kind, order_index, hanzi, pinyin_syllables, meaning_vi
    )
    values (
      p_section_id,
      'vocabulary',
      v_next_order,
      btrim(v_row ->> 'hanzi'),
      btrim(v_row ->> 'pinyin_syllables'),
      btrim(v_row ->> 'meaning_vi')
    )
    on conflict (section_id, hanzi, pinyin_syllables)
      where kind = 'vocabulary' and archived_at is null
    do nothing
    returning id into v_id;

    if v_id is null then
      -- Trùng thì KHÔNG tiêu số thứ tự, nếu không sẽ thủng dãy order_index và
      -- buổi không publish được ("thứ tự phải liên tục từ 0").
      v_next_order := v_next_order - 1;
      row_index := v_index;
      row_status := 'duplicate';
      page_id := null;
    else
      row_index := v_index;
      row_status := 'created';
      page_id := v_id;
    end if;

    return next;
    v_index := v_index + 1;
  end loop;

  perform app.write_audit(
    'import',
    'flashcard_section',
    p_section_id,
    null,
    jsonb_build_object('row_count', v_index)
  );
end;
$$;

revoke all on function public.import_flashcard_vocabulary(uuid, jsonb)
  from public, anon;
grant execute on function public.import_flashcard_vocabulary(uuid, jsonb)
  to authenticated;

comment on index public.ux_flashcard_pages_vocab_key is
  'Chống tạo trùng thẻ từ vựng trong một buổi. Gồm cả pinyin để chữ đa âm '
  '(行 xíng / 行 háng) vẫn làm được hai thẻ riêng.';
comment on constraint flashcard_pages_audio_kind_check on public.flashcard_pages is
  'Trang mở đầu không bao giờ có audio. Thẻ từ vựng ĐƯỢC PHÉP thiếu audio khi '
  'buổi còn nháp (đường nhập hàng loạt không nhập audio); publish sẽ chặn.';
