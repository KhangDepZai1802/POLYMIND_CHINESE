import { notFound } from "next/navigation";
import { z } from "zod";
import { requireTeaching } from "@/lib/auth/session";
import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { getMyB2CClasses } from "@/features/b2c/server/teacher-class-queries";
import { getMyB2CPermissionsAction } from "@/features/b2c/server/permission-actions";
import { readTeacherWorkspaceAction } from "@/features/b2c/server/teacher-management-actions";
import { ClassWorkspaceContent } from "@/features/b2c/components/class-workspace-content";
export const metadata = { title: "Chi tiết lớp" };
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export default async function TeacherB2CClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTeaching();
  const { classId } = await params;
  if (!z.uuid().safeParse(classId).success) notFound();
  const [permissions, classes, query] = await Promise.all([
    getMyB2CPermissionsAction(),
    getMyB2CClasses(),
    searchParams,
  ]);
  const cls = classes.find((row) => row.id === classId);
  if (!cls) notFound();
  const tabs = {
    students: "view_students",
    schedule: "view_schedule",
    attendance: "mark_attendance",
    tuition: "view_tuition",
    comments: "view_comments",
    assessments: "view_assessments",
    monthly_comments: "view_comments",
  } as const;
  const allowed = Object.keys(tabs).filter((tab) =>
    permissions.includes(tabs[tab as keyof typeof tabs]),
  );
  if (!allowed.length)
    return (
      <>
        <BackLink href="/teacher/classes" label="Lớp của tôi" />
        <PageHeader title={cls.name} description={cls.code} />
        <p>
          Bạn chỉ được xem thông tin lớp. Liên hệ quản lý để cấp thêm quyền.
        </p>
      </>
    );
  const tab = typeof query.tab === "string" ? query.tab : allowed[0]!;
  if (!allowed.includes(tab)) notFound();
  const model = await readTeacherWorkspaceAction(classId, { ...query, tab });
  return <ClassWorkspaceContent model={model} permissions={permissions} />;
}
