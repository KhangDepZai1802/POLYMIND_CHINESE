import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { B2CProgramWorkspace } from "@/features/b2c/components/program-workspace";
import { B2C_PROGRAMS, getB2CProgram } from "@/features/b2c/domain/programs";
import {
  getB2CClasses,
  getB2CStudentRows,
} from "@/features/b2c/server/queries";
import { requireManager } from "@/lib/auth/session";

export function generateStaticParams() {
  return B2C_PROGRAMS.map((program) => ({ program: program.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ program: string }>;
}): Promise<Metadata> {
  const { program: slug } = await params;
  const program = getB2CProgram(slug);
  return { title: program ? `${program.title}` : "Chương trình" };
}

export default async function B2CProgramPage({
  params,
}: {
  params: Promise<{ program: string }>;
}) {
  await requireManager();
  const { program: slug } = await params;
  const program = getB2CProgram(slug);
  if (!program) notFound();

  const [classes, students] = await Promise.all([
    getB2CClasses(slug),
    getB2CStudentRows(slug),
  ]);

  return (
    <B2CProgramWorkspace
      program={{
        slug: program.slug,
        title: program.title,
        description: program.description,
      }}
      classes={classes}
      students={students}
    />
  );
}
