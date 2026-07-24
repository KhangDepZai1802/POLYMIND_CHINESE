-- 74 — Xoá hẳn cột `sense_breakdown` (khối "Tách nghĩa") khỏi `flashcard_pages`.
--
-- Cổng chặn đã mở. Đợt 16 cố ý KHÔNG ghi cột này ở `pageValues` (ghi `[]` sẽ xoá
-- dữ liệu cũ ngay lần admin mở thẻ ra sửa, làm số đếm mất ý nghĩa), để user đếm
-- được dữ liệu THẬT trên cloud. Kết quả user đếm 2026-07-24:
--
--     tong_the_tu_vung = 206 · co_tach_nghia = 0
--
-- Không thẻ nào đang mang dữ liệu "Tách nghĩa" → xoá cột không mất gì (`D-35`
-- điểm 2). Mặt sau học viên nay đúng 4 khối: Thẻ · Nghĩa · Câu ví dụ · Cụm từ.
--
-- Forward-fix, không sửa migration `…070` đã chạy (luật `AGENTS.md`).

-- =====================================================================
-- 1. Trigger gom `media_paths` — bỏ nguồn thứ ba
-- =====================================================================
-- Phải thay TRƯỚC khi xoá cột: hàm cũ đọc `new.sense_breakdown`, mà PL/pgSQL chỉ
-- phân giải tên cột lúc câu lệnh CHẠY THẬT. Để nguyên thì mọi lần ghi
-- `flashcard_pages` sau migration này sẽ chết với `column "sense_breakdown" does
-- not exist` — đúng hình dạng `BUG-P17-001` vừa mất 8 ngày mới lộ.
--
-- Khối "Tách nghĩa" chưa bao giờ có `image_path` trong Zod, nên bỏ nó khỏi phép
-- gộp KHÔNG làm mất đường dẫn media nào.
create or replace function app.sync_flashcard_media_paths()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sublists jsonb;
begin
  v_sublists :=
    case when jsonb_typeof(new.example_sentences) = 'array'
         then new.example_sentences else '[]'::jsonb end
    || case when jsonb_typeof(new.common_phrases) = 'array'
            then new.common_phrases else '[]'::jsonb end;

  new.media_paths := (
    select coalesce(array_agg(distinct src.path), '{}'::text[])
    from (
      select new.front_image_path as path
      union all select new.back_image_path
      union all select new.audio_path
      union all
      select btrim(item ->> 'image_path')
      from jsonb_array_elements(v_sublists) as item
    ) src
    where src.path is not null
      and btrim(src.path) <> ''
  );

  return new;
end;
$$;

revoke all on function app.sync_flashcard_media_paths()
  from public, anon, authenticated;

-- =====================================================================
-- 2. Hai CHECK còn tham chiếu cột — dựng lại KHÔNG có nó
-- =====================================================================
-- ⚠️ Cố ý drop + add tường minh thay vì để `drop column` tự dọn theo dependency:
-- `drop column` sẽ xoá NGUYÊN CẢ hai constraint, kéo theo những vế ta vẫn cần
-- (thứ tự trang, ba trường bắt buộc của thẻ từ vựng, hai cột còn lại phải là
-- mảng). Mất lặng lẽ như vậy đúng bằng việc bỏ ràng buộc mà không ai hay.

alter table public.flashcard_pages
  drop constraint flashcard_pages_kind_order_check;

alter table public.flashcard_pages
  add constraint flashcard_pages_kind_order_check check (
    (
      kind = 'session_cover'
      and order_index = 0
      and hanzi is null
      and pinyin_syllables is null
      and meaning_vi is null
      and example_sentences = '[]'::jsonb
      and common_phrases = '[]'::jsonb
    )
    or (
      kind = 'vocabulary'
      and order_index > 0
      and btrim(coalesce(hanzi, '')) <> ''
      and btrim(coalesce(pinyin_syllables, '')) <> ''
      and btrim(coalesce(meaning_vi, '')) <> ''
    )
  );

alter table public.flashcard_pages
  drop constraint flashcard_pages_sublists_array_check;

alter table public.flashcard_pages
  add constraint flashcard_pages_sublists_array_check check (
    jsonb_typeof(example_sentences) = 'array'
    and jsonb_typeof(common_phrases) = 'array'
  );

-- =====================================================================
-- 3. Xoá cột
-- =====================================================================
alter table public.flashcard_pages
  drop column sense_breakdown;

comment on table public.flashcard_pages is
  'Trang mở đầu (2 ảnh, không chữ) hoặc thẻ từ vựng (bản ghi có cấu trúc §7ter). '
  'Mặt sau thẻ từ vựng gồm 4 khối: Thẻ · Nghĩa · Câu ví dụ · Cụm từ — khối '
  '"Tách nghĩa" đã bỏ khỏi sản phẩm (user chốt 2026-07-24, đếm cloud = 0 hàng).';
