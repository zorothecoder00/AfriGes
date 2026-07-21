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
  clientsActifs: number; nouveauxCredits: number;
  seiziemesAttendus: number; trentiemesAttendus: number;
  revenusAttendus: number; revenusEncaisses: number;
  carnetsVendus: number; objectifAtteint: boolean;
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
          <p className="text-sm text-gray-500 mt-1">Tableau de bord consolidé — {MOIS[mois - 1]} {annee} (§11)</p>
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
        <Kpi icon={<FileText className="w-4 h-4" />} label="Nouveaux crédits" value={fmt(d?.nouveauxCredits ?? 0)} />
        <Kpi icon={<BookOpen className="w-4 h-4" />} label="16èmes attendus" value={fmt(d?.seiziemesAttendus ?? 0)} />
        <Kpi icon={<BookOpen className="w-4 h-4" />} label="31èmes attendus" value={fmt(d?.trentiemesAttendus ?? 0)} />
        <Kpi icon={<BookOpen className="w-4 h-4" />} label="Carnets vendus" value={fmt(d?.carnetsVendus ?? 0)} />
      </div>

      <p className="text-xs text-gray-400">
        Consolidation alimentée automatiquement par les modules Crédit et Collecte (remboursements confirmés), sans ressaisie.
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
