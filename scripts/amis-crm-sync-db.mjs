import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
process.loadEnvFile(".env.local");
const { default: pg } = await import(pathToFileURL(path.join(process.env.TEMP, "polymind-b2c-db/node_modules/pg/lib/index.js")).href);
const version = "20261023000007";
const sql = fs.readFileSync(`supabase/migrations/${version}_amis_crm_admissions_sync.sql`, "utf8");
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  const mode = process.argv[2] ?? "verify";
  if (mode === "apply") {
    if ((await client.query("select 1 from supabase_migrations.schema_migrations where version=$1", [version])).rowCount) throw new Error("Migration already exists");
    await client.query(sql);
    await client.query("insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)", [version, "amis_crm_admissions_sync", [sql]]);
    console.log(`Applied ${version}`);
  }
  const result = await client.query("select count(*)::int as total,count(amis_crm_id)::int as crm_rows,count(*) filter(where amis_crm_id is not null and phone is null)::int as missing_phone from public.b2c_admission_leads");
  console.log(JSON.stringify(result.rows[0]));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
