import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
process.loadEnvFile(".env.local");
const { default: pg } = await import(
  pathToFileURL(
    path.join(process.env.TEMP, "polymind-b2c-db/node_modules/pg/lib/index.js"),
  ).href
);
const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
const version = "20261015000002";
const sql = fs.readFileSync(
  `supabase/migrations/${version}_b2c_attendance_makeup.sql`,
  "utf8",
);
try {
  await client.connect();
  await client.query("begin");
  const mode = process.argv[2] ?? "test";
  if (!["test", "apply", "verify"].includes(mode)) throw Error("Unknown mode");
  if (mode === "verify") {
    const history = await client.query(
      "select statements from supabase_migrations.schema_migrations where version=$1",
      [version],
    );
    if (history.rows[0]?.statements?.[0] !== sql)
      throw Error("Applied SQL differs from migration");
  } else {
    if (mode === "apply") {
      const exists = await client.query(
        "select 1 from supabase_migrations.schema_migrations where version=$1",
        [version],
      );
      if (exists.rowCount) throw Error("Already applied");
    }
    await client.query(sql);
  }
  const results = await client.query(
    fs.readFileSync(
      "supabase/tests/database/b2c_teacher_permissions.test.sql",
      "utf8",
    ) +
      fs.readFileSync(
        "supabase/tests/database/b2c_attendance_makeup.test.sql",
        "utf8",
      ),
  );
  for (const result of Array.isArray(results) ? results : [results])
    for (const row of result.rows) console.log(Object.values(row).join(" "));
  // Fixtures must always roll back, including when applying the migration.
  await client.query("rollback");
  if (mode === "apply") {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      "insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)",
      [version, "b2c_attendance_makeup", [sql]],
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
