import { ClassJournalPreview } from "@/features/b2c/components/class-journal-preview";
import { readClassJournalPreview } from "@/features/b2c/server/class-journal-preview";
import { requireTeaching } from "@/lib/auth/session";

export const metadata = { title: "Điểm danh + Báo bài các lớp · Bản thử" };
export const dynamic = "force-dynamic";

export default async function TeacherClassJournalPreviewPage() {
  await requireTeaching();
  return <ClassJournalPreview {...await readClassJournalPreview()} />;
}
