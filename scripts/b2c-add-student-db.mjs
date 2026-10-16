import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
process.loadEnvFile(".env.local");
const { default: pg } = await import(
  pathToFileURL(
    path.join(process.env.TEMP, "polymind-b2c-db/node_modules/pg/lib/index.js"),
  ).href
);
const variant = process.argv[3] ?? "base";
if (!["base", "zalo", "end-date", "sessions"].includes(variant))
  throw Error("Unknown variant");
const version =
  variant === "sessions" ? "20261016000005" : variant === "end-date"
    ? "20261016000004"
    : variant === "zalo"
      ? "20261016000003"
      : "20261016000002";
const name =
  variant === "sessions" ? "b2c_student_sessions" : variant === "end-date"
    ? "b2c_class_end_date"
    : variant === "zalo"
      ? "b2c_guardian_zalo"
      : "b2c_add_student";
const sql = fs.readFileSync(
  `supabase/migrations/${version}_${name}.sql`,
  "utf8",
);
const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
try {
  await client.connect();
  const mode = process.argv[2] ?? "test";
  if (!["test", "apply", "verify"].includes(mode)) throw Error("Unknown mode");
  await client.query("begin");
  const history = await client.query(
    "select statements from supabase_migrations.schema_migrations where version=$1",
    [version],
  );
  if (mode === "verify") {
    if (history.rows[0]?.statements?.[0] !== sql)
      throw Error("Applied SQL differs from migration");
  } else {
    if (history.rowCount) throw Error("Already applied; use verify");
    await client.query(sql);
  }
  const results = await client.query(
    fs.readFileSync(`supabase/tests/database/${name}.test.sql`, "utf8"),
  );
  let failed = false;
  for (const result of Array.isArray(results) ? results : [results])
    for (const row of result.rows) {
      const line = Object.values(row).join(" ");
      if (/^(ok |not ok |1\.\.|#)/.test(line)) console.log(line);
      if (/not ok|Looks like you failed/.test(line)) failed = true;
    }
  await client.query("rollback");
  if (failed) throw Error("Database assertions failed");
  if (mode === "apply") {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      "insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)",
      [version, name, [sql]],
    );
    await client.query("commit");
    console.log("Applied " + version);
  }
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error(e.message || e.code || "DB connection failed");
  process.exitCode = 1;
} finally {
  await client.end();
}
