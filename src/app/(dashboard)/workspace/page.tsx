import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { canReadXkld, CANDIDATES_PATH } from "@/features/xkld/domain/candidates";
import { ORDERS_PATH } from "@/features/xkld/domain/orders";
import { PIPELINE_PATH } from "@/features/xkld/domain/pipeline";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { BUSINESS_ROLES, ROLE_LABELS } from "@/types/roles";

export const metadata: Metadata = { title: "Không gian làm việc" };

const SECTIONS = {
  executive: ["Doanh thu ghi nhận và thực thu", "Chi phí và lãi/lỗ", "Điểm hòa vốn và tỷ lệ lấp đầy", "Công nợ quá hạn và dòng tiền 30 ngày", "Pipeline XKLĐ"],
  center_manager: ["Lớp dưới ngưỡng sĩ số", "Chuyên cần và vắng hai buổi liên tiếp", "Danh sách tái phí", "Năng suất giáo viên và tư vấn"],
  consultant: ["Lead cần gọi hôm nay", "Học viên sắp hết học phí", "Phụ huynh cần phản hồi", "Công nợ cần nhắc", "Chỉ tiêu cá nhân tháng"],
  xkld_staff: ["Ứng viên theo giai đoạn", "Giấy tờ sắp hết hạn", "Lịch phỏng vấn", "Công nợ ứng viên"],
} as const;

export default async function WorkspacePage() {
  const user = await requireRole(...BUSINESS_ROLES);
  const sections = SECTIONS[user.role as keyof typeof SECTIONS];
  return <>
    <PageHeader title={ROLE_LABELS[user.role]} description={`Xin chào ${user.fullName}.`} />
    {canReadXkld(user.role) && <div className="mb-5 flex flex-wrap gap-3"><Button asChild><Link href={CANDIDATES_PATH}>Quản lý ứng viên XKLĐ</Link></Button><Button asChild variant="outline"><Link href={ORDERS_PATH}>Thị trường & đơn hàng</Link></Button><Button asChild variant="outline"><Link href={PIPELINE_PATH}>Pipeline XKLĐ</Link></Button><Button asChild variant="outline"><Link href="/workspace/xkld/documents">Hồ sơ giấy tờ</Link></Button><Button asChild variant="outline"><Link href="/workspace/xkld/finance">Tài chính & công nợ</Link></Button></div>}
    <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {canReadXkld(user.role) ? "Quản lý ứng viên, thị trường và đơn hàng đã sẵn sàng ở các nút phía trên. Các báo cáo và chức năng khác bên dưới đang được xây dựng." : "Các chức năng bên dưới đang được xây dựng, chưa có dữ liệu tổng hợp."}
    </p>
    {user.role === "xkld_staff" && <p className="text-muted-foreground mb-4 text-sm">Phạm vi: toàn bộ ứng viên XKLĐ. Công nợ chỉ đọc; không được nhập hoặc sửa khoản thu.</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sections.map(title => <Card key={title}>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground text-sm">Đang chuẩn bị chức năng</CardContent>
      </Card>)}
    </div>
  </>;
}
