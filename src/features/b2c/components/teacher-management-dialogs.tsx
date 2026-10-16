"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  readTeacherClassEditAction,
  readTeacherStudentEditAction,
  saveTeacherClassAction,
  saveTeacherStudentAction,
  type TeacherClassEdit,
  type TeacherStudentEdit,
} from "../server/teacher-management-actions";
import { B2C_PROGRAMS } from "../domain/programs";
import { B2C_STUDENT_STATUS_LABELS } from "../domain/student-status";
import { useClassWorkspaceRefresh } from "./class-workspace-refresh";
const selectClass = "h-10 w-full rounded-md border bg-background px-3";
export function TeacherClassManageDialog({ classId }: { classId?: string }) {
  const router = useRouter(),
    refresh = useClassWorkspaceRefresh();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [data, setData] = useState<TeacherClassEdit | null>(null),
    [request, setRequest] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    setData(null);
    setRequest(crypto.randomUUID());
    try {
      setData(
        classId
          ? await readTeacherClassEditAction(classId)
          : {
              name: "",
              program_slug: "tieng-anh",
              capacity: 15,
              campus: "",
              delivery_mode: "offline",
              start_date: "",
              end_date: "",
              status: "planned",
              notes: "",
              updated_at: null,
            },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được lớp.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (v) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          {classId ? "Sửa thông tin lớp" : "Tạo lớp B2C"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {classId ? "Sửa thông tin lớp" : "Tạo lớp B2C"}
          </DialogTitle>
          <DialogDescription>
            {classId
              ? "Cập nhật lớp được phân công. Lịch học thay đổi tại mục Lịch học."
              : "Lớp mới sẽ được phân công cho tài khoản giáo viên của bạn."}
          </DialogDescription>
        </DialogHeader>
        {busy && !data ? (
          <p role="status">Đang tải…</p>
        ) : (
          data && (
            <form
              key={request}
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const values = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                setBusy(true);
                setError("");
                try {
                  const result = await saveTeacherClassAction({
                    id: classId ?? null,
                    request_id: request,
                    expected_updated_at: data.updated_at,
                    data: values,
                  });
                  if (result.error) setError(result.error);
                  else {
                    setOpen(false);
                    refresh();
                    router.refresh();
                  }
                } catch {
                  setError("Không kết nối được. Bạn có thể thử lại.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="grid gap-1 text-sm">
                Tên lớp
                <Input
                  name="name"
                  required
                  minLength={3}
                  maxLength={200}
                  defaultValue={data.name}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Chương trình
                <select
                  name="program_slug"
                  className={selectClass}
                  defaultValue={data.program_slug}
                  disabled={!!classId}
                >
                  {B2C_PROGRAMS.map((p) => (
                    <option value={p.slug} key={p.slug}>
                      {p.title}
                    </option>
                  ))}
                </select>
                {classId && (
                  <input
                    type="hidden"
                    name="program_slug"
                    value={data.program_slug}
                  />
                )}
              </label>
              <label className="grid gap-1 text-sm">
                Sĩ số tối đa
                <Input
                  name="capacity"
                  type="number"
                  min={1}
                  required
                  defaultValue={data.capacity}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Cơ sở
                <Input
                  name="campus"
                  maxLength={200}
                  defaultValue={data.campus ?? ""}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Hình thức
                <select
                  name="delivery_mode"
                  className={selectClass}
                  defaultValue={data.delivery_mode}
                >
                  <option value="offline">Trực tiếp</option>
                  <option value="online">Trực tuyến</option>
                  <option value="hybrid">Kết hợp</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Ngày khai giảng
                <Input
                  name="start_date"
                  type="date"
                  defaultValue={data.start_date ?? ""}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Ngày kết thúc khóa học
                <Input
                  name="end_date"
                  type="date"
                  defaultValue={data.end_date ?? ""}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Trạng thái
                <select
                  name="status"
                  className={selectClass}
                  defaultValue={data.status}
                >
                  {Object.entries({
                    planned: "Sắp khai giảng",
                    active: "Đang học",
                    paused: "Tạm dừng",
                    completed: "Đã hoàn thành",
                    cancelled: "Đã hủy",
                  }).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Ghi chú
                <textarea
                  name="notes"
                  className="rounded-md border p-3"
                  maxLength={4000}
                  defaultValue={data.notes ?? ""}
                />
              </label>
              <Button disabled={busy} type="submit">
                {busy ? "Đang lưu…" : "Lưu lớp"}
              </Button>
            </form>
          )
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function TeacherStudentManageDialog({
  classId,
  enrollmentId,
}: {
  classId: string;
  enrollmentId: string;
}) {
  const router = useRouter(),
    refresh = useClassWorkspaceRefresh();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [data, setData] = useState<TeacherStudentEdit | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (v) {
          setBusy(true);
          setError("");
          setData(null);
          void readTeacherStudentEditAction(classId, enrollmentId)
            .then((r) => {
              setData(r);
              if (!r) setError("Không tìm thấy học viên trong lớp.");
            })
            .catch(() => setError("Không tải được hồ sơ học viên."))
            .finally(() => setBusy(false));
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Sửa hồ sơ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sửa hồ sơ học viên</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin và trạng thái ghi danh trong lớp này.
          </DialogDescription>
        </DialogHeader>
        {busy && !data ? (
          <p role="status">Đang tải…</p>
        ) : (
          data && (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const values = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                setBusy(true);
                setError("");
                try {
                  const r = await saveTeacherStudentAction(
                    classId,
                    enrollmentId,
                    {
                      ...values,
                      updated_at: data.updated_at,
                      student_updated_at: data.student_updated_at,
                    },
                  );
                  if (r.error) setError(r.error);
                  else {
                    setOpen(false);
                    refresh();
                    router.refresh();
                  }
                } catch {
                  setError("Không lưu được hồ sơ. Vui lòng thử lại.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {!data.can_edit_profile && (
                <p className="text-sm text-amber-700">
                  Học viên còn thuộc lớp khác ngoài quyền của bạn. Quản lý cập
                  nhật tên và số điện thoại; bạn vẫn sửa được trạng thái của lớp
                  này.
                </p>
              )}
              <label className="grid gap-1 text-sm">
                Họ tên
                <Input
                  name="full_name"
                  required
                  maxLength={200}
                  readOnly={!data.can_edit_profile}
                  defaultValue={data.full_name}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Điện thoại
                <Input
                  name="phone"
                  pattern="[0-9]{10}"
                  readOnly={!data.can_edit_profile}
                  defaultValue={data.phone ?? ""}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Ngày nhập học
                <Input
                  name="enrollment_date"
                  type="date"
                  defaultValue={data.enrollment_date ?? ""}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Trạng thái
                <select
                  name="status"
                  className={selectClass}
                  defaultValue={data.status}
                >
                  {Object.entries(B2C_STUDENT_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Lý do nghỉ
                <textarea
                  className="rounded-md border p-3"
                  name="withdrawal_reason"
                  maxLength={1000}
                  defaultValue={data.withdrawal_reason ?? ""}
                />
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu hồ sơ"}
              </Button>
            </form>
          )
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
