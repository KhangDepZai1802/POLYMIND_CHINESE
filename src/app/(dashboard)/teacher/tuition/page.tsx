import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { TuitionDashboard } from "@/features/b2c/components/tuition-dashboard";
import { readCenterTuitionDashboard, requireCenterTuitionAccess } from "@/features/b2c/server/center-tuition";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Học phí" };
export const dynamic = "force-dynamic";
export default async function TeacherTuitionPage() {
  const actor = await requireCenterTuitionAccess();
  const rows = await readCenterTuitionDashboard();
  const missing = rows.filter(row => !row.package_id).length;
  return <>
    <PageHeader title="Học phí" description="Nhập số buổi và đơn giá trong gói học phí, sau đó lập phiếu thu với số tiền và ngày bé đóng." />
    <p className="mb-4 text-sm text-muted-foreground">{rows.length} ghi danh · {missing} ghi danh chưa có gói học phí. Các cô bổ sung thông tin theo từng bé khi có số liệu thực tế.</p>
    <TuitionDashboard rows={rows} collector={actor.fullName} today={todayISO()} canReadHistory={false} canCorrect={false} />
  </>;
}
