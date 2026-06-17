"use client";

import { useApi } from "@/hooks/useApi";
import { commissionLabel } from "@/lib/commissionsRIA";
import { Calendar, MapPin, CheckCircle2, FileText, Users } from "lucide-react";

interface Reunion {
  id: number;
  typeCommission: string;
  titre: string;
  dateHeure: string;
  lieu: string | null;
  statut: string;
  organisateur: { nom: string; prenom: string };
  presences: { present: boolean; signatureNumerique: boolean; dateSignature: string | null }[];
  compteRenduStr: { id: number; dateValidation: string | null } | null;
  _count: { resolutions: number };
}

interface Data { reunions: Reunion[] }

const STATUTS: Record<string, { label: string; color: string }> = {
  PLANIFIEE: { label: "Planifiée", color: "bg-blue-100 text-blue-700" },
  EN_COURS:  { label: "En cours",  color: "bg-emerald-100 text-emerald-700" },
  TENUE:     { label: "Tenue",     color: "bg-slate-100 text-slate-600" },
  ANNULEE:   { label: "Annulée",   color: "bg-rose-100 text-rose-700" },
  REPORTEE:  { label: "Reportée",  color: "bg-amber-100 text-amber-700" },
};

export default function MesReunionsPage() {
  const { data, loading } = useApi<Data>("/api/membreCommission/reunions");
  const reunions = data?.reunions ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" /> Mes réunions
        </h1>
        <p className="text-sm text-slate-500">Réunions des commissions dont je suis membre</p>
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
            const maPresence = r.presences[0];
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUTS[r.statut]?.color || "bg-slate-100 text-slate-600"}`}>
                        {STATUTS[r.statut]?.label || r.statut}
                      </span>
                      <span className="text-xs text-slate-400">{commissionLabel(r.typeCommission)}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800">{r.titre}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(r.dateHeure).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {r.lieu && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {r.lieu}</span>}
                      <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {r._count.resolutions} résolutions</span>
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {r.organisateur.prenom} {r.organisateur.nom}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    {maPresence ? (
                      maPresence.signatureNumerique ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Présence signée
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">{maPresence.present ? "Présent" : "Absent"}</span>
                      )
                    ) : (
                      <span className="text-xs text-slate-300">Présence non enregistrée</span>
                    )}
                    {r.compteRenduStr?.dateValidation && (
                      <p className="text-xs text-teal-600">Compte rendu validé</p>
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
