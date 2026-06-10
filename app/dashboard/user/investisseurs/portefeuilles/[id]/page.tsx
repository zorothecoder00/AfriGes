"use client";

import { use } from "react";
import Link from "next/link";
import {
  Wallet, TrendingUp, Activity, RefreshCw, ArrowDownCircle, ArrowUpCircle,
  DollarSign, ChevronLeft, Users, BarChart2, CheckCircle, Clock, AlertCircle,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import SignOutButton from "@/components/SignOutButton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Mouvement {
  id: number; type: string; sens: "CREDIT" | "DEBIT"; montant: number;
  description: string | null; createdAt: string;
}

interface Distribution {
  id: number; mois: number; annee: number; montantGenere: number;
  montantDistribue: number; montantReinvesti: number; montantFondSecurite: number;
  statut: string; datePaiement: string | null;
}

interface Financement {
  id: number; montantFinance: number; montantRembourse: number; encours: number;
  statut: string; createdAt: string;
  client: { id: number; nom: string; prenom: string };
}

interface Affectation {
  id: number; pourcentage: number; montantAlloue: number; classeRisque: string;
  client: { id: number; nom: string; prenom: string; telephone: string | null };
}

interface Portefeuille {
  id: number; reference: string; nom: string | null;
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number;
  capitalRecouvre: number; fondSecurite: number; capitalBloque: number;
  beneficesGeneres: number; beneficesDistribues: number; beneficesReinvestis: number;
  statut: string; dateOuverture: string;
  mouvements:    Mouvement[];
  distributions: Distribution[];
  affectations:  Affectation[];
  financements:  Financement[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const toNum = (v: unknown) => Number(v ?? 0);
const fmt   = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

const MOIS_LABELS = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const TYPE_LABEL: Record<string, string> = {
  DEPOT: "Dépôt", RETRAIT: "Retrait",
  FINANCEMENT_CLIENT: "Financement", REMBOURSEMENT_CLIENT: "Remboursement",
  BENEFICE_DISTRIBUE: "Bénéfice distribué", BENEFICE_REINVESTI: "Bénéfice réinvesti",
  FOND_SECURITE: "Fonds de sécurité", AJUSTEMENT: "Ajustement",
};

const STATUT_FIN: Record<string, string> = {
  ACTIF:      "bg-blue-50 text-blue-700",
  REMBOURSE:  "bg-emerald-50 text-emerald-700",
  EN_RETARD:  "bg-amber-50 text-amber-700",
  DEFAUT:     "bg-red-50 text-red-700",
  ANNULE:     "bg-slate-100 text-slate-500",
};

const STATUT_DIST: Record<string, string> = {
  PLANIFIEE:  "bg-slate-100 text-slate-600",
  DISTRIBUE:  "bg-emerald-50 text-emerald-700",
  ANNULEE:    "bg-red-50 text-red-600",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortefeuilleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: res, loading, refetch } = useApi<{ data: Portefeuille }>(`/api/investisseurRIA/portefeuilles/${id}`);
  const pf = res?.data;

  const tauxEngagement = pf
    ? toNum(pf.capitalInvesti) > 0 ? (toNum(pf.capitalEngage) / toNum(pf.capitalInvesti)) * 100 : 0
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Topbar ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/user/investisseurs" className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm">
            <ChevronLeft className="w-4 h-4" /> Retour
          </Link>
          <span className="text-slate-300">|</span>
          <span className="font-semibold text-slate-900 text-sm">{pf?.nom ?? pf?.reference ?? "Portefeuille"}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <MessagesLink />
          <NotificationBell href="/dashboard/user/notifications" />
          <SignOutButton redirectTo="/auth/login?logout=success" className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 border border-red-100 rounded-lg" />
        </div>
      </header>

      {loading && !pf && (
        <div className="flex items-center justify-center h-64 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      )}

      {pf && (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">

          {/* ── Header ── */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{pf.nom ?? pf.reference}</h1>
              {pf.nom && <span className="font-mono text-xs text-slate-400">{pf.reference}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pf.statut === "ACTIF" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {pf.statut}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Ouvert le {fmtDate(pf.dateOuverture)}</p>
          </div>

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><Wallet className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Capital investi</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{fmt(toNum(pf.capitalInvesti))} F</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600"><TrendingUp className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Disponible</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{fmt(toNum(pf.capitalDisponible))} F</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600"><Activity className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Engagé</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{fmt(toNum(pf.capitalEngage))} F</p>
                <div className="mt-1.5 w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(tauxEngagement, 100)}%` }} />
                </div>
                <p className="text-xs text-amber-600 mt-0.5">{tauxEngagement.toFixed(0)}% du capital</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-violet-50 text-violet-600"><DollarSign className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Bénéfices générés</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{fmt(toNum(pf.beneficesGeneres))} F</p>
                <p className="text-xs text-slate-400 mt-0.5">Distribués : {fmt(toNum(pf.beneficesDistribues))} F</p>
              </div>
            </div>
          </div>

          {/* ── Détails capital ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-slate-500" /> Répartition du capital
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { lbl: "Investi",       val: pf.capitalInvesti,     color: "text-emerald-700" },
                { lbl: "Disponible",    val: pf.capitalDisponible,  color: "text-blue-700" },
                { lbl: "Engagé",        val: pf.capitalEngage,      color: "text-amber-700" },
                { lbl: "Recouvré",      val: pf.capitalRecouvre,    color: "text-violet-700" },
                { lbl: "Bloqué",        val: pf.capitalBloque,      color: "text-red-600" },
                { lbl: "Fonds séc.",    val: pf.fondSecurite,       color: "text-slate-600" },
              ].map(({ lbl, val, color }) => (
                <div key={lbl} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400">{lbl}</p>
                  <p className={`text-sm font-bold ${color} mt-0.5`}>{fmt(toNum(val))} F</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Mouvements ── */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-500" /> Journal des mouvements
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {pf.mouvements.length === 0 && (
                  <p className="px-5 py-4 text-sm text-slate-400 text-center">Aucun mouvement</p>
                )}
                {pf.mouvements.map((m) => (
                  <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.sens === "CREDIT"
                        ? <ArrowDownCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        : <ArrowUpCircle className="w-4 h-4 text-red-400 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700 font-medium truncate">{TYPE_LABEL[m.type] ?? m.type}</p>
                        <p className="text-xs text-slate-400">{fmtDate(m.createdAt)}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ml-3 ${m.sens === "CREDIT" ? "text-emerald-700" : "text-red-600"}`}>
                      {m.sens === "CREDIT" ? "+" : "-"}{fmt(toNum(m.montant))} F
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Distributions ── */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-500" /> Historique des distributions
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {pf.distributions.length === 0 && (
                  <p className="px-5 py-4 text-sm text-slate-400 text-center">Aucune distribution</p>
                )}
                {pf.distributions.map((d) => (
                  <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {MOIS_LABELS[d.mois]} {d.annee}
                      </p>
                      <p className="text-xs text-slate-400">
                        Généré : {fmt(toNum(d.montantGenere))} F · Dist. : {fmt(toNum(d.montantDistribue))} F
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_DIST[d.statut] ?? "bg-slate-100 text-slate-500"}`}>
                        {d.statut === "DISTRIBUE" ? "Distribué" : d.statut === "PLANIFIEE" ? "Planifiée" : d.statut}
                      </span>
                      {d.statut === "DISTRIBUE" && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                      {d.statut === "PLANIFIEE" && <Clock className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Clients affectés ── */}
          {pf.affectations.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" /> Clients bénéficiaires actifs ({pf.affectations.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {pf.affectations.map((a) => (
                  <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.client.prenom} {a.client.nom}</p>
                      {a.client.telephone && <p className="text-xs text-slate-400">{a.client.telephone}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-emerald-700 font-semibold">{toNum(a.pourcentage).toFixed(1)}%</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600`}>Classe {a.classeRisque}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Financements ── */}
          {pf.financements.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-500" /> Financements ({pf.financements.length})
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Client", "Financé", "Remboursé", "Encours", "Statut"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pf.financements.map((f) => {
                    const pct = toNum(f.montantFinance) > 0
                      ? (toNum(f.montantRembourse) / toNum(f.montantFinance)) * 100 : 0;
                    return (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{f.client.prenom} {f.client.nom}</td>
                        <td className="px-4 py-3 text-slate-700">{fmt(toNum(f.montantFinance))} F</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-700">{fmt(toNum(f.montantRembourse))} F</span>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{fmt(toNum(f.encours))} F</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_FIN[f.statut] ?? "bg-slate-100 text-slate-500"}`}>
                            {f.statut.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
