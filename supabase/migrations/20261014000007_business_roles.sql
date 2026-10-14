-- Enum values are committed separately before profiles use them.
-- No existing manager/super-admin helper or policy is widened.
alter type public.user_role add value if not exists 'executive';
alter type public.user_role add value if not exists 'center_manager';
alter type public.user_role add value if not exists 'consultant';
alter type public.user_role add value if not exists 'xkld_staff';
