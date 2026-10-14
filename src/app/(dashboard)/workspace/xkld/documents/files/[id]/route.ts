import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { XKLD_READ_ROLES } from "@/features/xkld/domain/candidates";
import {
  DOCUMENT_BUCKET,
  type DocumentFile,
} from "@/features/xkld/domain/documents";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole(...XKLD_READ_ROLES);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Không tìm thấy tệp.", { status: 404 });
  const client = await createClient();
  const { data, error } = await client.rpc("xkld_documents_command", {
    p_action: "download",
    p_data: { id },
  });
  const file = data as unknown as DocumentFile;
  if (error || !file?.storage_path)
    return new Response("Không tìm thấy tệp.", { status: 404 });
  const object = await client.storage
    .from(DOCUMENT_BUCKET)
    .download(file.storage_path);
  if (object.error || !object.data)
    return new Response("Không tải được tệp.", { status: 404 });
  return new Response(object.data, {
    headers: {
      "Content-Type": file.mime_type,
      "Content-Disposition": `attachment; filename="document.${file.mime_type === "application/pdf" ? "pdf" : file.mime_type === "image/png" ? "png" : "jpg"}"; filename*=UTF-8''${encodeURIComponent(file.file_name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
