"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Wallet, TrendingUp, Activity, RefreshCw, ArrowDownCircle, ArrowUpCircle,
  DollarSign, Network, ChevronRight, AlertCircle, FileText,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import DashboardBackButton from "@/components/DashboardBackButton";
import SignOutButton from "@/components/SignOutButton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Portefeuille {
  id: number;
  reference: string;
  nom: string | null;
  capitalInvesti: number;
  capitalDisponible: number;
  capitalEngage: number;
  capitalRecouvre: number;
  capitalBloque: number;
  fondSecurite: number;
  beneficesGeneres: number;
  beneficesDistribues: number;
  beneficesReinvestis: number;
  statut: string;
  dateOuverture: string;
  _count: { mouvements: number; financements: number; affectations: number; distributions: number };
}

interface Mouvement {
  id: number;
  type: string;
  sens: "CREDIT" | "DEBIT";
  montant: number;
  description: string | null;
  createdAt: string;
  portefeuille: { reference: string; nom: string | null };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const toNum = (v: unknown) => Number(v ?? 0);
const fmt   = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

const TYPE_LABEL: Record<string, string> = {
  DEPOT:               "Dépôt",
  RETRAIT:             "Retrait",
  FINANCEMENT_CLIENT:  "Financement",
  REMBOURSEMENT_CLIENT:"Remboursement",
  BENEFICE_DISTRIBUE:  "Bénéfice distribué",
  BENEFICE_REINVESTI:  "Bénéfice réinvesti",
  FOND_SECURITE:       "Fonds de sécurité",
  AJUSTEMENT:          "Ajustement",
};

const STATUT_STYLE: Record<string, string> = {
  ACTIF:   "bg-emerald-50 text-emerald-700",
  INACTIF: "bg-slate-100 text-slate-500",
  BLOQUE:  "bg-red-50 text-red-600",
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color = "emerald" }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string;
}) {
  const ring: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue:    "bg-blue-50 text-blue-600",
    amber:   "bg-amber-50 text-amber-600",
    violet:  "bg-violet-50 text-violet-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${ring[color] ?? ring.emerald}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvestisseurDashboardPage() {
  const { data: pfRes, loading: pfLoading, refetch: pfRefetch } =
    useApi<{ data: Portefeuille[] }>("/api/investisseurRIA/portefeuilles");
  const { data: mvtRes, loading: mvtLoading, refetch: mvtRefetch } =
    useApi<{ data: Mouvement[] }>("/api/investisseurRIA/mouvements?limit=10");

  const [activeTab, setActiveTab] = useState<"portefeuilles" | "mouvements" | "rapports">("portefeuilles");

  const portefeuilles = pfRes?.data ?? [];
  const mouvements    = mvtRes?.data ?? [];

  const totalInvesti    = portefeuilles.reduce((s, p) => s + toNum(p.capitalInvesti), 0);
  const totalDisponible = portefeuilles.reduce((s, p) => s + toNum(p.capitalDisponible), 0);
  const totalEngage     = portefeuilles.reduce((s, p) => s + toNum(p.capitalEngage), 0);
  const totalBenefices  = portefeuilles.reduce((s, p) => s + toNum(p.beneficesGeneres), 0);

  const refetch = () => { pfRefetch(); mvtRefetch(); };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Topbar ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <DashboardBackButton />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Network className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">Mon Espace RIA</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${pfLoading || mvtLoading ? "animate-spin" : ""}`} />
          </button>
          <MessagesLink />
          <NotificationBell href="/dashboard/user/notifications" />
          <SignOutButton redirectTo="/auth/login?logout=success" className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 border border-red-100 rounded-lg" />
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de bord investisseur</h1>
          <p className="text-sm text-slate-500 mt-0.5">Réseau des Investisseurs AfriSime — votre espace personnel</p>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={<Wallet className="w-5 h-5" />}       label="Capital investi"    value={`${fmt(totalInvesti)} FCFA`}    color="emerald" />
          <KpiCard icon={<TrendingUp className="w-5 h-5" />}   label="Capital disponible" value={`${fmt(totalDisponible)} FCFA`} color="blue"    />
          <KpiCard icon={<Activity className="w-5 h-5" />}     label="Capital engagé"     value={`${fmt(totalEngage)} FCFA`}     color="amber"   />
          <KpiCard icon={<DollarSign className="w-5 h-5" />}   label="Bénéfices générés"  value={`${fmt(totalBenefices)} FCFA`}  color="violet"  />
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button onClick={() => setActiveTab("portefeuilles")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "portefeuilles" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            Portefeuilles ({portefeuilles.length})
          </button>
          <button onClick={() => setActiveTab("mouvements")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "mouvements" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            Mouvements récents
          </button>
          <button onClick={() => setActiveTab("rapports")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === "rapports" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            <FileText className="w-4 h-4" /> Rapports mensuels
          </button>
        </div>

        {/* ── Portefeuilles ── */}
        {activeTab === "portefeuilles" && (
          <div className="space-y-4">
            {pfLoading && !portefeuilles.length && (
              <div className="flex items-center justify-center h-32 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
              </div>
            )}
            {!pfLoading && portefeuilles.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Aucun portefeuille disponible pour le moment.</p>
                <p className="text-sm text-slate-400 mt-1">Contactez votre gestionnaire AfriSime.</p>
              </div>
            )}
            {portefeuilles.map((pf) => (
              <div key={pf.id} className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-lg">{pf.nom ?? pf.reference}</h3>
                      {pf.nom && <span className="text-xs text-slate-400 font-mono">{pf.reference}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[pf.statut] ?? "bg-slate-100 text-slate-500"}`}>
                        {pf.statut}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ouvert le {fmtDate(pf.dateOuverture)} · {pf._count.financements} financement(s) · {pf._count.distributions} distribution(s)
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/user/investisseurs/portefeuilles/${pf.id}`}
                    className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Détail <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { lbl: "Investi",      val: pf.capitalInvesti,     color: "text-emerald-700" },
                    { lbl: "Disponible",   val: pf.capitalDisponible,  color: "text-blue-700" },
                    { lbl: "Engagé",       val: pf.capitalEngage,      color: "text-amber-700" },
                    { lbl: "Recouvré",     val: pf.capitalRecouvre,    color: "text-violet-700" },
                    { lbl: "Fonds séc.",   val: pf.fondSecurite,       color: "text-slate-600" },
                    { lbl: "Bénéfices",    val: pf.beneficesGeneres,   color: "text-emerald-700" },
                  ].map(({ lbl, val, color }) => (
                    <div key={lbl} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-400">{lbl}</p>
                      <p className={`text-sm font-bold ${color} mt-0.5`}>{fmt(toNum(val))} F</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Rapports mensuels ── */}
        {activeTab === "rapports" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Rapports mensuels</h3>
                <p className="text-xs text-slate-400 mt-0.5">Consultez et téléchargez vos rapports de performance</p>
              </div>
              <Link href="/dashboard/user/investisseurs/rapports"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
                <FileText className="w-4 h-4" /> Voir tous les rapports <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
              Vos rapports mensuels détaillent l&apos;évolution de votre portefeuille : capital investi, engagé, récupéré,
              rendement, clients financés, encours, retards et gains réalisés. Cliquez sur &ldquo;Voir tous les rapports&rdquo;
              pour accéder à la liste complète et les exporter en PDF ou Excel.
            </p>
          </div>
        )}

        {/* ── Mouvements récents ── */}
        {activeTab === "mouvements" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Date", "Portefeuille", "Type", "Montant", "Description"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mvtLoading && !mouvements.length && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…
                  </td></tr>
                )}
                {!mvtLoading && mouvements.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Aucun mouvement</td></tr>
                )}
                {mouvements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(m.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{m.portefeuille.nom ?? m.portefeuille.reference}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {m.sens === "CREDIT"
                          ? <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500" />
                          : <ArrowUpCircle className="w-3.5 h-3.5 text-red-400" />}
                        <span className="text-slate-700">{TYPE_LABEL[m.type] ?? m.type}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${m.sens === "CREDIT" ? "text-emerald-700" : "text-red-600"}`}>
                      {m.sens === "CREDIT" ? "+" : "-"}{fmt(toNum(m.montant))} F
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{m.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
