import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Kết quả" };

export default async function StudentResultsPage() {
  await requireRole("student");

  return (
    <>
      <PageHeader title="Kết quả" description="Điểm, đánh giá và tiến độ đã công bố." />
      <ComingSoon phase="Phase 5 (P5-T5)" />
    </>
  );
}