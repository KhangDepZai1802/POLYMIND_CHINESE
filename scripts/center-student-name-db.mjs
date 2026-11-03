import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.loadEnvFile(".env.local");
const { default: pg } = await import(
  pathToFileURL(path.join(process.env.TEMP, "polymind-b2c-db/node_modules/pg/lib/index.js")).href
);
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const version = "20261103000002";
const name = "center_student_name";
const sql = fs.readFileSync(`supabase/migrations/${version}_${name}.sql`, "utf8");
const mode = process.argv[2] ?? "verify";

try {
  await client.connect();
  if (mode === "test") {
    await client.query("begin");
    await client.query(sql);
    const result = await client.query(fs.readFileSync("supabase/tests/database/b2c_center_student_data.test.sql", "utf8"));
    for (const item of Array.isArray(result) ? result : [result])
      for (const row of item.rows)
        if (Object.values(row).some((value) => String(value).startsWith("ok:"))) console.log(row);
    await client.query("rollback");
  } else if (mode === "apply") {
    await client.query("begin");
    if ((await client.query("select 1 from supabase_migrations.schema_migrations where version=$1", [version])).rowCount)
      throw new Error("Migration already exists");
    await client.query(sql);
    await client.query(
      "insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)",
      [version, name, [sql]],
    );
    await client.query("commit");
    console.log(`Applied ${version}`);
  } else {
    const history = await client.query("select name,statements from supabase_migrations.schema_migrations where version=$1", [version]);
    if (history.rows[0]?.name !== name || history.rows[0]?.statements?.[0] !== sql)
      throw new Error("Migration history differs from reviewed SQL");
    const definition = await client.query(
      "select position('full_name=v_name' in pg_get_functiondef('public.save_center_b2c_student_data(jsonb)'::regprocedure))>0 as supports_name",
    );
    if (!definition.rows[0]?.supports_name) throw new Error("Production function does not support name updates");
    console.log(`Verified ${version}`);
  }
} catch (error) {
  try { await client.query("rollback"); } catch {}
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
