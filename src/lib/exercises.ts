import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export type Exercise = {
  num: number;
  level: number;
  content: string;
};

export function getExercises(): Exercise[] {
  const filePath = path.join(process.cwd(), "data/exercices.yml");
  const raw = fs.readFileSync(filePath, "utf8");
  const data = yaml.load(raw) as { exercices: Exercise[] };
  return data.exercices;
}

export function getExercise(num: number): Exercise | undefined {
  return getExercises().find(e => e.num === num);
}