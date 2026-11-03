import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.loadEnvFile(".env.local");
const { default: pg } = await import(pathToFileURL(path.join(process.env.TEMP, "polymind-b2c-db/node_modules/pg/lib/index.js")).href);
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const version = "20261103000003", name = "full_access_class_management";
const sql = fs.readFileSync(`supabase/migrations/${version}_${name}.sql`, "utf8");
const mode = process.argv[2] ?? "verify";
try {
  await client.connect();
  if (mode === "test") {
    await client.query("begin"); await client.query(sql);
    const result = await client.query("select b.full_name,cardinality(g.permissions) permission_count from public.b2c_full_access_teachers f join public.b2c_teachers b on b.id=f.teacher_id join public.b2c_teacher_permissions g on g.teacher_id=f.teacher_id order by b.full_name");
    if (result.rowCount !== 2 || result.rows.some(r => Number(r.permission_count) !== 22)) throw new Error("Full-access grant verification failed");
    if (!(await client.query("select to_regprocedure('public.read_b2c_class_teacher_options()') is not null as ok")).rows[0].ok) throw new Error("Teacher option RPC missing");
    await client.query("rollback"); console.log("Rollback test passed for exactly Cô Lê and Cô Thy");
  } else if (mode === "apply") {
    await client.query("begin");
    if ((await client.query("select 1 from supabase_migrations.schema_migrations where version=$1", [version])).rowCount) throw new Error("Migration already exists");
    await client.query(sql);
    await client.query("insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)", [version,name,[sql]]);
    await client.query("commit"); console.log(`Applied ${version}`);
  } else {
    const history = await client.query("select name,statements from supabase_migrations.schema_migrations where version=$1", [version]);
    if (history.rows[0]?.name !== name || history.rows[0]?.statements?.[0] !== sql) throw new Error("Migration history differs from reviewed SQL");
    const result = await client.query("select b.full_name,cardinality(g.permissions) permission_count from public.b2c_full_access_teachers f join public.b2c_teachers b on b.id=f.teacher_id join public.b2c_teacher_permissions g on g.teacher_id=f.teacher_id order by b.full_name");
    console.log(result.rows); console.log(`Verified ${version}`);
  }
} catch (error) {
  try { await client.query("rollback"); } catch {}
  console.error(error.message); process.exitCode = 1;
} finally { await client.end(); }
