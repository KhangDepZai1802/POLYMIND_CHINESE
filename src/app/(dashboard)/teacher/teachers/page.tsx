import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { TeacherFormDialog } from "@/features/teachers/components/teacher-form-dialog";
import { permissionRpc } from "@/features/b2c/server/permission-rpc";
import { requireTeaching } from "@/lib/auth/session";

export const metadata = { title: "Giáo viên" };

export default async function TeacherAccountsPage() {
  await requireTeaching();
  const allowed = await permissionRpc<boolean>(
    "can_create_b2c_teacher_accounts",
  ).catch(() => false);
  if (!allowed) notFound();

  return (
    <>
      <PageHeader
        title="Tài khoản giáo viên"
        description="Tạo tài khoản đăng nhập cho giáo viên mới. Tài khoản mới chỉ có vai trò Giáo viên."
        action={
          <TeacherFormDialog teacherOnly />
        }
      />
      <div className="bg-card rounded-xl border p-4 text-sm sm:p-6">
        Hệ thống tự tạo hồ sơ B2C và liên kết tài khoản. Sau khi lưu, giáo viên
        mới sẽ xuất hiện trong danh sách Giáo viên đứng lớp để phân công.
      </div>
    </>
  );
}
