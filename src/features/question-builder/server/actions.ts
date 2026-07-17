"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { zodToActionState, type ActionState } from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const setSchema = z.object({
  kind: z.enum(["exercise", "exam"]),
  title: z.string().trim().min(2),
  description: z.string().default(""),
});
const itemSchema = z.object({
  set_version_id: z.uuid(),
  question_version_id: z.uuid(),
  points: z.coerce.number().positive(),
  section_id: z.union([z.literal(""), z.uuid()]).default(""),
});
const sectionSchema = z.object({ set_version_id: z.uuid(), title: z.string().trim().min(1), instructions: z.string().trim().default("") });

export async function createQuestionSetAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("teacher", "super_admin");
  const parsed = setSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);
  const supabase = await createClient();
  const { data: set, error } = await supabase
    .from("question_sets")
    .insert({ owner_id: actor.id, ...parsed.data })
    .select("id")
    .single();
  if (error) return { error: "Không tạo được bộ câu hỏi." };
  const { error: versionError } = await supabase.rpc(
    "create_question_set_version",
    {
      p_question_set_id: set.id,
      p_title: parsed.data.title,
      p_instructions: parsed.data.description || undefined,
    },
  );
  if (versionError) return { error: versionError.message };
  revalidatePath(
    `/teacher/${parsed.data.kind === "exercise" ? "exercises" : "exams"}/sets`,
  );
  return { success: "Đã tạo bộ câu hỏi nháp." };
}

export async function addQuestionSetItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);
  const supabase = await createClient();
  const { count } = await supabase
    .from("question_set_items")
    .select("id", { count: "exact", head: true })
    .eq("set_version_id", parsed.data.set_version_id);
  const { error } = await supabase
    .from("question_set_items")
    .insert({ ...parsed.data, section_id: parsed.data.section_id || null, order_index: count ?? 0 });
  if (error)
    return {
      error: error.message.includes("khóa")
        ? error.message
        : "Không thêm được câu hỏi.",
    };
  revalidatePath("/teacher/exercises/sets");
  revalidatePath("/teacher/exams/sets");
  return { success: "Đã thêm câu hỏi vào bộ." };
}

export async function createQuestionSetSectionAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const parsed = sectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);
  const supabase = await createClient();
  const { count } = await supabase.from("question_set_sections").select("id", { count: "exact", head: true }).eq("set_version_id", parsed.data.set_version_id);
  const { error } = await supabase.from("question_set_sections").insert({ ...parsed.data, instructions: parsed.data.instructions || null, order_index: count ?? 0 });
  if (error) return { error: error.message };
  revalidatePath("/teacher/exercises/sets"); revalidatePath("/teacher/exams/sets");
  return { success: "Đã thêm section." };
}

export async function moveQuestionSetItemAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const id=formData.get("item_id"), direction=Number(formData.get("direction"));
  if(typeof id!=="string" || ![-1,1].includes(direction)) return { error: "Thao tác sắp xếp không hợp lệ." };
  const supabase=await createClient(); const { error }=await supabase.rpc("move_question_set_item",{p_item_id:id,p_direction:direction});
  if(error) return {error:error.message}; revalidatePath("/teacher/exercises/sets"); revalidatePath("/teacher/exams/sets"); return {success:"Đã đổi thứ tự."};
}

export async function removeQuestionSetItemAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("teacher", "super_admin"); const id=formData.get("item_id"); if(typeof id!=="string") return {error:"Thiếu item."};
  const supabase=await createClient(); const {error}=await supabase.rpc("remove_question_set_item",{p_item_id:id}); if(error)return{error:error.message};
  revalidatePath("/teacher/exercises/sets"); revalidatePath("/teacher/exams/sets"); return{success:"Đã xóa item khỏi bản nháp."};
}

export async function lockQuestionSetAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");
  const id = formData.get("set_version_id");
  if (typeof id !== "string") return { error: "Thiếu phiên bản bộ." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("lock_question_set_version", {
    p_set_version_id: id,
  });
  if (error) return { error: error.message };
  revalidatePath("/teacher/exercises/sets");
  revalidatePath("/teacher/exams/sets");
  return { success: "Đã chốt phiên bản bất biến, sẵn sàng để giao." };
}
