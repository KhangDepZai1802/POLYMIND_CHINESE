import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
process.loadEnvFile(".env.local");
const { default: pg } = await import(
  pathToFileURL(
    path.join(process.env.TEMP, "polymind-b2c-db/node_modules/pg/lib/index.js"),
  ).href
);
const version = "20261016000001";
const sql = fs.readFileSync(
  `supabase/migrations/${version}_b2c_tuition_corrections.sql`,
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
  if (mode === "verify") {
    const result = await client.query(
      "select statements from supabase_migrations.schema_migrations where version=$1",
      [version],
    );
    if (result.rows[0]?.statements?.[0] !== sql)
      throw Error("Applied SQL differs");
  } else {
    const exists = await client.query(
      "select 1 from supabase_migrations.schema_migrations where version=$1",
      [version],
    );
    if (exists.rowCount) throw Error("Migration already applied; use verify");
    await client.query(sql);
  }
  const suite = process.argv[3] ?? "b2c_tuition_corrections";
  if (
    ![
      "b2c_tuition_corrections",
      "b2c_tuition",
      "b2c_change_history",
      "b2c_class_workspace",
      "b2c_teacher_permissions",
    ].includes(suite)
  )
    throw Error("Unknown suite");
  const results = await client.query(
    fs.readFileSync(`supabase/tests/database/${suite}.test.sql`, "utf8"),
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
      [version, "b2c_tuition_corrections", [sql]],
    );
    await client.query("commit");
    console.log("Applied " + version);
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
