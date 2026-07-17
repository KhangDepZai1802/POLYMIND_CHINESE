import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { logExamEvent } = vi.hoisted(() => ({
  logExamEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/exams/server/actions", () => ({ logExamEvent }));

import { ExamIntegrityBoundary } from "@/features/exams/integrity/exam-integrity-boundary";

describe("ExamIntegrityBoundary", () => {
  beforeEach(() => logExamEvent.mockClear());

  it.each(["copy", "cut", "paste", "drop"])("chặn %s và chỉ log loại sự kiện", async (type) => {
    render(<ExamIntegrityBoundary attemptId="attempt-1"><input aria-label="answer" /></ExamIntegrityBoundary>);
    const event = new Event(type, { bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(logExamEvent).toHaveBeenCalledWith("attempt-1", type === "drop" ? "paste_blocked" : `${type}_blocked`));
    expect(logExamEvent.mock.calls[0]).toHaveLength(2);
  });

  it("không chặn sự kiện trong lúc IME đang composition", () => {
    render(<ExamIntegrityBoundary attemptId="attempt-2"><input aria-label="中文答案" /></ExamIntegrityBoundary>);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "isComposing", { value: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(logExamEvent).not.toHaveBeenCalled();
  });
});
