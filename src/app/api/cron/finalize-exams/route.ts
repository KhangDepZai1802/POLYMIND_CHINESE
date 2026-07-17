import { runCron } from "@/lib/cron";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return runCron(request, "finalize_assessment_attempts");
}
