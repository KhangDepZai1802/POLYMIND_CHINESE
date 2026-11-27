"use client";

import { useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  B2CStudentAccount,
  B2CStudentLogin,
} from "../domain/student-account";
import {
  readB2CStudentAccountAction,
  findB2CStudentLoginAction,
  saveB2CStudentAccountAction,
} from "../server/student-account-actions";

export function B2CStudentAccountDialog({
  studentId,
  fullName,
}: {
  studentId: string;
  fullName: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<B2CStudentAccount | null>(null);
  const [mode, setMode] = useState<"create" | "link">("create");
  const [login, setLogin] = useState("");
  const [selected, setSelected] = useState<B2CStudentLogin | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const pending = useRef(false);

  async function changeOpen(next: boolean) {
    if (pending.current) return;
    setOpen(next);
    const seq = ++request.current;
    setData(null);
    setError("");
    setSuccess("");
    setSelected(null);
    setLogin("");
    setMode("create");
    if (!next) return;
    setBusy(true);
    try {
      const result = await readB2CStudentAccountAction(studentId);
      if (seq === request.current) setData(result);
    } catch {
      if (seq === request.current)
        setError("Không tải được tài khoản. Đóng cửa sổ và thử lại.");
    } finally {
      if (seq === request.current) setBusy(false);
    }
  }

  async function find() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setSelected(null);
    try {
      const result = await findB2CStudentLoginAction(login);
      setSelected(result);
      if (!result)
        setError("Không tìm thấy tài khoản học viên đang hoạt động.");
    } catch {
      setError(
        "Không tìm được tài khoản. Kiểm tra tên đăng nhập hoặc email chính xác.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("student_id", studentId);
    form.set("mode", mode);
    if (mode === "link") {
      if (!selected) return;
      form.set("user_id", selected.id);
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await saveB2CStudentAccountAction({}, form);
      if (result.error || result.fieldErrors) {
        setError(
          result.error ??
            Object.values(result.fieldErrors ?? {})
              .flat()
              .join(" "),
        );
      } else if (result.success) {
        formElement.reset();
        setSuccess(result.success);
        setData(await readB2CStudentAccountAction(studentId));
      }
    } catch {
      setError(
        "Chưa xác nhận được kết quả. Tải lại tài khoản trước khi thử tiếp.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="rounded p-2 text-blue-600 hover:bg-blue-50"
        title="Tài khoản học viên"
        aria-label={`Tài khoản ${fullName}`}
        onClick={() => void changeOpen(true)}
      >
        <KeyRound className="size-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={(next) => void changeOpen(next)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tài khoản học viên</DialogTitle>
            <DialogDescription>
              {fullName} · Đăng nhập để xem và nộp bài tập lớp trung tâm.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="text-sm text-emerald-700">
              {success}
            </p>
          )}
          {!data && busy && <p role="status">Đang tải tài khoản…</p>}
          {data?.account ? (
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <p className="font-semibold">Đã liên kết tài khoản</p>
              <p className="break-all">
                Tên đăng nhập: {data.account.username ?? data.account.email}
              </p>
              <p>Học viên vào mục “Bài tập” sau khi đăng nhập.</p>
            </div>
          ) : (
            data && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={mode === "create" ? "default" : "outline"}
                    disabled={busy}
                    onClick={() => {
                      setMode("create");
                      setError("");
                    }}
                  >
                    Tạo tài khoản
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "link" ? "default" : "outline"}
                    disabled={busy}
                    onClick={() => {
                      setMode("link");
                      setError("");
                    }}
                  >
                    Liên kết tài khoản có sẵn
                  </Button>
                </div>
                <form key={mode} onSubmit={save} className="space-y-4">
                  <fieldset disabled={busy} className="space-y-4">
                    {mode === "create" ? (
                      <>
                        <div className="space-y-2 text-sm">
                          <label className="block space-y-2">
                            <span>Tên đăng nhập</span>
                            <Input
                              name="username"
                              required
                              minLength={3}
                              maxLength={32}
                              autoComplete="off"
                              pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}"
                            />
                          </label>
                          <p className="text-muted-foreground">
                            3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới
                            hoặc gạch ngang.
                          </p>
                        </div>
                        <label className="block space-y-2 text-sm">
                          <span>Mật khẩu</span>
                          <Input
                            name="password"
                            type="password"
                            required
                            minLength={8}
                            maxLength={72}
                            autoComplete="new-password"
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="block space-y-2 text-sm">
                          <span>Tên đăng nhập hoặc email chính xác</span>
                          <Input
                            value={login}
                            onChange={(e) => {
                              setLogin(e.target.value);
                              setSelected(null);
                            }}
                            autoComplete="off"
                          />
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={login.trim().length < 3}
                          onClick={() => void find()}
                        >
                          Tìm tài khoản
                        </Button>
                        {selected && (
                          <p className="rounded-lg border p-3 text-sm break-words">
                            {selected.full_name} ·{" "}
                            {selected.username ?? selected.email}
                          </p>
                        )}
                      </>
                    )}
                    <Button
                      type="submit"
                      disabled={mode === "link" && !selected}
                    >
                      {busy
                        ? "Đang xử lý…"
                        : mode === "create"
                          ? "Cấp tài khoản"
                          : "Liên kết với học viên này"}
                    </Button>
                  </fieldset>
                </form>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
