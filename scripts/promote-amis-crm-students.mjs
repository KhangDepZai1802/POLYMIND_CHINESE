import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data, error } = await client.rpc("promote_amis_crm_buyers_to_students");
if (error) throw new Error(`CRM student promotion failed: ${error.code} ${error.message}`);
console.log(JSON.stringify(data));
