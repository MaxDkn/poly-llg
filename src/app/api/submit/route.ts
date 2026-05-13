import { NextRequest, NextResponse } from "next/server";
import { getExercise } from "@/lib/exercises";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { userId, exerciseNum, answer } = await req.json();

    const exercise = getExercise(exerciseNum);
    if (!exercise) {
      return NextResponse.json(
        { error: "Exercice introuvable" },
        { status: 404 }
      );
    }

    const submissionRef = await adminDb.collection("submissions").add({
      userId,
      exerciseNum,
      answer,
      status: "pending",
      createdAt: new Date(),
    });

    const submissionId = submissionRef.id;

    await adminDb
      .collection("submissions")
      .doc(submissionId)
      .collection("messages")
      .add({
        role: "user",
        content: answer,
        createdAt: new Date(),
      });

    const response = await fetch(
      "https://api.k2think.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.K2_API_KEY}`,
        },
        body: JSON.stringify({
          model: "MBZUAI-IFM/K2-Think-v2",
          response_format: { type: "json_object" },
          stream: false,
          messages: [
            {
              role: "system",
              content: `Tu es un professeur de mathématiques bienveillant.
Réponds UNIQUEMENT avec JSON :
{"correct": true|false, "feedback": "texte"}`,
            },
            {
              role: "user",
              content: `Exercice ${exercise.level}: ${exercise.content}
Réponse: ${answer}`,
            },
          ],
        }),
      }
    );
    const data = await response.json();

    const raw = data?.choices?.[0]?.message?.content;

    if (!raw) {
        console.error("L'API n'a renvoyé aucun contenu");
        return NextResponse.json({ error: "Réponse IA vide" }, { status: 500 });
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    const feedback = parsed?.feedback || "Erreur de lecture du feedback";
    const isCorrect = !!parsed?.correct;

    await adminDb
      .collection("submissions")
      .doc(submissionId)
      .update({
        status: parsed.correct ? "correct" : "incorrect",
      });

    await adminDb
      .collection("submissions")
      .doc(submissionId)
      .collection("messages")
      .add({
        role: "assistant",
        content: parsed.feedback,
        createdAt: new Date(),
      });

    return NextResponse.json({
      submissionId,
      correct: parsed.correct,
      feedback: parsed.feedback,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}