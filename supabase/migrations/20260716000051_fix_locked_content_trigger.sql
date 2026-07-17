-- OLD is a dynamic record: only read columns that exist on the triggering table.
create or replace function app.prevent_locked_assessment_content_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'question_versions' then
    if exists (
      select 1
      from public.question_set_items i
      join public.question_set_versions sv on sv.id = i.set_version_id
      where i.question_version_id = old.id
        and sv.locked_at is not null
    ) then
      raise exception 'Phiên bản câu hỏi đã được khóa';
    end if;
  elsif tg_table_name in ('question_set_sections', 'question_set_items') then
    if exists (
      select 1
      from public.question_set_versions sv
      where sv.id = old.set_version_id
        and sv.locked_at is not null
    ) then
      raise exception 'Phiên bản bộ câu hỏi đã được khóa';
    end if;
  elsif tg_table_name = 'question_set_versions' and old.locked_at is not null then
    raise exception 'Phiên bản bộ câu hỏi đã được khóa';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function app.prevent_locked_assessment_content_change() from public, anon, authenticated;
