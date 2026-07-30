"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search, RefreshCw, UserPlus, ClipboardList,
  CheckCircle2, Clock, PauseCircle, XCircle, ChevronRight,
  Briefcase, Mail, Hash, AlertTriangle, Filter,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import KpiCard from "@/components/ui/KpiCard";
import Pagination from "@/components/ui/Pagination";

/* ─── Types ─────────────────────────────────────────────────── */
type StatutOnboarding = "EN_COURS" | "TERMINE" | "SUSPENDU" | "ANNULE";

interface OnboardingItem {
  id: number;
  statut: StatutOnboarding;
  progressionPct: number;
  dateDebut: string;
  dateFinPrevue: string | null;
  dateCloture: string | null;
  profilRH: {
    id: number;
    matricule: string;
    emailProfessionnel: string | null;
    fonction: string | null;
    departement: string | null;
    gestionnaire: {
      member: { nom: string; prenom: string; telephone: string | null };
    };
  };
  candidature: {
    id: number;
    nomCandidat: string;
    prenomCandidat: string;
    poste: { id: number; reference: string | null; titre: string } | null;
  };
  template: { id: number; nom: string } | null;
  _count: { etapes: number };
}

interface ApiResponse {
  data: OnboardingItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  stats: Partial<Record<StatutOnboarding, number>>;
}

/* ─── Helpers ────────────────────────────────────────────────── */
const STATUT_CONFIG: Record<StatutOnboarding, { label: string; variant: BadgeVariant; accent: "primary" | "success" | "warning" | "error"; icon: React.ReactNode }> = {
  EN_COURS:  { label: "En cours",  variant: "info",    accent: "primary", icon: <Clock        className="w-3 h-3" /> },
  TERMINE:   { label: "Terminé",   variant: "success", accent: "success", icon: <CheckCircle2 className="w-3 h-3" /> },
  SUSPENDU:  { label: "Suspendu",  variant: "warning", accent: "warning", icon: <PauseCircle className="w-3 h-3" /> },
  ANNULE:    { label: "Annulé",    variant: "error",   accent: "error",   icon: <XCircle      className="w-3 h-3" /> },
};

function ProgressBar({ value }: { value: number }) {
  const color = value === 100 ? "bg-emerald-500" : value >= 50 ? "bg-primary-500" : "bg-accent-500";
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${value}%` }} />
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const [search, setSearch]   = useState("");
  const [statut, setStatut]   = useState<StatutOnboarding | "">("");
  const [page, setPage]       = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  if (statut) params.set("statut", statut);

  const { data: res, loading, refetch } = useApi<ApiResponse>(
    `/api/admin/rh/onboarding?${params}`
  );

  const onboardings = res?.data ?? [];
  const meta        = res?.meta;
  const stats       = res?.stats ?? {};

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ClipboardList className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Onboarding</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Suivi de l&apos;intégration des nouveaux collaborateurs</p>
          <Link
            href="/dashboard/admin/rh/onboarding/templates"
            className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:underline"
          >
            Gérer les templates →
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["EN_COURS","TERMINE","SUSPENDU","ANNULE"] as StatutOnboarding[]).map((s) => {
            const cfg = STATUT_CONFIG[s];
            return (
              <KpiCard key={s} label={cfg.label} value={stats[s] ?? 0} icon={cfg.icon} accent={cfg.accent} />
            );
          })}
        </div>

        {/* Filtres */}
        <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Rechercher un collaborateur…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statut}
              onChange={(e) => { setStatut(e.target.value as StatutOnboarding | ""); setPage(1); }}
              className="text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            >
              <option value="">Tous les statuts</option>
              {(Object.keys(STATUT_CONFIG) as StatutOnboarding[]).map((s) => (
                <option key={s} value={s}>{STATUT_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} loading={loading} className="border border-slate-200 dark:border-slate-700" title="Rafraîchir" />
        </div>
        </Card>

        {/* Liste */}
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Chargement…
            </div>
          )}

          {!loading && onboardings.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
              <UserPlus className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">Aucun onboarding trouvé</p>
            </div>
          )}

          {onboardings.map((ob) => {
            const cfg   = STATUT_CONFIG[ob.statut];
            const nom   = `${ob.profilRH.gestionnaire.member.prenom} ${ob.profilRH.gestionnaire.member.nom}`;
            const enRetard = ob.statut === "EN_COURS" && ob.dateFinPrevue && new Date(ob.dateFinPrevue) < new Date();

            return (
              <Link
                key={ob.id}
                href={`/dashboard/admin/rh/onboarding/${ob.id}`}
                className="block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Infos collaborateur */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{nom}</p>
                      <Badge variant={cfg.variant} icon={cfg.icon}>{cfg.label}</Badge>
                      {enRetard && (
                        <Badge variant="error" icon={<AlertTriangle className="w-3 h-3" />}>En retard</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
                      {ob.profilRH.fonction && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />{ob.profilRH.fonction}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />{ob.profilRH.matricule}
                      </span>
                      {ob.profilRH.emailProfessionnel && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />{ob.profilRH.emailProfessionnel}
                        </span>
                      )}
                      {ob.candidature.poste && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {ob.candidature.poste.titre}
                        </span>
                      )}
                    </div>

                    {/* Progression */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <ProgressBar value={ob.progressionPct} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-10 text-right">
                        {ob.progressionPct}%
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{ob._count.etapes} étapes</span>
                    </div>
                  </div>

                  {/* Dates + flèche */}
                  <div className="text-right text-xs text-slate-400 dark:text-slate-500 shrink-0 flex flex-col items-end gap-1">
                    <span>Début {formatDate(ob.dateDebut)}</span>
                    {ob.dateFinPrevue && (
                      <span className={enRetard ? "text-red-500 dark:text-red-400 font-medium" : ""}>
                        Échéance {formatDate(ob.dateFinPrevue)}
                      </span>
                    )}
                    {ob.template && (
                      <span className="text-primary-500 dark:text-primary-400">{ob.template.nom}</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary-500 dark:group-hover:text-primary-400 mt-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pagination */}
        {meta && (
          <Pagination
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={setPage}
            itemLabel="onboarding(s)"
          />
        )}
    </div>
  );
}
