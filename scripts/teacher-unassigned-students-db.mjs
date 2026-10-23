import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.loadEnvFile(".env.local");
const { default: pg } = await import(pathToFileURL(path.join(process.env.TEMP, "polymind-b2c-db/node_modules/pg/lib/index.js")).href);
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const version = process.argv[3] ?? "20261023000013";
const names = {
  "20261023000012": "teacher_manage_unassigned_students",
  "20261023000013": "teacher_student_parent_column",
  "20261023000014": "teaching_checkpoint_location",
};
const name = names[version];
if (!name) throw new Error("Unsupported migration version");
const sql = fs.readFileSync(`supabase/migrations/${version}_${name}.sql`, "utf8");

try {
  await client.connect();
  if (process.argv[2] === "apply") {
    if ((await client.query("select 1 from supabase_migrations.schema_migrations where version=$1", [version])).rowCount === 0) {
      await client.query(sql);
      await client.query("insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)", [version, name, [sql]]);
    }
  }
  const teachers = await client.query(`
    select p.id,b.full_name
    from public.b2c_teachers b
    join public.teachers t on t.id=b.source_teacher_id
    join public.profiles p on p.id=t.user_id
    join public.b2c_teacher_permissions g on g.teacher_id=b.id
    where 'manage_center_student_data'=any(g.permissions) and p.is_active and t.is_active
    order by b.full_name
  `);
  const results = [];
  for (const teacher of teachers.rows) {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: teacher.id, role: "authenticated" })]);
    await client.query("set local role authenticated");
    const data = (await client.query("select public.read_center_b2c_student_data('',0) result")).rows[0].result;
    const secondPage = (await client.query("select public.read_center_b2c_student_data('',1) result")).rows[0].result;
    await client.query("rollback");
    results.push({ account: teacher.full_name, students: data.students, rows: data.total, unassigned_on_first_page: data.rows.filter((row) => row.enrollment_id === null).length, rows_with_parent: [...data.rows, ...secondPage.rows].filter((row) => row.guardian_summary).length });
  }
  console.log(JSON.stringify(results));
} catch (error) {
  try { await client.query("rollback"); } catch {}
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
