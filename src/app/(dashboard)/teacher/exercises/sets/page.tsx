import { SetsPage } from "@/features/question-builder/components/sets-page";
import { requireRole } from "@/lib/auth/session";
export default async function ExerciseSetsPage() {
  await requireRole("teacher");
  return <SetsPage kind="exercise" />;
}
