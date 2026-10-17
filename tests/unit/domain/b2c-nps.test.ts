import { expect, it } from "vitest";
import { npsGroup, npsResponseSchema } from "@/features/b2c/domain/nps";
it("classifies all NPS boundaries", () => {
  expect(npsGroup(0)).toBe("Chưa hài lòng"); expect(npsGroup(6)).toBe("Chưa hài lòng");
  expect(npsGroup(7)).toBe("Trung lập"); expect(npsGroup(8)).toBe("Trung lập");
  expect(npsGroup(9)).toBe("Sẵn lòng giới thiệu"); expect(npsGroup(10)).toBe("Sẵn lòng giới thiệu");
  for (const score of [-1, 11, 5.5, NaN]) expect(() => npsGroup(score)).toThrow();
});
it("requires an explicit integer score including zero and bounds feedback", () => {
  const form = { token: "a".repeat(64), request_id: "17600000-0000-4000-8000-000000000060", reason: "", teacher_feedback: "", service_feedback: "" };
  expect(npsResponseSchema.safeParse(form).success).toBe(false);
  expect(npsResponseSchema.safeParse({ ...form, score: null }).success).toBe(false);
  expect(npsResponseSchema.parse({ ...form, score: 0 }).score).toBe(0);
  expect(npsResponseSchema.safeParse({ ...form, score: 5.5 }).success).toBe(false);
  expect(npsResponseSchema.safeParse({ ...form, score: 10, reason: "x".repeat(2001) }).success).toBe(false);
  expect(npsResponseSchema.safeParse({ ...form, score: 10, token: "guess" }).success).toBe(false);
});
