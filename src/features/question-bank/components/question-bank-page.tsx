import { QUESTION_TYPE_LABELS } from "@/features/question-builder/domain/questions";
import { QuestionForm } from "@/features/question-bank/components/question-form";
import { QuestionActions } from "@/features/question-bank/components/question-actions";
import { QuestionImport } from "@/features/question-bank/components/question-import";
import { QuestionMediaUpload } from "@/features/question-bank/components/question-media-upload";
import { QuestionVersionForm } from "@/features/question-bank/components/question-version-form";
import { getQuestions, type QuestionFilters } from "@/features/question-bank/server/queries";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <PageHeader
        title="Ngân hàng câu hỏi"
        description="Câu riêng tư, được chia sẻ và kho chung; có phiên bản bất biến sau khi dùng."
        action={<div className="flex gap-2"><QuestionImport /><QuestionForm /></div>}
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
                  {question.owner_id === currentUserId && question.current_version && <QuestionVersionForm questionId={question.id} title={question.title} skill={question.skill} difficulty={question.difficulty} current={question.current_version} />}
                  {question.owner_id === currentUserId && question.current_version && <QuestionMediaUpload versionId={question.current_version.id} />}
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
