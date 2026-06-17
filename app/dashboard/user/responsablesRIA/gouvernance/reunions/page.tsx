"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Calendar, RefreshCw, CheckCircle2, Clock, MapPin,
  Users, PenLine, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface Reunion {
  id: number;
  titre: string;
  typeCommission: string;
  dateHeure: string;
  lieu: string | null;
  statut: string;
  convocationEnvoyee: boolean;
  organisateur: { nom: string; prenom: string };
  presences: { present: boolean; signatureNumerique: boolean; dateSignature: string | null }[];
  compteRenduStr: { id: number; dateValidation: string | null } | null;
  _count: { resolutions: number };
}

interface Data { reunions: Reunion[] }

const STATUTS: Record<string, string> = {
  PLANIFIEE: "bg-blue-100 text-blue-700",
  EN_COURS:  "bg-emerald-100 text-emerald-700",
  TENUE:     "bg-slate-100 text-slate-600",
  ANNULEE:   "bg-rose-100 text-rose-700",
  REPORTEE:  "bg-amber-100 text-amber-700",
};

const COMM_LABELS: Record<string, string> = {
  FINANCE:            "Finance",
  OPERATIONS_TERRAIN: "Opérations",
  AUDIT:     "Audit & Contrôle",
  OPTIMISATION:       "Optimisation",
};

export default function MesReunionsPage() {
  const [filterStatut, setFilterStatut] = useState("");
  const [refresh, setRefresh] = useState(0);

  const params = new URLSearchParams();
  if (filterStatut) params.set("statut", filterStatut);
  if (refresh > 0) params.set("_r", String(refresh));
  const { data, loading } = useApi<Data>(`/api/membreCommission/reunions?${params.toString()}`);

  async function handleSigner(reunionId: number) {
    const res = await fetch(`/api/admin/ria/commissions/gouvernance/reunions/${reunionId}/presences/signer`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (json?.id || json?.signatureNumerique) {
      toast.success("Présence signée numériquement");
      setRefresh(r => r + 1);
    } else {
      toast.error(json?.error || "Erreur lors de la signature");
    }
  }

  const reunions = data?.reunions || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/user/responsablesRIA/gouvernance"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Gouvernance
          </Link>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" /> Mes Réunions
          </h1>
        </div>
        <div className="flex gap-2">
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Tous statuts</option>
            {Object.entries(STATUTS).map(([v]) => <option key={v} value={v}>{v}</option>)}
          </select>
          <button onClick={() => setRefresh(r => r + 1)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reunions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucune réunion</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reunions.map(r => {
            const presence = r.presences[0];
            const isPresent = presence?.present;
            const isSigned = presence?.signatureNumerique;
            const isFuture = new Date(r.dateHeure) > new Date();
            const isOngoing = r.statut === "EN_COURS" || r.statut === "PLANIFIEE";

            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUTS[r.statut] || "bg-slate-100 text-slate-600"}`}>
                        {r.statut}
                      </span>
                      <span className="text-xs text-slate-400">{COMM_LABELS[r.typeCommission] || r.typeCommission}</span>
                      {r.convocationEnvoyee && (
                        <span className="text-xs text-blue-500 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Convoqué
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800">{r.titre}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(r.dateHeure).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" })}
                        {" à "}
                        {new Date(r.dateHeure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {r.lieu && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.lieu}</span>}
                      <span>{r._count.resolutions} résolutions</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {isPresent !== undefined && (
                      <div className="flex items-center gap-1.5">
                        {isPresent ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-emerald-600">Présent</span>
                            {isSigned ? (
                              <span className="text-xs text-blue-500 flex items-center gap-0.5">
                                <PenLine className="w-3 h-3" /> Signé
                              </span>
                            ) : !isFuture && isOngoing ? (
                              <button onClick={() => handleSigner(r.id)}
                                className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                                Signer
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Absent</span>
                        )}
                      </div>
                    )}
                    {r.compteRenduStr && (
                      <a href={`/dashboard/user/responsablesRIA/gouvernance/reunions/${r.id}/compte-rendu`}
                        className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Lire le CR
                      </a>
                    )}
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
