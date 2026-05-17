"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthProvider";
import { renderLatex } from "@/lib/latex";
import { useBreadcrumb } from "@/context/BreadcrumbContext";

type Mode = "idle" | "editing" | "draft";

type Submission = {
  answer: string;
  feedback: string | null;
  status: "correct" | "incorrect";
  createdAt: number | null;
};

type Props = {
  exerciseHtml: string;
  exerciseNum: number;
  chapterTitle?: string;
  chapterSlug?: string;
};

const MIN_H = 16;

function formatDate(ms: number): string {
  const d = new Date(ms);
  return (
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) +
    " à " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

// ── Post component — Mathraining-style card with fused header + content ──
function Post({
  headerLeft,
  headerRight,
  headerClass,
  borderClass,
  children,
}: {
  headerLeft: React.ReactNode;
  headerRight?: React.ReactNode;
  headerClass: string;
  borderClass: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`flex items-center justify-between px-4 py-2.5 border rounded-t text-sm ${headerClass} ${borderClass}`}>
        <span className="font-medium">{headerLeft}</span>
        {headerRight && <span className="text-xs opacity-70">{headerRight}</span>}
      </div>
      <div className={`border border-t-0 rounded-b p-4 text-sm leading-relaxed text-slate-700 overflow-x-auto [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto ${borderClass}`}>
        {children}
      </div>
    </div>
  );
}

function SubmissionItem({ sub }: { sub: Submission }) {
  const corrClass = sub.status === "correct"
    ? { header: "bg-emerald-50 text-emerald-900", border: "border-emerald-200", label: "Correct" }
    : { header: "bg-red-50 text-red-900", border: "border-red-200", label: "Incorrect" };

  return (
    <div className="flex flex-col gap-1">
      {/* Student answer */}
      <Post
        headerLeft="Votre soumission"
        headerRight={sub.createdAt ? formatDate(sub.createdAt) : undefined}
        headerClass="bg-blue-50 text-blue-900"
        borderClass="border-blue-200"
      >
        <div dangerouslySetInnerHTML={{ __html: renderLatex(sub.answer) }} />
      </Post>

      {/* AI correction */}
      {sub.feedback && (
        <Post
          headerLeft="Correction"
          headerRight={corrClass.label}
          headerClass={corrClass.header}
          borderClass={corrClass.border}
        >
          <div dangerouslySetInnerHTML={{ __html: renderLatex(sub.feedback) }} />
        </Post>
      )}
    </div>
  );
}

export default function ExerciceView({ exerciseHtml, exerciseNum, chapterTitle, chapterSlug }: Props) {
  const { user, signIn } = useAuth();
  const { setItems } = useBreadcrumb();
  const draftKey = `draft_ex_${exerciseNum}`;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [mode, setMode] = useState<Mode>("idle");
  const [answer, setAnswer] = useState("");
  const [savedAnswer, setSavedAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingPast, setLoadingPast] = useState(true);

  useEffect(() => {
    setItems([
      ...(chapterTitle && chapterSlug
        ? [{ label: chapterTitle, href: `/exercices?chapitre=${chapterSlug}` }]
        : []),
      { label: `Exercice ${exerciseNum}` },
    ]);
    return () => setItems([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseNum]);

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) { setSavedAnswer(saved); setMode("draft"); }
  }, [draftKey]);

  useEffect(() => {
    setSubmissions([]);
    if (!user) { setLoadingPast(false); return; }
    fetch(`/api/submission?userId=${user.uid}&exerciseNum=${exerciseNum}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error && d.submissions) setSubmissions(d.submissions); })
      .catch(() => {})
      .finally(() => setLoadingPast(false));
  }, [user, exerciseNum]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, MIN_H)}px`;
  }, [answer, mode]);

  const saveDraft = () => {
    localStorage.setItem(draftKey, answer);
    setSavedAnswer(answer);
    setMode("draft");
  };

  const editDraft = () => { setAnswer(savedAnswer ?? ""); setMode("editing"); };
  const clearDraft = () => { localStorage.removeItem(draftKey); setSavedAnswer(null); };

  const submit = async () => {
    const text = mode === "draft" ? (savedAnswer ?? "") : answer;
    if (!user || !text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, exerciseNum, answer: text, history: submissions }),
      });
      const data = await res.json();
      clearDraft();
      setAnswer("");
      setSubmissions((prev) => [
        ...prev,
        {
          answer: text,
          feedback: data.feedback ?? data.error ?? null,
          status: data.correct ? "correct" : "incorrect",
          createdAt: Date.now(),
        },
      ]);
      setMode("idle");
    } catch {
      setSubmissions((prev) => [
        ...prev,
        { answer: text, feedback: "Erreur réseau.", status: "incorrect", createdAt: Date.now() },
      ]);
      clearDraft();
      setAnswer("");
      setMode("idle");
    } finally {
      setLoading(false);
    }
  };

  const solved = submissions.some((s) => s.status === "correct");
  const lastSub = submissions.at(-1);
  const actionLabel = submissions.length === 0
    ? "Nouvelle soumission"
    : lastSub?.status === "incorrect" ? "Répondre" : "Nouvelle soumission";

  return (
    <div className={solved ? "rounded-lg border border-emerald-200 bg-emerald-50/40 p-6 -mx-6" : ""}>
      {/* Exercise content */}
      <div
        className="leading-relaxed text-slate-800 [&_.katex-display]:my-5"
        dangerouslySetInnerHTML={{ __html: exerciseHtml }}
      />

      <div className="mt-10 border-t border-slate-200 pt-6 flex flex-col gap-6">

        {/* Thread */}
        {submissions.map((sub, i) => (
          <SubmissionItem key={i} sub={sub} />
        ))}

        {/* Editor */}
        {mode === "editing" && (
          <div className="flex flex-col gap-2">
            {/* Preview */}
            <div
              className="border border-slate-200 rounded p-4 text-sm bg-slate-50 overflow-x-auto leading-relaxed [&_.katex-display]:my-3"
              dangerouslySetInnerHTML={{ __html: renderLatex(answer) }}
            />
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="border border-slate-200 rounded p-3 font-mono text-sm resize-none overflow-hidden focus:outline-none focus:border-slate-400 bg-white leading-relaxed"
              style={{ minHeight: MIN_H }}
              autoFocus
            />
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={saveDraft}
                disabled={!answer.trim()}
                className="text-sm bg-slate-900 text-white px-5 py-2 rounded hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Enregistrer le brouillon
              </button>
              <button
                onClick={() => { if (savedAnswer) { setMode("draft"); } else { setMode("idle"); } setAnswer(""); }}
                className="text-sm text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Draft */}
        {mode === "draft" && savedAnswer !== null && (
          <div className="flex flex-col gap-3">
            <Post
              headerLeft="Brouillon"
              headerRight="Non envoyé"
              headerClass="bg-slate-100 text-slate-600"
              borderClass="border-slate-300"
            >
              <div dangerouslySetInnerHTML={{ __html: renderLatex(savedAnswer) }} />
            </Post>

            <div className="flex items-center gap-3">
              {user ? (
                <button
                  onClick={submit}
                  disabled={loading}
                  className="text-sm bg-slate-900 text-white px-5 py-2 rounded hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {loading ? "Correction en cours…" : "Soumettre cette solution"}
                </button>
              ) : (
                <button
                  onClick={signIn}
                  className="text-sm border border-slate-300 text-slate-600 px-5 py-2 rounded hover:border-slate-500 transition-colors cursor-pointer"
                >
                  Se connecter pour soumettre
                </button>
              )}
              <button onClick={editDraft} className="text-sm text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">
                Modifier
              </button>
              <button
                onClick={() => { clearDraft(); setAnswer(""); setMode("idle"); }}
                className="text-sm text-slate-300 hover:text-red-400 transition-colors cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        )}

        {/* Action trigger */}
        {mode === "idle" && !loadingPast && (
          <button
            onClick={() => { setAnswer(""); setMode("editing"); }}
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1.5 self-start"
          >
            <span>{actionLabel}</span>
            <span className="text-slate-300">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
