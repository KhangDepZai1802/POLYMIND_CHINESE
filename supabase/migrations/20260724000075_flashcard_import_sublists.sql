-- 75 — Nhập hàng loạt mang theo CÂU VÍ DỤ và CỤM TỪ (`D-35` điểm 1).
--
-- `…072` chỉ chèn 3 cột chữ, nên dù app có gửi hai danh sách con lên thì chúng
-- vẫn rơi mất ở đây mà không báo gì — đúng loại lỗi im lặng mà `BUG_M10_01`
-- cảnh báo. Forward-fix bằng `create or replace`, không sửa `…072`.
--
-- Hình dạng từng mục do **Zod ở app** cưỡng chế (`DS-050` điểm 1); hàm này chỉ
-- giữ cái sàn "phải là mảng" để `flashcard_pages_sublists_array_check` không bị
-- một request dị dạng làm chết cả lô.
--
-- Trùng thẻ đã tồn tại: giữ nguyên `ON CONFLICT DO NOTHING` — user chốt **bỏ qua
-- cả khối**, không ghi đè (`D-35` điểm 3). Ghi đè sẽ xoá mất câu ví dụ/cụm từ mà
-- người soạn đã sửa tay trước đó.

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
      section_id, kind, order_index, hanzi, pinyin_syllables, meaning_vi,
      example_sentences, common_phrases
    )
    values (
      p_section_id,
      'vocabulary',
      v_next_order,
      btrim(v_row ->> 'hanzi'),
      btrim(v_row ->> 'pinyin_syllables'),
      btrim(v_row ->> 'meaning_vi'),
      case when jsonb_typeof(v_row -> 'example_sentences') = 'array'
           then v_row -> 'example_sentences' else '[]'::jsonb end,
      case when jsonb_typeof(v_row -> 'common_phrases') = 'array'
           then v_row -> 'common_phrases' else '[]'::jsonb end
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
