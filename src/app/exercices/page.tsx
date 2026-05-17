import { getExercises } from "@/lib/exercises";
import { groupExercisesByChapter, slugify } from "@/lib/chapiters";
import ExercicesList from "@/components/ExercicesList";
import { BreadcrumbSetter } from "@/components/BreadcrumbSetter";

export default async function ExercicesPage({
  searchParams,
}: {
  searchParams: Promise<{ chapitre?: string }>;
}) {
  const { chapitre } = await searchParams;
  const exercises = getExercises();
  const allGroups = groupExercisesByChapter(exercises);
  const groups = chapitre
    ? allGroups.filter((g) => slugify(g.title) === chapitre)
    : allGroups;
  const slugs = groups.map((g) => slugify(g.title));
  const chapterTitle = groups.length === 1 ? groups[0].title : null;

  return (
    <main className="px-6 sm:px-14 lg:px-24 py-12">
      {chapterTitle && (
        <BreadcrumbSetter items={[{ label: chapterTitle }]} />
      )}
      {!chapitre && (
        <>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-semibold text-slate-900 mb-1">
            Exercices
          </h1>
          <p className="text-sm text-slate-400 mb-10">
            {exercises.length} exercices · {allGroups.length} chapitres
          </p>
        </>
      )}
      <ExercicesList groups={groups} slugs={slugs} />
    </main>
  );
}
