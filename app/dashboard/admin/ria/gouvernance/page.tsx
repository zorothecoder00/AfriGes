"use client";

import { useApi } from "@/hooks/useApi";
import Link from "next/link";
import {
  Users, Calendar, CheckSquare, ListChecks, FileText, AlertTriangle,
  Brain, TrendingUp, Clock, ArrowRight, Shield, BarChart3,
  Gavel, LayoutGrid, Activity,
} from "lucide-react";

interface CommissionStat {
  type: string; label: string;
  membresActifs: number; prochainReunion: string | null;
  reunionsStats: { total: number; tenues: number };
  resolutionsStats: { total: number; adoptees: number; executees: number };
  plansStats: { total: number; enRetard: number };
}

interface DashboardGouvData {
  membresParCommission: CommissionStat[];
  reunionsStats: { total: number; planifiees: number; tenues: number; annulees: number };
  resolutionsStats: { total: number; adoptees: number; executees: number; enAttente: number };
  plansStats: { total: number; enRetard: number; termines: number };
  dossiersStats: { total: number; enCours: number; enAttente: number };
  anomaliesStats: { total: number; actives: number; critique: number };
  rapportsStats: { total: number; valides: number };
  prochainReunion: { id: number; titre: string; dateHeure: string; typeCommission: string } | null;
  tempsMoyenTraitementJours: number;
}

const COMMISSION_COLORS: Record<string, string> = {
  FINANCE:            "from-blue-500 to-blue-700",
  OPERATIONS_TERRAIN: "from-emerald-500 to-emerald-700",
  AUDIT_CONTROLE:     "from-amber-500 to-amber-700",
  OPTIMISATION:       "from-violet-500 to-violet-700",
};
const COMMISSION_LABELS: Record<string, string> = {
  FINANCE:            "Commission Finance",
  OPERATIONS_TERRAIN: "Commission Opérations",
  AUDIT_CONTROLE:     "Commission Audit & Contrôle",
  OPTIMISATION:       "Commission Optimisation",
};

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function GouvernanceDashboardPage() {
  const { data, loading } = useApi<DashboardGouvData>(
    "/api/admin/ria/commissions/gouvernance/dashboard"
  );

  const d = data;

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600" />
            Gouvernance RIA — Tableau de Bord Général
          </h1>
          <p className="text-sm text-slate-500 mt-1">Vue consolidée de toutes les commissions de gouvernance</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/admin/ria/gouvernance/intelligence"
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors">
            <Brain className="w-4 h-4" /> Intelligence
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {d && (
        <>
          {/* KPIs globaux */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Réunions" value={d.reunionsStats.total}
              sub={`${d.reunionsStats.tenues} tenues • ${d.reunionsStats.planifiees} planifiées`}
              color="bg-blue-50 text-blue-600" icon={<Calendar className="w-5 h-5" />} />
            <StatCard label="Résolutions" value={d.resolutionsStats.total}
              sub={`${d.resolutionsStats.adoptees} adoptées • ${d.resolutionsStats.executees} exécutées`}
              color="bg-emerald-50 text-emerald-600" icon={<Gavel className="w-5 h-5" />} />
            <StatCard label="Plans d'action" value={d.plansStats.total}
              sub={`${d.plansStats.enRetard} en retard • ${d.plansStats.termines} terminés`}
              color={d.plansStats.enRetard > 0 ? "bg-rose-50 text-rose-600" : "bg-teal-50 text-teal-600"}
              icon={<ListChecks className="w-5 h-5" />} />
            <StatCard label="Anomalies actives" value={d.anomaliesStats.actives}
              sub={`${d.anomaliesStats.critique} critiques • ${d.anomaliesStats.total} total`}
              color={d.anomaliesStats.critique > 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}
              icon={<AlertTriangle className="w-5 h-5" />} />
          </div>

          {/* Seconde ligne KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Dossiers inter-comm." value={d.dossiersStats.total}
              sub={`${d.dossiersStats.enCours} en cours • ${d.dossiersStats.enAttente} en attente`}
              color="bg-violet-50 text-violet-600" icon={<FileText className="w-5 h-5" />} />
            <StatCard label="Rapports validés" value={d.rapportsStats.valides}
              sub={`${d.rapportsStats.total} rapports au total`}
              color="bg-slate-100 text-slate-600" icon={<BarChart3 className="w-5 h-5" />} />
            <StatCard label="Tps. moy. traitement" value={`${d.tempsMoyenTraitementJours}j`}
              sub="dossiers inter-commissions"
              color="bg-amber-50 text-amber-600" icon={<Clock className="w-5 h-5" />} />
            {d.prochainReunion ? (
              <div className="bg-white rounded-xl border border-emerald-200 p-5 flex flex-col gap-2">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" /> Prochaine réunion
                </p>
                <p className="text-sm font-semibold text-slate-800 line-clamp-2">{d.prochainReunion.titre}</p>
                <p className="text-xs text-emerald-600 font-medium">
                  {new Date(d.prochainReunion.dateHeure).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-xs text-slate-400">{COMMISSION_LABELS[d.prochainReunion.typeCommission] || d.prochainReunion.typeCommission}</p>
              </div>
            ) : (
              <StatCard label="Prochaine réunion" value="Aucune" sub="planifiée"
                color="bg-slate-100 text-slate-400" icon={<Calendar className="w-5 h-5" />} />
            )}
          </div>

          {/* Commissions cards */}
          <div>
            <h2 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" /> Commissions de Gouvernance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {d.membresParCommission.map((c) => (
                <Link
                  key={c.type}
                  href={`/dashboard/admin/ria/gouvernance/commissions/${c.type.toLowerCase()}`}
                  className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all"
                >
                  <div className={`h-1.5 w-full bg-gradient-to-r ${COMMISSION_COLORS[c.type] || "from-slate-400 to-slate-600"}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-800">{COMMISSION_LABELS[c.type] || c.type}</h3>
                        {c.prochainReunion && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Prochaine: {new Date(c.prochainReunion).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-lg font-bold">{c.membresActifs}</span>
                        </div>
                        <p className="text-xs text-slate-400">Membres</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-emerald-600 mb-1">
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span className="text-lg font-bold">{c.resolutionsStats.total}</span>
                        </div>
                        <p className="text-xs text-slate-400">Résolutions</p>
                      </div>
                      <div className="text-center">
                        <div className={`flex items-center justify-center gap-1 mb-1 ${c.plansStats.enRetard > 0 ? "text-rose-500" : "text-teal-600"}`}>
                          <ListChecks className="w-3.5 h-3.5" />
                          <span className="text-lg font-bold">{c.plansStats.enRetard}</span>
                        </div>
                        <p className="text-xs text-slate-400">En retard</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-400">
                      <span>{c.reunionsStats.tenues}/{c.reunionsStats.total} réunions tenues</span>
                      <span>{c.resolutionsStats.executees} résolutions exécutées</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Liens rapides vers modules */}
          <div>
            <h2 className="text-base font-semibold text-slate-700 mb-4">Modules de gouvernance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { href: "/dashboard/admin/ria/gouvernance/reunions",     icon: Calendar,     label: "Réunions",         color: "text-blue-600 bg-blue-50" },
                { href: "/dashboard/admin/ria/gouvernance/resolutions",  icon: Gavel,        label: "Résolutions",      color: "text-emerald-600 bg-emerald-50" },
                { href: "/dashboard/admin/ria/gouvernance/plans-actions",icon: ListChecks,   label: "Plans d'action",   color: "text-teal-600 bg-teal-50" },
                { href: "/dashboard/admin/ria/gouvernance/dossiers",     icon: FileText,     label: "Dossiers IC",      color: "text-violet-600 bg-violet-50" },
                { href: "/dashboard/admin/ria/gouvernance/rapports",     icon: BarChart3,    label: "Rapports",         color: "text-amber-600 bg-amber-50" },
                { href: "/dashboard/admin/ria/gouvernance/anomalies",    icon: AlertTriangle,label: "Anomalies",        color: "text-rose-600 bg-rose-50" },
                { href: "/dashboard/admin/ria/gouvernance/kpis",         icon: TrendingUp,   label: "KPIs",             color: "text-indigo-600 bg-indigo-50" },
                { href: "/dashboard/admin/ria/gouvernance/intelligence", icon: Brain,        label: "Intelligence",     color: "text-violet-600 bg-violet-50" },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all group">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700">{label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-400 ml-auto transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
