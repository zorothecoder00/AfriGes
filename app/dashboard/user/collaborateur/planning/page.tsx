"use client";

import { RefreshCw, CalendarClock, Info } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AffectationCollab {
  id:         number;
  date:       string;
  heureDebut: string;
  heureFin:   string;
  role:       string | null;
  notes:      string | null;
  planning:   { id: number; semaineDebut: string };
}

interface PlanningResponse {
  profilRH:     { id: number; matricule: string } | null;
  affectations: AffectationCollab[];
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PlanningCollaborateurPage() {
  const { data, loading, refetch } = useApi<PlanningResponse>("/api/collaborateur/planning");
  const profilRH = data?.profilRH ?? null;
  const affectations = data?.affectations ?? [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  if (data && profilRH === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
          <Info className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-slate-900">Aucun dossier RH</h1>
          <p className="text-sm text-slate-500 mt-2">
            Votre compte n&apos;est pas rattaché à un dossier RH.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mon planning</h1>
            <p className="text-sm text-slate-500 mt-0.5">Affectations d&apos;équipe des 14 prochains jours</p>
          </div>
          <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {affectations.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <CalendarClock className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune affectation planifiée pour le moment</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {affectations.map((a) => (
              <div key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-24 flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-800">{JOURS[(new Date(a.date).getDay() + 6) % 7]}</p>
                  <p className="text-xs text-slate-400">{formatDate(a.date)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{a.heureDebut} – {a.heureFin}</p>
                  {a.role && <p className="text-xs text-slate-500 mt-0.5">{a.role}</p>}
                  {a.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{a.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
