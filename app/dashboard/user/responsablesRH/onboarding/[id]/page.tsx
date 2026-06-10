"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, CheckCircle2, Clock, XCircle,
  PauseCircle, AlertTriangle, Hash, Mail, Briefcase,
  User, Calendar, FileText, ChevronDown, ChevronUp,
  Square, Minus, UserCheck,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────────────── */
type StatutOnboarding = "EN_COURS" | "TERMINE" | "SUSPENDU" | "ANNULE";
type StatutEtape      = "EN_ATTENTE" | "FAIT" | "IGNORE";
type TypeEtape =
  | "SIGNATURE_CONTRAT" | "REMISE_MATERIEL" | "FORMATION"
  | "AFFECTATION" | "ACCES_SYSTEME" | "PRESENTATION" | "AUTRE";

interface EtapeOnboarding {
  id: number;
  ordre: number;
  titre: string;
  description: string | null;
  type: TypeEtape;
  statut: StatutEtape;
  obligatoire: boolean;
  dateLimite: string | null;
  dateFaite: string | null;
  commentaire: string | null;
  responsableId: number | null;
}

interface OnboardingDetail {
  id: number;
  statut: StatutOnboarding;
  progressionPct: number;
  dateDebut: string;
  dateFinPrevue: string | null;
  dateCloture: string | null;
  notes: string | null;
  profilRH: {
    id: number;
    matricule: string;
    emailProfessionnel: string | null;
    fonction: string | null;
    service: string | null;
    departement: string | null;
    typeContrat: string | null;
    dateEmbauche: string | null;
    gestionnaire: {
      member: { nom: string; prenom: string; email: string; telephone: string | null };
    };
  };
  candidature: {
    id: number;
    nomCandidat: string;
    prenomCandidat: string;
    email: string | null;
    scoreCandidat: number | null;
    dateCandidature: string;
    poste: { id: number; reference: string | null; titre: string; departement: string | null; typeContrat: string | null } | null;
  };
  template: { id: number; nom: string } | null;
  etapes: EtapeOnboarding[];
}

interface ApiResponse {
  data: OnboardingDetail;
  meta: {
    totalEtapes: number;
    etapesFaites: number;
    etapesObligatoires: number;
    etapesEnRetard: number;
    progressionPct: number;
  };
}

/* ─── Helpers ────────────────────────────────────────────────── */
const TYPE_CONFIG: Record<TypeEtape, { label: string; color: string }> = {
  SIGNATURE_CONTRAT: { label: "Signature contrat",  color: "text-purple-600 bg-purple-50" },
  REMISE_MATERIEL:   { label: "Remise matériel",     color: "text-orange-600 bg-orange-50" },
  FORMATION:         { label: "Formation",           color: "text-blue-600 bg-blue-50"    },
  AFFECTATION:       { label: "Affectation",         color: "text-teal-600 bg-teal-50"    },
  ACCES_SYSTEME:     { label: "Accès système",       color: "text-gray-600 bg-gray-100"   },
  PRESENTATION:      { label: "Présentation équipe", color: "text-pink-600 bg-pink-50"    },
  AUTRE:             { label: "Autre",               color: "text-gray-500 bg-gray-50"    },
};

const STATUT_OB_CONFIG: Record<StatutOnboarding, { label: string; color: string }> = {
  EN_COURS:  { label: "En cours",  color: "bg-blue-100 text-blue-700"     },
  TERMINE:   { label: "Terminé",   color: "bg-green-100 text-green-700"   },
  SUSPENDU:  { label: "Suspendu",  color: "bg-yellow-100 text-yellow-700" },
  ANNULE:    { label: "Annulé",    color: "bg-red-100 text-red-700"       },
};

function ProgressBar({ value }: { value: number }) {
  const color = value === 100 ? "bg-green-500" : value >= 50 ? "bg-blue-500" : "bg-orange-400";
  return (
    <div className="w-full bg-gray-100 rounded-full h-3">
      <div className={`${color} h-3 rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
    </div>
  );
}

/* ─── Carte étape ────────────────────────────────────────────── */
function EtapeCard({
  etape, onboardingId, onboarding, onRefetch,
}: {
  etape: EtapeOnboarding;
  onboardingId: number;
  onboarding: OnboardingDetail;
  onRefetch: () => void;
}) {
  const [open, setOpen]           = useState(false);
  const [commentaire, setCommentaire] = useState(etape.commentaire ?? "");

  const { mutate, loading } = useMutation<{ data: { etape: EtapeOnboarding } }, { statut: StatutEtape; commentaire?: string }>(
    `/api/responsableRH/onboarding/${onboardingId}/etapes/${etape.id}`,
    "PATCH"
  );

  const isEnRetard = etape.statut === "EN_ATTENTE" && etape.dateLimite && new Date(etape.dateLimite) < new Date();
  const typeCfg    = TYPE_CONFIG[etape.type];
  const isEnCours  = onboarding.statut === "EN_COURS";

  async function handleAction(statut: StatutEtape) {
    const res = await mutate({ statut, commentaire: commentaire || undefined });
    if (res) {
      toast.success(
        statut === "FAIT"      ? "Étape marquée comme faite ✓" :
        statut === "IGNORE"    ? "Étape ignorée" :
                                 "Étape réouverte"
      );
      onRefetch();
    }
  }

  return (
    <div className={`bg-white rounded-xl border transition-all ${
      etape.statut === "FAIT"   ? "border-green-200 bg-green-50/30" :
      etape.statut === "IGNORE" ? "border-gray-200 opacity-60"      :
      isEnRetard                ? "border-red-200"                  :
                                  "border-gray-200"
    }`}>
      <div className="flex items-center gap-3 p-4">
        <div className="shrink-0">
          {etape.statut === "FAIT"   ? <CheckCircle2  className="w-6 h-6 text-green-500" /> :
           etape.statut === "IGNORE" ? <Minus         className="w-6 h-6 text-gray-400" /> :
           isEnRetard                ? <AlertTriangle className="w-6 h-6 text-red-500"  /> :
                                       <Square        className="w-6 h-6 text-gray-300" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeCfg.color}`}>
              {typeCfg.label}
            </span>
            {!etape.obligatoire && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Optionnel</span>
            )}
            {isEnRetard && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">En retard</span>
            )}
          </div>
          <p className={`font-medium text-gray-900 mt-0.5 ${etape.statut === "FAIT" ? "line-through text-gray-500" : ""}`}>
            {etape.ordre}. {etape.titre}
          </p>
          <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
            {etape.dateLimite && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Limite : {formatDate(etape.dateLimite)}
              </span>
            )}
            {etape.dateFaite && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3 h-3" />
                Fait le {formatDate(etape.dateFaite)}
              </span>
            )}
          </div>
        </div>

        {isEnCours && (
          <div className="flex items-center gap-2 shrink-0">
            {etape.statut !== "FAIT" && (
              <button
                onClick={() => handleAction("FAIT")}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Fait
              </button>
            )}
            {etape.statut === "FAIT" && (
              <button
                onClick={() => handleAction("EN_ATTENTE")}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Rouvrir
              </button>
            )}
            <button
              onClick={() => setOpen(!open)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        )}
        {!isEnCours && (
          <button
            onClick={() => setOpen(!open)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {etape.description && (
            <p className="text-sm text-gray-600">{etape.description}</p>
          )}
          {isEnCours && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Commentaire</label>
                <textarea
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  rows={2}
                  placeholder="Ajouter une note…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              {etape.statut !== "IGNORE" && (
                <button
                  onClick={() => handleAction("IGNORE")}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  <Minus className="w-3.5 h-3.5" />
                  Marquer comme non applicable
                </button>
              )}
              {etape.statut === "IGNORE" && (
                <button
                  onClick={() => handleAction("EN_ATTENTE")}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50"
                >
                  Réactiver cette étape
                </button>
              )}
            </>
          )}
          {!isEnCours && etape.commentaire && (
            <p className="text-sm text-gray-500 italic">{etape.commentaire}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────────── */
export default function RHOnboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const { data: res, loading, refetch } = useApi<ApiResponse>(`/api/responsableRH/onboarding/${id}`);

  const onboarding = res?.data;
  const meta       = res?.meta;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <XCircle className="w-10 h-10 text-red-400" />
        <p className="text-gray-600">Onboarding introuvable</p>
        <Link href="/dashboard/user/responsablesRH/onboarding" className="text-indigo-600 hover:underline text-sm">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const nom      = `${onboarding.profilRH.gestionnaire.member.prenom} ${onboarding.profilRH.gestionnaire.member.nom}`;
  const obCfg    = STATUT_OB_CONFIG[onboarding.statut];
  const enRetard = onboarding.statut === "EN_COURS" && onboarding.dateFinPrevue && new Date(onboarding.dateFinPrevue) < new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/user/responsablesRH/onboarding" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{nom}</h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${obCfg.color}`}>
                  {obCfg.label}
                </span>
                {enRetard && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    <AlertTriangle className="w-3 h-3" />En retard
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Onboarding #{onboarding.id} · Démarré le {formatDate(onboarding.dateDebut)}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {onboarding.statut === "SUSPENDU" && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg">
                <PauseCircle className="w-4 h-4" />
                Suspendu par l&apos;admin
              </span>
            )}
            <button onClick={() => refetch()} className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Progression globale */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900">Progression de l&apos;intégration</p>
            <span className="text-2xl font-bold text-indigo-600">{meta?.progressionPct ?? onboarding.progressionPct}%</span>
          </div>
          <ProgressBar value={meta?.progressionPct ?? onboarding.progressionPct} />
          <div className="flex gap-6 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              {meta?.etapesFaites ?? 0} / {meta?.etapesObligatoires ?? 0} étapes obligatoires
            </span>
            {(meta?.etapesEnRetard ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertTriangle className="w-3.5 h-3.5" />{meta?.etapesEnRetard} en retard
              </span>
            )}
            {onboarding.dateFinPrevue && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />Échéance {formatDate(onboarding.dateFinPrevue)}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Checklist */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Checklist d&apos;intégration
              {onboarding.template && (
                <span className="text-xs font-normal text-indigo-500 normal-case">· {onboarding.template.nom}</span>
              )}
            </h2>

            {onboarding.etapes.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                Aucune étape définie
              </div>
            )}

            {onboarding.etapes.map((etape) => (
              <EtapeCard
                key={etape.id}
                etape={etape}
                onboardingId={onboarding.id}
                onboarding={onboarding}
                onRefetch={refetch}
              />
            ))}
          </div>

          {/* Infos collaborateur */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />Collaborateur
              </h3>
              <div className="space-y-2">
                <p className="font-semibold text-gray-900">{nom}</p>
                <div className="space-y-1.5 text-sm text-gray-600">
                  <p className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-gray-400" />
                    {onboarding.profilRH.matricule}
                  </p>
                  {onboarding.profilRH.emailProfessionnel && (
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      {onboarding.profilRH.emailProfessionnel}
                    </p>
                  )}
                  {onboarding.profilRH.gestionnaire.member.email && (
                    <p className="flex items-center gap-2 text-xs text-gray-400">
                      <Mail className="w-3 h-3" />
                      {onboarding.profilRH.gestionnaire.member.email}
                    </p>
                  )}
                  {onboarding.profilRH.fonction && (
                    <p className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                      {onboarding.profilRH.fonction}
                    </p>
                  )}
                  {onboarding.profilRH.departement && (
                    <p className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      {onboarding.profilRH.departement}
                    </p>
                  )}
                  {onboarding.profilRH.dateEmbauche && (
                    <p className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      Embauche {formatDate(onboarding.profilRH.dateEmbauche)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {onboarding.candidature.poste && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />Recrutement source
                </h3>
                <div className="space-y-1.5 text-sm text-gray-600">
                  <p className="font-medium text-gray-800">{onboarding.candidature.poste.titre}</p>
                  {onboarding.candidature.poste.reference && (
                    <p className="text-xs text-gray-400">{onboarding.candidature.poste.reference}</p>
                  )}
                  {onboarding.candidature.poste.departement && (
                    <p>{onboarding.candidature.poste.departement}</p>
                  )}
                  {onboarding.candidature.scoreCandidat !== null && (
                    <p className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">Score :</span>
                      <span className="font-semibold text-indigo-600">{onboarding.candidature.scoreCandidat}/100</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Légende</h3>
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Étape faite</div>
                <div className="flex items-center gap-2"><Square        className="w-3.5 h-3.5 text-gray-300" />En attente</div>
                <div className="flex items-center gap-2"><Minus         className="w-3.5 h-3.5 text-gray-400" />Non applicable</div>
                <div className="flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-red-500"  />En retard</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
