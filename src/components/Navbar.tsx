"use client";
import Link from "next/link";
import { Fragment } from "react";
import { useAuth } from "./AuthProvider";
import { useBreadcrumb } from "@/context/BreadcrumbContext";

export function Navbar() {
  const { user, loading, signIn } = useAuth();
  const { items } = useBreadcrumb();

  return (
    <header className="border-b border-slate-200 bg-[#F8FAFC]">
      <div className="px-6 sm:px-14 lg:px-24 h-14 flex items-center gap-4">
        {/* Path: Poly-LLG / Chapitre / Exercice N */}
        <div className="flex items-center min-w-0 flex-1 text-sm">
          <Link
            href="/"
            className="font-[family-name:var(--font-heading)] text-base font-semibold text-slate-900 hover:text-slate-600 transition-colors flex-shrink-0"
          >
            Poly-LLG
          </Link>
          {items.map((item, i) => (
            <Fragment key={i}>
              <span className="mx-2 text-slate-300 flex-shrink-0 select-none">/</span>
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-slate-500 hover:text-slate-900 transition-colors truncate"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-slate-700 truncate">{item.label}</span>
              )}
            </Fragment>
          ))}
        </div>

        {/* Auth */}
        <div className="flex-shrink-0">
          {!loading && (
            user ? (
              <Link
                href="/profil"
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                {user.displayName ?? "Profil"}
              </Link>
            ) : (
              <button
                onClick={signIn}
                className="text-sm bg-slate-900 text-white px-3.5 py-1.5 rounded hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Se connecter
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
