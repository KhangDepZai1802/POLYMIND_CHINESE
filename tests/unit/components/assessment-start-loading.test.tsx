import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startExamAction, startExerciseAction } = vi.hoisted(() => ({
  startExamAction: vi.fn(),
  startExerciseAction: vi.fn(),
}));

vi.mock("@/features/exams/server/actions", () => ({ startExamAction }));
vi.mock("@/features/exercises/server/actions", () => ({ startExerciseAction }));

import { ExamWaitingRoom } from "@/features/exams/student/exam-waiting-room";
import { StudentExerciseList } from "@/features/exercises/student/exercise-list";

class FakeAudioContext {
  currentTime = 0;

  createOscillator() {
    return {
      frequency: { value: 0 },
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createGain() {
    return {
      gain: { value: 0 },
      connect: vi.fn().mockReturnThis(),
    };
  }

  get destination() {
    return {} as AudioDestinationNode;
  }
}

describe("loading khi bắt đầu lượt làm", () => {
  beforeEach(() => {
    startExamAction.mockReset();
    startExerciseAction.mockReset();
    startExamAction.mockImplementation(
      () => new Promise<void>(() => undefined),
    );
    startExerciseAction.mockImplementation(
      () => new Promise<void>(() => undefined),
    );
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("khóa nút và hiện loading ngay khi bắt đầu bài tập", async () => {
    const user = userEvent.setup();
    render(
      <StudentExerciseList
        deliveries={[
          {
            id: "exercise-delivery-1",
            title: "Bài luyện tập",
            instructions: null,
            status: "published",
            available_from: "2026-07-20T00:00:00Z",
            due_at: "2099-07-21T00:00:00Z",
            max_score: 10,
            attempt_limit: 1,
            allow_late_submission: false,
            class: { code: "LOP-01", name: "HSK 1" },
            attempts: [],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Bắt đầu làm" }));

    const pendingButton = screen.getByRole("button", {
      name: "Đang mở bài tập…",
    });
    expect(pendingButton).toBeDisabled();
    expect(startExerciseAction).toHaveBeenCalledOnce();
  });

  it("khóa nút và hiện loading ngay khi bắt đầu bài thi", async () => {
    const user = userEvent.setup();
    render(
      <ExamWaitingRoom
        deliveryId="exam-delivery-1"
        canStart
        requiresMicrophone={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Vào phòng chờ" }));
    expect(
      screen.getByRole("heading", { name: "1. Kiểm tra âm thanh", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "2. Xác nhận quy định", level: 3 }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Phát âm thanh kiểm tra" }),
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Bắt đầu thi" }));

    const pendingButton = screen.getByRole("button", {
      name: "Đang mở bài thi…",
    });
    expect(pendingButton).toBeDisabled();
    expect(startExamAction).toHaveBeenCalledOnce();
  });
});
