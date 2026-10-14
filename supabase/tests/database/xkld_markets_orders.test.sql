begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(31);
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('71000000-0000-4000-8000-000000000001','authenticated','authenticated','orders-staff@example.test',now(),now()),
('71000000-0000-4000-8000-000000000002','authenticated','authenticated','orders-exec@example.test',now(),now()),
('71000000-0000-4000-8000-000000000003','authenticated','authenticated','orders-consultant@example.test',now(),now());
insert into public.profiles(id,role,full_name,is_active) values
('71000000-0000-4000-8000-000000000001','xkld_staff','TEST ORDERS STAFF',true),
('71000000-0000-4000-8000-000000000002','executive','TEST ORDERS EXEC',true),
('71000000-0000-4000-8000-000000000003','consultant','TEST ORDERS CONSULTANT',true);
select ok((select relrowsecurity from pg_class where oid='public.xkld_markets'::regclass),'Markets RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.xkld_orders'::regclass),'Orders RLS enabled');
select ok(not has_table_privilege('authenticated','public.xkld_orders','DELETE'),'Orders cannot be hard deleted');
select ok(not has_table_privilege('authenticated','public.xkld_markets','DELETE'),'Markets cannot be hard deleted');
select ok(not has_column_privilege('authenticated','public.xkld_orders','created_by','INSERT'),'No fake actor insert');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$insert into public.xkld_markets(create_request_id,country_code,country_name,currency_code) values('71000000-0000-4000-8000-000000000010','ZZ','TEST MARKET','USD')$$,'Staff creates market');
select is((select created_by from public.xkld_markets where country_code='ZZ'),'71000000-0000-4000-8000-000000000001'::uuid,'Market actor is actual login');
select lives_ok($$insert into public.xkld_markets(create_request_id,country_code,country_name,currency_code) values('71000000-0000-4000-8000-000000000010','ZZ','TEST MARKET','USD') on conflict(create_request_id) do nothing$$,'Market retry safe');
select is((select count(*)::int from public.xkld_markets where country_code='ZZ'),1,'One market after retry');
select lives_ok($$insert into public.xkld_orders(create_request_id,market_id,employer,industry,recruitment_quantity,salary_amount,salary_currency,salary_period,conditions,recruitment_deadline,partner) select '71000000-0000-4000-8000-000000000020',id,'TEST EMPLOYER','TEST INDUSTRY',12,1234.56,'USD','month','TEST CONDITIONS','2027-01-01','TEST PARTNER' from public.xkld_markets where country_code='ZZ'$$,'Staff creates complete order');
select ok((select code ~ '^DH-[0-9]{6,}$' from public.xkld_orders where create_request_id='71000000-0000-4000-8000-000000000020'),'Order code generated');
select is((select created_by from public.xkld_orders where create_request_id='71000000-0000-4000-8000-000000000020'),'71000000-0000-4000-8000-000000000001'::uuid,'Order actor is actual login');
select lives_ok($$insert into public.xkld_orders(create_request_id,market_id,employer,industry,recruitment_quantity,salary_amount,salary_currency,salary_period,conditions,recruitment_deadline,partner) select '71000000-0000-4000-8000-000000000020',id,'TEST EMPLOYER','TEST INDUSTRY',12,1234.56,'USD','month','TEST CONDITIONS','2027-01-01','TEST PARTNER' from public.xkld_markets where country_code='ZZ' on conflict(create_request_id) do nothing$$,'Order retry safe');
select is((select count(*)::int from public.xkld_orders where create_request_id='71000000-0000-4000-8000-000000000020'),1,'One order after retry');
select lives_ok($$update public.xkld_orders set recruitment_quantity=20, salary_amount=2000, status='paused' where create_request_id='71000000-0000-4000-8000-000000000020'$$,'Staff edits order');
select throws_ok($$update public.xkld_orders set salary_amount=-1 where create_request_id='71000000-0000-4000-8000-000000000020'$$,'23514',null,'Negative salary rejected');
select throws_ok($$update public.xkld_orders set salary_amount=1.001 where create_request_id='71000000-0000-4000-8000-000000000020'$$,'23514',null,'Salary precision checked without rounding');
select throws_ok($$update public.xkld_orders set salary_currency='invalid' where create_request_id='71000000-0000-4000-8000-000000000020'$$,'23514',null,'Currency format checked');
select throws_ok($$update public.xkld_orders set recruitment_quantity=0 where create_request_id='71000000-0000-4000-8000-000000000020'$$,'23514',null,'Recruitment quantity must be positive');
select lives_ok($$update public.xkld_markets set is_active=false,currency_code='JPY' where country_code='ZZ'$$,'Market can be disabled');
select is((select salary_currency from public.xkld_orders where create_request_id='71000000-0000-4000-8000-000000000020'),'USD','Existing salary currency retained');
select lives_ok($$update public.xkld_orders set conditions='UPDATED CONDITIONS' where create_request_id='71000000-0000-4000-8000-000000000020'$$,'Existing order on disabled market remains editable');
select throws_ok($$insert into public.xkld_orders(create_request_id,market_id,employer,industry,recruitment_quantity,salary_amount,salary_currency,salary_period,conditions,recruitment_deadline,partner) select gen_random_uuid(),id,'NEW','TEST',1,100,'USD','month','TEST','2027-01-01','TEST' from public.xkld_markets where country_code='ZZ'$$,'23514',null,'Cannot create new order on disabled market');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.xkld_orders where create_request_id='71000000-0000-4000-8000-000000000020'),1,'Executive sees order');
with changed as (update public.xkld_orders set partner='FORBIDDEN' where create_request_id='71000000-0000-4000-8000-000000000020' returning id) select is(count(*)::int,0,'Executive cannot change order') from changed;
with changed as (update public.xkld_markets set is_active=true where country_code='ZZ' returning id) select is(count(*)::int,0,'Executive cannot change market') from changed;
select throws_ok($$insert into public.xkld_markets(create_request_id,country_code,country_name,currency_code) values(gen_random_uuid(),'ZY','FORBIDDEN MARKET','USD')$$,'42501',null,'Executive cannot create market');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::int from public.xkld_orders),0,'Consultant cannot read orders');
select is((select count(*)::int from public.xkld_markets),0,'Consultant cannot read markets');
reset role;
set local role anon;
select throws_ok($$select * from public.xkld_orders$$,'42501',null,'Anonymous cannot read orders');
select throws_ok($$select * from public.xkld_markets$$,'42501',null,'Anonymous cannot read markets');
reset role;
select * from finish();
rollback;
