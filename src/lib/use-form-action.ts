"use client";

import { useState } from "react";
import { toast } from "sonner";

import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/action-state";

type ServerAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Gọi server action từ `<form action={formAction}>`.
 *
 * Vì sao KHÔNG dùng `useActionState` + `useEffect` để đóng dialog?
 *   `useEffect(() => { if (state.success) setOpen(false) }, [state])` là pattern
 *   phổ biến nhưng sai: nó gọi setState *trong* effect → React render thêm một
 *   vòng nữa chỉ để phản ứng với state nó vừa render xong (cascading render).
 *   ESLint của React Compiler bắt đúng lỗi này.
 *
 * Ở đây "thành công" là kết quả của một EVENT (người dùng submit), nên xử lý
 * ngay trong event handler — không cần effect, không có vòng render thừa.
 *
 * `useFormStatus()` trong <SubmitButton> vẫn chạy đúng vì đây vẫn là form action.
 */
export function useFormAction(
  action: ServerAction,
  options?: {
    /** Chạy khi action trả về `success` — vd đóng dialog. */
    onSuccess?: () => void;
    /** Hiện lỗi bằng toast thay vì Alert trong form. */
    toastError?: boolean;
  },
) {
  const [state, setState] = useState<ActionState>(EMPTY_ACTION_STATE);

  async function formAction(formData: FormData) {
    let result: ActionState;
    try {
      result = await action(EMPTY_ACTION_STATE, formData);
    } catch {
      result = {
        error:
          "Không thể kết nối để xử lý yêu cầu. Vui lòng kiểm tra mạng và thử lại.",
      };
    }

    if (result.success) {
      toast.success(result.success);
      setState(EMPTY_ACTION_STATE);
      options?.onSuccess?.();
      return;
    }

    if (options?.toastError && result.error) toast.error(result.error);
    setState(result);
  }

  return { state, formAction };
}
