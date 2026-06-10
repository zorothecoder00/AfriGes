"use client";

import { useApi } from "@/hooks/useApi";
import { RefreshCw, TrendingUp, Users, Wallet, ArrowDownCircle, ArrowUpCircle, Activity, Settings } from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatutEntry { count: number; montant?: number; encours?: number }

interface Dashboard {
  nbInvestisseurs: number;
  nbPortefeuilles: number;
  capitalInvesti: number;
  capitalDisponible: number;
  capitalEngage: number;
  capitalRecouvre: number;
  beneficesGeneres: number;
  beneficesDistribues: number;
  depots:      Record<string, StatutEntry>;
  retraits:    Record<string, StatutEntry>;
  financements: Record<string, StatutEntry>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(Math.round(n));

function KpiCard({ icon, label, value, sub, color = "emerald" }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string;
}) {
  const ring: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue:    "bg-blue-50 text-blue-600",
    amber:   "bg-amber-50 text-amber-600",
    violet:  "bg-violet-50 text-violet-600",
    rose:    "bg-rose-50 text-rose-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${ring[color] ?? ring.emerald}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RIADashboardPage() {
  const { data: res, loading, refetch } = useApi<{ data: Dashboard }>("/api/admin/ria/dashboard");
  const d = res?.data;

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">RIA — Réseau des Investisseurs AfriSime</h1>
          <p className="text-sm text-slate-500 mt-0.5">Vue d&apos;ensemble des fonds et investisseurs</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
          <Link
            href="/dashboard/admin/ria/investisseurs"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
          >
            <Users className="w-4 h-4" /> Investisseurs
          </Link>
        </div>
      </div>

      {loading && !d && (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      )}

      {d && (
        <>
          {/* ── KPIs principaux ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={<Users className="w-5 h-5" />}       label="Investisseurs"       value={String(d.nbInvestisseurs)} sub={`${d.nbPortefeuilles} portefeuille(s)`} color="violet" />
            <KpiCard icon={<Wallet className="w-5 h-5" />}      label="Capital investi"     value={`${fmt(d.capitalInvesti)} FCFA`} color="emerald" />
            <KpiCard icon={<Activity className="w-5 h-5" />}    label="Capital engagé"      value={`${fmt(d.capitalEngage)} FCFA`} color="blue" />
            <KpiCard icon={<TrendingUp className="w-5 h-5" />}  label="Capital disponible"  value={`${fmt(d.capitalDisponible)} FCFA`} color="amber" />
          </div>

          {/* ── Bénéfices ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <KpiCard icon={<TrendingUp className="w-5 h-5" />}     label="Bénéfices générés"    value={`${fmt(d.beneficesGeneres)} FCFA`}    color="emerald" />
            <KpiCard icon={<ArrowUpCircle className="w-5 h-5" />}  label="Bénéfices distribués" value={`${fmt(d.beneficesDistribues)} FCFA`} color="blue" />
            <KpiCard icon={<TrendingUp className="w-5 h-5" />}     label="Capital recouvré"     value={`${fmt(d.capitalRecouvre)} FCFA`}     color="violet" />
          </div>

          {/* ── Tableaux récapitulatifs ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Dépôts */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-emerald-600" /> Dépôts
                </h3>
                <Link href="/dashboard/admin/ria/fonds" className="text-xs text-emerald-600 hover:underline">Voir tout</Link>
              </div>
              {["EN_ATTENTE", "VALIDE", "REJETE"].map((s) => (
                <div key={s} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-600">{s.replace("_", " ")}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-slate-900">{d.depots[s]?.count ?? 0}</span>
                    {d.depots[s]?.montant != null && (
                      <span className="text-xs text-slate-400 ml-2">{fmt(d.depots[s].montant!)} F</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Retraits */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4 text-rose-500" /> Retraits
                </h3>
                <Link href="/dashboard/admin/ria/fonds" className="text-xs text-emerald-600 hover:underline">Voir tout</Link>
              </div>
              {["EN_ATTENTE", "VALIDE", "PAYE", "REJETE"].map((s) => (
                <div key={s} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-600">{s.replace("_", " ")}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-slate-900">{d.retraits[s]?.count ?? 0}</span>
                    {d.retraits[s]?.montant != null && (
                      <span className="text-xs text-slate-400 ml-2">{fmt(d.retraits[s].montant!)} F</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Financements */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" /> Financements
                </h3>
              </div>
              {["ACTIF", "REMBOURSE", "EN_RETARD", "DEFAUT"].map((s) => (
                <div key={s} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-600">{s.replace("_", " ")}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-slate-900">{d.financements[s]?.count ?? 0}</span>
                    {d.financements[s]?.encours != null && (
                      <span className="text-xs text-slate-400 ml-2">{fmt(d.financements[s].encours!)} F</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Navigation rapide ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { href: "/dashboard/admin/ria/investisseurs",  label: "Investisseurs",         desc: "Créer, modifier, voir les fiches" },
              { href: "/dashboard/admin/ria/fonds",          label: "Fonds — Dépôts & Retraits", desc: "Valider et payer les opérations" },
              { href: "/dashboard/admin/ria/financements",   label: "Financements clients",  desc: "Crédits financés par les portefeuilles" },
              { href: "/dashboard/admin/ria/affectations",   label: "Affectations clients",  desc: "Lier des clients aux portefeuilles" },
              { href: "/dashboard/admin/ria/distributions",  label: "Distributions",         desc: "Calculer et distribuer les bénéfices" },
              { href: "/dashboard/admin/ria/config",         label: "Configuration",         desc: "Taux de génération et répartition" },
            ].map((nav) => (
              <Link
                key={nav.href}
                href={nav.href}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-300 hover:shadow-sm transition-all"
              >
                <p className="font-semibold text-slate-800">{nav.label}</p>
                <p className="text-sm text-slate-500 mt-1">{nav.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
