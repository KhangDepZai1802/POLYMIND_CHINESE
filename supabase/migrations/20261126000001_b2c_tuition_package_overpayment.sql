-- A package correction may leave a credit when its new fee is below net paid.
-- Keep receipts unchanged and retain the signed balance (total_due - net paid).
-- Existing CHECK constraints still require a nonnegative fee; the separate
-- reason/audit triggers and permission/stale/locking checks in the save RPC stay.
-- The receipt balance trigger still rejects any new collection above the fee.
drop trigger if exists b2c_package_edit on public.b2c_tuition_packages;
drop function if exists public.check_b2c_package_edit();

notify pgrst, 'reload schema';
