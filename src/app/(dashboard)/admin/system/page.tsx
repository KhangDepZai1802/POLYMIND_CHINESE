import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Quản trị & Audit" };

export default async function AdminSystemPage() {
  await requireRole("super_admin");

  return (
    <>
      <PageHeader title="Quản trị & Audit" description="Tài khoản, cấu hình và nhật ký audit." />
      <ComingSoon phase="Phase 6 (P6-T8)" />
    </>
  );
}