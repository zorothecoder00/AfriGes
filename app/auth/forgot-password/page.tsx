"use client";

import { useState } from "react";
import Link from "next/link";
import AfriSimeLogo from "@/components/AfriSimeLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur serveur");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden flex items-center justify-center px-4 relative bg-gradient-to-br from-green-400 via-emerald-600 to-emerald-900">

      {/* Bulles décoratives */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-green-300/20 blur-sm" />
      <div className="absolute -bottom-16 left-[5%] w-56 h-56 rounded-full bg-green-200/15 blur-sm" />
      <div className="absolute top-[5%] -right-12 w-48 h-48 rounded-full bg-emerald-300/20 blur-sm" />
      <div className="absolute bottom-[20%] right-[3%] w-36 h-36 rounded-full bg-green-300/15 blur-sm" />
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[length:40px_40px]" />

      <div className="w-full max-w-sm md:max-w-md mx-auto relative z-10 animate-[slideUp_0.6s_ease-out]">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-[0_20px_60px_rgba(44,62,80,0.25)] overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 px-8 py-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_20%,transparent_70%)] animate-pulse opacity-50" />
            <div className="relative z-10 mb-4 flex justify-center">
              <div className="bg-white/97 border border-emerald-100 rounded-2xl px-3 py-2 shadow-lg">
                <AfriSimeLogo className="h-10 w-auto md:h-12" priority />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1 relative z-10 font-serif tracking-tight">
              Mot de passe oublié
            </h1>
            <p className="text-white/85 text-sm relative z-10">
              Un administrateur sera notifié pour vous aider
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-6 md:px-8 md:py-8">
            {submitted ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-slate-700 font-medium">Demande envoyée</p>
                <p className="text-sm text-slate-500">
                  Si un compte est associé à cette adresse, un administrateur a été notifié
                  et vous contactera pour réinitialiser votre mot de passe.
                </p>
                <Link
                  href="/auth/login"
                  className="inline-block mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                >
                  Retour à la connexion
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-slate-500 mb-4">
                  Entrez votre adresse email. Un administrateur recevra une notification
                  pour réinitialiser votre mot de passe.
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-emerald-900 mb-2">
                    Adresse email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.email@exemple.com"
                    required
                    className="w-full px-4 py-3 border border-green-200 rounded-xl focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-green-700 text-white py-4 rounded-xl font-semibold hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(16,185,129,0.3)]"
                >
                  {loading ? "Envoi en cours..." : "Envoyer la demande"}
                </button>

                <div className="text-center pt-2">
                  <Link
                    href="/auth/login"
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                  >
                    Retour à la connexion
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
