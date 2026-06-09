"use client";

import React from "react";
import Link from "next/link";
import {
  Users, UserCheck, UserX, Clock, TrendingUp, TrendingDown,
  Star, AlertTriangle, Calendar, Briefcase, RefreshCw, Bell,
  ArrowRight, ChevronRight, CheckCircle2, Building2,
  FileWarning, GraduationCap, FileText, Target, ShieldCheck, MessageSquare, DollarSign,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardRH {
  pdv: { id: number; nom: string } | null;
  effectif: {
    total:          number;
    parSexe:        Record<string, number>;
    parDepartement: Record<string, number>;
    parTypeContrat: Record<string, number>;
    parStatut:      Record<string, number>;
  };
  presence: {
    date:           string;
    presents:       number;
    absents:        number;
    retards:        number;
    conges:         number;
    tauxPresence:   number;
    retardTotalMin: number;
    tendance: { date: string; presents: number; absents: number; retards: number }[];
  };
  recrutement: {
    postesOuverts:      number;
    postesEnCours:      number;
    candidaturesActives:number;
    postesRecents: {
      id: number; titre: string; departement: string | null; statut: string;
      _count: { candidatures: number };
    }[];
  };
  performance: {
    totalEvaluees:     number;
    noteMoyenne:       number | null;
    evaluationsEnCours:number;
    performants:    CollabPerf[];
    aAccompagner:   CollabPerf[];
  };
  alertes: {
    congesEnAttente: number;
    cddExpirant:     number;
  };
}

interface CollabPerf {
  id: number; matricule: string; nom: string; prenom: string;
  photo: string | null; noteGlobale: number;
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_POSTE: Record<string, { label: string; color: string }> = {
  OUVERT:   { label: "Ouvert",    color: "bg-emerald-100 text-emerald-700" },
  EN_COURS: { label: "En cours",  color: "bg-blue-100 text-blue-700"      },
};

const NOTE_COLOR = (n: number) =>
  n >= 4   ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
  n >= 3   ? "text-blue-600 bg-blue-50 border-blue-200" :
  n >= 2.5 ? "text-amber-600 bg-amber-50 border-amber-200" :
             "text-red-600 bg-red-50 border-red-200";

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardRHPage() {
  const { data, loading, refetch } = useApi<DashboardRH>("/api/responsableRH/dashboard");

  const d = data;

  // KPIs présence pour la barre de progression
  const total      = d?.effectif.total ?? 0;
  const pctPresent = d ? Math.round(((d.presence.presents + d.presence.retards) / Math.max(total, 1)) * 100) : 0;
  const pctAbsent  = d ? Math.round((d.presence.absents / Math.max(total, 1)) * 100) : 0;
  const pctConge   = d ? Math.round((d.presence.conges  / Math.max(total, 1)) * 100) : 0;

  // Tendance présence : max journalier pour l'échelle
  const maxJour = d
    ? Math.max(...d.presence.tendance.map((t) => t.presents + t.absents + t.retards), 1)
    : 1;

  // Sexe
  const masculin  = d?.effectif.parSexe["MASCULIN"]  ?? 0;
  const feminin   = d?.effectif.parSexe["FEMININ"]   ?? 0;
  const totalSexe = masculin + feminin || 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tableau de bord RH</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-sm text-slate-500">
                Vue synthétique · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              {d?.pdv && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700">
                  <Building2 className="w-3 h-3" /> {d.pdv.nom}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/gestionnaire/messages"
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 transition-all"
              title="Messagerie"
            >
              <MessageSquare size={16} />
            </Link>
            <Link
              href="/dashboard/user/responsablesRH/audit"
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 transition-all"
              title="Audit & Traçabilité"
            >
              <ShieldCheck size={16} />
            </Link>
            <Link
              href="/dashboard/user/responsablesRH/preferences"
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 transition-all"
              title="Préférences de notifications"
            >
              <Bell size={16} />
            </Link>
            <button
              onClick={refetch}
              className={`p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 transition-all ${loading ? "animate-spin" : ""}`}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading && !d && (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        )}

        {d && (
          <>
            {/* ── Alertes ── */}
            {(d.alertes.congesEnAttente > 0 || d.alertes.cddExpirant > 0) && (
              <div className="flex gap-3 flex-wrap">
                {d.alertes.congesEnAttente > 0 && (
                  <Link
                    href="/dashboard/admin/rh/conges"
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 hover:bg-amber-100 transition-all"
                  >
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <strong>{d.alertes.congesEnAttente}</strong> demande{d.alertes.congesEnAttente > 1 ? "s" : ""} de congé en attente
                    <ChevronRight className="w-3.5 h-3.5 text-amber-500" />
                  </Link>
                )}
                {d.alertes.cddExpirant > 0 && (
                  <Link
                    href="/dashboard/admin/rh/collaborateurs?typeContrat=CDD"
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 hover:bg-red-100 transition-all"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <strong>{d.alertes.cddExpirant}</strong> CDD expirant dans 30 jours
                    <ChevronRight className="w-3.5 h-3.5 text-red-500" />
                  </Link>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                SECTION 1 — EFFECTIF
            ══════════════════════════════════════════════════════════ */}
            <Section title="Effectif" icon={<Users size={16} />} href="/dashboard/admin/rh/collaborateurs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Total & statuts */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Effectif total</p>
                  <p className="text-5xl font-bold text-slate-900">{total}</p>
                  <p className="text-sm text-slate-500 mt-1">collaborateurs actifs</p>
                  <div className="mt-4 space-y-1.5">
                    {Object.entries(d.effectif.parStatut).filter(([k]) => k !== "ACTIF").map(([statut, count]) => (
                      <div key={statut} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{STATUT_LABEL[statut] ?? statut}</span>
                        <span className="font-semibold text-slate-700">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Répartition par sexe */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Répartition par sexe</p>
                  <div className="space-y-3">
                    <SexeBar label="Hommes" count={masculin} total={totalSexe} color="bg-blue-400" />
                    <SexeBar label="Femmes" count={feminin}  total={totalSexe} color="bg-pink-400" />
                    {(d.effectif.parSexe["AUTRE"] ?? 0) > 0 && (
                      <SexeBar label="Autre" count={d.effectif.parSexe["AUTRE"] ?? 0} total={totalSexe} color="bg-slate-300" />
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                      <span className="text-slate-600">{Math.round((masculin / totalSexe) * 100)}% H</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-pink-400" />
                      <span className="text-slate-600">{Math.round((feminin / totalSexe) * 100)}% F</span>
                    </div>
                  </div>
                </div>

                {/* Répartition par département */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Répartition par département</p>
                  {Object.keys(d.effectif.parDepartement).length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Aucun département renseigné</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(d.effectif.parDepartement)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 6)
                        .map(([dept, count]) => {
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={dept} className="flex items-center gap-2">
                              <span className="text-xs text-slate-600 w-28 truncate">{dept}</span>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-slate-500 w-8 text-right font-medium">{count}</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                  {/* Types de contrat */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-400 mb-2">Contrats</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(d.effectif.parTypeContrat)
                        .filter(([k]) => k !== "NON_RENSEIGNE")
                        .map(([type, count]) => (
                          <span key={type} className="px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-600 font-medium">
                            {type} · {count}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════
                SECTION 2 — PRÉSENCE
            ══════════════════════════════════════════════════════════ */}
            <Section title="Présence" icon={<CheckCircle2 size={16} />} href="/dashboard/admin/rh/pointages">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* KPIs today */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Aujourd&apos;hui</p>

                  {/* Taux présence */}
                  <div>
                    <div className="flex items-end justify-between mb-1.5">
                      <span className="text-sm text-slate-600">Taux de présence</span>
                      <span className={`text-2xl font-bold ${d.presence.tauxPresence >= 80 ? "text-emerald-600" : d.presence.tauxPresence >= 60 ? "text-amber-600" : "text-red-600"}`}>
                        {d.presence.tauxPresence}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-400 rounded-l-full" style={{ width: `${pctPresent}%` }} />
                      <div className="h-full bg-amber-400" style={{ width: `${Math.min(pctConge, 100 - pctPresent)}%` }} />
                      <div className="h-full bg-red-300 rounded-r-full" style={{ width: `${pctAbsent}%` }} />
                    </div>
                    <div className="flex gap-3 mt-2 flex-wrap">
                      <LegendDot color="bg-emerald-400" label={`Présents : ${d.presence.presents}`} />
                      <LegendDot color="bg-amber-400"   label={`Congés : ${d.presence.conges}`} />
                      <LegendDot color="bg-red-300"     label={`Absents : ${d.presence.absents}`} />
                    </div>
                  </div>

                  {/* Retards */}
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span className="text-sm text-amber-800">Retards</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-700">{d.presence.retards}</p>
                      {d.presence.retardTotalMin > 0 && (
                        <p className="text-xs text-amber-600">{Math.round(d.presence.retardTotalMin / d.presence.retards)} min moy.</p>
                      )}
                    </div>
                  </div>

                  {/* Absences */}
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                    <div className="flex items-center gap-2">
                      <UserX className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-800">Absences</span>
                    </div>
                    <p className="text-lg font-bold text-red-600">{d.presence.absents}</p>
                  </div>
                </div>

                {/* Tendance 7 jours */}
                <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">Tendance 7 jours</p>
                  <div className="flex items-end gap-3 h-32">
                    {d.presence.tendance.map((t) => {
                      const pctP = Math.round((t.presents / maxJour) * 100);
                      const pctA = Math.round((t.absents  / maxJour) * 100);
                      const pctR = Math.round((t.retards  / maxJour) * 100);
                      const dow  = new Date(t.date).toLocaleDateString("fr-FR", { weekday: "short" });
                      const isToday = t.date === d.presence.date;
                      return (
                        <div key={t.date} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex flex-col-reverse gap-px rounded-t-lg overflow-hidden" style={{ height: "100px" }}>
                            <div className="w-full bg-emerald-400 rounded-t" style={{ height: `${pctP}%` }} />
                            <div className="w-full bg-amber-300"             style={{ height: `${pctR}%` }} />
                            <div className="w-full bg-red-300"               style={{ height: `${pctA}%` }} />
                          </div>
                          <span className={`text-xs ${isToday ? "font-bold text-slate-900" : "text-slate-400"}`}>
                            {dow}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                    <LegendDot color="bg-emerald-400" label="Présents" />
                    <LegendDot color="bg-amber-300"   label="Retards"  />
                    <LegendDot color="bg-red-300"     label="Absents"  />
                  </div>
                </div>
              </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════
                SECTION 3 — RECRUTEMENT
            ══════════════════════════════════════════════════════════ */}
            <Section title="Recrutement" icon={<UserCheck size={16} />} href="/dashboard/admin/rh/recrutement">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* KPIs recrutement */}
                <div className="space-y-3">
                  <KpiCard
                    icon={<Briefcase className="w-5 h-5" />}
                    label="Postes ouverts"
                    value={d.recrutement.postesOuverts}
                    color="text-indigo-600 bg-indigo-50"
                    href="/dashboard/admin/rh/recrutement?statut=OUVERT"
                  />
                  <KpiCard
                    icon={<Target className="w-5 h-5" />}
                    label="Recrutements en cours"
                    value={d.recrutement.postesEnCours}
                    color="text-blue-600 bg-blue-50"
                    href="/dashboard/admin/rh/recrutement?statut=EN_COURS"
                  />
                  <KpiCard
                    icon={<Users className="w-5 h-5" />}
                    label="Candidatures actives"
                    value={d.recrutement.candidaturesActives}
                    color="text-teal-600 bg-teal-50"
                    href="/dashboard/admin/rh/recrutement"
                  />
                </div>

                {/* Postes récents */}
                <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Postes actifs récents</p>
                    <Link href="/dashboard/admin/rh/recrutement" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                      Voir tout <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  {d.recrutement.postesRecents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                      <Briefcase className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-sm">Aucun poste actif</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {d.recrutement.postesRecents.map((p) => {
                        const scfg = STATUT_POSTE[p.statut] ?? { label: p.statut, color: "bg-slate-100 text-slate-600" };
                        return (
                          <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{p.titre}</p>
                              {p.departement && <p className="text-xs text-slate-400">{p.departement}</p>}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${scfg.color}`}>{scfg.label}</span>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              {p._count.candidatures} candid.
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════
                SECTION 4 — PERFORMANCE
            ══════════════════════════════════════════════════════════ */}
            <Section title="Performance" icon={<Star size={16} />} href="/dashboard/admin/rh/evaluations">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* KPIs performance */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">KPI moyens</p>

                  {d.performance.noteMoyenne !== null ? (
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                          <circle
                            cx="18" cy="18" r="14" fill="none"
                            stroke={d.performance.noteMoyenne >= 4 ? "#10b981" : d.performance.noteMoyenne >= 3 ? "#3b82f6" : "#f59e0b"}
                            strokeWidth="3.5"
                            strokeDasharray={`${(d.performance.noteMoyenne / 5) * 87.96} 87.96`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-bold text-slate-900">{d.performance.noteMoyenne}</span>
                          <span className="text-xs text-slate-400">/5</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">Note moyenne</p>
                        <p className="text-xs text-slate-500 mt-0.5">{d.performance.totalEvaluees} collaborateur{d.performance.totalEvaluees > 1 ? "s" : ""} évalué{d.performance.totalEvaluees > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6 text-slate-400">
                      <Star className="w-6 h-6 opacity-30 mr-2" />
                      <p className="text-sm">Pas encore d&apos;évaluations</p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Évaluations en cours</span>
                      <span className="font-semibold text-slate-700">{d.performance.evaluationsEnCours}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-emerald-600"><TrendingUp className="w-3.5 h-3.5" /> Performants (≥ 4/5)</span>
                      <span className="font-semibold text-emerald-700">{d.performance.performants.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-red-500"><TrendingDown className="w-3.5 h-3.5" /> À accompagner (&lt; 2.5)</span>
                      <span className="font-semibold text-red-600">{d.performance.aAccompagner.length}</span>
                    </div>
                  </div>
                </div>

                {/* Top performants */}
                <PerfList
                  title="Collaborateurs performants"
                  icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
                  items={d.performance.performants}
                  emptyMsg="Aucun collaborateur avec note ≥ 4/5"
                  emptyIcon={<Star className="w-7 h-7 opacity-30" />}
                />

                {/* À accompagner */}
                <PerfList
                  title="Collaborateurs à accompagner"
                  icon={<TrendingDown className="w-4 h-4 text-red-500" />}
                  items={d.performance.aAccompagner}
                  emptyMsg="Aucun collaborateur en dessous de 2.5/5"
                  emptyIcon={<CheckCircle2 className="w-7 h-7 opacity-30 text-emerald-400" />}
                />
              </div>
            </Section>

            {/* ── Accès rapide ── */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Accès rapide</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {[
                  { href: "/dashboard/admin/rh/collaborateurs",    icon: <Users size={15} />,         label: "Collaborateurs"  },
                  { href: "/dashboard/admin/rh/pointages",       icon: <CheckCircle2 size={15} />,  label: "Pointages"       },
                  { href: "/dashboard/admin/rh/conges",          icon: <Calendar size={15} />,      label: "Congés"          },
                  { href: "/dashboard/admin/rh/recrutement",     icon: <UserCheck size={15} />,     label: "Recrutement"     },
                  { href: "/dashboard/admin/rh/evaluations",     icon: <Star size={15} />,          label: "Évaluations"     },
                  { href: "/dashboard/admin/rh/formations",      icon: <GraduationCap size={15} />, label: "Formations"      },
                  { href: "/dashboard/admin/rh/documents-rh",    icon: <FileText size={15} />,      label: "Documents RH"    },
                  { href: "/dashboard/admin/rh/organigramme",    icon: <Building2 size={15} />,     label: "Organigramme"    },
                  { href: "/dashboard/admin/rh/disciplinaire",   icon: <FileWarning size={15} />,   label: "Disciplinaire"   },
                  { href: "/dashboard/user/responsablesRH/paie", icon: <DollarSign size={15} />,    label: "Paie"            },
                ].map(({ href, icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 text-sm text-slate-600 hover:text-emerald-700 transition-all"
                  >
                    <span className="text-slate-400">{icon}</span> {label}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function Section({
  title, icon, href, children,
}: {
  title: string; icon: React.ReactNode; href: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500">{icon}</div>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
        <Link href={href} className="ml-auto text-xs text-slate-400 hover:text-emerald-600 flex items-center gap-1">
          Voir tout <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}

function SexeBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600 mb-1">
        <span>{label}</span>
        <span className="font-semibold">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, color, href }: {
  icon: React.ReactNode; label: string; value: number; color: string; href: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-all group">
      <div className={`p-2.5 rounded-xl ${color} flex-shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-snug">{label}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
    </Link>
  );
}

function PerfList({ title, icon, items, emptyMsg, emptyIcon }: {
  title: string; icon: React.ReactNode; items: CollabPerf[];
  emptyMsg: string; emptyIcon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        {icon}
        <p className="text-sm font-semibold text-slate-700">{title}</p>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          {emptyIcon}
          <p className="text-xs mt-2 text-center px-4">{emptyMsg}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/admin/rh/collaborateurs/${c.id}`}
              className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 group"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {c.prenom[0]}{c.nom[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{c.prenom} {c.nom}</p>
                <p className="text-xs text-slate-400 font-mono">{c.matricule}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${NOTE_COLOR(c.noteGlobale)}`}>
                {c.noteGlobale.toFixed(1)}/5
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUT_LABEL: Record<string, string> = {
  ACTIF:           "Actifs",
  EN_PERIODE_ESSAI:"En période d'essai",
  SUSPENDU:        "Suspendus",
  DEMISSIONNAIRE:  "Démissionnaires",
  LICENCIE:        "Licenciés",
  RETRAITE:        "Retraités",
  INACTIF:         "Inactifs",
};
