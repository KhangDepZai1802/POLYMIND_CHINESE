-- ============================================================================
-- BUG-P16-002 — soi nhiều object flashcard-media trong MỘT lượt
--
-- Vì sao cần: `attachFlashcardSectionMediaAction` đang gọi
-- `storage.from(...).info(path)` cho TỪNG file. Một buổi 17 thẻ = 34 lượt gọi
-- HTTP chỉ để hỏi "file có thật không". Hai hậu quả, cả hai đều có thật:
--
--   1. CHẬM — 34 round-trip nối đuôi bước tải lên vốn đã lâu.
--   2. GIÒN — mỗi lượt gọi là một cơ hội hỏng riêng. Bản cũ coi *mọi* lỗi
--      (kể cả trục trặc đường truyền) là "file hỏng" rồi XOÁ file đó, nên một
--      hiccup mạng đủ để thổi bay cả lượt tải 34 file người soạn vừa chờ xong.
--
-- Một câu SQL trả cả 34 dòng: một round-trip, một kết quả nhất quán, và không
-- còn chuyện "34 lần rút thăm may rủi".
--
-- `security invoker` là cố ý: RLS trên `storage.objects` VẪN áp dụng, nên hàm
-- này không mở thêm một milimet quyền nào so với việc gọi `.info()` trực tiếp.
-- Đổi sang `security definer` sẽ biến nó thành đường đọc vòng qua RLS.
-- ============================================================================

create or replace function public.flashcard_media_objects_info(p_paths text[])
returns table (
  object_path text,
  size_bytes bigint,
  mime_type text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    o.name,
    (o.metadata ->> 'size')::bigint,
    o.metadata ->> 'mimetype'
  from storage.objects o
  where o.bucket_id = 'flashcard-media'
    and o.name = any(p_paths)
    -- Trần trùng với `MAX_FLASHCARD_BULK_UPLOAD_FILES`. Vượt trần thì trả rỗng
    -- → tầng app coi là "chưa xác minh được" → KHÔNG gắn gì cả. Fail-closed:
    -- thà không gắn còn hơn gắn một đường dẫn chưa ai soi.
    and cardinality(p_paths) <= 120;
$$;

comment on function public.flashcard_media_objects_info(text[]) is
  'Soi kích thước + MIME của nhiều object flashcard-media trong một lượt. security invoker: RLS storage.objects vẫn áp dụng.';

revoke all on function public.flashcard_media_objects_info(text[])
  from public, anon;
grant execute on function public.flashcard_media_objects_info(text[])
  to authenticated;
