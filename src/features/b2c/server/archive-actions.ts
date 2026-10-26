"use server";
import { z } from "zod";
import { requireTeaching } from "@/lib/auth/session";
import { permissionRpc } from "./permission-rpc";
import { revalidateB2CViews } from "./revalidate-views";

export async function archiveCenterRecordAction(input: unknown) {
  await requireTeaching("super_admin");
  const parsed = z.object({ entity: z.enum(["student", "parent", "package"]), id: z.uuid(), reason: z.string().trim().min(1).max(1000) }).safeParse(input);
  if (!parsed.success) return { error: "Chọn hồ sơ và nhập lý do xóa." };
  try {
    await permissionRpc("archive_b2c_center_record", { p_entity: parsed.data.entity, p_id: parsed.data.id, p_reason: parsed.data.reason });
    revalidateB2CViews();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không xóa được hồ sơ." };
  }
}
