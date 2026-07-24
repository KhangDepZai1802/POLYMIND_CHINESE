-- 71 — Phase 16 / `P16-T7`: học viên ★ đánh dấu thẻ khó.
--
-- Phạm vi cố ý HẸP (chốt `Q4`): chỉ "thẻ này khó", KHÔNG làm theo dõi
-- biết/chưa biết, KHÔNG đụng `mastery` của Ôn câu sai — hai nguồn sự thật về
-- tiến độ học là thứ đã sinh ra `BUG_M10_01`.

create table public.flashcard_starred_pages (
  student_id uuid not null references public.students(id) on delete cascade,
  page_id uuid not null references public.flashcard_pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Khoá chính ghép ĐÃ LÀ unique index: bấm ★ hai lần (double-click, mạng lặp
  -- lại request) không thể tạo hàng thứ hai. `BUG_M09_01` đòi chặn ở tầng DB
  -- chứ không chỉ ở app — đây là chỗ chặn đó.
  constraint flashcard_starred_pages_pkey primary key (student_id, page_id)
);

create index ix_flashcard_starred_pages_page
  on public.flashcard_starred_pages(page_id);

alter table public.flashcard_starred_pages enable row level security;

-- Học viên chỉ THẤY dấu sao của chính mình.
create policy flashcard_starred_pages_student_read
on public.flashcard_starred_pages
for select to authenticated
using (student_id = app.my_student_id());

-- Và chỉ ĐÁNH DẤU được thẻ mà chính mình có quyền đọc: nếu chỉ kiểm
-- `student_id` thì học viên gửi tay một `page_id` bất kỳ vẫn tạo được hàng, tức
-- dò được sự tồn tại của thẻ thuộc khoá học khác.
create policy flashcard_starred_pages_student_insert
on public.flashcard_starred_pages
for insert to authenticated
with check (
  student_id = app.my_student_id()
  and exists (
    select 1
    from public.flashcard_pages p
    join public.flashcard_sections s on s.id = p.section_id
    join public.flashcard_decks d on d.id = s.deck_id
    where p.id = flashcard_starred_pages.page_id
      and p.archived_at is null
      and s.status = 'published'
      and d.status = 'published'
      and app.can_student_read_flashcard_course(d.course_id)
  )
);

create policy flashcard_starred_pages_student_delete
on public.flashcard_starred_pages
for delete to authenticated
using (student_id = app.my_student_id());

grant select, insert, delete on public.flashcard_starred_pages to authenticated;
revoke all on public.flashcard_starred_pages from anon;

/**
 * MỘT đường ghi duy nhất cho cả bật lẫn tắt (`BUG_M10_01`).
 *
 * Cố ý KHÔNG làm hàm `toggle`: toggle không idempotent — hai request lặp lại
 * (bấm nhanh hai lần, mạng gửi lại) sẽ bật rồi tắt, kết quả phụ thuộc số lần
 * đến. `set` nhận trạng thái MONG MUỐN nên gọi bao nhiêu lần cũng ra một kết
 * quả, khớp với unique index ở trên.
 *
 * `security invoker` để RLS ở trên vẫn là thứ cưỡng chế — không tự mở quyền.
 */
create or replace function public.set_flashcard_star(
  p_page_id uuid,
  p_starred boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student_id uuid;
begin
  v_student_id := app.my_student_id();
  if v_student_id is null then
    raise exception 'Chỉ học viên mới đánh dấu được thẻ khó';
  end if;

  if p_starred then
    insert into public.flashcard_starred_pages (student_id, page_id)
    values (v_student_id, p_page_id)
    on conflict (student_id, page_id) do nothing;
  else
    delete from public.flashcard_starred_pages
    where student_id = v_student_id
      and page_id = p_page_id;
  end if;
end;
$$;

revoke all on function public.set_flashcard_star(uuid, boolean)
  from public, anon;
grant execute on function public.set_flashcard_star(uuid, boolean)
  to authenticated;

comment on table public.flashcard_starred_pages is
  'Thẻ flashcard học viên tự đánh dấu là khó. KHÔNG phải theo dõi tiến độ '
  'biết/chưa biết (hoãn theo Q4), và không liên quan mastery của Ôn câu sai.';
