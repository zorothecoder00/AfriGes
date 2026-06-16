"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  GitBranch, RefreshCw, ArrowRight, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface DossierIC {
  id: number;
  reference: string;
  titre: string;
  type: string;
  statut: string;
  priorite: string;
  commissionEmettrice: string;
  commissionReceptrice: string;
  creePar: { nom: string; prenom: string };
  dateEcheance: string | null;
  createdAt: string;
  _count: { echanges: number };
}

interface Data { dossiers: DossierIC[] }

const STATUTS: Record<string, { label: string; color: string }> = {
  BROUILLON:  { label: "Brouillon",      color: "bg-slate-100 text-slate-600" },
  TRANSMIS:   { label: "Transmis",       color: "bg-blue-100 text-blue-700" },
  RECU:       { label: "Reçu",           color: "bg-indigo-100 text-indigo-700" },
  EN_ANALYSE: { label: "En analyse",     color: "bg-amber-100 text-amber-700" },
  APPROUVE:   { label: "Approuvé",       color: "bg-emerald-100 text-emerald-700" },
  REJETE:     { label: "Rejeté",         color: "bg-rose-100 text-rose-700" },
  AJUSTEMENT: { label: "Ajust. demandé", color: "bg-orange-100 text-orange-700" },
  EXECUTE:    { label: "Exécuté",        color: "bg-teal-100 text-teal-700" },
};

const COMM_LABELS: Record<string, string> = {
  FINANCE:           "Finance",
  OPERATIONS_TERRAIN:"Opérations",
  AUDIT:             "Audit",
  OPTIMISATION:      "Optimisation",
};

export default function MesDossiersPage() {
  const [filterSens, setFilterSens] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [refresh, setRefresh] = useState(0);

  const params = new URLSearchParams();
  if (filterSens) params.set("sens", filterSens);
  if (filterStatut) params.set("statut", filterStatut);
  if (refresh > 0) params.set("_r", String(refresh));
  const { data, loading } = useApi<Data>(`/api/membreCommission/dossiers?${params.toString()}`);

  const dossiers = data?.dossiers || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/user/responsablesRIA/gouvernance"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Gouvernance
          </Link>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-violet-600" /> Dossiers Inter-Commissions
          </h1>
        </div>
        <div className="flex gap-2">
          <select value={filterSens} onChange={e => setFilterSens(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Tous les sens</option>
            <option value="emis">Émis par moi</option>
            <option value="recus">Reçus</option>
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
          <div className="w-7 h-7 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dossiers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucun dossier inter-commission</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dossiers.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs font-mono text-slate-400">{d.reference}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUTS[d.statut]?.color || "bg-slate-100 text-slate-600"}`}>
                      {STATUTS[d.statut]?.label || d.statut}
                    </span>
                    <span className={`text-xs ${d.priorite === "CRITIQUE" ? "text-rose-600 font-medium" : d.priorite === "HAUTE" ? "text-amber-600" : "text-slate-400"}`}>
                      {d.priorite}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{d.titre}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      {COMM_LABELS[d.commissionEmettrice] || d.commissionEmettrice}
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      {COMM_LABELS[d.commissionReceptrice] || d.commissionReceptrice}
                    </span>
                    <span>{d._count.echanges} échanges</span>
                    {d.dateEcheance && (
                      <span className={new Date(d.dateEcheance) < new Date() ? "text-rose-600 font-medium" : ""}>
                        Éch. {new Date(d.dateEcheance).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>
                </div>
                <a href={`/dashboard/user/responsablesRIA/gouvernance/dossiers/${d.id}`}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
                  Voir
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
