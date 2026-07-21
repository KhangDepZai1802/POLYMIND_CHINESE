import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMyWrongAnswerReviews } from "@/features/wrong-answer-review/server/queries";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/supabase/signed-urls";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/signed-urls", () => ({ signPaths: vi.fn() }));

describe("getMyWrongAnswerReviews", () => {
  const rpc = vi.fn();
  const eq = vi.fn();
  const inFilter = vi.fn(() => ({ eq }));
  const select = vi.fn(() => ({ in: inFilter }));
  const from = vi.fn(() => ({ select }));

  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({
      data: [
        {
          queue_id: "11111111-1111-4111-8111-111111111111",
          question_version_id: "22222222-2222-4222-8222-222222222222",
          question_type: "listening_choice",
          prompt: "Bạn nghe thấy từ nào?",
          prompt_content: {},
          options: [
            { option_key: "a", content: "你好" },
            { option_key: "b", content: "谢谢" },
          ],
          source_kind: "exam",
          wrong_count: 2,
          first_seen_at: "2026-07-20T00:00:00Z",
          last_seen_at: "2026-07-21T00:00:00Z",
        },
      ],
      error: null,
    });
    eq.mockResolvedValue({
      data: [
        {
          question_version_id: "22222222-2222-4222-8222-222222222222",
          object_path: "teacher/listening.mp3",
          media_role: "prompt_audio",
        },
      ],
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue({ rpc, from } as never);
    vi.mocked(signPaths).mockResolvedValue(
      new Map([["teacher/listening.mp3", "https://signed.test/listening.mp3"]]),
    );
  });

  it("lấy payload đã lọc qua RPC và ký audio theo lô", async () => {
    const result = await getMyWrongAnswerReviews();

    expect(rpc).toHaveBeenCalledWith("get_my_wrong_answer_reviews");
    expect(from).toHaveBeenCalledWith("question_media");
    expect(inFilter).toHaveBeenCalledWith("question_version_id", [
      "22222222-2222-4222-8222-222222222222",
    ]);
    expect(signPaths).toHaveBeenCalledWith(
      expect.anything(),
      "question-media",
      ["teacher/listening.mp3"],
      900,
    );
    expect(result[0]?.prompt_content.audio_url).toBe(
      "https://signed.test/listening.mp3",
    );
    expect(result[0]).not.toHaveProperty("answer_key");
  });
});
