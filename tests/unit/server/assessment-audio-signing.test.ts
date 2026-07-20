import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  signAttemptPayloadAudio,
  signGradingAudio,
  signPublishedResultAudio,
} from "@/features/assessment-results/server/audio-signing";

const media = [
  { question_version_id: "version-listening", object_path: "teacher/listening.mp3" },
];

function createSupabaseMock() {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    eq: vi.fn(async () => ({ data: media })),
  };
  // Mô phỏng đúng API batch của Supabase Storage: nhận mảng path, trả mảng
  // { path, signedUrl, error } — một request cho nhiều file.
  const createSignedUrls = vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({
      path,
      signedUrl: `https://signed.test/${path}`,
      error: null,
    })),
    error: null,
  }));

  return {
    from: vi.fn(() => query),
    storage: { from: vi.fn(() => ({ createSignedUrls })) },
    createSignedUrls,
  };
}

describe("assessment audio signing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ký đủ audio đề và bài Nói ở lượt làm, màn chấm và kết quả", async () => {
    const mock = createSupabaseMock();
    const supabase = mock as never;

    const attempt = {
      items: [
        {
          question: {
            id: "version-listening",
            type: "listening_choice",
            prompt_content: { hint: "Nghe kỹ" },
          },
          answer: { value: "1" },
        },
        {
          question: { id: "version-speaking", type: "speaking", prompt_content: {} },
          answer: { audio_path: "student/attempt.webm" },
        },
      ],
    };
    await signAttemptPayloadAudio(supabase, attempt);
    expect(attempt).toMatchObject({
      items: [
        {
          question: {
            prompt_content: {
              hint: "Nghe kỹ",
              audio_url: "https://signed.test/teacher/listening.mp3",
            },
          },
        },
        {
          answer: {
            audio_path: "student/attempt.webm",
            audio_url: "https://signed.test/student/attempt.webm",
          },
        },
      ],
    });

    const grading = {
      attempts: [{
        answers: [
          {
            answer_payload: { value: "1" },
            item: {
              question_version: {
                id: "version-listening",
                question_type: "listening_choice",
              },
            },
          },
          {
            answer_payload: { audio_path: "student/grading.webm" },
            item: {
              question_version: { id: "version-speaking", question_type: "speaking" },
            },
          },
        ],
      }],
    };
    await signGradingAudio(supabase, grading);
    expect(grading).toMatchObject({
      attempts: [{
        answers: [
          { prompt_audio_url: "https://signed.test/teacher/listening.mp3" },
          { audio_url: "https://signed.test/student/grading.webm" },
        ],
      }],
    });

    const result = {
      answers: [
        {
          question_version_id: "version-listening",
          question_type: "dictation",
          answer: { text: "你好" },
        },
        {
          question_version_id: "version-speaking",
          question_type: "speaking",
          answer: { audio_path: "student/result.webm" },
        },
      ],
    };
    await signPublishedResultAudio(supabase, result);
    expect(result).toMatchObject({
      answers: [
        { prompt_audio_url: "https://signed.test/teacher/listening.mp3" },
        { audio_url: "https://signed.test/student/result.webm" },
      ],
    });
  });

  // Chống tái phát N+1: màn chấm một lớp đông phải ký theo LÔ, không phải một
  // request mỗi bản ghi. Nếu ai đó quay lại createSignedUrl (số ít), test này đỏ.
  it("ký theo lô — số request không tăng theo số bản ghi", async () => {
    const mock = createSupabaseMock();

    const answers: Array<{
      answer_payload: { audio_path: string };
      item: { question_version: { id: string; question_type: string } };
      audio_url?: string | null;
    }> = Array.from({ length: 30 }, (_, i) => ({
      answer_payload: { audio_path: `student/speaking-${i}.webm` },
      item: {
        question_version: { id: `version-${i}`, question_type: "speaking" },
      },
    }));

    await signGradingAudio(mock as never, { attempts: [{ answers }] });

    // 30 bản ghi Nói + audio đề → vẫn chỉ là số request cố định, không phải 30.
    expect(mock.createSignedUrls.mock.calls.length).toBeLessThanOrEqual(2);

    const signedPaths = mock.createSignedUrls.mock.calls.flatMap(
      ([paths]) => paths,
    );
    expect(signedPaths).toContain("student/speaking-0.webm");
    expect(signedPaths).toContain("student/speaking-29.webm");
    expect(answers.at(-1)?.audio_url).toBe(
      "https://signed.test/student/speaking-29.webm",
    );
  });
});
