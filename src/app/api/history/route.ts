import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getExercise } from "@/lib/exercises";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId manquant" }, { status: 400 });

  const snap = await adminDb
    .collection("submissions")
    .where("userId", "==", userId)
    .get();

  // For each exercise, track the first correct submission date + points
  const firstCorrect: Record<number, { date: Date; points: number }> = {};
  snap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.status !== "correct") return;
    const num: number = data.exerciseNum;
    const date: Date = data.createdAt?.toDate?.() ?? new Date();
    if (!firstCorrect[num]) {
      const exercise = getExercise(num);
      firstCorrect[num] = { date, points: exercise?.level ?? 1 };
    }
  });

  const events = Object.entries(firstCorrect)
    .map(([, v]) => v)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (events.length === 0) return NextResponse.json({ series: [] });

  // Group by day, accumulate points
  const byDay: Record<string, number> = {};
  events.forEach(({ date, points }) => {
    const key = date.toISOString().slice(0, 10);
    byDay[key] = (byDay[key] ?? 0) + points;
  });

  // Build cumulative series — one entry per active day + today's current value
  const days = Object.keys(byDay).sort();
  const series: { date: string; points: number }[] = [];
  let cumulative = 0;
  days.forEach((day) => {
    cumulative += byDay[day];
    series.push({ date: day, points: cumulative });
  });

  // Add today's anchor point if it isn't already the last
  const today = new Date().toISOString().slice(0, 10);
  if (series[series.length - 1].date !== today) {
    series.push({ date: today, points: cumulative });
  }

  return NextResponse.json({ series, totalPoints: cumulative });
}
