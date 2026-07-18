import { Lightbulb } from "lucide-react";

type Module = "exercises" | "exams";
type Step = 1 | 2 | 3;

/**
 * Dải gợi ý ngắn đặt dưới thanh tab để giáo viên biết đang ở bước nào trong
 * luồng ① Ngân hàng câu hỏi → ② Bộ → ③ Giao, và bước tiếp theo là gì.
 * Chỉ là hướng dẫn tĩnh — không phân quyền, không gọi dữ liệu.
 */
const HINTS: Record<Module, Record<Step, string>> = {
  exercises: {
    1: "Tạo và quản lý từng câu hỏi ở đây. Xong hãy sang bước ② Bộ bài tập để ghép các câu thành một bài.",
    2: "Ghép các câu đã tạo thành một bộ, sắp thứ tự rồi khóa bộ lại. Sau đó sang bước ③ Giao cho lớp.",
    3: "Chọn một bộ bài tập đã khóa và giao cho lớp của bạn kèm hạn nộp và cách chấm.",
  },
  exams: {
    1: "Tạo và quản lý từng câu hỏi ở đây. Xong hãy sang bước ② Bộ đề để ghép các câu thành một đề.",
    2: "Ghép các câu đã tạo thành một đề, sắp thứ tự rồi khóa đề lại. Sau đó sang bước ③ Lên lịch thi.",
    3: "Chọn một đề đã khóa và lên lịch thi cho lớp của bạn kèm thời gian và cách chấm.",
  },
};

export function StepHint({ module, step }: { module: Module; step: Step }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <p className="text-foreground/80">
        <span className="font-semibold text-foreground">Bước {step}/3.</span>{" "}
        {HINTS[module][step]}
      </p>
    </div>
  );
}
