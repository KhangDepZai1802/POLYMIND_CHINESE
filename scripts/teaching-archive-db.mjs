import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
process.loadEnvFile('.env.local');
const {default:pg}=await import(pathToFileURL(path.join(process.env.TEMP,'polymind-b2c-db/node_modules/pg/lib/index.js')).href);
const c=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});
const version='20261026000002',name='b2c_teaching_archive';
try {
 await c.connect();
 const mode=process.argv[2] || 'status';
 if(mode==='dry-run') {
  const r=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','db','push','--db-url',process.env.SUPABASE_DB_URL,'--dry-run'],{encoding:'utf8',windowsHide:true});
  let out=(r.stdout||'')+(r.stderr||'');
  for(const v of [process.env.SUPABASE_DB_URL,process.env.SUPABASE_DB_PASSWORD]) if(v) out=out.split(v).join('[redacted]');
  console.log(out);process.exitCode=r.status;
 } else if(mode==='inspect') {
  console.log((await c.query("select pg_get_functiondef('public.can_check_b2c_session(uuid)'::regprocedure) as definition")).rows[0].definition);
 } else if(['test','apply','verify'].includes(mode)) {
  const sql=fs.readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
  await c.query('begin');
  if(mode==='verify') {
   const h=await c.query('select statements from supabase_migrations.schema_migrations where version=$1',[version]);
   if(h.rows[0]?.statements?.[0]!==sql)throw Error('Applied SQL differs from reviewed migration');
  } else {
   if((await c.query('select 1 from supabase_migrations.schema_migrations where version=$1',[version])).rowCount)throw Error('Migration already applied');
   await c.query(sql);
  }
  if(mode==='apply') {
   await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,name,[sql]]);
   await c.query('commit');console.log('Applied '+version);
  } else {
   const results=await c.query(fs.readFileSync('supabase/tests/database/b2c_teaching_archive.test.sql','utf8'));
   for(const r of Array.isArray(results)?results:[results])for(const row of r.rows)console.log(Object.values(row).join(' '));
   await c.query('rollback');
  }
 } else {
  console.log(JSON.stringify((await c.query('select version,name from supabase_migrations.schema_migrations order by version desc limit 3')).rows));
 }
}catch(e){try{await c.query('rollback');}catch{}console.error(e.message);process.exitCode=1;}finally{await c.end();}
