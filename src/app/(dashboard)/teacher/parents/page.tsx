import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ParentDashboard } from "@/features/b2c/components/parent-dashboard";
import { readTeacherParentDashboard } from "@/features/b2c/server/parent-access";

export const metadata: Metadata = { title: "Phụ huynh" };
export const dynamic = "force-dynamic";
export default async function TeacherParentsPage() {
  const parents = await readTeacherParentDashboard();
  return <>
    <PageHeader title="Phụ huynh" description="Thêm phụ huynh, bổ sung SĐT, Zalo và liên kết với các con. Danh sách tự cập nhật khi có hồ sơ mới." />
    <ParentDashboard parents={parents} />
  </>;
}
