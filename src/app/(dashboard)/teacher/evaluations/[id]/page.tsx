import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, School } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EvaluationProfile } from "@/features/evaluations/components/evaluation-profile";
import { getEvaluationProfile } from "@/features/evaluations/server/queries";
import { requireRole } from "@/lib/auth/session";
import {
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_TONE,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Hồ sơ đánh giá học viên" };

export default async function EvaluationProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("teacher");
  const { id } = await params;
  const enrollment = await getEvaluationProfile(id);

  // Học viên của lớp không được phân công bị RLS lọc thành null → 404. Đoán URL
  // enrollment không phải là một đường vào hồ sơ học viên người khác.
  if (!enrollment?.class) notFound();

  return (
    <>
      <PageHeader
        title={enrollment.student?.full_name ?? "Học viên"}
        description="Đánh giá học tập theo kỳ và ghi chú nội bộ về học viên này."
        action={
          <Button asChild variant="outline">
            <Link href={`/teacher/evaluations?class=${enrollment.class.id}`}>
              <ArrowLeft className="size-4" aria-hidden />
              Quay lại danh sách
            </Link>
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4 text-sm">
          <StatusBadge
            label={ENROLLMENT_STATUS_LABELS[enrollment.status]}
            tone={ENROLLMENT_STATUS_TONE[enrollment.status]}
          />
          <span className="flex items-center gap-2">
            <School className="text-muted-foreground size-4" aria-hidden />
            {enrollment.class.code} — {enrollment.class.name}
          </span>
          <span className="text-muted-foreground font-mono text-xs">
            {enrollment.student?.student_code}
          </span>
        </CardContent>
      </Card>

      <EvaluationProfile
        enrollmentId={enrollment.id}
        evaluations={enrollment.learning_evaluations}
        notes={enrollment.student_notes}
      />
    </>
  );
}
