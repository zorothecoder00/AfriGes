"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  RefreshCw, Search, Briefcase, TrendingUp, Wallet, Activity,
  ChevronRight, User,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Portefeuille {
  id: number; reference: string; nom: string | null; actif: boolean;
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number;
  capitalRecouvre: number; beneficesGeneres: number; beneficesDistribues: number;
  createdAt: string;
  profilRIA: {
    gestionnaire: {
      member: { id: number; nom: string; prenom: string; email: string };
    };
  };
  _count: { depots: number; retraits: number; financements: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const toNum   = (v: unknown) => Number(v ?? 0);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR");

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RIAPortefeuillesPage() {
  const [search, setSearch] = useState("");
  const [actifFilter, setActifFilter] = useState<"" | "true" | "false">("");

  const { data: res, loading, refetch } = useApi<{
    data: Portefeuille[]; meta: { total: number };
  }>(`/api/admin/ria/portefeuilles?limit=40${actifFilter !== "" ? `&actif=${actifFilter}` : ""}`);

  const portefeuilles = (res?.data ?? []).filter((pf) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const m = pf.profilRIA.gestionnaire.member;
    return pf.reference.toLowerCase().includes(q)
      || (pf.nom ?? "").toLowerCase().includes(q)
      || m.nom.toLowerCase().includes(q)
      || m.prenom.toLowerCase().includes(q)
      || m.email.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Portefeuilles RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">{res?.meta.total ?? 0} portefeuille(s) au total</p>
        </div>
        <button onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Réf., nom, investisseur…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        </div>
        <select value={actifFilter} onChange={(e) => setActifFilter(e.target.value as "" | "true" | "false")}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
          <option value="">Tous les statuts</option>
          <option value="true">Actifs</option>
          <option value="false">Inactifs</option>
        </select>
      </div>

      {/* Grille */}
      {loading && !portefeuilles.length ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {portefeuilles.map((pf) => {
            const m = pf.profilRIA.gestionnaire.member;
            const tauxDispo = toNum(pf.capitalInvesti) > 0
              ? (toNum(pf.capitalDisponible) / toNum(pf.capitalInvesti)) * 100
              : 0;
            return (
              <Link key={pf.id}
                href={`/dashboard/user/responsablesRIA/portefeuilles/${pf.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col gap-4">

                {/* En-tête carte */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-xl flex-shrink-0">
                      <Briefcase className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{pf.nom ?? pf.reference}</p>
                      <p className="text-xs font-mono text-slate-400">{pf.reference}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${pf.actif ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {pf.actif ? "Actif" : "Inactif"}
                  </span>
                </div>

                {/* Investisseur */}
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{m.prenom} {m.nom}</span>
                </div>

                {/* Capitaux */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-1 text-xs text-slate-400 mb-0.5">
                      <Wallet className="w-3 h-3" /> Investi
                    </div>
                    <p className="text-sm font-bold text-slate-900">{fmt(toNum(pf.capitalInvesti))} <span className="text-xs font-normal text-slate-400">F</span></p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <div className="flex items-center gap-1 text-xs text-emerald-600 mb-0.5">
                      <TrendingUp className="w-3 h-3" /> Disponible
                    </div>
                    <p className="text-sm font-bold text-emerald-700">{fmt(toNum(pf.capitalDisponible))} <span className="text-xs font-normal text-emerald-400">F</span></p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3">
                    <div className="flex items-center gap-1 text-xs text-blue-500 mb-0.5">
                      <Activity className="w-3 h-3" /> Engagé
                    </div>
                    <p className="text-sm font-bold text-blue-700">{fmt(toNum(pf.capitalEngage))} <span className="text-xs font-normal text-blue-300">F</span></p>
                  </div>
                  <div className="bg-violet-50 rounded-xl p-3">
                    <div className="flex items-center gap-1 text-xs text-violet-500 mb-0.5">
                      <TrendingUp className="w-3 h-3" /> Bénéfices
                    </div>
                    <p className="text-sm font-bold text-violet-700">{fmt(toNum(pf.beneficesGeneres))} <span className="text-xs font-normal text-violet-300">F</span></p>
                  </div>
                </div>

                {/* Progress dispo */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Capital disponible</span>
                    <span>{tauxDispo.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, tauxDispo)}%` }} />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-100">
                  <span>{pf._count.depots} dépôt(s) · {pf._count.financements} financement(s)</span>
                  <div className="flex items-center gap-1 text-emerald-600">
                    Détail <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}

          {!loading && portefeuilles.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
              <Briefcase className="w-8 h-8" />
              <p>Aucun portefeuille trouvé</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
