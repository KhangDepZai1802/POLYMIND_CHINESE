import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";

import { TeacherFormDialog } from "@/features/teachers/components/teacher-form-dialog";
import { TeacherRowActions } from "@/features/teachers/components/teacher-row-actions";
import { getTeachers } from "@/features/teachers/server/queries";
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
import { ASSIGNMENT_ROLE_LABELS } from "@/lib/domain/labels";

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

      <Card>
        <CardContent className="p-0">
          {teachers.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="Chưa có giáo viên nào"
              description="Thêm giáo viên và gửi lời mời để họ đăng nhập."
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
                      <TableHead>Chuyên môn</TableHead>
                      <TableHead>Lớp phụ trách</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs font-medium">
                          {t.teacher_code}
                        </TableCell>
                        <TableCell className="font-medium">
                          {t.profile?.full_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          <p>{t.profile?.email ?? "—"}</p>
                          {t.profile?.phone && (
                            <p className="text-muted-foreground text-xs">
                              {t.profile.phone}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {t.specialization ?? "—"}
                        </TableCell>
                        <TableCell>
                          {t.class_teachers.length === 0 ? (
                            <span className="text-muted-foreground text-sm">
                              Chưa phân công
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {t.class_teachers.map((ct) => (
                                <span
                                  key={ct.id}
                                  className="bg-muted rounded px-1.5 py-0.5 text-xs"
                                  title={`${ct.class?.name} — ${ASSIGNMENT_ROLE_LABELS[ct.assignment_role]}`}
                                >
                                  {ct.class?.code}
                                  {ct.assignment_role === "assistant" && " (TG)"}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            label={t.is_active ? "Đang dạy" : "Đã khóa"}
                            tone={t.is_active ? "success" : "danger"}
                          />
                        </TableCell>
                        <TableCell>
                          <TeacherRowActions teacher={t} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <ul className="divide-y md:hidden">
                {teachers.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-medium">
                          {t.teacher_code}
                        </span>
                        <StatusBadge
                          label={t.is_active ? "Đang dạy" : "Đã khóa"}
                          tone={t.is_active ? "success" : "danger"}
                        />
                      </div>
                      <p className="mt-1 font-medium">
                        {t.profile?.full_name ?? "—"}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {t.profile?.email ?? "—"}
                      </p>
                      {t.class_teachers.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.class_teachers.map((ct) => (
                            <span
                              key={ct.id}
                              className="bg-muted rounded px-1.5 py-0.5 text-xs"
                            >
                              {ct.class?.code}
                              {ct.assignment_role === "assistant" && " (TG)"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <TeacherRowActions teacher={t} />
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
