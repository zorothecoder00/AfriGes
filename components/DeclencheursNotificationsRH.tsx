"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Bell, Play, RefreshCw, CheckCircle, Info,
  FileWarning, Calendar, Star, GraduationCap, FileText, Zap,
} from "lucide-react";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Déclencheurs (alignés sur PreferenceNotificationRH / notificationsRH.ts) ────

const DECLENCHEURS: {
  key: string; label: string; desc: string; icon: React.ElementType; color: string;
}[] = [
  { key: "finContrat",       label: "Fin de contrat",        desc: "Scanne les CDD expirant à J-30 et J-7 et notifie collaborateurs + RH.", icon: FileWarning,   color: "text-red-600 bg-red-50" },
  { key: "validationConge",  label: "Validation de congé",   desc: "Rappelle aux managers / RH / Direction les congés en attente de leur validation.", icon: Calendar, color: "text-blue-600 bg-blue-50" },
  { key: "evaluationProg",   label: "Évaluation programmée", desc: "Notifie les collaborateurs dont une évaluation débute sous 7 jours.", icon: Star,          color: "text-amber-600 bg-amber-50" },
  { key: "formationAsuivre", label: "Formation à suivre",    desc: "Notifie les inscrits à une formation débutant sous 3 jours.", icon: GraduationCap, color: "text-emerald-600 bg-emerald-50" },
  { key: "documentExpirant", label: "Document expirant",     desc: "Scanne les documents (CNI, passeport…) expirant sous 30 jours.", icon: FileText,      color: "text-purple-600 bg-purple-50" },
];

interface RunResult { trigger: string; results: Record<string, number>; total: number; scope?: "GLOBAL" | "PDV" }

export default function DeclencheursNotificationsRH({ backHref }: { backHref: string }) {
  const { mutate, loading } = useMutation<RunResult, { trigger: string }>(
    "/api/admin/rh/notifications/declencheurs", "POST",
  );
  const [running, setRunning] = useState<string | null>(null);
  const [counts,  setCounts]  = useState<Record<string, number>>({});
  const [lastRun, setLastRun] = useState<Record<string, string>>({});
  const [scope,   setScope]   = useState<"GLOBAL" | "PDV" | null>(null);

  const lancer = async (trigger: string) => {
    setRunning(trigger);
    const r = await mutate({ trigger });
    setRunning(null);
    if (!r) return;
    if (r.scope) setScope(r.scope);
    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    setCounts((c)  => ({ ...c, ...r.results }));
    setLastRun((l) => {
      const next = { ...l };
      for (const k of Object.keys(r.results)) next[k] = now;
      return next;
    });
    toast.success(
      r.total > 0
        ? `${r.total} notification(s) envoyée(s).`
        : "Aucune notification à envoyer (rien d'éligible).",
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* En-tête */}
        <div>
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft size={15} /> Retour
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-6 h-6 text-emerald-600" /> Déclencheurs de notifications RH
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Lancez manuellement les alertes RH. Elles s&apos;exécutent aussi automatiquement chaque jour.
              </p>
              {scope && (
                <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                  scope === "PDV" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                }`}>
                  Périmètre : {scope === "PDV" ? "votre point de vente uniquement" : "global (toute l'entreprise)"}
                </span>
              )}
            </div>
            <button
              onClick={() => lancer("all")}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {running === "all" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Tout lancer
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800">
          <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p>
            Chaque déclencheur est <b>idempotent</b> : une même alerte n&apos;est envoyée qu&apos;une fois par jour et par destinataire.
            Vous pouvez relancer sans risque de doublon.
          </p>
        </div>

        {/* Cartes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DECLENCHEURS.map((d) => {
            const Icon = d.icon;
            const isRunning = running === d.key || (running === "all" && loading);
            const count = counts[d.key];
            return (
              <div key={d.key} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col">
                <div className="flex items-start gap-3">
                  <span className={`p-2 rounded-lg flex-shrink-0 ${d.color}`}><Icon className="w-5 h-5" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{d.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{d.desc}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-400 min-h-[1.25rem]">
                    {count !== undefined ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {count} envoyée(s){lastRun[d.key] ? ` · ${lastRun[d.key]}` : ""}
                      </span>
                    ) : "Jamais lancé dans cette session"}
                  </div>
                  <button
                    onClick={() => lancer(d.key)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                  >
                    {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Lancer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
