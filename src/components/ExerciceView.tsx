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

function SubmissionItem({ sub }: { sub: Submission }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-l-2 border-slate-200 pl-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            Soumission (<span className={`text-xs font-medium ${sub.status === "correct" ? "text-emerald-600" : "text-red-500"}`}>
            {sub.status === "correct" ? "Correct" : "Incorrect"}
          </span>) {sub.createdAt ? <> · <span className="normal-case not-italic">{formatDate(sub.createdAt)}</span></> : ""}
          </p>
          
        </div>
        <div
          className="text-sm leading-relaxed text-slate-700 [&_.katex-display]:my-3"
          dangerouslySetInnerHTML={{ __html: renderLatex(sub.answer) }}
        />
      </div>

      {sub.feedback && (
        <div className={`border-l-2 pl-4 ${sub.status === "correct" ? "border-emerald-300" : "border-red-300"}`}>
          <div
            className="text-sm leading-relaxed text-slate-700 [&_.katex-display]:my-3"
            dangerouslySetInnerHTML={{ __html: renderLatex(sub.feedback) }}
          />
        </div>
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
  const [editorH, setEditorH] = useState(MIN_H);

  // Breadcrumb
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

  // Load draft
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) { setSavedAnswer(saved); setMode("draft"); }
  }, [draftKey]);

  // Load past submissions
  useEffect(() => {
    setSubmissions([]);
    if (!user) { setLoadingPast(false); return; }
    fetch(`/api/submission?userId=${user.uid}&exerciseNum=${exerciseNum}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error && d.submissions) setSubmissions(d.submissions); })
      .catch(() => {})
      .finally(() => setLoadingPast(false));
  }, [user, exerciseNum]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const h = Math.max(ta.scrollHeight, MIN_H);
    ta.style.height = `${h}px`;
    setEditorH(h);
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

  const lastSub = submissions.at(-1);
  const solved = submissions.some((s) => s.status === "correct");
  const actionLabel =
    submissions.length === 0
      ? "Nouvelle soumission"
      : lastSub?.status === "incorrect"
        ? "Répondre"
        : "Nouvelle soumission";

  return (
    <div className={solved ? "rounded-lg border border-emerald-200 bg-emerald-50/40 p-6 -mx-6" : ""}>
      {/* Exercise */}
      <div
        className="leading-relaxed text-slate-800 [&_.katex-display]:my-5"
        dangerouslySetInnerHTML={{ __html: exerciseHtml }}
      />

      <div className="mt-10 border-t border-slate-200 pt-6 flex flex-col gap-8">

        {/* Thread */}
        {submissions.map((sub, i) => (
          <SubmissionItem key={i} sub={sub} />
        ))}

        {/* Editor — appears below thread */}
        {mode === "editing" && (
          <div className="flex flex-col gap-3">
            <div
              className="border border-slate-100 rounded p-4 text-sm bg-slate-50 overflow-auto leading-relaxed [&_.katex-display]:my-3"
              style={{ height: editorH }}
              dangerouslySetInnerHTML={{ __html: renderLatex(answer) }}
            />
            <textarea
              ref={textareaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="border border-slate-200 rounded p-3 font-mono text-sm resize-none overflow-hidden focus:outline-none focus:border-slate-400 bg-white leading-relaxed"
              style={{ minHeight: MIN_H, height: editorH }}
              autoFocus
            />
            <div className="flex items-center gap-3">
              <button
                onClick={saveDraft}
                disabled={!answer.trim()}
                className="text-sm bg-slate-900 text-white px-5 py-2 rounded hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Sauvegarder
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

        {/* Draft — appears below thread */}
        {mode === "draft" && savedAnswer !== null && (
          <div className="flex flex-col gap-4">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Brouillon</span>
            <div
              className="border border-slate-100 rounded p-4 text-sm bg-slate-50 leading-relaxed [&_.katex-display]:my-3"
              dangerouslySetInnerHTML={{ __html: renderLatex(savedAnswer) }}
            />
            <div className="flex items-center gap-3">
              {user ? (
                <button
                  onClick={submit}
                  disabled={loading}
                  className="text-sm bg-slate-900 text-white px-5 py-2 rounded hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {loading ? "Correction…" : "Soumettre"}
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
                className="text-sm text-slate-300 hover:text-slate-500 transition-colors cursor-pointer"
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
