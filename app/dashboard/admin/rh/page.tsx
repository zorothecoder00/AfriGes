"use client";

import React from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import {
  Users, Banknote, GraduationCap, Clock, Gift,
  CalendarDays, MapPin, Star, UserCheck, FileWarning,
  Building2, TrendingUp, AlertTriangle, CheckCircle2,
  ArrowRight, ArrowLeft, RefreshCw, ClipboardList, Brain, Rocket, FileText, Bell,
  CalendarClock, ShieldAlert,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */
interface RHStats {
  effectifs: {
    total: number;
    actifs: number;
    enEssai: number;
    suspendus: number;
    parDepartement: Record<string, number>;
  };
  paie: {
    brouillons: number;
    enControle: number;
    valides: number;
    enPaiement: number;
    payes: number;
    totalNetMois: number;
  };
  conges: {
    enAttente: number;
    approuves: number;
  };
  missions: {
    enCours: number;
    crees: number;
  };
  formations: {
    enCours: number;
    planifiees: number;
  };
  pointages: {
    presentsAujourdhui: number;
    absentsAujourdhui: number;
    congesAujourdhui: number;
  };
  evaluations: {
    brouillons: number;
    enCours: number;
  };
  recrutement: {
    postesOuverts: number;
    candidaturesEnAttente: number;
  };
  disciplinaire: {
    ouvertes: number;
    enInstruction: number;
  };
  avantages: {
    remboursementsEnAttente: number;
  };
  sst: {
    accidentsOuverts: number;
    visitesEnRetard: number;
    incidentsOuverts: number;
  };
}

/* ─── StatCard ───────────────────────────────────────────── */
function StatCard({
  href, icon, title, value, sub, color, alert,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  value: number | string;
  sub?: string;
  color: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group bg-white rounded-2xl border shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-all ${alert ? "border-red-200 bg-red-50/30" : "border-gray-100 hover:border-gray-200"}`}
    >
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium">{title}</p>
        <p className={`text-2xl font-bold mt-0.5 ${alert ? "text-red-600" : "text-gray-800"}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" />
    </Link>
  );
}

/* ─── SectionTitle ───────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-3">{children}</h2>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function RHDashboardPage() {
  const { data, loading, refetch } = useApi<{ data: RHStats }>("/api/admin/rh/dashboard");

  const s = data?.data;

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-6xl mx-auto space-y-2">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard Admin
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Tableau de bord RH</h1>
            <p className="text-sm text-gray-500 mt-1">Vue consolidée de la gestion des ressources humaines</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin/rh/notifications"
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-medium transition-all"
              title="Déclencheurs de notifications RH"
            >
              <Bell size={16} /> <span>Déclencheurs</span>
            </Link>
            <button
              onClick={refetch}
              className={`p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all ${loading ? "animate-spin" : ""}`}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading && !s && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Chargement…
          </div>
        )}

        {s && (
          <>
            {/* ── Onboarding ── */}
            <SectionTitle>Intégration</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                href="/dashboard/admin/rh/onboarding"
                icon={<ClipboardList size={20} />}
                title="Onboardings en cours"
                value={s.recrutement.candidaturesEnAttente}
                sub="Nouveaux collaborateurs"
                color="text-violet-600 bg-violet-50"
              />
            </div>

            {/* ── Effectifs ── */}
            <SectionTitle>Effectifs</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                href="/dashboard/admin/rh/collaborateurs"
                icon={<Users size={20} />}
                title="Total collaborateurs"
                value={s.effectifs.total}
                sub={`${s.effectifs.actifs} actifs · ${s.effectifs.enEssai} en essai`}
                color="text-indigo-600 bg-indigo-50"
              />
              <StatCard
                href="/dashboard/admin/rh/collaborateurs?statut=SUSPENDU"
                icon={<AlertTriangle size={20} />}
                title="Suspendus"
                value={s.effectifs.suspendus}
                color="text-orange-600 bg-orange-50"
                alert={s.effectifs.suspendus > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/organigramme"
                icon={<Building2 size={20} />}
                title="Départements"
                value={Object.keys(s.effectifs.parDepartement).length}
                sub="Voir l'organigramme"
                color="text-teal-600 bg-teal-50"
              />
              <StatCard
                href="/dashboard/admin/rh/recrutement"
                icon={<UserCheck size={20} />}
                title="Postes ouverts"
                value={s.recrutement.postesOuverts}
                sub={`${s.recrutement.candidaturesEnAttente} candidature(s) en attente`}
                color="text-green-600 bg-green-50"
              />
            </div>

            {/* ── Répartition départements ── */}
            {Object.keys(s.effectifs.parDepartement).length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Répartition par département</h3>
                <div className="space-y-2">
                  {Object.entries(s.effectifs.parDepartement)
                    .sort(([, a], [, b]) => b - a)
                    .map(([dept, count]) => {
                      const pct = Math.round((count / s.effectifs.total) * 100);
                      return (
                        <div key={dept} className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 w-40 truncate">{dept}</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-12 text-right">{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ── Présence & Congés ── */}
            <SectionTitle>Présence & Congés</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                href="/dashboard/admin/rh/pointages"
                icon={<CheckCircle2 size={20} />}
                title="Présents aujourd'hui"
                value={s.pointages.presentsAujourdhui}
                color="text-emerald-600 bg-emerald-50"
              />
              <StatCard
                href="/dashboard/admin/rh/pointages"
                icon={<AlertTriangle size={20} />}
                title="Absents aujourd'hui"
                value={s.pointages.absentsAujourdhui}
                color="text-red-600 bg-red-50"
                alert={s.pointages.absentsAujourdhui > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/conges"
                icon={<CalendarDays size={20} />}
                title="Congés en cours"
                value={s.pointages.congesAujourdhui}
                color="text-blue-600 bg-blue-50"
              />
              <StatCard
                href="/dashboard/admin/rh/conges"
                icon={<Clock size={20} />}
                title="Demandes en attente"
                value={s.conges.enAttente}
                sub={`${s.conges.approuves} approuvées`}
                color="text-yellow-600 bg-yellow-50"
                alert={s.conges.enAttente > 0}
              />
            </div>

            {/* ── Paie & Avantages ── */}
            <SectionTitle>Paie & Avantages</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                href="/dashboard/admin/rh/paie?statut=BROUILLON"
                icon={<Banknote size={20} />}
                title="Fiches brouillon"
                value={s.paie.brouillons}
                color="text-gray-600 bg-gray-50"
              />
              <StatCard
                href="/dashboard/admin/rh/paie?statut=CONTROLE"
                icon={<Banknote size={20} />}
                title="En contrôle RH"
                value={s.paie.enControle}
                sub="Validation en cours"
                color="text-yellow-600 bg-yellow-50"
                alert={s.paie.enControle > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/paie?statut=VALIDE"
                icon={<Banknote size={20} />}
                title="Validées"
                value={s.paie.valides}
                sub="Prêtes à mettre en paiement"
                color="text-blue-600 bg-blue-50"
                alert={s.paie.valides > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/paie?statut=EN_PAIEMENT"
                icon={<Banknote size={20} />}
                title="En paiement"
                value={s.paie.enPaiement}
                sub="Ordres émis"
                color="text-purple-600 bg-purple-50"
                alert={s.paie.enPaiement > 0}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                href="/dashboard/admin/rh/paie"
                icon={<TrendingUp size={20} />}
                title="Masse salariale (mois)"
                value={s.paie.totalNetMois > 0 ? `${s.paie.totalNetMois.toLocaleString("fr-FR")} F` : "—"}
                sub="Total net payé ce mois"
                color="text-emerald-600 bg-emerald-50"
              />
              <StatCard
                href="/dashboard/admin/rh/avantages"
                icon={<Gift size={20} />}
                title="Remboursements en attente"
                value={s.avantages.remboursementsEnAttente}
                color="text-purple-600 bg-purple-50"
                alert={s.avantages.remboursementsEnAttente > 0}
              />
            </div>

            {/* ── Développement & Missions ── */}
            <SectionTitle>Développement & Mobilité</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                href="/dashboard/admin/rh/formations"
                icon={<GraduationCap size={20} />}
                title="Formations planifiées"
                value={s.formations.planifiees}
                color="text-indigo-600 bg-indigo-50"
              />
              <StatCard
                href="/dashboard/admin/rh/formations"
                icon={<GraduationCap size={20} />}
                title="Formations en cours"
                value={s.formations.enCours}
                color="text-yellow-600 bg-yellow-50"
              />
              <StatCard
                href="/dashboard/admin/rh/missions"
                icon={<MapPin size={20} />}
                title="Missions en cours"
                value={s.missions.enCours}
                color="text-teal-600 bg-teal-50"
              />
              <StatCard
                href="/dashboard/admin/rh/missions"
                icon={<MapPin size={20} />}
                title="Missions créées"
                value={s.missions.crees}
                sub="En attente de validation"
                color="text-gray-600 bg-gray-50"
              />
            </div>

            {/* ── Référentiel & Politiques ── */}
            <SectionTitle>Référentiel &amp; Politiques</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                href="/dashboard/admin/rh/documents-strategiques"
                icon={<FileText size={20} />}
                title="Documents stratégiques"
                value="Gérer"
                sub="Manuel, politiques, règlement, codes"
                color="text-indigo-600 bg-indigo-50"
              />
            </div>

            {/* ── Performance & Disciplinaire ── */}
            <SectionTitle>Performance & Disciplinaire</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                href="/dashboard/admin/rh/evaluations"
                icon={<Star size={20} />}
                title="Évaluations en cours"
                value={s.evaluations.enCours}
                color="text-yellow-600 bg-yellow-50"
              />
              <StatCard
                href="/dashboard/admin/rh/evaluations"
                icon={<Star size={20} />}
                title="Évaluations brouillon"
                value={s.evaluations.brouillons}
                color="text-gray-600 bg-gray-50"
              />
              <StatCard
                href="/dashboard/admin/rh/disciplinaire"
                icon={<FileWarning size={20} />}
                title="Procédures ouvertes"
                value={s.disciplinaire.ouvertes}
                color="text-red-600 bg-red-50"
                alert={s.disciplinaire.ouvertes > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/disciplinaire"
                icon={<FileWarning size={20} />}
                title="En instruction"
                value={s.disciplinaire.enInstruction}
                color="text-orange-600 bg-orange-50"
                alert={s.disciplinaire.enInstruction > 0}
              />
            </div>

            {/* ── Santé & Sécurité (SST) ── */}
            <SectionTitle>Santé &amp; Sécurité</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                href="/dashboard/admin/rh/sst"
                icon={<ShieldAlert size={20} />}
                title="Accidents en cours"
                value={s.sst.accidentsOuverts}
                color="text-red-600 bg-red-50"
                alert={s.sst.accidentsOuverts > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/sst"
                icon={<ShieldAlert size={20} />}
                title="Visites médicales en retard"
                value={s.sst.visitesEnRetard}
                color="text-orange-600 bg-orange-50"
                alert={s.sst.visitesEnRetard > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/sst"
                icon={<ShieldAlert size={20} />}
                title="Incidents ouverts"
                value={s.sst.incidentsOuverts}
                color="text-amber-600 bg-amber-50"
                alert={s.sst.incidentsOuverts > 0}
              />
            </div>

            {/* ── Liens rapides ── */}
            <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Accès rapide</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {[
                  { href: "/dashboard/admin/rh/collaborateurs", icon: <Users size={16} />, label: "Collaborateurs" },
                  { href: "/dashboard/admin/rh/paie",           icon: <Banknote size={16} />, label: "Paie" },
                  { href: "/dashboard/admin/rh/formations",     icon: <GraduationCap size={16} />, label: "Formations" },
                  { href: "/dashboard/admin/rh/pointages",      icon: <Clock size={16} />, label: "Pointages" },
                  { href: "/dashboard/admin/rh/horaires",       icon: <Clock size={16} />, label: "Horaires" },
                  { href: "/dashboard/admin/rh/avantages",      icon: <Gift size={16} />, label: "Avantages" },
                  { href: "/dashboard/admin/rh/conges",         icon: <CalendarDays size={16} />, label: "Congés" },
                  { href: "/dashboard/admin/rh/competences",    icon: <Brain   size={16} />, label: "Compétences" },
                  { href: "/dashboard/admin/rh/carrieres",     icon: <Rocket  size={16} />, label: "Carrières" },
                  { href: "/dashboard/admin/rh/missions",       icon: <MapPin size={16} />, label: "Missions" },
                  { href: "/dashboard/admin/rh/evaluations",    icon: <Star size={16} />, label: "Évaluations" },
                  { href: "/dashboard/admin/rh/recrutement",    icon: <UserCheck size={16} />, label: "Recrutement" },
                  { href: "/dashboard/admin/rh/disciplinaire",  icon: <FileWarning size={16} />, label: "Disciplinaire" },
                  { href: "/dashboard/admin/rh/organigramme",   icon: <Building2 size={16} />, label: "Organigramme" },
                  { href: "/dashboard/admin/rh/planning",       icon: <CalendarClock size={16} />, label: "Planning d'équipe" },
                  { href: "/dashboard/admin/rh/sst",            icon: <ShieldAlert size={16} />, label: "Santé & Sécurité" },
                  { href: "/dashboard/admin/rh/documents-rh",  icon: <FileText  size={16} />, label: "Documents RH" },
                  { href: "/dashboard/admin/rh/audit",         icon: <Clock     size={16} />, label: "Audit & Traçabilité" },
                ].map(({ href, icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 text-sm text-gray-600 hover:text-indigo-700 transition-all"
                  >
                    <span className="text-gray-400">{icon}</span>
                    {label}
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
