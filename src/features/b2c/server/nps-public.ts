import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { PublicNpsForm } from "../domain/nps";
import type { Database, Json } from "@/types/database";

// A dedicated cookie-free publishable-key client. The token is the only authority;
// no admin/service-role client or logged-in identity is used for parent responses.
export async function npsPublicRpc<T>(name: "read_public_b2c_nps" | "submit_public_b2c_nps", args: Record<string, Json>) {
  const env = getPublicEnv();
  const client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await client.rpc(name as never, args as never);
  if (error) throw new Error(error.code === "22023" ? error.message : "Không xử lý được khảo sát. Vui lòng thử lại.");
  return data as T;
}
export async function readPublicNps(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return { state: "invalid" } satisfies PublicNpsForm;
  return npsPublicRpc<PublicNpsForm>("read_public_b2c_nps", { p_token: token });
}
