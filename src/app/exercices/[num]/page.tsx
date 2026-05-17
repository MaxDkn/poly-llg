import { notFound } from "next/navigation";
import { getExercise, getExercises } from "@/lib/exercises";
import { getChapterForExercise, slugify } from "@/lib/chapiters";
import { renderLatex } from "@/lib/latex";
import ExerciceView from "@/components/ExerciceView";

export async function generateStaticParams() {
  return getExercises().map((ex) => ({ num: String(ex.num) }));
}

export default async function ExercicePage({
  params,
}: {
  params: Promise<{ num: string }>;
}) {
  const { num } = await params;
  const exercise = getExercise(Number(num));
  if (!exercise) notFound();

  const chapter = getChapterForExercise(exercise.num);
  const exerciseHtml = renderLatex(exercise.content);

  return (
    <main className="px-6 sm:px-14 lg:px-24 py-12">
      <div className="pt-2">
        <ExerciceView
          exerciseHtml={exerciseHtml}
          exerciseNum={exercise.num}
          chapterTitle={chapter?.title}
          chapterSlug={chapter ? slugify(chapter.title) : undefined}
        />
      </div>
    </main>
  );
}
