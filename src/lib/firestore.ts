import { db } from "./firebase";
import {
  collection, addDoc, doc, getDoc,
  updateDoc, serverTimestamp, query,
  where, getDocs, orderBy
} from "firebase/firestore";

export type SubmissionStatus = "pending" | "correct" | "incorrect";

export type Submission = {
  id?: string;
  userId: string;
  exerciseNum: number;
  submittedAt: any;
  answer: string;
  status: SubmissionStatus;
};

export type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt: any;
};

export async function createSubmission(
  data: Omit<Submission, "id" | "submittedAt">
) {
  return addDoc(collection(db, "submissions"), {
    ...data,
    submittedAt: serverTimestamp(),
  });
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: "correct" | "incorrect"
) {
  await updateDoc(doc(db, "submissions", submissionId), { status });
}

export async function getSubmission(submissionId: string) {
  const snap = await getDoc(doc(db, "submissions", submissionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Submission;
}

export async function getUserSubmissionsForExercise(
  userId: string,
  exerciseNum: number
) {
  const q = query(
    collection(db, "submissions"),
    where("userId", "==", userId),
    where("exerciseNum", "==", exerciseNum),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission));
}

export async function getUserExerciseStatuses(
  userId: string
): Promise<Record<number, SubmissionStatus>> {
  const q = query(
    collection(db, "submissions"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  const best: Record<number, { status: SubmissionStatus; time: number }> = {};
  snap.docs.forEach((d) => {
    const data = d.data() as Submission;
    const time: number = data.submittedAt?.toMillis?.() ?? 0;
    const existing = best[data.exerciseNum];
    if (!existing || time > existing.time) {
      best[data.exerciseNum] = { status: data.status, time };
    }
  });
  return Object.fromEntries(
    Object.entries(best).map(([k, v]) => [Number(k), v.status])
  );
}

export async function addMessage(
  submissionId: string,
  message: Omit<Message, "id" | "createdAt">
) {
  return addDoc(
    collection(db, "conversations", submissionId, "messages"),
    { ...message, createdAt: serverTimestamp() }
  );
}

export async function getMessages(submissionId: string): Promise<Message[]> {
  const q = query(
    collection(db, "conversations", submissionId, "messages"),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
}