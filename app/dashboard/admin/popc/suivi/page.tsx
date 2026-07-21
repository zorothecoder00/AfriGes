"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { CalendarCheck, TrendingUp, AlertTriangle } from "lucide-react";
import PopcTabs from "../PopcTabs";

interface IndicateurSuivi { indicateur: string; objectif: number; realise: number; reste: number }
interface SuiviResp {
  data: {
    date: string; tauxRealisation: number; objectifsGeneres: boolean;
    indicateurs: IndicateurSuivi[];
  };
}

const fmt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));

export default function SuiviJournalierPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data, loading } = useApi<SuiviResp>(
    `/api/popc/suivi-journalier?date=${date}`,
    undefined,
    { refreshInterval: 60000 }, // temps réel (CDC §8)
  );

  const d = data?.data;
  const taux = d?.tauxRealisation ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PopcTabs />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-indigo-600" /> Suivi journalier
          </h1>
          <p className="text-sm text-gray-500 mt-1">Objectif vs réalisé — mis à jour en temps réel (§8)</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white" />
      </div>

      {!loading && d && !d.objectifsGeneres && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4" /> Aucun objectif généré pour ce mois — les colonnes « Objectif » restent à 0. Renseignez le paramétrage dans l&apos;onglet Objectifs.
        </div>
      )}

      {/* Taux de réalisation */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-100 text-sm flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Taux de réalisation (montant collecté)</p>
            <p className="text-3xl font-bold mt-1">{taux}%</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(100, taux)}%` }} />
        </div>
      </div>

      {/* Tableau indicateurs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Indicateur</th>
              <th className="text-right px-5 py-3 font-medium">Objectif</th>
              <th className="text-right px-5 py-3 font-medium">Réalisé</th>
              <th className="text-right px-5 py-3 font-medium">Reste</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Chargement…</td></tr>
            ) : d?.indicateurs.map((i) => {
              const atteint = i.realise >= i.objectif && i.objectif > 0;
              return (
                <tr key={i.indicateur} className="border-t border-gray-50">
                  <td className="px-5 py-3 text-gray-700">{i.indicateur}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{fmt(i.objectif)}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${atteint ? "text-emerald-600" : "text-gray-800"}`}>{fmt(i.realise)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{fmt(i.reste)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        Encaissements lus des remboursements confirmés ; 16èmes/31èmes = dernière échéance des crédits Quinzaine/Trentaine ; aucune ressaisie.
      </p>
    </div>
  );
}
