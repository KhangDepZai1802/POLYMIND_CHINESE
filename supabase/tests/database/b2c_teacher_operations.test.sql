begin;
select plan(4);

select has_function(
 'public','can_create_b2c_teacher_accounts',array[]::text[],
 'teacher account creator allowlist function exists'
);

select function_privs_are(
 'public','can_create_b2c_teacher_accounts',array[]::text[],'authenticated',
 array['EXECUTE'],
 'authenticated users may call the fail-closed capability function'
);

select ok(
 position(
  'public.can_create_b2c_teacher_accounts()'
  in pg_get_functiondef('app.read_my_b2c_classes(uuid,text,integer,text)'::regprocedure)
 )>0,
 'private teacher class reader recognizes the dedicated allowlist'
);

select ok(
 position(
  'app.teaches_b2c_class(c.id) OR public.can_create_b2c_teacher_accounts()'
  in pg_get_functiondef('app.read_my_b2c_classes(uuid,text,integer,text)'::regprocedure)
 )>0,
 'class listing keeps assignment access and adds allowlisted center access'
);

select * from finish();
rollback;
