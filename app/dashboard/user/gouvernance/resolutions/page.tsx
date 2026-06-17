"use client";

import { useApi } from "@/hooks/useApi";
import { commissionLabel } from "@/lib/commissionsRIA";
import { Gavel, ListChecks, Calendar } from "lucide-react";

interface Resolution {
  id: number;
  typeCommission: string;
  numero: string;
  titre: string;
  description: string | null;
  statut: string;
  dateEcheance: string | null;
  reunion: { id: number; titre: string; dateHeure: string } | null;
  responsable: { id: number; nom: string; prenom: string } | null;
  plansAction: { id: number; statut: string; progression: number }[];
}

interface Data { resolutions: Resolution[] }

const STATUTS: Record<string, { label: string; color: string }> = {
  EN_ATTENTE:     { label: "En attente",     color: "bg-slate-100 text-slate-600" },
  EN_PREPARATION: { label: "En préparation", color: "bg-slate-100 text-slate-600" },
  SOUMISE:        { label: "Soumise",        color: "bg-blue-100 text-blue-700" },
  APPROUVEE:      { label: "Approuvée",      color: "bg-emerald-100 text-emerald-700" },
  ADOPTEE:        { label: "Adoptée",        color: "bg-emerald-100 text-emerald-700" },
  EN_APPLICATION: { label: "En application", color: "bg-amber-100 text-amber-700" },
  APPLIQUEE:      { label: "Appliquée",      color: "bg-teal-100 text-teal-700" },
  EXECUTEE:       { label: "Exécutée",       color: "bg-teal-100 text-teal-700" },
  REJETEE:        { label: "Rejetée",        color: "bg-rose-100 text-rose-700" },
};

export default function MesResolutionsPage() {
  const { data, loading } = useApi<Data>("/api/membreCommission/resolutions");
  const resolutions = data?.resolutions ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Gavel className="w-5 h-5 text-emerald-600" /> Résolutions
        </h1>
        <p className="text-sm text-slate-500">Résolutions des commissions dont je suis membre</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : resolutions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <Gavel className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucune résolution</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resolutions.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono text-slate-400">{r.numero}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUTS[r.statut]?.color || "bg-slate-100 text-slate-600"}`}>
                      {STATUTS[r.statut]?.label || r.statut}
                    </span>
                    <span className="text-xs text-slate-400">{commissionLabel(r.typeCommission)}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{r.titre}</h3>
                  {r.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{r.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                    {r.responsable && <span>Resp. {r.responsable.prenom} {r.responsable.nom}</span>}
                    {r.plansAction.length > 0 && (
                      <span className="flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" /> {r.plansAction.length} plan(s)</span>
                    )}
                    {r.reunion && (
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {r.reunion.titre}</span>
                    )}
                  </div>
                </div>
                {r.dateEcheance && (
                  <p className="text-xs text-slate-400 shrink-0">Échéance {new Date(r.dateEcheance).toLocaleDateString("fr-FR")}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
