-- ============================================================================
-- 81 — Mã liên kết công khai CỐ ĐỊNH + tách "có link" khỏi "đã công bố" (`D-39`)
--
-- Bối cảnh: bên in sách cần 35 địa chỉ QR NGAY để dàn trang, trong khi phần lớn
-- buổi còn đang nháp. Thiết kế `…080` không cho việc đó xảy ra vì hai lẽ:
--
--   1. Mã là 60 bit NGẪU NHIÊN → chỉ biết sau khi bấm tạo, không đọc trước được.
--   2. `create_flashcard_public_link` từ chối buổi chưa `published` → chưa công
--      bố thì không có mã nào để mà in.
--
-- Migration này đổi ĐÚNG hai điều đó và không đụng gì khác:
--
--   • Mã sinh theo công thức `slug(mã khoá)-<số buổi 2 chữ số>` → `vcb-bank-01`.
--     Biết một mã là suy ra cả 35, nên in trước được.
--   • TẠO liên kết không còn đòi buổi đã công bố; ĐỌC nội dung thì vẫn đòi.
--     Quét sớm trả trạng thái `coming_soon` (không kèm nội dung) thay vì 404.
--
-- ⚠️ ĐÁNH ĐỔI ĐÃ CÂN NHẮC, ĐỪNG "SỬA CHO ĐÚNG LUẬT" NGƯỢC LẠI ⚠️
--
-- `…080` cố ý chọn mã KHÔNG ĐOÁN ĐƯỢC. Mã cố định vứt bỏ tính chất đó: ai cầm
-- một mã là dò ra toàn bộ buổi của khoá. Chấp nhận được vì đúng 35 mã ấy được
-- IN HẾT trong cùng một cuốn sách bán ra — thứ "bí mật" ấy vốn đã công khai từ
-- lúc sách rời nhà in. Nếu về sau có khoá bán lẻ theo từng buổi thì mô hình này
-- KHÔNG dùng lại được: lúc đó phải quay về mã ngẫu nhiên cho riêng khoá đó.
--
-- Cái KHÔNG đổi (và không được đổi): `anon` vẫn chỉ có đúng một RPC chỉ-đọc và
-- một policy Storage; media của buổi chưa công bố vẫn kín tuyệt đối; thu hồi
-- vẫn cắt cả nội dung lẫn media ngay lập tức.
-- ============================================================================

-- ============================================================================
-- 1. Hình dạng mã — nới từ "12 ký tự ngẫu nhiên" sang "slug"
-- ============================================================================
--
-- Mã cũ (`0123456789abcdefghjkmnpqrstvwxyz`, 12 ký tự) LỌT QUA hình dạng mới —
-- kiểm bằng chính pgTAP. Nghĩa là mọi mã đã phát hành trước hôm nay vẫn sống,
-- không có QR nào chết vì migration này.
--
-- Trần 48 ký tự là vế chống lạm dụng: mã dài thành URL dài thành QR dày, mà QR
-- dày thì điện thoại đời cũ quét không ra. Không phải luật giao diện — nó là
-- ràng buộc vật lý của cái máy quét.
alter table public.flashcard_public_links
  drop constraint flashcard_public_links_token_shape_check;

alter table public.flashcard_public_links
  add constraint flashcard_public_links_token_shape_check
  check (
    token ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and length(token) between 3 and 48
  );

comment on column public.flashcard_public_links.token is
  'Mã in trong sách. Từ `D-39` là mã CỐ ĐỊNH sinh bởi '
  '`app.flashcard_fixed_link_token()` theo `slug(mã khoá)-<số buổi>`. Mã ngẫu '
  'nhiên 12 ký tự phát hành trước `D-39` vẫn hợp lệ và vẫn hoạt động. Client '
  'KHÔNG bao giờ được tự đặt.';

-- ============================================================================
-- 2. Công thức sinh mã
-- ============================================================================
--
-- `stable` chứ không `volatile`: cùng một buổi luôn ra cùng một mã. Đó là toàn
-- bộ lý do tính năng này tồn tại — bên in phải suy ra được địa chỉ trước khi
-- ai bấm nút nào.
create or replace function app.flashcard_fixed_link_token(p_section_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_session integer;
  v_slug text;
begin
  select c.code, s.session_number into v_code, v_session
  from public.flashcard_sections s
  join public.flashcard_decks d on d.id = s.deck_id
  join public.courses c on c.id = d.course_id
  where s.id = p_section_id;

  if not found then
    raise exception 'Không tìm thấy buổi flashcard';
  end if;

  -- Mọi thứ không phải chữ-số gộp thành MỘT gạch nối: `VCB-BANK` → `vcb-bank`,
  -- `HSK 1 (A)` → `hsk-1-a`. Cắt gạch thừa hai đầu để không đẻ ra `-hsk-1-`.
  v_slug := btrim(regexp_replace(lower(v_code), '[^a-z0-9]+', '-', 'g'), '-');

  -- Mã khoá toàn ký tự lạ (ví dụ `###`) sẽ cho slug rỗng → mã thành `-01`, sai
  -- hình dạng, và lỗi sẽ nổ ở tận CHECK với thông báo khó hiểu. Chặn ngay đây
  -- để người bấm nút biết phải đi sửa mã khoá.
  if v_slug = '' then
    raise exception 'Mã khoá "%" không tạo được mã liên kết — đặt lại mã khoá bằng chữ và số', v_code;
  end if;

  -- `lpad` 2 chữ số để `vcb-bank-02` xếp đúng thứ tự cạnh `vcb-bank-10` trong
  -- mọi danh sách sắp xếp theo chuỗi (bảng tính của bên in cũng vậy). Buổi ≥100
  -- tự nhiên dài ra 3 chữ số, không cắt gì cả.
  return v_slug || '-' || lpad(v_session::text, 2, '0');
end;
$$;

revoke all on function app.flashcard_fixed_link_token(uuid) from public, anon, authenticated;

comment on function app.flashcard_fixed_link_token(uuid) is
  'Mã liên kết CỐ ĐỊNH của một buổi (`D-39`). Thuần hàm: cùng buổi → cùng mã, '
  'nên bên in suy ra được 35 địa chỉ trước khi admin bấm nút nào.';

-- Hàm sinh mã ngẫu nhiên của `…080` KHÔNG bị xoá: các mã nó đã phát hành vẫn
-- đang sống, và một khoá bán lẻ theo buổi trong tương lai sẽ cần lại đúng nó.
comment on function app.new_flashcard_link_token() is
  'Mã NGẪU NHIÊN 60 bit — lối phát hành cũ (`…080`). Từ `D-39` đường tạo liên '
  'kết mặc định dùng `app.flashcard_fixed_link_token()`; giữ hàm này cho các mã '
  'đã in và cho trường hợp cần mã không đoán được.';

-- ============================================================================
-- 3. MỘT đường ghi duy nhất cho "buổi này phải có liên kết"
-- ============================================================================
--
-- Cả RPC lẻ lẫn RPC hàng loạt đều gọi đúng hàm này. Hai đường ghi song song cho
-- cùng một hành động chính là hình dạng của `BUG_M10_01` — mà tính năng này có
-- tới hai điểm vào nên bẫy đó rất gần.
--
-- Idempotent theo đúng nghĩa `BUG_M09_01`: gọi lại KHÔNG ném lỗi, không sinh mã
-- thứ hai. Với mã cố định thì "tạo lại" vốn vô nghĩa — kết quả luôn là cùng một
-- chuỗi, nên biến nó thành lỗi chỉ làm nút "tạo cho cả bộ" gãy giữa chừng.
create or replace function app.upsert_flashcard_public_link(
  p_section_id uuid,
  p_label text default null,
  p_replace_legacy boolean default false
)
returns table (link_id uuid, link_token text, row_status text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_archived timestamptz;
  v_token text;
  v_existing public.flashcard_public_links;
  v_owner uuid;
begin
  -- Kiểm quyền nằm ở ĐÂY chứ không ở hai RPC bên ngoài: đặt ở lớp trong cùng
  -- thì điểm vào thứ ba viết sau này cũng không quên được.
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được tạo liên kết công khai';
  end if;

  select s.archived_at into v_archived
  from public.flashcard_sections s
  where s.id = p_section_id
  for update;

  if not found then
    raise exception 'Không tìm thấy buổi flashcard';
  end if;

  -- ⛔ CỐ Ý KHÔNG còn vế `status = 'published'` (`D-39`). Buổi ĐÃ XOÁ MỀM thì
  -- vẫn chặn: mã trỏ vào thứ đã bị xoá là mã chết vĩnh viễn, không phải "chưa
  -- tới ngày".
  if v_archived is not null then
    raise exception 'Buổi flashcard đã bị xoá — không phát hành liên kết được';
  end if;

  v_token := app.flashcard_fixed_link_token(p_section_id);

  -- Mã đã tồn tại trong bảng? Chỉ có hai khả năng, và chúng KHÁC nhau về hậu quả.
  select l.section_id into v_owner
  from public.flashcard_public_links l
  where l.token = v_token;

  -- (a) Mã đang thuộc buổi KHÁC — bất biến cứng của `…080`: một mã đã in không
  --     bao giờ được trỏ sang buổi khác. Chỉ xảy ra khi hai mã khoá cho ra cùng
  --     slug (`VCB-BANK` và `VCB.BANK`), tức là dữ liệu danh mục sai.
  if v_owner is not null and v_owner <> p_section_id then
    raise exception 'Mã cố định "%" đã thuộc một buổi khác — hai khoá đang trùng slug, sửa mã khoá trước', v_token;
  end if;

  -- (b) Mã thuộc ĐÚNG buổi này nhưng đã thu hồi → hồi sinh chính hàng đó.
  --     KHÔNG chèn hàng mới: unique index trên `token` phủ cả hàng đã thu hồi,
  --     và điều đó là cố ý. Hồi sinh hợp lệ vì mã cố định chỉ ánh xạ được về
  --     đúng một buổi — không có nguy cơ "mã cũ trỏ sang nội dung khác".
  if v_owner = p_section_id then
    select * into v_existing
    from public.flashcard_public_links l
    where l.token = v_token
    for update;

    if v_existing.revoked_at is null then
      link_id := v_existing.id;
      link_token := v_existing.token;
      row_status := 'existing';
      return next;
      return;
    end if;

    update public.flashcard_public_links
    set revoked_at = null,
        revoked_by = null,
        label = coalesce(nullif(btrim(coalesce(p_label, '')), ''), label)
    where id = v_existing.id;

    perform app.write_audit(
      'flashcard.public_link.create', 'flashcard_section', p_section_id,
      to_jsonb(v_existing),
      jsonb_build_object('link_id', v_existing.id, 'token', v_token, 'reactivated', true)
    );

    link_id := v_existing.id;
    link_token := v_token;
    row_status := 'reactivated';
    return next;
    return;
  end if;

  -- Buổi đang mang một mã NGẪU NHIÊN từ thời `…080`. Không tự ý thay: mã đó có
  -- thể đã nằm trên giấy rồi. Người bấm phải nói rõ là chấp nhận giết nó.
  select * into v_existing
  from public.flashcard_public_links l
  where l.section_id = p_section_id and l.revoked_at is null
  for update;

  if found then
    if not p_replace_legacy then
      raise exception 'Buổi này đang dùng mã cũ "%" — chọn thay mã nếu muốn chuyển sang mã cố định', v_existing.token;
    end if;

    update public.flashcard_public_links
    set revoked_at = clock_timestamp(), revoked_by = auth.uid()
    where id = v_existing.id;

    perform app.write_audit(
      'flashcard.public_link.revoke', 'flashcard_section', p_section_id,
      to_jsonb(v_existing),
      jsonb_build_object('reason', 'thay bằng mã cố định', 'new_token', v_token)
    );
  end if;

  -- `created_by` lấy từ `auth.uid()` bên trong hàm, KHÔNG nhận từ client
  -- (`BUG_M06_01`/`BUG_M12_01`).
  insert into public.flashcard_public_links (section_id, token, label)
  values (p_section_id, v_token, nullif(btrim(coalesce(p_label, '')), ''))
  returning id into link_id;

  perform app.write_audit(
    'flashcard.public_link.create', 'flashcard_section', p_section_id,
    null, jsonb_build_object('link_id', link_id, 'token', v_token)
  );

  link_token := v_token;
  row_status := 'created';
  return next;
end;
$$;

revoke all on function app.upsert_flashcard_public_link(uuid, text, boolean)
  from public, anon, authenticated;

comment on function app.upsert_flashcard_public_link(uuid, text, boolean) is
  'ĐƯỜNG GHI DUY NHẤT cho "buổi này phải có liên kết công khai" (`D-39`). '
  'Idempotent. Cả RPC lẻ lẫn RPC hàng loạt đều đi qua đây.';

-- ============================================================================
-- 4. RPC lẻ — giữ nguyên chữ ký để tầng app và mã cũ không phải đổi
-- ============================================================================
create or replace function public.create_flashcard_public_link(
  p_section_id uuid,
  p_label text default null
)
returns table (link_id uuid, link_token text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
  select u.link_id, u.link_token
  from app.upsert_flashcard_public_link(p_section_id, p_label, false) u;
end;
$$;

revoke all on function public.create_flashcard_public_link(uuid, text) from public, anon;
grant execute on function public.create_flashcard_public_link(uuid, text) to authenticated;

comment on function public.create_flashcard_public_link(uuid, text) is
  'Phát hành liên kết công khai CỐ ĐỊNH cho một buổi (`D-39`). Idempotent. '
  'Buổi chưa công bố vẫn có mã — nội dung chỉ hiện sau khi công bố.';

-- ============================================================================
-- 5. RPC hàng loạt — 35 buổi trong một lượt
-- ============================================================================
--
-- Vì sao là một RPC chứ không phải vòng lặp 35 lượt gọi ở tầng app: một lượt =
-- một transaction. Đứt mạng ở buổi thứ 20 mà đã ghi 19 hàng thì admin không biết
-- mình đang ở đâu, và `docs/08` gọi đúng thứ đó là trạng thái nửa vời.
create or replace function public.create_flashcard_public_links_for_deck(
  p_deck_id uuid,
  p_replace_legacy boolean default false
)
returns table (session_no integer, link_token text, row_status text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_section record;
  v_result record;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được tạo liên kết công khai';
  end if;

  if not exists (select 1 from public.flashcard_decks d where d.id = p_deck_id) then
    raise exception 'Không tìm thấy bộ thẻ';
  end if;

  for v_section in
    select s.id, s.session_number
    from public.flashcard_sections s
    where s.deck_id = p_deck_id
      and s.archived_at is null
    order by s.session_number
  loop
    select * into v_result
    from app.upsert_flashcard_public_link(v_section.id, null, p_replace_legacy);

    session_no := v_section.session_number;
    link_token := v_result.link_token;
    row_status := v_result.row_status;
    return next;
  end loop;
end;
$$;

revoke all on function public.create_flashcard_public_links_for_deck(uuid, boolean)
  from public, anon;
grant execute on function public.create_flashcard_public_links_for_deck(uuid, boolean)
  to authenticated;

comment on function public.create_flashcard_public_links_for_deck(uuid, boolean) is
  'Phát hành liên kết cố định cho MỌI buổi chưa xoá của một bộ thẻ, trong một '
  'transaction (`D-39`). Idempotent — chạy lại không sinh mã thứ hai.';

-- ============================================================================
-- 6. RPC công khai — thêm trạng thái `coming_soon`
-- ============================================================================
--
-- Vì sao phải phân biệt: mã đã in trong sách mà quét ra "không tìm thấy trang"
-- thì người mua kết luận là web hỏng (hoặc sách in sai), và họ không có cách
-- nào biết là chỉ cần đợi. Đây là ca dùng thật, không phải chi tiết kỹ thuật.
--
-- Rò rỉ thêm đúng MỘT bit: "mã này có tồn tại". Với mã cố định thì bit đó vốn
-- đã suy ra được từ chính công thức, nên đổi lại không mất gì.
--
-- Vế fail-closed KHÔNG suy giảm một chút nào:
--   • mã sai hình dạng / bịa / đã thu hồi → `null` (404), y như cũ;
--   • buổi đã xoá mềm → `null`, y như cũ;
--   • buổi/bộ thẻ chưa công bố → `coming_soon` KHÔNG kèm một chữ nội dung nào:
--     không tiêu đề, không Hán tự, không đường dẫn media.
create or replace function public.get_public_flashcard_session(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with token as (
    select lower(btrim(coalesce(p_token, ''))) as value
  ),
  target as (
    select s.id, s.session_number, s.title,
           d.title as deck_title, c.title as course_title,
           (s.status = 'published' and d.status = 'published') as is_live
    from token
    join public.flashcard_public_links l
      on l.token = token.value
     and l.revoked_at is null                       -- (1) chưa thu hồi
    join public.flashcard_sections s
      on s.id = l.section_id
     and s.archived_at is null                      -- (2) buổi chưa xoá mềm
    join public.flashcard_decks d
      on d.id = s.deck_id
    join public.courses c on c.id = d.course_id
    where token.value ~ '^[a-z0-9]+(-[a-z0-9]+)*$'  -- (3) sai hình dạng: dừng
      and length(token.value) between 3 and 48
  )
  select case
    when not t.is_live then
      -- (4) chưa công bố: đúng hai trường, đủ để trang nói "Buổi 5 sắp mở".
      -- Số buổi đã nằm sẵn trong chính mã trên URL nên không lộ thêm gì.
      jsonb_build_object(
        'state', 'coming_soon',
        'section', jsonb_build_object('session_number', t.session_number)
      )
    else
      jsonb_build_object(
        'state', 'ready',
        'section', jsonb_build_object(
          'session_number', t.session_number,
          'title', t.title,
          'deck_title', t.deck_title,
          'course_title', t.course_title
        ),
        'pages', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              -- ⛔ KHÔNG trả UUID nào (page.id, section_id, deck_id): payload
              -- công khai không được dùng để đối chiếu chéo với dữ liệu rò từ
              -- nguồn khác. React dùng `order_index` làm khoá.
              'order_index', p.order_index,
              'kind', p.kind,
              'hanzi', p.hanzi,
              'pinyin_syllables', p.pinyin_syllables,
              'meaning_vi', p.meaning_vi,
              'front_image_path', p.front_image_path,
              'back_image_path', p.back_image_path,
              'audio_path', p.audio_path,
              'front_alt', p.front_alt,
              'back_alt', p.back_alt,
              'example_sentences', p.example_sentences,
              'common_phrases', p.common_phrases,
              'media_paths', to_jsonb(p.media_paths)
            ) order by p.order_index
          )
          from public.flashcard_pages p
          where p.section_id = t.id
            and p.archived_at is null               -- (5) trang xoá mềm không lộ
        ), '[]'::jsonb)
      )
  end
  from target t;
$$;

revoke all on function public.get_public_flashcard_session(text) from public, authenticated;
grant execute on function public.get_public_flashcard_session(text) to anon;

comment on function public.get_public_flashcard_session(text) is
  'CỬA CÔNG KHAI DUY NHẤT (`D-36`, sửa bởi `D-39`). Chỉ đọc. Trả `state` = '
  '`ready` (kèm nội dung) hoặc `coming_soon` (KHÔNG kèm nội dung, cho buổi chưa '
  'công bố). Mã hỏng/thu hồi/buổi đã xoá đều trả NULL — không phân biệt lý do.';

-- `share.can_read_public_flashcard_media` GIỮ NGUYÊN, và đây là chỗ dễ "tiện tay
-- sửa cho đồng bộ" nhất: nó vẫn đòi `status = 'published'` ở cả buổi lẫn bộ thẻ.
-- Nới nó theo `coming_soon` sẽ khiến ảnh và audio của buổi chưa công bố tải về
-- được bằng đường dẫn trực tiếp — tức là nội dung chưa duyệt rò ra ngoài trong
-- khi trang web vẫn hiển thị "sắp mở". Đừng đụng.
