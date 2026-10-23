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
const version = "20261023000011";
const name = "promote_amis_buyers_to_students";
const sql = fs.readFileSync(
  `supabase/migrations/${version}_${name}.sql`,
  "utf8",
);

try {
  await client.connect();
  const mode = process.argv[2] ?? "audit";
  if (mode === "audit") {
    const preview = await client.query(`
      with buyers as (
        select l.*,
          btrim(regexp_replace(l.full_name,'\\s*\\((ph|phụ huynh)[^)]*\\)\\s*$','','i')) clean_name
        from public.b2c_admission_leads l
        where l.amis_crm_code is not null and coalesce(l.amis_order_sales,0)>0
          and l.archived_at is null
      ), candidates as (
        select b.id,b.full_name,b.clean_name,
          (select count(*) from public.b2c_students s
           where lower(btrim(s.full_name))=lower(b.clean_name)) matches
        from buyers b
      )
      select count(*)::int buyers,
        count(*) filter(where matches=1)::int exact_unique_matches,
        count(*) filter(where matches=0)::int new_students,
        count(*) filter(where matches>1)::int ambiguous
      from candidates
    `);
    console.log(JSON.stringify(preview.rows[0]));
    process.exit(0);
  }
  if (mode === "apply") {
    await client.query("begin");
    const existing = await client.query(
      "select 1 from supabase_migrations.schema_migrations where version=$1",
      [version],
    );
    if (existing.rowCount) throw new Error("Migration already exists");
    await client.query(sql);
    await client.query(
      "insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)",
      [version, name, [sql]],
    );
    await client.query("commit");
  }

  const result = await client.query(
    "select public.promote_amis_crm_buyers_to_students() as result",
  );
  const audit = await client.query(`
    select
      count(*) filter(where l.amis_order_sales>0)::int as buyers,
      count(*) filter(where l.amis_order_sales>0 and l.b2c_student_id is not null)::int as linked,
      count(*) filter(where l.amis_order_sales=0)::int as leads_without_purchase,
      count(*) filter(where s.source_key like 'amis-crm:%')::int as crm_created_students,
      count(*) filter(where l.amis_order_sales>0 and not exists(
        select 1 from public.b2c_enrollments e where e.student_id=l.b2c_student_id
      ))::int as buyers_without_class
    from public.b2c_admission_leads l
    left join public.b2c_students s on s.id=l.b2c_student_id
    where l.amis_crm_code is not null and l.archived_at is null
  `);
  console.log(JSON.stringify({ promotion: result.rows[0].result, audit: audit.rows[0] }));
} catch (error) {
  try { await client.query("rollback"); } catch {}
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
