-- =============================================================================
-- 90 — Video bài giảng qua LIÊN KẾT YouTube (`VIDEO-1a`)
--
-- Thiết kế: docs/13-thiet-ke-video-bai-giang.md
--
-- 🔴 KHÔNG lưu byte video. Hệ thống chỉ giữ `youtube_video_id` (11 ký tự).
--    Lý do (đo thật, ghi ở WORKLOG 2026-08-05): 35 buổi ≈ 4,73 GB, mà Supabase
--    gói Free chặn ở file 50 MB / tổng 1 GB / egress 5 GB một tháng — trong khi
--    55 học viên xem một lượt là 260 GB. Nén không cứu được egress.
--
-- ⚠️ ĐÁNH ĐỔI ĐÃ GHI NHẬN, KHÔNG PHẢI SƠ SUẤT:
--    RLS ở đây bảo vệ *danh sách link*, KHÔNG bảo vệ *nội dung video*. Học viên
--    ngoài khoá không thấy link; nhưng ai đã cầm link thì xem được, vì video nằm
--    trên YouTube chứ không nằm sau cổng đăng nhập của web. Bù bằng chế độ
--    "Không công khai" (Unlisted) — thao tác của user trên YouTube, không phải code.
-- =============================================================================

create type public.video_status as enum ('draft', 'published');

-- =============================================================================
-- Bảng
-- =============================================================================

create table public.video_collections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  description text,
  position integer not null default 0,
  status public.video_status not null default 'draft',
  published_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_collections_publish_time_check check (
    (status = 'published' and published_at is not null)
    or status <> 'published'
  )
);

comment on table public.video_collections is
  'Bộ video bài giảng của một Course. Nhiều bộ/khoá được phép ngay từ đầu (đúng hình dạng flashcard_decks sau `…083`), nhưng bản đầu user chỉ dùng một bộ.';

create table public.video_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.video_collections(id) on delete cascade,
  session_number integer not null check (session_number > 0),
  title text not null check (btrim(title) <> ''),

  -- 🔴 Lưu ID chứ KHÔNG lưu URL đầy đủ. Cùng một video có hàng chục dạng URL
  -- (`youtu.be/x`, `watch?v=x`, `?si=…`, `&t=90`), nên lưu URL thô thì không
  -- cách nào biết hai hàng có trùng video không. Ép về ID cũng buộc phải qua
  -- bước bóc tách + kiểm định dạng, tức dán nhầm link Facebook bị chặn ngay lúc
  -- nhập chứ không phải lúc học viên bấm.
  youtube_video_id text not null
    check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),

  status public.video_status not null default 'draft',
  published_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 🔴 Chốt chặn ở TẦNG DB, không phải app-level (bài học `BUG_M09_01`):
  -- nhập lại lần hai không được đẻ ra hai hàng cùng một buổi.
  constraint uq_video_items_collection_session unique (collection_id, session_number),
  constraint video_items_publish_time_check check (
    (status = 'published' and published_at is not null)
    or status <> 'published'
  )
);

comment on column public.video_items.youtube_video_id is
  'ID YouTube 11 ký tự. KHÔNG lưu URL — xem ghi chú trong migration.';

create index ix_video_collections_course_status
  on public.video_collections(course_id, status, position);
create index ix_video_items_collection_session
  on public.video_items(collection_id, session_number);

-- =============================================================================
-- Trigger: updated_at + ép actor
-- =============================================================================

create trigger trg_video_collections_updated
before update on public.video_collections
for each row execute function app.set_updated_at();

create trigger trg_video_items_updated
before update on public.video_items
for each row execute function app.set_updated_at();

-- `created_by` LUÔN lấy từ auth.uid(), không bao giờ tin giá trị client gửi lên.
-- Đây chính là bẫy `BUG_M06_01`/`BUG_M12_01` ở hệ cũ: CreatedBy hoá ra là "user
-- đầu tiên trong DB" thay vì người thao tác thật.
create or replace function app.force_video_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
  end if;

  if new.created_by is null then
    raise exception 'Không xác định được người tạo video';
  end if;

  return new;
end;
$$;

revoke all on function app.force_video_actor()
  from public, anon, authenticated;

create trigger trg_video_collections_actor
before insert or update on public.video_collections
for each row execute function app.force_video_actor();

create trigger trg_video_items_actor
before insert or update on public.video_items
for each row execute function app.force_video_actor();

-- Đồng bộ `published_at` theo `status` — cùng khuôn `normalize_flashcard_deck_status`.
create or replace function app.normalize_video_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    new.published_at := coalesce(new.published_at, clock_timestamp());
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

revoke all on function app.normalize_video_status()
  from public, anon, authenticated;

create trigger trg_video_collections_status
before insert or update on public.video_collections
for each row execute function app.normalize_video_status();

create trigger trg_video_items_status
before insert or update on public.video_items
for each row execute function app.normalize_video_status();

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.video_collections enable row level security;
alter table public.video_items enable row level security;

create policy video_collections_admin_all
on public.video_collections
for all to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

create policy video_items_admin_all
on public.video_items
for all to authenticated
using (app.is_super_admin())
with check (app.is_super_admin());

-- Học viên: chỉ thấy bộ ĐÃ CÔNG BỐ của khoá mình đang học.
-- Dùng lại `app.can_student_read_flashcard_course` — cùng một câu hỏi nghiệp vụ
-- ("học viên này có thuộc khoá đó không"), viết bản thứ hai là đúng mẫu hỏng
-- `BUG_M10_01` (một hành động, nhiều đường ghi/đọc khác nhau).
create policy video_collections_student_read
on public.video_collections
for select to authenticated
using (
  status = 'published'
  and app.can_student_read_flashcard_course(course_id)
);

create policy video_items_student_read
on public.video_items
for select to authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.video_collections c
    where c.id = video_items.collection_id
      and c.status = 'published'
      and app.can_student_read_flashcard_course(c.course_id)
  )
);

-- Giáo viên/giáo vụ: đọc được bộ đã công bố của khoá mình dạy (để đối chiếu
-- với học viên khi được hỏi). KHÔNG cho ghi — nội dung khoá là việc của admin.
create policy video_collections_teacher_read
on public.video_collections
for select to authenticated
using (
  status = 'published'
  and app.teaches_course(course_id)
);

create policy video_items_teacher_read
on public.video_items
for select to authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.video_collections c
    where c.id = video_items.collection_id
      and c.status = 'published'
      and app.teaches_course(c.course_id)
  )
);

grant select, insert, update, delete
  on public.video_collections, public.video_items
  to authenticated;
revoke all
  on public.video_collections, public.video_items
  from anon;

-- =============================================================================
-- RPC: lưu cả lô trong MỘT lượt
--
-- Vì sao đi RPC chứ không update thẳng từ app: luật fail-closed (`super_admin`
-- + bộ phải `draft`) nằm TRONG DB và được pgTAP phủ, chứ không chỉ Vitest.
-- Đúng tiền lệ `…072`, `…076`, `…077`.
-- =============================================================================

create or replace function public.save_lesson_videos(
  p_collection_id uuid,
  p_items jsonb,
  p_allow_overwrite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection public.video_collections%rowtype;
  v_item jsonb;
  v_session integer;
  v_video_id text;
  v_title text;
  v_existing public.video_items%rowtype;
  v_outcomes jsonb := '[]'::jsonb;
begin
  if not app.is_super_admin() then
    raise exception 'Chỉ quản trị viên hệ thống được sửa video bài giảng';
  end if;

  select * into v_collection
  from public.video_collections
  where id = p_collection_id;

  if not found then
    raise exception 'Không tìm thấy bộ video';
  end if;

  -- Bộ đã công bố thì khoá lại — sửa link dưới chân học viên đang học là kiểu
  -- thay đổi im lặng mà không ai thấy. Muốn sửa thì gỡ công bố trước.
  if v_collection.status <> 'draft' then
    raise exception 'Bộ video đã công bố. Gỡ công bố trước khi sửa.';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Danh sách video không hợp lệ';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_session := (v_item->>'sessionNumber')::integer;
    v_video_id := v_item->>'youtubeVideoId';
    v_title := nullif(btrim(coalesce(v_item->>'title', '')), '');

    if v_session is null or v_session <= 0 then
      raise exception 'Số buổi không hợp lệ: %', coalesce(v_session::text, 'rỗng');
    end if;

    -- Kiểm LẠI ở DB dù app đã kiểm. App có thể bị bỏ qua; đây là cửa cuối.
    if v_video_id is null or v_video_id !~ '^[A-Za-z0-9_-]{11}$' then
      raise exception 'Mã video YouTube không hợp lệ ở buổi %', v_session;
    end if;

    v_title := coalesce(v_title, 'Buổi ' || v_session::text);

    select * into v_existing
    from public.video_items
    where collection_id = p_collection_id
      and session_number = v_session;

    if found and not p_allow_overwrite then
      v_outcomes := v_outcomes || jsonb_build_object(
        'sessionNumber', v_session,
        'status', 'skipped',
        'message', 'Buổi này đã có video — bật Ghi đè nếu muốn thay.'
      );
      continue;
    end if;

    -- `on conflict` để lượt chạy lại KHÔNG đẻ hàng trùng (`BUG_M09_01`).
    insert into public.video_items (
      collection_id, session_number, title, youtube_video_id
    )
    values (p_collection_id, v_session, v_title, v_video_id)
    on conflict (collection_id, session_number) do update
      set title = excluded.title,
          youtube_video_id = excluded.youtube_video_id;

    v_outcomes := v_outcomes || jsonb_build_object(
      'sessionNumber', v_session,
      'status', case when v_existing.id is null then 'created' else 'replaced' end
    );

    v_existing := null;
  end loop;

  return jsonb_build_object('outcomes', v_outcomes);
end;
$$;

revoke all on function public.save_lesson_videos(uuid, jsonb, boolean)
  from public, anon;
grant execute on function public.save_lesson_videos(uuid, jsonb, boolean)
  to authenticated;

comment on function public.save_lesson_videos(uuid, jsonb, boolean) is
  'Lưu cả lô video của một bộ trong MỘT lượt. Fail-closed: chỉ super_admin, chỉ bộ draft. Idempotent nhờ on conflict.';
