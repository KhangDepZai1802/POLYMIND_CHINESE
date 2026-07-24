import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";

import { TeacherFormDialog } from "@/features/teachers/components/teacher-form-dialog";
import { TeacherRowActions } from "@/features/teachers/components/teacher-row-actions";
import { getTeachers } from "@/features/teachers/server/queries";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Giáo viên" };

export default async function AdminTeachersPage() {
  await requireRole("super_admin");

  const teachers = await getTeachers();

  return (
    <>
      <PageHeader
        title="Giáo viên"
        description="Hồ sơ giáo viên và các lớp được phân công."
        action={<TeacherFormDialog />}
      />

      <Card className="py-0">
        <CardContent className="p-0">
          {teachers.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="Chưa có giáo viên nào"
              description="Thêm giáo viên và cấp tài khoản để họ đăng nhập."
            />
          ) : (
            /*
             * MỘT bảng cho mọi bề rộng (`DS-044`). Bản điện thoại cũ bỏ hẳn
             * **số điện thoại** và **chuyên môn**, nên trên điện thoại quản trị
             * viên không gọi được cho giáo viên và không biết ai dạy được lớp
             * nào — cùng kiểu trôi dữ liệu với màn Học viên.
             */
            <DataTable
              caption="Danh sách giáo viên: mã, họ tên, liên hệ, chuyên môn, lớp phụ trách và trạng thái"
              minWidthClass="min-w-[60rem]"
            >
              <DataTableHeader>
                <tr>
                  <DataTableHead sticky>Mã</DataTableHead>
                  <DataTableHead>Họ tên</DataTableHead>
                  <DataTableHead>Liên hệ</DataTableHead>
                  <DataTableHead>Chuyên môn</DataTableHead>
                  <DataTableHead>Lớp phụ trách</DataTableHead>
                  <DataTableHead>Trạng thái</DataTableHead>
                  <DataTableHead className="w-10">
                    <span className="sr-only">Thao tác</span>
                  </DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {teachers.map((t) => (
                  <DataTableRow key={t.id}>
                    <DataTableCell
                      sticky
                      className="font-mono text-sm font-medium"
                    >
                      {t.teacher_code}
                    </DataTableCell>
                    <DataTableCell className="font-medium">
                      {t.profile?.full_name ?? "—"}
                    </DataTableCell>
                    <DataTableCell>
                      <p>{t.profile?.email ?? "—"}</p>
                      {t.profile?.phone && (
                        <p className="text-text-secondary text-sm">
                          {t.profile.phone}
                        </p>
                      )}
                    </DataTableCell>
                    <DataTableCell>{t.specialization ?? "—"}</DataTableCell>
                    <DataTableCell>
                      {t.class_teachers.length === 0 ? (
                        <span className="text-text-secondary">
                          Chưa phân công
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {t.class_teachers.map((ct) => (
                            <span
                              key={ct.id}
                              className="bg-muted rounded px-1.5 py-0.5 text-sm"
                              title={ct.class?.name}
                            >
                              {ct.class?.code}
                            </span>
                          ))}
                        </div>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        label={t.is_active ? "Đang dạy" : "Đã khóa"}
                        tone={t.is_active ? "success" : "danger"}
                      />
                    </DataTableCell>
                    <DataTableCell>
                      <TeacherRowActions teacher={t} />
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </>
  );
}
