import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Bài tập & Chấm bài" };

export default async function TeacherAssignmentsPage() {
  await requireRole("teacher");

  return (
    <>
      <PageHeader title="Bài tập & Chấm bài" description="Giao bài, xem bài nộp và chấm điểm." />
      <ComingSoon phase="Phase 4 (P4-T5)" />
    </>
  );
}