// Explicit administrator provisioning. Never resets an existing account.
// Usage: set BUSINESS_BOOTSTRAP_PASSWORD in the process environment, then
// node scripts/bootstrap-business-accounts.mjs [--apply]
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const accounts = [
  { username: 'ms.thuong', full_name: 'MS Thương', role: 'executive' },
  { username: 'quanly.trungtam', full_name: 'Quản lý trung tâm', role: 'center_manager' },
  { username: 'tuvan.cskh', full_name: 'Tư vấn / CSKH', role: 'consultant' },
  { username: 'nhanvien.xkld', full_name: 'Nhân viên XKLĐ', role: 'xkld_staff' },
];

async function main() {
  const apply = process.argv.includes('--apply');
  const password = process.env.BUSINESS_BOOTSTRAP_PASSWORD;
  if (apply && (typeof password !== 'string' || password.length < 6 || password.length > 72)) {
    throw new Error('Set BUSINESS_BOOTSTRAP_PASSWORD (6–72 characters); password is never logged.');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase provisioning configuration.');
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing, error } = await admin.from('profiles').select('id,username,role,is_active').in('username', accounts.map(a => a.username));
  if (error) throw new Error('Cannot inspect account names: ' + error.code);
  const missing = [];
  for (const account of accounts) {
    const row = existing.find(p => p.username === account.username);
    if (row) {
      if (row.role !== account.role || !row.is_active) throw new Error('Account name collision: ' + account.username + '; no existing account changed.');
      console.log(JSON.stringify({ username: account.username, role: row.role, action: 'exists; unchanged' }));
    } else {
      missing.push(account);
      console.log(JSON.stringify({ username: account.username, role: account.role, action: apply ? 'create' : 'would create' }));
    }
  }
  if (!apply) return;
  const created = [];
  try {
    for (const account of missing) {
      const email = `${account.username}@login.polymind.local`;
      const { data, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (createError || !data.user) throw new Error('Auth create rejected for ' + account.username + ': ' + (createError?.code ?? 'unknown'));
      created.push(data.user.id);
      const { error: profileError } = await admin.from('profiles').upsert({ id: data.user.id, ...account, is_active: true, email: null }, { onConflict: 'id' });
      if (profileError) throw new Error('Profile create rejected for ' + account.username + ': ' + profileError.code);
    }
    for (const account of missing) {
      // Verify real login and RLS-visible own profile without logging tokens.
      const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: session, error: loginError } = await client.auth.signInWithPassword({ email: `${account.username}@login.polymind.local`, password });
      if (loginError || !session.user) throw new Error('Login verification failed for ' + account.username);
      const { data: own, error: ownError } = await client.from('profiles').select('username,role,is_active').eq('id', session.user.id).single();
      if (ownError || own.username !== account.username || own.role !== account.role || !own.is_active) throw new Error('Own profile verification failed for ' + account.username);
      const { count, error: auditError } = await client.from('audit_logs').select('id', { count: 'exact', head: true });
      if (auditError || count !== 0) throw new Error('Audit isolation verification failed for ' + account.username);
      const { count: profileCount, error: profilesError } = await client.from('profiles').select('id', { count: 'exact', head: true });
      if (profilesError || profileCount !== 1) throw new Error('Profile isolation verification failed for ' + account.username);
      const { data: b2c, error: b2cError } = await client.from('b2c_monthly_reports').select('id').limit(1);
      if (b2cError || b2c.length) throw new Error('Unexpected business-data access for ' + account.username);
      await client.auth.signOut();
      console.log(JSON.stringify({ username: account.username, role: own.role, login: 'verified', isolation: 'verified' }));
    }
    console.log(JSON.stringify({ created: created.length, unchanged: existing.length }));
  } catch (error) {
    // Only roll back accounts created by this invocation, never pre-existing users.
    for (const id of created.reverse()) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(id);
      if (cleanupError) console.error('Provisioning cleanup requires attention for user id ' + id);
    }
    throw error;
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
