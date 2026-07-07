"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Wallet, Search, Plus, Settings, RefreshCw, Loader2, X, ChevronRight, MapPin, Activity,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import ClienteleTabBar from "@/components/ClienteleTabBar";

interface CompteRow {
  id: number;
  numeroCompte: string;
  ribComplet: string;
  statut: string;
  solde: string | number;
  totalDepose: string | number;
  nbMouvements: number;
  dateOuverture: string;
  derniereOperationAt: string | null;
  client: {
    id: number; nom: string; prenom: string; telephone: string; codeClient: string | null;
    quartier: string | null; ville: string | null; commune: string | null;
    agentTerrain: { nom: string; prenom: string } | null;
    pointDeVente: { nom: string; code: string } | null;
  };
  agentCreateur: { nom: string; prenom: string } | null;
}
interface ComptesResponse {
  data: CompteRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const STATUT_CC_STYLE: Record<string, string> = {
  ACTIF:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  SUSPENDU:   "bg-amber-100 text-amber-700 border-amber-200",
  CLOTURE:    "bg-gray-100 text-gray-600 border-gray-200",
  DECEDE:     "bg-slate-200 text-slate-700 border-slate-300",
  BLACKLIST:  "bg-red-100 text-red-700 border-red-200",
  FRAUDULEUX: "bg-rose-100 text-rose-700 border-rose-200",
};
const STATUT_CC_LABEL: Record<string, string> = {
  ACTIF: "Actif", SUSPENDU: "Suspendu", CLOTURE: "Clôturé",
  DECEDE: "Décédé", BLACKLIST: "Blacklisté", FRAUDULEUX: "Frauduleux",
};

const N = (v: string | number) => Number(v ?? 0);

export default function ComptesCourantsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const query = new URLSearchParams({
    page: String(page), limit: String(LIMIT),
    ...(search && { search }),
    ...(statut && { statut }),
  }).toString();

  const { data: res, loading, refetch } = useApi<ComptesResponse>(`/api/comptes-courants?${query}`);
  const comptes = res?.data ?? [];
  const meta = res?.meta;

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-emerald-600" /> Comptes Courants
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Portefeuilles internes clients · épargne AfriSime</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/admin/comptes-courants/tableau-de-bord"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
              <Activity className="w-4 h-4" /> Tableau de bord
            </Link>
            <Link href="/dashboard/admin/comptes-courants/parametres"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
              <Settings className="w-4 h-4" /> Paramètres
            </Link>
            <Link href="/dashboard/admin/comptes-courants/nouveau"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 text-sm font-medium">
              <Plus className="w-4 h-4" /> Nouveau compte
            </Link>
            <button onClick={refetch}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
                placeholder="N° compte, nom, téléphone, communauté, zone, quartier, code client, agent…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
              />
            </div>
            <button onClick={() => { setSearch(searchInput); setPage(1); }}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Chercher</button>
            {search && (
              <button onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[160px]">
            <option value="">Tous les statuts</option>
            {Object.keys(STATUT_CC_LABEL).map((s) => <option key={s} value={s}>{STATUT_CC_LABEL[s]}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading && !res ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…
            </div>
          ) : !comptes.length ? (
            <div className="text-center py-20">
              <Wallet className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Aucun compte courant</p>
              <p className="text-gray-300 text-sm mt-1">Ouvrez un premier compte pour un client existant</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">N° compte</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Client</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Localisation</th>
                    <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Solde</th>
                    <th className="text-center px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Mouv.</th>
                    <th className="text-center px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Statut</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Ouvert le</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {comptes.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/admin/comptes-courants/${c.id}`} className="font-mono text-xs font-semibold text-emerald-700 hover:underline">
                          {c.numeroCompte}
                        </Link>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{c.ribComplet}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800">{c.client.prenom} {c.client.nom}</p>
                        <p className="text-xs text-gray-400">{c.client.telephone}{c.client.codeClient ? ` · ${c.client.codeClient}` : ""}</p>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />
                          {[c.client.commune, c.client.ville, c.client.quartier].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{formatCurrency(N(c.solde))}</td>
                      <td className="px-5 py-3 text-center text-gray-500">{c.nbMouvements}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUT_CC_STYLE[c.statut] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUT_CC_LABEL[c.statut] ?? c.statut}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{formatDate(c.dateOuverture)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/dashboard/admin/comptes-courants/${c.id}`} className="text-gray-300 hover:text-emerald-600">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">{meta.total} compte(s) · page {meta.page}/{meta.totalPages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Précédent</button>
                <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suivant</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
