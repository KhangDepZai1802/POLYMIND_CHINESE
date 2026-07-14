import type { Metadata } from "next";
import { BookOpen, CalendarDays, ClipboardList, School } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialList } from "@/features/student/components/material-list";
import {
  getMyAttendanceSummary,
  getMyEnrollment,
  getMyMaterials,
  getMySchedule,
} from "@/features/student/server/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatPercent } from "@/lib/dates";
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_TONE,
  SESSION_STATUS_LABELS,
  SESSION_STATUS_TONE,
} from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Lịch học" };

export default async function StudentSchedulePage() {
  await requireRole("student");
  const enrollment = await getMyEnrollment();

  if (!enrollment?.class) {
    return (
      <>
        <PageHeader
          title="Lịch học"
          description="Buổi học, tài liệu và chuyên cần của bạn."
        />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={School}
              title="Bạn chưa được xếp lớp"
              description="Khi trung tâm xếp lớp, lịch học và tài liệu sẽ hiện ở đây."
            />
          </CardContent>
        </Card>
      </>
    );
  }

  const courseId = enrollment.class.course?.id;
  const [sessions, materials, attendance] = await Promise.all([
    getMySchedule(enrollment.class.id),
    courseId ? getMyMaterials(courseId) : Promise.resolve([]),
    getMyAttendanceSummary(enrollment.id),
  ]);

  return (
    <>
      <PageHeader
        title="Lịch học"
        description={`${enrollment.class.code} — ${enrollment.class.name}`}
      />

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Buổi học ({sessions.length})</TabsTrigger>
          <TabsTrigger value="materials">
            Tài liệu ({materials.length})
          </TabsTrigger>
          <TabsTrigger value="attendance">Chuyên cần</TabsTrigger>
        </TabsList>

        {/* --- Buổi học --- */}
        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {sessions.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Lớp chưa có buổi học nào"
                  description="Khi trung tâm xếp lịch, các buổi học sẽ hiện ở đây."
                />
              ) : (
                <ul className="divide-y">
                  {sessions.map((session) => (
                    <li
                      key={session.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          Buổi {session.session_number} ·{" "}
                          {formatDateTime(session.starts_at)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {session.lesson?.title ??
                            session.topic ??
                            "Chưa có chủ đề"}
                        </p>
                      </div>
                      <StatusBadge
                        label={SESSION_STATUS_LABELS[session.status]}
                        tone={SESSION_STATUS_TONE[session.status]}
                      />
                      {/* Buổi chưa điểm danh thì KHÔNG hiện gì — hiện "Vắng" khi
                          giáo viên chưa điểm danh là vu oan cho học viên. */}
                      {session.myAttendance && (
                        <StatusBadge
                          label={
                            ATTENDANCE_STATUS_LABELS[session.myAttendance.status]
                          }
                          tone={
                            ATTENDANCE_STATUS_TONE[session.myAttendance.status]
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Tài liệu --- */}
        <TabsContent value="materials" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {materials.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="Chưa có tài liệu"
                  description="Chỉ tài liệu giáo viên chia sẻ cho học viên mới hiện ở đây."
                />
              ) : (
                <MaterialList materials={materials} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Chuyên cần --- */}
        <TabsContent value="attendance" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <AttendanceStat
              label="Tỉ lệ chuyên cần"
              value={formatPercent(attendance?.attendance_rate)}
            />
            <AttendanceStat
              label="Có mặt"
              value={attendance?.present_count ?? 0}
            />
            <AttendanceStat
              label="Đi muộn"
              value={attendance?.late_count ?? 0}
            />
            <AttendanceStat label="Vắng" value={attendance?.absent_count ?? 0} />
            <AttendanceStat
              label="Có phép"
              value={attendance?.excused_count ?? 0}
            />
          </div>

          <Card className="mt-4">
            <CardContent className="p-0">
              {sessions.filter((session) => session.myAttendance).length ===
              0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Chưa có buổi nào được điểm danh"
                  description="Giáo viên điểm danh xong thì kết quả sẽ hiện ở đây."
                />
              ) : (
                <ul className="divide-y">
                  {sessions
                    .filter((session) => session.myAttendance)
                    .map((session) => (
                      <li
                        key={session.id}
                        className="flex flex-wrap items-center gap-3 px-5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            Buổi {session.session_number} ·{" "}
                            {formatDateTime(session.starts_at)}
                          </p>
                          {session.myAttendance?.note && (
                            <p className="text-muted-foreground text-xs">
                              {session.myAttendance.note}
                            </p>
                          )}
                        </div>
                        <StatusBadge
                          label={
                            ATTENDANCE_STATUS_LABELS[
                              session.myAttendance!.status
                            ]
                          }
                          tone={
                            ATTENDANCE_STATUS_TONE[session.myAttendance!.status]
                          }
                        />
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function AttendanceStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
