import type { Metadata } from "next";
import { IdCard } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContactForm,
  PasswordForm,
} from "@/features/student/components/profile-panel";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hồ sơ" };

export default async function StudentProfilePage() {
  const user = await requireRole("student");
  const supabase = await createClient();

  // RLS: `students` chỉ trả hồ sơ của chính mình.
  const [{ data: profile }, { data: student }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("students")
      .select(
        "student_code, full_name, dob, email, address, guardian_name, guardian_phone, joined_on",
      )
      .maybeSingle(),
  ]);

  return (
    <>
      <PageHeader
        title="Hồ sơ"
        description="Thông tin cá nhân và bảo mật tài khoản của bạn."
      />

      <div className="mx-auto max-w-3xl space-y-5">
        {/* Thông tin học vụ do trung tâm quản lý — học viên xem, không sửa. */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle asChild>
              <h2 className="flex items-center gap-2 text-base">
                <span className="bg-student-cyan-surface text-student-cyan-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <IdCard className="size-4" aria-hidden />
                </span>
                Thông tin học viên
              </h2>
            </CardTitle>
            <p className="text-text-secondary mt-1 text-sm leading-6">
              Do trung tâm quản lý. Cần chỉnh sửa, vui lòng liên hệ trung tâm.
            </p>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label="Mã học viên" value={student?.student_code} />
              <Row label="Họ tên" value={student?.full_name} />
              <Row label="Ngày sinh" value={formatDate(student?.dob)} />
              <Row label="Email" value={profile?.email ?? student?.email} />
              <Row label="Địa chỉ" value={student?.address} />
              <Row label="Người giám hộ" value={student?.guardian_name} />
              <Row label="SĐT giám hộ" value={student?.guardian_phone} />
              <Row
                label="Ngày nhập học"
                value={formatDate(student?.joined_on)}
              />
            </dl>
          </CardContent>
        </Card>

        <ContactForm
          fullName={profile?.full_name ?? user.fullName}
          phone={profile?.phone ?? null}
        />

        <PasswordForm />
      </div>
    </>
  );
}

/** Một dòng nhãn–giá trị của hồ sơ. `<dt>`/`<dd>` thay cho hai `<span>` để
 *  quan hệ nhãn ↔ giá trị là ngữ nghĩa thật, không chỉ là vị trí trên màn hình. */
function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b py-2 last:border-0">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
