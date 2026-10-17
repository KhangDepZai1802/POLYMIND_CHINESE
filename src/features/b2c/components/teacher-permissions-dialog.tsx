"use client";
import { useRef, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
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
  B2C_PERMISSION_KEYS,
  B2C_PERMISSION_LABELS,
  toggleB2CPermission,
  type B2CPermission,
} from "../domain/teacher-permissions";
import {
  readB2CPermissionAdminAction,
  saveB2CPermissionsAction,
  type PermissionAdminData,
} from "../server/permission-actions";

function PermissionsContent({
  embedded,
  children,
}: {
  embedded: boolean;
  children: ReactNode;
}) {
  return embedded ? (
    <section className="bg-card space-y-4 rounded-xl border p-4 sm:p-6">
      {children}
    </section>
  ) : (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
      {children}
    </DialogContent>
  );
}

export function TeacherPermissionsDialog({
  embedded = false,
  initialData = null,
}: { embedded?: boolean; initialData?: PermissionAdminData | null } = {}) {
  const Title = embedded ? "h2" : DialogTitle;
  const Description = embedded ? "p" : DialogDescription;
  const [open, setOpen] = useState(false),
    [data, setData] = useState<PermissionAdminData | null>(initialData);
  const [selected, setSelected] = useState(""),
    [account, setAccount] = useState(""),
    [query, setQuery] = useState("");
  const [permissions, setPermissions] = useState<B2CPermission[]>([]),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const sequence = useRef(0);
  const teacher = data?.teachers.find((row) => row.id === selected);
  async function load(id = selected) {
    const request = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await readB2CPermissionAdminAction();
      if (sequence.current !== request) return;
      setData(result);
      const target = result.teachers.find((row) => row.id === id);
      setSelected(target?.id ?? "");
      setAccount(target?.source_teacher_id ?? "");
      setPermissions(target?.permissions ?? []);
    } catch (error) {
      if (sequence.current === request)
        setError(
          error instanceof Error ? error.message : "Không tải được phân quyền.",
        );
    } finally {
      if (sequence.current === request) setLoading(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (saving) return;
        setOpen(value);
        if (value) {
          void load();
        } else sequence.current++;
      }}
    >
      {!embedded && (
        <DialogTrigger asChild>
          <Button variant="outline">
            <ShieldCheck className="size-4" aria-hidden />
            Phân quyền
          </Button>
        </DialogTrigger>
      )}
      <PermissionsContent embedded={embedded}>
        <DialogHeader>
          <Title className="text-lg font-semibold">
            Phân quyền giáo viên
          </Title>
          <Description className="text-muted-foreground text-sm">
            Chọn giáo viên và tài khoản đã có. Các quyền áp dụng trong lớp được
            phân công; lớp mới do giáo viên tạo tự phân công cho người đó. Tài
            khoản quản lý vẫn giữ quyền theo vai trò.
          </Description>
        </DialogHeader>
        {loading ? (
          <p role="status">Đang tải phân quyền…</p>
        ) : (
          <>
            <Input
              type="search"
              aria-label="Tìm giáo viên để phân quyền"
              placeholder="Tìm tên giáo viên…"
              value={query}
              disabled={saving}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="grid gap-2 text-sm">
              Giáo viên
              <select
                className="h-10 rounded-md border px-3"
                aria-label="Giáo viên"
                value={selected}
                disabled={saving}
                onChange={(e) => {
                  const row = data?.teachers.find(
                    (item) => item.id === e.target.value,
                  );
                  setSelected(row?.id ?? "");
                  setAccount(row?.source_teacher_id ?? "");
                  setPermissions(row?.permissions ?? []);
                  setError("");
                }}
              >
                <option value="">Chọn giáo viên</option>
                {data?.teachers
                  .filter(
                    (row) =>
                      row.id === selected ||
                      row.full_name
                        .toLocaleLowerCase("vi")
                        .includes(query.toLocaleLowerCase("vi")),
                  )
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.full_name}
                      {row.active ? "" : " — chưa liên kết tài khoản hoạt động"}
                    </option>
                  ))}
              </select>
            </label>
            {teacher && (
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSaving(true);
                  setError("");
                  try {
                    const result = await saveB2CPermissionsAction({
                      teacher_id: teacher.id,
                      source_teacher_id: account,
                      permissions,
                      expected_updated_at: teacher.updated_at,
                    });
                    if (result.error) setError(result.error);
                    else {
                      toast.success("Đã lưu phân quyền thành công", { position: "top-center", duration: 4500 });
                      await load(teacher.id);
                    }
                  } catch {
                    setError(
                      "Không kết nối được. Tải lại quyền trước khi thử lưu lại.",
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <label className="grid gap-2 text-sm">
                  Tài khoản giáo viên hiện có
                  <select
                    aria-label="Tài khoản giáo viên hiện có"
                    className="h-10 rounded-md border px-3"
                    required
                    value={account}
                    disabled={saving}
                    onChange={(e) => setAccount(e.target.value)}
                  >
                    <option value="">Chọn tài khoản</option>
                    {data?.accounts.map((row) => (
                      <option
                        key={row.id}
                        value={row.id}
                        disabled={data.teachers.some(
                          (other) =>
                            other.id !== teacher.id &&
                            other.source_teacher_id === row.id,
                        )}
                      >
                        {row.full_name} · {row.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
                {!teacher.active && (
                  <p className="text-sm text-amber-700">
                    Chọn tài khoản đang hoạt động để liên kết và cấp quyền cho
                    giáo viên này.
                  </p>
                )}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3">Nghiệp vụ</th>
                        <th className="p-3 text-center">Cho phép</th>
                      </tr>
                    </thead>
                    <tbody>
                      {B2C_PERMISSION_KEYS.map((key) => (
                        <tr key={key} className="border-t">
                          <td>
                            <label
                              htmlFor={`b2c-permission-${key}`}
                              className="flex min-h-11 cursor-pointer items-center p-3"
                            >
                              {B2C_PERMISSION_LABELS[key]}
                            </label>
                          </td>
                          <td className="p-3 text-center">
                            <input
                              id={`b2c-permission-${key}`}
                              aria-label={B2C_PERMISSION_LABELS[key]}
                              type="checkbox"
                              className="size-5 cursor-pointer accent-blue-600"
                              checked={permissions.includes(key)}
                              disabled={saving}
                              onChange={(e) => {
                                setPermissions(
                                  toggleB2CPermission(
                                    permissions,
                                    key,
                                    e.target.checked,
                                  ),
                                );
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-muted-foreground text-xs">
                  Chọn quyền sửa sẽ tự chọn quyền xem liên quan. Bỏ quyền xem sẽ
                  bỏ các quyền phụ thuộc. Thu hồi có hiệu lực với yêu cầu tiếp
                  theo sau khi lưu.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void load(teacher.id)}
                  >
                    Tải lại quyền
                  </Button>
                  <Button type="submit" disabled={saving || !account}>
                    {saving ? "Đang lưu…" : "Lưu phân quyền"}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
        {error && (
          <div role="alert" className="space-y-2 text-sm text-red-600">
            <p>{error}</p>
            {!data && (
              <Button variant="outline" onClick={() => void load()}>
                Thử lại
              </Button>
            )}
          </div>
        )}
      </PermissionsContent>
    </Dialog>
  );
}
