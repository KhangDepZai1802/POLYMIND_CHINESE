import { beforeEach, describe, expect, it, vi } from "vitest";

import { submitWrongAnswerReviewAction } from "@/features/wrong-answer-review/server/actions";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

describe("submitWrongAnswerReviewAction", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    vi.mocked(createClient).mockResolvedValue({ rpc } as never);
  });

  it("không nhận điểm từ client và chuyển nguyên answer payload cho RPC DB chấm", async () => {
    rpc.mockResolvedValue({
      data: { is_correct: true, score: 1, resolved: true },
      error: null,
    });

    const result = await submitWrongAnswerReviewAction({
      queueId: "11111111-1111-4111-8111-111111111111",
      answerPayload: { value: "a" },
      score: 999,
      isCorrect: true,
    });

    expect(requireRole).toHaveBeenCalledWith("student");
    expect(rpc).toHaveBeenCalledWith("submit_wrong_answer_review", {
      p_queue_id: "11111111-1111-4111-8111-111111111111",
      p_answer_payload: { value: "a" },
    });
    expect(result).toMatchObject({ isCorrect: true, score: 1 });
  });
});
