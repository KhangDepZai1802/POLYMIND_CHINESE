import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { B2CStudentsTable } from "@/features/b2c/components/program-workspace";
import { getB2CStudentRows } from "@/features/b2c/server/queries";
import { requireManager } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Học viên B2C" };

export default async function B2CStudentsPage() {
  await requireManager();
  const students = await getB2CStudentRows();

  return (
    <>
      <PageHeader
        title="Học viên trung tâm (B2C)"
        description={`${students.length} lượt đăng ký thuộc các lớp Anh, Trung, Việt, Vẽ và Kèm 1-1.`}
      />
      <Card className="py-0">
        <CardContent className="p-4">
          <B2CStudentsTable students={students} />
        </CardContent>
      </Card>
    </>
  );
}
