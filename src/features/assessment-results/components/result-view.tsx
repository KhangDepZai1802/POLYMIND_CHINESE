import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Result = {
  status: string;
  raw_score: number | null;
  final_score: number | null;
  published_at: string;
  answers: Array<{
    set_item_id: string;
    answer: unknown;
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
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <div>
            <p className="text-muted-foreground text-sm">Điểm chính thức</p>
            <p className="text-3xl font-bold">
              {result.final_score ?? "—"}{kind === "exam" ? "/100" : ""}
            </p>
          </div>
          <Badge>{result.status}</Badge>
          <p className="text-muted-foreground text-sm">
            Công bố {new Date(result.published_at).toLocaleString("vi-VN")}
          </p>
        </CardContent>
      </Card>
      {(result.answers ?? []).map((answer, index) => (
        <Card key={answer.set_item_id}>
          <CardHeader>
            <CardTitle className="text-base">
              Câu {index + 1} · {answer.score ?? 0} điểm
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ResultBlock title="Bài làm" value={answer.answer} />
            {answer.answer_key !== null && (
              <ResultBlock title="Đáp án" value={answer.answer_key} />
            )}
            {answer.feedback && (
              <div>
                <p className="mb-1 text-sm font-medium">Nhận xét</p>
                <p className="text-sm">{answer.feedback}</p>
              </div>
            )}
            {answer.explanation && (
              <div>
                <p className="mb-1 text-sm font-medium">Giải thích</p>
                <p className="text-sm">{answer.explanation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ResultBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="mb-1 text-sm font-medium">{title}</p>
      <pre className="font-sans text-sm whitespace-pre-wrap break-words">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
