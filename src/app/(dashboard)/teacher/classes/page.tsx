import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, School, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getClasses } from "@/features/classes/server/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { isOpenEnrollment } from "@/lib/domain/enrollment";
import {
  CLASS_STATUS_LABELS,
  CLASS_STATUS_TONE,
  DELIVERY_MODE_LABELS,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Lớp của tôi" };

export default async function TeacherClassesPage() {
  await requireRole("teacher");
  const classes = await getClasses();

  return (
    <>
      <PageHeader
        title="Lớp của tôi"
        description="Các lớp bạn được phân công giảng dạy."
      />

      {classes.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={School}
              title="Bạn chưa được phân công lớp nào"
              description="Quản trị viên sẽ phân công lớp cho bạn."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {classes.map((classRecord) => {
            const openCount = classRecord.enrollments.filter((enrollment) =>
              isOpenEnrollment(enrollment.status),
            ).length;

            return (
              /* `min-w-0`: grid item mặc định `min-width: auto` nên không co
                 được dưới min-content. Tên khóa và địa điểm dài ("Tại doanh
                 nghiệp · Trụ sở Vietcombank") đẩy thẻ rộng 414px trong khung
                 360px — tràn 70px ở 360 và 40px ở 390 (`P17-T5`). */
              <Link
                key={classRecord.id}
                href={`/teacher/classes/${classRecord.id}`}
                className="focus-visible:ring-ring block min-w-0 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
              >
                <Card className="hover:border-primary-300 hover:bg-primary-50 h-full transition-colors">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold">
                            {classRecord.code}
                          </span>
                          <StatusBadge
                            label={CLASS_STATUS_LABELS[classRecord.status]}
                            tone={CLASS_STATUS_TONE[classRecord.status]}
                          />
                        </div>
                        {/* Không `truncate`: đây là trang có nhiệm vụ DUY NHẤT
                            là nhận diện lớp, mà phần bị cắt lại đúng là hậu tố
                            phân biệt — ở 360px hai lớp ra thành "VCB — Đàm phán
                            tài chính (Ban Gi…" và "VCB — Tiếng Trung ngân hàng…",
                            mất "(Ban Giám đốc)" / "(Lớp 02)". Màn chi tiết và
                            khối "Học viên cần chú ý" ở `/teacher` đều đã xuống
                            dòng đủ chữ; đây là chỗ lệch (`P17-T5`). */}
                        <h2 className="font-semibold">{classRecord.name}</h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {classRecord.course?.title ?? "Chưa có khóa học"}
                        </p>
                      </div>
                      <ArrowRight
                        className="text-muted-foreground mt-1 size-5 shrink-0"
                        aria-hidden
                      />
                    </div>

                    <div className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
                      <span className="flex items-center gap-2">
                        <Users className="size-4" aria-hidden />
                        {openCount}/{classRecord.capacity} học viên
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarDays className="size-4" aria-hidden />
                        Khai giảng {formatDate(classRecord.start_date)}
                      </span>
                      <span className="flex items-center gap-2 sm:col-span-2">
                        <MapPin className="size-4" aria-hidden />
                        {DELIVERY_MODE_LABELS[classRecord.delivery_mode]}
                        {classRecord.location_name
                          ? ` · ${classRecord.location_name}`
                          : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
