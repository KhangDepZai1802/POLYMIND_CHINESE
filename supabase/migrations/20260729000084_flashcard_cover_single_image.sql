-- 84 — Trang mở đầu dùng ĐÚNG MỘT ảnh cho cả hai mặt, và nhập ảnh mở đầu HÀNG
-- LOẠT cho mọi buổi của một bộ (`COVER-1`, user chốt 2026-07-29 → `D-41`).
--
-- Yêu cầu gốc, nguyên văn: *"đổi lại cơ chế upload ảnh của trang mở đầu, vẫn có
-- mặt trước mặt sau nhưng chỉ dùng đúng 1 ảnh được up lên để làm cả mặt trước và
-- sau"* + *"ở mỗi bộ flashcard thêm chức năng nhập hàng loạt hình … của trang mở
-- đầu cho tất cả các buổi có trong bộ"*.
--
-- 🔴 VÌ SAO LÀ "MỘT CỘT, VẼ HAI LẦN" CHỨ KHÔNG PHẢI "GHI CÙNG ĐƯỜNG DẪN VÀO CẢ
-- HAI CỘT" — ba cửa chặn độc lập, không cửa nào né được:
--   (a) `flashcard_pages_distinct_media_check` (`…066`) cấm thẳng
--       `front_image_path = back_image_path`;
--   (b) `ux_flashcard_pages_back_path` là unique TOÀN BẢNG trên `back_image_path`,
--       nên kể cả bỏ (a) thì một đường dẫn cũng không nằm được ở hai chỗ;
--   (c) `isOwnedFlashcardMediaPath` (`domain/media.ts`) soi **khe nằm trong tên
--       file** — một file `front-<uuid>.webp` không bao giờ hợp lệ ở khe `back`.
-- Đường còn lại là tải lên HAI BẢN y hệt: gấp đôi dung lượng bucket và gấp đôi
-- byte học sinh phải tải, tức trả lại đúng thứ `PERF-IMG-2` vừa lấy về (một ảnh
-- bìa WebP ~27KB × 2 × 35 buổi × mỗi lượt quét). Nên `back_image_path` của
-- `session_cover` từ nay **luôn null**, và mặt sau vẽ lại chính ảnh mặt trước ở
-- tầng hiển thị (`flashcard-face.tsx`).
--
-- ⛔ CỘT `back_image_path` GIỮ NGUYÊN, KHÔNG DROP. Sau file này không `kind` nào
-- còn dùng tới nó, nên cám dỗ là xoá hẳn cho sạch. Không làm, vì hai lý do đo
-- được: (1) `attachSignedMedia`, RPC công khai `get_public_flashcard_session`
-- (`…080`/`…081`) và `app.can_student_read_flashcard_media` đều đang đọc cột này,
-- nên drop biến một đợt "thu hẹp dữ liệu" thành một đợt phá vỡ bề mặt `anon` —
-- đúng thứ `D-36` cấm đụng vào; (2) đây là forward-fix, giữ cột null là bước lùi
-- được, drop cột thì không.
--
-- 🔴 THỨ TỰ RELEASE NGƯỢC VỚI `MULTIDECK-1` (`D-37`): đây là thay đổi **thu hẹp**
-- dữ liệu ⇒ **`git push` CODE TRƯỚC**, `db push` sau. Áp DB trước thì production
-- đang chạy code cũ sẽ vẽ mặt sau trang mở đầu thành ô "Không tải được ảnh mặt
-- sau" trên chính những trang QR đã in trong sách.

-- =====================================================================
-- 1. GỠ ràng buộc cũ TRƯỚC KHI đụng vào dữ liệu
-- =====================================================================
-- 🔴 THỨ TỰ Ở ĐÂY KHÔNG ĐƯỢC ĐẢO, và lý do đã trả giá một lần:
-- ràng buộc cũ (`…078`) đòi `session_cover ⇒ front NOT NULL **và** back NOT NULL`.
-- Null hoá `back_image_path` trong khi nó còn hiệu lực là **tự vi phạm nó ngay ở
-- hàng đầu tiên** — cloud trả `23514 flashcard_pages_image_kind_check` và cả
-- migration rollback.
--
-- ⚠️ Bản đầu của file này xếp `update` lên trước và **xanh trên local**: DB local
-- dựng lại từ `db:reset` chạy migration TRƯỚC khi seed, nên lúc đó bảng có đúng
-- 0 hàng và câu `update` không đụng gì cả. Lỗi chỉ lộ ra trên cloud, nơi có 15
-- trang mở đầu thật. **Bài học: bước sửa dữ liệu trong migration không bao giờ
-- được kiểm chứng bởi một lần `db:reset` — hãy xếp DDL sao cho nó đúng bất kể
-- bảng có bao nhiêu hàng.**
alter table public.flashcard_pages
  drop constraint flashcard_pages_image_kind_check;

-- =====================================================================
-- 2. Ép mọi trang mở đầu về MỘT ảnh
-- =====================================================================
-- User chốt "ép tất cả về 1 ảnh ngay" sau khi Claude nêu rủi ro mất nội dung ảnh
-- mặt sau đang chạy trên production. Đo cloud trước khi áp (2026-07-29):
--     tong_trang_mo_dau = 14 · co_anh_mat_sau = 15 · the_tu_vung_con_back = 0
-- (15 > 14 vì có một trang mở đầu đã lưu trữ vẫn giữ đường dẫn mặt sau.)
--
-- ⚠️ MIGRATION KHÔNG XOÁ FILE. Nó chỉ bỏ THAM CHIẾU; object vẫn nằm nguyên trong
-- bucket `flashcard-media`. Đó là cửa khôi phục duy nhất nếu user đổi ý — dọn
-- bằng `npm run media:prune-cover-back` (mặc định chạy khô, in danh sách trước).
--
-- `back_alt` phải null theo: `flashcard_pages_alt_pairing_check` (`…070`) buộc
-- "có ảnh ⇔ có alt", để lại alt mồ côi thì constraint nổ ngay ở bước 2.
--
-- Tắt trigger user y hệt `…068`: migration chạy ngoài phiên đăng nhập
-- (`auth.uid()` null ⇒ `app.force_flashcard_actor` ném lỗi) và phần lớn buổi
-- đang ở trạng thái `published` (⇒ `app.guard_flashcard_page_history` từ chối).
alter table public.flashcard_pages disable trigger user;

do $$
declare
  v_count integer;
begin
  select count(*)::integer
  into v_count
  from public.flashcard_pages
  where kind = 'session_cover'
    and back_image_path is not null;

  update public.flashcard_pages
  set back_image_path = null,
      back_alt = null
  where kind = 'session_cover'
    and (back_image_path is not null or back_alt is not null);

  -- In ra để log migration có con số đối chiếu với danh sách mà script dọn file
  -- sẽ tìm được. Hai con số lệch nhau = có file đã bị xoá tay từ trước.
  raise notice
    'COVER-1: đã bỏ tham chiếu ảnh mặt sau của % trang mở đầu. File vẫn còn trong bucket — chạy `npm run media:prune-cover-back` để soi và dọn.',
    v_count;
end;
$$;

alter table public.flashcard_pages enable trigger user;

-- `media_paths` được `app.sync_flashcard_media_paths()` (`…070`) tính lại ở
-- trigger BEFORE UPDATE nên đường dẫn mặt sau tự rơi khỏi mảng. Đó cũng chính là
-- thứ làm object thành "mồ côi" và là cách script dọn nhận ra nó.

-- =====================================================================
-- 3. Siết ràng buộc mới: trang mở đầu MỘT ảnh
-- =====================================================================
-- Dựng lại tường minh đúng lối `…078`: gộp đủ luật ảnh theo `kind` vào MỘT
-- constraint để lần sau đọc là thấy hết, không phải ghép từ hai mảnh. Câu `drop`
-- đã chạy ở bước 1 — nó phải đứng trước bước sửa dữ liệu, xem lý do ở đó.
--
-- Postgres kiểm constraint mới trên TOÀN BỘ bảng lúc `add`, nên đây cũng là chỗ
-- xác nhận bước 2 đã dọn sạch: còn sót một hàng là câu này đỏ.
alter table public.flashcard_pages
  add constraint flashcard_pages_image_kind_check check (
    (
      -- Trang mở đầu: ĐÚNG MỘT ảnh (`D-41`, đảo `Q5`). Mặt sau vẽ lại chính ảnh
      -- này ở tầng hiển thị — DB không biết gì về "hai mặt".
      kind = 'session_cover'
      and front_image_path is not null
      and back_image_path is null
    )
    or (
      -- Thẻ từ vựng: ảnh mặt trước TUỲ CHỌN, mặt sau LUÔN rỗng (`…078`).
      kind = 'vocabulary'
      and back_image_path is null
    )
  );

comment on column public.flashcard_pages.back_image_path is
  'ĐÃ NGHỈ HƯU từ 2026-07-29 (`D-41`) — luôn null với MỌI kind. Trang mở đầu nay '
  'dùng đúng một ảnh (front_image_path) vẽ cho cả hai mặt; thẻ từ vựng có mặt sau '
  'bằng chữ từ `…078`. Cột giữ lại (không drop) vì RPC công khai và helper media '
  'của anon còn đọc nó — xem đầu file `…084`.';

-- =====================================================================
-- 4. RPC: gắn ảnh mở đầu HÀNG LOẠT cho cả bộ thẻ
-- =====================================================================
-- `p_covers` là mảng jsonb, mỗi phần tử:
--   { "section_id": uuid, "page_id": uuid,
--     "front_image_path": text, "front_alt": text }
--
-- `page_id` do TẦNG APP cấp — cùng mã đã dùng để dựng đường dẫn object lúc xin
-- vé tải lên (`actor/deck/section/page/front-<uuid>.<ext>`). Sinh mã ở đây thì
-- đường dẫn đã tải lên trỏ vào một `page_id` khác và `isOwnedFlashcardMediaPath`
-- ở lượt sửa tiếp theo sẽ từ chối chính file này.
--
-- ⚠️ `front_alt` tính ở tầng app bằng `flashcardAltText()`, KHÔNG dựng lại bằng
-- SQL — cùng lý do đã ghi ở `…077`: hai bản câu alt sẽ trôi khác nhau và lệch alt
-- là thứ chỉ trình đọc màn hình thấy.
--
-- 🔴 BUỔI ĐÃ CÔNG BỐ BỊ BỎ QUA, KHÔNG NÉM LỖI (user chốt, `D-41` điểm 4). Đây là
-- chỗ khác hẳn `…077`: ở đó cả lượt gắn nhắm vào MỘT buổi nên buổi sai trạng thái
-- là yêu cầu hỏng; ở đây một lượt chạm tới 35 buổi và "buổi 3 đã công bố" là kết
-- quả nghiệp vụ **bình thường** — ném lỗi thì 34 buổi còn lại chết theo. Tự hạ
-- buổi về nháp cũng bị loại: buổi đã in mã QR sẽ trả 404 trong lúc chạy, và đứt
-- giữa chừng thì nó nằm lại ở nháp mà không ai biết.
create or replace function public.attach_flashcard_deck_covers(
  p_deck_id uuid,
  p_covers jsonb,
  p_allow_overwrite boolean default false
)
returns table (
  section_id uuid,
  -- 'created' | 'replaced' | 'skipped_existing' | 'skipped_published'
  row_status text,
  -- File cũ bị thay. Tầng app dọn khỏi bucket private, giống `…077`.
  removed_paths text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deck public.flashcard_decks;
  v_item jsonb;
  v_section public.flashcard_sections;
  v_page public.flashcard_pages;
  v_front text;
  v_front_alt text;
  v_page_id uuid;
  v_seen uuid[] := '{}'::uuid[];
  v_created integer := 0;
  v_replaced integer := 0;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được gắn ảnh mở đầu flashcard';
  end if;

  if jsonb_typeof(p_covers) <> 'array' then
    raise exception 'Danh sách ảnh mở đầu không hợp lệ';
  end if;

  select * into v_deck
  from public.flashcard_decks
  where id = p_deck_id
  for update;

  if v_deck.id is null then
    raise exception 'Không tìm thấy bộ flashcard';
  end if;

  for v_item in select * from jsonb_array_elements(p_covers)
  loop
    section_id := (v_item ->> 'section_id')::uuid;
    v_page_id := (v_item ->> 'page_id')::uuid;

    -- Một buổi chỉ nhận MỘT ảnh trong một lượt. Trùng ở đây nghĩa là client tính
    -- sai (bảng đối chiếu đã loại ca đó), nên dừng cả lượt thay vì chọn bừa —
    -- chọn bừa thì kết quả đổi giữa hai lần chạy cùng bộ file.
    if section_id = any(v_seen) then
      raise exception 'Mỗi buổi chỉ nhận một ảnh mở đầu trong một lượt';
    end if;
    v_seen := v_seen || section_id;

    -- ⚠️ Khoá hàng buổi trước khi đọc trang: không khoá thì hai lượt chạy chồng
    -- nhau cùng thấy "buổi chưa có trang mở đầu" và cùng insert, rồi một trong
    -- hai chết vì `ux_flashcard_pages_active_cover` — sau khi đã tải file lên.
    select * into v_section
    from public.flashcard_sections
    where id = section_id
    for update;

    -- Buổi không thuộc bộ này là yêu cầu hỏng hoặc yêu cầu gian: dừng CẢ LƯỢT.
    -- Vế fail-closed, khác hẳn "buổi đã công bố" bên dưới.
    if v_section.id is null
       or v_section.deck_id <> p_deck_id
       or v_section.archived_at is not null then
      raise exception 'Buổi flashcard không thuộc bộ đã chọn';
    end if;

    v_front := nullif(btrim(coalesce(v_item ->> 'front_image_path', '')), '');
    v_front_alt := nullif(btrim(coalesce(v_item ->> 'front_alt', '')), '');

    if v_front is null then
      raise exception 'Thiếu đường dẫn ảnh mở đầu cho buổi %', v_section.session_number;
    end if;
    if v_front_alt is null then
      raise exception 'Thiếu alt cho ảnh mở đầu buổi %', v_section.session_number;
    end if;

    removed_paths := '{}'::text[];

    if v_section.status <> 'draft' then
      row_status := 'skipped_published';
      return next;
      continue;
    end if;

    select * into v_page
    from public.flashcard_pages
    where public.flashcard_pages.section_id = v_section.id
      and kind = 'session_cover'
      and archived_at is null
    for update;

    if v_page.id is null then
      -- Chưa có trang mở đầu → tạo mới ở `order_index = 0`. Ô 0 luôn trống:
      -- `flashcard_pages_kind_order_check` ép trang từ vựng phải có
      -- `order_index > 0`, nên không đụng `ux_flashcard_pages_active_order`.
      insert into public.flashcard_pages (
        id,
        section_id,
        kind,
        order_index,
        front_image_path,
        front_alt
      )
      values (
        v_page_id,
        v_section.id,
        'session_cover',
        0,
        v_front,
        v_front_alt
      );
      v_created := v_created + 1;
      row_status := 'created';
      return next;
      continue;
    end if;

    if not p_allow_overwrite then
      row_status := 'skipped_existing';
      return next;
      continue;
    end if;

    if v_page.front_image_path is not null
       and v_page.front_image_path <> v_front then
      removed_paths := removed_paths || v_page.front_image_path;
    end if;

    -- Ghi ĐÚNG hai cột của ảnh mở đầu. Trang mở đầu không mang chữ, không audio
    -- và không danh sách con nào, nên ở đây không có nguy cơ ghi rỗng đè dữ liệu
    -- người soạn gõ tay như `…077` phải đề phòng.
    update public.flashcard_pages
    set front_image_path = v_front,
        front_alt = v_front_alt
    where id = v_page.id;

    v_replaced := v_replaced + 1;
    row_status := 'replaced';
    return next;
  end loop;

  perform app.write_audit(
    'bulk_attach_covers',
    'flashcard_deck',
    p_deck_id,
    null,
    jsonb_build_object(
      'created_count', v_created,
      'replaced_count', v_replaced,
      'allow_overwrite', p_allow_overwrite
    )
  );
end;
$$;

revoke all on function public.attach_flashcard_deck_covers(uuid, jsonb, boolean)
  from public, anon;
grant execute on function public.attach_flashcard_deck_covers(uuid, jsonb, boolean)
  to authenticated;

comment on function public.attach_flashcard_deck_covers(uuid, jsonb, boolean) is
  'Gắn ảnh trang mở đầu hàng loạt cho mọi buổi NHÁP của một bộ (`COVER-1`/`D-41`). '
  'Buổi đã công bố trả row_status = skipped_published thay vì ném lỗi. '
  'Đường ghi DUY NHẤT cho ảnh mở đầu hàng loạt.';
