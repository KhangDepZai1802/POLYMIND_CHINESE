import { runCron } from "@/lib/cron";
export const dynamic = "force-dynamic";

// Cạnh database (Supabase `ap-northeast-1`). Route Handler KHÔNG thừa kế
// `preferredRegion` từ layout — xem `src/app/layout.tsx`.
export const preferredRegion = "hnd1";
export function GET(request: Request) {
  return runCron(request, "finalize_assessment_attempts");
}
