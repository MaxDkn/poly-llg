"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { renderLatex } from "@/lib/latex";
import type { ChapterGroup } from "@/lib/chapiters";
import type { SubmissionStatus } from "@/lib/firestore";

type Props = { groups: ChapterGroup[]; slugs: string[] };

function Stars({ level }: { level: number }) {
  return (
    <span className={`text-sm text-orange-400`}>
      {"★".repeat(level)}
    </span> // className={`text-sm ${level === 1 ? "text-blue-400" : "text-orange-400"}`}>{"★".repeat(level)}
  );
}

export default function ExercicesList({ groups, slugs }: Props) {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<Record<number, SubmissionStatus>>({});
  const showChapterHeaders = groups.length > 1;

  useEffect(() => {
    if (!user) { setStatuses({}); return; }
    fetch(`/api/statuses?userId=${user.uid}`)
      .then((r) => r.json())
      .then((data) => { if (!data.error) setStatuses(data); })
      .catch(() => {});
  }, [user]);

  return (
    <div className="space-y-14">
      {groups.map((group, i) => (
        <section key={group.title} id={slugs[i]}>
          {showChapterHeaders && (
            <>
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-slate-800 mb-1">
                {group.title}
              </h2>
              <div className="border-t border-slate-200 mb-1" />
            </>
          )}

          {group.exercises.map((ex) => {
            const done = statuses[ex.num] === "correct";
            return (
              <Link
                key={ex.num}
                href={`/exercices/${ex.num}`}
                className={`flex flex-col gap-1 sm:grid sm:gap-x-8 sm:items-start py-4 transition-colors group px-2 -mx-2 rounded ${
                  done
                    ? "bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-100"
                    : "hover:bg-slate-50"
                }`}
                style={{ gridTemplateColumns: "10rem 1fr" }}
              >
                {/* Titre + étoiles */}
                <div className="flex items-baseline gap-2 flex-shrink-0">
                  <span
                    className={`font-[family-name:var(--font-heading)] text-xl font-semibold transition-colors ${
                      done
                        ? "text-emerald-600"
                        : "text-slate-900 group-hover:text-blue-600"
                    }`}
                  >
                    Exercice {ex.num}
                  </span>
                  <Stars level={ex.level} />
                </div>

                {/* Énoncé tronqué */}
                <div
                  className="overflow-hidden text-sm text-slate-500 leading-relaxed [&_.katex]:text-[0.85em] [&_.katex-display]:my-1 [&_.katex-display]:overflow-x-auto"
                  style={{ maxHeight: "5rem" }}
                  dangerouslySetInnerHTML={{ __html: renderLatex(ex.content) }}
                />
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
