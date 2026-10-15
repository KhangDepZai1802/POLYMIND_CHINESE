import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
process.loadEnvFile('.env.local');
const {default:pg} = await import(pathToFileURL(path.join(process.env.TEMP, 'polymind-b2c-db/node_modules/pg/lib/index.js')).href);
const {Client}=pg;
const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
async function main() {
 await client.connect();
 const mode = process.argv[2] || 'status';
 if (mode === 'status') {
   const result = await client.query("select version from supabase_migrations.schema_migrations order by version desc limit 5");
   console.log(JSON.stringify({ recent_migrations: result.rows }));
   const extensions = await client.query("select extname from pg_extension where extname='pgtap'");
   console.log(JSON.stringify({ pgtap: extensions.rowCount === 1 }));
 } else if (mode === 'test' || mode === 'verify') {
   await client.query('begin');
   const sql=fs.readFileSync('supabase/migrations/20261015000001_b2c_teacher_permissions.sql','utf8');
   if(mode === 'test') await client.query(sql);
   else {
     const history=await client.query('select statements from supabase_migrations.schema_migrations where version=$1',['20261015000001']);
     if(history.rows[0]?.statements?.[0]!==sql)throw new Error('Applied migration does not match the reviewed SQL.');
     const rls=await client.query("select count(*)::int as total from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('b2c_teacher_permissions','b2c_teacher_permission_history') and c.relrowsecurity");
     if(rls.rows[0].total!==2)throw new Error('Permission tables must have RLS enabled.');
     console.log('Verified applied SQL matches reviewed migration and both tables have RLS.');
   }
   const result = await client.query(fs.readFileSync('supabase/tests/database/b2c_teacher_permissions.test.sql','utf8'));
   for (const item of Array.isArray(result) ? result : [result]) for (const row of item.rows) console.log(Object.values(row).join(' '));
   await client.query('rollback');
 } else if (mode === 'apply') {
   const version = '20261015000001';
   await client.query('begin');
   const existing = await client.query('select 1 from supabase_migrations.schema_migrations where version=$1',[version]);
   if (existing.rowCount) throw new Error('Migration already applied; inspect history instead of replaying.');
   const sql = fs.readFileSync('supabase/migrations/'+version+'_b2c_teacher_permissions.sql','utf8');
   await client.query(sql);
   await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'b2c_teacher_permissions',[sql]]);
   await client.query('commit');
   console.log('Applied migration '+version);
 } else if (mode === 'dry-run') {
   const executable = path.join(process.cwd(),'node_modules/supabase/dist/supabase.js');
   const result = spawnSync(process.execPath,[executable,'db','push','--db-url',process.env.SUPABASE_DB_URL,'--dry-run'],{encoding:'utf8',windowsHide:true});
   let output = (result.stdout || '')+(result.stderr || '')+(result.error?.message || '');
   for (const value of [process.env.SUPABASE_DB_URL, process.env.SUPABASE_DB_PASSWORD]) if (value) output=output.split(value).join('[redacted]');
   console.log(output); process.exitCode=result.status || (result.error ? 1 : 0);
 }
}
main().catch(async error => { try { await client.query('rollback'); } catch {} console.error(error.message); process.exitCode=1; }).finally(()=>client.end());
