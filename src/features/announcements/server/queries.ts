import "server-only";

import type {
  AnnouncementClassOption,
  AnnouncementRecord,
} from "@/features/announcements/types";
import { createClient } from "@/lib/supabase/server";

export async function getAnnouncements(): Promise<AnnouncementRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(
      `id, class_id, title, body, published_at, expires_at, created_at,
       class:classes (id, code, name)`,
    )
    .order("created_at", { ascending: false });

  if (error)
    throw new Error(`Không tải được thông báo chung: ${error.message}`);
  return data;
}

export async function getAnnouncementClassOptions(): Promise<
  AnnouncementClassOption[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, code, name, status")
    .order("code");

  if (error) {
    throw new Error(`Không tải được phạm vi lớp: ${error.message}`);
  }
  return data;
}
