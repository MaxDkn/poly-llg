"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
} from "recharts";

type ChapterData = { index: number; title: string; slug: string; exerciseNums: number[] };
type HistoryPoint = { date: string; points: number };
type Props = { chapters: ChapterData[]; totalExercises: number };

function fmtAxis(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function fmtFull(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: HistoryPoint }[] }) {
  if (!active || !payload?.length) return null;
  const { date, points } = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded px-3 py-2 text-xs shadow-sm">
      <p className="text-slate-400">{fmtFull(date)}</p>
      <p className="text-slate-900 font-semibold mt-0.5">{points} pt{points > 1 ? "s" : ""}</p>
    </div>
  );
}

function StatCard({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div className="border border-slate-100 rounded-lg p-4 bg-white">
      <p className="font-[family-name:var(--font-heading)] text-3xl font-semibold text-slate-900 leading-none">
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-1.5">{label}</p>
      {sub && <p className="text-xs text-slate-300 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ProfileStats({ chapters, totalExercises }: Props) {
  const { user, loading, signIn, logOut } = useAuth();
  const [statuses, setStatuses] = useState<Record<number, string> | null>(null);
  const [series, setSeries] = useState<HistoryPoint[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    if (!user) { setStatuses(null); setSeries([]); return; }
    fetch(`/api/statuses?userId=${user.uid}`)
      .then(r => r.json()).then(d => { if (!d.error) setStatuses(d); }).catch(() => {});
    fetch(`/api/history?userId=${user.uid}`)
      .then(r => r.json()).then(d => {
        if (!d.error) { setSeries(d.series ?? []); setTotalPoints(d.totalPoints ?? 0); }
      }).catch(() => {});
  }, [user]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="py-24">
        <p className="text-slate-500 mb-6">Connecte-toi pour voir ton profil.</p>
        <button onClick={signIn} className="text-sm bg-slate-900 text-white px-5 py-2 rounded hover:bg-slate-700 transition-colors cursor-pointer">
          Se connecter
        </button>
      </div>
    );
  }

  const totalSolved = statuses ? Object.values(statuses).filter(s => s === "correct").length : null;
  const totalAttempted = statuses ? Object.values(statuses).filter(s => s === "correct" || s === "incorrect").length : null;
  const successRate = totalAttempted ? Math.round(((totalSolved ?? 0) / totalAttempted) * 100) : null;
  const globalPct = totalSolved !== null ? Math.round((totalSolved / totalExercises) * 100) : 0;
  const tickInterval = series.length > 1 ? Math.max(1, Math.floor(series.length / 5)) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10">

      <aside className="flex flex-col gap-8">

        <div className="flex flex-col gap-4">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-20 h-20 rounded-full border border-slate-200" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-semibold text-slate-400">
              {user.displayName?.[0] ?? "?"}
            </div>
          )}
          <div>
            <p className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-slate-900 leading-tight">
              {user.displayName}
            </p>
            <p className="text-sm text-slate-400 mt-0.5">{user.email}</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-3">
          <StatCard
            value={totalPoints > 0 ? totalPoints : "—"}
            label="points"
            sub={`${totalSolved ?? "—"} exercice${(totalSolved ?? 0) > 1 ? "s" : ""} résolu${(totalSolved ?? 0) > 1 ? "s" : ""}`}
          />
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              value={totalAttempted ?? "—"}
              label="tentatives"
            />
            <StatCard
              value={successRate !== null ? `${successRate}%` : "—"}
              label="succès"
            />
          </div>
        </div>

        {/* Global progress bar */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Progression</span>
            <span className="text-xs font-medium text-slate-600">{totalSolved ?? "—"} / {totalExercises}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${globalPct === 100 ? "bg-emerald-500" : "bg-slate-800"}`}
              style={{ width: `${globalPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{globalPct}% terminé</p>
        </div>

        {/* Logout */}
        <div className="pt-2">
          <button onClick={logOut} className="text-sm text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-col gap-10 min-w-0">

        {/* Activity chart */}
        <section>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">Activité</p>
          {series.length < 2 ? (
            <div className="h-40 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-sm text-slate-300">Pas encore assez de données</p>
            </div>
          ) : (
            <div className="border border-slate-100 rounded-lg p-4 bg-white">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f172a" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtAxis}
                    interval={tickInterval}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="points"
                    stroke="#0f172a"
                    strokeWidth={1.5}
                    fill="url(#grad)"
                    dot={false}
                    activeDot={{ r: 3, fill: "#0f172a", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Chapters grid */}
        <section>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">Chapitres</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {chapters.map((c) => {
              const solved = statuses
                ? c.exerciseNums.filter(n => statuses[n] === "correct").length
                : null;
              const total = c.exerciseNums.length;
              const cpct = solved !== null ? Math.round((solved / total) * 100) : 0;
              const done = solved === total && solved !== null && total > 0;

              return (
                <Link
                  key={c.slug}
                  href={`/exercices?chapitre=${c.slug}`}
                  className="border border-slate-100 rounded-lg p-5 bg-white hover:border-slate-300 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className={`font-[family-name:var(--font-heading)] text-xl font-semibold group-hover:text-blue-600 transition-colors ${done ? "text-emerald-600" : "text-slate-900"}`}>
                        {c.title}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-slate-500 tabular-nums mt-1">
                      {solved ?? "—"}/{total}
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-700 ${done ? "bg-emerald-500" : cpct > 0 ? "bg-slate-700" : "bg-slate-200"}`}
                      style={{ width: `${cpct}%` }}
                    />
                  </div>

                  <p className="text-xs text-slate-400">
                    {done ? "Terminé" : cpct > 0 ? `${cpct}% complété` : "Pas encore commencé"}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
