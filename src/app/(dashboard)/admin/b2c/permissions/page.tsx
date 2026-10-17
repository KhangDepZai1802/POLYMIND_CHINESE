import { PageHeader } from "@/components/shared/page-header";
import { TeacherPermissionsDialog } from "@/features/b2c/components/teacher-permissions-dialog";
import { readB2CPermissionAdminAction } from "@/features/b2c/server/permission-actions";

export const metadata = { title: "Phân quyền" };
export const dynamic = "force-dynamic";

export default async function B2CPermissionsPage() {
  const data = await readB2CPermissionAdminAction();
  return (
    <>
      <PageHeader
        title="Phân quyền"
        description="Quản lý quyền truy cập theo từng giáo viên."
      />
      <TeacherPermissionsDialog embedded initialData={data} />
    </>
  );
}
