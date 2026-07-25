-- 77 — Gắn ảnh mặt trước + audio HÀNG LOẠT cho mọi thẻ trong một buổi (`P16-T11`).
--
-- Lời than gốc của user (2026-07-24): thêm ghi âm cho cả buổi phải mở từng thẻ,
-- lưu, đợi thoát ra, vào tiếp — buổi 20 thẻ tốn ≈100 cú bấm.
--
-- Vì sao là RPC chứ không phải `update` thẳng từ tầng app: ba việc hàng loạt
-- trước của Flashcard (`create_flashcard_sections`, `archive_flashcard_section_pages`,
-- `import_flashcard_vocabulary`) đều là RPC, nhờ đó luật fail-closed nằm TRONG DB
-- và được pgTAP phủ. Làm khác đi ở đây thì luật "chỉ super_admin, chỉ buổi nháp"
-- có hai cách phát biểu ở hai tầng — đúng hình dạng `BUG_M10_01`.
--
-- ⛔ PHẠM VI KHE: chỉ `front_image_path` và `audio_path`. Ảnh mặt sau **không**
-- đi đường này (user chốt 2026-07-24).

-- =====================================================================
-- Gắn media cho nhiều trang trong một lượt
-- =====================================================================
-- `p_assignments` là mảng jsonb, mỗi phần tử:
--   { "page_id": uuid,
--     "front_image_path": text|null, "front_alt": text|null,
--     "audio_path": text|null }
--
-- ⚠️ `front_alt` do TẦNG APP tính bằng `flashcardAltText()` rồi truyền xuống,
-- KHÔNG dựng lại bằng SQL ở đây. Câu alt hiện đã có đúng một chỗ sinh ra
-- (`domain/media.ts`); viết bản SQL thứ hai thì hai bản sẽ trôi khác nhau ngay
-- lần đầu ai đó sửa câu chữ, mà lệch alt là thứ chỉ trình đọc màn hình thấy —
-- không ai phát hiện bằng mắt. DB vẫn giữ vế cứng của mình:
-- `flashcard_pages_alt_pairing_check` từ chối "có ảnh mà không alt".
create or replace function public.attach_flashcard_section_media(
  p_section_id uuid,
  p_assignments jsonb,
  p_allow_overwrite boolean default false
)
returns table (
  page_id uuid,
  attached_front boolean,
  attached_audio boolean,
  skipped_front boolean,
  skipped_audio boolean,
  -- File cũ bị thay. Tầng app dọn khỏi bucket private, giống hệt cách
  -- `archive_flashcard_section_pages` trả `removed_paths`.
  removed_paths text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section public.flashcard_sections;
  v_item jsonb;
  v_page public.flashcard_pages;
  v_front text;
  v_front_alt text;
  v_audio text;
  v_removed text[];
  v_next_front text;
  v_next_front_alt text;
  v_next_audio text;
  v_touched integer := 0;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được gắn media flashcard';
  end if;

  if jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'Danh sách gắn media không hợp lệ';
  end if;

  select * into v_section
  from public.flashcard_sections
  where id = p_section_id
  for update;

  if v_section.id is null or v_section.archived_at is not null then
    raise exception 'Không tìm thấy buổi flashcard';
  end if;

  if v_section.status <> 'draft' then
    raise exception 'Chỉ gắn media cho buổi flashcard đang nháp';
  end if;

  for v_item in select * from jsonb_array_elements(p_assignments)
  loop
    -- ⚠️ Khoá hàng lại trước khi đọc. Không khoá thì hai lượt gắn chạy chồng
    -- nhau cùng đọc `front_image_path = null`, cùng thấy "thẻ đang trống", và
    -- lượt sau ghi đè lượt trước trong khi ô "Ghi đè" vẫn đang TẮT — tức xoá
    -- một file mà người dùng đã cố ý bảo là đừng đụng vào.
    select * into v_page
    from public.flashcard_pages
    where id = (v_item ->> 'page_id')::uuid
    for update;

    -- Trang không thuộc buổi này là yêu cầu hỏng hoặc yêu cầu gian: dừng CẢ
    -- LƯỢT chứ không ghi phần còn lại. Đây là vế fail-closed, khác hẳn "thẻ đã
    -- có media" bên dưới — cái đó là kết quả nghiệp vụ bình thường.
    if v_page.id is null
       or v_page.section_id <> p_section_id
       or v_page.archived_at is not null then
      raise exception 'Trang flashcard không thuộc buổi đã chọn';
    end if;

    if v_page.kind <> 'vocabulary' then
      raise exception 'Trang mở đầu không nhận media hàng loạt';
    end if;

    v_front := nullif(btrim(coalesce(v_item ->> 'front_image_path', '')), '');
    v_front_alt := nullif(btrim(coalesce(v_item ->> 'front_alt', '')), '');
    v_audio := nullif(btrim(coalesce(v_item ->> 'audio_path', '')), '');

    if v_front is not null and v_front_alt is null then
      raise exception 'Thiếu alt cho ảnh mặt trước';
    end if;

    v_removed := '{}'::text[];
    attached_front := false;
    attached_audio := false;
    skipped_front := false;
    skipped_audio := false;

    v_next_front := v_page.front_image_path;
    v_next_front_alt := v_page.front_alt;
    v_next_audio := v_page.audio_path;

    if v_front is not null then
      if v_page.front_image_path is not null and not p_allow_overwrite then
        skipped_front := true;
      else
        if v_page.front_image_path is not null
           and v_page.front_image_path <> v_front then
          v_removed := v_removed || v_page.front_image_path;
        end if;
        v_next_front := v_front;
        v_next_front_alt := v_front_alt;
        attached_front := true;
      end if;
    end if;

    if v_audio is not null then
      if v_page.audio_path is not null and not p_allow_overwrite then
        skipped_audio := true;
      else
        if v_page.audio_path is not null and v_page.audio_path <> v_audio then
          v_removed := v_removed || v_page.audio_path;
        end if;
        v_next_audio := v_audio;
        attached_audio := true;
      end if;
    end if;

    if attached_front or attached_audio then
      -- Ghi ĐÚNG ba cột được gắn. Cố ý không đi qua đường lưu cả trang: payload
      -- cả trang mà thiếu `example_sentences`/`common_phrases` sẽ ghi rỗng đè
      -- lên hai danh sách con người soạn đã gõ tay — mất dữ liệu im lặng.
      update public.flashcard_pages
      set front_image_path = v_next_front,
          front_alt = v_next_front_alt,
          audio_path = v_next_audio
      where id = v_page.id;

      v_touched := v_touched + 1;
    end if;

    page_id := v_page.id;
    removed_paths := v_removed;
    return next;
  end loop;

  perform app.write_audit(
    'bulk_attach_media',
    'flashcard_section',
    p_section_id,
    null,
    jsonb_build_object(
      'touched_page_count', v_touched,
      'allow_overwrite', p_allow_overwrite
    )
  );
end;
$$;

revoke all on function public.attach_flashcard_section_media(uuid, jsonb, boolean)
  from public, anon;
grant execute on function public.attach_flashcard_section_media(uuid, jsonb, boolean)
  to authenticated;
