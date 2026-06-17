"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, ClipboardList, Calendar, CheckCircle2 } from "lucide-react";

interface Reunion {
  id: number; titre: string; statut: string; dateHeure: string;
  typeCommission: string; lieu: string | null;
}
interface ReuResponse { reunions: Reunion[] }

const STATUT_STYLE: Record<string, string> = {
  PLANIFIEE: "bg-blue-50 text-blue-700",
  EN_COURS:  "bg-amber-50 text-amber-700",
  TENUE:     "bg-emerald-50 text-emerald-700",
  ANNULEE:   "bg-red-50 text-red-700",
};

export default function ProgrammePage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<ReuResponse>(`/api/admin/ria/commissions/gouvernance/reunions?typeCommission=AUDIT&limit=30&_r=${refresh}`);

  if (type !== "audit-controle") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Audit & Contrôle.</div>
  );

  const items = data?.reunions ?? [];
  const planifiees = items.filter(r => r.statut === "PLANIFIEE").length;
  const tenues     = items.filter(r => r.statut === "TENUE").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Programme d&apos;Audit</h1>
          <p className="text-sm text-slate-500">Planification et suivi des sessions d&apos;audit</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <ClipboardList className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-slate-800">{items.length}</p>
          <p className="text-xs text-slate-500">Sessions totales</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-blue-700">{planifiees}</p>
          <p className="text-xs text-slate-500">Planifiées</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-emerald-700">{tenues}</p>
          <p className="text-xs text-slate-500">Tenues</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-800">Calendrier des sessions d&apos;audit</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Aucune session d&apos;audit planifiée</p>
            <p className="text-slate-400 text-xs mt-1">Planifiez des réunions depuis le module Réunions & Sessions</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(r => (
              <div key={r.id} className="px-5 py-4 hover:bg-slate-50 flex items-start gap-4">
                <div className="bg-amber-50 text-amber-700 rounded-lg p-2 text-center w-14 flex-shrink-0">
                  <p className="text-xs font-medium">
                    {new Date(r.dateHeure).toLocaleDateString("fr", { month: "short" }).toUpperCase()}
                  </p>
                  <p className="text-lg font-bold leading-none">
                    {new Date(r.dateHeure).getDate()}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{r.titre}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(r.dateHeure).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })}
                    {r.lieu && ` · ${r.lieu}`}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUT_STYLE[r.statut] ?? "bg-slate-50 text-slate-600"}`}>
                  {r.statut}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
