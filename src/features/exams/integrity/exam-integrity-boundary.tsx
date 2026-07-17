"use client";

import { useEffect } from "react";
import { logExamEvent } from "@/features/exams/server/actions";

export function ExamIntegrityBoundary({
  attemptId,
  children,
}: {
  attemptId: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const block = (event: Event, type: string) => {
      const input = event as InputEvent;
      if (input.isComposing) return;
      event.preventDefault();
      void logExamEvent(attemptId, type);
    };
    const copy = (e: Event) => block(e, "copy_blocked"),
      cut = (e: Event) => block(e, "cut_blocked"),
      paste = (e: Event) => block(e, "paste_blocked"),
      drop = (e: Event) => block(e, "paste_blocked"),
      context = (e: Event) => e.preventDefault();
    const before = (e: Event) => {
      const input = e as InputEvent;
      if (
        !input.isComposing &&
        ["insertFromPaste", "insertFromDrop"].includes(input.inputType)
      )
        block(e, "paste_blocked");
    };
    const visibility = () =>
      void logExamEvent(
        attemptId,
        document.hidden ? "tab_hidden" : "window_focused",
      );
    const blur = () => void logExamEvent(attemptId, "window_blurred");
    const online = () => void logExamEvent(attemptId, "network_online");
    const offline = () => void logExamEvent(attemptId, "network_offline");
    document.addEventListener("copy", copy);
    document.addEventListener("cut", cut);
    document.addEventListener("paste", paste);
    document.addEventListener("drop", drop);
    document.addEventListener("contextmenu", context);
    document.addEventListener("beforeinput", before);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      document.removeEventListener("copy", copy);
      document.removeEventListener("cut", cut);
      document.removeEventListener("paste", paste);
      document.removeEventListener("drop", drop);
      document.removeEventListener("contextmenu", context);
      document.removeEventListener("beforeinput", before);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [attemptId]);
  return <div className="select-none">{children}</div>;
}
