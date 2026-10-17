import { readPublicNps } from "@/features/b2c/server/nps-public";
import { NpsParentForm } from "@/features/b2c/components/nps-parent-form";
export const metadata = { title: "Khảo sát phụ huynh", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export default async function ParentNpsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let form;
  try { form = await readPublicNps(token); }
  catch { return <main className="mx-auto w-full max-w-2xl px-5 py-12"><h1 className="text-xl font-semibold">Chưa tải được khảo sát</h1><p className="mt-3">Vui lòng tải lại trang hoặc liên hệ trung tâm.</p></main>; }
  return <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14"><p className="text-primary mb-3 text-sm font-semibold tracking-wide">POLYMIND · LẮNG NGHE PHỤ HUYNH</p>
    {form.state === "open" ? <><h1 className="text-2xl font-semibold">{form.title}</h1><p className="text-muted-foreground mt-2 text-sm">{form.class_name} · Hạn phản hồi: {new Date(form.expires_at!).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p><div className="bg-card mt-6 rounded-2xl border p-5 shadow-sm sm:p-7"><NpsParentForm token={token} /></div></> : <div className="rounded-xl border p-6"><h1 className="text-xl font-semibold">{form.state === "submitted" ? "Cảm ơn Quý phụ huynh!" : form.state === "expired" ? "Khảo sát đã hết hạn" : form.state === "closed" ? "Khảo sát đã đóng" : "Đường dẫn khảo sát không còn hiệu lực"}</h1><p className="text-muted-foreground mt-3">{form.state === "submitted" ? "Phản hồi của khảo sát này đã được ghi nhận. Anh/chị không cần gửi lại." : "Vui lòng liên hệ trung tâm nếu anh/chị cần hỗ trợ."}</p></div>}
  </main>;
}
