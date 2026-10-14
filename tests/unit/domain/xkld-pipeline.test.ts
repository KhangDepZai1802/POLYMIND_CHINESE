import { describe, it, expect } from "vitest";
import {
  STAGE_CODES,
  PIPELINE_STAGES,
  transitionSchema,
  pipelineFiltersSchema,
  allowedPipelineStage,
} from "@/features/xkld/domain/pipeline";
const id = "72000000-0000-4000-8000-000000000001";
const input = {
  candidate_id: id,
  stage: "consultation",
  order_id: "",
  b2c_class_id: "",
  expected_updated_at: "2026-10-14T00:00:00.123456+00:00",
  request_id: id,
  note: " note ",
};
describe("XKLĐ pipeline", () => {
  it("preserves the ten stages in the requested order", () => {
    expect(STAGE_CODES).toHaveLength(10);
    expect(STAGE_CODES.map((s) => PIPELINE_STAGES[s])).toEqual([
      "Lead",
      "Tư vấn",
      "Đăng ký/đặt cọc",
      "Đào tạo ngoại ngữ",
      "Hoàn thiện hồ sơ",
      "Phỏng vấn",
      "Trúng tuyển",
      "Visa/giấy phép",
      "Xuất cảnh",
      "Hậu xuất cảnh",
    ]);
  });
  it("allows sequential progress and rollback only with a reason", () => {
    expect(allowedPipelineStage("lead", "consultation", "")).toBe(true);
    expect(allowedPipelineStage("lead", "visa", "skip")).toBe(false);
    expect(allowedPipelineStage("visa", "interview", "")).toBe(false);
    expect(allowedPipelineStage("visa", "interview", "Làm lại phỏng vấn")).toBe(
      true,
    );
  });
  it("requires a class from training and an order from interview", () => {
    expect(
      transitionSchema.safeParse({ ...input, stage: "language_training" })
        .success,
    ).toBe(false);
    expect(
      transitionSchema.safeParse({
        ...input,
        stage: "language_training",
        b2c_class_id: id,
      }).success,
    ).toBe(true);
    expect(
      transitionSchema.safeParse({
        ...input,
        stage: "interview",
        b2c_class_id: id,
      }).success,
    ).toBe(false);
    expect(
      transitionSchema.safeParse({
        ...input,
        stage: "aftercare",
        b2c_class_id: id,
        order_id: id,
      }).success,
    ).toBe(true);
  });
  it("rejects forged IDs and bounds search/pagination", () => {
    expect(transitionSchema.parse(input)).toMatchObject({
      note: "note",
      order_id: null,
    });
    for (const v of [
      { candidate_id: "x" },
      { expected_updated_at: "" },
      { note: "a".repeat(2001) },
      { stage: "other" },
    ])
      expect(transitionSchema.safeParse({ ...input, ...v }).success).toBe(
        false,
      );
    for (const v of [
      { page: -1 },
      { stage: "other" },
      { assignee: "x" },
      { q: "a".repeat(201) },
    ])
      expect(pipelineFiltersSchema.safeParse(v).success).toBe(false);
  });
});
