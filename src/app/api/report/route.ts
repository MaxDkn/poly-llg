import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body.exerciseNum !== "number" || typeof body.type !== "string") {
    return NextResponse.json({ error: "params invalides" }, { status: 400 });
  }

  const { exerciseNum, type, comment, userId } = body;

  await adminDb.collection("reports").add({
    exerciseNum,
    type,
    comment: typeof comment === "string" ? comment.trim() : "",
    userId: typeof userId === "string" ? userId : null,
    reportedAt: FieldValue.serverTimestamp(),
    resolved: false,
  });

  return NextResponse.json({ ok: true });
}
