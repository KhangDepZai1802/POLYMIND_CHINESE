export const PARENT_RELATIONSHIPS = ["unknown", "father", "mother", "grandparent", "guardian", "other"] as const;
export const PARENT_RELATIONSHIP_LABELS: Record<string, string> = { unknown: "Chưa xác định", father: "Cha", mother: "Mẹ", grandparent: "Ông/Bà", guardian: "Người giám hộ", other: "Khác" };
export type ParentRow = { id: string; full_name: string; phone: string | null; zalo: string | null; email?: string | null; children: { code: string; full_name: string; relationship: string }[] };
