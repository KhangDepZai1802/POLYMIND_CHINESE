create table public.b2c_session_summary_adjustments (
  enrollment_id uuid primary key references public.b2c_enrollments(id) on delete restrict,
  attended integer not null check(attended>=0),
  absent integer not null check(absent>=0),
  excused integer not null check(excused>=0),
  makeup integer not null check(makeup>=0),
  reason text not null check(char_length(btrim(reason)) between 3 and 1000),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.b2c_session_summary_adjustments enable row level security;
revoke all on public.b2c_session_summary_adjustments from public, anon, authenticated;

create table public.b2c_session_summary_adjustment_history (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.b2c_enrollments(id) on delete restrict,
  before_data jsonb,
  after_data jsonb not null,
  reason text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.b2c_session_summary_adjustment_history enable row level security;
revoke all on public.b2c_session_summary_adjustment_history from public, anon, authenticated;

create function public.save_b2c_session_summary_adjustment(p_data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare e public.b2c_enrollments; old public.b2c_session_summary_adjustments; v_reason text:=btrim(p_data->>'reason');
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or not app.has_b2c_permission('edit_students',(p_data->>'class_id')::uuid) then raise exception 'Không có quyền điều chỉnh số buổi.' using errcode='42501'; end if;
 if (p_data->>'enrollment_id') is null or (p_data->>'class_id') is null or v_reason is null or char_length(v_reason) not between 3 and 1000
  or (p_data->>'registered_sessions') !~ '^[1-9][0-9]{0,3}$' or (p_data->>'attended') !~ '^[0-9]{1,4}$' or (p_data->>'absent') !~ '^[0-9]{1,4}$' or (p_data->>'excused') !~ '^[0-9]{1,4}$' or (p_data->>'makeup') !~ '^[0-9]{1,4}$' then
  raise exception 'Nhập số buổi hợp lệ và lý do từ 3 đến 1.000 ký tự.' using errcode='22023';
 end if;
 select * into e from public.b2c_enrollments where id=(p_data->>'enrollment_id')::uuid and class_id=(p_data->>'class_id')::uuid for update;
 if not found then raise exception 'Học viên không thuộc lớp.' using errcode='22023'; end if;
 select * into old from public.b2c_session_summary_adjustments where enrollment_id=e.id for update;
 update public.b2c_enrollments set registered_sessions=(p_data->>'registered_sessions')::integer where id=e.id;
 insert into public.b2c_session_summary_adjustments(enrollment_id,attended,absent,excused,makeup,reason,updated_by)
 values(e.id,(p_data->>'attended')::integer,(p_data->>'absent')::integer,(p_data->>'excused')::integer,(p_data->>'makeup')::integer,v_reason,auth.uid())
 on conflict(enrollment_id) do update set attended=excluded.attended,absent=excluded.absent,excused=excluded.excused,makeup=excluded.makeup,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 insert into public.b2c_session_summary_adjustment_history(enrollment_id,before_data,after_data,reason,actor_id)
 values(e.id,to_jsonb(old),jsonb_build_object('registered_sessions',(p_data->>'registered_sessions')::integer,'attended',(p_data->>'attended')::integer,'absent',(p_data->>'absent')::integer,'excused',(p_data->>'excused')::integer,'makeup',(p_data->>'makeup')::integer),v_reason,auth.uid());
end $$;
revoke all on function public.save_b2c_session_summary_adjustment(jsonb) from public, anon;
grant execute on function public.save_b2c_session_summary_adjustment(jsonb) to authenticated;
create function public.read_b2c_session_summary_adjustments(p_class_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(a.enrollment_id::text,jsonb_build_object('attended',a.attended,'absent',a.absent,'excused',a.excused,'makeup',a.makeup)),'{}'::jsonb)
 from public.b2c_session_summary_adjustments a join public.b2c_enrollments e on e.id=a.enrollment_id
 where e.class_id=p_class_id and app.has_b2c_permission('view_students',p_class_id);
$$;
revoke all on function public.read_b2c_session_summary_adjustments(uuid) from public, anon;
grant execute on function public.read_b2c_session_summary_adjustments(uuid) to authenticated;
notify pgrst,'reload schema';
