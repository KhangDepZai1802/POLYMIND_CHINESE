import type { Metadata } from "next";
import { Users } from "lucide-react";

import { getLevels } from "@/features/courses/server/queries";
import { StudentFormDialog } from "@/features/students/components/student-form-dialog";
import { StudentRowActions } from "@/features/students/components/student-row-actions";
import { getStudents } from "@/features/students/server/queries";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

      <Card>
        <CardContent className="p-0">
          {active.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Chưa có học viên nào"
              description="Tạo hồ sơ học viên. Tài khoản đăng nhập có thể mời sau."
            />
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Liên hệ</TableHead>
                      <TableHead>Bậc hiện tại</TableHead>
                      <TableHead>Lớp đang học</TableHead>
                      <TableHead>Tài khoản</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.map((s) => {
                      const activeEnrollments = s.enrollments.filter(
                        (e) => e.status === "active",
                      );

                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {s.student_code}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{s.full_name}</p>
                            {s.guardian_name && (
                              <p className="text-muted-foreground text-xs">
                                GH: {s.guardian_name}
                                {s.guardian_phone && ` · ${s.guardian_phone}`}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            <p>{s.phone ?? "—"}</p>
                            {s.email && (
                              <p className="text-muted-foreground text-xs">
                                {s.email}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {s.current_level?.name ?? "—"}
                          </TableCell>
                          <TableCell>
                            {activeEnrollments.length === 0 ? (
                              <span className="text-muted-foreground text-sm">
                                Chưa xếp lớp
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {activeEnrollments.map((e) => (
                                  <span
                                    key={e.id}
                                    className="bg-muted rounded px-1.5 py-0.5 text-xs"
                                    title={`${e.class?.name} — ${ENROLLMENT_STATUS_LABELS[e.status]}`}
                                  >
                                    {e.class?.code}
                                  </span>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              label={s.user_id ? "Đã có" : "Chưa mời"}
                              tone={s.user_id ? "success" : "neutral"}
                            />
                          </TableCell>
                          <TableCell>
                            <StudentRowActions student={s} levels={levels} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <ul className="divide-y md:hidden">
                {active.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-medium">
                          {s.student_code}
                        </span>
                        <StatusBadge
                          label={s.user_id ? "Có tài khoản" : "Chưa mời"}
                          tone={s.user_id ? "success" : "neutral"}
                        />
                      </div>
                      <p className="mt-1 font-medium">{s.full_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {s.phone ?? "—"}
                        {s.current_level ? ` · ${s.current_level.name}` : ""}
                      </p>
                      {s.enrollments.filter((e) => e.status === "active").length >
                        0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.enrollments
                            .filter((e) => e.status === "active")
                            .map((e) => (
                              <span
                                key={e.id}
                                className="bg-muted rounded px-1.5 py-0.5 text-xs"
                              >
                                {e.class?.code}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    <StudentRowActions student={s} levels={levels} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
