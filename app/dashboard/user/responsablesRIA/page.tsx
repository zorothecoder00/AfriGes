"use client";

import { useApi } from "@/hooks/useApi";
import {
  RefreshCw, Users, Wallet, Activity, TrendingUp, TrendingDown,
  ArrowDownCircle, ArrowUpCircle, AlertTriangle, CheckCircle2,
  Shield, BarChart2, DollarSign, Percent, RotateCw, Target,
  Settings, UserCheck, Star, FileText, Award, Network,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatutEntry { count: number; montant?: number; encours?: number }

interface Dashboard {
  nbInvestisseurs: number;
  nbPortefeuilles: number;
  nbClientsFinances: number;
  nbDossiersActifs: number;
  capitalInvesti: number;
  capitalDisponible: number;
  capitalEngage: number;
  capitalRecouvre: number;
  capitalBloque: number;
  beneficesGeneres: number;
  beneficesDistribues: number;
  beneficesReinvestis: number;
  fondSecurite: number;
  montantRecouvreDuJour: number;
  montantRecouvreDuMois: number;
  encoursGlobal: number;
  nbCreancesEchues: number;
  montantCreancesEchues: number;
  tauxRemboursement: number;
  tauxRotation: number;
  rendementMoyen: number;
  rentabiliteGlobale: number;
  repartitionRisque: Record<string, number>;
  depots: Record<string, StatutEntry>;
  retraits: Record<string, StatutEntry>;
  financements: Record<string, StatutEntry>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(Math.round(n));
const pct = (n: number) => `${n.toFixed(1)} %`;

// ── Composants ────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, color = "slate", alert = false,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color?: "emerald" | "blue" | "violet" | "amber" | "rose" | "slate" | "teal";
  alert?: boolean;
}) {
  const ring: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600", blue: "bg-blue-50 text-blue-600",
    violet:  "bg-violet-50 text-violet-600",   amber: "bg-amber-50 text-amber-600",
    rose:    "bg-rose-50 text-rose-600",       slate: "bg-slate-100 text-slate-600",
    teal:    "bg-teal-50 text-teal-600",
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

function RatioCard({ label, value, icon, color = "blue" }: {
  label: string; value: number; icon: React.ReactNode;
  color?: "emerald" | "blue" | "violet" | "amber";
}) {
  const barColor: Record<string, string> = {
    emerald: "bg-emerald-500", blue: "bg-blue-500",
    violet:  "bg-violet-500",  amber: "bg-amber-500",
  };
  const textColor: Record<string, string> = {
    emerald: "text-emerald-700", blue: "text-blue-700",
    violet:  "text-violet-700",  amber: "text-amber-700",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-slate-400">{icon}</div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${textColor[color]}`}>{pct(value)}</p>
      <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor[color]}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function RisqueBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pctVal = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${color}`}>
        {label}
      </span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pctVal}%` }} />
      </div>
      <span className="text-sm font-semibold text-slate-700 w-6 text-right">{count}</span>
      <span className="text-xs text-slate-400 w-10 text-right">{pctVal.toFixed(0)}%</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResponsableRIAPage() {
  const { data: res, loading, refetch } = useApi<{ data: Dashboard }>("/api/admin/ria/dashboard");
  const d = res?.data;

  const totalRisque = d ? Object.values(d.repartitionRisque).reduce((s, v) => s + v, 0) : 0;

  return (
    <div className="p-6 space-y-8 max-w-screen-2xl">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl">
            <Network className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tableau de bord RIA</h1>
            <p className="text-sm text-slate-500">Réseau des Investisseurs AfriSime — Vue temps réel</p>
          </div>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {loading && !d && (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      )}

      {d && (
        <>
          {/* Bloc 1 — Vue d'ensemble */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Vue d&apos;ensemble</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={<Users className="w-5 h-5" />}       label="Investisseurs"      value={String(d.nbInvestisseurs)}   sub={`${d.nbPortefeuilles} portefeuille(s)`} color="violet" />
              <KpiCard icon={<UserCheck className="w-5 h-5" />}   label="Clients financés"   value={String(d.nbClientsFinances)} sub="affectations actives"  color="blue" />
              <KpiCard icon={<Activity className="w-5 h-5" />}    label="Dossiers actifs"    value={String(d.nbDossiersActifs)}  sub="financements en cours" color="teal" />
              <KpiCard icon={<Wallet className="w-5 h-5" />}      label="Capital investi"    value={`${fmt(d.capitalInvesti)} F`} color="emerald" />
            </div>
          </section>

          {/* Bloc 2 — Capitaux */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Flux de capitaux</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={<TrendingUp className="w-5 h-5" />}  label="Capital disponible"  value={`${fmt(d.capitalDisponible)} F`}  color="emerald" />
              <KpiCard icon={<BarChart2 className="w-5 h-5" />}   label="Encours global"       value={`${fmt(d.encoursGlobal)} F`}      sub="capital engagé actif" color="blue" />
              <KpiCard icon={<CheckCircle2 className="w-5 h-5" />}label="Capital recouvré"     value={`${fmt(d.capitalRecouvre)} F`}    color="teal" />
              <KpiCard icon={<Shield className="w-5 h-5" />}      label="Capital immobilisé"   value={`${fmt(d.capitalBloque)} F`}      sub="bloqué / litige" color={d.capitalBloque > 0 ? "rose" : "slate"} alert={d.capitalBloque > 0} />
            </div>
          </section>

          {/* Bloc 3 — Recouvrement */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Recouvrement temps réel</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={<ArrowDownCircle className="w-5 h-5" />} label="Recouvré aujourd'hui" value={`${fmt(d.montantRecouvreDuJour)} F`} color="emerald" />
              <KpiCard icon={<TrendingUp className="w-5 h-5" />}      label="Recouvré ce mois"     value={`${fmt(d.montantRecouvreDuMois)} F`} color="blue" />
              <KpiCard icon={<AlertTriangle className="w-5 h-5" />}   label="Créances échues"       value={String(d.nbCreancesEchues)} sub={`${fmt(d.montantCreancesEchues)} F en retard`} color={d.nbCreancesEchues > 0 ? "rose" : "slate"} alert={d.nbCreancesEchues > 0} />
              <KpiCard icon={<TrendingDown className="w-5 h-5" />}    label="Taux de rotation"      value={pct(d.tauxRotation)} sub="financé / capital investi" color="amber" />
            </div>
          </section>

          {/* Bloc 4 — Performance */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Performance & rentabilité</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <RatioCard label="Taux de remboursement" value={d.tauxRemboursement}  icon={<Percent className="w-4 h-4" />}   color="emerald" />
              <RatioCard label="Rendement moyen"        value={d.rendementMoyen}     icon={<TrendingUp className="w-4 h-4" />} color="blue" />
              <RatioCard label="Rentabilité globale"    value={d.rentabiliteGlobale}  icon={<Target className="w-4 h-4" />}    color="violet" />
              <RatioCard label="Taux de rotation"       value={d.tauxRotation}        icon={<RotateCw className="w-4 h-4" />}  color="amber" />
            </div>
          </section>

          {/* Bloc 5 — Bénéfices */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Bénéfices & répartition</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={<DollarSign className="w-5 h-5" />}   label="Bénéfices générés"    value={`${fmt(d.beneficesGeneres)} F`}    color="amber" />
              <KpiCard icon={<ArrowUpCircle className="w-5 h-5" />}label="Bénéfices distribués"  value={`${fmt(d.beneficesDistribues)} F`} color="emerald" />
              <KpiCard icon={<TrendingUp className="w-5 h-5" />}   label="Bénéfices réinvestis"  value={`${fmt(d.beneficesReinvestis)} F`} color="blue" />
              <KpiCard icon={<Shield className="w-5 h-5" />}       label="Fonds de sécurité"     value={`${fmt(d.fondSecurite)} F`}        color="violet" />
            </div>
          </section>

          {/* Bloc 6 — Risque + Opérationnel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Répartition risque */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-slate-500" />
                <h3 className="font-semibold text-slate-800">Risque global</h3>
                <span className="ml-auto text-xs text-slate-400">{totalRisque} affectation(s)</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "A", color: "bg-emerald-500" },
                  { label: "B", color: "bg-blue-500" },
                  { label: "C", color: "bg-amber-500" },
                  { label: "D", color: "bg-orange-500" },
                  { label: "E", color: "bg-red-600" },
                ].map(({ label, color }) => (
                  <RisqueBar key={label} label={label} count={d.repartitionRisque[label] ?? 0} total={totalRisque} color={color} />
                ))}
              </div>
            </div>

            {/* Dépôts en attente */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-emerald-600" /> Dépôts
                </h3>
                <Link href="/dashboard/admin/ria/fonds" className="text-xs text-emerald-600 hover:underline">Gérer</Link>
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

            {/* Financements */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" /> Financements
                </h3>
                <Link href="/dashboard/admin/ria/recouvrement" className="text-xs text-emerald-600 hover:underline">Recouvrement</Link>
              </div>
              {["ACTIF", "REMBOURSE", "EN_RETARD", "DEFAUT"].map((s) => (
                <div key={s} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className={`text-sm ${s === "EN_RETARD" ? "text-orange-600 font-medium" : s === "DEFAUT" ? "text-red-600 font-medium" : "text-slate-600"}`}>
                    {s.replace("_", " ")}
                  </span>
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

          {/* Navigation rapide vers les sections RIA */}
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Accès rapide</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { href: "/dashboard/user/responsablesRIA/investisseurs",  label: "Investisseurs",  icon: Users,         color: "text-violet-600 bg-violet-50" },
                { href: "/dashboard/user/responsablesRIA/fonds",          label: "Fonds",          icon: Wallet,        color: "text-emerald-600 bg-emerald-50" },
                { href: "/dashboard/user/responsablesRIA/financements",   label: "Financements",   icon: Activity,      color: "text-blue-600 bg-blue-50" },
                { href: "/dashboard/user/responsablesRIA/recouvrement",   label: "Recouvrement",   icon: TrendingDown,  color: "text-orange-600 bg-orange-50" },
                { href: "/dashboard/user/responsablesRIA/scoring",        label: "Scoring",        icon: Star,          color: "text-amber-600 bg-amber-50" },
                { href: "/dashboard/user/responsablesRIA/benefices",      label: "Bénéfices",      icon: DollarSign,    color: "text-teal-600 bg-teal-50" },
                { href: "/dashboard/user/responsablesRIA/reporting",      label: "Reporting",      icon: FileText,      color: "text-slate-600 bg-slate-100" },
                { href: "/dashboard/user/responsablesRIA/commissions",    label: "Commissions",    icon: Award,         color: "text-pink-600 bg-pink-50" },
                { href: "/dashboard/user/responsablesRIA/distributions",  label: "Distributions",  icon: ArrowUpCircle, color: "text-indigo-600 bg-indigo-50" },
                { href: "/dashboard/user/responsablesRIA/affectations",   label: "Affectations",   icon: UserCheck,     color: "text-cyan-600 bg-cyan-50" },
                { href: "/dashboard/user/responsablesRIA/bi",             label: "BI",             icon: BarChart2,     color: "text-purple-600 bg-purple-50" },
                { href: "/dashboard/user/responsablesRIA/config",         label: "Config",         icon: Settings,      color: "text-slate-500 bg-slate-100" },
              ].map((nav) => {
                const Icon = nav.icon;
                return (
                  <Link
                    key={nav.href}
                    href={nav.href}
                    className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col items-center gap-2 text-center"
                  >
                    <div className={`p-2 rounded-lg ${nav.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
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
