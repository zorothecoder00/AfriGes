"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp, AlertTriangle, Clock, CheckCircle2,
  RefreshCw, Filter, Search, ChevronDown, ChevronUp,
  AlertCircle, Activity,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";

// ── Types ─────────────────────────────────────────────────────────────────────

type NiveauAlerte = "AUCUN" | "J3" | "J7" | "J15" | "J30+";

interface FinancementRecouvrement {
  id: number;
  reference: string;
  montantFinance: number;
  montantRembourse: number;
  encours: number;
  statut: string;
  dateEcheance: string | null;
  joursRetard: number;
  niveauAlerte: NiveauAlerte;
  portefeuille: { id: number; reference: string; nom: string | null; investisseur: string };
  client: { id: number; nom: string; telephone: string | null; agentTerrain: string | null };
  creditReference: string | null;
  classeRisque: string;
}

interface StatsPF {
  portefeuilleId: number;
  reference: string;
  nom: string | null;
  investisseur: string;
  encours: number;
  rembourse: number;
  finance: number;
  enRetard: number;
  tauxRecouvrement: number;
}

interface RecouvrementData {
  stats: {
    totalEncours: number;
    totalRembourse: number;
    totalFinance: number;
    tauxRecouvrement: number;
    alertes: { j3: number; j7: number; j15: number; j30: number };
    nbFinancements: number;
  };
  statsParPortefeuille: StatsPF[];
  financements: FinancementRecouvrement[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALERTE_CONFIG: Record<NiveauAlerte, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  AUCUN: { label: "À jour",   color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  J3:    { label: "+3 jours", color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     icon: Clock },
  J7:    { label: "+7 jours", color: "text-orange-700",  bg: "bg-orange-50 border-orange-200",   icon: AlertCircle },
  J15:   { label: "+15 jours",color: "text-red-700",     bg: "bg-red-50 border-red-200",         icon: AlertTriangle },
  "J30+":{ label: "+30 jours",color: "text-red-900",     bg: "bg-red-100 border-red-400",        icon: AlertTriangle },
};

const CLASSE_COLOR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-orange-100 text-orange-800",
  E: "bg-red-100 text-red-800",
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " FCFA";
}

function pct(n: number) {
  return n.toFixed(1) + "%";
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function RecouvrementPage() {
  const [tab, setTab] = useState<"globale" | "clients" | "alertes">("globale");
  const [search, setSearch] = useState("");
  const [filtreAlerte, setFiltreAlerte] = useState<NiveauAlerte | "TOUS">("TOUS");
  const [filtrePF, setFiltrePF] = useState<string>("");
  const [sortField, setSortField] = useState<"joursRetard" | "encours">("joursRetard");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filtreAgent, setFiltreAgent] = useState<string>("");

  const { data, loading, error, refetch } = useApi<RecouvrementData>("/api/admin/ria/recouvrement");

  const financementsFiltres = useMemo(() => {
    if (!data) return [];
    let list = [...data.financements];

    if (tab === "alertes") list = list.filter((f) => f.niveauAlerte !== "AUCUN");

    if (filtreAlerte !== "TOUS") list = list.filter((f) => f.niveauAlerte === filtreAlerte);
    if (filtrePF) list = list.filter((f) => String(f.portefeuille.id) === filtrePF);
    if (filtreAgent) list = list.filter((f) => f.client.agentTerrain === filtreAgent);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.client.nom.toLowerCase().includes(q) ||
          f.reference.toLowerCase().includes(q) ||
          (f.creditReference ?? "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const va = sortField === "joursRetard" ? a.joursRetard : a.encours;
      const vb = sortField === "joursRetard" ? b.joursRetard : b.encours;
      return sortDir === "desc" ? vb - va : va - vb;
    });

    return list;
  }, [data, tab, filtreAlerte, filtrePF, filtreAgent, search, sortField, sortDir]);

  const agentsDisponibles = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    for (const f of data.financements) {
      if (f.client.agentTerrain) seen.add(f.client.agentTerrain);
    }
    return [...seen].sort();
  }, [data]);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  // ── États de chargement ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin" /> Chargement du recouvrement…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-8 text-red-600">Erreur de chargement. <button onClick={refetch} className="underline">Réessayer</button></div>
    );
  }

  const { stats, statsParPortefeuille } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recouvrement RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Suivi des encours et des retards de paiement</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Encours total</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{fmt(stats.totalEncours)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{stats.nbFinancements} financement(s)</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total recouvré</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{fmt(stats.totalRembourse)}</p>
          <p className="text-xs text-slate-400 mt-0.5">sur {fmt(stats.totalFinance)} financés</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Taux de recouvrement</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{pct(stats.tauxRecouvrement)}</p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, stats.tauxRecouvrement)}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-2">Alertes retard</p>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span className="text-amber-600">+3j : {stats.alertes.j3}</span>
            <span className="text-orange-600">+7j : {stats.alertes.j7}</span>
            <span className="text-red-600">+15j : {stats.alertes.j15}</span>
            <span className="text-red-900 font-semibold">+30j : {stats.alertes.j30}</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["globale", "clients", "alertes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "globale" ? "Vue globale" : t === "clients" ? "Détail clients" : `Alertes (${stats.alertes.j3 + stats.alertes.j7 + stats.alertes.j15 + stats.alertes.j30})`}
          </button>
        ))}
      </div>

      {/* ── Vue globale : stats par portefeuille ── */}
      {tab === "globale" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-slate-700 text-sm">Stats par portefeuille</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Portefeuille</th>
                  <th className="px-4 py-3 text-left">Investisseur</th>
                  <th className="px-4 py-3 text-right">Financé</th>
                  <th className="px-4 py-3 text-right">Recouvré</th>
                  <th className="px-4 py-3 text-right">Encours</th>
                  <th className="px-4 py-3 text-right">Taux</th>
                  <th className="px-4 py-3 text-center">En retard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statsParPortefeuille.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucun portefeuille</td></tr>
                )}
                {statsParPortefeuille.map((pf) => (
                  <tr key={pf.portefeuilleId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}</td>
                    <td className="px-4 py-3 text-slate-600">{pf.investisseur}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(pf.finance)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{fmt(pf.rembourse)}</td>
                    <td className="px-4 py-3 text-right text-slate-800 font-medium">{fmt(pf.encours)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pf.tauxRecouvrement >= 80 ? "bg-emerald-500" : pf.tauxRecouvrement >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, pf.tauxRecouvrement)}%` }}
                          />
                        </div>
                        <span className="text-slate-700 text-xs">{pct(pf.tauxRecouvrement)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pf.enRetard > 0 ? (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">{pf.enRetard}</span>
                      ) : (
                        <span className="text-emerald-500 text-xs">✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Vue clients + Alertes ── */}
      {(tab === "clients" || tab === "alertes") && (
        <div className="space-y-4">
          {/* Filtres */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher client, référence…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>

            {tab === "clients" && (
              <select
                value={filtreAlerte}
                onChange={(e) => setFiltreAlerte(e.target.value as NiveauAlerte | "TOUS")}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <option value="TOUS">Tous les retards</option>
                <option value="AUCUN">À jour</option>
                <option value="J3">+3 jours</option>
                <option value="J7">+7 jours</option>
                <option value="J15">+15 jours</option>
                <option value="J30+">+30 jours</option>
              </select>
            )}

            <select
              value={filtrePF}
              onChange={(e) => setFiltrePF(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="">Tous les portefeuilles</option>
              {statsParPortefeuille.map((pf) => (
                <option key={pf.portefeuilleId} value={String(pf.portefeuilleId)}>
                  {pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}
                </option>
              ))}
            </select>

            {agentsDisponibles.length > 0 && (
              <select
                value={filtreAgent}
                onChange={(e) => setFiltreAgent(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <option value="">Tous les agents terrain</option>
                {agentsDisponibles.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}
          </div>

          {/* Tableau */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-left">Agent terrain</th>
                    <th className="px-4 py-3 text-left">Portefeuille</th>
                    <th className="px-4 py-3 text-left">Crédit</th>
                    <th className="px-4 py-3 text-center">Classe</th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-slate-700 select-none"
                      onClick={() => toggleSort("encours")}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Encours
                        {sortField === "encours" ? (sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null}
                      </span>
                    </th>
                    <th
                      className="px-4 py-3 text-center cursor-pointer hover:text-slate-700 select-none"
                      onClick={() => toggleSort("joursRetard")}
                    >
                      <span className="flex items-center justify-center gap-1">
                        Retard
                        {sortField === "joursRetard" ? (sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null}
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {financementsFiltres.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      {tab === "alertes" ? "Aucun retard détecté — tous les financements sont à jour." : "Aucun résultat."}
                    </td></tr>
                  )}
                  {financementsFiltres.map((f) => {
                    const alerte = ALERTE_CONFIG[f.niveauAlerte];
                    const AIcon = alerte.icon;
                    return (
                      <tr key={f.id} className={`hover:bg-slate-50 ${f.niveauAlerte === "J30+" ? "bg-red-50/30" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{f.client.nom}</p>
                          {f.client.telephone && <p className="text-xs text-slate-400">{f.client.telephone}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {f.client.agentTerrain ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{f.portefeuille.reference}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{f.creditReference ?? f.reference}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${CLASSE_COLOR[f.classeRisque] ?? "bg-slate-100 text-slate-600"}`}>
                            {f.classeRisque}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">{fmt(f.encours)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded-full ${alerte.bg} ${alerte.color}`}>
                            <AIcon className="w-3 h-3" />
                            {f.joursRetard > 0 ? `${f.joursRetard}j` : alerte.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            f.statut === "ACTIF"     ? "bg-blue-100 text-blue-700"   :
                            f.statut === "EN_RETARD" ? "bg-orange-100 text-orange-700" :
                            f.statut === "DEFAUT"    ? "bg-red-100 text-red-700"     :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {f.statut}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
