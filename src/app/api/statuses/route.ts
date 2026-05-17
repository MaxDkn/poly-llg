import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId manquant" }, { status: 400 });
  }

  const snap = await adminDb
    .collection("submissions")
    .where("userId", "==", userId)
    .get();

  // For each exercise, keep the status of the most recent submission
  const best: Record<number, { status: string; time: number }> = {};
  snap.docs.forEach((doc) => {
    const data = doc.data();
    const num: number = data.exerciseNum;
    const time: number = data.createdAt?.toMillis?.() ?? 0;
    if (!best[num] || time > best[num].time) {
      best[num] = { status: data.status, time };
    }
  });

  const statuses: Record<number, string> = {};
  Object.entries(best).forEach(([k, v]) => {
    statuses[Number(k)] = v.status;
  });

  return NextResponse.json(statuses);
}
