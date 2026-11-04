import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { TeacherFormDialog } from "@/features/teachers/components/teacher-form-dialog";
import { TeacherAccountDialog } from "@/features/teachers/components/teacher-account-dialog";
import { getTeacherAccountDirectory } from "@/features/teachers/server/queries";
import { permissionRpc } from "@/features/b2c/server/permission-rpc";
import { requireTeaching } from "@/lib/auth/session";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Giáo viên" };

export default async function TeacherAccountsPage() {
  await requireTeaching();
  const allowed = await permissionRpc<boolean>(
    "can_create_b2c_teacher_accounts",
  ).catch(() => false);
  if (!allowed) notFound();
  const teachers = await getTeacherAccountDirectory();

  return (
    <>
      <PageHeader
        title="Tài khoản giáo viên"
        description="Tạo mới, xem tên đăng nhập và cấp lại mật khẩu cho giáo viên."
        action={
          <TeacherFormDialog teacherOnly />
        }
      />
      <div className="bg-card mb-4 rounded-xl border p-4 text-sm sm:p-5">
        Mật khẩu được mã hóa một chiều nên không thể đọc lại mật khẩu cũ. Khi
        giáo viên quên, bấm <strong>Tài khoản</strong> để xem tên đăng nhập và
        đặt một mật khẩu mới có thể hiện/copy ngay trong biểu mẫu.
      </div>
      <Card className="py-0">
        <CardContent className="p-0">
          <DataTable
            caption="Danh sách tài khoản giáo viên"
            minWidthClass="min-w-[46rem]"
          >
            <DataTableHeader>
              <tr>
                <DataTableHead sticky>Mã</DataTableHead>
                <DataTableHead>Giáo viên</DataTableHead>
                <DataTableHead>Tên đăng nhập</DataTableHead>
                <DataTableHead>Liên hệ</DataTableHead>
                <DataTableHead>Trạng thái</DataTableHead>
                <DataTableHead>Thao tác</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {teachers.map((teacher) => (
                <DataTableRow key={teacher.id}>
                  <DataTableCell sticky className="font-mono font-medium">
                    {teacher.teacher_code}
                  </DataTableCell>
                  <DataTableCell className="font-medium">
                    {teacher.profile?.full_name ?? "—"}
                  </DataTableCell>
                  <DataTableCell className="font-mono select-all">
                    {teacher.profile?.username ?? "Chưa có"}
                  </DataTableCell>
                  <DataTableCell>{teacher.profile?.phone ?? "—"}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      label={
                        teacher.is_active && teacher.profile?.is_active
                          ? "Đang hoạt động"
                          : "Đã khóa"
                      }
                      tone={
                        teacher.is_active && teacher.profile?.is_active
                          ? "success"
                          : "danger"
                      }
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <TeacherAccountDialog
                      target={{ kind: "teacher", id: teacher.id }}
                    />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </CardContent>
      </Card>
    </>
  );
}
