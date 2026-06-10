"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Search, RefreshCw, UserPlus, ClipboardList,
  CheckCircle2, Clock, PauseCircle, XCircle, ChevronRight,
  Briefcase, Mail, Hash, AlertTriangle, Filter,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";

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
const STATUT_CONFIG: Record<StatutOnboarding, { label: string; color: string; icon: React.ReactNode }> = {
  EN_COURS:  { label: "En cours",  color: "bg-blue-100 text-blue-700",     icon: <Clock        className="w-3 h-3" /> },
  TERMINE:   { label: "Terminé",   color: "bg-green-100 text-green-700",   icon: <CheckCircle2 className="w-3 h-3" /> },
  SUSPENDU:  { label: "Suspendu",  color: "bg-yellow-100 text-yellow-700", icon: <PauseCircle  className="w-3 h-3" /> },
  ANNULE:    { label: "Annulé",    color: "bg-red-100 text-red-700",       icon: <XCircle      className="w-3 h-3" /> },
};

function ProgressBar({ value }: { value: number }) {
  const color = value === 100 ? "bg-green-500" : value >= 50 ? "bg-blue-500" : "bg-orange-400";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${value}%` }} />
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function RHOnboardingPage() {
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<StatutOnboarding | "">("");
  const [page,   setPage]   = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  if (statut) params.set("statut", statut);

  const { data: res, loading, refetch } = useApi<ApiResponse>(
    `/api/responsableRH/onboarding?${params}`
  );

  const onboardings = res?.data ?? [];
  const meta        = res?.meta;
  const stats       = res?.stats ?? {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/dashboard/user/responsablesRH" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <ClipboardList className="w-6 h-6 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Onboarding</h1>
        </div>
        <p className="text-sm text-gray-500 ml-14">Suivi de l&apos;intégration des nouveaux collaborateurs</p>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["EN_COURS", "TERMINE", "SUSPENDU", "ANNULE"] as StatutOnboarding[]).map((s) => {
            const cfg = STATUT_CONFIG[s];
            return (
              <div key={s} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${cfg.color}`}>{cfg.icon}</div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats[s] ?? 0}</p>
                  <p className="text-xs text-gray-500">{cfg.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un collaborateur…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statut}
              onChange={(e) => { setStatut(e.target.value as StatutOnboarding | ""); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tous les statuts</option>
              {(Object.keys(STATUT_CONFIG) as StatutOnboarding[]).map((s) => (
                <option key={s} value={s}>{STATUT_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Liste */}
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Chargement…
            </div>
          )}

          {!loading && onboardings.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <UserPlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucun onboarding trouvé</p>
            </div>
          )}

          {onboardings.map((ob) => {
            const cfg      = STATUT_CONFIG[ob.statut];
            const nom      = `${ob.profilRH.gestionnaire.member.prenom} ${ob.profilRH.gestionnaire.member.nom}`;
            const enRetard = ob.statut === "EN_COURS" && ob.dateFinPrevue && new Date(ob.dateFinPrevue) < new Date();

            return (
              <Link
                key={ob.id}
                href={`/dashboard/user/responsablesRH/onboarding/${ob.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 truncate">{nom}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                      {enRetard && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3" />En retard
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
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
                          <Briefcase className="w-3 h-3" />{ob.candidature.poste.titre}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <ProgressBar value={ob.progressionPct} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-10 text-right">
                        {ob.progressionPct}%
                      </span>
                      <span className="text-xs text-gray-400">{ob._count.etapes} étapes</span>
                    </div>
                  </div>

                  <div className="text-right text-xs text-gray-400 shrink-0 flex flex-col items-end gap-1">
                    <span>Début {formatDate(ob.dateDebut)}</span>
                    {ob.dateFinPrevue && (
                      <span className={enRetard ? "text-red-500 font-medium" : ""}>
                        Échéance {formatDate(ob.dateFinPrevue)}
                      </span>
                    )}
                    {ob.template && (
                      <span className="text-indigo-500">{ob.template.nom}</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 mt-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex justify-center items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Précédent
            </button>
            <span className="text-sm text-gray-600">Page {page} / {meta.totalPages}</span>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
