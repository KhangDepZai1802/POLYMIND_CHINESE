-- Explicit grouping also works when parent identity uses a deferrable primary key.
create or replace function public.read_b2c_nps_admin(p_survey_id uuid default null,p_page integer default 0,p_query text default '',p_survey_page integer default 0,p_response_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.b2c_nps_surveys; v_stats jsonb; v_rows jsonb; v_total bigint;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Không có quyền xem phản hồi phụ huynh.' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 1000000 or p_survey_page is null or p_survey_page not between 0 and 1000000 or p_response_page is null or p_response_page not between 0 and 1000000 or p_query is null or char_length(p_query)>200 then raise exception 'Bộ lọc không hợp lệ.' using errcode='22023'; end if;
 if p_survey_id is null then select * into s from public.b2c_nps_surveys order by updated_at desc,id limit 1 offset p_survey_page::bigint*10;
 else select * into s from public.b2c_nps_surveys where id=p_survey_id;
  if not found then raise exception 'Không tìm thấy khảo sát.' using errcode='22023'; end if;
 end if;
 select jsonb_build_object('responses',count(*),'invitations',(select count(*) from public.b2c_nps_invitations where survey_id=s.id),
  'promoters',count(*) filter(where r.score>=9),'passives',count(*) filter(where r.score between 7 and 8),'detractors',count(*) filter(where r.score<=6),
  'nps',round(100.0*(count(*) filter(where r.score>=9)-count(*) filter(where r.score<=6))/nullif(count(*),0),1)) into v_stats
 from public.b2c_nps_responses r join public.b2c_nps_invitations i on i.id=r.invitation_id where i.survey_id=s.id;
 with parents as (
  select p.id as parent_id,p.full_name as parent_name,p.zalo,p.email,string_agg(distinct st.code||' · '||st.full_name,', ') as children
  from public.b2c_enrollments e join public.b2c_students st on st.id=e.student_id join public.b2c_student_parents l on l.student_id=e.student_id join public.b2c_parents p on p.id=l.parent_id
  where e.class_id=s.class_id group by p.id,p.full_name,p.zalo,p.email
 ), filtered as (
  select p.*,i.id as invite_id,i.updated_at as invite_updated_at,coalesce(i.revoked,false) as revoked,r.score,r.created_at as answered_at
  from parents p left join public.b2c_nps_invitations i on i.survey_id=s.id and i.parent_id=p.parent_id left join public.b2c_nps_responses r on r.invitation_id=i.id
  where p_query='' or position(lower(btrim(p_query)) in lower(concat_ws(' ',p.parent_name,p.children)))>0
 ), rows as (select * from filtered order by parent_name,parent_id limit 20 offset p_page::bigint*20)
 select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(x) order by parent_name,parent_id) from rows x),'[]') into v_total,v_rows;
 return jsonb_build_object('selected',case when s.id is not null then to_jsonb(s)||jsonb_build_object('class_code',(select code from public.b2c_classes where id=s.class_id),'class_name',(select name from public.b2c_classes where id=s.class_id)) end,
 'surveys',(select coalesce(jsonb_agg(to_jsonb(x) order by updated_at desc,id),'[]') from (select a.id,a.class_id,a.title,a.status,a.expires_at,a.updated_at,c.code as class_code,c.name as class_name from public.b2c_nps_surveys a join public.b2c_classes c on c.id=a.class_id order by a.updated_at desc,a.id limit 10 offset p_survey_page::bigint*10) x),
 'survey_total',(select count(*) from public.b2c_nps_surveys),'stats',v_stats,'rows',v_rows,'total',v_total,
 'unlinked_students',(select count(distinct e.student_id) from public.b2c_enrollments e where e.class_id=s.class_id and not exists(select 1 from public.b2c_student_parents l where l.student_id=e.student_id)),
 'response_total',(select count(*) from public.b2c_nps_responses r join public.b2c_nps_invitations i on i.id=r.invitation_id where i.survey_id=s.id),
 'responses',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id desc),'[]') from (select r.id,i.parent_name,r.score,r.reason,r.teacher_feedback,r.service_feedback,r.created_at from public.b2c_nps_responses r join public.b2c_nps_invitations i on i.id=r.invitation_id where i.survey_id=s.id order by r.created_at desc,r.id desc limit 20 offset p_response_page::bigint*20) x));
end $$;
