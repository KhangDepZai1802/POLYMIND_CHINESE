-- 58 — Chỉnh sửa bộ câu hỏi SAU KHI đã khóa/giao: tạo BẢN NHÁP MỚI (clone)
--
-- Bản đã khóa là BẤT BIẾN và có thể đang được một lần giao (delivery) tham chiếu
-- (exercise/exam_deliveries.set_version_id ON DELETE RESTRICT). Sửa thẳng bản đó
-- sẽ làm đổi ngược đề của các lượt đã/đang làm. Vì vậy "Chỉnh sửa" = clone toàn
-- bộ section + câu hỏi sang một version nháp mới, đặt nó làm current_version để
-- sửa tiếp rồi khóa lại; các lần giao cũ vẫn trỏ về bản khóa cũ, không đổi.
create or replace function public.clone_question_set_for_edit(p_question_set_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_src uuid; v_new uuid; v_no integer; v_title text; v_instr text; r record; v_newsec uuid;
begin
  perform app.require_assessment_author();
  select current_version_id into v_src from public.question_sets
    where id=p_question_set_id and (owner_id=auth.uid() or app.is_super_admin());
  if v_src is null then raise exception 'Không tìm thấy bộ câu hỏi'; end if;
  -- Bản hiện tại chưa khóa thì sửa trực tiếp được — không cần tạo bản mới.
  if not exists(select 1 from public.question_set_versions where id=v_src and locked_at is not null) then
    raise exception 'Bản hiện tại đang mở, sửa trực tiếp — không cần tạo bản mới';
  end if;

  select title_snapshot,instructions_snapshot into v_title,v_instr
    from public.question_set_versions where id=v_src;
  select coalesce(max(version_no),0)+1 into v_no
    from public.question_set_versions where question_set_id=p_question_set_id;
  insert into public.question_set_versions(question_set_id,version_no,title_snapshot,instructions_snapshot,created_by)
    values(p_question_set_id,v_no,v_title,v_instr,auth.uid()) returning id into v_new;

  -- Copy section trước, giữ bản đồ old_id -> new_id để ánh xạ lại section của câu.
  drop table if exists _secmap;
  create temp table _secmap(old_id uuid primary key, new_id uuid) on commit drop;
  for r in select id,title,instructions,order_index from public.question_set_sections
           where set_version_id=v_src order by order_index loop
    insert into public.question_set_sections(set_version_id,title,instructions,order_index)
      values(v_new,r.title,r.instructions,r.order_index) returning id into v_newsec;
    insert into _secmap values(r.id,v_newsec);
  end loop;

  -- Copy câu hỏi, ánh xạ section (câu không thuộc section nào → left join ra null).
  insert into public.question_set_items(set_version_id,question_version_id,section_id,points,order_index)
    select v_new,i.question_version_id,m.new_id,i.points,i.order_index
    from public.question_set_items i
    left join _secmap m on m.old_id=i.section_id
    where i.set_version_id=v_src;

  update public.question_sets set current_version_id=v_new,status='draft' where id=p_question_set_id;
  drop table if exists _secmap;
  return v_new;
end $$;

revoke all on function public.clone_question_set_for_edit(uuid) from public,anon;
grant execute on function public.clone_question_set_for_edit(uuid) to authenticated;
