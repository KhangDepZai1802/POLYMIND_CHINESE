import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createQuestionAudioUploadUrlAction,
  refresh,
  saveQuestionAction,
  uploadToSignedUrl,
} = vi.hoisted(() => ({
  createQuestionAudioUploadUrlAction: vi.fn(),
  refresh: vi.fn(),
  saveQuestionAction: vi.fn(),
  uploadToSignedUrl: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/question-bank/server/actions", () => ({
  createQuestionAudioUploadUrlAction,
  saveQuestionAction,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: { from: () => ({ uploadToSignedUrl }) },
  }),
}));

import { QuestionWizard } from "@/features/question-bank/components/question-wizard";

describe("QuestionWizard edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveQuestionAction.mockResolvedValue({ success: "Đã cập nhật câu hỏi." });
    createQuestionAudioUploadUrlAction.mockResolvedValue({
      path: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.mp3",
      token: "signed-upload-token",
      contentType: "audio/mpeg",
    });
    uploadToSignedUrl.mockResolvedValue({ error: null });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:question-audio"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("nạp lại đầy đủ đáp án/cấu hình cũ và lưu câu hiện tại", async () => {
    const user = userEvent.setup();

    render(
      <QuestionWizard
        version={{
          questionId: "46000000-0000-0000-0000-000000000001",
          sourceVersionId: "47000000-0000-0000-0000-000000000001",
          skill: "reading",
          type: "multiple_choice",
          title: "Chọn nghĩa đúng",
          difficulty: "hard",
          prompt: "你好 nghĩa là gì?",
          explanation: "你好 là xin chào.",
          choices: [
            { key: "1", content: "Tạm biệt" },
            { key: "2", content: "Xin chào" },
            { key: "3", content: "Cảm ơn" },
          ],
          answerKey: { values: ["2"] },
          gradingConfig: {
            scoring_mode: "partial_credit",
            wrong_selection_zero: true,
          },
          promptContent: {},
          hasAudio: false,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));

    expect(screen.getByLabelText("Độ khó")).toHaveValue("hard");
    expect(screen.getByLabelText("Đáp án đúng 1")).not.toBeChecked();
    expect(screen.getByLabelText("Đáp án đúng 2")).toBeChecked();
    expect(screen.getByLabelText(/Chấm một phần/)).toBeChecked();
    expect(screen.getByLabelText(/Chọn sai bất kỳ đáp án nào/)).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await user.click(screen.getByRole("button", { name: "Lưu chỉnh sửa" }));

    await waitFor(() => expect(saveQuestionAction).toHaveBeenCalledOnce());
    const submitted = saveQuestionAction.mock.calls[0]![1] as FormData;
    expect(submitted.get("question_id")).toBe(
      "46000000-0000-0000-0000-000000000001",
    );
    expect(submitted.get("difficulty")).toBe("hard");
    expect(JSON.parse(String(submitted.get("content")))).toMatchObject({
      correctIndexes: [1],
      partialCredit: true,
      wrongSelectionZero: true,
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("upload MP3 lớn trực tiếp lên Storage rồi chỉ gửi object path khi lưu", async () => {
    const user = userEvent.setup();
    render(
      <QuestionWizard
        version={{
          questionId: "46000000-0000-4000-8000-000000000001",
          sourceVersionId: "47000000-0000-4000-8000-000000000001",
          skill: "listening",
          type: "listening_choice",
          title: "Nghe và chọn",
          difficulty: "medium",
          prompt: "Bạn nghe thấy từ nào?",
          explanation: "",
          choices: [
            { key: "1", content: "你好" },
            { key: "2", content: "再见" },
          ],
          answerKey: { value: "1" },
          gradingConfig: {},
          promptContent: { max_plays: 2 },
          hasAudio: false,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    const mp3 = new File([new Uint8Array(1_200_000)], "bai-nghe.mp3", {
      type: "audio/mpeg",
    });
    await user.upload(screen.getByLabelText("Chọn file audio"), mp3);
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await user.click(screen.getByRole("button", { name: "Lưu chỉnh sửa" }));

    await waitFor(() => expect(saveQuestionAction).toHaveBeenCalledOnce());
    expect(createQuestionAudioUploadUrlAction).toHaveBeenCalledWith({
      fileName: "bai-nghe.mp3",
      mimeType: "audio/mpeg",
      sizeBytes: 1_200_000,
    });
    expect(uploadToSignedUrl).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.mp3",
      "signed-upload-token",
      mp3,
      { contentType: "audio/mpeg" },
    );
    const submitted = saveQuestionAction.mock.calls[0]![1] as FormData;
    expect(submitted.get("audio")).toBeNull();
    expect(submitted.get("audio_object_path")).toBe(
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.mp3",
    );
  });

  it("dùng cùng luồng upload MP3 khi soạn câu hỏi mới", async () => {
    const user = userEvent.setup();
    render(<QuestionWizard />);

    await user.click(screen.getByRole("button", { name: "Tạo câu hỏi" }));
    await user.click(screen.getByRole("button", { name: /^Nghe/ }));
    await user.click(
      screen.getByRole("button", { name: /^Nghe và chọn đáp án/ }),
    );
    await user.type(screen.getByLabelText("Tiêu đề nội bộ"), "Câu nghe mới");
    await user.type(
      screen.getByPlaceholderText(/Nhập đề bài/),
      "Bạn nghe thấy từ nào?",
    );
    await user.type(screen.getByPlaceholderText("Lựa chọn 1"), "你好");
    await user.type(screen.getByPlaceholderText("Lựa chọn 2"), "再见");
    await user.upload(
      screen.getByLabelText("Chọn file audio"),
      new File([new Uint8Array(32)], "cau-moi.mp3", { type: "audio/mpeg" }),
    );
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await user.click(screen.getByRole("button", { name: "Lưu & công bố" }));

    await waitFor(() => expect(saveQuestionAction).toHaveBeenCalledOnce());
    const submitted = saveQuestionAction.mock.calls[0]![1] as FormData;
    expect(submitted.get("mode")).toBe("create");
    expect(submitted.get("question_id")).toBeNull();
    expect(submitted.get("audio_object_path")).toBe(
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.mp3",
    );
  });

  it("hiện lại audio đã lưu khi mở chỉnh sửa", async () => {
    const user = userEvent.setup();
    render(
      <QuestionWizard
        version={{
          questionId: "46000000-0000-4000-8000-000000000002",
          sourceVersionId: "47000000-0000-4000-8000-000000000002",
          skill: "listening",
          type: "dictation",
          title: "Nghe chép chính tả",
          difficulty: "easy",
          prompt: "Nghe và nhập lại câu.",
          explanation: "",
          choices: [],
          answerKey: { accepted: ["你好"] },
          gradingConfig: {},
          promptContent: { max_plays: 2 },
          hasAudio: true,
          audioUrl: "https://storage.test/signed-audio.mp3",
          audioFileName: "Audio hiện tại đã lưu",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    expect(document.querySelector("audio")).toHaveAttribute(
      "src",
      "https://storage.test/signed-audio.mp3",
    );
    expect(screen.getByText("Audio: Audio hiện tại đã lưu")).toBeVisible();
  });
});
