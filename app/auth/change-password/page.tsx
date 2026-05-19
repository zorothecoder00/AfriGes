"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import AfriSimeLogo from "@/components/AfriSimeLogo";

export default function ChangePasswordPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent]         = useState(false);
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }

      // Mot de passe changé → déconnecter et rediriger vers login avec message succès
      await signOut({ callbackUrl: "/auth/login?changed=true" });
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative bg-gradient-to-br from-green-400 via-emerald-600 to-emerald-900">
      {/* Bulles décoratives */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-green-300/20 blur-sm" />
      <div className="absolute -bottom-16 left-[5%] w-56 h-56 rounded-full bg-green-200/15 blur-sm" />
      <div className="absolute top-[5%] -right-12 w-48 h-48 rounded-full bg-emerald-300/20 blur-sm" />
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[length:40px_40px]" />

      <div className="w-full max-w-sm md:max-w-md mx-auto relative z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-[0_20px_60px_rgba(44,62,80,0.25)] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 px-8 py-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_20%,transparent_70%)] opacity-50" />
            <div className="relative z-10 mb-4 flex justify-center">
              <div className="bg-white/97 border border-emerald-100 rounded-2xl px-3 py-2 shadow-lg">
                <AfriSimeLogo className="h-10 w-auto md:h-12" priority />
              </div>
            </div>
            <div className="relative z-10 flex justify-center mb-3">
              <div className="bg-amber-400/20 border border-amber-300/40 rounded-full p-3">
                <Lock size={22} className="text-amber-300" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white relative z-10">Changement de mot de passe</h1>
            <p className="text-white/75 text-sm mt-1 relative z-10">
              Votre mot de passe temporaire doit être changé avant de continuer.
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-6 md:px-8">
            {session?.user && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {session.user.prenom?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">{session.user.prenom} {session.user.nom}</p>
                  <p className="text-xs text-emerald-600">{session.user.email}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* Mot de passe actuel */}
              <div>
                <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                  Mot de passe actuel (temporaire) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-green-200 rounded-xl focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all pr-12"
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-700 transition-colors">
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Nouveau mot de passe */}
              <div>
                <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                  Nouveau mot de passe <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Minimum 8 caractères"
                    className="w-full px-4 py-3 border border-green-200 rounded-xl focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all pr-12"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-700 transition-colors">
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-1.5 flex gap-1">
                    {[
                      { label: "8+ car.", ok: newPassword.length >= 8 },
                      { label: "Majuscule", ok: /[A-Z]/.test(newPassword) },
                      { label: "Chiffre", ok: /\d/.test(newPassword) },
                    ].map((r) => (
                      <span key={r.label} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                        {r.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirmer */}
              <div>
                <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                  Confirmer le nouveau mot de passe <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-4 transition-all pr-12 ${
                      confirmPassword && confirmPassword !== newPassword
                        ? "border-red-300 focus:ring-red-100 focus:border-red-400"
                        : "border-green-200 focus:ring-emerald-100 focus:border-emerald-600"
                    }`}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-700 transition-colors">
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword === newPassword && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <ShieldCheck size={12} /> Les mots de passe correspondent
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                className="w-full bg-gradient-to-r from-emerald-600 to-green-700 text-white py-3.5 rounded-xl font-semibold hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 shadow-[0_4px_15px_rgba(16,185,129,0.3)] mt-2">
                {loading ? "Enregistrement…" : "Changer mon mot de passe"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
