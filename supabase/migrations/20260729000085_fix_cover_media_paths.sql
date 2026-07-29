-- 85 — Tính lại `media_paths` cho trang mở đầu sau `…084` (forward-fix).
--
-- 🔴 LỖI CỦA `…084`, đo được trên cloud ngay sau khi áp:
--     cover_media_paths_con_back = 15   (đúng bằng số hàng `…084` vừa sửa)
--
-- `…084` dùng `alter table … disable trigger user` để đi vòng qua
-- `app.force_flashcard_actor` (migration chạy ngoài phiên đăng nhập) và
-- `app.guard_flashcard_page_history` (phần lớn buổi đang `published`). Nhưng
-- `disable trigger user` tắt **MỌI** trigger người dùng — trong đó có
-- `trg_flashcard_pages_media_paths`. Hệ quả: cột `back_image_path` đã về null
-- nhưng `media_paths` **vẫn ôm đường dẫn mặt sau**.
--
-- ⚠️ Đây KHÔNG chỉ là rác. `share.can_read_public_flashcard_media` và
-- `app.can_student_read_flashcard_media` đều xét bằng `media_paths @> array[path]`,
-- nên chừng nào đường dẫn còn nằm đó thì **ảnh mặt sau vẫn đọc được công khai**
-- qua trang QR — đúng thứ mà việc bỏ nó ra đáng lẽ phải chấm dứt. Nó cũng làm
-- `npm run media:prune-cover-back` xếp nhầm 15 file này vào nhóm "trang vẫn đang
-- tham chiếu" và từ chối dọn.
--
-- ⛔ BÀI HỌC CHO MỌI MIGRATION SAU: `disable trigger user` là con dao cùn — nó
-- tắt cả những trigger đang **giữ bất biến của dữ liệu**, không riêng mấy trigger
-- chặn quyền. Khi cần đi vòng, hãy tắt **ĐÍCH DANH** trigger cản đường và để
-- nguyên phần còn lại, đúng như file này làm.
--
-- Vì sao là migration mới chứ không sửa `…084`: `…084` **đã chạy production**
-- (áp 2026-07-29). Luật `AGENTS.md` — không sửa migration đã chạy, sai thì
-- forward-fix.

-- =====================================================================
-- 1. Tắt ĐÍCH DANH hai trigger cản đường — giữ nguyên trigger media_paths
-- =====================================================================
alter table public.flashcard_pages disable trigger trg_flashcard_pages_actor;
alter table public.flashcard_pages disable trigger trg_flashcard_pages_guard_history;

-- =====================================================================
-- 2. Chạm vào hàng để trigger tự tính lại
-- =====================================================================
-- Cố ý là phép gán KHÔNG đổi giá trị: `app.sync_flashcard_media_paths()` là
-- trigger BEFORE UPDATE và nó **ghi đè vô điều kiện** `new.media_paths` bằng giá
-- trị tính lại từ các cột. Nên chỉ cần một `update` bất kỳ chạm tới hàng là cột
-- được dựng lại đúng — không phải chép công thức tổng hợp ra đây thành nguồn sự
-- thật thứ hai (`BUG_M10_01`).
--
-- Phạm vi đúng bằng phạm vi `…084` đã đụng: chỉ `session_cover`.
update public.flashcard_pages
set media_paths = media_paths
where kind = 'session_cover';

alter table public.flashcard_pages enable trigger trg_flashcard_pages_actor;
alter table public.flashcard_pages enable trigger trg_flashcard_pages_guard_history;

-- =====================================================================
-- 3. Cổng chặn: không còn đường dẫn mồ côi nào
-- =====================================================================
-- Fail-closed. Nếu còn sót, migration phải ĐỎ ngay tại đây chứ không để lại một
-- bề mặt đọc công khai mà không ai biết. Kiểm bằng chính tính chất cần bảo đảm —
-- "mọi phần tử của `media_paths` phải là một media đang được trang tham chiếu" —
-- chứ không đếm riêng chuỗi `back-`, để bắt được cả những khe khác nếu sau này có
-- thêm.
do $$
declare
  v_orphan integer;
begin
  select count(*)::integer
  into v_orphan
  from public.flashcard_pages p,
       unnest(p.media_paths) as media(path)
  where media.path is not null
    and media.path not in (
      coalesce(p.front_image_path, ''),
      coalesce(p.back_image_path, ''),
      coalesce(p.audio_path, '')
    )
    and not exists (
      select 1
      from jsonb_array_elements(
             case when jsonb_typeof(p.example_sentences) = 'array'
                  then p.example_sentences else '[]'::jsonb end
             || case when jsonb_typeof(p.common_phrases) = 'array'
                     then p.common_phrases else '[]'::jsonb end
           ) as item
      where btrim(coalesce(item ->> 'image_path', '')) = media.path
    );

  if v_orphan > 0 then
    raise exception
      'COVER-1 forward-fix thất bại: còn % đường dẫn trong media_paths không thuộc trang nào. Không được để bề mặt đọc công khai này tồn tại.',
      v_orphan;
  end if;

  raise notice 'COVER-1: media_paths của trang mở đầu đã tính lại, 0 đường dẫn mồ côi.';
end;
$$;
