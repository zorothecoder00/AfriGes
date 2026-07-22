"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  PackagePlus, AlertTriangle, CheckCircle2, TrendingUp, CalendarDays,
} from "lucide-react";
import PopcTabs from "../PopcTabs";

interface LigneLivraison { date: string; quinzaine: number; trentaine: number; total: number }
interface PlanResp {
  data: {
    objectifsGeneres: boolean;
    lignes: LigneLivraison[];
    resume: {
      objectifQuinzaine: number; objectifTrentaine: number;
      dejaQuinzaine: number; dejaTrentaine: number;
      resteQuinzaine: number; resteTrentaine: number;
      seiziemesAttendus: number; trentiemesAttendus: number;
      revenusAttendus: number; revenusEncaisses: number;
      joursRestants: number;
    };
  };
}

const fmt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function LivraisonsPage() {
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear());
  const [mois, setMois] = useState(now.getMonth() + 1);
  const { data, loading } = useApi<PlanResp>(`/api/popc/livraisons?annee=${annee}&mois=${mois}`);
  const d = data?.data;
  const r = d?.resume;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PopcTabs />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-indigo-600" /> Planification des crédits à livrer
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Nombre minimum de <strong>nouveaux crédits</strong> à accorder pour atteindre les objectifs — {MOIS[mois - 1]} {annee}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mois} onChange={(e) => setMois(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
            {MOIS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={annee} onChange={(e) => setAnnee(Number(e.target.value))}
            className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm" />
        </div>
      </div>

      {!loading && d && !d.objectifsGeneres && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4" /> Aucun objectif généré pour ce mois — renseignez le paramétrage dans l&apos;onglet Objectifs.
        </div>
      )}

      {/* Résumé du reste à livrer */}
      {r && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RecapCard label="Quinzaine à livrer" reste={r.resteQuinzaine} objectif={r.objectifQuinzaine} deja={r.dejaQuinzaine} />
          <RecapCard label="Trentaine à livrer" reste={r.resteTrentaine} objectif={r.objectifTrentaine} deja={r.dejaTrentaine} />
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-1.5 text-gray-400 text-xs"><CalendarDays className="w-4 h-4" /> Crédits arrivant à échéance</div>
            <div className="text-lg font-bold text-gray-800 mt-1">{fmt(r.seiziemesAttendus + r.trentiemesAttendus)}</div>
            <p className="text-xs text-gray-400 mt-0.5">{r.seiziemesAttendus} × 16e · {r.trentiemesAttendus} × 31e</p>
          </div>
          <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 shadow-sm">
            <div className="flex items-center gap-1.5 text-indigo-500 text-xs"><TrendingUp className="w-4 h-4" /> Revenus attendus</div>
            <div className="text-lg font-bold text-indigo-700 mt-1">{fmt(r.revenusAttendus)} F</div>
            <p className="text-xs text-indigo-400 mt-0.5">encaissé : {fmt(r.revenusEncaisses)} F</p>
          </div>
        </div>
      )}

      {/* Tableau §7 : Date | Quinzaine | Trentaine | Total */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Date</th>
              <th className="text-right px-5 py-3 font-medium">Quinzaine</th>
              <th className="text-right px-5 py-3 font-medium">Trentaine</th>
              <th className="text-right px-5 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Chargement…</td></tr>
            ) : !d || d.lignes.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                {d && !d.objectifsGeneres ? "Objectifs non générés." : "Aucun jour restant à planifier ce mois."}
              </td></tr>
            ) : d.lignes.map((l) => {
              const estAujourdhui = l.date === today;
              return (
                <tr key={l.date} className={`border-t border-gray-50 ${estAujourdhui ? "bg-indigo-50/40" : ""}`}>
                  <td className="px-5 py-2.5 text-gray-700">
                    {new Date(l.date).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })}
                    {estAujourdhui && <span className="ml-2 text-xs text-indigo-500 font-medium">aujourd&apos;hui</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right text-gray-700">{l.quinzaine}</td>
                  <td className="px-5 py-2.5 text-right text-gray-700">{l.trentaine}</td>
                  <td className="px-5 py-2.5 text-right font-semibold text-gray-900">{l.total}</td>
                </tr>
              );
            })}
          </tbody>
          {d && d.lignes.length > 0 && (
            <tfoot className="bg-gray-50 font-semibold text-gray-800">
              <tr>
                <td className="px-5 py-3">Total à livrer</td>
                <td className="px-5 py-3 text-right">{fmt(d.lignes.reduce((s, l) => s + l.quinzaine, 0))}</td>
                <td className="px-5 py-3 text-right">{fmt(d.lignes.reduce((s, l) => s + l.trentaine, 0))}</td>
                <td className="px-5 py-3 text-right">{fmt(d.lignes.reduce((s, l) => s + l.total, 0))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Plan réparti sur les {r?.joursRestants ?? 0} jour(s) restant(s) du mois. Il s&apos;agit de <strong>crédits commerciaux</strong> à accorder (Quinzaine/Trentaine), à ne pas confondre avec les livraisons physiques de produits.
      </p>
    </div>
  );
}

function RecapCard({ label, reste, objectif, deja }: { label: string; reste: number; objectif: number; deja: number }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="text-gray-400 text-xs">{label}</div>
      <div className="text-2xl font-bold text-gray-800 mt-1">{fmt(reste)}</div>
      <p className="text-xs text-gray-400 mt-0.5">{fmt(deja)} / {fmt(objectif)} déjà accordés</p>
    </div>
  );
}
