"use client";

import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";

import {
  createStudentAction,
  updateStudentAction,
} from "@/features/students/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/lib/use-form-action";

type Level = { id: string; code: string; name: string };

type Student = {
  id: string;
  student_code: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_relation: string | null;
  current_level_id: string | null;
  target_level_id: string | null;
  learning_goal: string | null;
  note: string | null;
};

export function StudentFormDialog({
  levels,
  student,
  trigger,
}: {
  levels: Level[];
  student?: Student;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(student);
  const [open, setOpen] = useState(false);

  const { state, formAction } = useFormAction(
    isEdit ? updateStudentAction : createStudentAction,
    { onSuccess: () => setOpen(false) },
  );

  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" aria-hidden />
            Thêm học viên
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Sửa hồ sơ học viên" : "Thêm học viên"}
          </DialogTitle>
          <DialogDescription>
            Hồ sơ tạo được trước khi có tài khoản. Quản trị viên có thể cấp tên
            đăng nhập và mật khẩu sau; email liên hệ không bắt buộc.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={student!.id} />}

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="full_name">Họ tên *</Label>
            <Input
              id="full_name"
              name="full_name"
              required
              defaultValue={student?.full_name}
            />
            {fe["full_name"] && (
              <p className="text-destructive text-xs">{fe["full_name"]}</p>
            )}
          </div>

          {!isEdit && (
            <p className="text-muted-foreground text-xs">
              Mã học viên được hệ thống tự sinh sau khi lưu.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dob">Ngày sinh</Label>
              <Input
                id="dob"
                name="dob"
                type="date"
                defaultValue={student?.dob ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Giới tính</Label>
              <Select name="gender" defaultValue={student?.gender ?? "none"}>
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="Nam">Nam</SelectItem>
                  <SelectItem value="Nữ">Nữ</SelectItem>
                  <SelectItem value="Khác">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={student?.phone ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={student?.email ?? ""}
              />
              <p className="text-muted-foreground text-xs">
                Chỉ là thông tin liên hệ. Tài khoản đăng nhập được tạo khi bạn
                bấm &quot;Gửi lời mời&quot;.
              </p>
              {fe["email"] && (
                <p className="text-destructive text-xs">{fe["email"]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Địa chỉ</Label>
              <Input
                id="address"
                name="address"
                defaultValue={student?.address ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="current_level_id">Bậc hiện tại</Label>
              <Select
                name="current_level_id"
                defaultValue={student?.current_level_id ?? "none"}
              >
                <SelectTrigger id="current_level_id" className="w-full">
                  <SelectValue placeholder="Chưa xác định" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Chưa xác định</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_level_id">Bậc mục tiêu</Label>
              <Select
                name="target_level_id"
                defaultValue={student?.target_level_id ?? "none"}
              >
                <SelectTrigger id="target_level_id" className="w-full">
                  <SelectValue placeholder="Chưa xác định" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Chưa xác định</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="learning_goal">Mục tiêu học tập</Label>
            <Textarea
              id="learning_goal"
              name="learning_goal"
              rows={2}
              defaultValue={student?.learning_goal ?? ""}
              placeholder="Giao tiếp nghiệp vụ ngân hàng với khách hàng Trung Quốc"
            />
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-1 text-sm font-medium">Người giám hộ</p>
            <p className="text-muted-foreground mb-3 text-xs">
              Chỉ là <strong>thông tin liên hệ</strong> — không phải tài khoản
              đăng nhập. Hệ thống không có vai trò phụ huynh.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="guardian_name">Họ tên</Label>
                <Input
                  id="guardian_name"
                  name="guardian_name"
                  defaultValue={student?.guardian_name ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian_phone">Điện thoại</Label>
                <Input
                  id="guardian_phone"
                  name="guardian_phone"
                  type="tel"
                  defaultValue={student?.guardian_phone ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian_relation">Quan hệ</Label>
                <Input
                  id="guardian_relation"
                  name="guardian_relation"
                  placeholder="Mẹ / Bố / …"
                  defaultValue={student?.guardian_relation ?? ""}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Ghi chú nội bộ</Label>
            <Textarea
              id="note"
              name="note"
              rows={2}
              defaultValue={student?.note ?? ""}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>{isEdit ? "Lưu thay đổi" : "Tạo hồ sơ"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
