"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

export type ChapterCardData = {
  index: number;
  title: string;
  slug: string;
  count: number;
  exerciseNums: number[];
};

type Props = { chapters: ChapterCardData[] };

export default function HomeChapterCards({ chapters }: Props) {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<Record<number, string> | null>(null);

  useEffect(() => {
    if (!user) { setStatuses(null); return; }
    fetch(`/api/statuses?userId=${user.uid}`)
      .then((r) => r.json())
      .then((data) => { if (!data.error) setStatuses(data); })
      .catch(() => {});
  }, [user]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl mt-14">
      {chapters.map((c) => {
        const solved = statuses
          ? c.exerciseNums.filter((n) => statuses[n] === "correct").length
          : null;

        return (
          <Link
            key={c.slug}
            href={`/exercices?chapitre=${c.slug}`}
            className="group border border-slate-200 rounded p-6 text-left hover:border-slate-400 transition-colors bg-white"
          >
            <p className="font-[family-name:var(--font-heading)] text-xl font-semibold text-slate-900 mb-4 group-hover:text-blue-600 transition-colors">
              {c.title}
            </p>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-400">
                {solved !== null ? (
                  <span className={solved === c.count ? "text-emerald-600" : ""}>
                    {solved} / {c.count} résolus
                  </span>
                ) : (
                  <span>{c.count} exercices</span>
                )}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
