"use server";

import { z } from "zod";
import { requireTeaching } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ClassMeeting } from "../domain/class-workspace";
import type {
  JournalClass,
  JournalMeetingPage,
} from "../domain/class-journal-preview";
import { getMyB2CClasses } from "./teacher-class-queries";
import { readTeacherWorkspaceAction } from "./teacher-management-actions";
import { readClassWorkspaceAction } from "./class-workspace-read";
import { permissionRpc } from "./permission-rpc";

// Preview reads only. Every read uses the signed-in user's existing scope/RLS.
export async function readClassJournalPreview() {
  const actor = await requireTeaching("super_admin");
  const manager = actor.role !== "teacher";
  let classes: JournalClass[];
  if (manager) {
    const client = await createClient();
    classes = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await client
        .from("b2c_classes")
        .select("id,code,name,program_slug,status,weekdays_text,time_text")
        .order("code")
        .order("id")
        .range(start, start + 499);
      if (error)
        throw new Error("Không tải được danh sách lớp. Vui lòng thử lại.");
      classes.push(...data);
      if (data.length < 500) break;
    }
  } else {
    classes = (await getMyB2CClasses()).map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      program_slug: c.program_slug,
      status: c.status,
      weekdays_text: c.weekdays_text,
      time_text: c.time_text,
    }));
  }
  // Reuse the existing named operators allowlist solely for preview access.
  // Production report publishing will require its own permission and RPC.
  const canCompose =
    actor.role === "super_admin" ||
    (await permissionRpc<boolean>("can_create_b2c_teacher_accounts").catch(
      () => false,
    ));
  return {
    classes,
    canCompose,
    actorName: actor.fullName,
    classBase: manager ? "/admin/b2c/classes" : "/teacher/b2c-classes",
  };
}

export async function readJournalPreviewMeetings(
  classId: string,
  page: number,
): Promise<JournalMeetingPage> {
  const actor = await requireTeaching("super_admin");
  const input = z
    .object({ id: z.uuid(), page: z.number().int().min(0).max(1000000) })
    .parse({ id: classId, page });
  const filters = { tab: "schedule", page: String(input.page) };
  const model =
    actor.role === "teacher"
      ? await readTeacherWorkspaceAction(input.id, filters)
      : await readClassWorkspaceAction(input.id, filters);
  return {
    total: model.result.total,
    rows: (model.result.rows as ClassMeeting[]).map((m) => ({
      id: m.id,
      starts_at: m.starts_at,
      ends_at: m.ends_at,
      teacher_name: m.teacher_name,
      status: m.status,
    })),
  };
}
