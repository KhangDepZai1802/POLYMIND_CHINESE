import Link from "next/link";
import { Database } from "lucide-react";

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
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StepHint } from "@/components/shared/step-hint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

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

function promptAudioUrl(
  media: ReadonlyArray<{ media_role: string; signed_url?: string | null }>,
): string | null {
  return (
    media.find((item) => item.media_role === "prompt_audio")?.signed_url ?? null
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
        /* ⛔ KHÔNG truyền `trigger` — file này là Server Component
           (`UX-UIUX-M00-025`). Wizard tự dựng nút "Tạo câu hỏi". */
        action={<QuestionWizard />}
      />
      <StepHint module={kind === "exercise" ? "exercises" : "exams"} step={1} />
      {/*
        `aria-label` cho `<form>` + `<label>` thật cho từng ô: trước đây ô tìm
        kiếm chỉ có `placeholder` (biến mất ngay khi gõ) còn hai ô chọn không
        có tên nào cả, nên trình đọc màn hình đọc ra "combo box" trống.
      */}
      <form
        aria-label="Lọc ngân hàng câu hỏi"
        className="mb-4 grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_10rem_10rem_auto]"
      >
        <div className="space-y-1.5">
          <Label htmlFor="qb-q">Tìm mã hoặc tiêu đề</Label>
          <Input
            id="qb-q"
            name="q"
            defaultValue={filters?.q}
            placeholder="VD: Q-0001"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qb-skill">Kỹ năng</Label>
          <NativeSelect
            id="qb-skill"
            name="skill"
            defaultValue={filters?.skill ?? ""}
          >
            <option value="">Mọi kỹ năng</option>
            <option value="listening">Nghe</option>
            <option value="speaking">Nói</option>
            <option value="reading">Đọc</option>
            <option value="writing">Viết</option>
            <option value="vocabulary">Từ vựng</option>
            <option value="grammar">Ngữ pháp</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qb-visibility">Phạm vi</Label>
          <NativeSelect
            id="qb-visibility"
            name="visibility"
            defaultValue={filters?.visibility ?? ""}
          >
            <option value="">Mọi phạm vi</option>
            <option value="private">Riêng tư</option>
            <option value="shared">Được chia sẻ</option>
            <option value="global">Kho chung</option>
            <option value="pending_global_review">Chờ duyệt</option>
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">
          Lọc
        </Button>
      </form>
      <Card>
        <CardContent className="p-0">
          {questions.length === 0 ? (
            <EmptyState
              icon={Database}
              title="Chưa có câu hỏi"
              description="Tạo câu đầu tiên hoàn toàn trên web bằng nút Tạo câu hỏi ở đầu trang."
            />
          ) : (
            <ul className="divide-y">
              {questions.map((question) => (
                <li
                  key={question.id}
                  className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <code className="text-text-secondary text-sm">
                        {question.code}
                      </code>
                      <p className="min-w-0 truncate font-medium">
                        {question.title}
                      </p>
                    </div>
                    {question.current_version?.prompt_text && (
                      <p className="text-text-secondary mt-0.5 line-clamp-1 text-sm">
                        {question.current_version.prompt_text}
                      </p>
                    )}
                  </div>
                  {/*
                    Bỏ `shrink-0`: nó khoá cụm này ở bề rộng nội dung nên ở
                    360px cụm rộng **398px** và đẩy cả trang tràn ngang 67px —
                    `flex-wrap` bên trong không cứu được vì chính cụm mới là
                    thứ không chịu co. Thêm `min-w-0` + `basis-full sm:basis-auto`
                    để ở màn hẹp nó xuống hẳn một dòng riêng.
                  */}
                  <div className="flex min-w-0 basis-full flex-wrap items-center gap-1.5 sm:basis-auto sm:justify-end">
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
                          /* ⛔ Không truyền `trigger` — `UX-UIUX-M00-025`.
                             Wizard tự dựng nút "Chỉnh sửa" khi có `version`. */
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
                            audioUrl: promptAudioUrl(
                              question.current_version.media,
                            ),
                            audioFileName: question.current_version.media.some(
                              (media) => media.media_role === "prompt_audio",
                            )
                              ? "Audio hiện tại đã lưu"
                              : null,
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
                <Link
                  href={questionPageHref(basePath, filters ?? {}, page - 1)}
                >
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
                <Link
                  href={questionPageHref(basePath, filters ?? {}, page + 1)}
                >
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
