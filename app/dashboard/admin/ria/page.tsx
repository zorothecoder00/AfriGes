"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  RefreshCw, Users, Wallet, Activity, TrendingUp, TrendingDown,
  ArrowDownCircle, ArrowUpCircle, AlertTriangle, CheckCircle2,
  Shield, BarChart2, DollarSign, Percent, RotateCw, Target,
  Settings, UserCheck, Star, FileText, Award,
  Layers, Clock, HeartPulse, MapPin, Briefcase, Zap,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatutEntry { count: number; montant?: number; encours?: number }
interface RendementEntry { label: string; totalFinance: number; totalRecouvre: number; nbFins: number; rendement: number }
interface PrevisionEntry { jours: number; montantAttendu: number }
interface ProjectionEntry { jours: number; projection: number }

interface Dashboard {
  // Existants
  nbInvestisseurs: number; nbPortefeuilles: number; nbClientsFinances: number; nbDossiersActifs: number;
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number;
  capitalRecouvre: number; capitalBloque: number;
  beneficesGeneres: number; beneficesDistribues: number; beneficesReinvestis: number; fondSecurite: number;
  montantRecouvreDuJour: number; montantRecouvreDuMois: number; encoursGlobal: number;
  nbCreancesEchues: number; montantCreancesEchues: number;
  tauxRemboursement: number; tauxRotation: number; rendementMoyen: number; rentabiliteGlobale: number;
  repartitionRisque: Record<string, number>;
  depots: Record<string, StatutEntry>; retraits: Record<string, StatutEntry>; financements: Record<string, StatutEntry>;
  // Nouveaux indicateurs stratégiques
  navGlobale: number;
  tauxReinvestissement: number; ratioEngageDisponible: number; ratioEncoursFonds: number;
  nbDefauts: number; montantDefaut: number; tauxDefaut: number; coutRisque: number;
  dso: number; dureeMoyenneRemboursement: number; dureeMoyenneRotation: number;
  tauxFidelisation: number; tauxRenouvellement: number; scoreGlobalSante: number;
  rendementParRegion: RendementEntry[]; rendementParQuartier: RendementEntry[];
  rendementParActivite: RendementEntry[]; rendementParPDV: RendementEntry[]; rendementParAgent: RendementEntry[];
  previsionsTresorerie: PrevisionEntry[]; projectionBenefices: ProjectionEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt  = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(Math.round(n));
const fmtC = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
const pct  = (n: number) => `${n.toFixed(1)} %`;

// ── Composants ────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color = "slate", alert = false }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color?: "emerald"|"blue"|"violet"|"amber"|"rose"|"slate"|"teal"; alert?: boolean;
}) {
  const ring: Record<string, string> = {
    emerald:"bg-emerald-50 text-emerald-600", blue:"bg-blue-50 text-blue-600",
    violet:"bg-violet-50 text-violet-600",   amber:"bg-amber-50 text-amber-600",
    rose:"bg-rose-50 text-rose-600",         slate:"bg-slate-100 text-slate-600",
    teal:"bg-teal-50 text-teal-600",
  };
  return (
    <div className={`bg-white rounded-2xl border p-5 flex items-start gap-4 ${alert ? "border-red-200 bg-red-50/30" : "border-slate-200"}`}>
      <div className={`p-3 rounded-xl flex-shrink-0 ${ring[color]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
        <p className={`text-xl font-bold mt-0.5 truncate ${alert ? "text-red-700" : "text-slate-900"}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function RatioCard({ label, value, icon, color = "blue", sub }: {
  label: string; value: number; icon: React.ReactNode;
  color?: "emerald"|"blue"|"violet"|"amber"; sub?: string;
}) {
  const barColor: Record<string, string>  = { emerald:"bg-emerald-500", blue:"bg-blue-500", violet:"bg-violet-500", amber:"bg-amber-500" };
  const textColor: Record<string, string> = { emerald:"text-emerald-700", blue:"text-blue-700", violet:"text-violet-700", amber:"text-amber-700" };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-slate-400">{icon}</div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${textColor[color]}`}>{pct(value)}</p>
      <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor[color]}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function RisqueBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pctVal = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${color}`}>{label}</span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pctVal}%` }} />
      </div>
      <span className="text-sm font-semibold text-slate-700 w-6 text-right">{count}</span>
      <span className="text-xs text-slate-400 w-10 text-right">{pctVal.toFixed(0)}%</span>
    </div>
  );
}

function HealthScore({ score }: { score: number }) {
  const color = score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  const bg    = score >= 75 ? "bg-emerald-500"  : score >= 50 ? "bg-amber-500"   : "bg-red-500";
  const label = score >= 75 ? "Excellent"        : score >= 60 ? "Bon"            : score >= 40 ? "Moyen" : "Critique";
  const circumference = 2 * Math.PI * 40;
  const dash = circumference - (score / 100) * circumference;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Score de santé global</p>
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="10"
            stroke={score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444"}
            strokeDasharray={circumference}
            strokeDashoffset={dash}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-black ${color}`}>{score}</span>
          <span className="text-xs text-slate-400">/100</span>
        </div>
      </div>
      <span className={`mt-2 text-sm font-bold ${color}`}>{label}</span>
      <div className="mt-3 w-full space-y-1 text-xs text-slate-500">
        <div className="flex justify-between"><span>Recouvrement (30%)</span><span className={`h-1.5 rounded-full ${bg} inline-block`} style={{ width: `${score * 0.3}px` }}></span></div>
      </div>
      <div className={`mt-3 px-3 py-1.5 rounded-lg text-xs font-medium ${score >= 75 ? "bg-emerald-50 text-emerald-700" : score >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
        {score >= 75 ? "Portefeuille sain — Continuer l'expansion" :
         score >= 60 ? "Bonne santé — Surveiller les retards" :
         score >= 40 ? "Attention — Renforcer le recouvrement" :
         "Alerte — Intervention urgente nécessaire"}
      </div>
    </div>
  );
}

function RendementTable({ title, data, icon }: { title: string; data: RendementEntry[]; icon: React.ReactNode }) {
  if (data.length === 0) return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">{icon}<h3 className="font-semibold text-slate-800 text-sm">{title}</h3></div>
      <p className="text-xs text-slate-400 text-center py-4">Aucune donnée disponible</p>
    </div>
  );
  const maxRecouvre = Math.max(...data.map((r) => r.totalRecouvre), 1);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">{icon}<h3 className="font-semibold text-slate-800 text-sm">{title}</h3></div>
      <div className="space-y-2">
        {data.map((r, i) => (
          <div key={r.label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-slate-700 font-medium truncate max-w-[120px]">
                <span className="text-slate-400 mr-1">#{i+1}</span>{r.label}
              </span>
              <span className={`font-bold ${r.rendement >= 80 ? "text-emerald-600" : r.rendement >= 50 ? "text-amber-600" : "text-red-500"}`}>
                {r.rendement.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(r.totalRecouvre / maxRecouvre) * 100}%` }} />
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{fmtC(r.totalRecouvre)} / {fmtC(r.totalFinance)} · {r.nbFins} fin.</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrevisionChart({ previsions, projections, title }: {
  previsions: PrevisionEntry[]; projections: ProjectionEntry[]; title: string;
}) {
  const [mode, setMode] = useState<"tresorerie"|"benefices">("tresorerie");
  const items = mode === "tresorerie"
    ? previsions.map((p) => ({ jours: p.jours, valeur: p.montantAttendu }))
    : projections.map((p) => ({ jours: p.jours, valeur: p.projection }));
  const maxVal = Math.max(...items.map((i) => i.valeur), 1);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-slate-800">{title}</h3>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setMode("tresorerie")}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${mode === "tresorerie" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            Trésorerie
          </button>
          <button onClick={() => setMode("benefices")}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${mode === "benefices" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            Bénéfices
          </button>
        </div>
      </div>
      <div className="flex items-end gap-2 h-24">
        {items.map(({ jours, valeur }) => {
          const h = maxVal > 0 ? (valeur / maxVal) * 88 : 0;
          return (
            <div key={jours} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center" style={{ height: 88 }}>
                <div
                  className={`w-full rounded-t-sm transition-all ${mode === "tresorerie" ? "bg-blue-400" : "bg-emerald-400"}`}
                  style={{ height: `${Math.max(2, h)}px` }}
                />
              </div>
              <span className="text-xs text-slate-500">J+{jours}</span>
              <span className={`text-xs font-medium ${mode === "tresorerie" ? "text-blue-600" : "text-emerald-600"}`}>
                {valeur > 0 ? `${Math.round(valeur / 1_000_000)}M` : "—"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 mt-2">
        {mode === "tresorerie"
          ? "Encours actifs dont l'échéance intervient avant chaque horizon."
          : "Bénéfice estimé sur encours restant selon rendement moyen actuel."}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RIADashboardPage() {
  const { data: res, loading, refetch } = useApi<{ data: Dashboard }>("/api/admin/ria/dashboard");
  const d = res?.data;
  const totalRisque = d ? Object.values(d.repartitionRisque).reduce((s, v) => s + v, 0) : 0;

  return (
    <div className="p-6 space-y-8 max-w-screen-2xl">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">RIA — Réseau des Investisseurs AfriSime</h1>
          <p className="text-sm text-slate-500 mt-0.5">Tableau de bord temps réel</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refetch}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
          <Link href="/dashboard/admin/ria/investisseurs"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
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
          {/* ── Bloc 1 — Vue investisseurs ── */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Investisseurs & portefeuilles</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={<Users className="w-5 h-5" />}      label="Investisseurs"        value={String(d.nbInvestisseurs)}       sub={`${d.nbPortefeuilles} portefeuille(s)`} color="violet" />
              <KpiCard icon={<UserCheck className="w-5 h-5" />}   label="Clients financés"     value={String(d.nbClientsFinances)}     sub="affectations actives" color="blue" />
              <KpiCard icon={<Activity className="w-5 h-5" />}    label="Dossiers actifs"      value={String(d.nbDossiersActifs)}      sub="financements en cours" color="teal" />
              <KpiCard icon={<Wallet className="w-5 h-5" />}      label="Capital total investi" value={`${fmt(d.capitalInvesti)} F`}  color="emerald" />
            </div>
          </section>

          {/* ── Bloc 2 — Flux de capitaux ── */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Flux de capitaux</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={<TrendingUp className="w-5 h-5" />}   label="Capital disponible"  value={`${fmt(d.capitalDisponible)} F`} color="emerald" />
              <KpiCard icon={<BarChart2 className="w-5 h-5" />}    label="Encours global"       value={`${fmt(d.encoursGlobal)} F`}    sub="capital engagé actif" color="blue" />
              <KpiCard icon={<CheckCircle2 className="w-5 h-5" />} label="Capital recouvré"     value={`${fmt(d.capitalRecouvre)} F`}  color="teal" />
              <KpiCard icon={<Shield className="w-5 h-5" />}       label="Capital immobilisé"   value={`${fmt(d.capitalBloque)} F`}    sub="bloqué / litige" color={d.capitalBloque > 0 ? "rose" : "slate"} alert={d.capitalBloque > 0} />
            </div>
          </section>

          {/* ── Bloc 3 — Recouvrement temps réel ── */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Recouvrement temps réel</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={<ArrowDownCircle className="w-5 h-5" />} label="Recouvré aujourd'hui" value={`${fmt(d.montantRecouvreDuJour)} F`} color="emerald" />
              <KpiCard icon={<TrendingUp className="w-5 h-5" />}       label="Recouvré ce mois"     value={`${fmt(d.montantRecouvreDuMois)} F`} color="blue" />
              <KpiCard icon={<AlertTriangle className="w-5 h-5" />}    label="Créances échues"      value={String(d.nbCreancesEchues)} sub={`${fmt(d.montantCreancesEchues)} F`} color={d.nbCreancesEchues > 0 ? "rose" : "slate"} alert={d.nbCreancesEchues > 0} />
              <KpiCard icon={<TrendingDown className="w-5 h-5" />}     label="Taux de rotation"     value={pct(d.tauxRotation)} sub="financé / capital investi" color="amber" />
            </div>
          </section>

          {/* ── Bloc 4 — Performance & ratios ── */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Performance & rentabilité</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <RatioCard label="Taux de remboursement" value={d.tauxRemboursement} icon={<Percent className="w-4 h-4" />} color="emerald" />
              <RatioCard label="Rendement moyen"        value={d.rendementMoyen}   icon={<TrendingUp className="w-4 h-4" />} color="blue" />
              <RatioCard label="Rentabilité globale"    value={d.rentabiliteGlobale} icon={<Target className="w-4 h-4" />} color="violet" />
              <RatioCard label="Taux de rotation"       value={d.tauxRotation}     icon={<RotateCw className="w-4 h-4" />} color="amber" />
            </div>
          </section>

          {/* ── Bloc 5 — Bénéfices ── */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Bénéfices & répartition</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={<DollarSign className="w-5 h-5" />}    label="Bénéfices générés"    value={`${fmt(d.beneficesGeneres)} F`}     color="amber" />
              <KpiCard icon={<ArrowUpCircle className="w-5 h-5" />} label="Bénéfices distribués" value={`${fmt(d.beneficesDistribues)} F`}  color="emerald" />
              <KpiCard icon={<TrendingUp className="w-5 h-5" />}    label="Bénéfices réinvestis"  value={`${fmt(d.beneficesReinvestis)} F`}  color="blue" />
              <KpiCard icon={<Shield className="w-5 h-5" />}        label="Fonds de sécurité"     value={`${fmt(d.fondSecurite)} F`}         color="violet" />
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════
              ── INDICATEURS STRATÉGIQUES ──
          ══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Indicateurs Stratégiques
            </h2>

            {/* Score de santé + NAV + métriques financières */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
              <HealthScore score={d.scoreGlobalSante} />

              <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
                <KpiCard icon={<Layers className="w-5 h-5" />}     label="NAV — Valeur nette active" value={`${fmt(d.navGlobale)} F`} sub="disponible + engagé + réinvesti + sécurité" color="emerald" />
                <KpiCard icon={<Percent className="w-5 h-5" />}    label="Taux de réinvestissement"  value={pct(d.tauxReinvestissement)} sub="bénéfices réinvestis / générés" color="blue" />
                <KpiCard icon={<Shield className="w-5 h-5" />}     label="Coût du risque"            value={pct(d.coutRisque)} sub="défauts + retards >30j / total financé" color={d.coutRisque > 10 ? "rose" : "amber"} alert={d.coutRisque > 10} />
                <KpiCard icon={<AlertTriangle className="w-5 h-5" />} label="Taux de défaut"         value={pct(d.tauxDefaut)} sub={`${d.nbDefauts} dossier(s) · ${fmt(d.montantDefaut)} F`} color={d.tauxDefaut > 5 ? "rose" : "slate"} alert={d.tauxDefaut > 5} />
                <KpiCard icon={<Clock className="w-5 h-5" />}      label="DSO (Jours d'encours)"     value={`${d.dso} j`} sub="jours moyens de recouvrement estimés" color="violet" />
                <KpiCard icon={<RotateCw className="w-5 h-5" />}   label="Durée moy. rotation capital" value={`${d.dureeMoyenneRotation} j`} sub="cycle moyen de retour sur capital" color="teal" />
              </div>
            </div>

            {/* Ratios & métriques clients */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <RatioCard label="Ratio Engagé / Disponible"       value={d.ratioEngageDisponible}  icon={<BarChart2 className="w-4 h-4" />} color="blue"   sub="Plus élevé = capital actif" />
              <RatioCard label="Ratio Encours / Fonds investis"  value={d.ratioEncoursFonds}      icon={<Layers className="w-4 h-4" />}   color="violet" sub="Exposition au risque" />
              <RatioCard label="Taux de fidélisation clients"    value={d.tauxFidelisation}       icon={<UserCheck className="w-4 h-4" />} color="emerald" sub="Clients avec ≥2 financements" />
              <RatioCard label="Durée moy. remboursement"        value={Math.min(100, d.dureeMoyenneRemboursement / 3.65)} icon={<Clock className="w-4 h-4" />} color="amber" sub={`${d.dureeMoyenneRemboursement} jours en moyenne`} />
            </div>

            {/* Rendements segmentés — 5 vues */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
              <RendementTable title="Par Région / Ville"    data={d.rendementParRegion}   icon={<MapPin className="w-4 h-4 text-blue-500" />} />
              <RendementTable title="Par Quartier"          data={d.rendementParQuartier} icon={<MapPin className="w-4 h-4 text-teal-500" />} />
              <RendementTable title="Par Secteur d'activité" data={d.rendementParActivite} icon={<Briefcase className="w-4 h-4 text-violet-500" />} />
              <RendementTable title="Par Agence / PDV"      data={d.rendementParPDV}      icon={<Star className="w-4 h-4 text-amber-500" />} />
              <RendementTable title="Par Agent Terrain"     data={d.rendementParAgent}    icon={<UserCheck className="w-4 h-4 text-emerald-500" />} />
            </div>

            {/* Prévisions & projections */}
            <PrevisionChart
              previsions={d.previsionsTresorerie}
              projections={d.projectionBenefices}
              title="Prévisions trésorerie & projection bénéfices"
            />
          </section>

          {/* ── Bloc 6 — Risque global + Tableaux ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-slate-500" />
                <h3 className="font-semibold text-slate-800">Risque global</h3>
                <span className="ml-auto text-xs text-slate-400">{totalRisque} affectation(s)</span>
              </div>
              <div className="space-y-3">
                {[{ label:"A", color:"bg-emerald-500" },{ label:"B", color:"bg-blue-500" },{ label:"C", color:"bg-amber-500" },{ label:"D", color:"bg-orange-500" },{ label:"E", color:"bg-red-600" }].map(({ label, color }) => (
                  <RisqueBar key={label} label={label} count={d.repartitionRisque[label] ?? 0} total={totalRisque} color={color} />
                ))}
              </div>
              {totalRisque === 0 && <p className="text-sm text-slate-400 text-center mt-3">Aucune affectation active</p>}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-emerald-600" /> Dépôts
                </h3>
                <Link href="/dashboard/admin/ria/fonds" className="text-xs text-emerald-600 hover:underline">Voir tout</Link>
              </div>
              {["EN_ATTENTE", "VALIDE", "REJETE"].map((s) => (
                <div key={s} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-600">{s.replace(/_/g, " ")}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-slate-900">{d.depots[s]?.count ?? 0}</span>
                    {d.depots[s]?.montant != null && <span className="text-xs text-slate-400 ml-2">{fmt(d.depots[s].montant!)} F</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" /> Financements
                </h3>
                <Link href="/dashboard/admin/ria/financements" className="text-xs text-emerald-600 hover:underline">Voir tout</Link>
              </div>
              {["ACTIF", "REMBOURSE", "EN_RETARD", "DEFAUT"].map((s) => (
                <div key={s} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className={`text-sm ${s === "EN_RETARD" ? "text-orange-600 font-medium" : s === "DEFAUT" ? "text-red-600 font-medium" : "text-slate-600"}`}>
                    {s.replace(/_/g, " ")}
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-slate-900">{d.financements[s]?.count ?? 0}</span>
                    {d.financements[s]?.encours != null && <span className="text-xs text-slate-400 ml-2">{fmt(d.financements[s].encours!)} F</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Navigation rapide ── */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Navigation rapide</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { href:"/dashboard/admin/ria/investisseurs", label:"Investisseurs",  icon:Users,        color:"text-violet-600 bg-violet-50" },
                { href:"/dashboard/admin/ria/fonds",         label:"Fonds",          icon:Wallet,       color:"text-emerald-600 bg-emerald-50" },
                { href:"/dashboard/admin/ria/financements",  label:"Financements",   icon:Activity,     color:"text-blue-600 bg-blue-50" },
                { href:"/dashboard/admin/ria/recouvrement",  label:"Recouvrement",   icon:TrendingDown, color:"text-orange-600 bg-orange-50" },
                { href:"/dashboard/admin/ria/scoring",       label:"Scoring",        icon:Star,         color:"text-amber-600 bg-amber-50" },
                { href:"/dashboard/admin/ria/benefices",     label:"Bénéfices",      icon:DollarSign,   color:"text-teal-600 bg-teal-50" },
                { href:"/dashboard/admin/ria/reporting",     label:"Reporting",      icon:FileText,     color:"text-slate-600 bg-slate-100" },
                { href:"/dashboard/admin/ria/commissions",   label:"Commissions",    icon:Award,        color:"text-pink-600 bg-pink-50" },
                { href:"/dashboard/admin/ria/distributions", label:"Distributions",  icon:ArrowUpCircle,color:"text-indigo-600 bg-indigo-50" },
                { href:"/dashboard/admin/ria/affectations",  label:"Affectations",   icon:UserCheck,    color:"text-cyan-600 bg-cyan-50" },
                { href:"/dashboard/admin/ria/bi",            label:"BI",             icon:BarChart2,    color:"text-purple-600 bg-purple-50" },
                { href:"/dashboard/admin/ria/config",        label:"Config",         icon:Settings,     color:"text-slate-500 bg-slate-100" },
              ].map((nav) => {
                const Icon = nav.icon;
                return (
                  <Link key={nav.href} href={nav.href}
                    className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col items-center gap-2 text-center">
                    <div className={`p-2 rounded-lg ${nav.color}`}><Icon className="w-4 h-4" /></div>
                    <span className="text-xs font-medium text-slate-700">{nav.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
