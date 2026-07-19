import Link from "next/link";

import {
  QUESTION_TYPE_LABELS,
  SKILL_QUESTION_TYPES,
  WIZARD_SKILLS,
} from "@/features/question-builder/domain/questions";
import { QuestionWizard } from "@/features/question-bank/components/question-wizard";
import { QuestionActions } from "@/features/question-bank/components/question-actions";
import {
  getQuestions,
  type QuestionFilters,
} from "@/features/question-bank/server/queries";
import { questionPageHref } from "@/features/question-bank/domain/pagination";
import { AssessmentTabs } from "@/components/shared/assessment-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { StepHint } from "@/components/shared/step-hint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WizardSkill = (typeof WIZARD_SKILLS)[number];

/** Nhãn phạm vi tiếng Việt cho gọn và dễ hiểu (thay vì hiện raw "private"…). */
const VISIBILITY_LABELS: Record<string, string> = {
  private: "Riêng tư",
  shared: "Được chia sẻ",
  global: "Kho chung",
  pending_global_review: "Chờ duyệt",
};

/** Chỉ mở "Chỉnh sửa" qua wizard khi kỹ năng + dạng câu được wizard hỗ trợ. */
function isWizardEditable(skill: string, type: string): skill is WizardSkill {
  return (
    (WIZARD_SKILLS as readonly string[]).includes(skill) &&
    (SKILL_QUESTION_TYPES[skill as WizardSkill] as readonly string[]).includes(
      type,
    )
  );
}

export async function QuestionBankPage({
  kind,
  filters,
}: {
  kind: "exercise" | "exam";
  filters?: QuestionFilters;
}) {
  const { questions, teachers, currentUserId, count, page, totalPages } =
    await getQuestions(kind, filters);
  const basePath = `/teacher/${kind === "exercise" ? "exercises" : "exams"}/question-bank`;
  return (
    <>
      <AssessmentTabs module={kind === "exercise" ? "exercises" : "exams"} />
      <PageHeader
        title="Ngân hàng câu hỏi"
        description="Nơi tạo và quản lý từng câu hỏi. Sau khi đã có câu, sang bước ② Bộ bài tập để ghép thành bài."
        action={<QuestionWizard trigger={<Button>Tạo câu hỏi</Button>} />}
      />
      <StepHint module={kind === "exercise" ? "exercises" : "exams"} step={1} />
      <form className="mb-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_10rem_10rem_auto]">
        <Input
          name="q"
          defaultValue={filters?.q}
          placeholder="Tìm mã hoặc tiêu đề"
        />
        <select
          name="skill"
          defaultValue={filters?.skill ?? ""}
          className="bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">Mọi kỹ năng</option>
          <option value="listening">Nghe</option>
          <option value="speaking">Nói</option>
          <option value="reading">Đọc</option>
          <option value="writing">Viết</option>
          <option value="vocabulary">Từ vựng</option>
          <option value="grammar">Ngữ pháp</option>
        </select>
        <select
          name="visibility"
          defaultValue={filters?.visibility ?? ""}
          className="bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">Mọi phạm vi</option>
          <option value="private">Riêng tư</option>
          <option value="shared">Được chia sẻ</option>
          <option value="global">Kho chung</option>
          <option value="pending_global_review">Chờ duyệt</option>
        </select>
        <Button type="submit" variant="outline">
          Lọc
        </Button>
      </form>
      <Card>
        <CardContent className="p-0">
          {questions.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center">
              Chưa có câu hỏi. Tạo câu đầu tiên hoàn toàn trên web.
            </p>
          ) : (
            <ul className="divide-y">
              {questions.map((question) => (
                <li
                  key={question.id}
                  className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-muted-foreground text-xs">
                        {question.code}
                      </code>
                      <p className="truncate font-medium">{question.title}</p>
                    </div>
                    {question.current_version?.prompt_text && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
                        {question.current_version.prompt_text}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <Badge variant="outline" className="font-normal">
                      {question.current_version
                        ? QUESTION_TYPE_LABELS[
                            question.current_version.question_type
                          ]
                        : "Chưa có version"}
                    </Badge>
                    <Badge variant="secondary" className="font-normal">
                      {VISIBILITY_LABELS[question.visibility] ??
                        question.visibility}
                    </Badge>
                    {question.owner_id === currentUserId &&
                      question.current_version &&
                      isWizardEditable(
                        question.skill,
                        question.current_version.question_type,
                      ) && (
                        <QuestionWizard
                          trigger={
                            <Button size="xs" variant="outline">
                              Chỉnh sửa
                            </Button>
                          }
                          version={{
                            questionId: question.id,
                            skill:
                              question.skill as (typeof WIZARD_SKILLS)[number],
                            type: question.current_version.question_type,
                            title: question.title,
                            difficulty: question.difficulty,
                            prompt: question.current_version.prompt_text,
                            explanation:
                              question.current_version.explanation_text ?? "",
                            choices: [
                              ...question.current_version.question_options,
                            ]
                              .sort((a, b) => a.order_index - b.order_index)
                              .map((option) => ({
                                key: option.option_key,
                                content: option.content,
                              })),
                            answerKey:
                              question.current_version.answer_key?.answer_key ??
                              {},
                            gradingConfig:
                              question.current_version.answer_key
                                ?.grading_config ?? {},
                            promptContent:
                              question.current_version.prompt_content,
                            hasAudio: question.current_version.media.some(
                              (media) => media.media_role === "prompt_audio",
                            ),
                            sourceVersionId: question.current_version.id,
                          }}
                        />
                      )}
                    <QuestionActions
                      questionId={question.id}
                      isOwner={question.owner_id === currentUserId}
                      visibility={question.visibility}
                      teachers={teachers}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {count > 0 && (
        <nav
          aria-label="Phân trang ngân hàng câu hỏi"
          className="mt-4 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-muted-foreground text-sm">
            Trang {page}/{totalPages} · {count} câu hỏi
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={questionPageHref(basePath, filters ?? {}, page - 1)}>
                  Trang trước
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                Trang trước
              </Button>
            )}
            {page < totalPages ? (
              <Button asChild size="sm" variant="outline">
                <Link href={questionPageHref(basePath, filters ?? {}, page + 1)}>
                  Trang sau
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                Trang sau
              </Button>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
