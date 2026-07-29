-- =====================================================================
-- `PERF-IMG-2` — đổi đuôi file media flashcard mà không đụng vào nội dung
-- =====================================================================
--
-- VÌ SAO CẦN: ảnh production là **PNG 1728×2496, ~3,8MB mỗi tấm** — mà chúng là
-- ảnh ĐỒ HOẠ PHẲNG, thứ PNG lưu cực kỳ lãng phí. Đo trên chính ảnh thật lấy về
-- từ `https://www.polymind.vn/t/vcb-bank-01`:
--
--   PNG gốc 3.770 KB → nén lại vẫn PNG: 748 KB → **WebP 1280px: 27 KB**
--
-- Tức giữ nguyên định dạng chỉ lấy được 1/28 phần thắng. Muốn phần còn lại thì
-- phải đổi đuôi file, mà đuôi file nằm trong `front_image_path` /
-- `back_image_path` / `image_path` của các mục `jsonb` — nên phải sửa DB.
--
-- 🔴 VÌ SAO PHẢI LÀ RPC CHỨ KHÔNG PHẢI `update` THẲNG:
-- `trg_flashcard_pages_guard_history` chặn mọi sửa đổi trang của buổi **đã công
-- bố** (kể cả `service_role` — nó là trigger, không phải RLS). Cách làm tay là
-- "hạ buổi về nháp → sửa → công bố lại", nhưng làm bằng nhiều lượt gọi rời rạc
-- thì đứt mạng giữa chừng để lại buổi ở trạng thái NHÁP: mã QR in trong sách
-- lập tức trả trang "Buổi N sắp mở" cho học sinh. Gói trọn trong MỘT hàm là gói
-- trọn trong MỘT transaction — hỏng ở bất kỳ đâu thì mọi thứ quay về như cũ.
--
-- PHẠM VI BỊ KHOÁ CỨNG: hàm chỉ đổi được **phần đuôi** của đường dẫn. Bỏ đuôi
-- ra thì đường dẫn cũ và mới phải GIỐNG HỆT nhau. Vì vậy nó không thể dùng để
-- chuyển media từ thẻ này sang thẻ khác, cũng không thể trỏ sang buổi khác —
-- kể cả khi bên gọi cố tình.

-- TRẢ VỀ danh sách đường dẫn CŨ đã thật sự được thay, chứ không phải số lượng.
-- Đây là điều kiện để script vận hành xoá object cũ một cách an toàn: chỉ xoá
-- đúng những file mà DB đã trỏ sang bản mới. Trả về con số thì script buộc phải
-- đoán, và đoán sai ở đây nghĩa là xoá mất ảnh mà thẻ vẫn đang trỏ tới.
-- 🔴 KHÔNG nhận `section_id` từ bên gọi — CỐ Ý.
-- Bản đầu bắt script tự suy buổi từ đường dẫn (`actor/deck/section/page/file`).
-- Quy ước đó đúng với ảnh do app tạo, nhưng sai với mọi đường dẫn có sẵn từ
-- trước hoặc nhập tay — và khi sai thì hàm báo "không tìm thấy buổi" trong khi
-- ảnh vẫn nằm đó, đang được một trang khác dùng. Để DB tự tra ngược từ
-- `media_paths` thì không còn giả định nào để mà sai.
create or replace function app.rewrite_flashcard_media_extension(
  p_mapping jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.flashcard_status;
  v_published_at timestamptz;
  v_section_id uuid;
  v_old text;
  v_new text;
  v_applied jsonb;
begin
  if jsonb_typeof(p_mapping) <> 'object' then
    raise exception 'Bảng đổi đường dẫn phải là một object jsonb';
  end if;

  -- Van chặn: chỉ cho đổi ĐUÔI. `regexp_replace` cắt đuôi cuối cùng; phần còn
  -- lại (actor/deck/section/page/slot-uuid) phải trùng khít.
  for v_old, v_new in
    select key, value #>> '{}' from jsonb_each(p_mapping)
  loop
    if v_new is null or btrim(v_new) = '' then
      raise exception 'Đường dẫn mới rỗng cho "%"', v_old;
    end if;
    if regexp_replace(v_old, '\.[A-Za-z0-9]+$', '')
       <> regexp_replace(v_new, '\.[A-Za-z0-9]+$', '') then
      raise exception
        'Chỉ được đổi phần đuôi file: "%" → "%" đổi cả phần thân', v_old, v_new;
    end if;
  end loop;

  -- Chụp danh sách đường dẫn SẼ đổi, TRƯỚC khi đổi — sau đó `media_paths` đã
  -- mang giá trị mới nên không tra ngược lại được nữa.
  select coalesce(jsonb_agg(distinct m.path), '[]'::jsonb)
  into v_applied
  from public.flashcard_pages p
  cross join lateral unnest(p.media_paths) as m(path)
  where p.archived_at is null
    and p_mapping ? m.path;

  if jsonb_array_length(v_applied) = 0 then
    return v_applied;
  end if;

  -- Từng buổi một, và chỉ những buổi thật sự có ảnh trong bảng tra.
  for v_section_id in
    select distinct p.section_id
    from public.flashcard_pages p
    cross join lateral unnest(p.media_paths) as m(path)
    where p.archived_at is null
      and p_mapping ? m.path
  loop
    -- Khoá hàng buổi: hai lượt chạy song song không cùng lúc hạ/nâng trạng thái.
    select s.status, s.published_at
    into v_status, v_published_at
    from public.flashcard_sections s
    where s.id = v_section_id
    for update;

    -- Hạ về nháp để `trg_flashcard_pages_guard_history` cho phép sửa trang. Nằm
    -- trong cùng transaction nên KHÔNG phiên nào khác nhìn thấy trạng thái này.
    if v_status = 'published' then
      update public.flashcard_sections
      set status = 'draft'
      where id = v_section_id;
    end if;

    update public.flashcard_pages p
    set
      front_image_path = coalesce(p_mapping ->> p.front_image_path, p.front_image_path),
      back_image_path = coalesce(p_mapping ->> p.back_image_path, p.back_image_path),
      example_sentences = app.remap_flashcard_media_paths(p.example_sentences, p_mapping),
      common_phrases = app.remap_flashcard_media_paths(p.common_phrases, p_mapping)
    where p.section_id = v_section_id
      and p.archived_at is null
      and exists (
        select 1 from unnest(p.media_paths) as m(path) where p_mapping ? m.path
      );

    -- Công bố lại kèm ĐÚNG mốc thời gian cũ. `validate_flashcard_section_publish`
    -- dùng `coalesce(new.published_at, clock_timestamp())` nên truyền giá trị cũ
    -- vào là nó giữ nguyên — buổi không bị mang mốc công bố mới.
    if v_status = 'published' then
      update public.flashcard_sections
      set status = 'published', published_at = v_published_at
      where id = v_section_id;
    end if;
  end loop;

  return v_applied;
end;
$$;

-- Đổi `image_path` bên trong mảng jsonb (câu ví dụ / cụm từ). Tách ra thành hàm
-- riêng để phần `update` ở trên đọc được thành câu, và để chỗ này có bài kiểm
-- riêng — đây là nơi dễ sai nhất: mục không có ảnh phải giữ nguyên y hệt, chứ
-- không được mọc thêm khoá `image_path` rỗng.
create or replace function app.remap_flashcard_media_paths(
  p_items jsonb,
  p_mapping jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_items) <> 'array' then p_items
    else (
      select coalesce(jsonb_agg(
        case
          when jsonb_typeof(item -> 'image_path') = 'string'
               and p_mapping ? (item ->> 'image_path')
          then jsonb_set(item, '{image_path}',
                 to_jsonb(p_mapping ->> (item ->> 'image_path')))
          else item
        end
        order by ordinality
      ), '[]'::jsonb)
      from jsonb_array_elements(p_items) with ordinality as t(item, ordinality)
    )
  end;
$$;

comment on function app.rewrite_flashcard_media_extension(jsonb) is
  'Đổi ĐUÔI file media của một buổi (vd .png → .webp) trong một transaction: '
  'tự hạ buổi về nháp rồi công bố lại đúng mốc cũ. Chỉ service_role gọi được.';

comment on function app.remap_flashcard_media_paths(jsonb, jsonb) is
  'Đổi image_path bên trong mảng jsonb theo bảng tra; mục không khớp giữ nguyên.';

revoke all on function app.rewrite_flashcard_media_extension(jsonb)
  from public, anon, authenticated;
revoke all on function app.remap_flashcard_media_paths(jsonb, jsonb)
  from public, anon, authenticated;

-- Chỉ `service_role` — tức chỉ chạy được từ máy chủ/script vận hành có khoá
-- service role, không bao giờ từ trình duyệt.
grant execute on function app.rewrite_flashcard_media_extension(jsonb)
  to service_role;

-- =====================================================================
-- Vỏ ở `public` — PostgREST chỉ phơi schema `public`
-- =====================================================================
-- Script vận hành gọi qua `supabase.rpc()`, mà đường đó chỉ với tới `public`.
-- Vỏ này KHÔNG có logic: toàn bộ luật nằm ở hàm `app.*` phía trên
-- (`BUG_M10_01` — một hành động, một đường ghi).
create or replace function public.rewrite_flashcard_media_extension(
  p_mapping jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app.rewrite_flashcard_media_extension(p_mapping);
$$;

comment on function public.rewrite_flashcard_media_extension(jsonb) is
  'Vỏ gọi cho script vận hành. Không có logic; xem app.rewrite_flashcard_media_extension.';

-- 🔴 `anon` và `authenticated` KHÔNG được đụng vào: đây là hàm đi vòng qua
-- `trg_flashcard_pages_guard_history`, thứ duy nhất đang chặn việc sửa nội dung
-- một buổi đã công bố.
revoke all on function public.rewrite_flashcard_media_extension(jsonb)
  from public, anon, authenticated;
grant execute on function public.rewrite_flashcard_media_extension(jsonb)
  to service_role;
