-- Keep the release trigger aligned with the result_release_mode enum.
create or replace function app.release_immediate_exercise_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.exercise_deliveries%rowtype;
begin
  if new.status = 'graded' and old.status is distinct from new.status then
    select * into v_delivery
    from public.exercise_deliveries
    where id = new.delivery_id;

    if v_delivery.result_release_mode = 'after_graded' then
      update public.exercise_attempts
      set result_published_at = coalesce(result_published_at, clock_timestamp())
      where id = new.id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app.release_immediate_exercise_result() from public, anon, authenticated;
