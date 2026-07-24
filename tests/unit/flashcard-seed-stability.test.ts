import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `BUG-P16-001` — `seed.sql` để Postgres sinh `courses.id`, nên UUID của
 * `VCB-BANK` đổi sau mỗi `db reset`. Phase 16 từng ghim UUID của một lần reset
 * vào cả `seed.dev.sql` lẫn E2E: seed mới dừng ở FK, còn suite chỉ chạy được
 * trên database cũ. Đây là đúng regression mà `DS-040` cấm.
 */
describe("BUG-P16-001 — fixture Flashcard sống qua db reset", () => {
  const legacyCourseId = "7f1469bc-900b-405a-9e4e-501cd4c23c67";
  const seedDev = readFileSync(
    join(process.cwd(), "supabase", "seed.dev.sql"),
    "utf8",
  );
  const flashcardE2e = readFileSync(
    join(process.cwd(), "tests", "e2e", "flashcard-responsive.spec.ts"),
    "utf8",
  );

  it("không ghim UUID course sinh động vào seed dev hoặc E2E", () => {
    expect(seedDev).not.toContain(legacyCourseId);
    expect(flashcardE2e).not.toContain(legacyCourseId);
  });

  it("tra VCB-BANK bằng khóa nghiệp vụ ổn định", () => {
    expect(seedDev).toContain(
      "(select id from public.courses where code = 'VCB-BANK')",
    );
    expect(flashcardE2e).toContain('requiredCourseId("VCB-BANK")');
  });
});
