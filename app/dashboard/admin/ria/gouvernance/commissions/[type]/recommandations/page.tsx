"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, CheckSquare, FileText } from "lucide-react";

interface Resolution {
  id: number; titre: string; description: string; statut: string;
  priorite: string; dateEcheance: string | null; createdAt: string;
  responsable: { nom: string; prenom: string } | null;
  commission: { nom: string; type: string };
}
interface ResResponse { resolutions: Resolution[] }

const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE:     "bg-slate-50 text-slate-600",
  EN_COURS:       "bg-blue-50 text-blue-700",
  MISE_EN_OEUVRE: "bg-amber-50 text-amber-700",
  IMPLEMENTEE:    "bg-emerald-50 text-emerald-700",
  ABANDONNEE:     "bg-red-50 text-red-700",
};
const PRIORITE_STYLE: Record<string, string> = {
  BASSE:   "bg-slate-100 text-slate-600",
  NORMALE: "bg-blue-50 text-blue-700",
  HAUTE:   "bg-amber-50 text-amber-700",
  URGENTE: "bg-rose-50 text-rose-700",
};

export default function RecommandationsAuditPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<ResResponse>(
    `/api/admin/ria/commissions/gouvernance/resolutions?typeCommission=AUDIT&limit=30&_r=${refresh}`
  );

  if (type !== "audit-controle") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Audit & Contrôle.</div>
  );

  const items = data?.resolutions ?? [];
  const implementees = items.filter(r => r.statut === "IMPLEMENTEE").length;
  const enCours      = items.filter(r => ["EN_COURS", "MISE_EN_OEUVRE"].includes(r.statut)).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Recommandations d&apos;Audit</h1>
          <p className="text-sm text-slate-500">Résolutions et recommandations issues des sessions d&apos;audit</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{items.length}</p>
          <p className="text-xs text-slate-500">Recommandations total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{enCours}</p>
          <p className="text-xs text-slate-500">En cours de mise en œuvre</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{implementees}</p>
          <p className="text-xs text-slate-500">Implémentées</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-800">Liste des recommandations</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <FileText className="w-8 h-8 text-slate-300" />
            <p className="text-slate-500 text-sm">Aucune recommandation d&apos;audit enregistrée</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(r => (
              <div key={r.id} className="px-5 py-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{r.titre}</p>
                    {r.description && <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{r.description}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {r.responsable && (
                        <span className="text-xs text-slate-400">
                          Responsable : {r.responsable.prenom} {r.responsable.nom}
                        </span>
                      )}
                      {r.dateEcheance && (
                        <span className="text-xs text-slate-400">
                          Échéance : {new Date(r.dateEcheance).toLocaleDateString("fr")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[r.statut] ?? "bg-slate-50 text-slate-600"}`}>
                      {r.statut.replace("_", " ")}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITE_STYLE[r.priorite] ?? "bg-slate-50 text-slate-600"}`}>
                      {r.priorite}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
