"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { provisionPasswordAccount } from "@/features/users/server/account";
import { zodToActionState, type ActionState } from "@/lib/action-state";
import {
  b2cStudentAccountSchema,
  type B2CStudentAccount,
  type B2CStudentLogin,
} from "../domain/student-account";
import { permissionRpc } from "./permission-rpc";
import { revalidateB2CViews } from "./revalidate-views";

export async function readB2CStudentAccountAction(studentId: string) {
  await requireRole("super_admin");
  return permissionRpc<B2CStudentAccount>("read_b2c_student_account", {
    p_student_id: z.uuid().parse(studentId),
  });
}

export async function findB2CStudentLoginAction(login: string) {
  await requireRole("super_admin");
  return permissionRpc<B2CStudentLogin | null>("find_b2c_student_login", {
    p_login: z.string().trim().min(3).max(254).parse(login),
  });
}

export async function saveB2CStudentAccountAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  // Account administration stays super-admin-only, independently of class rights.
  await requireRole("super_admin");
  const parsed = b2cStudentAccountSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodToActionState(parsed.error);
  const values = parsed.data;
  let student: B2CStudentAccount;
  try {
    student = await readB2CStudentAccountAction(values.student_id);
  } catch {
    return { error: "Không tải được hồ sơ học viên. Vui lòng thử lại." };
  }
  if (student.account) {
    if (values.mode === "link" && student.account.id === values.user_id)
      return { success: "Tài khoản đã được liên kết với học viên này." };
    return { error: "Học viên đã có tài khoản. Vui lòng tải lại để kiểm tra." };
  }

  let userId: string;
  let created = false;
  if (values.mode === "create") {
    const account = await provisionPasswordAccount({
      // Never send a client-selected existing user to the password helper.
      userId: null,
      username: values.username,
      password: values.password,
      fullName: student.full_name,
      role: "student",
      phone: student.phone,
      contactEmail: student.email,
    });
    if (!account.ok) return { error: account.error };
    userId = account.userId;
    created = account.created;
  } else {
    userId = values.user_id;
  }

  try {
    // Session RPC validates active student role, exact identity, scope and races.
    await permissionRpc("link_b2c_student_account", {
      p_student_id: values.student_id,
      p_user_id: userId,
    });
  } catch {
    // A lost response may follow a committed link. Never delete that account.
    let linked: B2CStudentAccount;
    try {
      linked = await readB2CStudentAccountAction(values.student_id);
    } catch {
      return {
        error:
          "Chưa xác nhận được liên kết. Vui lòng tải lại tài khoản trước khi thử tiếp.",
      };
    }
    if (linked.account?.id !== userId) {
      if (created) {
        // Keep the new identity: another admin may have linked it elsewhere.
        // It has no B2C access without a guarded mapping; never delete on a race.
        return {
          error:
            "Đã tạo tài khoản nhưng chưa liên kết được. Chọn liên kết tài khoản có sẵn và tìm bằng tên đăng nhập vừa tạo.",
        };
      }
      return {
        error:
          "Không liên kết được tài khoản. Kiểm tra tài khoản học viên hoặc tải lại hồ sơ.",
      };
    }
  }
  revalidateB2CViews();
  revalidatePath("/student", "layout");
  return {
    success:
      values.mode === "create"
        ? "Đã cấp tài khoản học viên."
        : "Đã liên kết tài khoản học viên.",
  };
}
