-- Chỉ chạy trong giao dịch rollback. Không commit dữ liệu kiểm thử này.
insert into public.b2c_admission_leads(full_name,phone,program_slug,salesperson,stage)
select 'PERF-B2C-PAGE-'||n,'0912345678','tieng-anh','Test',
  (array['lead','consulted','trial','deposit','enrolled'])[1+(n%5)]
from generate_series(1,5000) n;
insert into public.b2c_admission_care_logs(lead_id,channel,contact_date,caretaker_name,content,next_followup_date,created_at)
select l.id,'call','2026-10-13','Test','Kiểm tra tải','2026-10-20',now()-n*interval '1 minute'
from public.b2c_admission_leads l cross join generate_series(1,5) n
where full_name like 'PERF-B2C-PAGE-%';
