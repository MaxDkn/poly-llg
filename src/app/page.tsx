"use client";
import { useAuth } from "@/components/AuthProvider";
import { useState } from "react";
import { createSubmission } from "@/lib/firestore";

export default function Home() {
  const { user, loading, signIn, logOut } = useAuth();
  const [result, setResult] = useState<string>("");

  const testSubmission = async () => {
    if (!user) return;
    try {
      const ref = await createSubmission({
        userId: user.uid,
        exerciseNum: 4,
        answer: "La réponse est $4$.",
        status: "pending",
      });
      setResult(`✅ Soumission créée : ${ref.id}`);
    } catch (e) {
      setResult(`❌ Erreur : ${e}`);
    }
  };

  if (loading) return <p className="p-8">Chargement...</p>;

  return (
    <main className="p-8 space-y-4">
      {user ? (
        <>
          <p>Connecté : <strong>{user.displayName}</strong></p>
          <div className="flex gap-3">
            <button onClick={testSubmission} className="bg-purple-600 text-white px-4 py-2 rounded">
              Tester soumission
            </button>
            <button onClick={logOut} className="bg-red-500 text-white px-4 py-2 rounded">
              Déconnexion
            </button>
          </div>
          {result && <p className="mt-4 font-mono text-sm">{result}</p>}
        </>
      ) : (
        <button onClick={signIn} className="bg-blue-600 text-white px-4 py-2 rounded">
          Se connecter avec Google
        </button>
      )}
    </main>
  );
}