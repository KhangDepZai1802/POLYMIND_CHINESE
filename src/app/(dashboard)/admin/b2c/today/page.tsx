import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { TodayTasks } from "@/features/b2c/components/today-tasks";
import { getTodayTasks } from "@/features/b2c/server/today-tasks";

export const metadata: Metadata = { title: "Việc hôm nay · B2C" };
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const data = await getTodayTasks();
  return (
    <>
      <PageHeader
        title="Việc cần xử lý hôm nay · B2C"
        description="Theo dõi lịch gọi lại, hạn học phí, lớp sắp kết thúc, điểm danh của trung tâm B2C."
      />
      <TodayTasks {...data} />
    </>
  );
}
