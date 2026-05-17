import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import type { Exercise } from "./exercises";

export type Chapter = { title: string; start: number; end: number };
export type ChapterGroup = Chapter & { exercises: Exercise[] };

export function getChapters(): Chapter[] {
  const raw = fs.readFileSync(path.join(process.cwd(), "data/chapiters.yml"), "utf8");
  return (yaml.load(raw) as { chapiters: Chapter[] }).chapiters;
}

export function groupExercisesByChapter(exercises: Exercise[]): ChapterGroup[] {
  const chapters = getChapters();
  const used = new Set<number>();
  const groups: ChapterGroup[] = chapters.map((c) => {
    const exs = exercises.filter((e) => e.num >= c.start && e.num <= c.end);
    exs.forEach((e) => used.add(e.num));
    return { ...c, exercises: exs };
  });
  const leftover = exercises.filter((e) => !used.has(e.num));
  if (leftover.length) groups.push({ title: "Autres", start: 0, end: 0, exercises: leftover });
  return groups;
}

export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getChapterForExercise(num: number): Chapter | undefined {
  return getChapters().find((c) => num >= c.start && num <= c.end);
}
