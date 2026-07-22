"use client";

import { useState, type ReactNode } from "react";
import { useApi } from "@/hooks/useApi";
import {
  LayoutDashboard, ShieldCheck, TrendingUp, Users, FileText,
  BookOpen, Wallet, Target, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import PopcTabs from "../PopcTabs";

interface DirectionData {
  objectifsGeneres: boolean;
  chargesTotales: number; revenuMinimum: number;
  chargesCouvertes: number; resultatPrevisionnel: number; beneficeEstime: number;
  clientsActifs: number; clientsEnRetard: number; clientsSoldes: number; nouveauxCredits: number;
  seiziemesAttendus: number; trentiemesAttendus: number;
  revenusAttendus: number; revenusEncaisses: number;
  carnetsVendus: number; objectifAtteint: boolean;
  // §15.1 — comparaison charges budget/réel (global uniquement)
  comparaisonChargesDisponible: boolean; chargesReelles: number; ecartCharges: number;
  tauxConsommationCharges: number;
  chargesParCompte: { numero: string; libelle: string; montant: number }[];
}

const fmt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function DirectionPage() {
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear());
  const [mois, setMois] = useState(now.getMonth() + 1);
  const { data, loading } = useApi<{ data: DirectionData }>(
    `/api/popc/direction?annee=${annee}&mois=${mois}`,
    undefined,
    { refreshInterval: 60000 },
  );
  const d = data?.data;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PopcTabs />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" /> Pilotage de la Direction
          </h1>
          <p className="text-sm text-gray-500 mt-1">Tableau de bord consolidé — {MOIS[mois - 1]} {annee}</p>
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
          <AlertTriangle className="w-4 h-4" /> Aucun objectif généré pour ce mois — charges et objectif restent à 0.
        </div>
      )}

      {/* Bandeau résultat */}
      <div className={`rounded-2xl p-5 text-white ${d?.objectifAtteint ? "bg-gradient-to-br from-emerald-600 to-emerald-800" : "bg-gradient-to-br from-indigo-600 to-indigo-800"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-white/80 text-sm">Bénéfice estimé (encaissé − charges)</p>
            <p className="text-3xl font-bold mt-1">{d ? fmt(d.beneficeEstime) : "—"} FCFA</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/15 rounded-xl text-sm font-medium">
            {d?.objectifAtteint ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {d?.objectifAtteint ? "Objectif atteint" : "Objectif non atteint"}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-white/80 mb-1">
            <span>Charges couvertes</span><span>{d?.chargesCouvertes ?? 0}%</span>
          </div>
          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(100, d?.chargesCouvertes ?? 0)}%` }} />
          </div>
        </div>
      </div>

      {/* Grille KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Kpi icon={<Wallet className="w-4 h-4" />} label="Charges mensuelles" value={`${fmt(d?.chargesTotales ?? 0)} F`} />
        <Kpi icon={<Target className="w-4 h-4" />} label="Revenu minimum" value={`${fmt(d?.revenuMinimum ?? 0)} F`} />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Résultat prévisionnel" value={`${fmt(d?.resultatPrevisionnel ?? 0)} F`} />
        <Kpi icon={<ShieldCheck className="w-4 h-4" />} label="Revenus encaissés" value={`${fmt(d?.revenusEncaisses ?? 0)} F`} highlight />
        <Kpi icon={<FileText className="w-4 h-4" />} label="Revenus attendus" value={`${fmt(d?.revenusAttendus ?? 0)} F`} />
        <Kpi icon={<Users className="w-4 h-4" />} label="Clients actifs" value={fmt(d?.clientsActifs ?? 0)} />
        <Kpi icon={<AlertTriangle className="w-4 h-4" />} label="Clients en retard" value={fmt(d?.clientsEnRetard ?? 0)} />
        <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="Clients soldés" value={fmt(d?.clientsSoldes ?? 0)} />
        <Kpi icon={<FileText className="w-4 h-4" />} label="Nouveaux crédits" value={fmt(d?.nouveauxCredits ?? 0)} />
        <Kpi icon={<BookOpen className="w-4 h-4" />} label="16èmes attendus" value={fmt(d?.seiziemesAttendus ?? 0)} />
        <Kpi icon={<BookOpen className="w-4 h-4" />} label="31èmes attendus" value={fmt(d?.trentiemesAttendus ?? 0)} />
        <Kpi icon={<BookOpen className="w-4 h-4" />} label="Carnets vendus" value={fmt(d?.carnetsVendus ?? 0)} />
      </div>

      {/* §15.1 — Charges budget vs réel (Comptabilité), global uniquement */}
      {d?.comparaisonChargesDisponible && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-500" /> Charges : budget vs réel (Comptabilité)
          </h3>
          <p className="text-xs text-gray-400 mb-4">Charges réelles = comptes de type CHARGES du mois (grand livre), sans ressaisie.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Kpi icon={<Target className="w-4 h-4" />} label="Charges budgétées" value={`${fmt(d.chargesTotales)} F`} />
            <Kpi icon={<BookOpen className="w-4 h-4" />} label="Charges réelles" value={`${fmt(d.chargesReelles)} F`} highlight />
            <div className={`rounded-2xl p-4 border shadow-sm ${d.ecartCharges > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
              <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                {d.ecartCharges > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} Écart
              </div>
              <div className={`text-lg font-bold mt-1 ${d.ecartCharges > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {d.ecartCharges > 0 ? "+" : ""}{fmt(d.ecartCharges)} F
              </div>
            </div>
            <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Consommation" value={`${d.tauxConsommationCharges}%`} />
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-1">
            <div className={`h-full rounded-full ${d.tauxConsommationCharges > 100 ? "bg-red-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, d.tauxConsommationCharges)}%` }} />
          </div>
          <p className="text-xs text-gray-400 mb-4">
            {d.ecartCharges > 0
              ? `Dépassement de ${fmt(d.ecartCharges)} FCFA sur le budget de charges.`
              : `Charges réelles sous le budget de ${fmt(Math.abs(d.ecartCharges))} FCFA.`}
          </p>
          {d.chargesParCompte.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-400 text-left">
                  <tr>
                    <th className="py-1 font-medium">Compte</th>
                    <th className="py-1 font-medium">Libellé</th>
                    <th className="py-1 font-medium text-right">Montant réel</th>
                  </tr>
                </thead>
                <tbody>
                  {d.chargesParCompte.slice(0, 8).map((c) => (
                    <tr key={c.numero} className="border-t border-gray-50">
                      <td className="py-1.5 font-mono text-gray-500">{c.numero}</td>
                      <td className="py-1.5 text-gray-700">{c.libelle}</td>
                      <td className="py-1.5 text-right text-gray-800 tabular-nums">{fmt(c.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Aucune charge comptabilisée ce mois (aucune écriture sur un compte de charges).</p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Consolidation alimentée automatiquement par les modules Crédit, Collecte et Comptabilité, sans ressaisie.
      </p>
    </div>
  );
}

function Kpi({ icon, label, value, highlight }: { icon: ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border shadow-sm ${highlight ? "bg-indigo-50 border-indigo-100" : "bg-white border-gray-100"}`}>
      <div className="flex items-center gap-1.5 text-gray-400 text-xs">{icon}{label}</div>
      <div className={`text-lg font-bold mt-1 ${highlight ? "text-indigo-700" : "text-gray-800"}`}>{value}</div>
    </div>
  );
}
