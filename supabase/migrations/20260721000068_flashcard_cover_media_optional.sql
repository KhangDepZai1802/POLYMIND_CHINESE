-- 68 — Flashcard: trang mở đầu chỉ cần hai ảnh (không audio); alt do hệ thống sinh.
-- Trang từ vựng vẫn bắt buộc có audio phát âm.

alter table public.flashcard_pages
  alter column audio_path drop not null;

-- Dữ liệu cũ: trang mở đầu từng buộc phải có audio. Bỏ tham chiếu để hợp ràng buộc mới.
-- Tắt trigger vì migration chạy ngoài phiên đăng nhập (auth.uid() null) và buổi có thể đã publish.
alter table public.flashcard_pages disable trigger user;

update public.flashcard_pages
set audio_path = null
where kind = 'session_cover'
  and audio_path is not null;

alter table public.flashcard_pages enable trigger user;

alter table public.flashcard_pages
  add constraint flashcard_pages_audio_kind_check check (
    (kind = 'vocabulary' and audio_path is not null)
    or (kind = 'session_cover' and audio_path is null)
  );

comment on column public.flashcard_pages.audio_path is
  'Audio phát âm — bắt buộc với trang từ vựng, luôn null với trang mở đầu.';
comment on column public.flashcard_pages.front_alt is
  'Mô tả ảnh cho screen reader — do server sinh từ từ vựng/tên buổi, admin không nhập.';
comment on column public.flashcard_pages.back_alt is
  'Mô tả ảnh cho screen reader — do server sinh từ từ vựng/tên buổi, admin không nhập.';
