import { CheckCircle2, MessageSquareText, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssessmentAudioPlayer } from "@/features/assessment-results/components/audio-player";

type Option = { option_key: string; content: string };
type Result = {
  status: string;
  raw_score: number | null;
  final_score: number | null;
  max_score?: number | null;
  published_at: string;
  answers: Array<{
    set_item_id: string;
    order_index?: number;
    points?: number;
    question_type?: string;
    question_version_id?: string;
    prompt_text?: string;
    prompt_content?: Record<string, unknown> | null;
    options?: Option[];
    answer: unknown;
    prompt_audio_url?: string | null;
    audio_url?: string | null;
    score: number | null;
    feedback: string | null;
    answer_key: unknown | null;
    explanation: string | null;
  }> | null;
};

export function AssessmentResultView({
  kind,
  result,
}: {
  kind: "exercise" | "exam";
  result: Result;
}) {
  const answers = [...(result.answers ?? [])].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
  );
  const maxScore = result.max_score ?? (kind === "exam" ? 100 : null);
  const percent = maxScore && result.final_score !== null
    ? Math.max(0, Math.min(100, (result.final_score / maxScore) * 100))
    : null;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Trophy className="size-6" aria-hidden />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Điểm chính thức</p>
                <p className="text-4xl font-bold tracking-tight">
                  {result.final_score ?? "—"}
                  {maxScore !== null && <span className="text-muted-foreground text-xl font-medium">/{maxScore}</span>}
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm sm:text-right">
              <Badge className="bg-emerald-600 hover:bg-emerald-600">Đã công bố kết quả</Badge>
              <p className="text-muted-foreground">
                {new Date(result.published_at).toLocaleString("vi-VN")}
              </p>
            </div>
          </div>
          {percent !== null && (
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Chi tiết từng câu</h2>
          <p className="text-muted-foreground text-sm">Xem lại bài làm, điểm và nhận xét của giáo viên.</p>
        </div>
        <Badge variant="outline">{answers.length} câu</Badge>
      </div>

      {answers.map((answer, index) => {
        const points = answer.points ?? null;
        const fullScore = points !== null && answer.score === points;
        return (
          <Card key={answer.set_item_id}>
            <CardHeader className="space-y-3 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Câu {index + 1}</CardTitle>
                <Badge variant={fullScore ? "default" : "secondary"}>
                  {answer.score === null ? "Chưa có điểm" : `${answer.score}${points !== null ? `/${points}` : ""} điểm`}
                </Badge>
              </div>
              {answer.prompt_text && <p className="whitespace-pre-wrap font-medium">{answer.prompt_text}</p>}
            </CardHeader>
            <CardContent className="space-y-4">
              {answer.prompt_audio_url && (
                <AssessmentAudioPlayer src={answer.prompt_audio_url} label="Audio đề bài" />
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <ResultBlock
                  title="Bài làm của em"
                  value={formatAnswer(answer.answer, answer.options ?? [])}
                  audioUrl={answer.audio_url}
                />
                {answer.answer_key !== null && (
                  <ResultBlock
                    title="Đáp án tham khảo"
                    value={formatAnswer(answer.answer_key, answer.options ?? [], true)}
                    correct
                  />
                )}
              </div>
              {answer.feedback && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <MessageSquareText className="size-4 text-blue-600" aria-hidden /> Nhận xét của giáo viên
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{answer.feedback}</p>
                </div>
              )}
              {answer.explanation && (
                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-sm font-medium">Giải thích</p>
                  <p className="whitespace-pre-wrap text-sm">{answer.explanation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ResultBlock({
  title,
  value,
  audioUrl,
  correct = false,
}: {
  title: string;
  value: string;
  audioUrl?: string | null;
  correct?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${correct ? "border-emerald-500/30 bg-emerald-500/5" : "bg-muted/30"}`}>
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        {correct && <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />}{title}
      </p>
      {audioUrl ? (
        <AssessmentAudioPlayer src={audioUrl} label="Bản ghi âm đã nộp" />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm">{value}</p>
      )}
    </div>
  );
}

function formatAnswer(value: unknown, options: Option[], isKey = false): string {
  if (!value || typeof value !== "object") return isKey ? "Không công bố đáp án" : "Chưa trả lời";
  const payload = value as Record<string, unknown>;
  const optionText = (key: unknown) => {
    const text = options.find((option) => option.option_key === String(key))?.content;
    if (text) return text;
    if (String(key) === "true") return "Đúng";
    if (String(key) === "false") return "Sai";
    return String(key ?? "");
  };
  if (Array.isArray(payload.values)) {
    const values = payload.values.map(optionText).filter(Boolean);
    return values.length ? values.join("; ") : "Chưa trả lời";
  }
  if (Array.isArray(payload.value)) {
    const values = payload.value.map(optionText).filter(Boolean);
    return values.length ? values.join(" → ") : "Chưa trả lời";
  }
  if (Array.isArray(payload.accepted)) return payload.accepted.map(String).join("; ");
  if (payload.value !== undefined && payload.value !== null && payload.value !== "") return optionText(payload.value);
  if (typeof payload.text === "string" && payload.text.trim()) return payload.text;
  if (payload.manual === true) return "Câu này do giáo viên đánh giá trực tiếp";
  if (typeof payload.audio_path === "string") return "Bài thu âm";
  return isKey ? "Không có đáp án mẫu" : "Chưa trả lời";
}
