import { SetsPage } from "@/features/question-builder/components/sets-page";
import { requireTeaching } from "@/lib/auth/session";
export default async function ExerciseSetsPage() {
  await requireTeaching();
  return <SetsPage kind="exercise" />;
}
