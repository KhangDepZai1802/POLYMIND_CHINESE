import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { TuitionDashboard } from "@/features/b2c/components/tuition-dashboard";
import { readCenterTuitionDashboard, requireCenterTuitionAccess } from "@/features/b2c/server/center-tuition";
import { permissionRpc } from "@/features/b2c/server/permission-rpc";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Học phí" };
export const dynamic = "force-dynamic";
export default async function TeacherTuitionPage() {
  const actor = await requireCenterTuitionAccess();
  const canDelete = await permissionRpc<boolean>("has_b2c_permission", { p_key: "delete_center_records" });
  const rows = await readCenterTuitionDashboard();
  return <>
    <PageHeader title="Học phí" description="Nhập số buổi và đơn giá trong gói học phí, sau đó lập phiếu thu với số tiền và ngày bé đóng." />
    <TuitionDashboard rows={rows} collector={actor.fullName} today={todayISO()} canReadHistory={false} canCorrect={canDelete} canDelete={canDelete} enableReceiptMonthFilter />
  </>;
}
