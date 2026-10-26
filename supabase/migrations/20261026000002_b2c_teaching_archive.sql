-- Archive payroll entries without deleting photos, meetings or student attendance.
alter table public.b2c_teaching_sessions
 add column archived_at timestamptz,
 add column archived_by uuid references public.profiles(id),
 add column archive_reason text,
 add constraint b2c_teaching_archive_metadata check(
  (archived_at is null and archived_by is null and archive_reason is null)
  or (archived_at is not null and archived_by is not null and char_length(btrim(archive_reason)) between 1 and 1000 and archive_reason is not null));

create function public.archive_b2c_teaching_session(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.b2c_teaching_sessions; v_after jsonb;
begin
 if not coalesce(app.is_super_admin(),false) then raise exception 'Chỉ quản trị viên được xóa buổi dạy.' using errcode='42501'; end if;
 if p_id is null or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Chọn buổi dạy và nhập lý do xóa.' using errcode='22023'; end if;
 select * into s from public.b2c_teaching_sessions where id=p_id for update;
 if not found then raise exception 'Không tìm thấy buổi dạy.' using errcode='22023'; end if;
 if s.archived_at is not null then return; end if;
 update public.b2c_teaching_sessions set archived_at=clock_timestamp(),archived_by=auth.uid(),archive_reason=btrim(p_reason) where id=p_id returning to_jsonb(b2c_teaching_sessions.*) into v_after;
 insert into public.b2c_class_history(class_id,action,before_data,after_data,actor_id,actor_name)
 values(s.class_id,'archive_teaching_session',to_jsonb(s),v_after,auth.uid(),(select full_name from public.profiles where id=auth.uid()));
end $$;
revoke all on function public.archive_b2c_teaching_session(uuid,text) from public,anon;
grant execute on function public.archive_b2c_teaching_session(uuid,text) to authenticated;

create function app.guard_archived_teaching_session() returns trigger language plpgsql set search_path='' as $$
begin
 if OLD.archived_at is not null then raise exception 'Buổi dạy đã xóa, không thể cập nhật.' using errcode='22023'; end if;
 return NEW;
end $$;
revoke all on function app.guard_archived_teaching_session() from public,anon,authenticated;
create trigger guard_archived_teaching_session before update on public.b2c_teaching_sessions for each row execute function app.guard_archived_teaching_session();

do $$ declare d text; f record; begin
 select pg_get_functiondef('public.can_check_b2c_session(uuid)'::regprocedure) into d;
 if position('select app.can_check_b2c_session(p_id)' in d)=0 then raise exception 'Unexpected checkpoint permission function'; end if;
 execute replace(d,'select app.can_check_b2c_session(p_id)','select exists(select 1 from public.b2c_teaching_sessions where id=p_id and archived_at is null) and app.can_check_b2c_session(p_id)');
 -- Update both the aggregate implementation and wrapper (pending-price totals).
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','app') and p.proname='get_b2c_teaching_page' loop
  d:=pg_get_functiondef(f.oid);
  execute regexp_replace(d,'from public\.b2c_teaching_sessions s','from (select * from public.b2c_teaching_sessions where archived_at is null) s','gi');
 end loop;
end $$;
-- Retain the existing unique class/time slot and meeting FK: archive cannot
-- accidentally regenerate the same payroll entry or reopen teacher check-in.
notify pgrst,'reload schema';
