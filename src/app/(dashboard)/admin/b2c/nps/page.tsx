import { PageHeader } from "@/components/shared/page-header";
import { requireManager } from "@/lib/auth/session";
import { todayISO } from "@/lib/dates";
import { NpsAdminPanel } from "@/features/b2c/components/nps-admin-panel";
export const metadata = { title: "Khảo sát phụ huynh" };
export default async function NpsPage() {
  await requireManager();
  return <><PageHeader title="Khảo sát phụ huynh" description="Khảo sát NPS theo khóa/lớp; theo dõi mức độ sẵn lòng giới thiệu và góp ý của phụ huynh." /><NpsAdminPanel today={todayISO()} /></>;
}
