import "server-only";

import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { hasValidCronAuthorization } from "@/lib/security/cron-secret";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type CronRpcName = Extract<
  keyof Database["public"]["Functions"],
  | "run_session_reminders"
  | "run_invoice_overdue"
  | "finalize_expired_exam_attempts"
  | "finalize_assessment_attempts"
>;

export async function runCron(request: Request, rpc: CronRpcName) {
  const { CRON_SECRET } = getServerEnv();

  if (
    !hasValidCronAuthorization(
      request.headers.get("authorization"),
      CRON_SECRET,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // System flow duy nhất: client đặc quyền chỉ gọi RPC đã revoke khỏi user role.
  const { data, error } = await createAdminClient().rpc(rpc);

  if (error) {
    console.error(`Cron ${rpc} failed`, { code: error.code });
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}
