-- ============================================================================
-- 83 — MỘT KHOÁ HỌC ĐƯỢC CÓ NHIỀU BỘ FLASHCARD (`MULTIDECK-1`, user chốt 2026-07-29)
--
-- Bối cảnh: `20260721000066_flashcards.sql:8` khai `course_id ... unique`. Không
-- có luật nghiệp vụ nào ghi "mỗi khoá một bộ" — chỉ có đúng dòng đó chặn. Bỏ nó
-- ra thì lộ ngay một va chạm THẬT ở tầng khác:
--
--   `app.flashcard_fixed_link_token()` (`…081`) sinh mã từ **mã KHOÁ** + số buổi.
--   Một khoá hai bộ ⇒ buổi 1 của cả hai bộ cùng đòi `vcb-bank-01` ⇒ RPC ném
--   *"Mã cố định … đã thuộc một buổi khác"*. Không né được, phải đổi công thức.
--
-- User chốt: **mã bộ thay chỗ mã khoá** → `<mã bộ>-<số buổi>`.
--
-- 🔴 ĐIỀU KIỆN SỐNG CÒN CỦA MIGRATION NÀY: 35 mã `vcb-bank-01`…`-35` đã được
-- phát hành trên cloud (2026-07-27) và đang trên đường vào sách in. Backfill gán
-- mã bộ = **slug của mã khoá**, tức đúng chuỗi mà công thức cũ đang dùng ⇒ mọi
-- mã cũ ra **y hệt**. pgTAP ghim chuỗi cụ thể `vcb-bank-35`, không ghim hình
-- dạng: ghim hình dạng thì đổi công thức sai vẫn xanh.
--
-- ⛔ CÁI KHÔNG ĐỔI: bề mặt `anon` của `D-36`/`D-39` **giữ nguyên vẹn** — vẫn
-- đúng một RPC `public.get_public_flashcard_session(text)` và một policy Storage.
-- User đã BỎ yêu cầu "link riêng cho cả bộ thẻ" (2026-07-29) chính vì mỗi bộ nay
-- đã có dải địa chỉ riêng; thêm RPC cấp bộ là mở thêm bề mặt cho một thứ không
-- còn ai cần.
-- ============================================================================

-- ============================================================================
-- 1. Gỡ ràng buộc "mỗi khoá một bộ"
-- ============================================================================
--
-- Chỉ bỏ tính DUY NHẤT, giữ nguyên khoá ngoại và `on delete restrict`. Index tra
-- theo khoá vẫn còn: `ix_flashcard_decks_course_status(course_id, status)` ở
-- migration 66 — không có cột nào mất index vì thao tác này.
alter table public.flashcard_decks
  drop constraint flashcard_decks_course_id_key;

-- ============================================================================
-- 2. Mã bộ — thứ thay chỗ mã khoá trong địa chỉ QR
-- ============================================================================
alter table public.flashcard_decks
  add column code text;

-- Backfill trước, `not null` sau — thứ tự bắt buộc vì bảng đang có dữ liệu thật.
update public.flashcard_decks d
set code = btrim(regexp_replace(lower(c.code), '[^a-z0-9]+', '-', 'g'), '-')
from public.courses c
where c.id = d.course_id;

-- Ba cách backfill hỏng, mỗi cách một thông báo RIÊNG. Gộp thành một câu
-- "backfill thất bại" thì người áp migration trên cloud không biết phải đi sửa
-- cái gì, mà đây là loại lỗi chỉ lộ ra trên dữ liệu production.
do $$
declare
  v_bad text;
begin
  -- (a) Mã khoá không có chữ-số nào (`###`) ⇒ slug rỗng. Cùng lỗi mà
  --     `app.flashcard_fixed_link_token()` đã chặn từ `…081`, chỉ khác là ở đây
  --     nó nổ sớm hơn: lúc áp migration chứ không phải lúc admin bấm nút.
  select string_agg(distinct c.code, ', ')
  into v_bad
  from public.flashcard_decks d
  join public.courses c on c.id = d.course_id
  where coalesce(d.code, '') = '';

  if v_bad is not null then
    raise exception
      'Mã khoá "%" không có chữ hoặc số nào nên không sinh được mã bộ. Sửa mã khoá rồi áp lại migration.', v_bad;
  end if;

  -- (b) Hai khoá cho ra cùng một slug (`VCB-BANK` và `VCB.BANK`). Đây đúng là
  --     tình huống mà `…081` đã cảnh báo ở nhánh "hai khoá trùng slug". Tự ý
  --     thêm hậu tố `-2` là lặng lẽ đổi địa chỉ của một bộ có thể đã in — phải
  --     để người biết dữ liệu quyết định.
  select string_agg(code, ', ')
  into v_bad
  from (
    select code
    from public.flashcard_decks
    group by code
    having count(*) > 1
  ) dup;

  if v_bad is not null then
    raise exception
      'Mã bộ "%" bị trùng do hai mã khoá cho ra cùng một slug. Đặt lại mã khoá cho khác nhau rồi áp lại migration.', v_bad;
  end if;

  -- (c) Slug dài quá trần. Cắt bớt là đổi địa chỉ đã in — cấm.
  select string_agg(code, ', ')
  into v_bad
  from public.flashcard_decks
  where length(code) > 40;

  if v_bad is not null then
    raise exception
      'Mã bộ "%" dài quá 40 ký tự. Rút ngắn mã khoá rồi áp lại migration.', v_bad;
  end if;
end;
$$;

alter table public.flashcard_decks
  alter column code set not null;

-- Hình dạng y hệt `flashcard_public_links_token_shape_check` (`…081`) trừ độ
-- dài: mã liên kết = `mã bộ` || '-' || số buổi 2 chữ số. Trần 40 để mã liên kết
-- luôn lọt trần 48 của bảng liên kết, kể cả buổi ≥ 100 (4 ký tự đuôi).
alter table public.flashcard_decks
  add constraint flashcard_decks_code_shape_check
  check (
    code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and length(code) between 2 and 40
  );

-- Duy nhất TOÀN BẢNG, không phải theo khoá: mã bộ là tiền tố của địa chỉ công
-- khai, mà địa chỉ công khai không có khái niệm "thuộc khoá nào". Hai bộ ở hai
-- khoá khác nhau mà trùng mã là hai dải địa chỉ chồng lên nhau.
create unique index ux_flashcard_decks_code
  on public.flashcard_decks (code);

comment on column public.flashcard_decks.code is
  'Mã bộ — tiền tố của địa chỉ QR (`<mã bộ>-<số buổi>`, `MULTIDECK-1`). Duy '
  'nhất toàn bảng. Bộ có sẵn trước 2026-07-29 được backfill bằng slug của mã '
  'khoá nên mọi mã đã in giữ nguyên. Không đổi được khi bộ còn liên kết sống.';

comment on table public.flashcard_decks is
  'Bộ flashcard. Từ `MULTIDECK-1` (2026-07-29) một khoá học có NHIỀU bộ — ràng '
  'buộc `unique(course_id)` của migration 66 đã gỡ. Địa chỉ QR phân biệt các bộ '
  'bằng cột `code`, không phải bằng mã khoá.';

-- ============================================================================
-- 3. Đổi mã bộ khi đã phát hành liên kết = CẤM
-- ============================================================================
--
-- Vì sao phải là trigger DB chứ không phải một câu `if` ở server action: đổi mã
-- bộ không làm hỏng hàng liên kết nào (mã đã phát hành lưu nguyên văn trong
-- bảng), nó làm **mọi mã sinh về sau lệch khỏi mã đã in**. Hậu quả không hiện
-- ra ngay lúc bấm mà hiện ra ở lần phát hành tiếp theo — đúng loại lỗi mà kiểm
-- ở tầng app sẽ bị đường ghi thứ hai đi vòng qua (`BUG_M10_01`).
--
-- Đường thoát hợp lệ vẫn còn: thu hồi hết liên kết của bộ rồi mới đổi mã. Bắt
-- người dùng đi qua thao tác thu hồi là cố ý — nó có hộp thoại nói thẳng rằng
-- mã QR đã in sẽ chết.
create or replace function app.guard_flashcard_deck_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_live integer;
begin
  if new.code is not distinct from old.code then
    return new;
  end if;

  select count(*)
  into v_live
  from public.flashcard_public_links l
  join public.flashcard_sections s on s.id = l.section_id
  where s.deck_id = new.id
    and l.revoked_at is null;

  if v_live > 0 then
    raise exception
      'Bộ thẻ đang có % liên kết công khai còn hiệu lực — đổi mã bộ sẽ làm mọi địa chỉ sinh về sau lệch khỏi mã QR đã in. Thu hồi hết liên kết trước nếu thật sự cần đổi.', v_live;
  end if;

  return new;
end;
$$;

revoke all on function app.guard_flashcard_deck_code() from public, anon, authenticated;

create trigger trg_flashcard_decks_guard_code
before update of code on public.flashcard_decks
for each row execute function app.guard_flashcard_deck_code();

comment on function app.guard_flashcard_deck_code() is
  'Chặn đổi `flashcard_decks.code` khi bộ còn liên kết công khai sống '
  '(`MULTIDECK-1c`). Ở DB chứ không ở app vì hậu quả chỉ lộ ra ở lần phát hành '
  'liên kết TIẾP THEO, không phải ngay lúc bấm.';

-- ============================================================================
-- 4. Công thức mã liên kết đọc MÃ BỘ thay vì mã khoá
-- ============================================================================
--
-- Thay đổi duy nhất so với `…081`: nguồn của `v_slug`. Mọi thứ khác giữ nguyên
-- từng chữ — `stable`, `lpad` 2 chữ số, thông báo lỗi khi slug rỗng.
--
-- Nhánh "slug rỗng" ở lại dù CHECK mới đã chặn hình dạng: hàm này là nơi mã
-- được SINH RA, và một hàm sinh mã không nên tin rằng ràng buộc ở bảng khác còn
-- nguyên (`fail-closed`). Nó nay là lưới thứ hai chứ không còn là lưới duy nhất.
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
  select d.code, s.session_number into v_code, v_session
  from public.flashcard_sections s
  join public.flashcard_decks d on d.id = s.deck_id
  where s.id = p_section_id;

  if not found then
    raise exception 'Không tìm thấy buổi flashcard';
  end if;

  -- Chuẩn hoá lại kể cả khi CHECK đã bảo đảm hình dạng: rẻ, và giữ hàm này
  -- đúng nghĩa "thuần" — cùng đầu vào luôn cùng đầu ra, không phụ thuộc việc
  -- ràng buộc ở bảng kia có bị gỡ hay không.
  v_slug := btrim(regexp_replace(lower(v_code), '[^a-z0-9]+', '-', 'g'), '-');

  if v_slug = '' then
    raise exception 'Mã bộ thẻ "%" không tạo được mã liên kết — đặt lại mã bộ bằng chữ và số', v_code;
  end if;

  return v_slug || '-' || lpad(v_session::text, 2, '0');
end;
$$;

revoke all on function app.flashcard_fixed_link_token(uuid) from public, anon, authenticated;

comment on function app.flashcard_fixed_link_token(uuid) is
  'Mã liên kết CỐ ĐỊNH của một buổi. Từ `MULTIDECK-1` (2026-07-29) tiền tố lấy '
  'từ `flashcard_decks.code` thay vì mã khoá, để một khoá có nhiều bộ mà hai bộ '
  'không giành nhau cùng một mã. Bộ cũ có mã bộ = slug mã khoá nên mọi mã đã in '
  'ra y hệt. Thuần: cùng buổi → cùng mã.';
