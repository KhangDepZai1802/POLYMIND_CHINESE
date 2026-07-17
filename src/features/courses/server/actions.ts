"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  courseSchema,
  lessonSchema,
  materialRegisterSchema,
  materialUpdateSchema,
  moduleSchema,
} from "@/features/courses/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireRole, requireUser } from "@/lib/auth/session";
import {
  ALLOWED_FILE_EXTENSIONS,
  MATERIALS_BUCKET,
  MAX_MATERIAL_SIZE_BYTES,
  SIGNED_URL_TTL_SECONDS,
  fileExtension,
  sanitizeDownloadName,
} from "@/lib/domain/files";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";

/**
 * Mutation của khóa học.
 *
 * Mỗi action kiểm quyền ở dòng đầu. Mutation cấu trúc khóa học chỉ dành cho
 * super admin; riêng tài liệu cho phép cả teacher, rồi RLS tiếp tục khoanh đúng
 * course của lớp họ được phân công.
 * Đây KHÔNG phải sự thừa thãi vì đã có middleware: middleware chỉ chặn điều
 * hướng trang. Server action là một HTTP endpoint — gọi thẳng được, không đi
 * qua middleware. Và kể cả action này có lỗ, RLS vẫn chặn ở DB.
 */

function formToObject(formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    raw[key] = value;
  }
  // Checkbox không được tick thì trình duyệt KHÔNG gửi field lên.
  raw["completion_require_all_exercises"] =
    formData.get("completion_require_all_exercises") === "on";
  return raw;
}

export async function createCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("super_admin");

  const parsed = courseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id, code, title")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "course.create",
    resourceType: "course",
    resourceId: data.id,
    after: { code: data.code, title: data.title },
  });

  revalidatePath("/admin/courses");
  return { success: `Đã tạo khóa học "${data.title}".` };
}

export async function updateCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Thiếu mã khóa học." };

  const parsed = courseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("courses")
    .select("code, title, status")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("courses")
    .update(parsed.data)
    .eq("id", id)
    .select("id, code, title, status")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "course.update",
    resourceType: "course",
    resourceId: id,
    before,
    after: { code: data.code, title: data.title, status: data.status },
  });

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  return { success: "Đã lưu thay đổi." };
}

export async function archiveCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Thiếu mã khóa học." };

  const supabase = await createClient();

  // KHÔNG hard delete: khóa học đã mở lớp thì xóa đi là mất cả lịch sử học tập
  // của học viên. Lưu trữ (archive) giữ dữ liệu, chỉ ẩn khỏi danh sách chọn.
  const { error } = await supabase
    .from("courses")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "course.archive",
    resourceType: "course",
    resourceId: id,
    after: { status: "archived" },
  });

  revalidatePath("/admin/courses");
  return { success: "Đã lưu trữ khóa học." };
}

// --- Chương (module) ---------------------------------------------------------

export async function createModuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = moduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();

  const { error } = await supabase.from("course_modules").insert(parsed.data);
  if (error) {
    // UNIQUE (course_id, order_index) — thứ tự trùng là lỗi hay gặp nhất.
    return {
      error:
        error.code === "23505"
          ? "Đã có chương ở vị trí này. Chọn thứ tự khác."
          : dbErrorToMessage(error),
    };
  }

  revalidatePath(`/admin/courses/${parsed.data.course_id}`);
  return { success: "Đã thêm chương." };
}

export async function deleteModuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  const courseId = formData.get("course_id");
  if (typeof id !== "string" || typeof courseId !== "string") {
    return { error: "Thiếu thông tin chương." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("course_modules").delete().eq("id", id);
  if (error) return { error: dbErrorToMessage(error) };

  revalidatePath(`/admin/courses/${courseId}`);
  return { success: "Đã xóa chương." };
}

// --- Bài học (lesson) --------------------------------------------------------

export async function createLessonAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = lessonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const courseId = formData.get("course_id");
  const supabase = await createClient();

  const { error } = await supabase.from("lessons").insert(parsed.data);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Đã có bài học ở vị trí này trong chương. Chọn thứ tự khác."
          : dbErrorToMessage(error),
    };
  }

  if (typeof courseId === "string")
    revalidatePath(`/admin/courses/${courseId}`);
  return { success: "Đã thêm bài học." };
}

export async function deleteLessonAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  const courseId = formData.get("course_id");
  if (typeof id !== "string" || typeof courseId !== "string") {
    return { error: "Thiếu thông tin bài học." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) return { error: dbErrorToMessage(error) };

  revalidatePath(`/admin/courses/${courseId}`);
  return { success: "Đã xóa bài học." };
}

// --- Tài liệu khóa học -------------------------------------------------------
//
// Upload đi THẲNG từ trình duyệt lên Supabase Storage, KHÔNG qua Next server:
//
//   1. `createMaterialUploadUrlAction` — server kiểm quyền, sinh path, ký URL
//   2. trình duyệt PUT file lên storage bằng URL đó
//   3. `registerMaterialAction` — server xác minh file có thật rồi ghi metadata
//
// Vì sao không nhận thẳng `File` trong server action cho gọn? Vì server action
// mặc định chặn body > 1 MB, và trên Vercel giới hạn cứng của serverless function
// là 4,5 MB. Bucket cho phép 50 MB → cái PDF 20 MB sẽ chạy ngon ở local rồi chết
// ở production. Đi thẳng lên storage thì không đụng giới hạn nào của Next/Vercel.
//
// Đánh đổi: có thêm một bước. Bù lại, mọi lớp đều fail-closed — ký URL upload đã
// bị chặn bởi policy INSERT của storage, ghi metadata bị chặn bởi RLS, và
// `object_path` do server sinh nên không ai gắn file vào course của người khác.

type UploadTicket = { path: string; token: string };

export async function createMaterialUploadUrlAction(input: {
  courseId: string;
  fileName: string;
  sizeBytes: number;
}): Promise<{ error: string } | UploadTicket> {
  await requireRole("super_admin", "teacher");

  if (!z.uuid().safeParse(input.courseId).success) {
    return { error: "Khóa học không hợp lệ." };
  }

  // Đuôi file lấy từ ALLOWLIST. Client có gửi `.exe` hay `.php5` cũng dừng ở đây.
  const ext = fileExtension(input.fileName);
  if (!ext) {
    return {
      error: `Định dạng không được hỗ trợ. Cho phép: ${ALLOWED_FILE_EXTENSIONS.join(", ")}.`,
    };
  }

  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { error: "Tệp rỗng hoặc không đọc được." };
  }
  if (input.sizeBytes > MAX_MATERIAL_SIZE_BYTES) {
    return { error: "Tệp vượt quá 50 MB." };
  }

  // Path do SERVER sinh — không bao giờ nhận path từ client. Nhận là mở cửa cho
  // việc ghi đè file của course khác. Thư mục gốc = course_id, đúng quy ước mà
  // policy storage đang soi (migration 14).
  const path = `${input.courseId}/${crypto.randomUUID()}.${ext}`;

  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "material_upload"))) {
    return {
      error: "Bạn đã tạo quá nhiều lượt tải lên. Vui lòng thử lại sau.",
    };
  }

  // Ký URL bằng client CỦA NGƯỜI DÙNG, không phải admin client: policy INSERT
  // của storage vẫn phải duyệt. Không có quyền với course này → ký không nổi.
  const { data, error } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { error: "Không tạo được liên kết tải lên. Vui lòng thử lại." };
  }

  return { path: data.path, token: data.token };
}

export async function registerMaterialAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("super_admin", "teacher");

  const parsed = materialRegisterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const { course_id, object_path, ...rest } = parsed.data;

  // `object_path` đi vòng qua client (bước 2 chạy ở trình duyệt) nên coi như dữ
  // liệu KHÔNG tin được: bắt buộc đúng dạng `<course_id>/<file>.<ext>`. Thiếu
  // bước này, client sửa path thành course khác là gắn được metadata của khóa
  // này lên file của khóa kia.
  const segments = object_path.split("/");
  if (
    segments.length !== 2 ||
    segments[0] !== course_id ||
    !fileExtension(object_path)
  ) {
    return { error: "Đường dẫn tệp không hợp lệ." };
  }

  const supabase = await createClient();

  // Kích thước + MIME lấy từ STORAGE, không lấy từ lời khai của client. Đây đồng
  // thời là bằng chứng file có thật: gọi register mà chưa upload → dừng ở đây,
  // không sinh ra dòng metadata trỏ vào hư không.
  const { data: info, error: infoError } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .info(object_path);

  if (infoError || !info) {
    return { error: "Không tìm thấy tệp vừa tải lên. Vui lòng thử lại." };
  }

  const { data, error } = await supabase
    .from("course_materials")
    .insert({
      course_id,
      object_path,
      ...rest,
      mime_type: info.contentType ?? null,
      size_bytes: info.size ?? null,
      uploaded_by: user.id, // actor THẬT, không phải "user đầu tiên trong DB"
    })
    .select("id, title")
    .single();

  if (error) {
    // Metadata hỏng (vd trigger chặn vì module không thuộc course) mà file đã nằm
    // trên storage → dọn ngay. Không để lại file mồ côi không ai tham chiếu tới,
    // vì sau này không còn cách nào biết nó là rác.
    await supabase.storage.from(MATERIALS_BUCKET).remove([object_path]);
    return { error: dbErrorToMessage(error) };
  }

  await logAudit(supabase, {
    action: "material.upload",
    resourceType: "course_material",
    resourceId: data.id,
    after: { title: data.title, visibility: rest.visibility, course_id },
  });

  revalidatePath(`/admin/courses/${course_id}`);
  revalidatePath("/teacher/classes");
  return { success: `Đã tải lên "${data.title}".` };
}

export async function updateMaterialAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");

  const id = formData.get("id");
  const courseId = formData.get("course_id");
  if (typeof id !== "string" || typeof courseId !== "string") {
    return { error: "Thiếu thông tin tài liệu." };
  }

  const parsed = materialUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("course_materials")
    .select("title, visibility")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("course_materials")
    .update(parsed.data)
    .eq("id", id)
    .select("id, title, visibility")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  // Đổi `visibility` là đổi việc học viên có đọc được tài liệu hay không → phải
  // có vết. Đây đúng loại thay đổi mà sau này người ta sẽ hỏi "ai mở cái này ra?".
  await logAudit(supabase, {
    action: "material.update",
    resourceType: "course_material",
    resourceId: id,
    before,
    after: { title: data.title, visibility: data.visibility },
  });

  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/teacher/classes");
  return { success: "Đã lưu thay đổi." };
}

export async function deleteMaterialAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");

  const id = formData.get("id");
  const courseId = formData.get("course_id");
  if (typeof id !== "string" || typeof courseId !== "string") {
    return { error: "Thiếu thông tin tài liệu." };
  }

  const supabase = await createClient();

  const { data: material } = await supabase
    .from("course_materials")
    .select("title, object_path")
    .eq("id", id)
    .maybeSingle();

  if (!material) return { error: "Không tìm thấy tài liệu." };

  // Xóa metadata TRƯỚC, file SAU. Làm ngược lại: nếu xóa file xong mà xóa row
  // lỗi, học viên vẫn thấy tài liệu trong danh sách nhưng bấm vào là hỏng — tệ
  // hơn nhiều so với việc còn sót một file không ai trỏ tới.
  const { error } = await supabase
    .from("course_materials")
    .delete()
    .eq("id", id);

  if (error) return { error: dbErrorToMessage(error) };

  const { error: storageError } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .remove([material.object_path]);

  if (storageError) {
    console.error(
      "[storage] xóa file thất bại:",
      material.object_path,
      storageError.message,
    );
  }

  await logAudit(supabase, {
    action: "material.delete",
    resourceType: "course_material",
    resourceId: id,
    before: { title: material.title },
  });

  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/teacher/classes");
  return { success: `Đã xóa "${material.title}".` };
}

/**
 * Liên kết tải xuống có hạn cho một tài liệu.
 *
 * Cho cả 3 role — nhưng KHÔNG phải ai gọi cũng tải được, và phân quyền không nằm
 * ở đây. Hai lớp DB quyết định:
 *   1. đọc row `course_materials` — RLS: học viên không thấy row `staff_only`
 *      → `maybeSingle()` trả null → coi như không tồn tại.
 *   2. ký URL — policy SELECT của storage soi lại đúng điều kiện đó một lần nữa.
 *
 * `download: <tên file>` ép `Content-Disposition: attachment` → trình duyệt tải
 * về chứ không mở inline, và người dùng nhận được tên tử tế thay vì `<uuid>.pdf`.
 */
export async function getMaterialDownloadUrlAction(
  materialId: string,
): Promise<{ error: string } | { url: string }> {
  await requireUser();

  if (!z.uuid().safeParse(materialId).success) {
    return { error: "Tài liệu không hợp lệ." };
  }

  const supabase = await createClient();

  const { data: material } = await supabase
    .from("course_materials")
    .select("title, object_path")
    .eq("id", materialId)
    .maybeSingle();

  if (!material) return { error: "Không tìm thấy tài liệu." };

  const ext = fileExtension(material.object_path);

  const { data, error } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .createSignedUrl(material.object_path, SIGNED_URL_TTL_SECONDS, {
      download: ext ? sanitizeDownloadName(material.title, ext) : true,
    });

  if (error || !data) {
    return { error: "Không tạo được liên kết tải xuống." };
  }

  return { url: data.signedUrl };
}
