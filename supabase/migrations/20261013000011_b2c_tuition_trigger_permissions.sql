begin;
-- Trigger helpers are not anonymous RPC entrypoints.
revoke execute on function public.check_b2c_package_edit(), public.check_b2c_receipt_balance() from public, anon;
grant execute on function public.check_b2c_package_edit(), public.check_b2c_receipt_balance() to authenticated;
notify pgrst, 'reload schema';
commit;
