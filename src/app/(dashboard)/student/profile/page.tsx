import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContactForm,
  NotificationList,
  PasswordForm,
} from "@/features/student/components/profile-panel";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hồ sơ" };

export default async function StudentProfilePage() {
  const user = await requireRole("student");
  const supabase = await createClient();

  // RLS: `students` chỉ trả hồ sơ của chính mình; `notifications` chỉ trả thông báo
  // của chính mình → không cần (và không nên) lọc thêm ở app.
  const [{ data: profile }, { data: student }, { data: notifications }] =
    await Promise.all([
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
      supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  return (
    <>
      <PageHeader
        title="Hồ sơ"
        description="Thông tin cá nhân, mật khẩu và thông báo của bạn."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          {/* Thông tin học vụ do trung tâm quản lý — học viên xem, không sửa. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin học viên</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Do trung tâm quản lý. Cần chỉnh sửa, vui lòng liên hệ trung tâm.
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Mã học viên" value={student?.student_code} />
              <Row label="Họ tên" value={student?.full_name} />
              <Row label="Ngày sinh" value={formatDate(student?.dob)} />
              <Row label="Email" value={profile?.email ?? student?.email} />
              <Row label="Địa chỉ" value={student?.address} />
              <Row label="Người giám hộ" value={student?.guardian_name} />
              <Row label="SĐT giám hộ" value={student?.guardian_phone} />
              <Row label="Ngày nhập học" value={formatDate(student?.joined_on)} />
            </CardContent>
          </Card>

          <ContactForm
            fullName={profile?.full_name ?? user.fullName}
            phone={profile?.phone ?? null}
          />

          <PasswordForm />
        </div>

        <NotificationList notifications={notifications ?? []} />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
