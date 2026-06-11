"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  RefreshCw, ArrowDownCircle, ArrowUpCircle, Activity,
  Search, Filter,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profil {
  gestionnaire: { member: { id: number; nom: string; prenom: string } };
}
interface Portefeuille {
  reference: string; nom: string | null;
  profilRIA: Profil;
}

interface Depot {
  id: number; reference: string; montant: number; statut: string;
  modePaiement: string | null; notes: string | null; createdAt: string;
  portefeuille: Portefeuille;
}
interface Retrait {
  id: number; reference: string; montant: number; statut: string;
  motif: string | null; modePaiement: string | null; notes: string | null; createdAt: string;
  portefeuille: Portefeuille;
}
interface Mouvement {
  id: number; type: string; sens: string; montant: number;
  description: string | null; reference: string | null; createdAt: string;
  portefeuille: Portefeuille;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR");

const STATUT_DEPOT: Record<string, string> = {
  EN_ATTENTE: "bg-amber-50 text-amber-700 border-amber-200",
  VALIDE:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJETE:     "bg-red-50 text-red-600 border-red-200",
};
const STATUT_RETRAIT: Record<string, string> = {
  EN_ATTENTE: "bg-amber-50 text-amber-700 border-amber-200",
  VALIDE:     "bg-blue-50 text-blue-700 border-blue-200",
  PAYE:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJETE:     "bg-red-50 text-red-600 border-red-200",
};

type Tab = "depots" | "retraits" | "journal";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RIAFondsPage() {
  const [tab, setTab]       = useState<Tab>("depots");
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("");

  const depotsQ   = useApi<{ data: Depot[];    meta: { total: number } }>(
    `/api/admin/ria/fonds/depots?limit=30${statut ? `&statut=${statut}` : ""}`
  );
  const retraitsQ = useApi<{ data: Retrait[];  meta: { total: number } }>(
    `/api/admin/ria/fonds/retraits?limit=30${statut ? `&statut=${statut}` : ""}`
  );
  const mvtsQ     = useApi<{ data: Mouvement[]; meta: { total: number } }>(
    `/api/admin/ria/fonds/mouvements?limit=50`
  );

  const loading = tab === "depots" ? depotsQ.loading : tab === "retraits" ? retraitsQ.loading : mvtsQ.loading;
  const refetch = tab === "depots" ? depotsQ.refetch : tab === "retraits" ? retraitsQ.refetch : mvtsQ.refetch;

  const depots   = depotsQ.data?.data   ?? [];
  const retraits = retraitsQ.data?.data ?? [];
  const mouvements = mvtsQ.data?.data   ?? [];

  const filterStr = (items: { reference: string; portefeuille: Portefeuille }[]) =>
    search.trim()
      ? items.filter((x) => {
          const q = search.toLowerCase();
          const m = x.portefeuille.profilRIA.gestionnaire.member;
          return x.reference.toLowerCase().includes(q)
            || m.nom.toLowerCase().includes(q)
            || m.prenom.toLowerCase().includes(q);
        })
      : items;

  const filteredDepots   = filterStr(depots   as { reference: string; portefeuille: Portefeuille }[]) as Depot[];
  const filteredRetraits = filterStr(retraits as { reference: string; portefeuille: Portefeuille }[]) as Retrait[];

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "depots",   label: "Dépôts",    icon: <ArrowDownCircle className="w-4 h-4" />, count: depotsQ.data?.meta.total },
    { key: "retraits", label: "Retraits",  icon: <ArrowUpCircle   className="w-4 h-4" />, count: retraitsQ.data?.meta.total },
    { key: "journal",  label: "Journal",   icon: <Activity        className="w-4 h-4" />, count: mvtsQ.data?.meta.total },
  ];

  const depositStatuts  = ["EN_ATTENTE", "VALIDE", "REJETE"];
  const retraitStatuts  = ["EN_ATTENTE", "VALIDE", "PAYE", "REJETE"];
  const statutOptions   = tab === "depots" ? depositStatuts : tab === "retraits" ? retraitStatuts : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion des fonds</h1>
          <p className="text-sm text-slate-500 mt-0.5">Dépôts, retraits et journal des mouvements</p>
        </div>
        <button onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-0.5">
        {TABS.map(({ key, label, icon, count }) => (
          <button key={key} onClick={() => { setTab(key); setStatut(""); setSearch(""); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {icon} {label}
            {count !== undefined && (
              <span className="ml-1 text-xs bg-slate-100 text-slate-600 rounded-full px-1.5">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filtres */}
      {tab !== "journal" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Réf., investisseur…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={statut} onChange={(e) => setStatut(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Tous les statuts</option>
              {statutOptions.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : (
        <>
          {/* Tab Dépôts */}
          {tab === "depots" && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Référence", "Investisseur", "Portefeuille", "Montant", "Mode", "Statut", "Date"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDepots.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-400">Aucun dépôt</td></tr>
                  ) : filteredDepots.map((d) => {
                    const m = d.portefeuille.profilRIA.gestionnaire.member;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.reference}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{m.prenom} {m.nom}</td>
                        <td className="px-4 py-3 text-slate-500">{d.portefeuille.nom ?? d.portefeuille.reference}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{fmt(d.montant)} <span className="text-xs font-normal text-slate-400">F</span></td>
                        <td className="px-4 py-3 text-slate-500">{d.modePaiement ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUT_DEPOT[d.statut] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {d.statut.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{fmtDate(d.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab Retraits */}
          {tab === "retraits" && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Référence", "Investisseur", "Portefeuille", "Montant", "Motif", "Statut", "Date"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRetraits.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-400">Aucun retrait</td></tr>
                  ) : filteredRetraits.map((r) => {
                    const m = r.portefeuille.profilRIA.gestionnaire.member;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.reference}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{m.prenom} {m.nom}</td>
                        <td className="px-4 py-3 text-slate-500">{r.portefeuille.nom ?? r.portefeuille.reference}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{fmt(r.montant)} <span className="text-xs font-normal text-slate-400">F</span></td>
                        <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{r.motif ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUT_RETRAIT[r.statut] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {r.statut.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{fmtDate(r.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab Journal */}
          {tab === "journal" && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Date", "Investisseur", "Portefeuille", "Type", "Sens", "Montant", "Référence", "Description"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mouvements.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">Aucun mouvement</td></tr>
                  ) : mouvements.map((mv) => {
                    const m = mv.portefeuille.profilRIA.gestionnaire.member;
                    return (
                      <tr key={mv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(mv.createdAt)}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{m.prenom} {m.nom}</td>
                        <td className="px-4 py-3 text-slate-500">{mv.portefeuille.nom ?? mv.portefeuille.reference}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{mv.type.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${mv.sens === "CREDIT" ? "text-emerald-600" : "text-red-500"}`}>
                            {mv.sens === "CREDIT" ? "▲" : "▼"}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-semibold ${mv.sens === "CREDIT" ? "text-emerald-700" : "text-red-600"}`}>
                          {fmt(mv.montant)} <span className="text-xs font-normal text-slate-400">F</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{mv.reference ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-400 max-w-[180px] truncate">{mv.description ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
