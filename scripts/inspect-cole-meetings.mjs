import path from 'node:path';
import { pathToFileURL } from 'node:url';
process.loadEnvFile('.env.local');
const {default:pg}=await import(pathToFileURL(path.join(process.env.TEMP,'polymind-b2c-db/node_modules/pg/lib/index.js')).href);
const c=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});
try {
 await c.connect();
 const r=await c.query("select id,code,name,teacher_name,weekdays_text,time_text,status,start_date,end_date from public.b2c_classes where teacher_name ilike '%Lê%' order by code");
 console.log('CLASSES',JSON.stringify(r.rows));
 const m=await c.query("select m.id,c.code,m.starts_at,m.ends_at,m.status,m.teacher_name,m.teaching_session_id from public.b2c_class_meetings m join public.b2c_classes c on c.id=m.class_id where c.teacher_name ilike '%Lê%' order by m.starts_at desc limit 15");
 console.log('MEETINGS',JSON.stringify(m.rows));
}catch(e){console.error(e.code || 'DB connection failed');process.exitCode=1;}finally{await c.end();}
