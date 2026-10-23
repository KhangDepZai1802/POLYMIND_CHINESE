import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const [{ data: leads, error: leadError }, { data: students, error: studentError }] =
  await Promise.all([
    client
      .from("b2c_admission_leads")
      .select("id,full_name,amis_crm_code,amis_order_sales")
      .not("amis_crm_code", "is", null)
      .gt("amis_order_sales", 0)
      .is("archived_at", null),
    client.from("b2c_students").select("id,full_name"),
  ]);
if (leadError || studentError)
  throw new Error(leadError?.message ?? studentError?.message);
const normalize = (value) =>
  value.trim().replace(/\s*\((?:ph|phụ huynh)[^)]*\)\s*$/iu, "").trim().toLocaleLowerCase("vi");
const counts = new Map();
for (const student of students)
  counts.set(normalize(student.full_name), (counts.get(normalize(student.full_name)) ?? 0) + 1);
const matches = leads.map((lead) => counts.get(normalize(lead.full_name)) ?? 0);
console.log(JSON.stringify({
  buyers: leads.length,
  exact_unique_matches: matches.filter((count) => count === 1).length,
  new_students: matches.filter((count) => count === 0).length,
  ambiguous: matches.filter((count) => count > 1).length,
}));
