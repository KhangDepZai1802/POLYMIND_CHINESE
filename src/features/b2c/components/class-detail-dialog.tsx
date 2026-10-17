"use client";
import { ClassOccupancyProgress } from "./class-occupancy-progress";
import { useRef, useState } from "react";
import { ClassStudentAddDialog } from "./class-student-add-dialog";
import { TeacherClassManageDialog } from "./teacher-management-dialogs";
import { todayISO } from "@/lib/dates";
import { CLASS_TABS, type ClassTab } from "../domain/class-workspace";
import { readClassWorkspaceAction } from "../server/class-workspace-read";
import { ClassWorkspaceContent } from "./class-workspace-content";
import { ClassWorkspaceRefreshContext } from "./class-workspace-refresh";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  B2C_STUDENT_STATUS_LABELS,
  B2C_STUDENT_STATUS_COLORS,
} from "../domain/student-status";
import type { ClassRow, StudentRow } from "./program-workspace";
const statuses: Record<string, string> = {
  planned: "Sắp khai giảng",
  active: "Đang học",
  paused: "Tạm dừng",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};
const modes: Record<string, string> = {
  offline: "Trực tiếp",
  online: "Trực tuyến",
  hybrid: "Kết hợp",
};
function date(value: string | null) {
  return value ? value.split("-").reverse().join("/") : "—";
}
export function B2CClassDetailDialog({
  classRow,
  programTitle,
  students,
  onClose,
}: {
  classRow: ClassRow;
  programTitle: string;
  students: StudentRow[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<ClassTab>("students");
  const [model, setModel] = useState<Awaited<
    ReturnType<typeof readClassWorkspaceAction>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const currentFilters = useRef<Record<string, string>>({ tab: "students" });
  async function navigate(filters: Record<string, string>) {
    const id = ++request.current;
    currentFilters.current = filters;
    setActiveTab((filters.tab ?? "students") as ClassTab);
    setLoading(true);
    setError("");
    try {
      const data = await readClassWorkspaceAction(classRow.id, filters);
      if (request.current === id) setModel(data);
    } catch {
      if (request.current === id)
        setError("Không tải được nội dung lớp. Vui lòng thử lại.");
    } finally {
      if (request.current === id) setLoading(false);
    }
  }
  const q = query.trim().toLocaleLowerCase("vi");
  const matches = students.filter((s) =>
    [s.fullName, s.studentCode, s.phone, s.guardianName].some((v) =>
      v?.toLocaleLowerCase("vi").includes(q),
    ),
  );
  const rows = matches.slice(page * 20, page * 20 + 20);
  const fields = [
    ["Chương trình", programTitle],
    ["Giáo viên", classRow.teacher_name ?? "Chưa phân công"],
    ["Cấp độ", classRow.level_name ?? "Chưa cập nhật"],
    ["Trạng thái", statuses[classRow.status] ?? classRow.status],
    [
      "Lịch học",
      [classRow.weekdays_text, classRow.time_text]
        .filter(Boolean)
        .join(" · ") || "Chưa xếp lịch",
    ],
    ["Ngày khai giảng", date(classRow.start_date)],
    ["Ngày kết thúc khóa học", date(classRow.end_date)],
    ["Hình thức", modes[classRow.delivery_mode] ?? classRow.delivery_mode],
    ["Cơ sở", classRow.campus ?? "Chưa cập nhật"],
    ["Sĩ số ghi nhận", `${classRow.enrolled_count}/${classRow.capacity}`],
    ["Hồ sơ ghi danh", String(students.length)],
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{classRow.name}</DialogTitle>
          <DialogDescription>
            Mã lớp {classRow.code} · Chi tiết lớp trung tâm
          </DialogDescription>
        </DialogHeader>
        <nav aria-label="Các mục chi tiết lớp" className="flex flex-wrap gap-2">
          {Object.entries(CLASS_TABS).map(([tab, label]) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              aria-pressed={activeTab === tab}
              onClick={() => {
                if (tab === "students") {
                  request.current++;
                  setActiveTab("students");
                  setModel(null);
                  setLoading(false);
                  setError("");
                } else {
                  void navigate({ tab });
                }
              }}
            >
              {label}
            </Button>
          ))}
        </nav>
        <div aria-busy={loading}>
          {loading ? (
            <p role="status" className="py-8 text-center">
              Đang tải {CLASS_TABS[activeTab].toLowerCase()}…
            </p>
          ) : error ? (
            <div role="alert" className="space-y-3 py-6 text-center">
              <p>{error}</p>
              <Button
                variant="outline"
                onClick={() => void navigate(currentFilters.current)}
              >
                Thử lại
              </Button>
            </div>
          ) : model ? (
            <ClassWorkspaceRefreshContext.Provider
              value={() => {
                void navigate(currentFilters.current);
              }}
            >
              <ClassWorkspaceContent
                model={model}
                embedded
                onNavigate={(filters) => {
                  void navigate(filters);
                }}
              />
            </ClassWorkspaceRefreshContext.Provider>
          ) : (
            <>
              <div className="flex justify-end">
                <TeacherClassManageDialog classId={classRow.id} />
                <ClassStudentAddDialog
                  classId={classRow.id}
                  className={classRow.name}
                  today={todayISO()}
                  onAdded={() => {
                    void navigate({ tab: "students", page: "0" });
                  }}
                />
              </div>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map(([label, value]) => (
                  <div key={label} className="bg-muted/40 rounded-lg p-3">
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                    <dd className="mt-1 text-sm font-medium break-words whitespace-pre-wrap">
                      {value}
                      {label === "Sĩ số ghi nhận" && <ClassOccupancyProgress count={classRow.enrolled_count} capacity={classRow.capacity} />}
                    </dd>
                  </div>
                ))}
              </dl>
              {classRow.notes && (
                <section className="rounded-lg border p-3">
                  <h2 className="text-sm font-semibold">Ghi chú lớp</h2>
                  <p className="mt-1 text-sm break-words whitespace-pre-wrap">
                    {classRow.notes}
                  </p>
                </section>
              )}
              <section>
                <h2 className="mb-3 font-semibold">
                  Danh sách học viên của lớp ({students.length})
                </h2>
                <Input
                  type="search"
                  aria-label="Tìm học viên trong lớp"
                  placeholder="Tìm mã, tên, SĐT hoặc phụ huynh…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  className="mb-3"
                />
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[56rem] text-left text-sm">
                    <caption className="sr-only">
                      Học viên lớp {classRow.name}
                    </caption>
                    <thead className="bg-muted/60">
                      <tr>
                        {[
                          "Mã học viên",
                          "Họ tên",
                          "Trạng thái",
                          "Phụ huynh",
                          "Điện thoại",
                          "Ngày nhập học",
                          "Hết học phí",
                          "Số buổi đăng ký",
                        ].map((h) => (
                          <th scope="col" key={h} className="p-3 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr key={s.id} className="border-t">
                          <td className="p-3 font-mono text-xs">
                            {s.studentCode}
                          </td>
                          <td className="p-3 font-medium">{s.fullName}</td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs whitespace-nowrap ${B2C_STUDENT_STATUS_COLORS[s.studentStatus]}`}
                            >
                              {B2C_STUDENT_STATUS_LABELS[s.studentStatus]}
                            </span>
                          </td>
                          <td className="p-3">{s.guardianName ?? "—"}</td>
                          <td className="p-3 whitespace-nowrap">
                            {s.phone ?? "—"}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {date(s.enrollmentDate)}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {date(s.tuitionEndDate)}
                          </td>
                          <td className="p-3">{s.registeredSessions ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!rows.length && (
                    <p className="text-muted-foreground p-5 text-center">
                      {q
                        ? "Không tìm thấy học viên phù hợp."
                        : "Lớp chưa có hồ sơ học viên."}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p>
                    {matches.length} hồ sơ · Trang {page + 1}/
                    {Math.max(1, Math.ceil(matches.length / 20))}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      Trước
                    </Button>
                    <Button
                      variant="outline"
                      disabled={(page + 1) * 20 >= matches.length}
                      onClick={() => setPage(page + 1)}
                    >
                      Sau
                    </Button>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
