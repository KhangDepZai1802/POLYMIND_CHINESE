-- Cô Lê/Cô Thy already have center-wide read permissions, but the legacy
-- teacher projection still hard-filters every result to the assigned teacher.
-- Widen that private projection only for the dedicated account-creator
-- allowlist; ordinary teachers keep the original assignment boundary.
do $$
declare d text;
begin
 select pg_get_functiondef(
  'app.read_my_b2c_classes(uuid,text,integer,text)'::regprocedure
 ) into d;

 if position(
  'and not public.can_create_b2c_teacher_accounts()'
  in lower(d)
 )>0 then
  -- The production SQL may have been applied manually before migration history
  -- was repaired. Keep the forward migration safe to replay in that state.
  return;
 end if;

 if position('where app.teaches_b2c_class(c.id)' in d)=0
    or position('if not app.teaches_b2c_class(p_class_id) then' in d)=0 then
  raise exception 'Unexpected teacher class reader definition';
 end if;

 d:=replace(
  d,
  'where app.teaches_b2c_class(c.id)',
  'where (app.teaches_b2c_class(c.id) or public.can_create_b2c_teacher_accounts())'
 );
 d:=replace(
  d,
  'if not app.teaches_b2c_class(p_class_id) then',
  'if not app.teaches_b2c_class(p_class_id) and not public.can_create_b2c_teacher_accounts() then'
 );
 execute d;
end $$;

notify pgrst,'reload schema';
