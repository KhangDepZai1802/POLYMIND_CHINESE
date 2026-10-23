begin;
do $$
declare definition text;
begin
  select pg_get_functiondef('public.get_b2c_admissions_page(text,text,text,integer,integer)'::regprocedure) into definition;
  if position('app.is_manager()' in definition)=0 then
    raise exception 'Admissions paging function no longer has the expected manager guard';
  end if;
  execute replace(definition,'app.is_manager()','public.has_b2c_permission(''manage_admissions'')');
end $$;
notify pgrst,'reload schema';
commit;
