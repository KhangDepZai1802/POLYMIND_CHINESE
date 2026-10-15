-- Extends permission-test fixtures; caller wraps both files in a rollback transaction.
reset role;
update public.b2c_teacher_permissions set permissions=array['view_classes','view_students','view_schedule','mark_attendance'] where teacher_id='8b000000-0000-4000-8000-000000000005';
select set_config('request.jwt.claims','{"sub":"8b000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare r jsonb; stamp text; req uuid:=gen_random_uuid(); payload jsonb; begin
 r:=public.read_teacher_b2c_workspace('8b000000-0000-4000-8000-000000000010','attendance',0,'','8b000000-0000-4000-8000-000000000040');
 stamp:=r->'rows'->0->>'attendance_updated_at';
 payload:=jsonb_build_object('class_id','8b000000-0000-4000-8000-000000000010','enrollment_id','8b000000-0000-4000-8000-000000000030','meeting_id','8b000000-0000-4000-8000-000000000040','request_id',req,'status','makeup','note','TEST MAKEUP','expected_updated_at',stamp);
 perform public.write_b2c_class_workspace('save_attendance',payload);
 perform public.write_b2c_class_workspace('save_attendance',payload);
 r:=public.read_teacher_b2c_workspace('8b000000-0000-4000-8000-000000000010','attendance',0,'','8b000000-0000-4000-8000-000000000040');
 assert r->'rows'->0->>'attendance_status'='makeup', 'Teacher saves makeup';
 assert (r->'stats'->>'makeup')::integer=1, 'Teacher makeup count';
 begin
  perform public.write_b2c_class_workspace('save_attendance',payload||jsonb_build_object('request_id',gen_random_uuid()));
  raise exception 'Stale update accepted';
 exception when raise_exception then if sqlerrm='Stale update accepted' then raise; end if; end;
 begin
  perform public.write_b2c_class_workspace('save_attendance',payload||jsonb_build_object('request_id',gen_random_uuid(),'expected_updated_at',r->'rows'->0->>'attendance_updated_at','status','invented'));
  raise exception 'Unknown status accepted';
 exception when check_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"8b000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.read_b2c_class_workspace('8b000000-0000-4000-8000-000000000010','attendance',0,'','8b000000-0000-4000-8000-000000000040');
 assert (r->'stats'->>'makeup')::integer=1, 'Manager makeup count';
end $$;
reset role;
do $$ begin
 assert (select count(*) from public.b2c_student_attendance where meeting_id='8b000000-0000-4000-8000-000000000040')=1, 'Retry remains one record';
 assert exists(select 1 from public.b2c_class_history where after_data->>'status'='makeup' and actor_id='8b000000-0000-4000-8000-000000000001'), 'Teacher audit actor retained';
end $$;
select 'ok: makeup save/read/stats/retry/stale/validation/audit';
