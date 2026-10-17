import { readClassWorkspaceAction } from "@/features/b2c/server/class-workspace-read";
import { ClassWorkspaceContent } from "@/features/b2c/components/class-workspace-content";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireManager } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import {
  CLASS_WORKSPACE_PATH,
  classFiltersSchema,
} from "@/features/b2c/domain/class-workspace";
export const metadata = { title: "Chi tiết lớp" };
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export default async function ClassWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { classId } = await params;
  const query = await searchParams;
  if (!classFiltersSchema.safeParse(query).success) {
    await requireManager();
    if (!z.uuid().safeParse(classId).success) notFound();
    return (
      <>
        <PageHeader title="Chi tiết lớp" />
        <p role="alert">Bộ lọc không hợp lệ.</p>
        <Link href={`${CLASS_WORKSPACE_PATH}/${classId}`}>Xóa bộ lọc</Link>
      </>
    );
  }
  const model = await readClassWorkspaceAction(classId, query);
  return <ClassWorkspaceContent model={model} />;
}
