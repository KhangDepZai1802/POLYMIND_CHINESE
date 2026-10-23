import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
process.loadEnvFile('.env.local');
const {default:pg}=await import(pathToFileURL(path.join(process.env.TEMP,'polymind-b2c-db/node_modules/pg/lib/index.js')).href);
const c=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});
try {
 await c.connect();
 const mode=process.argv[2] || 'status';
 const version='20261023000002';
 const sql=fs.readFileSync('supabase/migrations/'+version+'_b2c_archive_admissions.sql','utf8');
 if(mode==='dry-run') {
  const r=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','db','push','--db-url',process.env.SUPABASE_DB_URL,'--dry-run'],{encoding:'utf8',windowsHide:true});
  let output=(r.stdout||'')+(r.stderr||'');
  for(const value of [process.env.SUPABASE_DB_URL,process.env.SUPABASE_DB_PASSWORD]) if(value) output=output.split(value).join('[redacted]');
  console.log(output);process.exitCode=r.status;
 } else if(mode==='test' || mode==='verify') {
  await c.query('begin');
  if(mode==='test') await c.query(sql);
  else {
   const h=await c.query('select statements from supabase_migrations.schema_migrations where version=$1',[version]);
   if(h.rows[0]?.statements?.[0]!==sql) throw new Error('Migration history differs from reviewed SQL');
  }
  const result=await c.query(fs.readFileSync('supabase/tests/database/b2c_archive_admissions.test.sql','utf8'));
  for(const item of Array.isArray(result)?result:[result]) for(const row of item.rows) if(Object.values(row).some(v=>String(v).startsWith('ok:'))) console.log(row);
  await c.query('rollback');
 } else if(mode==='apply') {
  await c.query('begin');
  if((await c.query('select 1 from supabase_migrations.schema_migrations where version=$1',[version])).rowCount) throw new Error('Migration already exists');
  await c.query(sql);
  await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'b2c_archive_admissions',[sql]]);
  await c.query('commit');
  console.log('Applied '+version);
 }
 console.log(JSON.stringify((await c.query("select b.full_name,g.permissions from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id join public.profiles p on p.id=t.user_id left join public.b2c_teacher_permissions g on g.teacher_id=b.id where b.full_name in ('Cô Lê','Cô Thy')")).rows));
 console.log(JSON.stringify((await c.query('select count(*)::int as leads from public.b2c_admission_leads')).rows));
} catch(e) { try {await c.query('rollback');} catch {} console.error(e.message);process.exitCode=1; } finally { await c.end(); }
