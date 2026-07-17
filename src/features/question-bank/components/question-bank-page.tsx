import {
  QUESTION_TYPE_LABELS,
  SKILL_QUESTION_TYPES,
  WIZARD_SKILLS,
} from "@/features/question-builder/domain/questions";
import { QuestionWizard } from "@/features/question-bank/components/question-wizard";
import { QuestionActions } from "@/features/question-bank/components/question-actions";
import { getQuestions, type QuestionFilters } from "@/features/question-bank/server/queries";
import { AssessmentTabs } from "@/components/shared/assessment-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WizardSkill = (typeof WIZARD_SKILLS)[number];

/** Chỉ mở "Tạo version mới" qua wizard khi kỹ năng + dạng câu được wizard hỗ trợ. */
function isWizardEditable(skill: string, type: string): skill is WizardSkill {
  return (
    (WIZARD_SKILLS as readonly string[]).includes(skill) &&
    (SKILL_QUESTION_TYPES[skill as WizardSkill] as readonly string[]).includes(type)
  );
}

export async function QuestionBankPage({
  kind,
  filters,
}: {
  kind: "exercise" | "exam";
  filters?: QuestionFilters;
}) {
  const { questions, teachers, currentUserId, count, page } = await getQuestions(kind, filters);
  const basePath = `/teacher/${kind === "exercise" ? "exercises" : "exams"}/question-bank`;
  return (
    <>
      <AssessmentTabs module={kind === "exercise" ? "exercises" : "exams"} />
      <PageHeader
        title="Ngân hàng câu hỏi"
        description="Câu riêng tư, được chia sẻ và kho chung; có phiên bản bất biến sau khi dùng."
        action={
          <QuestionWizard trigger={<Button>Tạo câu hỏi</Button>} />
        }
      />
      <form className="mb-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_10rem_10rem_auto]">
        <Input name="q" defaultValue={filters?.q} placeholder="Tìm mã hoặc tiêu đề" />
        <select name="skill" defaultValue={filters?.skill ?? ""} className="bg-background h-9 rounded-md border px-3 text-sm"><option value="">Mọi kỹ năng</option><option value="listening">Nghe</option><option value="speaking">Nói</option><option value="reading">Đọc</option><option value="writing">Viết</option><option value="vocabulary">Từ vựng</option><option value="grammar">Ngữ pháp</option></select>
        <select name="visibility" defaultValue={filters?.visibility ?? ""} className="bg-background h-9 rounded-md border px-3 text-sm"><option value="">Mọi phạm vi</option><option value="private">Riêng tư</option><option value="shared">Được chia sẻ</option><option value="global">Kho chung</option><option value="pending_global_review">Chờ duyệt</option></select>
        <Button type="submit" variant="outline">Lọc</Button>
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
                  className="space-y-3 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs">{question.code}</code>
                        <p className="font-medium">{question.title}</p>
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {question.current_version?.prompt_text}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {question.current_version
                          ? QUESTION_TYPE_LABELS[
                              question.current_version.question_type
                            ]
                          : "Chưa có version"}
                      </Badge>
                      <Badge>{question.visibility}</Badge>
                    </div>
                  </div>
                  <QuestionActions questionId={question.id} isOwner={question.owner_id === currentUserId} visibility={question.visibility} teachers={teachers} />
                  {question.owner_id === currentUserId &&
                    question.current_version &&
                    isWizardEditable(question.skill, question.current_version.question_type) && (
                      <QuestionWizard
                        trigger={
                          <Button size="sm" variant="outline">
                            Tạo version mới
                          </Button>
                        }
                        version={{
                          questionId: question.id,
                          skill: question.skill as (typeof WIZARD_SKILLS)[number],
                          type: question.current_version.question_type,
                          title: question.title,
                          prompt: question.current_version.prompt_text,
                          explanation: question.current_version.explanation_text ?? "",
                          choices: [...question.current_version.question_options]
                            .sort((a, b) => a.order_index - b.order_index)
                            .map((option) => option.content),
                        }}
                      />
                    )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <div className="mt-4 flex items-center justify-between text-sm"><span>{count} câu hỏi</span><div className="flex gap-2"><Button asChild size="sm" variant="outline" disabled={page <= 1}><Link href={`${basePath}?page=${page - 1}`}>Trang trước</Link></Button><Button asChild size="sm" variant="outline" disabled={page * 20 >= count}><Link href={`${basePath}?page=${page + 1}`}>Trang sau</Link></Button></div></div>
    </>
  );
}
import Link from "next/link";
