-- A linked B2C student may read only their own tuition periods and receipts.
-- Keep the projection behind one security-definer RPC instead of widening raw
-- table RLS or accepting a student/enrollment identifier from the client.
create or replace function public.read_my_b2c_tuition() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_student uuid := app.my_b2c_student_id();
  v_periods jsonb;
begin
  if not app.is_active() or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'student'
  ) then
    raise exception 'Vui lòng đăng nhập bằng tài khoản học viên đang hoạt động.' using errcode = '42501';
  end if;

  if v_student is null then
    return jsonb_build_object('linked_student', null, 'periods', '[]'::jsonb);
  end if;

  with own_periods as (
    select
      e.id as enrollment_id,
      e.status as enrollment_status,
      c.id as class_id,
      c.code as class_code,
      c.name as class_name,
      p.id as package_id,
      p.period_no,
      p.is_current,
      p.sessions,
      p.unit_price,
      p.discount,
      p.total_due,
      coalesce(payment.paid_amount, 0) as paid_amount,
      case when p.id is null then null
        else greatest(p.total_due - coalesce(payment.paid_amount, 0), 0)
      end as balance,
      coalesce(payment.receipts, '[]'::jsonb) as receipts
    from public.b2c_enrollments e
    join public.b2c_classes c on c.id = e.class_id
    left join public.b2c_tuition_packages p
      on p.enrollment_id = e.id and p.archived_at is null
    left join lateral (
      select
        coalesce(sum(r.effective_amount), 0) as paid_amount,
        coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id,
          'code', r.code,
          'paid_date', r.paid_date,
          'amount', r.amount,
          'method', r.method,
          'collector_name', r.collector_name,
          'refunded_amount', r.refunded_amount,
          'cancelled_at', r.cancelled_at,
          'effective_amount', r.effective_amount
        ) order by r.paid_date desc, r.created_at desc, r.id), '[]'::jsonb) as receipts
      from public.b2c_tuition_receipts r where r.package_id = p.id
    ) payment on true
    where e.student_id = v_student
  )
  select coalesce(jsonb_agg(to_jsonb(own_periods)
    order by class_name, is_current desc nulls last, period_no desc nulls last,
      enrollment_id, package_id), '[]'::jsonb)
  into v_periods from own_periods;

  return jsonb_build_object(
    'linked_student', (
      select jsonb_build_object('id', id, 'code', code, 'full_name', full_name)
      from public.b2c_students where id = v_student
    ),
    'periods', v_periods
  );
end;
$$;

revoke all on function public.read_my_b2c_tuition() from public, anon;
grant execute on function public.read_my_b2c_tuition() to authenticated;
notify pgrst, 'reload schema';
