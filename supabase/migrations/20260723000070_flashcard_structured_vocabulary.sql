-- 70 — Phase 16 / `P16-T1`: thẻ từ vựng thành BẢN GHI CÓ CẤU TRÚC (docs/10 §7ter).
--
-- Cổng `P16-T0` đã mở (2026-07-23): user chạy 2 câu SQL đếm trên CLOUD, kết quả
-- decks/sections/pages = 0 ở mọi cột và câu liệt kê không ra dòng nào — không có
-- bộ thẻ do người thật soạn, nên điều kiện "xoá làm lại" của `Q2` được thoả.
--
-- Bốn chốt của `DS-050` áp vào migration này:
--   (1) 3 danh sách con → 3 cột `jsonb` (Zod là chỗ cưỡng chế hình dạng DUY NHẤT).
--   (2) học viên đọc ảnh trong danh sách con → `media_paths text[]` + trigger + GIN.
--   (3) GIỮ 2 cột `front_image_path`/`back_image_path`, KHÔNG thêm `illustration_path`.
--   (4) ảnh mẫu 胡萝卜 chỉ là chuẩn CÁCH DỰNG — không nhân bản nội dung nó vào seed.
--
-- Và chốt của `P16-T1` (user, 2026-07-23): giữ NGUYÊN
-- `flashcard_pages_distinct_media_check`; §7ter khối 2 được viết lại thành
-- "mặt sau dùng ảnh RIÊNG, khác ảnh mặt trước". Vì vậy file này KHÔNG đụng
-- constraint đó — hai mặt vẫn buộc phải là hai file khác nhau khi cả hai có mặt.

-- =====================================================================
-- 1. Xoá dữ liệu cũ — mô hình đổi hẳn hình dạng, không migrate từng cột được
-- =====================================================================
-- Tắt trigger vì migration chạy ngoài phiên đăng nhập (`auth.uid()` null),
-- và `guard_flashcard_page_history`/`prevent_flashcard_container_delete` chặn
-- mọi thao tác xoá cứng — đúng như thiết kế, nhưng ở đây ta cố ý xoá làm lại.
alter table public.flashcard_pages disable trigger user;
alter table public.flashcard_sections disable trigger user;
alter table public.flashcard_decks disable trigger user;

delete from public.flashcard_pages;
delete from public.flashcard_sections;
delete from public.flashcard_decks;

alter table public.flashcard_pages enable trigger user;
alter table public.flashcard_sections enable trigger user;
alter table public.flashcard_decks enable trigger user;

-- ⛔ CỐ Ý KHÔNG xoá `storage.objects` ở đây. Supabase cài `storage.protect_delete()`
-- chặn xoá thẳng khỏi bảng storage ("Use the Storage API instead") — tắt trigger đó
-- sẽ làm lệch sổ sách nội bộ của Storage. Không có file mồ côi trên CLOUD vì
-- `P16-T0` đếm ra 0 trang; local thì `npm run db:reset` dựng lại bucket từ đầu.

-- =====================================================================
-- 2. Cột mới cho thẻ từ vựng
-- =====================================================================
alter table public.flashcard_pages
  add column hanzi text,
  add column pinyin_syllables text,
  add column meaning_vi text,
  add column sense_breakdown jsonb not null default '[]'::jsonb,
  add column example_sentences jsonb not null default '[]'::jsonb,
  add column common_phrases jsonb not null default '[]'::jsonb,
  add column media_paths text[] not null default '{}'::text[];

-- `term` bị `hanzi` thay thế hoàn toàn. Giữ cả hai là hai nguồn sự thật cho cùng
-- một dữ liệu — đúng thứ `BUG_M10_01` cấm. Phải bỏ constraint tham chiếu trước.
alter table public.flashcard_pages
  drop constraint flashcard_pages_kind_order_check;
alter table public.flashcard_pages
  drop column term;

-- =====================================================================
-- 3. NOT NULL của media → ràng buộc THEO `kind`
-- =====================================================================
-- `session_cover` vẫn là hai ảnh bắt buộc (chốt `Q5`, không đổi).
-- `vocabulary` có ảnh TUỲ CHỌN (§7ter: "Ảnh minh họa — Tuỳ chọn").
alter table public.flashcard_pages
  alter column front_image_path drop not null,
  alter column back_image_path  drop not null,
  alter column front_alt        drop not null,
  alter column back_alt         drop not null;

alter table public.flashcard_pages
  add constraint flashcard_pages_image_kind_check check (
    kind <> 'session_cover'
    or (front_image_path is not null and back_image_path is not null)
  );

-- Alt do server sinh; có ảnh thì bắt buộc có alt, không ảnh thì phải không có alt.
alter table public.flashcard_pages
  add constraint flashcard_pages_alt_pairing_check check (
    (front_image_path is null) = (front_alt is null)
    and (back_image_path is null) = (back_alt is null)
  );

-- =====================================================================
-- 4. Ràng buộc nội dung theo `kind`
-- =====================================================================
-- §7ter: Hán tự · Pinyin · Nghĩa tiếng Việt đều BẮT BUỘC với thẻ từ vựng.
-- Trang mở đầu không mang chữ nào (chốt `Q5`) nên mọi trường chữ phải rỗng.
alter table public.flashcard_pages
  add constraint flashcard_pages_kind_order_check check (
    (
      kind = 'session_cover'
      and order_index = 0
      and hanzi is null
      and pinyin_syllables is null
      and meaning_vi is null
      and sense_breakdown = '[]'::jsonb
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

-- ⚠️ `jsonb` KHÔNG có FK và KHÔNG có CHECK hình dạng ở tầng DB — Zod ở
-- `features/flashcards/schema.ts` là chỗ cưỡng chế DUY NHẤT (`DS-050` điểm 1).
-- CHECK dưới đây chỉ là sàn: đảm bảo ba cột luôn là MẢNG, để trigger tổng hợp
-- `media_paths` và mọi câu đọc phía sau không phải phòng thủ kiểu dữ liệu.
alter table public.flashcard_pages
  add constraint flashcard_pages_sublists_array_check check (
    jsonb_typeof(sense_breakdown) = 'array'
    and jsonb_typeof(example_sentences) = 'array'
    and jsonb_typeof(common_phrases) = 'array'
  );

-- =====================================================================
-- 5. `media_paths` — MỘT đường ghi duy nhất, do trigger tổng hợp
-- =====================================================================
-- `DS-050` điểm 2. Cách cũ liệt kê cứng 3 cột trong
-- `app.can_student_read_flashcard_media()` nên ảnh của câu ví dụ (nằm trong
-- `jsonb`) khiến học viên nhận 403 trong khi admin vẫn xem được — lỗi im lặng,
-- không spec nào báo đỏ. Cột này gom MỌI nguồn ảnh/audio về một chỗ, và thêm
-- khe media mới về sau không phải sửa policy lần nữa (`BUG_M10_01`).
--
-- Trigger ghi đè vô điều kiện: client gửi `media_paths` gì cũng bị thay bằng giá
-- trị tính lại. Đó chính là "một hành động = một đường ghi".
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
    case when jsonb_typeof(new.sense_breakdown) = 'array'
         then new.sense_breakdown else '[]'::jsonb end
    || case when jsonb_typeof(new.example_sentences) = 'array'
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

create trigger trg_flashcard_pages_media_paths
before insert or update on public.flashcard_pages
for each row execute function app.sync_flashcard_media_paths();

-- GIN để `media_paths @> array[<path>]` không phải quét toàn bảng mỗi lần ký URL.
create index ix_flashcard_pages_media_paths
  on public.flashcard_pages using gin (media_paths);

-- =====================================================================
-- 6. Policy đọc media của học viên — đổi sang `media_paths`
-- =====================================================================
-- Dùng `media_paths @> array[p_object_path]` chứ không phải
-- `p_object_path = any(p.media_paths)`: hai vế NGHĨA GIỐNG HỆT nhau, nhưng chỉ
-- dạng `@>` mới dùng được index GIN ở trên — viết `= any(...)` thì index thành
-- index chết. Ghi rõ ở đây để lần sau không ai "sửa lại cho giống DS-050".
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
        and p.media_paths @> array[p_object_path]
        and app.can_student_read_flashcard_course(d.course_id)
    );
$$;

revoke all on function app.can_student_read_flashcard_media(text)
  from public, anon;
grant execute on function app.can_student_read_flashcard_media(text)
  to authenticated;

-- =====================================================================
-- 7. Chú thích cột
-- =====================================================================
comment on column public.flashcard_pages.hanzi is
  'Hán tự của thẻ từ vựng — thay cho cột `term` cũ. Null với trang mở đầu.';
comment on column public.flashcard_pages.pinyin_syllables is
  'Pinyin dạng TÁCH ÂM TIẾT ("hú luó bo") để căn thẳng trên từng chữ Hán. '
  'Dạng viết liền ("húluóbo") của mặt sau là DẪN XUẤT khi hiển thị (bỏ dấu cách), '
  'không lưu thành cột riêng — chiều ngược lại máy không tự cắt được (§7ter).';
comment on column public.flashcard_pages.meaning_vi is
  'Nghĩa tiếng Việt của thẻ từ vựng.';
comment on column public.flashcard_pages.sense_breakdown is
  'Khối 3 §7ter — mảng {hanzi, pinyin, meaning_vi}. Hình dạng do Zod cưỡng chế.';
comment on column public.flashcard_pages.example_sentences is
  'Khối 4 §7ter — mảng {hanzi, pinyin, meaning_vi, image_path?}. Ảnh trong đây '
  'được trigger gom vào `media_paths` nên học viên ký URL đọc được.';
comment on column public.flashcard_pages.common_phrases is
  'Khối 5 §7ter — mảng {hanzi, pinyin, meaning_vi}. Hình dạng do Zod cưỡng chế.';
comment on column public.flashcard_pages.media_paths is
  'Tổng hợp MỌI đường dẫn media của trang (2 ảnh + audio + ảnh câu ví dụ). '
  'Chỉ trigger `trg_flashcard_pages_media_paths` được ghi; client ghi cũng bị đè.';
comment on column public.flashcard_pages.front_image_path is
  'Ảnh mặt trước. Bắt buộc với trang mở đầu; tuỳ chọn với thẻ từ vựng.';
comment on column public.flashcard_pages.back_image_path is
  'Ảnh mặt sau. Bắt buộc với trang mở đầu; tuỳ chọn với thẻ từ vựng. '
  'Phải KHÁC file với ảnh mặt trước (flashcard_pages_distinct_media_check) — '
  'chốt user 2026-07-23, §7ter khối 2 đã viết lại cho khớp.';

comment on table public.flashcard_pages is
  'Trang mở đầu (2 ảnh, không chữ) hoặc thẻ từ vựng (bản ghi có cấu trúc §7ter).';
