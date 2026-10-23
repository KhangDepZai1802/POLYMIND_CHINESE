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
 const version='20261023000006';
 const sql=fs.readFileSync('supabase/migrations/'+version+'_b2c_center_student_data.sql','utf8');
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
  const result=await c.query(fs.readFileSync('supabase/tests/database/b2c_center_student_data.test.sql','utf8'));
  for(const item of Array.isArray(result)?result:[result]) for(const row of item.rows) if(Object.values(row).some(v=>String(v).startsWith('ok:'))) console.log(row);
  await c.query('rollback');
 } else if(mode==='apply') {
  await c.query('begin');
  if((await c.query('select 1 from supabase_migrations.schema_migrations where version=$1',[version])).rowCount) throw new Error('Migration already exists');
  await c.query(sql);
  await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'b2c_center_student_data',[sql]]);
  await c.query('commit');
  console.log('Applied '+version);
 } else if(mode==='check-accounts') {
  const targets=await c.query("select p.id,b.full_name from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id join public.profiles p on p.id=t.user_id where b.full_name in ('Cô Lê','Cô Thy') and p.full_name=b.full_name and p.is_active and t.is_active");
  if(targets.rowCount!==2) throw new Error('Expected exactly two accounts');
  for(const target of targets.rows) {
   await c.query('begin');
   await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:target.id,role:'authenticated'})]);
   await c.query('set local role authenticated');
   const r=await c.query("select public.has_b2c_permission('manage_center_student_data') as allowed,public.has_b2c_permission('manage_admissions') as admissions,public.has_b2c_permission('manage_center_tuition') as tuition,public.can_manage_b2c_parents() as parents,public.can_add_b2c_students() as add_students,public.has_b2c_permission('create_classes') as create_classes,public.read_center_b2c_student_data()->>'total' as enrollments,public.read_center_b2c_student_data()->>'students' as students");
   if(!['allowed','admissions','tuition','parents','add_students','create_classes'].every(key=>r.rows[0][key])) throw new Error('Account lacks a required workflow permission');
   console.log(JSON.stringify({account:target.full_name,...r.rows[0]}));
   await c.query('rollback');
  }
 } else if(mode==='grant') {
  await c.query('begin');
  const actor=process.argv[3];
  if(!actor) throw new Error('Provide the requesting administrator email; never infer an audit actor.');
  const admin=await c.query("select id from public.profiles where role='super_admin' and is_active and lower(email)=lower($1)",[actor]);
  if(admin.rowCount!==1) throw new Error('Requesting administrator must match exactly one active account');
  const targets=await c.query("select b.id,b.full_name,b.source_teacher_id,g.updated_at::text as updated_at,coalesce(g.permissions,public.get_my_b2c_permissions()) as permissions from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id join public.profiles p on p.id=t.user_id left join public.b2c_teacher_permissions g on g.teacher_id=b.id where b.full_name in ('Cô Lê','Cô Thy') and p.full_name=b.full_name and p.role='teacher' and p.is_active and t.is_active for update of b");
  if(targets.rowCount!==2 || new Set(targets.rows.map(r=>r.full_name)).size!==2) throw new Error('Expected exactly two uniquely matched active accounts');
  // Preserve the established defaults when a teacher has no explicit grant row.
  const defaults=['view_classes','view_students','view_schedule','view_comments','check_teaching','view_pay'];
  await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:admin.rows[0].id,role:'authenticated'})]);
  await c.query('set local role authenticated');
  for(const row of targets.rows) {
   const old=row.updated_at ? row.permissions : defaults;
   if(!old.includes('manage_center_student_data')) await c.query('select public.save_b2c_teacher_permissions($1,$2,$3,$4)',[row.id,row.source_teacher_id,[...new Set([...old,'view_classes','create_classes','manage_center_student_data'])],row.updated_at]);
  }
  await c.query('commit');
  console.log('Granted center student data and class creation to exactly two matched accounts; previous permissions preserved; permission history recorded.');
 }
 console.log(JSON.stringify((await c.query("select b.full_name,g.permissions from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id join public.profiles p on p.id=t.user_id left join public.b2c_teacher_permissions g on g.teacher_id=b.id where b.full_name in ('Cô Lê','Cô Thy')")).rows));
 console.log(JSON.stringify((await c.query('select (select count(*)::int from public.b2c_enrollments) as enrollments,(select count(*)::int from public.b2c_tuition_packages) as packages,(select count(*)::int from public.b2c_tuition_receipts) as receipts')).rows));
} catch(e) { try {await c.query('rollback');} catch {} console.error(e.message);process.exitCode=1; } finally { await c.end(); }
