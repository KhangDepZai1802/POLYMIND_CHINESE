-- ============================================================================
-- 80 — Trang flashcard CÔNG KHAI cho mã QR in trong sách giáo khoa (P17-T1)
--
-- ⚠️ ĐỌC KỸ TRƯỚC KHI "SỬA CHO ĐÚNG LUẬT" ⚠️
--
-- Migration này CỐ Ý mở invariant "`anon` deny tuyệt đối" của repo. Đây là
-- quyết định `D-36`, user chốt 2026-07-25, KHÔNG phải sơ suất.
--
-- Bề mặt mở ra đúng HAI thứ, không hơn:
--   1. `public.get_public_flashcard_session(text)` — RPC CHỈ ĐỌC (`stable`),
--      nhận mã liên kết, trả nội dung một buổi. Không có đường ghi nào.
--   2. Một policy SELECT trên `storage.objects` để ảnh/audio của buổi đang
--      công khai tải được.
--
-- `anon` vẫn KHÔNG có SELECT trên bất kỳ bảng nào và KHÔNG chạm được schema
-- `app`. `rls_catalog_matrix.test.sql` đã đổi từ "đếm bằng 0" sang DANH SÁCH
-- TRẮNG THEO TÊN — thêm một RPC anon thứ hai là bài kiểm đỏ ngay.
--
-- Gỡ hai thứ trên đi = mọi mã QR đã in trong sách giấy chết đồng loạt, và
-- không thu hồi lại được. Vướng thì hỏi user, đừng tự sửa.
-- ============================================================================

-- ============================================================================
-- 1. Schema `share` — nơi DUY NHẤT `anon` được phép nhìn thấy
-- ============================================================================
--
-- Vì sao KHÔNG đặt hàm kiểm quyền media vào schema `app`: `anon` hiện không có
-- USAGE trên `app` (`20260713000001_enums_and_identity.sql:6`). Cấp USAGE là mở
-- CẢ schema — mà nhiều hàm `app.*` tạo sau `20260713000010_app_helpers.sql:212`
-- thiếu `revoke ... from public`, nên chúng vẫn còn EXECUTE mặc định của
-- `PUBLIC`. Một dòng grant sẽ lặng lẽ phát cho `anon` cả nắm hàm nội bộ.
--
-- Vì sao KHÔNG đặt vào `public`: PostgREST sẽ expose nó thành endpoint RPC.
--
-- `share` chứa ĐÚNG MỘT hàm và pgTAP ghim con số đó → bán kính nổ bằng 0.
create schema share;

revoke all on schema share from public;
grant usage on schema share to anon;

comment on schema share is
  'Bề mặt CÔNG KHAI duy nhất. Chỉ chứa hàm mà `anon` được phép gọi. '
  'Thêm bất cứ thứ gì vào đây là mở rộng bề mặt tấn công — pgTAP đang đếm.';

-- ============================================================================
-- 2. Sinh mã liên kết — 60 bit, không phụ thuộc pgcrypto
-- ============================================================================
create or replace function app.new_flashcard_link_token()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- 32 ký tự. Cố ý BỎ `i` `l` `o` `u`: mã này được in ra giấy rồi có người gõ
  -- lại bằng tay, mà `1/l` và `0/O` đọc nhầm là chuyện có thật.
  v_alphabet constant text := '0123456789abcdefghjkmnpqrstvwxyz';
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_token text := '';
  v_i integer;
begin
  -- Bỏ byte 6 và byte 8: UUID v4 ghim cứng bit version/variant ở đúng hai chỗ
  -- đó. Lấy chúng vào là mất 6 bit ngẫu nhiên một cách vô hình.
  --
  -- 256 % 32 = 0 nên phép `% 32` KHÔNG lệch phân phối (modulo bias).
  -- 12 ký tự × 5 bit = 60 bit ngẫu nhiên mạnh.
  foreach v_i in array array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13] loop
    v_token := v_token || substr(v_alphabet, 1 + (get_byte(v_bytes, v_i) % 32), 1);
  end loop;
  return v_token;
end;
$$;

revoke all on function app.new_flashcard_link_token() from public, anon, authenticated;

-- ============================================================================
-- 3. Bảng liên kết công khai
-- ============================================================================
create table public.flashcard_public_links (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.flashcard_sections(id) on delete restrict,
  token text not null,
  label text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  -- Hình dạng mã là BẤT BIẾN, không phải luật giao diện: có nó thì hàm đọc
  -- không bao giờ phải đem rác đi so với cột `token`.
  constraint flashcard_public_links_token_shape_check
    check (token ~ '^[0-9a-hjkmnp-tv-z]{12}$'),
  -- Thu hồi mà không biết ai thu hồi = mất truy vết. Ràng buộc hai chiều nên
  -- không thể "thu hồi ẩn danh", cũng không thể gán người thu hồi cho một
  -- liên kết còn sống.
  constraint flashcard_public_links_revoke_pairing_check
    check ((revoked_at is null) = (revoked_by is null))
);

-- Mã duy nhất trên TOÀN bảng, kể cả hàng đã thu hồi: một mã đã in trong sách
-- giấy không bao giờ được tái sinh để trỏ sang buổi khác.
create unique index ux_flashcard_public_links_token
  on public.flashcard_public_links (token);

-- Mỗi buổi tối đa MỘT liên kết còn hiệu lực. Idempotency cưỡng chế ở DB đúng
-- như `BUG_M09_01` đòi, không phải kiểm ở tầng app.
create unique index ux_flashcard_public_links_active_section
  on public.flashcard_public_links (section_id)
  where revoked_at is null;

create index ix_flashcard_public_links_section
  on public.flashcard_public_links (section_id, created_at desc);

comment on table public.flashcard_public_links is
  'Liên kết công khai cho mã QR in trong sách. Trạng thái "đang công khai" là '
  'DẪN XUẤT (`revoked_at is null`), cố ý không có cột cờ riêng — hai nguồn sự '
  'thật cho cùng một dữ liệu chính là hình dạng của `BUG_M10_01`.';
comment on column public.flashcard_public_links.token is
  'Mã 12 ký tự, 60 bit ngẫu nhiên, sinh bởi `app.new_flashcard_link_token()`. '
  'Client KHÔNG được tự đặt.';
comment on column public.flashcard_public_links.revoked_at is
  'Thu hồi là xoá MỀM. Không hard delete: cần tra được mã nào đã in ra sách và '
  'bị gỡ lúc nào (`AGENTS.md` §61).';

alter table public.flashcard_public_links enable row level security;

create policy flashcard_public_links_admin_read
on public.flashcard_public_links
for select to authenticated
using (app.is_super_admin());

-- CỐ Ý chỉ cấp SELECT. Mọi thao tác GHI đi qua RPC `security definer` bên
-- dưới, giống cách `audit_logs` được bảo vệ (`20260713000015_grants.sql:59`):
-- một policy viết sai cũng không sửa được lịch sử công khai.
grant select on public.flashcard_public_links to authenticated;
revoke all on public.flashcard_public_links from anon;

-- ============================================================================
-- 4. RPC CÔNG KHAI — cửa duy nhất của `anon`
-- ============================================================================
--
-- `stable`: hàm này KHÔNG ghi gì. "Read-only tuyệt đối" được cưỡng chế ở tầng
-- DB chứ không phải bằng lời hứa ở tầng app. Muốn đếm lượt quét thì đó là task
-- riêng với bảng riêng — đừng gài kèm vào đây.
--
-- Sáu vế fail-closed đều nằm ở `join`/`where`. Thiếu bất kỳ vế nào thì `target`
-- rỗng → hàm trả `null`. Không có nhánh `else`, không có mặc định "cho qua".
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
           d.title as deck_title, c.title as course_title
    from token
    join public.flashcard_public_links l
      on l.token = token.value
     and l.revoked_at is null                       -- (1) chưa thu hồi
    join public.flashcard_sections s
      on s.id = l.section_id
     and s.status = 'published'                     -- (2) buổi đã công bố
     and s.archived_at is null                      -- (3) buổi chưa xoá mềm
    join public.flashcard_decks d
      on d.id = s.deck_id
     and d.status = 'published'                     -- (4) bộ thẻ đã công bố
    join public.courses c on c.id = d.course_id
    where token.value ~ '^[0-9a-hjkmnp-tv-z]{12}$'  -- (5) sai hình dạng: dừng
  )
  select jsonb_build_object(
    'section', jsonb_build_object(
      'session_number', t.session_number,
      'title', t.title,
      'deck_title', t.deck_title,
      'course_title', t.course_title
    ),
    'pages', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          -- ⛔ KHÔNG trả UUID nào (page.id, section_id, deck_id): payload công
          -- khai không được dùng để đối chiếu chéo với dữ liệu rò từ nguồn
          -- khác. React dùng `order_index` làm khoá.
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
        and p.archived_at is null                   -- (6) trang xoá mềm không lộ
    ), '[]'::jsonb)
  )
  from target t;
$$;

-- CHỈ cấp cho `anon`, cố ý KHÔNG cấp cho `authenticated`: trang công khai luôn
-- dùng client mù cookie (`src/lib/supabase/public-client.ts`) nên vai luôn là
-- `anon`. Gọi được từ phiên đã đăng nhập nghĩa là có bug ở tầng app — để DB nói
-- "không" còn hơn để nó im lặng chạy đúng.
revoke all on function public.get_public_flashcard_session(text) from public, authenticated;
grant execute on function public.get_public_flashcard_session(text) to anon;

comment on function public.get_public_flashcard_session(text) is
  'CỬA CÔNG KHAI DUY NHẤT (D-36). Chỉ đọc. Nhận mã liên kết, trả nội dung một '
  'buổi flashcard. Mọi ca hỏng đều trả NULL — không phân biệt được lý do.';

-- ============================================================================
-- 5. Media cho `anon`
-- ============================================================================
create or replace function share.can_read_public_flashcard_media(p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_object_path is not null
    and exists (
      select 1
      from public.flashcard_pages p
      join public.flashcard_sections s on s.id = p.section_id
      join public.flashcard_decks d on d.id = s.deck_id
      join public.flashcard_public_links l
        on l.section_id = s.id
       and l.revoked_at is null
      where p.archived_at is null
        and s.status = 'published'
        and s.archived_at is null
        and d.status = 'published'
        -- `@>` chứ KHÔNG `= any(...)`: chỉ dạng này dùng được GIN
        -- `ix_flashcard_pages_media_paths`. Xem ghi chú
        -- `20260723000070_flashcard_structured_vocabulary.sql:181`.
        and p.media_paths @> array[p_object_path]
    );
$$;

revoke all on function share.can_read_public_flashcard_media(text) from public;
grant execute on function share.can_read_public_flashcard_media(text) to anon;

-- Đánh đổi đã ghi rõ trong kế hoạch: policy Storage KHÔNG nhìn thấy được mã
-- liên kết (storage-api chạy trên connection riêng, không có ngữ cảnh URL của
-- Next.js). Nên vị ngữ chỉ là "file thuộc một buổi đang công khai", không phải
-- "đúng buổi ứng với mã trên URL". Buổi CHƯA công khai và buổi ĐÃ thu hồi vẫn
-- kín hoàn toàn — đó là vế quan trọng và có bài E2E chứng minh.
create policy flashcard_media_public_link_read
on storage.objects
for select to anon
using (
  bucket_id = 'flashcard-media'
  and share.can_read_public_flashcard_media(name)
);

-- ============================================================================
-- 6. RPC quản trị
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
declare
  v_status public.flashcard_status;
  v_archived timestamptz;
  v_token text;
  v_id uuid;
  v_attempt integer := 0;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được tạo liên kết công khai';
  end if;

  select s.status, s.archived_at into v_status, v_archived
  from public.flashcard_sections s
  where s.id = p_section_id
  for update;

  if not found then
    raise exception 'Không tìm thấy buổi flashcard';
  end if;

  -- Không cho phát hành mã QR trỏ vào buổi nháp/đã xoá: mã in ra giấy sẽ chết
  -- ngay từ lúc in.
  if v_archived is not null or v_status <> 'published' then
    raise exception 'Chỉ công khai được buổi flashcard đã công bố';
  end if;

  if exists (
    select 1 from public.flashcard_public_links l
    where l.section_id = p_section_id and l.revoked_at is null
  ) then
    raise exception 'Buổi này đã có liên kết công khai đang hoạt động';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_token := app.new_flashcard_link_token();
    begin
      insert into public.flashcard_public_links (section_id, token, label)
      values (p_section_id, v_token, nullif(btrim(coalesce(p_label, '')), ''))
      returning id into v_id;
      exit;
    exception when unique_violation then
      -- Chỉ có thể là đụng `ux_..._token` (khả năng ~0 với 60 bit); vế
      -- "đã có liên kết sống" đã chặn ở trên rồi.
      if v_attempt >= 5 then
        raise exception 'Không sinh được mã liên kết duy nhất';
      end if;
    end;
  end loop;

  -- Ai tạo lấy từ `auth.uid()` bên trong hàm, KHÔNG nhận từ client
  -- (`BUG_M06_01`/`BUG_M12_01`).
  perform app.write_audit(
    'flashcard.public_link.create', 'flashcard_section', p_section_id,
    null, jsonb_build_object('link_id', v_id)
  );

  link_id := v_id;
  link_token := v_token;
  return next;
end;
$$;

revoke all on function public.create_flashcard_public_link(uuid, text) from public, anon;
grant execute on function public.create_flashcard_public_link(uuid, text) to authenticated;

create or replace function public.revoke_flashcard_public_link(p_link_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before public.flashcard_public_links;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ Super Admin được thu hồi liên kết công khai';
  end if;

  select * into v_before
  from public.flashcard_public_links
  where id = p_link_id and revoked_at is null
  for update;

  -- Idempotent: bấm thu hồi hai lần không được ném lỗi. Cùng khuôn với
  -- `set_flashcard_star` và `archive_flashcard_page`.
  if not found then
    return;
  end if;

  update public.flashcard_public_links
  set revoked_at = clock_timestamp(), revoked_by = auth.uid()
  where id = p_link_id;

  perform app.write_audit(
    'flashcard.public_link.revoke', 'flashcard_section', v_before.section_id,
    to_jsonb(v_before), null
  );
end;
$$;

revoke all on function public.revoke_flashcard_public_link(uuid) from public, anon;
grant execute on function public.revoke_flashcard_public_link(uuid) to authenticated;
