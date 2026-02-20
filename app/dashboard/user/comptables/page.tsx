"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Calculator, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  ArrowLeft, RefreshCw, Download, Search, ChevronLeft, ChevronRight,
  FileText, BarChart3, BookOpen, Wallet, Package, Calendar,
  ShoppingCart, CreditCard, Banknote, Users, Coins, AlertCircle,
  CheckCircle, Clock, Filter, X,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateShort, formatDateTime } from "@/lib/format";

// ── Types ──────────────────────────────────────────────────────────────────

interface EvolutionPoint { date: string; encaissements: number; decaissements: number; }

interface SyntheseResponse {
  success: boolean;
  data: {
    periode: { debut: string; fin: string; jours: number };
    encaissements: {
      cotisations:            { montant: number; count: number };
      contributions_tontines: { montant: number; count: number };
      remboursements_credits: { montant: number };
      total: number;
    };
    activiteProduits: {
      ventes: { montant: number; count: number };
    };
    decaissements: {
      approvisionnements: { montant: number; count: number };
      credits_decaisses:  { montant: number };
      pots_tontines:      { montant: number };
      total: number;
    };
    resultat_net: number;
    taux_utilisation: number;
    evolution: EvolutionPoint[];
    snapshot: {
      stock:          { valeur: number; nombreProduits: number };
      membresActifs:  number;
      tontinesActives: number;
      creditsEnCours: number;
    };
  };
}

interface JournalEntry {
  id: string;
  sourceId: number;
  date: string;
  type: "ENCAISSEMENT" | "DECAISSEMENT" | "ACTIVITE";
  categorie: string;
  libelle: string;
  montant: number;
  reference: string;
}

interface JournalResponse {
  success: boolean;
  data: JournalEntry[];
  totaux: { encaissements: number; decaissements: number; activite: number; net: number };
  meta: { total: number; page: number; limit: number; totalPages: number; dateDebut: string; dateFin: string };
}

interface EtatsFinanciersResponse {
  success: boolean;
  data: {
    annee: number;
    bilan: {
      actif: {
        stock:               { valeur: number; nombreProduits: number };
        creancesCotisations: { valeur: number; count: number };
        creditsAlimentaires: { valeur: number; count: number };
        creditsFinanciers:   { valeur: number; count: number };
        total: number;
      };
      passif: {
        engagementsTontines: { valeur: number; count: number };
        creditsAlimAlloues:  { valeur: number };
        capitauxPropres:     number;
        total: number;
      };
    };
    compteResultat: {
      produits: { ventes: number; cotisationsCollectees: number; contributionsTontines: number; remboursementsCredits: number; total: number };
      charges:  { approvisionnements: number; creditsDecaisses: number; potsTontinesVerses: number; total: number };
      resultatNet: number;
    };
    ratios: {
      tauxRecouvrement: number;
      tauxUtilisationCreditsAlim: number;
      margeNette: number;
      ratioCharges: number;
    };
  };
}

// ── Helpers chart SVG ─────────────────────────────────────────────────────

const VB_W = 1000;
const VB_H = 180;

function buildLine(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${(p.x * VB_W).toFixed(1)} ${(p.y * VB_H).toFixed(1)}`).join(" ");
}

function buildArea(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  const line = buildLine(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${line} L ${(last.x * VB_W).toFixed(1)} ${VB_H} L ${(first.x * VB_W).toFixed(1)} ${VB_H} Z`;
}

function normalizePoints(data: EvolutionPoint[], key: "encaissements" | "decaissements", max: number) {
  if (data.length === 0 || max === 0) return data.map((_, i) => ({ x: data.length === 1 ? 0.5 : i / (data.length - 1), y: 1 }));
  return data.map((d, i) => ({
    x: data.length === 1 ? 0.5 : i / (data.length - 1),
    y: 1 - d[key] / max,
  }));
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ── Sub-components ────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, bg, trend }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  color: string; bg: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className={`${bg} p-2.5 rounded-xl group-hover:scale-110 transition-transform`}>
          <Icon className={`${color} w-5 h-5`} />
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend === "up" ? "bg-emerald-50 text-emerald-600" : trend === "down" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
          }`}>
            {trend === "up" ? <ArrowUpRight className="inline w-3 h-3" /> : trend === "down" ? <ArrowDownRight className="inline w-3 h-3" /> : "—"}
          </span>
        )}
      </div>
      <p className="text-slate-500 text-xs font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function BarBreakdown({ label, montant, total, color }: {
  label: string; montant: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((montant / total) * 100) : 0;
  return (
    <div className="py-2.5">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="text-slate-800 font-bold">{formatCurrency(montant)}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-400 mt-0.5 text-right">{pct}%</p>
    </div>
  );
}

function BilanRow({ label, sub, valeur, type }: {
  label: string; sub?: string; valeur: number; type?: "highlight" | "total";
}) {
  return (
    <div className={`flex justify-between items-center py-3 ${type === "total" ? "border-t-2 border-slate-200 mt-1 pt-4" : "border-b border-slate-100"}`}>
      <div>
        <p className={`${type === "total" ? "font-bold text-slate-800" : "text-slate-600 text-sm"}`}>{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <span className={`font-bold ${type === "total" ? "text-lg text-slate-900" : "text-slate-700"}`}>
        {formatCurrency(valeur)}
      </span>
    </div>
  );
}

const CAT_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  VENTE:                { label: "Ventes",               color: "text-emerald-600", bg: "bg-emerald-100", icon: ShoppingCart },
  COTISATION:           { label: "Cotisations",           color: "text-blue-600",   bg: "bg-blue-100",   icon: Calendar },
  CONTRIBUTION_TONTINE: { label: "Contributions tontine", color: "text-violet-600", bg: "bg-violet-100", icon: Coins },
  REMBOURSEMENT_CREDIT: { label: "Remb. crédit",          color: "text-teal-600",   bg: "bg-teal-100",   icon: TrendingUp },
  APPROVISIONNEMENT:    { label: "Approvisionnement",     color: "text-orange-600", bg: "bg-orange-100", icon: Package },
  CREDIT_DECAISSE:      { label: "Crédit décaissé",       color: "text-red-600",    bg: "bg-red-100",    icon: CreditCard },
  POT_TONTINE:          { label: "Pot tontine versé",     color: "text-pink-600",   bg: "bg-pink-100",   icon: Banknote },
};

// ── Main Page ─────────────────────────────────────────────────────────────

type Period = "7" | "30" | "90" | "365";
type Tab = "synthese" | "journal" | "tresorerie" | "etats";

export default function ComptablePage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("30");
  const [activeTab, setActiveTab] = useState<Tab>("synthese");

  // Journal state
  const [journalPage, setJournalPage]           = useState(1);
  const [journalType, setJournalType]           = useState("TOUS");
  const [journalCategorie, setJournalCategorie] = useState("");
  const [journalSearch, setJournalSearch]       = useState("");
  const [debouncedSearch, setDebouncedSearch]   = useState("");
  const [journalDateDebut, setJournalDateDebut] = useState("");
  const [journalDateFin, setJournalDateFin]     = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(journalSearch); setJournalPage(1); }, 400);
    return () => clearTimeout(t);
  }, [journalSearch]);

  // ── API calls ─────────────────────────────────────────────────────────

  const { data: synthData, loading: synthLoading, refetch: refetchSynth } =
    useApi<SyntheseResponse>(`/api/comptable/synthese?period=${selectedPeriod}`);

  const journalUrl = useMemo(() => {
    const p = new URLSearchParams({ page: String(journalPage), limit: "20" });
    if (journalType !== "TOUS") p.set("type", journalType);
    if (journalCategorie)       p.set("categorie", journalCategorie);
    if (debouncedSearch)        p.set("search", debouncedSearch);
    if (journalDateDebut)       p.set("dateDebut", journalDateDebut);
    if (journalDateFin)         p.set("dateFin", journalDateFin);
    return `/api/comptable/journal?${p.toString()}`;
  }, [journalPage, journalType, journalCategorie, debouncedSearch, journalDateDebut, journalDateFin]);

  const { data: journalData, loading: journalLoading } = useApi<JournalResponse>(
    activeTab === "journal" ? journalUrl : null
  );

  const { data: etatsData, loading: etatsLoading } = useApi<EtatsFinanciersResponse>(
    activeTab === "etats" ? "/api/comptable/etats-financiers" : null
  );

  // ── Computed ──────────────────────────────────────────────────────────

  const sd = synthData?.data;
  const ed = etatsData?.data;

  const globalMax = useMemo(() => {
    if (!sd) return 1;
    return Math.max(...sd.evolution.flatMap((e) => [e.encaissements, e.decaissements]), 1);
  }, [sd]);

  const encaisPoints = useMemo(() => normalizePoints(sd?.evolution ?? [], "encaissements", globalMax), [sd, globalMax]);
  const decaisPoints = useMemo(() => normalizePoints(sd?.evolution ?? [], "decaissements", globalMax), [sd, globalMax]);

  const xLabels = useMemo(() => {
    const pts = sd?.evolution ?? [];
    if (pts.length === 0) return [];
    const n = pts.length;
    const idxs = [...new Set([0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1])];
    return idxs.map((i) => ({ xPct: (i / (n - 1)) * 100, label: fmtDateShort(pts[i].date) }));
  }, [sd]);

  const yMax = globalMax;
  const yLabels = useMemo(() =>
    [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      val:  yMax * f,
      yPct: 100 - f * 100,
    })),
    [yMax]
  );

  // ── Loading state ──────────────────────────────────────────────────────

  if (synthLoading && !sd) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement de la comptabilité…</p>
        </div>
      </div>
    );
  }

  const enc = sd?.encaissements;
  const act = sd?.activiteProduits;
  const dec = sd?.decaissements;
  const snap = sd?.snapshot;

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "synthese",   label: "Synthèse",          icon: BarChart3  },
    { key: "journal",    label: "Journal",            icon: BookOpen   },
    { key: "tresorerie", label: "Trésorerie",         icon: Wallet     },
    { key: "etats",      label: "États Financiers",   icon: FileText   },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/20">

      {/* ── Navbar ── */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
                <Calculator className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-slate-800">Comptabilité</h1>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            {(["7", "30", "90", "365"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedPeriod === p
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {p === "365" ? "1 an" : `${p}j`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={refetchSynth} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw size={18} />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm text-sm font-medium">
              <Download size={16} />Exporter
            </button>
            <NotificationBell href="/dashboard/user/notifications" />
            <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">

        {/* ── Header ── */}
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Comptabilité Générale</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Période : {sd ? formatDateShort(sd.periode.debut) : "…"} → {sd ? formatDateShort(sd.periode.fin) : "…"}
          </p>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Encaissements"
            value={enc ? formatCurrency(enc.total) : "…"}
            sub={`${enc?.cotisations.count ?? 0} cotisations · ${enc?.contributions_tontines.count ?? 0} contributions`}
            icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" trend="up"
          />
          <KpiCard
            label="Total Décaissements"
            value={dec ? formatCurrency(dec.total) : "…"}
            sub={`Dont appro : ${formatCurrency(dec?.approvisionnements.montant ?? 0)}`}
            icon={TrendingDown} color="text-red-500" bg="bg-red-50" trend="down"
          />
          <KpiCard
            label="Résultat Net"
            value={sd ? formatCurrency(sd.resultat_net) : "…"}
            sub={`Taux utilisation budget : ${sd?.taux_utilisation ?? 0}%`}
            icon={sd && sd.resultat_net >= 0 ? CheckCircle : AlertCircle}
            color={sd && sd.resultat_net >= 0 ? "text-emerald-600" : "text-red-500"}
            bg={sd && sd.resultat_net >= 0 ? "bg-emerald-50" : "bg-red-50"}
            trend={sd && sd.resultat_net >= 0 ? "up" : "down"}
          />
          <KpiCard
            label="Valeur du Stock"
            value={snap ? formatCurrency(snap.stock.valeur) : "…"}
            sub={`${snap?.stock.nombreProduits ?? 0} produits — ${snap?.membresActifs ?? 0} membres actifs`}
            icon={Package} color="text-blue-600" bg="bg-blue-50"
          />
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white rounded-2xl p-1.5 flex gap-1 shadow-sm border border-slate-200/60">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === t.key
                    ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={16} />{t.label}
              </button>
            );
          })}
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 1 : SYNTHÈSE                                               */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "synthese" && (
          <div className="space-y-5">

            {/* Chart évolution */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Évolution Encaissements / Décaissements</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Flux journaliers sur la période</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" />Encaissements</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-400 inline-block rounded border-dashed" />Décaissements</span>
                </div>
              </div>

              <div className="relative" style={{ height: 230 }}>
                {encaisPoints.length > 1 ? (
                  <>
                    {yLabels.map((lbl) => (
                      <div key={lbl.yPct}
                        className="absolute left-0 w-12 text-right text-[10px] text-slate-400 leading-none select-none"
                        style={{ top: `${(lbl.yPct / 100) * 190}px`, transform: "translateY(-50%)" }}
                      >
                        {lbl.val >= 1000000 ? `${Math.round(lbl.val / 1000000)}M` : lbl.val >= 1000 ? `${Math.round(lbl.val / 1000)}k` : Math.round(lbl.val)}
                      </div>
                    ))}

                    <div className="absolute left-14 right-0 top-0" style={{ height: 190 }}>
                      <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="cptEncGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                          </linearGradient>
                          <linearGradient id="cptDecGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.01" />
                          </linearGradient>
                        </defs>
                        {yLabels.map((lbl) => (
                          <line key={lbl.yPct} x1="0" x2={VB_W}
                            y1={(lbl.yPct / 100) * VB_H} y2={(lbl.yPct / 100) * VB_H}
                            stroke="#f1f5f9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        ))}
                        <path d={buildArea(encaisPoints)} fill="url(#cptEncGrad)" />
                        <path d={buildArea(decaisPoints)} fill="url(#cptDecGrad)" />
                        <path d={buildLine(encaisPoints)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        <path d={buildLine(decaisPoints)} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />
                      </svg>
                    </div>

                    <div className="absolute left-14 right-0" style={{ top: 195 }}>
                      {xLabels.map(({ xPct, label }) => (
                        <span key={xPct} className="absolute text-[10px] text-slate-400 whitespace-nowrap select-none"
                          style={{ left: `${xPct}%`, transform: "translateX(-50%)" }}>{label}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    Aucune donnée sur cette période
                  </div>
                )}
              </div>
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Encaissements */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h3 className="font-bold text-slate-800">Détail Encaissements</h3>
                </div>
                <p className="text-xs text-slate-400 mb-2">Cash réellement reçu</p>
                <p className="text-2xl font-bold text-emerald-600 mb-5">{formatCurrency(enc?.total ?? 0)}</p>
                <div className="space-y-1 divide-y divide-slate-100">
                  <BarBreakdown label={`Cotisations (${enc?.cotisations.count ?? 0})`} montant={enc?.cotisations.montant ?? 0}             total={enc?.total ?? 1} color="bg-blue-500" />
                  <BarBreakdown label={`Contributions tontines (${enc?.contributions_tontines.count ?? 0})`} montant={enc?.contributions_tontines.montant ?? 0} total={enc?.total ?? 1} color="bg-violet-500" />
                  <BarBreakdown label="Remboursements crédits"                          montant={enc?.remboursements_credits.montant ?? 0} total={enc?.total ?? 1} color="bg-teal-500" />
                </div>
              </div>

              {/* Activité Produits */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <h3 className="font-bold text-slate-800">Activité Produits</h3>
                </div>
                <p className="text-xs text-slate-400 mb-2">Consommation de crédits pré-financés</p>
                <p className="text-2xl font-bold text-blue-600 mb-5">{formatCurrency(act?.ventes.montant ?? 0)}</p>
                <div className="space-y-1 divide-y divide-slate-100">
                  <BarBreakdown label={`Ventes crédit alim. (${act?.ventes.count ?? 0})`} montant={act?.ventes.montant ?? 0} total={act?.ventes.montant ?? 1} color="bg-blue-500" />
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Ces ventes consomment des crédits pré-financés par les cotisations. Elles ne représentent pas un nouvel encaissement de trésorerie.
                  </p>
                </div>
              </div>

              {/* Décaissements */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <h3 className="font-bold text-slate-800">Détail Décaissements</h3>
                </div>
                <p className="text-2xl font-bold text-red-500 mb-5">{formatCurrency(dec?.total ?? 0)}</p>
                <div className="space-y-1 divide-y divide-slate-100">
                  <BarBreakdown label={`Approvisionnements (${dec?.approvisionnements.count ?? 0})`} montant={dec?.approvisionnements.montant ?? 0} total={dec?.total ?? 1} color="bg-orange-500" />
                  <BarBreakdown label="Crédits décaissés"   montant={dec?.credits_decaisses.montant ?? 0}  total={dec?.total ?? 1} color="bg-red-500" />
                  <BarBreakdown label="Pots tontines versés" montant={dec?.pots_tontines.montant ?? 0}      total={dec?.total ?? 1} color="bg-pink-500" />
                </div>

                {/* Résultat net */}
                <div className={`mt-5 p-4 rounded-xl border-2 ${(sd?.resultat_net ?? 0) >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-sm">Résultat Net de la période</span>
                    <span className={`text-xl font-bold ${(sd?.resultat_net ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {(sd?.resultat_net ?? 0) >= 0 ? "+" : ""}{formatCurrency(sd?.resultat_net ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Indicateurs snapshot */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Membres actifs",    value: snap?.membresActifs ?? 0,   icon: Users,    color: "text-blue-600",   bg: "bg-blue-50" },
                { label: "Tontines actives",  value: snap?.tontinesActives ?? 0, icon: Coins,    color: "text-violet-600", bg: "bg-violet-50" },
                { label: "Crédits en cours",  value: snap?.creditsEnCours ?? 0,  icon: CreditCard, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Produits en stock", value: snap?.stock.nombreProduits ?? 0, icon: Package, color: "text-slate-600", bg: "bg-slate-100" },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/60 flex items-center gap-3">
                  <div className={`${item.bg} p-2.5 rounded-xl`}><item.icon className={`${item.color} w-5 h-5`} /></div>
                  <div>
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="text-xl font-bold text-slate-800">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 2 : JOURNAL DES OPÉRATIONS                                 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "journal" && (
          <div className="space-y-4">

            {/* Filtres */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Rechercher…"
                    value={journalSearch}
                    onChange={(e) => setJournalSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                  />
                </div>

                {/* Type */}
                <select
                  value={journalType}
                  onChange={(e) => { setJournalType(e.target.value); setJournalPage(1); }}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="TOUS">Tous les types</option>
                  <option value="ENCAISSEMENT">Encaissements</option>
                  <option value="DECAISSEMENT">Décaissements</option>
                  <option value="ACTIVITE">Activité produits</option>
                </select>

                {/* Catégorie */}
                <select
                  value={journalCategorie}
                  onChange={(e) => { setJournalCategorie(e.target.value); setJournalPage(1); }}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Toutes catégories</option>
                  {Object.entries(CAT_META).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>

                {/* Date range */}
                <div className="flex gap-2">
                  <input type="date" value={journalDateDebut} onChange={(e) => { setJournalDateDebut(e.target.value); setJournalPage(1); }}
                    className="flex-1 px-2 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  <input type="date" value={journalDateFin} onChange={(e) => { setJournalDateFin(e.target.value); setJournalPage(1); }}
                    className="flex-1 px-2 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  {(journalType !== "TOUS" || journalCategorie || debouncedSearch || journalDateDebut || journalDateFin) && (
                    <button onClick={() => { setJournalType("TOUS"); setJournalCategorie(""); setJournalSearch(""); setJournalDateDebut(""); setJournalDateFin(""); setJournalPage(1); }}
                      className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Totaux du filtre */}
            {journalData && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 flex items-center gap-3">
                  <ArrowUpRight className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-700 font-medium">Encaissements filtrés</p>
                    <p className="text-lg font-bold text-emerald-700">{formatCurrency(journalData.totaux.encaissements)}</p>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 flex items-center gap-3">
                  <ShoppingCart className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Activité produits filtrée</p>
                    <p className="text-lg font-bold text-blue-700">{formatCurrency(journalData.totaux.activite ?? 0)}</p>
                  </div>
                </div>
                <div className="bg-red-50 rounded-xl p-4 border border-red-200 flex items-center gap-3">
                  <ArrowDownRight className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-red-700 font-medium">Décaissements filtrés</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(journalData.totaux.decaissements)}</p>
                  </div>
                </div>
                <div className={`rounded-xl p-4 border flex items-center gap-3 ${journalData.totaux.net >= 0 ? "bg-slate-50 border-slate-200" : "bg-orange-50 border-orange-200"}`}>
                  <Wallet className={`w-5 h-5 flex-shrink-0 ${journalData.totaux.net >= 0 ? "text-slate-600" : "text-orange-600"}`} />
                  <div>
                    <p className={`text-xs font-medium ${journalData.totaux.net >= 0 ? "text-slate-600" : "text-orange-700"}`}>Solde net filtré</p>
                    <p className={`text-lg font-bold ${journalData.totaux.net >= 0 ? "text-slate-800" : "text-orange-700"}`}>
                      {journalData.totaux.net >= 0 ? "+" : ""}{formatCurrency(journalData.totaux.net)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Table journal */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <BookOpen size={18} className="text-violet-600" />
                <h3 className="font-bold text-slate-800">Journal des Opérations</h3>
                {journalData && <span className="ml-auto text-xs text-slate-500">{journalData.meta.total} écritures</span>}
              </div>

              {journalLoading ? (
                <div className="p-12 text-center"><div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Référence</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Libellé</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Catégorie</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(journalData?.data ?? []).map((entry) => {
                        const meta = CAT_META[entry.categorie] ?? { label: entry.categorie, color: "text-slate-600", bg: "bg-slate-100", icon: Filter };
                        const CatIcon = meta.icon;
                        return (
                          <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDateTime(entry.date)}</td>
                            <td className="px-5 py-3 font-mono text-xs text-slate-500">{entry.reference}</td>
                            <td className="px-5 py-3 text-sm text-slate-700 max-w-xs truncate" title={entry.libelle}>{entry.libelle}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.color}`}>
                                <CatIcon size={11} />{meta.label}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                entry.type === "ENCAISSEMENT" ? "bg-emerald-100 text-emerald-700"
                                  : entry.type === "ACTIVITE" ? "bg-blue-100 text-blue-700"
                                  : "bg-red-100 text-red-700"
                              }`}>
                                {entry.type === "ENCAISSEMENT" ? <ArrowUpRight size={11} /> : entry.type === "ACTIVITE" ? <ShoppingCart size={11} /> : <ArrowDownRight size={11} />}
                                {entry.type === "ENCAISSEMENT" ? "Encaiss." : entry.type === "ACTIVITE" ? "Activité" : "Décaiss."}
                              </span>
                            </td>
                            <td className={`px-5 py-3 text-right font-bold ${
                              entry.type === "ENCAISSEMENT" ? "text-emerald-600"
                                : entry.type === "ACTIVITE" ? "text-blue-600"
                                : "text-red-600"
                            }`}>
                              {entry.type === "ENCAISSEMENT" ? "+" : entry.type === "ACTIVITE" ? "~" : "-"}{formatCurrency(entry.montant)}
                            </td>
                          </tr>
                        );
                      })}
                      {(journalData?.data ?? []).length === 0 && !journalLoading && (
                        <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Aucune écriture pour ces filtres</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {journalData && journalData.meta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page <b>{journalData.meta.page}</b> / <b>{journalData.meta.totalPages}</b> ({journalData.meta.total} écritures)
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setJournalPage((p) => Math.max(1, p - 1))} disabled={journalPage <= 1}
                      className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-semibold">{journalPage}</span>
                    <button onClick={() => setJournalPage((p) => Math.min(journalData.meta.totalPages, p + 1))} disabled={journalPage >= journalData.meta.totalPages}
                      className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 3 : TRÉSORERIE                                             */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "tresorerie" && (
          <div className="space-y-5">

            {/* Résumé trésorerie */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><ArrowUpRight size={24} /></div>
                  <div>
                    <p className="text-emerald-100 text-xs">Total Encaissements</p>
                    <p className="text-2xl font-bold">{formatCurrency(enc?.total ?? 0)}</p>
                  </div>
                </div>
                <div className="text-xs text-emerald-100 space-y-0.5">
                  <p>Cotisations : {formatCurrency(enc?.cotisations.montant ?? 0)}</p>
                  <p>Contributions : {formatCurrency(enc?.contributions_tontines.montant ?? 0)}</p>
                  <p>Remboursements : {formatCurrency(enc?.remboursements_credits.montant ?? 0)}</p>
                  <p className="mt-1 opacity-70">+ Activité produits : {formatCurrency(act?.ventes.montant ?? 0)}</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg shadow-red-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><ArrowDownRight size={24} /></div>
                  <div>
                    <p className="text-red-100 text-xs">Total Décaissements</p>
                    <p className="text-2xl font-bold">{formatCurrency(dec?.total ?? 0)}</p>
                  </div>
                </div>
                <div className="text-xs text-red-100 space-y-0.5">
                  <p>Approvisionnements : {formatCurrency(dec?.approvisionnements.montant ?? 0)}</p>
                  <p>Crédits décaissés : {formatCurrency(dec?.credits_decaisses.montant ?? 0)}</p>
                  <p>Pots tontines : {formatCurrency(dec?.pots_tontines.montant ?? 0)}</p>
                </div>
              </div>

              <div className={`rounded-2xl p-6 text-white shadow-lg ${(sd?.resultat_net ?? 0) >= 0 ? "bg-gradient-to-br from-slate-700 to-slate-800 shadow-slate-300" : "bg-gradient-to-br from-orange-500 to-orange-600 shadow-orange-200"}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><Wallet size={24} /></div>
                  <div>
                    <p className="text-white/80 text-xs">Solde Net de Trésorerie</p>
                    <p className="text-2xl font-bold">{(sd?.resultat_net ?? 0) >= 0 ? "+" : ""}{formatCurrency(sd?.resultat_net ?? 0)}</p>
                  </div>
                </div>
                <p className="text-xs text-white/70">
                  {(sd?.resultat_net ?? 0) >= 0 ? "✓ Trésorerie excédentaire" : "⚠ Trésorerie déficitaire"} sur {selectedPeriod === "365" ? "1 an" : `${selectedPeriod} jours`}
                </p>
                <p className="text-xs text-white/70 mt-1">Taux d&apos;utilisation budget : {sd?.taux_utilisation ?? 0}%</p>
              </div>
            </div>

            {/* Détail encaissements */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ArrowUpRight size={20} className="text-emerald-600" />Encaissements par source
                </h3>
                {[
                  { label: `Cotisations payées (${enc?.cotisations.count ?? 0})`,                montant: enc?.cotisations.montant ?? 0,             icon: Calendar,     color: "bg-blue-500",   text: "text-blue-600" },
                  { label: `Contributions tontines (${enc?.contributions_tontines.count ?? 0})`, montant: enc?.contributions_tontines.montant ?? 0,  icon: Coins,        color: "bg-violet-500", text: "text-violet-600" },
                  { label: "Remboursements crédits",                                              montant: enc?.remboursements_credits.montant ?? 0, icon: TrendingUp,   color: "bg-teal-500",   text: "text-teal-600" },
                ].map((item) => {
                  const pct = (enc?.total ?? 0) > 0 ? Math.round((item.montant / (enc?.total ?? 1)) * 100) : 0;
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                      <div className={`${item.color.replace("bg-", "bg-").replace("500", "100")} p-2 rounded-lg`}>
                        <Icon className={`${item.text} w-4 h-4`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-600 truncate">{item.label}</p>
                        <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm ${item.text}`}>{formatCurrency(item.montant)}</p>
                        <p className="text-xs text-slate-400">{pct}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Détail décaissements */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ArrowDownRight size={20} className="text-red-600" />Décaissements par destination
                </h3>
                {[
                  { label: `Approvisionnements stock (${dec?.approvisionnements.count ?? 0})`, montant: dec?.approvisionnements.montant ?? 0, icon: Package,    color: "bg-orange-500", text: "text-orange-600" },
                  { label: "Crédits décaissés aux membres",                                      montant: dec?.credits_decaisses.montant ?? 0,  icon: CreditCard, color: "bg-red-500",    text: "text-red-600" },
                  { label: "Pots tontines versés",                                               montant: dec?.pots_tontines.montant ?? 0,      icon: Banknote,   color: "bg-pink-500",   text: "text-pink-600" },
                ].map((item) => {
                  const pct = (dec?.total ?? 0) > 0 ? Math.round((item.montant / (dec?.total ?? 1)) * 100) : 0;
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                      <div className={`${item.color.replace("bg-", "bg-").replace("500", "100")} p-2 rounded-lg`}>
                        <Icon className={`${item.text} w-4 h-4`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-600 truncate">{item.label}</p>
                        <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm ${item.text}`}>{formatCurrency(item.montant)}</p>
                        <p className="text-xs text-slate-400">{pct}%</p>
                      </div>
                    </div>
                  );
                })}

                {/* Approvisionnements détail */}
                <div className="mt-4 p-4 bg-orange-50 rounded-xl border border-orange-200">
                  <p className="text-xs font-semibold text-orange-700 mb-1 flex items-center gap-1.5">
                    <Clock size={12} />Contrôle Approvisionnements
                  </p>
                  <p className="text-xs text-orange-600">
                    {dec?.approvisionnements.count ?? 0} entrées en stock sur la période
                    — représentent {dec?.total ?? 0 > 0 ? Math.round(((dec?.approvisionnements.montant ?? 0) / (dec?.total ?? 1)) * 100) : 0}% des décaissements.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 4 : ÉTATS FINANCIERS                                       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "etats" && (
          <div className="space-y-5">
            {etatsLoading && !ed ? (
              <div className="p-16 text-center"><div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" /></div>
            ) : ed ? (
              <>
                {/* Bilan */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  {/* ACTIF */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
                      <ArrowUpRight size={18} className="text-emerald-600" />
                      <h3 className="font-bold text-emerald-800">ACTIF — Bilan {ed.annee}</h3>
                    </div>
                    <div className="p-6">
                      <BilanRow label="Stock (valeur comptable)" sub={`${ed.bilan.actif.stock.nombreProduits} produits`} valeur={ed.bilan.actif.stock.valeur} />
                      <BilanRow label="Créances sur cotisations" sub={`${ed.bilan.actif.creancesCotisations.count} cotis. EN_ATTENTE`} valeur={ed.bilan.actif.creancesCotisations.valeur} />
                      <BilanRow label="Crédits alimentaires actifs" sub={`${ed.bilan.actif.creditsAlimentaires.count} crédits`} valeur={ed.bilan.actif.creditsAlimentaires.valeur} />
                      <BilanRow label="Crédits financiers accordés" sub={`${ed.bilan.actif.creditsFinanciers.count} crédits en cours`} valeur={ed.bilan.actif.creditsFinanciers.valeur} />
                      <BilanRow label="TOTAL ACTIF" valeur={ed.bilan.actif.total} type="total" />
                    </div>
                  </div>

                  {/* PASSIF */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="px-6 py-4 bg-red-50 border-b border-red-200 flex items-center gap-2">
                      <ArrowDownRight size={18} className="text-red-600" />
                      <h3 className="font-bold text-red-800">PASSIF — Bilan {ed.annee}</h3>
                    </div>
                    <div className="p-6">
                      <BilanRow label="Engagements tontines" sub={`${ed.bilan.passif.engagementsTontines.count} cycles EN_COURS`} valeur={ed.bilan.passif.engagementsTontines.valeur} />
                      <BilanRow label="Crédits alim. alloués (total)" valeur={ed.bilan.passif.creditsAlimAlloues.valeur} />
                      <BilanRow label="Capitaux propres (résiduel)" sub="Actif — Engagements" valeur={ed.bilan.passif.capitauxPropres} />
                      <BilanRow label="TOTAL PASSIF" valeur={ed.bilan.passif.total} type="total" />
                    </div>
                  </div>
                </div>

                {/* Compte de Résultat */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  {/* PRODUITS */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="px-6 py-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                      <h3 className="font-bold text-blue-800 flex items-center gap-2"><TrendingUp size={18} />Produits — CPC {ed.annee}</h3>
                      <span className="text-xs text-blue-600">Depuis le 1er janvier</span>
                    </div>
                    <div className="p-6">
                      <BilanRow label="Revenus des ventes"           valeur={ed.compteResultat.produits.ventes} />
                      <BilanRow label="Cotisations collectées"       valeur={ed.compteResultat.produits.cotisationsCollectees} />
                      <BilanRow label="Contributions tontines"       valeur={ed.compteResultat.produits.contributionsTontines} />
                      <BilanRow label="Remboursements crédits reçus" valeur={ed.compteResultat.produits.remboursementsCredits} />
                      <BilanRow label="TOTAL PRODUITS" valeur={ed.compteResultat.produits.total} type="total" />
                    </div>
                  </div>

                  {/* CHARGES */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="px-6 py-4 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
                      <h3 className="font-bold text-orange-800 flex items-center gap-2"><TrendingDown size={18} />Charges — CPC {ed.annee}</h3>
                      <span className="text-xs text-orange-600">Depuis le 1er janvier</span>
                    </div>
                    <div className="p-6">
                      <BilanRow label="Coût des approvisionnements"   valeur={ed.compteResultat.charges.approvisionnements} />
                      <BilanRow label="Crédits décaissés"             valeur={ed.compteResultat.charges.creditsDecaisses} />
                      <BilanRow label="Pots tontines versés"          valeur={ed.compteResultat.charges.potsTontinesVerses} />
                      <BilanRow label="TOTAL CHARGES" valeur={ed.compteResultat.charges.total} type="total" />
                    </div>

                    {/* Résultat net */}
                    <div className={`mx-6 mb-6 p-4 rounded-xl border-2 ${ed.compteResultat.resultatNet >= 0 ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">Résultat Net {ed.annee}</span>
                        <span className={`text-xl font-bold ${ed.compteResultat.resultatNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {ed.compteResultat.resultatNet >= 0 ? "+" : ""}{formatCurrency(ed.compteResultat.resultatNet)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ratios */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                  <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                    <BarChart3 size={20} className="text-violet-600" />Ratios &amp; Indicateurs Financiers
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      {
                        label: "Taux de recouvrement",
                        sub:   "Cotisations payées / total",
                        value: `${ed.ratios.tauxRecouvrement}%`,
                        color: ed.ratios.tauxRecouvrement >= 70 ? "text-emerald-600" : ed.ratios.tauxRecouvrement >= 40 ? "text-amber-600" : "text-red-600",
                        icon: CheckCircle,
                      },
                      {
                        label: "Utilisation crédits alim.",
                        sub:   "Montant consommé / alloué",
                        value: `${ed.ratios.tauxUtilisationCreditsAlim}%`,
                        color: "text-violet-600",
                        icon: CreditCard,
                      },
                      {
                        label: "Marge nette",
                        sub:   "Résultat / Total produits",
                        value: `${ed.ratios.margeNette}%`,
                        color: ed.ratios.margeNette >= 20 ? "text-emerald-600" : ed.ratios.margeNette >= 0 ? "text-amber-600" : "text-red-600",
                        icon: TrendingUp,
                      },
                      {
                        label: "Ratio charges",
                        sub:   "Charges / Produits",
                        value: `${ed.ratios.ratioCharges}%`,
                        color: ed.ratios.ratioCharges <= 70 ? "text-emerald-600" : ed.ratios.ratioCharges <= 90 ? "text-amber-600" : "text-red-600",
                        icon: AlertCircle,
                      },
                    ].map((r) => {
                      const Icon = r.icon;
                      return (
                        <div key={r.label} className="bg-slate-50 rounded-xl p-5 text-center border border-slate-200">
                          <Icon className={`${r.color} w-6 h-6 mx-auto mb-2`} />
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">{r.label}</p>
                          <p className={`text-3xl font-bold ${r.color}`}>{r.value}</p>
                          <p className="text-xs text-slate-400 mt-1">{r.sub}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-slate-400">Erreur de chargement des états financiers</div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
