"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  readTeacherAccountAction,
  changeTeacherPasswordAction,
} from "../server/account-actions";
import type {
  TeacherAccountTarget,
  TeacherAccountDetails,
} from "../account-schema";

export function TeacherAccountDialog({
  target,
  trigger,
}: {
  target: TeacherAccountTarget;
  trigger?: ReactNode;
}) {
  const sequence = useRef(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [account, setAccount] = useState<TeacherAccountDetails | null>(null);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function load() {
    const token = ++sequence.current;
    setLoading(true);
    setLoaded(false);
    setAccount(null);
    setError("");
    setShowPassword(false);
    try {
      const result = await readTeacherAccountAction(target);
      if (token !== sequence.current) return;
      setAccount(result.account);
      setError(result.error ?? "");
      setLoaded(!result.error);
    } catch {
      if (token === sequence.current)
        setError("Không tải được tài khoản. Vui lòng thử lại.");
    } finally {
      if (token === sequence.current) setLoading(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (saving) return;
        setOpen(value);
        if (value) void load();
        else {
          sequence.current++;
          setAccount(null);
          setError("");
          setShowPassword(false);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <KeyRound className="size-4" aria-hidden />
            Tài khoản
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tài khoản giáo viên</DialogTitle>
          <DialogDescription>
            Xem thông tin đăng nhập và đặt mật khẩu mới cho giáo viên.
          </DialogDescription>
        </DialogHeader>
        {loading && <p role="status">Đang tải tài khoản…</p>}
        {loaded && !account && (
          <div className="space-y-3">
            <p>Hồ sơ chưa liên kết tài khoản giáo viên.</p>
            <Button variant="outline" asChild>
              <Link href="/admin/b2c/permissions">
                Mở Phân quyền để liên kết
              </Link>
            </Button>
          </div>
        )}
        {account && (
          <>
            <dl className="space-y-2 rounded-md border p-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Giáo viên</dt>
                <dd>{account.full_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tài khoản đăng nhập</dt>
                <dd className="font-mono break-all select-all">
                  {account.login}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Vai trò</dt>
                <dd>
                  {account.role === "academic_manager"
                    ? "Giáo vụ"
                    : "Giáo viên"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Trạng thái tài khoản</dt>
                <dd>{account.account_active ? "Đang hoạt động" : "Đã khóa"}</dd>
              </div>
            </dl>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (saving) return;
                const values = new FormData(event.currentTarget);
                values.set("kind", target.kind);
                values.set("id", target.id);
                values.set("expected_user_id", account.user_id);
                setSaving(true);
                setError("");
                try {
                  const result = await changeTeacherPasswordAction(values);
                  if (result.error) setError(result.error);
                  else if (result.success) {
                    toast.success(result.success);
                    setAccount(null);
                    setShowPassword(false);
                    setOpen(false);
                  }
                } catch {
                  setError("Không thể kết nối. Vui lòng thử lại.");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <fieldset disabled={saving} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`new-password-${target.id}`}>
                    Mật khẩu mới *
                  </Label>
                  <Input
                    id={`new-password-${target.id}`}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`confirm-password-${target.id}`}>
                    Xác nhận mật khẩu mới *
                  </Label>
                  <Input
                    id={`confirm-password-${target.id}`}
                    name="confirm_password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                  />
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                  />
                  Hiện mật khẩu mới
                </label>
                <p className="text-muted-foreground text-sm">
                  Mật khẩu từ 8–72 ký tự. Đổi mật khẩu giữ nguyên tên đăng nhập,
                  vai trò và trạng thái khóa tài khoản.
                </p>
                <Button type="submit" disabled={saving}>
                  {saving ? "Đang đổi mật khẩu…" : "Đổi mật khẩu"}
                </Button>
              </fieldset>
            </form>
          </>
        )}
        {error && (
          <div role="alert" className="text-destructive space-y-2 text-sm">
            <p>{error}</p>
            {!account && (
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => void load()}
              >
                Thử lại
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
