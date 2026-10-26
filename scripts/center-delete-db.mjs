import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
process.loadEnvFile('.env.local');
const {default:pg}=await import(pathToFileURL(path.join(process.env.TEMP,'polymind-b2c-db/node_modules/pg/lib/index.js')).href);
const c=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});
const version='20261026000001', name='b2c_center_delete';
try {
 await c.connect();
 const mode=process.argv[2] || 'status';
 if(mode==='inspect') {
  console.log(JSON.stringify((await c.query("select p.full_name,p.email,p.is_active from public.profiles p where p.role='super_admin'")).rows));
  console.log(JSON.stringify((await c.query("select version,name from supabase_migrations.schema_migrations where version>='20261023000007' order by version")).rows));
  console.log(JSON.stringify((await c.query("select table_name,column_name from information_schema.columns where table_schema='public' and table_name in ('b2c_students','b2c_parents','b2c_tuition_packages') and column_name like '%archiv%'")).rows));
  console.log(JSON.stringify((await c.query("select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('save_b2c_tuition_package','read_b2c_tuition_corrections')")).rows));
 } else if(mode==='dry-run') {
  const r=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','db','push','--db-url',process.env.SUPABASE_DB_URL,'--dry-run'],{encoding:'utf8',windowsHide:true});
  let out=(r.stdout||'')+(r.stderr||'');
  for(const v of [process.env.SUPABASE_DB_URL,process.env.SUPABASE_DB_PASSWORD]) if(v) out=out.split(v).join('[redacted]');
  console.log(out);process.exitCode=r.status;
 } else if(['test','verify','apply'].includes(mode)) {
  const sql=fs.readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
  await c.query('begin');
  if(mode==='verify') {
   const h=await c.query('select statements from supabase_migrations.schema_migrations where version=$1',[version]);
   if(h.rows[0]?.statements?.[0]!==sql) throw new Error('Migration history differs from reviewed SQL');
  } else {
   if((await c.query('select 1 from supabase_migrations.schema_migrations where version=$1',[version])).rowCount) throw new Error('Migration already exists');
   await c.query(sql);
  }
  if(mode==='apply') {
   await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,name,[sql]]);
   await c.query('commit');console.log('Applied '+version);
  } else {
   const results=await c.query(fs.readFileSync('supabase/tests/database/b2c_center_delete.test.sql','utf8'));
   for(const result of Array.isArray(results)?results:[results]) for(const row of result.rows) console.log(Object.values(row).join(' '));
   await c.query('rollback');
  }
 } else if(mode==='regression') {
  for(const file of ['b2c_center_student_data.test.sql','b2c_teacher_parents.test.sql']) {
   await c.query('begin');
   await c.query(fs.readFileSync('supabase/tests/database/'+file,'utf8'));
   await c.query('rollback');console.log('Regression rollback passed: '+file);
  }
 } else if(mode==='check-accounts') {
  const targets=await c.query("select p.id,b.full_name from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id join public.profiles p on p.id=t.user_id where b.full_name in ('Cô Lê','Cô Thy') and p.full_name=b.full_name and p.is_active and t.is_active");
  if(targets.rowCount!==2) throw new Error('Expected exactly two accounts');
  for(const target of targets.rows) {
   await c.query('begin');
   await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:target.id,role:'authenticated'})]);
   await c.query('set local role authenticated');
   const r=await c.query("select public.has_b2c_permission('delete_center_records') as can_delete,public.has_b2c_permission('manage_center_student_data') as students,public.has_b2c_permission('manage_center_tuition') as tuition,public.can_manage_b2c_parents() as parents, public.read_teacher_b2c_parents_page()->>'total' as parent_count,public.read_center_b2c_student_data()->>'students' as student_count,public.read_center_b2c_tuition_page()->>'total' as tuition_count");
   if(!['can_delete','students','tuition','parents'].every(k=>r.rows[0][k])) throw new Error('Required workflow permission missing');
   await c.query("select public.read_b2c_tuition_corrections('ac260001-0000-4000-8000-999999999999',0)");
   console.log(JSON.stringify({account:target.full_name,...r.rows[0]}));
   await c.query('rollback');
  }
 } else if(mode==='grant') {
  const email=process.argv[3]; if(!email) throw new Error('Explicit requesting administrator email required');
  await c.query('begin');
  const admin=await c.query("select id from public.profiles where role='super_admin' and is_active and lower(email)=lower($1)",[email]);
  if(admin.rowCount!==1) throw new Error('Requesting administrator not uniquely matched');
  const targets=await c.query("select b.id,b.source_teacher_id,b.full_name,g.permissions,g.updated_at::text from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id join public.profiles p on p.id=t.user_id join public.b2c_teacher_permissions g on g.teacher_id=b.id where b.full_name in ('Cô Lê','Cô Thy') and p.full_name=b.full_name and p.role='teacher' and p.is_active and t.is_active for update of b");
  if(targets.rowCount!==2 || new Set(targets.rows.map(r=>r.full_name)).size!==2) throw new Error('Expected two uniquely matched active accounts');
  await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:admin.rows[0].id,role:'authenticated'})]);
  await c.query('set local role authenticated');
  for(const t of targets.rows) await c.query('select public.save_b2c_teacher_permissions($1,$2,$3,$4)',[t.id,t.source_teacher_id,[...new Set([...t.permissions,'delete_center_records'])],t.updated_at]);
  await c.query('commit');console.log('Granted delete_center_records to exactly Cô Lê and Cô Thy, preserving previous permissions and audit actor.');
 } else {
  console.log(JSON.stringify((await c.query("select version from supabase_migrations.schema_migrations order by version desc limit 3")).rows));
 }
} catch(e) {try {await c.query('rollback');}catch{} console.error(e.message);process.exitCode=1;} finally {await c.end();}
