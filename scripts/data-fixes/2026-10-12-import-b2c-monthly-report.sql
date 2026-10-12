-- Nhập các số liệu có giá trị trong `Copy of Bao_cao_thang 1.xlsx`.
-- File không có cột năm; năm 2026 được chốt theo thời điểm báo cáo được cung cấp.
-- Lấy tổng chi phí từ sheet `Chi phí` (đủ Internet + Lương), không lấy ô tổng
-- ở sheet `Tổng hợp` vì công thức tại đó bỏ sót hai khoản này.

begin;

insert into public.b2c_monthly_reports as r (
  report_year, report_month, revenue,
  electricity_cost, water_cost, internet_cost, payroll_cost,
  rent_cost, marketing_cost, advertising_cost, other_cost, notes
) values
  (2026, 8, 58040000, 1164197, 204863, 206500, 57137000, 12000000, 0, 0, 9367000, null),
  (2026, 9, 34685000, 961470, 119000, 206500, 54780000, 12000000, 0, 0, 1353000, null)
on conflict (report_year, report_month) do update set
  revenue = excluded.revenue,
  electricity_cost = excluded.electricity_cost,
  water_cost = excluded.water_cost,
  internet_cost = excluded.internet_cost,
  payroll_cost = excluded.payroll_cost,
  rent_cost = excluded.rent_cost,
  marketing_cost = excluded.marketing_cost,
  advertising_cost = excluded.advertising_cost,
  other_cost = excluded.other_cost,
  notes = excluded.notes;

delete from public.b2c_monthly_program_metrics m
using public.b2c_monthly_reports r
where m.report_id = r.id
  and r.report_year = 2026
  and r.report_month in (8, 9);

insert into public.b2c_monthly_program_metrics (
  report_id, program_slug, opening_students, new_students,
  departed_students, lessons_taught, lessons_paid
)
select r.id, v.program_slug, v.opening_students, v.new_students,
       v.departed_students, 0, 0
from public.b2c_monthly_reports r
join (values
  (8, 'tieng-anh', 27, 0, 0),
  (8, 'tieng-trung', 28, 0, 0),
  (8, 'tieng-viet', 0, 0, 0),
  (8, 'lop-ve', 3, 0, 0),
  (8, 'kem-1-1', 0, 0, 0),
  (9, 'tieng-anh', 27, 0, 3),
  (9, 'tieng-trung', 28, 0, 2),
  (9, 'tieng-viet', 0, 0, 0),
  (9, 'lop-ve', 3, 2, 0),
  (9, 'kem-1-1', 0, 0, 0)
) as v(report_month, program_slug, opening_students, new_students, departed_students)
  on r.report_year = 2026 and r.report_month = v.report_month;

commit;

select report_year, report_month, revenue,
       electricity_cost + water_cost + internet_cost + payroll_cost + rent_cost
       + marketing_cost + advertising_cost + other_cost as total_cost,
       revenue - (electricity_cost + water_cost + internet_cost + payroll_cost
       + rent_cost + marketing_cost + advertising_cost + other_cost) as profit
from public.b2c_monthly_reports
where report_year = 2026 and report_month in (8, 9)
order by report_month;
