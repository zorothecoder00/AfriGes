"use client";

import { RefreshCw, Star, Printer, Info } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";

interface Evaluation {
  id: number; periode: string; annee: number; statut: string; typeEvaluation: string | null;
  noteGlobale: number | string | null; dateDebut: string; dateFin: string | null;
  evaluateur: { gestionnaire: { member: { nom: string; prenom: string } } } | null;
}

const PERIODE_LABEL: Record<string, string> = {
  ANNUELLE: "Annuelle", SEMESTRIELLE: "Semestrielle", TRIMESTRIELLE: "Trimestrielle", PROBATOIRE: "Probatoire",
};
const STATUT_CONFIG: Record<string, { label: string; badge: string }> = {
  OBJECTIFS_FIXES:    { label: "Objectifs fixés",     badge: "bg-blue-100 text-blue-700" },
  EN_COURS:           { label: "En cours",            badge: "bg-amber-100 text-amber-700" },
  EVALUATION:         { label: "En évaluation",       badge: "bg-amber-100 text-amber-700" },
  VALIDATION:         { label: "En validation",       badge: "bg-indigo-100 text-indigo-700" },
  PLAN_AMELIORATION:  { label: "Plan d'amélioration",  badge: "bg-purple-100 text-purple-700" },
  CLOTURE:            { label: "Clôturée",            badge: "bg-emerald-100 text-emerald-700" },
};

export default function EvaluationsCollaborateurPage() {
  const { data, loading, refetch } = useApi<{ data: Evaluation[] }>("/api/collaborateur/evaluations");
  const evaluations = data?.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mes évaluations</h1>
            <p className="text-sm text-slate-500 mt-0.5">Historique de vos fiches d&apos;évaluation</p>
          </div>
          <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : evaluations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <Info className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-slate-900">Aucune évaluation disponible</h2>
            <p className="text-sm text-slate-500 mt-2">Vos fiches d&apos;évaluation apparaîtront ici une fois engagées par le RH.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {evaluations.map((e) => {
              const cfg = STATUT_CONFIG[e.statut] ?? STATUT_CONFIG.EN_COURS;
              const evaluateur = e.evaluateur?.gestionnaire.member;
              return (
                <div key={e.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0">
                    <Star className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{PERIODE_LABEL[e.periode] ?? e.periode} {e.annee}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                      {e.noteGlobale != null && (
                        <span className="text-xs font-semibold text-slate-600">{e.noteGlobale}/5</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Débutée le {formatDate(e.dateDebut)}
                      {evaluateur && ` · Évaluateur : ${evaluateur.prenom} ${evaluateur.nom}`}
                    </p>
                  </div>
                  <a
                    href={`/api/collaborateur/evaluations/${e.id}/pdf`}
                    target="_blank" rel="noreferrer"
                    title="Imprimer ma fiche d'évaluation"
                    className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    <Printer className="w-4 h-4" />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
