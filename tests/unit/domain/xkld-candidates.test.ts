import { describe, it, expect } from "vitest";
import { candidateSchema, candidateFiltersSchema, canReadXkld, canEditXkld } from "@/features/xkld/domain/candidates";
const input = { id: "", create_request_id: "60000000-0000-4000-8000-000000000010", updated_at: "", full_name: " Nguyễn An ", date_of_birth: "2000-01-01", phone: "0901234567", zalo: "", hometown: "Đồng Nai", education: "THPT", occupation: "Cơ khí", health_status: "passed", source: "collaborator", assignee_id: "60000000-0000-4000-8000-000000000001" };
describe("XKLĐ candidates", () => {
  it("accepts all requested fields and normalizes text", () => {
    const parsed = candidateSchema.parse(input);
    expect(parsed.full_name).toBe("Nguyễn An");
    expect(parsed.zalo).toBeNull();
    expect(candidateSchema.safeParse({ ...input, phone: "+84901234567" }).success).toBe(true);
  });
  it("rejects invalid data, fake owners and missing edit version", () => {
    for (const change of [{ full_name: " " }, { date_of_birth: "2999-01-01" }, { date_of_birth: "2000-02-30" }, { phone: "123" }, { source: "other" }, { health_status: "unknown" }, { assignee_id: "someone" }, { id: input.assignee_id, updated_at: "" }]) expect(candidateSchema.safeParse({ ...input, ...change }).success).toBe(false);
  });
  it("validates server-side filters and pagination bounds", () => {
    expect(candidateFiltersSchema.parse({}).page).toBe(0);
    for (const change of [{ page: -1 }, { page: "oops" }, { assignee: "someone" }, { source: "unknown" }, { q: "a".repeat(201) }]) expect(candidateFiltersSchema.safeParse(change).success).toBe(false);
  });
  it("restricts editing and keeps unrelated staff out", () => {
    expect(canReadXkld("executive")).toBe(true);
    expect(canEditXkld("executive")).toBe(false);
    for (const role of ["super_admin", "xkld_staff"] as const) expect(canEditXkld(role)).toBe(true);
    for (const role of ["academic_manager", "center_manager", "consultant", "teacher", "student"] as const) expect(canReadXkld(role)).toBe(false);
  });
});
