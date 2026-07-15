import type { Database } from "@/types/database";

export type AnnouncementRecord = Pick<
  Database["public"]["Tables"]["announcements"]["Row"],
  | "id"
  | "class_id"
  | "title"
  | "body"
  | "published_at"
  | "expires_at"
  | "created_at"
> & {
  class: { id: string; code: string; name: string } | null;
};

export type AnnouncementClassOption = Pick<
  Database["public"]["Tables"]["classes"]["Row"],
  "id" | "code" | "name" | "status"
>;
