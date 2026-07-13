/**
 * ⚠️  FILE NÀY ĐƯỢC SINH TỰ ĐỘNG — ĐỪNG SỬA TAY.
 *
 *     npm run db:types
 *     (= supabase gen types typescript --local > src/types/database.ts)
 *
 * Đây là bản TẠM của Phase 1, chỉ đủ để TypeScript biên dịch trước khi có
 * migration. Phase 2 (P2-T17) sẽ ghi đè bằng bản generate thật từ schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: "super_admin" | "teacher" | "student";
          full_name: string;
          phone: string | null;
          avatar_path: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: "super_admin" | "teacher" | "student";
          full_name: string;
          phone?: string | null;
          avatar_path?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: "super_admin" | "teacher" | "student";
          full_name?: string;
          phone?: string | null;
          avatar_path?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      user_role: "super_admin" | "teacher" | "student";
    };
    CompositeTypes: Record<never, never>;
  };
};
