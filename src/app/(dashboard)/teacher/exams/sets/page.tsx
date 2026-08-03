import { SetsPage } from "@/features/question-builder/components/sets-page";
import { requireTeaching } from "@/lib/auth/session";
export default async function ExamSetsPage() {
  await requireTeaching();
  return <SetsPage kind="exam" />;
}
