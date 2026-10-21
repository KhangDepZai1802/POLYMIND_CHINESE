import { requireTeaching } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SaleWorkReport } from "@/features/b2c/components/salework-report";
import { todayISO } from "@/lib/dates";

export default async function Page() {
  const user = await requireTeaching();
  const db = await createClient();
  const { data, error } = await db
    .from("salework_report_people")
    .select("person_slug")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    return (
      <p className="p-6">
        Báo cáo chưa được kích hoạt. Quản trị cần chạy file SQL báo cáo.
      </p>
    );
  if (!data || !["co-le", "co-thy"].includes(data.person_slug))
    return (
      <p className="p-6">Tài khoản chưa được phân công báo cáo SaleWork.</p>
    );
  return (
    <SaleWorkReport
      ownPerson={data.person_slug as "co-le" | "co-thy"}
      manager={false}
      initialDate={todayISO()}
    />
  );
}
