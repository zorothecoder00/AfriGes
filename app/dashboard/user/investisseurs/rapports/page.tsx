"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { FileText, RefreshCw, ChevronRight } from "lucide-react";
import { useApi } from "@/hooks/useApi";

interface RapportItem {
  id: number; portefeuilleId: number; portefeuille: string;
  mois: number; annee: number; label: string; createdAt: string;
}
interface RapportsData { rapports: RapportItem[]; total: number }

const ANNEE_COURANTE = new Date().getFullYear();

export default function RapportsInvestisseurPage() {
  const [filtreAnnee, setFiltreAnnee] = useState<string>("");

  const url = `/api/investisseurRIA/rapports${filtreAnnee ? `?annee=${filtreAnnee}` : ""}`;
  const { data, loading, error, refetch } = useApi<RapportsData>(url);

  const anneesDisponibles = useMemo(() => {
    if (!data) return [ANNEE_COURANTE];
    const set = new Set(data.rapports.map((r) => r.annee));
    set.add(ANNEE_COURANTE);
    return Array.from(set).sort((a, b) => b - a);
  }, [data]);

  if (loading) return (
    <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin" /> Chargement…
    </div>
  );
  if (error || !data) return (
    <div className="p-8 text-red-600">Erreur. <button onClick={refetch} className="underline">Réessayer</button></div>
  );

  const liste = data.rapports;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mes Rapports Mensuels</h1>
        <p className="text-sm text-slate-500 mt-0.5">Consultez et téléchargez vos rapports de performance</p>
      </div>

      {/* Filtre année */}
      <div>
        <select value={filtreAnnee} onChange={(e) => setFiltreAnnee(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
          <option value="">Toutes les années</option>
          {anneesDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {liste.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucun rapport disponible</p>
          <p className="text-sm text-slate-400 mt-1">Les rapports mensuels sont générés par votre gestionnaire.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {liste.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/user/investisseurs/rapports/${r.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 group-hover:text-emerald-700">{r.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.portefeuille}</p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>Généré le {new Date(r.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
            </Link>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">{liste.length} rapport(s)</p>
    </div>
  );
}
