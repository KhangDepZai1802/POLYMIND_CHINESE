import { requireManager } from "@/lib/auth/session";
import { SaleWorkReport } from "@/features/b2c/components/salework-report";
import { todayISO } from "@/lib/dates";

export default async function Page() {
  await requireManager();
  return <SaleWorkReport ownPerson={null} manager initialDate={todayISO()} />;
}
