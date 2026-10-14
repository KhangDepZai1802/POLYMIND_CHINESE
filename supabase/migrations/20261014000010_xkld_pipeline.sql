create function app.xkld_stage_codes() returns text[] language sql immutable set search_path='' as $$
  select array['lead','consultation','registration','language_training','documentation','interview','selected','visa','departed','aftercare']::text[];
$$;
revoke all on function app.xkld_stage_codes() from public,anon;
grant execute on function app.xkld_stage_codes() to authenticated;

alter table public.xkld_candidates
  add column stage text not null default 'lead' check(stage=any(app.xkld_stage_codes())),
  add column order_id uuid references public.xkld_orders(id) on delete restrict,
  add column b2c_class_id uuid references public.b2c_classes(id) on delete restrict;
create index xkld_candidates_stage on public.xkld_candidates(stage,updated_at desc,id desc);

-- Business progress history, not the global administrator audit log.
-- No FK cascade: progress snapshots survive removal outside the user flow.
create table public.xkld_pipeline_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  candidate_id uuid not null,
  candidate_code text not null,
  from_stage text,
  to_stage text not null check(to_stage=any(app.xkld_stage_codes())),
  old_order_code text,
  new_order_code text,
  old_class_label text,
  new_class_label text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default clock_timestamp(),
  note text not null default '' check(length(note)<=2000),
  -- Store IDs to verify retry payloads; labels remain readable after renaming.
  order_id uuid,
  b2c_class_id uuid
);
alter table public.xkld_pipeline_history enable row level security;
create policy xkld_progress_read on public.xkld_pipeline_history for select to authenticated using(app.can_read_xkld_candidates());
revoke all on public.xkld_pipeline_history from public,anon,authenticated;
grant select on public.xkld_pipeline_history to authenticated;
create index xkld_pipeline_history_candidate on public.xkld_pipeline_history(candidate_id,created_at desc,id desc);

create function app.record_xkld_progress() returns trigger language plpgsql security definer set search_path='' as $$
declare v_note text; v_request uuid;
begin
  if tg_op='UPDATE' and new.stage is not distinct from old.stage and new.order_id is not distinct from old.order_id and new.b2c_class_id is not distinct from old.b2c_class_id then return new; end if;
  if tg_op='INSERT' then v_note:='Tiếp nhận ứng viên'; v_request:=new.create_request_id;
  else v_note:=coalesce(current_setting('app.xkld_transition_note',true),''); v_request:=coalesce(nullif(current_setting('app.xkld_transition_request',true),'')::uuid,gen_random_uuid()); end if;
  insert into public.xkld_pipeline_history(request_id,candidate_id,candidate_code,from_stage,to_stage,old_order_code,new_order_code,old_class_label,new_class_label,actor_id,actor_name,note,order_id,b2c_class_id)
  values(v_request,new.id,new.code,case when tg_op='UPDATE' then old.stage end,new.stage,
    case when tg_op='UPDATE' then (select code from public.xkld_orders where id=old.order_id) end,
    (select code from public.xkld_orders where id=new.order_id),
    case when tg_op='UPDATE' then (select code || ' · ' || name from public.b2c_classes where id=old.b2c_class_id) end,
    (select code || ' · ' || name from public.b2c_classes where id=new.b2c_class_id),auth.uid(),
    (select full_name from public.profiles where id=auth.uid()),v_note,new.order_id,new.b2c_class_id);
  return new;
end;
$$;
revoke all on function app.record_xkld_progress() from public,anon,authenticated;
create trigger record_xkld_progress after insert or update on public.xkld_candidates for each row execute function app.record_xkld_progress();

-- Pipeline columns have no direct INSERT/UPDATE grants. This atomic, locked RPC
-- is the only user write path. Permissions are rechecked inside the definer.
create function public.transition_xkld_candidate(
  p_candidate_id uuid,p_stage text,p_order_id uuid,p_b2c_class_id uuid,
  p_expected_updated_at timestamptz,p_request_id uuid,p_note text default ''
) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.xkld_candidates; e public.xkld_pipeline_history; old_pos int; new_pos int; prev_note text; prev_request text;
begin
  if not coalesce(app.can_edit_xkld_candidates(),false) then raise exception 'Không có quyền cập nhật pipeline' using errcode='42501'; end if;
  if p_request_id is null or p_expected_updated_at is null or p_candidate_id is null or p_stage is null or length(coalesce(p_note,''))>2000 then raise exception 'Dữ liệu chuyển bước không hợp lệ' using errcode='P0001'; end if;
  select * into c from public.xkld_candidates where id=p_candidate_id for update;
  if not found then raise exception 'Không tìm thấy ứng viên' using errcode='P0001'; end if;
  select * into e from public.xkld_pipeline_history where request_id=p_request_id;
  if found then
    if e.candidate_id=c.id and e.actor_id=auth.uid() and e.to_stage=p_stage and e.order_id is not distinct from p_order_id and e.b2c_class_id is not distinct from p_b2c_class_id and e.note=btrim(coalesce(p_note,'')) then return c.id; end if;
    raise exception 'Yêu cầu đã được dùng cho thao tác khác' using errcode='P0001';
  end if;
  if c.updated_at<>p_expected_updated_at then raise exception 'Hồ sơ đã được cập nhật. Tải lại trang trước khi chuyển bước.' using errcode='P0001'; end if;
  old_pos:=array_position(app.xkld_stage_codes(),c.stage); new_pos:=array_position(app.xkld_stage_codes(),p_stage);
  if new_pos is null or new_pos>old_pos+1 then raise exception 'Chỉ được tiến tới bước kế tiếp trong quy trình' using errcode='P0001'; end if;
  if new_pos<old_pos and btrim(coalesce(p_note,''))='' then raise exception 'Vui lòng nhập lý do quay lại bước trước' using errcode='P0001'; end if;
  if new_pos>=4 and p_b2c_class_id is null then raise exception 'Vui lòng liên kết lớp B2C ở bước đào tạo ngoại ngữ' using errcode='P0001'; end if;
  if new_pos>=6 and p_order_id is null then raise exception 'Vui lòng gắn đơn hàng trước bước phỏng vấn' using errcode='P0001'; end if;
  if p_b2c_class_id is not null and (c.b2c_class_id is distinct from p_b2c_class_id) and not exists(select 1 from public.b2c_classes where id=p_b2c_class_id and status in ('planned','active')) then raise exception 'Lớp B2C không còn nhận liên kết mới' using errcode='P0001'; end if;
  if p_order_id is not null and (c.order_id is distinct from p_order_id) and not exists(select 1 from public.xkld_orders o join public.xkld_markets m on m.id=o.market_id where o.id=p_order_id and o.status='open' and o.recruitment_deadline>=(now() at time zone 'Asia/Ho_Chi_Minh')::date and m.is_active) then raise exception 'Đơn hàng không còn tuyển hoặc đã quá hạn' using errcode='P0001'; end if;
  if c.stage=p_stage and c.order_id is not distinct from p_order_id and c.b2c_class_id is not distinct from p_b2c_class_id then return c.id; end if;
  prev_note:=coalesce(current_setting('app.xkld_transition_note',true),''); prev_request:=coalesce(current_setting('app.xkld_transition_request',true),'');
  perform set_config('app.xkld_transition_note',btrim(coalesce(p_note,'')),true);
  perform set_config('app.xkld_transition_request',p_request_id::text,true);
  update public.xkld_candidates set stage=p_stage,order_id=p_order_id,b2c_class_id=p_b2c_class_id where id=c.id;
  perform set_config('app.xkld_transition_note',prev_note,true); perform set_config('app.xkld_transition_request',prev_request,true);
  return c.id;
end;
$$;
revoke all on function public.transition_xkld_candidate(uuid,text,uuid,uuid,timestamptz,uuid,text) from public,anon;
grant execute on function public.transition_xkld_candidate(uuid,text,uuid,uuid,timestamptz,uuid,text) to authenticated;

create function public.get_xkld_pipeline(p_query text default '',p_assignee uuid default null,p_stage text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not coalesce(app.can_read_xkld_candidates(),false) then raise exception 'Không có quyền xem pipeline' using errcode='42501'; end if;
  if length(coalesce(p_query,''))>200 or p_page<0 or p_page>1000000 or (p_stage<>'' and not p_stage=any(app.xkld_stage_codes())) then raise exception 'Bộ lọc không hợp lệ' using errcode='P0001'; end if;
  with filtered as (
    select c.*,row_number() over(partition by c.stage order by c.updated_at desc,c.id desc) as rn
    from public.xkld_candidates c where (p_assignee is null or c.assignee_id=p_assignee)
    and (coalesce(btrim(p_query),'')='' or strpos(lower(c.search_text),lower(btrim(p_query)))>0)
  ), stages as (select s,ord from unnest(app.xkld_stage_codes()) with ordinality as u(s,ord))
  select jsonb_agg(jsonb_build_object('stage',s.s,'total',(select count(*) from filtered f where f.stage=s.s),'candidates',coalesce((
    select jsonb_agg(row_data order by updated_at desc,id desc) from (
      select f.updated_at,f.id,jsonb_build_object('id',f.id,'code',f.code,'full_name',f.full_name,'phone',f.phone,'stage',f.stage,'assignee_id',f.assignee_id,'assignee_name',p.full_name,'updated_at',f.updated_at,
        'order_id',f.order_id,'order_code',o.code,'order_employer',o.employer,'b2c_class_id',f.b2c_class_id,'class_label',b.code || ' · ' || b.name) as row_data
      from filtered f left join public.profiles p on p.id=f.assignee_id left join public.xkld_orders o on o.id=f.order_id left join public.b2c_classes b on b.id=f.b2c_class_id
      where f.stage=s.s and (p_stage='' or s.s=p_stage) and f.rn>case when p_stage<>'' then p_page*20 else 0 end and f.rn<=case when p_stage<>'' then p_page*20+20 else 20 end
    ) cards),'[]'::jsonb)) order by s.ord) into result from stages s;
  return coalesce(result,'[]'::jsonb);
end;
$$;
revoke all on function public.get_xkld_pipeline(text,uuid,text,integer) from public,anon;
grant execute on function public.get_xkld_pipeline(text,uuid,text,integer) to authenticated;

-- Search only class labels needed for linking. B2C student/finance RLS stays closed.
create function public.search_xkld_b2c_classes(p_query text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not coalesce(app.can_read_xkld_candidates(),false) then raise exception 'Không có quyền xem lớp liên kết' using errcode='42501'; end if;
  if length(coalesce(p_query,''))>200 or p_page<0 or p_page>1000000 then raise exception 'Bộ lọc không hợp lệ' using errcode='P0001'; end if;
  with available as (select id,code,name,program_slug,status from public.b2c_classes where status in ('planned','active') and (coalesce(btrim(p_query),'')='' or strpos(lower(code || ' ' || name),lower(btrim(p_query)))>0))
  select jsonb_build_object('total',(select count(*) from available),'rows',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from available order by code,id offset p_page*20 limit 20) r),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.search_xkld_b2c_classes(text,integer) from public,anon;
grant execute on function public.search_xkld_b2c_classes(text,integer) to authenticated;

create function public.search_xkld_pipeline_orders(p_query text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not coalesce(app.can_read_xkld_candidates(),false) then raise exception 'Không có quyền xem đơn hàng' using errcode='42501'; end if;
  if length(coalesce(p_query,''))>200 or p_page<0 or p_page>1000000 then raise exception 'Bộ lọc không hợp lệ' using errcode='P0001'; end if;
  with available as (select o.id,o.code,o.employer,m.country_name from public.xkld_orders o join public.xkld_markets m on m.id=o.market_id
    where o.status='open' and m.is_active and o.recruitment_deadline>=(now() at time zone 'Asia/Ho_Chi_Minh')::date
    and (coalesce(btrim(p_query),'')='' or strpos(lower(o.code || ' ' || o.employer),lower(btrim(p_query)))>0))
  select jsonb_build_object('total',(select count(*) from available),'rows',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from available order by code,id offset p_page*20 limit 20) r),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.search_xkld_pipeline_orders(text,integer) from public,anon;
grant execute on function public.search_xkld_pipeline_orders(text,integer) to authenticated;
notify pgrst,'reload schema';
