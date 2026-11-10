import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
process.loadEnvFile(".env.local");
const version = "20261103000001";
const name = "fix_b2c_nps_parent_grouping";
const sql = fs.readFileSync(`supabase/migrations/${version}_${name}.sql`, "utf8");
const mode = process.argv[2] ?? "test";
if (!["test", "apply", "verify", "dry-run"].includes(mode)) throw Error("Unknown mode");
if (mode === "dry-run") {
  const r = spawnSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "db", "push", "--db-url", process.env.SUPABASE_DB_URL, "--dry-run"], { encoding: "utf8", timeout: 120000 });
  const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.replace(/postgres(?:ql)?:\/\/\S+/g, "[database URL redacted]").replaceAll(process.env.SUPABASE_DB_PASSWORD ?? "__no_password__", "[redacted]");
  console.log(output);
  process.exitCode = r.status ?? 1;
} else {
  const { default: pg } = await import(pathToFileURL(path.join(process.env.TEMP, "polymind-b2c-db/node_modules/pg/lib/index.js")).href);
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const history = await client.query("select statements from supabase_migrations.schema_migrations where version=$1", [version]);
    if (mode === "verify") {
      if (history.rows[0]?.statements?.[0] !== sql) throw Error("Migration history does not match SQL");
      console.log("Exact migration history verified: " + version);
      await client.query("begin read only");
      const manager = await client.query("select id from public.profiles where role='super_admin' and is_active limit 1");
      if (!manager.rows[0]) throw Error("No active manager for read-only smoke check");
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [manager.rows[0].id]);
      await client.query("set local role authenticated");
      const result = await client.query("select public.read_b2c_nps_admin() as model");
      console.log("Authenticated production read succeeded; survey count: " + result.rows[0].model.survey_total);
      await client.query("rollback");
    } else if (history.rowCount) throw Error("Already applied; use verify");
    await client.query("begin");
    if (mode !== "verify") await client.query(sql);
    const results = await client.query(fs.readFileSync("supabase/tests/database/b2c_parent_nps.test.sql", "utf8"));
    let failed = false;
    for (const result of Array.isArray(results) ? results : [results]) for (const row of result.rows) {
      const line = Object.values(row).join(" ");
      if (/^(ok |not ok |1\.\.|#)/.test(line)) console.log(line);
      if (/not ok|Looks like you failed/.test(line)) failed = true;
    }
    await client.query("rollback");
    if (failed) throw Error("Database assertions failed");
    if (mode === "apply") {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)", [version, name, [sql]]);
      await client.query("commit");
      console.log("Applied only " + version);
    }
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.error(e.message || "Database operation failed");
    process.exitCode = 1;
  } finally { await client.end(); }
}
