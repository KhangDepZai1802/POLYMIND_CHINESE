import type { Metadata } from "next";
import { Users } from "lucide-react";

import { getLevels } from "@/features/courses/server/queries";
import { StudentFormDialog } from "@/features/students/components/student-form-dialog";
import { StudentRowActions } from "@/features/students/components/student-row-actions";
import { getStudents } from "@/features/students/server/queries";
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
import { ENROLLMENT_STATUS_LABELS } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Học viên" };

export default async function AdminStudentsPage() {
  await requireRole("super_admin");

  const [students, levels] = await Promise.all([getStudents(), getLevels()]);

  const active = students.filter((s) => s.status !== "archived");

  return (
    <>
      <PageHeader
        title="Học viên"
        description={`${active.length} học viên đang hoạt động.`}
        action={<StudentFormDialog levels={levels} />}
      />

      <Card className="py-0">
        <CardContent className="p-0">
          {active.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Chưa có học viên nào"
              description="Tạo hồ sơ học viên. Tài khoản đăng nhập có thể cấp sau."
            />
          ) : (
            /*
             * MỘT bảng cho mọi bề rộng, cuộn ngang trên máy nhỏ (quyết định user
             * 2026-07-23 → `DS-044`).
             *
             * Bản cũ dựng HAI giao diện (`hidden md:block` + `md:hidden`) và hai
             * bản đã **trôi khác nhau ở chỗ mất dữ liệu**: bản điện thoại bỏ hẳn
             * **email** và **người giám hộ**, nên trên điện thoại quản trị viên
             * không có cách nào đọc được hai thông tin đó. Đây đúng mẫu hỏng
             * `UX-UIUX-M25-010` (ba bản ô số liệu trôi khác nhau) và cũng chính
             * là thứ làm `admin-accounts.smoke` đỏ ở `P17-T5` (locator `.first()`
             * trúng bản desktop đang `display:none`).
             */
            <DataTable
              caption="Danh sách học viên đang hoạt động: mã, họ tên, liên hệ, bậc, lớp và trạng thái tài khoản"
              minWidthClass="min-w-[60rem]"
            >
              <DataTableHeader>
                <tr>
                  <DataTableHead sticky>Mã</DataTableHead>
                  <DataTableHead>Họ tên</DataTableHead>
                  <DataTableHead>Liên hệ</DataTableHead>
                  <DataTableHead>Bậc hiện tại</DataTableHead>
                  <DataTableHead>Lớp đang học</DataTableHead>
                  <DataTableHead>Tài khoản</DataTableHead>
                  <DataTableHead className="w-10">
                    <span className="sr-only">Thao tác</span>
                  </DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {active.map((s) => {
                  const activeEnrollments = s.enrollments.filter(
                    (e) => e.status === "active",
                  );

                  return (
                    <DataTableRow key={s.id}>
                      <DataTableCell
                        sticky
                        className="font-mono text-sm font-medium"
                      >
                        {s.student_code}
                      </DataTableCell>
                      <DataTableCell>
                        <p className="font-medium">{s.full_name}</p>
                        {s.guardian_name && (
                          <p className="text-text-secondary text-sm">
                            GH: {s.guardian_name}
                            {s.guardian_phone && ` · ${s.guardian_phone}`}
                          </p>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        <p>{s.phone ?? "—"}</p>
                        {s.email && (
                          <p className="text-text-secondary text-sm">
                            {s.email}
                          </p>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {s.current_level?.name ?? "—"}
                      </DataTableCell>
                      <DataTableCell>
                        {activeEnrollments.length === 0 ? (
                          <span className="text-text-secondary">
                            Chưa xếp lớp
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {activeEnrollments.map((e) => (
                              <span
                                key={e.id}
                                className="bg-muted rounded px-1.5 py-0.5 text-sm"
                                title={`${e.class?.name} — ${ENROLLMENT_STATUS_LABELS[e.status]}`}
                              >
                                {e.class?.code}
                              </span>
                            ))}
                          </div>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge
                          label={s.user_id ? "Đã cấp" : "Chưa cấp"}
                          tone={s.user_id ? "success" : "neutral"}
                        />
                      </DataTableCell>
                      <DataTableCell>
                        <StudentRowActions student={s} levels={levels} />
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </>
  );
}
