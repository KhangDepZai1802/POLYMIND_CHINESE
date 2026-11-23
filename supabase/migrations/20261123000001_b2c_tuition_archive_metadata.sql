-- Both tuition screens retain financial history, but need the profile's archive
-- state to distinguish current enrollments from historical records by default.
-- Add metadata only: do not change balances, permissions, pagination or rows.
do $$
declare
  v_function regprocedure;
  v_definition text;
begin
  foreach v_function in array array[
    'public.get_b2c_tuition_page(text,integer)'::regprocedure,
    'public.read_center_b2c_tuition_page(text,integer)'::regprocedure
  ] loop
    select pg_get_functiondef(v_function) into v_definition;
    if position('s.code as student_code,' in v_definition) = 0
       or position('s.archived_at as student_archived_at,' in v_definition) > 0 then
      raise exception 'Unexpected tuition projection: %', v_function;
    end if;
    execute replace(v_definition,
      's.code as student_code,',
      's.code as student_code,s.archived_at as student_archived_at,');
  end loop;
end;
$$;

notify pgrst, 'reload schema';
