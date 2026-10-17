-- A manual-send confirmation must match the exact preview and contact that the user saw.
do $$ declare d text; needle text:='  insert into public.b2c_monthly_comment_deliveries'; begin
 select pg_get_functiondef('public.write_b2c_monthly_comment(text,jsonb)'::regprocedure) into d;
 if position(needle in d)=0 then raise exception 'Unexpected monthly comment write definition'; end if;
 d:=replace(d,needle,$guard$
  if p_data->>'expected_message' is distinct from app.render_b2c_monthly_comment(r.id)
   or p_data->>'expected_destination' is distinct from v_destination then
   raise exception 'Nội dung hoặc liên hệ phụ huynh đã thay đổi. Mở lại bản chuẩn bị gửi.' using errcode='40001';
  end if;
$guard$||needle);
 execute d;
end $$;
notify pgrst,'reload schema';
