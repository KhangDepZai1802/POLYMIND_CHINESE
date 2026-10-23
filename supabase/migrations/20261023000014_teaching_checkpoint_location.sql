begin;

alter table public.b2c_teaching_sessions
  add column check_in_latitude numeric,
  add column check_in_longitude numeric,
  add column check_in_accuracy numeric,
  add column check_out_latitude numeric,
  add column check_out_longitude numeric,
  add column check_out_accuracy numeric,
  add constraint b2c_teaching_check_in_location_check check(
    (check_in_latitude is null and check_in_longitude is null and check_in_accuracy is null)
    or (check_in_latitude between -90 and 90 and check_in_longitude between -180 and 180 and check_in_accuracy between 0 and 10000)
  ),
  add constraint b2c_teaching_check_out_location_check check(
    (check_out_latitude is null and check_out_longitude is null and check_out_accuracy is null)
    or (check_out_latitude between -90 and 90 and check_out_longitude between -180 and 180 and check_out_accuracy between 0 and 10000)
  );

create function public.check_b2c_teaching_session_with_location(
  p_id uuid,p_kind text,p_photo text,p_latitude numeric,p_longitude numeric,p_accuracy numeric
) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_latitude is null or p_latitude not between -90 and 90
  or p_longitude is null or p_longitude not between -180 and 180
  or p_accuracy is null or p_accuracy not between 0 and 10000 then
  raise exception 'Vị trí chấm công không hợp lệ.' using errcode='22023';
 end if;
 perform public.check_b2c_teaching_session(p_id,p_kind,p_photo);
 if p_kind='in' then
  update public.b2c_teaching_sessions set check_in_latitude=p_latitude,check_in_longitude=p_longitude,check_in_accuracy=p_accuracy where id=p_id;
 elsif p_kind='out' then
  update public.b2c_teaching_sessions set check_out_latitude=p_latitude,check_out_longitude=p_longitude,check_out_accuracy=p_accuracy where id=p_id;
 else
  raise exception 'Mốc chấm công không hợp lệ.' using errcode='22023';
 end if;
end $$;

revoke all on function public.check_b2c_teaching_session_with_location(uuid,text,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.check_b2c_teaching_session_with_location(uuid,text,text,numeric,numeric,numeric) to authenticated;
notify pgrst,'reload schema';
commit;
