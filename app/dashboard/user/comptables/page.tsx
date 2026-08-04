"use client";

// Tableau de bord comptable (rubrique 1/13 du CDC Comptabilité) — anciennement
// l'onglet "synthese" du monolithe app/dashboard/user/comptables/page.tsx
// (5435 lignes), désormais réduit à cette seule page ; les 12 autres rubriques
// vivent dans leurs propres sous-routes (voir app/dashboard/user/comptables/layout.tsx
// pour la sidebar et le mapping clé d'accès → route).

import React, { useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw,
  CheckCircle, AlertCircle, Package, Users, BookOpen,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { getStatCardHue } from "@/components/ui/statCardTheme";
import { useT } from "@/contexts/AppSettingsContext";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

// ── Types ──────────────────────────────────────────────────────────────────

interface EvolutionPoint { date: string; encaissements: number; decaissements: number; }

interface SyntheseResponse {
  success: boolean;
  data: {
    periode: { debut: string; fin: string; jours: number };
    encaissements: {
      versements_packs:     { montant: number; count: number };
      cotisations_init:     { montant: number; count: number };
      versements_peri:      { montant: number; count: number };
      remboursements:       { montant: number; count: number };
      autres:               { montant: number; count: number };
      caisse_encaissements: { montant: number; count: number };
      ventes_directes:      { montant: number; count: number };
      total: number;
    };
    decaissements: {
      approvisionnements: { montant: number; count: number };
      salaires:           { montant: number; count: number };
      avances:            { montant: number; count: number };
      fournisseurs:       { montant: number; count: number };
      autres_caisse:      { montant: number; count: number };
      total: number;
    };
    resultat_net: number;
    taux_utilisation: number;
    evolution: EvolutionPoint[];
    snapshot: {
      stock:                { valeur: number; nombreProduits: number };
      souscriptionsActives: number;
      packs:                number;
      versementsTotal:      number;
    };
  };
}

type Period = "7" | "30" | "90" | "365";

// ── Helpers chart SVG ─────────────────────────────────────────────────────

const VB_W = 1000;
const VB_H = 180;

function buildLine(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${(p.x * VB_W).toFixed(1)} ${(p.y * VB_H).toFixed(1)}`).join(" ");
}

function buildArea(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  const line  = buildLine(pts);
  const last  = pts[pts.length - 1];
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
  const h = getStatCardHue(color, bg);
  return (
    <div className={`group relative overflow-hidden bg-gradient-to-br ${h.wrap} to-white rounded-2xl p-5 shadow-sm border transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${h.bar}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`${bg} p-2.5 rounded-xl group-hover:scale-110 transition-transform duration-300 ease-out`}>
          <Icon className={`${color} w-5 h-5`} />
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend === "up" ? "bg-emerald-100 text-emerald-600" : trend === "down" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"
          }`}>
            {trend === "up" ? <ArrowUpRight className="inline w-3 h-3" /> : trend === "down" ? <ArrowDownRight className="inline w-3 h-3" /> : "—"}
          </span>
        )}
      </div>
      <p className={`text-xs font-semibold mb-1 ${h.labelText}`}>{label}</p>
      <p className={`text-2xl font-bold leading-tight transition-transform duration-300 group-hover:scale-105 origin-left ${h.text}`}>{value}</p>
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

// ── Page ───────────────────────────────────────────────────────────────────

export default function ComptableTableauBordPage() {
  const t = useT();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("30");

  const { data: synthData, loading: synthLoading, refetch: refetchSynth } =
    useApi<SyntheseResponse>(`/api/comptable/synthese?period=${selectedPeriod}`);

  const sd = synthData?.data;
  const enc = sd?.encaissements;
  const dec = sd?.decaissements;
  const snap = sd?.snapshot;

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
    [0, 0.25, 0.5, 0.75, 1].map((f) => ({ val: yMax * f, yPct: 100 - f * 100 })),
    [yMax]
  );

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

  return (
    <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Tableau de bord — Comptabilité Générale</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Période : {sd ? formatDateShort(sd.periode.debut) : "…"} → {sd ? formatDateShort(sd.periode.fin) : "…"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            {(["7", "30", "90", "365"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedPeriod === p ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {p === "365" ? "1 an" : `${p}j`}
              </button>
            ))}
          </div>
          <button onClick={refetchSynth} className="p-2 bg-white border border-slate-200 shadow-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw size={18} />
          </button>
          {AIDE_COMPTABLE["synthese"] && <AideComptable contenu={AIDE_COMPTABLE["synthese"]} />}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Encaissements"
          value={enc ? formatCurrency(enc.total) : "…"}
          sub={`${enc?.versements_packs.count ?? 0} versements packs collectés`}
          icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" trend="up"
        />
        <KpiCard
          label="Total Décaissements"
          value={dec ? formatCurrency(dec.total) : "…"}
          sub={`Approvisionnements : ${dec?.approvisionnements.count ?? 0} entrées`}
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
          sub={`${snap?.stock.nombreProduits ?? 0} produits — ${snap?.souscriptionsActives ?? 0} souscriptions actives`}
          icon={Package} color="text-blue-600" bg="bg-blue-50"
        />
      </div>

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
                {t('text_no_result')}
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
            <p className="text-xs text-slate-400 mb-2">Versements packs collectés</p>
            <p className="text-2xl font-bold text-emerald-600 mb-5">{formatCurrency(enc?.total ?? 0)}</p>
            <div className="space-y-1 divide-y divide-slate-100">
              <BarBreakdown label={`Acomptes initiaux (${enc?.cotisations_init.count ?? 0})`}     montant={enc?.cotisations_init.montant ?? 0}  total={enc?.total ?? 1} color="bg-blue-500" />
              <BarBreakdown label={`Versements périodiques (${enc?.versements_peri.count ?? 0})`} montant={enc?.versements_peri.montant ?? 0}   total={enc?.total ?? 1} color="bg-emerald-500" />
              <BarBreakdown label={`Remboursements (${enc?.remboursements.count ?? 0})`}           montant={enc?.remboursements.montant ?? 0}    total={enc?.total ?? 1} color="bg-teal-500" />
              <BarBreakdown label={`Ventes directes (${enc?.ventes_directes.count ?? 0})`}        montant={enc?.ventes_directes.montant ?? 0}   total={enc?.total ?? 1} color="bg-indigo-500" />
              <BarBreakdown label={`Bonus / Ajust. (${enc?.autres.count ?? 0})`}                  montant={enc?.autres.montant ?? 0}            total={enc?.total ?? 1} color="bg-violet-500" />
            </div>
          </div>

          {/* Activité Packs */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <h3 className="font-bold text-slate-800">Activité Packs</h3>
            </div>
            <p className="text-xs text-slate-400 mb-2">Versements collectés sur la période</p>
            <p className="text-2xl font-bold text-blue-600 mb-5">{enc?.versements_packs.count ?? 0} versements</p>
            <div className="space-y-0 divide-y divide-slate-100">
              {[
                { label: "Acomptes initiaux",   count: enc?.cotisations_init.count ?? 0,  montant: enc?.cotisations_init.montant ?? 0 },
                { label: "Versements pério.",    count: enc?.versements_peri.count ?? 0,   montant: enc?.versements_peri.montant ?? 0 },
                { label: "Remboursements",       count: enc?.remboursements.count ?? 0,    montant: enc?.remboursements.montant ?? 0 },
                { label: "Ventes directes",      count: enc?.ventes_directes.count ?? 0,   montant: enc?.ventes_directes.montant ?? 0 },
                { label: "Bonus / Ajustements",  count: enc?.autres.count ?? 0,            montant: enc?.autres.montant ?? 0 },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-3">
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(item.montant)}</p>
                    <p className="text-xs text-slate-400">{item.count} opé.</p>
                  </div>
                </div>
              ))}
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
              <BarBreakdown
                label={`Approvisionnements (${dec?.approvisionnements.count ?? 0})`}
                montant={dec?.approvisionnements.montant ?? 0}
                total={dec?.total ?? 1}
                color="bg-orange-500"
              />
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
            { label: "Souscriptions actives", value: snap?.souscriptionsActives ?? 0, icon: Users,       color: "text-blue-600",    bg: "bg-blue-50" },
            { label: "Packs disponibles",     value: snap?.packs ?? 0,               icon: BookOpen,    color: "text-violet-600",  bg: "bg-violet-50" },
            { label: "Versements collectés",  value: snap?.versementsTotal ?? 0,     icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Produits en stock",     value: snap?.stock.nombreProduits ?? 0, icon: Package,    color: "text-slate-600",   bg: "bg-slate-100" },
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
    </main>
  );
}
