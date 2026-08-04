"use client";

// Contrôles comptables.
// Extrait du bloc activeTab === "controles" du monolithe (app/dashboard/user/comptables/page.tsx,
// ~ligne 4736), consommant /api/comptable/controles (~ligne 1393 du monolithe).
import { useApi } from "@/hooks/useApi";
import { CheckCircle, RefreshCw, AlertCircle } from "lucide-react";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

interface ConstatControleEntry {
  code: string; gravite: "BLOQUANT" | "ANOMALIE"; message: string;
  entiteType?: string; entiteId?: number; montant?: number; date?: string;
}

export default function ControlesPage() {
  const { data: controlesData, loading: controlesLoading, refetch: refetchControles } =
    useApi<{ data: ConstatControleEntry[]; meta: { bloquants: number; anomalies: number; total: number } }>(
      "/api/comptable/controles"
    );

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <CheckCircle className="text-emerald-600" size={22} /> Contrôles comptables
        </h2>
        {AIDE_COMPTABLE.controles && <AideComptable contenu={AIDE_COMPTABLE.controles} />}
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle className="text-emerald-600" size={20} /> Contrôles comptables
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {controlesData
                ? `${controlesData.meta.bloquants} bloquant(s) · ${controlesData.meta.anomalies} anomalie(s)`
                : "Écritures déséquilibrées, comptes d'attente, soldes de trésorerie négatifs, doublons potentiels (CDC §40-42)"}
            </p>
          </div>
          <button onClick={() => refetchControles()} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <RefreshCw size={15} /> Relancer les contrôles
          </button>
        </div>

        {controlesLoading ? (
          <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
        ) : (controlesData?.data ?? []).length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-emerald-200 shadow-sm">
            <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-emerald-700 font-semibold">Aucune anomalie détectée</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(controlesData?.data ?? []).map((c, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${c.gravite === "BLOQUANT" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                <AlertCircle size={16} className={`mt-0.5 flex-shrink-0 ${c.gravite === "BLOQUANT" ? "text-red-500" : "text-amber-500"}`} />
                <div className="flex-1">
                  <span className={`text-xs font-bold uppercase ${c.gravite === "BLOQUANT" ? "text-red-600" : "text-amber-600"}`}>{c.gravite}</span>
                  <p className="text-sm text-slate-700">{c.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
