-- 47 — Sắp xếp/xóa item builder an toàn với unique order và version lock

create or replace function public.move_question_set_item(p_item_id uuid,p_direction integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.question_set_items; v_target public.question_set_items;
begin
  perform app.require_assessment_author();
  if p_direction not in (-1,1) then raise exception 'Hướng không hợp lệ'; end if;
  select i.* into v_item from public.question_set_items i join public.question_set_versions sv on sv.id=i.set_version_id join public.question_sets s on s.id=sv.question_set_id
  where i.id=p_item_id and sv.locked_at is null and (s.owner_id=auth.uid() or app.is_super_admin()) for update of i;
  if v_item.id is null then raise exception 'Item không tồn tại hoặc version đã khóa'; end if;
  select * into v_target from public.question_set_items where set_version_id=v_item.set_version_id and order_index=v_item.order_index+p_direction for update;
  if v_target.id is null then return; end if;
  update public.question_set_items set order_index=2147483647 where id=v_target.id;
  update public.question_set_items set order_index=v_item.order_index+p_direction where id=v_item.id;
  update public.question_set_items set order_index=v_item.order_index where id=v_target.id;
end $$;

create or replace function public.remove_question_set_item(p_item_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.question_set_items;
begin
  perform app.require_assessment_author();
  select i.* into v_item from public.question_set_items i join public.question_set_versions sv on sv.id=i.set_version_id join public.question_sets s on s.id=sv.question_set_id
  where i.id=p_item_id and sv.locked_at is null and (s.owner_id=auth.uid() or app.is_super_admin()) for update of i;
  if v_item.id is null then raise exception 'Item không tồn tại hoặc version đã khóa'; end if;
  delete from public.question_set_items where id=p_item_id;
  update public.question_set_items set order_index=order_index-1 where set_version_id=v_item.set_version_id and order_index>v_item.order_index;
end $$;

revoke all on function public.move_question_set_item(uuid,integer) from public,anon;
revoke all on function public.remove_question_set_item(uuid) from public,anon;
grant execute on function public.move_question_set_item(uuid,integer) to authenticated;
grant execute on function public.remove_question_set_item(uuid) to authenticated;
