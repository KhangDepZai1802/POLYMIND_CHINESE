import type { Metadata } from "next";

import { getLevels } from "@/features/courses/server/queries";
import { StudentFormDialog } from "@/features/students/components/student-form-dialog";
import { StudentsDirectory } from "@/features/students/components/students-directory";
import { getStudents } from "@/features/students/server/queries";
import { PageHeader } from "@/components/shared/page-header";
import { requireManager } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Học viên" };

export default async function AdminStudentsPage() {
  const me = await requireManager();
  const canManageAccounts = me.role === "super_admin";

  const [students, levels] = await Promise.all([getStudents(), getLevels()]);

  const active = students.filter((s) => s.status !== "archived");
  const classCount = new Set(
    active.flatMap((s) =>
      s.enrollments
        .filter((e) => e.status === "active" && e.class)
        .map((e) => e.class!.id),
    ),
  ).size;

  return (
    <>
      <PageHeader
        title="Học viên"
        description={`${active.length} học viên đang hoạt động, chia theo ${classCount} lớp. Bấm vào một lớp để xem danh sách.`}
        action={<StudentFormDialog levels={levels} />}
      />

      {/*
       * Trang chỉ còn việc lấy dữ liệu và gác quyền; toàn bộ tìm/gom/mở-thu nằm
       * ở `StudentsDirectory` (client) vì cả ba đều là trạng thái của người đang
       * nhìn, không phải của máy chủ. Bảng vẫn dựng bằng `DataTable` dùng chung —
       * KHÔNG dựng bản thứ hai cho điện thoại (`DS-044`).
       */}
      <StudentsDirectory
        students={students}
        levels={levels}
        canManageAccounts={canManageAccounts}
      />
    </>
  );
}
