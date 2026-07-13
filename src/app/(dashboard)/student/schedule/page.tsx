import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Lịch học" };

export default async function StudentSchedulePage() {
  await requireRole("student");

  return (
    <>
      <PageHeader title="Lịch học" description="Buổi học và tài liệu của bạn." />
      <ComingSoon phase="Phase 5 (P5-T2)" />
    </>
  );
}