import { getExercises } from "@/lib/exercises";
import { groupExercisesByChapter, slugify } from "@/lib/chapiters";
import ProfileStats from "@/components/ProfileStats";

export default function ProfilPage() {
  const exercises = getExercises();
  const groups = groupExercisesByChapter(exercises);
  const chapters = groups.map((g, i) => ({
    index: i + 1,
    title: g.title,
    slug: slugify(g.title),
    exerciseNums: g.exercises.map((e) => e.num),
  }));

  return (
    <main className="px-6 sm:px-14 lg:px-24 py-12">
      <ProfileStats chapters={chapters} totalExercises={exercises.length} />
    </main>
  );
}
