-- 78 — Thẻ từ vựng KHÔNG còn ảnh mặt sau (user chốt 2026-07-25).
--
-- Từ Phase 16 (`…070`), mặt sau thẻ từ vựng được dựng BẰNG CHỮ — 4 khối Thẻ ·
-- Nghĩa · Câu ví dụ · Cụm từ. User đổi cơ chế mặt sau, nên ô ảnh mặt sau của thẻ
-- từ vựng là thứ thừa: "không cần ảnh nữa, để thì thừa".
--
-- ⛔ KHÁC `…074`: đây KHÔNG phải "drop cột". Cột `back_image_path` DÙNG CHUNG với
-- trang mở đầu (`session_cover`), nơi hai ảnh vẫn bắt buộc (chốt `Q5`). Xoá cột
-- sẽ phá trang mở đầu. Phạm vi đúng là: **`kind='vocabulary'` ⇒ back rỗng**; cột
-- giữ nguyên cho trang mở đầu.
--
-- Đo CLOUD trước khi làm (đúng quy trình `…074`), user password cấp 2026-07-25:
--     tong_the_tu_vung = 17 · co_anh_mat_sau = 0
-- Không thẻ từ vựng nào đang mang ảnh mặt sau → siết ràng buộc không mất gì.
--
-- Forward-fix, không sửa `…070` đã chạy (luật `AGENTS.md`).

-- =====================================================================
-- 1. Dọn defensive TRƯỚC khi siết
-- =====================================================================
-- Cloud đếm 0, nhưng vẫn NULL hoá ở đây phòng một hàng lọt vào giữa lúc đo và
-- lúc apply. `back_alt` phải null theo — `flashcard_pages_alt_pairing_check` buộc
-- "có ảnh ⇔ có alt", để lại alt mồ côi thì constraint đó nổ ngay.
--
-- Trigger `app.sync_flashcard_media_paths()` tự chạy lại và bỏ đường dẫn mặt sau
-- khỏi `media_paths`. File thật trong bucket (nếu có) do tầng app dọn ở lượt sau;
-- migration không với tới Storage.
update public.flashcard_pages
set back_image_path = null,
    back_alt = null
where kind = 'vocabulary'
  and (back_image_path is not null or back_alt is not null);

-- =====================================================================
-- 2. Siết ràng buộc theo `kind`
-- =====================================================================
-- Dựng lại tường minh (drop + add) thay vì thêm constraint thứ hai: gộp cả hai
-- vế vào một chỗ để lần sau đọc là thấy đủ luật ảnh theo `kind`, không phải ghép
-- từ hai constraint rời.
alter table public.flashcard_pages
  drop constraint flashcard_pages_image_kind_check;

alter table public.flashcard_pages
  add constraint flashcard_pages_image_kind_check check (
    (
      -- Trang mở đầu: HAI ảnh bắt buộc (chốt `Q5`, không đổi).
      kind = 'session_cover'
      and front_image_path is not null
      and back_image_path is not null
    )
    or (
      -- Thẻ từ vựng: ảnh mặt trước TUỲ CHỌN, mặt sau LUÔN rỗng (mặt sau là chữ).
      kind = 'vocabulary'
      and back_image_path is null
    )
  );

comment on column public.flashcard_pages.back_image_path is
  'Ảnh mặt sau — CHỈ dùng cho trang mở đầu (session_cover, hai ảnh không chữ). '
  'Thẻ từ vựng luôn để null: mặt sau thẻ từ vựng dựng bằng chữ từ Phase 16 '
  '(flashcard_pages_image_kind_check ép vế này). User chốt 2026-07-25.';
