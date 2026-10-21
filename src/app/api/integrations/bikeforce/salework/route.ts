import { NextResponse } from "next/server";

import { saleWorkSyncSchema } from "@/features/b2c/salework-schema";
import { getBikeForceEnv } from "@/lib/env";
import { hasValidApiKey } from "@/lib/security/api-key";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(request: Request) {
  const { BIKEFORCE_API_KEY } = getBikeForceEnv();
  if (!hasValidApiKey(request.headers.get("x-api-key"), BIKEFORCE_API_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = saleWorkSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload không hợp lệ.",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const { person, date, snapshot } = parsed.data;
  const { data, error } = await createAdminClient().rpc("upsert_bikeforce_salework_snapshot", {
    p_person_slug: person,
    p_work_date: date,
    p_snapshot: snapshot,
  });

  if (error) {
    console.error("BikeForce SaleWork sync failed", { code: error.code });
    return NextResponse.json({ error: "Không thể lưu snapshot." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    person,
    date,
    mode: "snapshot",
    receivedAt: data,
  });
}
