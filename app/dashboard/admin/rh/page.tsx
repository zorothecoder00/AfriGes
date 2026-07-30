"use client";

import React from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import {
  Users, Banknote, GraduationCap, Clock, Gift,
  CalendarDays, MapPin, Star, UserCheck, FileWarning,
  Building2, TrendingUp, AlertTriangle, CheckCircle2,
  ArrowRight, RefreshCw, ClipboardList, Brain, Rocket, FileText, Bell,
  CalendarClock, ShieldAlert, Download,
} from "lucide-react";
import { exportMultiSheetXlsx } from "@/lib/exportXlsx";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

/* ─── Accents sémantiques (mêmes tokens que KpiCard.tsx) ──── */
const ACCENT = {
  primary: "text-primary-600 bg-primary-50 dark:text-primary-300 dark:bg-primary-900/30",
  success: "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30",
  warning: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30",
  error:   "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-900/30",
  purple:  "text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-900/30",
  teal:    "text-teal-600 bg-teal-50 dark:text-teal-300 dark:bg-teal-900/30",
  neutral: "text-slate-600 bg-slate-50 dark:text-slate-300 dark:bg-slate-700",
  accent:  "text-accent-600 bg-accent-50 dark:text-accent-300 dark:bg-accent-700/20",
} as const;
type AccentKey = keyof typeof ACCENT;

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
  href, icon, title, value, sub, accent, alert,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  value: number | string;
  sub?: string;
  accent: AccentKey;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group bg-white dark:bg-slate-800 rounded-2xl border shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-all ${alert ? "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-900/10" : "border-slate-100 hover:border-slate-200 dark:border-slate-700 dark:hover:border-slate-600"}`}
    >
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${ACCENT[accent]}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{title}</p>
        <p className={`text-2xl font-bold mt-0.5 ${alert ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors" />
    </Link>
  );
}

/* ─── SectionTitle ───────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-6 mb-3">{children}</h2>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function RHDashboardPage() {
  const { data, loading, refetch } = useApi<{ data: RHStats }>("/api/admin/rh/dashboard");

  const s = data?.data;

  function exportDashboard() {
    if (!s) return;
    const resume = [
      { Section: "Effectifs", Indicateur: "Total collaborateurs", Valeur: s.effectifs.total },
      { Section: "Effectifs", Indicateur: "Actifs", Valeur: s.effectifs.actifs },
      { Section: "Effectifs", Indicateur: "En essai", Valeur: s.effectifs.enEssai },
      { Section: "Effectifs", Indicateur: "Suspendus", Valeur: s.effectifs.suspendus },
      { Section: "Recrutement", Indicateur: "Postes ouverts", Valeur: s.recrutement.postesOuverts },
      { Section: "Recrutement", Indicateur: "Candidatures en attente", Valeur: s.recrutement.candidaturesEnAttente },
      { Section: "Présence", Indicateur: "Présents aujourd'hui", Valeur: s.pointages.presentsAujourdhui },
      { Section: "Présence", Indicateur: "Absents aujourd'hui", Valeur: s.pointages.absentsAujourdhui },
      { Section: "Présence", Indicateur: "Congés en cours", Valeur: s.pointages.congesAujourdhui },
      { Section: "Congés", Indicateur: "Demandes en attente", Valeur: s.conges.enAttente },
      { Section: "Congés", Indicateur: "Approuvées", Valeur: s.conges.approuves },
      { Section: "Paie", Indicateur: "Fiches brouillon", Valeur: s.paie.brouillons },
      { Section: "Paie", Indicateur: "En contrôle RH", Valeur: s.paie.enControle },
      { Section: "Paie", Indicateur: "Validées", Valeur: s.paie.valides },
      { Section: "Paie", Indicateur: "En paiement", Valeur: s.paie.enPaiement },
      { Section: "Paie", Indicateur: "Payées", Valeur: s.paie.payes },
      { Section: "Paie", Indicateur: "Masse salariale (mois, FCFA)", Valeur: s.paie.totalNetMois },
      { Section: "Avantages", Indicateur: "Remboursements en attente", Valeur: s.avantages.remboursementsEnAttente },
      { Section: "Formations", Indicateur: "Planifiées", Valeur: s.formations.planifiees },
      { Section: "Formations", Indicateur: "En cours", Valeur: s.formations.enCours },
      { Section: "Missions", Indicateur: "En cours", Valeur: s.missions.enCours },
      { Section: "Missions", Indicateur: "Créées", Valeur: s.missions.crees },
      { Section: "Évaluations", Indicateur: "En cours", Valeur: s.evaluations.enCours },
      { Section: "Évaluations", Indicateur: "Brouillon", Valeur: s.evaluations.brouillons },
      { Section: "Disciplinaire", Indicateur: "Procédures ouvertes", Valeur: s.disciplinaire.ouvertes },
      { Section: "Disciplinaire", Indicateur: "En instruction", Valeur: s.disciplinaire.enInstruction },
      { Section: "Santé & Sécurité", Indicateur: "Accidents en cours", Valeur: s.sst.accidentsOuverts },
      { Section: "Santé & Sécurité", Indicateur: "Visites médicales en retard", Valeur: s.sst.visitesEnRetard },
      { Section: "Santé & Sécurité", Indicateur: "Incidents ouverts", Valeur: s.sst.incidentsOuverts },
    ];
    const departements = Object.entries(s.effectifs.parDepartement)
      .sort(([, a], [, b]) => b - a)
      .map(([Departement, Effectif]) => ({ Departement, Effectif }));

    exportMultiSheetXlsx(
      [
        {
          sheetName: "Résumé RH", kind: "object", rows: resume, title: "Tableau de bord RH — résumé consolidé",
          columns: [
            { label: "Section", key: "Section" },
            { label: "Indicateur", key: "Indicateur" },
            { label: "Valeur", key: "Valeur", type: "number" },
          ],
        },
        {
          sheetName: "Départements", kind: "object", rows: departements, title: "Répartition par département",
          columns: [
            { label: "Département", key: "Departement" },
            { label: "Effectif", key: "Effectif", type: "number" },
          ],
        },
      ],
      `tableau-de-bord-rh-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-2">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Tableau de bord RH</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Vue consolidée de la gestion des ressources humaines</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin/rh/notifications"
              title="Déclencheurs de notifications RH"
              className="inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors px-4 py-2.5 text-sm
                border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100
                dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
            >
              <Bell size={16} /> Déclencheurs
            </Link>
            <Button
              variant="secondary"
              icon={<Download size={16} />}
              onClick={exportDashboard}
              disabled={!s}
              title="Exporter le tableau de bord"
            >
              Exporter
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={refetch}
              loading={loading}
              className="!p-2.5 border border-slate-200 dark:border-slate-700"
              title="Rafraîchir"
            />
          </div>
        </div>

        {loading && !s && (
          <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">
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
                accent="purple"
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
                accent="primary"
              />
              <StatCard
                href="/dashboard/admin/rh/collaborateurs?statut=SUSPENDU"
                icon={<AlertTriangle size={20} />}
                title="Suspendus"
                value={s.effectifs.suspendus}
                accent="accent"
                alert={s.effectifs.suspendus > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/organigramme"
                icon={<Building2 size={20} />}
                title="Départements"
                value={Object.keys(s.effectifs.parDepartement).length}
                sub="Voir l'organigramme"
                accent="teal"
              />
              <StatCard
                href="/dashboard/admin/rh/recrutement"
                icon={<UserCheck size={20} />}
                title="Postes ouverts"
                value={s.recrutement.postesOuverts}
                sub={`${s.recrutement.candidaturesEnAttente} candidature(s) en attente`}
                accent="success"
              />
            </div>

            {/* ── Répartition départements ── */}
            {Object.keys(s.effectifs.parDepartement).length > 0 && (
              <Card title="Répartition par département">
                <div className="space-y-2">
                  {Object.entries(s.effectifs.parDepartement)
                    .sort(([, a], [, b]) => b - a)
                    .map(([dept, count]) => {
                      const pct = Math.round((count / s.effectifs.total) * 100);
                      return (
                        <div key={dept} className="flex items-center gap-3">
                          <span className="text-xs text-slate-600 dark:text-slate-300 w-40 truncate">{dept}</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 w-12 text-right">{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                </div>
              </Card>
            )}

            {/* ── Présence & Congés ── */}
            <SectionTitle>Présence & Congés</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                href="/dashboard/admin/rh/pointages"
                icon={<CheckCircle2 size={20} />}
                title="Présents aujourd'hui"
                value={s.pointages.presentsAujourdhui}
                accent="success"
              />
              <StatCard
                href="/dashboard/admin/rh/pointages"
                icon={<AlertTriangle size={20} />}
                title="Absents aujourd'hui"
                value={s.pointages.absentsAujourdhui}
                accent="error"
                alert={s.pointages.absentsAujourdhui > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/conges"
                icon={<CalendarDays size={20} />}
                title="Congés en cours"
                value={s.pointages.congesAujourdhui}
                accent="primary"
              />
              <StatCard
                href="/dashboard/admin/rh/conges"
                icon={<Clock size={20} />}
                title="Demandes en attente"
                value={s.conges.enAttente}
                sub={`${s.conges.approuves} approuvées`}
                accent="warning"
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
                accent="neutral"
              />
              <StatCard
                href="/dashboard/admin/rh/paie?statut=CONTROLE"
                icon={<Banknote size={20} />}
                title="En contrôle RH"
                value={s.paie.enControle}
                sub="Validation en cours"
                accent="warning"
                alert={s.paie.enControle > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/paie?statut=VALIDE"
                icon={<Banknote size={20} />}
                title="Validées"
                value={s.paie.valides}
                sub="Prêtes à mettre en paiement"
                accent="primary"
                alert={s.paie.valides > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/paie?statut=EN_PAIEMENT"
                icon={<Banknote size={20} />}
                title="En paiement"
                value={s.paie.enPaiement}
                sub="Ordres émis"
                accent="purple"
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
                accent="success"
              />
              <StatCard
                href="/dashboard/admin/rh/avantages"
                icon={<Gift size={20} />}
                title="Remboursements en attente"
                value={s.avantages.remboursementsEnAttente}
                accent="purple"
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
                accent="primary"
              />
              <StatCard
                href="/dashboard/admin/rh/formations"
                icon={<GraduationCap size={20} />}
                title="Formations en cours"
                value={s.formations.enCours}
                accent="warning"
              />
              <StatCard
                href="/dashboard/admin/rh/missions"
                icon={<MapPin size={20} />}
                title="Missions en cours"
                value={s.missions.enCours}
                accent="teal"
              />
              <StatCard
                href="/dashboard/admin/rh/missions"
                icon={<MapPin size={20} />}
                title="Missions créées"
                value={s.missions.crees}
                sub="En attente de validation"
                accent="neutral"
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
                accent="primary"
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
                accent="warning"
              />
              <StatCard
                href="/dashboard/admin/rh/evaluations"
                icon={<Star size={20} />}
                title="Évaluations brouillon"
                value={s.evaluations.brouillons}
                accent="neutral"
              />
              <StatCard
                href="/dashboard/admin/rh/disciplinaire"
                icon={<FileWarning size={20} />}
                title="Procédures ouvertes"
                value={s.disciplinaire.ouvertes}
                accent="error"
                alert={s.disciplinaire.ouvertes > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/disciplinaire"
                icon={<FileWarning size={20} />}
                title="En instruction"
                value={s.disciplinaire.enInstruction}
                accent="accent"
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
                accent="error"
                alert={s.sst.accidentsOuverts > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/sst"
                icon={<ShieldAlert size={20} />}
                title="Visites médicales en retard"
                value={s.sst.visitesEnRetard}
                accent="accent"
                alert={s.sst.visitesEnRetard > 0}
              />
              <StatCard
                href="/dashboard/admin/rh/sst"
                icon={<ShieldAlert size={20} />}
                title="Incidents ouverts"
                value={s.sst.incidentsOuverts}
                accent="warning"
                alert={s.sst.incidentsOuverts > 0}
              />
            </div>

            {/* ── Liens rapides ── */}
            <Card title="Accès rapide" className="mt-6">
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
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-primary-200 hover:bg-primary-50 dark:hover:border-primary-800 dark:hover:bg-primary-900/20 text-sm text-slate-600 dark:text-slate-300 hover:text-primary-700 dark:hover:text-primary-300 transition-all"
                  >
                    <span className="text-slate-400 dark:text-slate-500">{icon}</span>
                    {label}
                  </Link>
                ))}
              </div>
            </Card>
          </>
        )}
    </div>
  );
}
