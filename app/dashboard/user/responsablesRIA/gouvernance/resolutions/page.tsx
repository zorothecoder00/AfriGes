"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  Gavel, RefreshCw, CheckCircle2, Clock, Circle,
  ArrowLeft, XCircle, PlayCircle,
} from "lucide-react";
import Link from "next/link";

interface Resolution {
  id: number;
  numero: string;
  titre: string;
  typeCommission: string;
  statut: string;
  dateEcheance: string | null;
  plansAction: { id: number; statut: string; progression: number }[];
}

interface Data { resolutions: Resolution[] }

const STATUTS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  EN_ATTENTE:     { label: "En attente",     color: "bg-slate-100 text-slate-600",     icon: <Circle className="w-3.5 h-3.5" /> },
  EN_PREPARATION: { label: "En préparation", color: "bg-slate-100 text-slate-500",     icon: <Circle className="w-3.5 h-3.5" /> },
  SOUMISE:        { label: "Soumise",        color: "bg-blue-100 text-blue-700",       icon: <Clock className="w-3.5 h-3.5" /> },
  APPROUVEE:      { label: "Approuvée",      color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ADOPTEE:        { label: "Adoptée",        color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  REJETEE:        { label: "Rejetée",        color: "bg-rose-100 text-rose-700",       icon: <XCircle className="w-3.5 h-3.5" /> },
  EN_APPLICATION: { label: "En application", color: "bg-amber-100 text-amber-700",     icon: <PlayCircle className="w-3.5 h-3.5" /> },
  APPLIQUEE:      { label: "Appliquée",      color: "bg-teal-100 text-teal-700",       icon: <PlayCircle className="w-3.5 h-3.5" /> },
  EXECUTEE:       { label: "Exécutée",       color: "bg-teal-100 text-teal-700",       icon: <PlayCircle className="w-3.5 h-3.5" /> },
};

const COMM_LABELS: Record<string, string> = {
  FINANCE:           "Finance",
  OPERATIONS_TERRAIN:"Opérations",
  AUDIT:             "Audit",
  OPTIMISATION:      "Optimisation",
};

export default function MesResolutionsPage() {
  const [filterStatut, setFilterStatut] = useState("");
  const [filterComm, setFilterComm] = useState("");
  const [refresh, setRefresh] = useState(0);

  const params = new URLSearchParams();
  if (filterStatut) params.set("statut", filterStatut);
  if (filterComm) params.set("typeCommission", filterComm);
  if (refresh > 0) params.set("_r", String(refresh));
  const { data, loading } = useApi<Data>(`/api/admin/ria/commissions/gouvernance/resolutions?${params.toString()}`);

  const resolutions = data?.resolutions || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/user/responsablesRIA/gouvernance"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Gouvernance
          </Link>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-emerald-600" /> Résolutions de mes commissions
          </h1>
        </div>
        <div className="flex gap-2">
          <select value={filterComm} onChange={e => setFilterComm(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Toutes commissions</option>
            <option value="FINANCE">Finance</option>
            <option value="OPERATIONS_TERRAIN">Opérations</option>
            <option value="AUDIT">Audit</option>
            <option value="OPTIMISATION">Optimisation</option>
          </select>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Tous statuts</option>
            {Object.entries(STATUTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
          <button onClick={() => setRefresh(r => r + 1)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
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
        <div className="space-y-2">
          {resolutions.map(r => {
            const s = STATUTS[r.statut];
            const plansTermines = r.plansAction.filter(p => ["TERMINE", "REALISE"].includes(p.statut)).length;
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-mono text-slate-400">{r.numero}</span>
                      {s && (
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                          {s.icon} {s.label}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{COMM_LABELS[r.typeCommission] || r.typeCommission}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{r.titre}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      {r.dateEcheance && (
                        <span className={new Date(r.dateEcheance) < new Date() ? "text-rose-600 font-medium" : ""}>
                          Éch. {new Date(r.dateEcheance).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {r.plansAction.length > 0 && (
                        <span>{plansTermines}/{r.plansAction.length} plans terminés</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
