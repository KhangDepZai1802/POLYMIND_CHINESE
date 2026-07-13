import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Hồ sơ" };

export default async function StudentProfilePage() {
  await requireRole("student");

  return (
    <>
      <PageHeader title="Hồ sơ" description="Thông tin cá nhân và mật khẩu." />
      <ComingSoon phase="Phase 5 (P5-T6)" />
    </>
  );
}