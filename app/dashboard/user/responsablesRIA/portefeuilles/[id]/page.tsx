"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import {
  ArrowLeft, RefreshCw, Wallet, TrendingUp, Activity,
  ArrowDownCircle, ArrowUpCircle, Shield, DollarSign,
  User, Phone, Mail, CheckCircle, XCircle,
  ChevronDown, ChevronUp,
  PieChart, Users, UserCheck, UserMinus, UserX,
  Target, AlertTriangle, Percent, BarChart2,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Depot {
  id: number; reference: string; montant: number; statut: string;
  modePaiement: string | null; createdAt: string;
}
interface Retrait {
  id: number; reference: string; montant: number; statut: string;
  motif: string | null; createdAt: string;
}
interface Mouvement {
  id: number; type: string; sens: string; montant: number;
  description: string | null; reference: string | null; createdAt: string;
}
interface Financement {
  id: number; reference: string; montantFinance: number; encours: number;
  montantRembourse: number; statut: string;
  dateFinancement: string; dateEcheance: string | null;
  client: { id: number; nom: string; prenom: string; telephone: string | null };
}
interface Distribution {
  id: number; annee: number; mois: number;
  montantGenere: number; montantDistribue: number;
  montantReinvesti: number; montantFondSecurite: number;
  statut: string; createdAt: string;
}

interface Portefeuille {
  id: number; reference: string; nom: string | null; actif: boolean; notes: string | null;
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number;
  capitalRecouvre: number; capitalBloque: number;
  beneficesGeneres: number; beneficesDistribues: number; beneficesReinvestis: number;
  fondSecurite: number; createdAt: string;
  profilRIA: {
    id: number; numero: string | null; profession: string | null; pays: string | null;
    gestionnaire: {
      member: { id: number; nom: string; prenom: string; email: string; telephone: string | null };
    };
  };
  depots:        Depot[];
  retraits:      Retrait[];
  mouvements:    Mouvement[];
  financements:  Financement[];
  distributions: Distribution[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const toNum   = (v: unknown) => Number(v ?? 0);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR");
const MOIS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const STATUT_DEPOT: Record<string, string> = {
  EN_ATTENTE: "bg-amber-50 text-amber-700",
  VALIDE:     "bg-emerald-50 text-emerald-700",
  REJETE:     "bg-red-50 text-red-600",
};
const STATUT_RETRAIT: Record<string, string> = {
  EN_ATTENTE: "bg-amber-50 text-amber-700",
  VALIDE:     "bg-blue-50 text-blue-700",
  PAYE:       "bg-emerald-50 text-emerald-700",
  REJETE:     "bg-red-50 text-red-600",
};
const STATUT_FINANCEMENT: Record<string, string> = {
  ACTIF:      "bg-blue-50 text-blue-700",
  REMBOURSE:  "bg-emerald-50 text-emerald-700",
  EN_RETARD:  "bg-orange-50 text-orange-700",
  DEFAUT:     "bg-red-50 text-red-600",
  ANNULE:     "bg-slate-100 text-slate-500",
};
const STATUT_DISTRIB: Record<string, string> = {
  PLANIFIE:            "bg-slate-100 text-slate-600",
  EN_ATTENTE_PAIEMENT: "bg-amber-50 text-amber-700",
  DISTRIBUE:           "bg-emerald-50 text-emerald-700",
  REINVESTI:           "bg-blue-50 text-blue-700",
};

// ── Types analyse ─────────────────────────────────────────────────────────────

interface AnalyseData {
  dureeMois: number; dureeAns: number;
  capitalInvesti: number; capitalRecupere: number;
  beneficeBrut: number; beneficeNet: number;
  rendementMensuel: number; rendementAnnuel: number;
  roi: number; triSimplifiee: number;
  cashFlowNet: number; cashFlowEntrees: number; cashFlowSorties: number;
  nbClientsFinances: number; nouveauxClients: number;
  clientsActifs: number; clientsInactifs: number; clientsPerdus: number;
  montantAttendu: number; montantRecouvre: number; ecart: number;
  tauxRecouvrement: number; tauxImpayes: number;
  encoursImpayes: number; totalEncours: number;
  evolutionMensuelle: { mois: number; annee: number; montantGenere: number; montantDistribue: number; rendementMois: number }[];
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color = "text-slate-900", icon }: {
  label: string; value: string; color?: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
      <div className="p-2 bg-slate-50 rounded-lg flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium truncate">{label}</p>
        <p className={`text-base font-bold mt-0.5 ${color}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Barre de progression ──────────────────────────────────────────────────────

function ProgressBar({ value, max = 100, color = "bg-emerald-500" }: {
  value: number; max?: number; color?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Section repliable ─────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{title}</span>
          {count !== undefined && (
            <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">{count}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortefeuilleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: res, loading, refetch } = useApi<{ data: Portefeuille }>(
    `/api/admin/ria/portefeuilles/${id}`
  );
  const { data: analyseRes, loading: analyseLoading, refetch: refetchAnalyse } = useApi<{ data: AnalyseData }>(
    `/api/admin/ria/portefeuilles/${id}/analyse`
  );
  const pf = res?.data;
  const analyse = analyseRes?.data ?? null;

  if (loading && !pf) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }
  if (!pf) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-3">
        <p>Portefeuille introuvable.</p>
        <Link href="/dashboard/user/responsablesRIA/portefeuilles" className="text-emerald-600 hover:underline text-sm">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const m = pf.profilRIA.gestionnaire.member;
  const totalInvesti = toNum(pf.capitalInvesti);
  const encoursPct   = totalInvesti > 0 ? (toNum(pf.capitalEngage) / totalInvesti) * 100 : 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/dashboard/user/responsablesRIA/portefeuilles"
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Portefeuilles
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-lg font-bold text-slate-900">{pf.nom ?? pf.reference}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${pf.actif ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {pf.actif
            ? <><CheckCircle className="w-3 h-3 inline mr-1" />Actif</>
            : <><XCircle className="w-3 h-3 inline mr-1" />Inactif</>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/dashboard/user/responsablesRIA/investisseurs/${m.id}`}
            className="text-xs px-3 py-1.5 text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> Fiche investisseur
          </Link>
          <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Identité + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Investisseur */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg flex-shrink-0">
              {m.prenom[0]}{m.nom[0]}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{m.prenom} {m.nom}</p>
              {pf.profilRIA.numero     && <p className="text-xs font-mono text-emerald-600">{pf.profilRIA.numero}</p>}
              {pf.profilRIA.profession && <p className="text-xs text-slate-400">{pf.profilRIA.profession}</p>}
            </div>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="w-3.5 h-3.5 text-slate-400" /><span className="truncate">{m.email}</span>
            </div>
            {m.telephone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-3.5 h-3.5 text-slate-400" />{m.telephone}
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 space-y-0.5">
            <p className="text-xs text-slate-400">Créé le {fmtDate(pf.createdAt)}</p>
            <p className="text-xs font-mono text-slate-500">{pf.reference}</p>
            {pf.notes && <p className="text-xs text-slate-500 mt-1">{pf.notes}</p>}
          </div>
          {/* Barre encours */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Capital engagé</span><span>{encoursPct.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, encoursPct)}%` }} />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          <KpiCard label="Capital investi"    value={`${fmt(toNum(pf.capitalInvesti))} F`}      color="text-slate-900"   icon={<Wallet      className="w-4 h-4 text-slate-500"   />} />
          <KpiCard label="Capital disponible" value={`${fmt(toNum(pf.capitalDisponible))} F`}   color="text-emerald-700" icon={<Wallet      className="w-4 h-4 text-emerald-500" />} />
          <KpiCard label="Capital engagé"     value={`${fmt(toNum(pf.capitalEngage))} F`}       color="text-blue-700"    icon={<Activity    className="w-4 h-4 text-blue-500"    />} />
          <KpiCard label="Capital recouvré"   value={`${fmt(toNum(pf.capitalRecouvre))} F`}     color="text-teal-700"    icon={<TrendingUp  className="w-4 h-4 text-teal-500"    />} />
          <KpiCard label="Bénéfices générés"  value={`${fmt(toNum(pf.beneficesGeneres))} F`}    color="text-violet-700"  icon={<DollarSign  className="w-4 h-4 text-violet-500"  />} />
          <KpiCard label="Bénéf. distribués"  value={`${fmt(toNum(pf.beneficesDistribues))} F`} color="text-emerald-600" icon={<ArrowUpCircle className="w-4 h-4 text-emerald-400" />} />
          <KpiCard label="Bénéf. réinvestis"  value={`${fmt(toNum(pf.beneficesReinvestis))} F`} color="text-blue-600"    icon={<TrendingUp  className="w-4 h-4 text-blue-400"    />} />
          <KpiCard label="Fonds de sécurité"  value={`${fmt(toNum(pf.fondSecurite))} F`}        color="text-amber-700"   icon={<Shield      className="w-4 h-4 text-amber-500"   />} />
        </div>
      </div>

      {/* Dépôts */}
      <Section title="Dépôts" count={pf.depots.length}>
        <div className="divide-y divide-slate-100">
          {pf.depots.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucun dépôt</p>
          ) : pf.depots.map((d) => (
            <div key={d.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ArrowDownCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-mono text-slate-500">{d.reference}</p>
                  <p className="text-xs text-slate-400">
                    {fmtDate(d.createdAt)}{d.modePaiement ? ` · ${d.modePaiement}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-900">
                  {fmt(toNum(d.montant))} <span className="text-xs font-normal text-slate-400">F</span>
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_DEPOT[d.statut] ?? "bg-slate-100 text-slate-600"}`}>
                  {d.statut.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Retraits */}
      <Section title="Retraits" count={pf.retraits.length}>
        <div className="divide-y divide-slate-100">
          {pf.retraits.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucun retrait</p>
          ) : pf.retraits.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ArrowUpCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-mono text-slate-500">{r.reference}</p>
                  <p className="text-xs text-slate-400">
                    {fmtDate(r.createdAt)}{r.motif ? ` · ${r.motif}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-900">
                  {fmt(toNum(r.montant))} <span className="text-xs font-normal text-slate-400">F</span>
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_RETRAIT[r.statut] ?? "bg-slate-100 text-slate-600"}`}>
                  {r.statut.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Financements */}
      <Section title="Financements" count={pf.financements.length}>
        <div className="divide-y divide-slate-100">
          {pf.financements.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucun financement</p>
          ) : pf.financements.map((f) => {
            const pct = toNum(f.montantFinance) > 0
              ? (toNum(f.montantRembourse) / toNum(f.montantFinance)) * 100
              : 0;
            return (
              <div key={f.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{f.client.prenom} {f.client.nom}</p>
                    <p className="text-xs text-slate-400 font-mono">
                      {f.reference} · {fmtDate(f.dateFinancement)}
                      {f.dateEcheance ? ` → ${fmtDate(f.dateEcheance)}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-slate-900">
                      {fmt(toNum(f.montantFinance))} <span className="text-xs font-normal text-slate-400">F</span>
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUT_FINANCEMENT[f.statut] ?? "bg-slate-100 text-slate-600"}`}>
                      {f.statut.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Remboursé : {fmt(toNum(f.montantRembourse))} F</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Distributions */}
      <Section title="Distributions de bénéfices" count={pf.distributions.length}>
        <div className="divide-y divide-slate-100">
          {pf.distributions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucune distribution</p>
          ) : pf.distributions.map((dist) => (
            <div key={dist.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">
                  {MOIS_FR[(dist.mois ?? 1) - 1]} {dist.annee}
                </p>
                <p className="text-xs text-slate-400">
                  Distribué : {fmt(toNum(dist.montantDistribue))} F
                  {toNum(dist.montantReinvesti) > 0 && ` · Réinvesti : ${fmt(toNum(dist.montantReinvesti))} F`}
                  {toNum(dist.montantFondSecurite) > 0 && ` · Sécurité : ${fmt(toNum(dist.montantFondSecurite))} F`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-900">
                  {fmt(toNum(dist.montantGenere))} <span className="text-xs font-normal text-slate-400">F</span>
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_DISTRIB[dist.statut] ?? "bg-slate-100 text-slate-600"}`}>
                  {dist.statut.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Analyse de portefeuille */}
      <Section title="Analyse de portefeuille" count={undefined}>
        {analyseLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Calcul en cours…
          </div>
        ) : !analyse ? (
          <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
            <p className="text-sm">Impossible de charger l&apos;analyse.</p>
            <button onClick={refetchAnalyse} className="text-sm text-emerald-600 hover:underline">Réessayer</button>
          </div>
        ) : (
          <div className="p-5 space-y-6">

            {/* Durée */}
            <p className="text-xs text-slate-400">
              Portefeuille actif depuis <span className="font-semibold text-slate-700">{analyse.dureeMois} mois</span>
              {analyse.dureeAns >= 1 && <> ({analyse.dureeAns.toFixed(1)} an{analyse.dureeAns >= 2 ? "s" : ""})</>}
            </p>

            {/* Performance Financière */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-700">Performance Financière</p>
                <button onClick={refetchAnalyse} className="ml-auto text-xs text-slate-400 hover:text-slate-600"><RefreshCw className="w-3 h-3" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Capital investi",   value: `${fmt(analyse.capitalInvesti)} F`,  color: "text-slate-900"   },
                  { label: "Capital récupéré",  value: `${fmt(analyse.capitalRecupere)} F`, color: "text-violet-700"  },
                  { label: "Bénéfice brut",     value: `${fmt(analyse.beneficeBrut)} F`,    color: "text-amber-700"   },
                  { label: "Bénéfice net",      value: `${fmt(analyse.beneficeNet)} F`,     color: analyse.beneficeNet >= 0 ? "text-emerald-700" : "text-red-600" },
                  { label: "Cash-flow net",     value: `${fmt(analyse.cashFlowNet)} F`,     color: analyse.cashFlowNet >= 0 ? "text-emerald-700" : "text-red-600" },
                ].map((k) => (
                  <div key={k.label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400">{k.label}</p>
                    <p className={`text-sm font-bold tabular-nums mt-0.5 ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {[
                  { label: "ROI",              value: analyse.roi.toFixed(2) + " %",             color: analyse.roi >= 0 ? "text-emerald-700" : "text-red-600", icon: <Percent className="w-3.5 h-3.5" /> },
                  { label: "Rendement mensuel",value: analyse.rendementMensuel.toFixed(3) + " %", color: "text-blue-700",   icon: <TrendingUp className="w-3.5 h-3.5" /> },
                  { label: "Rendement annuel", value: analyse.rendementAnnuel.toFixed(2) + " %",  color: "text-indigo-700", icon: <TrendingUp className="w-3.5 h-3.5" /> },
                  { label: "TRI (CAGR)",       value: analyse.triSimplifiee.toFixed(2) + " %",    color: "text-violet-700", icon: <Activity   className="w-3.5 h-3.5" /> },
                ].map((k) => (
                  <div key={k.label} className="bg-slate-50 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-slate-400 flex-shrink-0">{k.icon}</span>
                    <div>
                      <p className="text-xs text-slate-400">{k.label}</p>
                      <p className={`text-sm font-bold tabular-nums ${k.color}`}>{k.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Commerciale */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-slate-700">Performance Commerciale</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Clients financés", value: analyse.nbClientsFinances, color: "text-slate-900",   icon: <Users      className="w-3.5 h-3.5 text-slate-400"   /> },
                  { label: "Nouveaux (30j)",   value: analyse.nouveauxClients,   color: "text-blue-700",   icon: <UserCheck  className="w-3.5 h-3.5 text-blue-400"    /> },
                  { label: "Actifs",           value: analyse.clientsActifs,     color: "text-emerald-700",icon: <UserCheck  className="w-3.5 h-3.5 text-emerald-400"  /> },
                  { label: "Inactifs",         value: analyse.clientsInactifs,   color: "text-amber-700",  icon: <UserMinus  className="w-3.5 h-3.5 text-amber-400"    /> },
                  { label: "Perdus",           value: analyse.clientsPerdus,     color: analyse.clientsPerdus > 0 ? "text-red-700" : "text-slate-400", icon: <UserX className="w-3.5 h-3.5 text-red-400" /> },
                ].map((k) => (
                  <div key={k.label} className="bg-slate-50 rounded-xl p-3 flex items-center gap-2">
                    <span className="flex-shrink-0">{k.icon}</span>
                    <div>
                      <p className="text-xs text-slate-400">{k.label}</p>
                      <p className={`text-base font-bold tabular-nums ${k.color}`}>{k.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance de Recouvrement */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-violet-600" />
                <p className="text-sm font-semibold text-slate-700">Performance de Recouvrement</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  { label: "Montant attendu",  value: `${fmt(analyse.montantAttendu)} F`,  color: "text-slate-900"   },
                  { label: "Montant recouvré", value: `${fmt(analyse.montantRecouvre)} F`, color: "text-emerald-700" },
                  { label: "Écart",            value: `${fmt(analyse.ecart)} F`,           color: analyse.ecart > 0 ? "text-amber-600" : "text-emerald-600" },
                  { label: "Encours impayés",  value: `${fmt(analyse.encoursImpayes)} F`,  color: analyse.encoursImpayes > 0 ? "text-red-600" : "text-slate-400" },
                ].map((k) => (
                  <div key={k.label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400">{k.label}</p>
                    <p className={`text-sm font-bold tabular-nums mt-0.5 ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-500" /> Taux de recouvrement
                    </span>
                    <span className={`font-bold ${analyse.tauxRecouvrement >= 80 ? "text-emerald-700" : analyse.tauxRecouvrement >= 50 ? "text-amber-600" : "text-red-600"}`}>
                      {analyse.tauxRecouvrement.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={analyse.tauxRecouvrement} max={100}
                    color={analyse.tauxRecouvrement >= 80 ? "bg-emerald-500" : analyse.tauxRecouvrement >= 50 ? "bg-amber-400" : "bg-red-400"} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-400" /> Taux d&apos;impayés
                    </span>
                    <span className={`font-bold ${analyse.tauxImpayes === 0 ? "text-emerald-700" : analyse.tauxImpayes <= 10 ? "text-amber-600" : "text-red-600"}`}>
                      {analyse.tauxImpayes.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={analyse.tauxImpayes} max={100}
                    color={analyse.tauxImpayes === 0 ? "bg-emerald-500" : analyse.tauxImpayes <= 10 ? "bg-amber-400" : "bg-red-500"} />
                </div>
              </div>
            </div>

            {/* Évolution mensuelle */}
            {analyse.evolutionMensuelle.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold text-slate-700">Évolution mensuelle</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[360px]">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100">
                        <th className="pb-2 text-left font-medium">Période</th>
                        <th className="pb-2 text-right font-medium">Bénéfice</th>
                        <th className="pb-2 text-right font-medium">Distribué</th>
                        <th className="pb-2 text-right font-medium">Rend. mois</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {analyse.evolutionMensuelle.map((e) => (
                        <tr key={`${e.annee}-${e.mois}`} className="hover:bg-slate-50">
                          <td className="py-1.5 text-slate-700">{MOIS_FR[(e.mois ?? 1) - 1]} {e.annee}</td>
                          <td className="py-1.5 text-right text-amber-600 font-semibold tabular-nums">{fmt(e.montantGenere)} F</td>
                          <td className="py-1.5 text-right text-emerald-600 tabular-nums">{fmt(e.montantDistribue)} F</td>
                          <td className="py-1.5 text-right font-bold text-indigo-600">{e.rendementMois.toFixed(3)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </Section>

      {/* Journal mouvements */}
      <Section title="Journal des mouvements" count={pf.mouvements.length}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Date", "Type", "Sens", "Montant", "Référence", "Description"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pf.mouvements.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Aucun mouvement</td></tr>
              ) : pf.mouvements.map((mv) => (
                <tr key={mv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fmtDate(mv.createdAt)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{mv.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-bold ${mv.sens === "CREDIT" ? "text-emerald-600" : "text-red-500"}`}>
                      {mv.sens === "CREDIT" ? "▲ CRÉDIT" : "▼ DÉBIT"}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 font-semibold ${mv.sens === "CREDIT" ? "text-emerald-700" : "text-red-600"}`}>
                    {fmt(toNum(mv.montant))} <span className="text-xs font-normal text-slate-400">F</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{mv.reference ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-400 max-w-[200px] truncate">{mv.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
