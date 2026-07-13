import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Đánh giá tiến độ" };

export default async function TeacherProgressPage() {
  await requireRole("teacher");

  return (
    <>
      <PageHeader title="Đánh giá tiến độ" description="Kiểm tra, điểm và nhận xét định kỳ." />
      <ComingSoon phase="Phase 4 (P4-T7)" />
    </>
  );
}