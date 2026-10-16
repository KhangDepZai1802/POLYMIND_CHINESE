-- Optional, independent of the student's contact phone. No inferred backfill.
alter table public.b2c_students add column guardian_zalo text
 check(guardian_zalo is null or guardian_zalo ~ '^[0-9]{10}$');

do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.add_b2c_class_student(jsonb)'::regprocedure);
 if position('birth_year,guardian_name,phone,email,address' in definition)=0
 or position('if v_student is not null or v_name is null' in definition)=0 then
  raise exception 'Unexpected add_b2c_class_student definition; review before applying';
 end if;
 definition:=replace(definition,'if v_student is not null or v_name is null',
  'if (nullif(btrim(p_data->>''guardian_zalo''),'''') is not null and btrim(p_data->>''guardian_zalo'')!~''^[0-9]{10}$'') or v_student is not null or v_name is null');
 definition:=replace(definition,'birth_year,guardian_name,phone,email,address','birth_year,guardian_name,guardian_zalo,phone,email,address');
 definition:=replace(definition,'nullif(btrim(p_data->>''guardian_name''),''''),v_phone',
  'nullif(btrim(p_data->>''guardian_name''),''''),nullif(btrim(p_data->>''guardian_zalo''),''''),v_phone');
 execute definition;
end $$;
notify pgrst,'reload schema';
