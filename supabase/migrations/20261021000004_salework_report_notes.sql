begin;
alter table public.salework_daily_reports
  add column notes text not null default ''
  constraint salework_daily_reports_notes_length check (char_length(notes) <= 500);
notify pgrst, 'reload schema';
commit;
