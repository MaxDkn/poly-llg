import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const exerciseNum = req.nextUrl.searchParams.get("exerciseNum");

  if (!userId || !exerciseNum) {
    return NextResponse.json({ error: "params manquants" }, { status: 400 });
  }

  const snap = await adminDb
    .collection("submissions")
    .where("userId", "==", userId)
    .where("exerciseNum", "==", Number(exerciseNum))
    .get();

  if (snap.empty) return NextResponse.json({ submissions: [] });

  const submissions = snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        answer: d.answer ?? "",
        feedback: d.feedback ?? null,
        status: (d.status ?? "incorrect") as "correct" | "incorrect",
        createdAt: d.createdAt?.toMillis?.() ?? null,
      };
    })
    .filter((s) => s.status === "correct" || s.status === "incorrect")
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  return NextResponse.json({ submissions });
}
