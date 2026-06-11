"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  RefreshCw, Wallet, TrendingUp, Users, ChevronRight,
  Search, Activity, Shield, Star,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Investisseur { id: number; nom: string; prenom: string; email: string }

interface PortefeuilleItem {
  id: number;
  reference: string;
  nom: string | null;
  actif: boolean;
  capitalInvesti: number;
  capitalDisponible: number;
  capitalEngage: number;
  capitalRecouvre: number;
  capitalBloque: number;
  beneficesGeneres: number;
  beneficesDistribues: number;
  fondSecurite: number;
  profilRIA: {
    id: number;
    numero: string | null;
    gestionnaire: { member: Investisseur };
  };
  _count: { depots: number; retraits: number; financements: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt  = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const toNum = (v: unknown) => Number(v ?? 0);

const RISQUE_COLOR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-orange-100 text-orange-800",
  E: "bg-red-100 text-red-800",
};

function classeFromTaux(taux: number): string {
  if (taux >= 90) return "A";
  if (taux >= 70) return "B";
  if (taux >= 50) return "C";
  if (taux >= 25) return "D";
  return "E";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortefeuillesPage() {
  const [search, setSearch] = useState("");

  const { data: res, loading, refetch } = useApi<{
    data: PortefeuilleItem[];
    meta: { total: number };
  }>(`/api/admin/ria/portefeuilles?limit=100`);

  const portefeuilles = (res?.data ?? []).filter((pf) => {
    if (!search) return true;
    const inv = pf.profilRIA.gestionnaire.member;
    const q   = search.toLowerCase();
    return (
      pf.reference.toLowerCase().includes(q) ||
      (pf.nom ?? "").toLowerCase().includes(q) ||
      `${inv.prenom} ${inv.nom}`.toLowerCase().includes(q)
    );
  });

  // Agrégats globaux
  const totalInvesti    = portefeuilles.reduce((s, p) => s + toNum(p.capitalInvesti),    0);
  const totalDisponible = portefeuilles.reduce((s, p) => s + toNum(p.capitalDisponible), 0);
  const totalEngage     = portefeuilles.reduce((s, p) => s + toNum(p.capitalEngage),     0);
  const totalBenef      = portefeuilles.reduce((s, p) => s + toNum(p.beneficesGeneres),  0);

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl">

      {/* En-tête */}
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

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Capital investi",   value: totalInvesti,    color: "text-slate-900",   icon: <Wallet className="w-5 h-5 text-emerald-600" /> },
          { label: "Capital disponible",value: totalDisponible, color: "text-emerald-700", icon: <Wallet className="w-5 h-5 text-emerald-500" /> },
          { label: "Capital engagé",    value: totalEngage,     color: "text-blue-700",    icon: <Activity className="w-5 h-5 text-blue-500" /> },
          { label: "Bénéfices générés", value: totalBenef,      color: "text-violet-700",  icon: <TrendingUp className="w-5 h-5 text-violet-500" /> },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
            <div className="p-3 bg-slate-50 rounded-xl flex-shrink-0">{k.icon}</div>
            <div>
              <p className="text-xs text-slate-400 font-medium">{k.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${k.color}`}>{fmt(k.value)} <span className="text-xs font-normal text-slate-400">F</span></p>
            </div>
          </div>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Référence, nom, investisseur…"
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* Tableau */}
      {loading && !portefeuilles.length ? (
        <div className="flex items-center justify-center h-32 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Référence", "Investisseur", "Capital investi", "Disponible", "Encours", "Bénéfices", "Rendement", "Risque", "Dossiers", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {portefeuilles.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">Aucun portefeuille trouvé</td>
                  </tr>
                )}
                {portefeuilles.map((pf) => {
                  const inv         = pf.profilRIA.gestionnaire.member;
                  const investi     = toNum(pf.capitalInvesti);
                  const disponible  = toNum(pf.capitalDisponible);
                  const engage      = toNum(pf.capitalEngage);
                  const benef       = toNum(pf.beneficesGeneres);
                  const rendement   = investi > 0 ? (benef / investi) * 100 : 0;
                  const tauxRecouv  = investi > 0 ? (toNum(pf.capitalRecouvre) / investi) * 100 : 0;
                  const classe      = classeFromTaux(tauxRecouv);

                  return (
                    <tr key={pf.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pf.actif ? "bg-emerald-400" : "bg-slate-300"}`} />
                          <div>
                            <p className="font-mono text-xs font-semibold text-slate-700">{pf.reference}</p>
                            {pf.nom && <p className="text-xs text-slate-500">{pf.nom}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{inv.prenom} {inv.nom}</p>
                        <p className="text-xs text-slate-400 truncate max-w-32">{inv.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{fmt(investi)} F</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium tabular-nums">{fmt(disponible)} F</td>
                      <td className="px-4 py-3 text-right text-blue-700 font-medium tabular-nums">{fmt(engage)} F</td>
                      <td className="px-4 py-3 text-right text-violet-700 font-medium tabular-nums">{fmt(benef)} F</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${rendement >= 8 ? "bg-emerald-500" : rendement >= 4 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(100, rendement * 5)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-600 tabular-nums">{rendement.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full ${RISQUE_COLOR[classe]}`}>
                          <Star className="w-2.5 h-2.5" />{classe}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                          <span title="Financements actifs"><Activity className="w-3 h-3 inline" /> {pf._count.financements}</span>
                          <span title="Clients"><Users className="w-3 h-3 inline" /> —</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/dashboard/admin/ria/investisseurs/${inv.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-3 h-3" /> Fiche
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {portefeuilles.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-400">
              <Shield className="w-3.5 h-3.5" />
              <span>Niveau de risque estimé depuis le taux de recouvrement — A (≥90%) → E (&lt;25%)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
