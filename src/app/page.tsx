import { getExercises } from "@/lib/exercises";
import { groupExercisesByChapter, slugify } from "@/lib/chapiters";
import HomeChapterCards from "@/components/HomeChapterCards";

export default function HomePage() {
  const exercises = getExercises();
  const groups = groupExercisesByChapter(exercises);
  const chapters = groups.map((g, i) => ({
    index: i + 1,
    title: g.title,
    slug: slugify(g.title),
    count: g.exercises.length,
    exerciseNums: g.exercises.map((e) => e.num),
  }));

  return (
    <main className="flex flex-col items-center flex-1 px-6 py-20 text-center">
      <p className="text-xs tracking-[0.2em] uppercase text-slate-400 mb-5">
        Louis-le-Grand · Mathématiques
      </p>
      <h1 className="font-[family-name:var(--font-heading)] text-6xl font-semibold text-slate-900 mb-5 tracking-tight">
        Poly-LLG
      </h1>
      <HomeChapterCards chapters={chapters} />
    </main>
  );
}
