"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Briefcase, TrendingUp, ArrowLeft, RefreshCw, DollarSign,
  PieChart, Users, Calendar, Building2, Clock, CreditCard as CreditCardIcon,
  BarChart3, LucideIcon, FileText, Star, Target, CheckCircle,
  ThumbsUp, ThumbsDown, Minus, ChevronDown, ChevronUp, AlertCircle, Loader2,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";

// ============================================================================
// TYPES
// ============================================================================

interface VentesResponse {
  stats: { totalVentes: number; montantTotal: number | string; clientsActifs: number };
}
interface StockResponse {
  stats: { totalProduits: number; enRupture: number; stockFaible: number; valeurTotale: number | string };
}
interface CreditsResponse {
  stats: {
    totalActifs: number; totalEpuises: number; totalExpires: number;
    montantTotalPlafond: number | string; montantTotalUtilise: number | string; montantTotalRestant: number | string;
  };
}
interface CotisationsResponse {
  stats: { totalCotisations: number; montantTotal: number | string; enAttente: number; payees: number };
}

interface Tontine {
  id: number;
  nom: string;
  description: string | null;
  montantCycle: string;
  frequence: string;
  dateDebut: string;
  dateFin: string | null;
  membres: { id: number; client: { id: number; nom: string; prenom: string } }[];
}
interface TontinesResponse { data: Tontine[] }

interface Dividende {
  id: number;
  periode: string;
  montantTotal: string;
  montantParPart: string | null;
  dateVersement: string | null;
  statut: "PLANIFIE" | "EN_COURS" | "VERSE" | "ANNULE";
  notes: string | null;
}
interface DividendesResponse { data: Dividende[]; totalVerse: number }

interface Vote {
  id: number;
  decision: "POUR" | "CONTRE" | "ABSTENTION";
}
interface Resolution {
  id: number;
  numero: number;
  titre: string;
  description: string | null;
  statut: "EN_ATTENTE" | "APPROUVEE" | "REJETEE";
  votes: Vote[];
}
interface Participant {
  id: number;
  statut: "INVITE" | "CONFIRME" | "ABSENT" | "PRESENT";
}
interface Assemblee {
  id: number;
  titre: string;
  description: string | null;
  type: "AGO" | "AGE" | "CS" | "CA";
  statut: "PLANIFIEE" | "EN_COURS" | "TERMINEE" | "ANNULEE";
  dateAssemblee: string;
  lieu: string;
  ordreJour: string | null;
  resolutions: Resolution[];
  participants: Participant[];
  _count: { participants: number };
}
interface AssembleesResponse { data: Assemblee[]; gestionnaireId: number | null }

// ============================================================================
// HELPERS
// ============================================================================

const statutDividendeLabel: Record<Dividende["statut"], { label: string; cls: string }> = {
  PLANIFIE:  { label: "Planifié",  cls: "bg-blue-100 text-blue-700" },
  EN_COURS:  { label: "En cours",  cls: "bg-amber-100 text-amber-700" },
  VERSE:     { label: "Versé",     cls: "bg-emerald-100 text-emerald-700" },
  ANNULE:    { label: "Annulé",    cls: "bg-red-100 text-red-700" },
};

const statutAssembleeLabel: Record<Assemblee["statut"], { label: string; cls: string }> = {
  PLANIFIEE: { label: "Planifiée", cls: "bg-blue-100 text-blue-700" },
  EN_COURS:  { label: "En cours",  cls: "bg-amber-100 text-amber-700" },
  TERMINEE:  { label: "Terminée",  cls: "bg-slate-100 text-slate-600" },
  ANNULEE:   { label: "Annulée",   cls: "bg-red-100 text-red-700" },
};

const typeAssembleeLabel: Record<Assemblee["type"], string> = {
  AGO: "AGO", AGE: "AGE", CS: "CS", CA: "CA",
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const StatCard = ({ label, value, subtitle, icon: Icon, color, lightBg }: {
  label: string; value: string; subtitle?: string; icon: LucideIcon; color: string; lightBg: string;
}) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
    <div className="flex items-start justify-between mb-4">
      <div className={`${lightBg} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
        <Icon className={`${color} w-6 h-6`} />
      </div>
    </div>
    <h3 className="text-slate-600 text-sm font-medium mb-1">{label}</h3>
    <p className="text-3xl font-bold text-slate-800">{value}</p>
    {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
  </div>
);

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ActionnairePage() {
  const [activeTab, setActiveTab] = useState<"rapports" | "dividendes" | "assemblees" | "projets">("rapports");
  const [expandedAssemblee, setExpandedAssemblee] = useState<number | null>(null);

  // ── Données financières ─────────────────────────────────────────────────────
  const { data: ventesResponse, loading: ventesLoading } = useApi<VentesResponse>("/api/admin/ventes?limit=1");
  const { data: stockResponse } = useApi<StockResponse>("/api/admin/stock?limit=1");
  const { data: creditsResponse } = useApi<CreditsResponse>("/api/admin/creditsAlimentaires?limit=1");
  const { data: cotisationsResponse } = useApi<CotisationsResponse>("/api/admin/cotisations?limit=1");
  const { data: tontinesResponse, refetch: refetchTontines } = useApi<TontinesResponse>("/api/admin/tontines");

  // ── Dividendes ─────────────────────────────────────────────────────────────
  const { data: dividendesResponse, loading: dividendesLoading, refetch: refetchDividendes } =
    useApi<DividendesResponse>("/api/actionnaire/dividendes");

  // ── Assemblées ─────────────────────────────────────────────────────────────
  const { data: assemResponse, loading: assemLoading, refetch: refetchAssemblees } =
    useApi<AssembleesResponse>("/api/actionnaire/assemblees");

  // ── Mutations dynamiques (URL pilotée par état) ────────────────────────────
  // Pattern : on stocke la cible dans un état ; useEffect déclenche mutate
  // une fois que le composant s'est re-rendu avec la bonne URL.

  const [pendingParticiId, setPendingParticiId] = useState<number | null>(null);
  const { mutate: doParticiper, loading: confirmLoading } = useMutation<unknown, Record<string, never>>(
    pendingParticiId !== null
      ? `/api/actionnaire/assemblees/${pendingParticiId}/participer`
      : "",
    "POST",
    { successMessage: "Participation confirmée !" }
  );
  useEffect(() => {
    if (pendingParticiId === null) return;
    doParticiper({}).then(() => {
      setPendingParticiId(null);
      refetchAssemblees();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingParticiId]);

  const [pendingVote, setPendingVote] = useState<{ resolutionId: number; decision: string } | null>(null);
  const { mutate: doVoter, loading: voteLoading } = useMutation<unknown, { decision: string }>(
    pendingVote !== null
      ? `/api/actionnaire/resolutions/${pendingVote.resolutionId}/voter`
      : "",
    "POST",
    { successMessage: "Vote enregistré !" }
  );
  useEffect(() => {
    if (pendingVote === null) return;
    doVoter({ decision: pendingVote.decision }).then(() => {
      setPendingVote(null);
      refetchAssemblees();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVote]);

  // ── Données calculées ──────────────────────────────────────────────────────
  const ventesStats = ventesResponse?.stats;
  const stockStats = stockResponse?.stats;
  const creditsStats = creditsResponse?.stats;
  const cotisationsStats = cotisationsResponse?.stats;
  const tontines = tontinesResponse?.data ?? [];
  const tontinesActives = tontines.filter((t) => !t.dateFin || new Date(t.dateFin) > new Date());

  const valeurPortefeuille =
    Number(stockStats?.valeurTotale ?? 0) +
    Number(cotisationsStats?.montantTotal ?? 0) +
    Number(creditsStats?.montantTotalPlafond ?? 0);

  const dividendes = dividendesResponse?.data ?? [];
  const totalVerse = dividendesResponse?.totalVerse ?? 0;

  const assemblees = assemResponse?.data ?? [];
  const gestionnaireId = assemResponse?.gestionnaireId ?? null;
  const prochaines = assemblees.filter((a) => a.statut !== "TERMINEE" && a.statut !== "ANNULEE");
  const passees = assemblees.filter((a) => a.statut === "TERMINEE" || a.statut === "ANNULEE");

  const isLoading = ventesLoading && !ventesResponse;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleParticiper = useCallback((assembleeId: number) => {
    setPendingParticiId(assembleeId);
  }, []);

  const handleVoter = useCallback((resolutionId: number, decision: string) => {
    setPendingVote({ resolutionId, decision });
  }, []);

  const handleRefreshAll = useCallback(() => {
    refetchTontines();
    refetchDividendes();
    refetchAssemblees();
  }, [refetchTontines, refetchDividendes, refetchAssemblees]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Valeur Portefeuille", value: formatCurrency(valeurPortefeuille), icon: Briefcase, color: "text-indigo-500", lightBg: "bg-indigo-50" },
    { label: "Revenus Cotisations", value: formatCurrency(cotisationsStats?.montantTotal ?? 0), subtitle: `${cotisationsStats?.totalCotisations ?? 0} cotisations`, icon: DollarSign, color: "text-emerald-500", lightBg: "bg-emerald-50" },
    { label: "Crédits Actifs", value: String(creditsStats?.totalActifs ?? 0), subtitle: formatCurrency(creditsStats?.montantTotalPlafond ?? 0), icon: CreditCardIcon, color: "text-blue-500", lightBg: "bg-blue-50" },
    { label: "Tontines Actives", value: String(tontinesActives.length), subtitle: `${tontines.length} au total`, icon: Users, color: "text-purple-500", lightBg: "bg-purple-50" },
  ];

  const tabs = [
    { key: "rapports" as const, label: "Rapports Financiers", icon: BarChart3 },
    { key: "dividendes" as const, label: "Dividendes", icon: DollarSign },
    { key: "assemblees" as const, label: "Assemblées", icon: Calendar },
    { key: "projets" as const, label: "Projets", icon: Target },
  ];

  // ── Render résolutions d'une assemblée ─────────────────────────────────────
  const renderResolutions = (assemblee: Assemblee) => {
    const myParticipation = assemblee.participants[0] ?? null;
    const peutVoter =
      myParticipation !== null &&
      (assemblee.statut === "PLANIFIEE" || assemblee.statut === "EN_COURS");

    if (assemblee.resolutions.length === 0) {
      return (
        <p className="text-slate-400 text-sm italic text-center py-4">
          Aucune résolution publiée pour cette assemblée.
        </p>
      );
    }

    return (
      <div className="space-y-3 mt-4">
        {assemblee.resolutions.map((res) => {
          const monVote = res.votes[0] ?? null;
          return (
            <div key={res.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-bold text-indigo-600 mr-2">Résolution {res.numero}</span>
                  <span className="font-semibold text-slate-800 text-sm">{res.titre}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  res.statut === "APPROUVEE" ? "bg-emerald-100 text-emerald-700" :
                  res.statut === "REJETEE"   ? "bg-red-100 text-red-700" :
                  "bg-slate-100 text-slate-500"
                }`}>
                  {res.statut === "APPROUVEE" ? "Approuvée" : res.statut === "REJETEE" ? "Rejetée" : "En attente"}
                </span>
              </div>
              {res.description && (
                <p className="text-xs text-slate-500 mb-3">{res.description}</p>
              )}

              {/* Vote rendu */}
              {monVote && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-500">Mon vote :</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    monVote.decision === "POUR"       ? "bg-emerald-100 text-emerald-700" :
                    monVote.decision === "CONTRE"     ? "bg-red-100 text-red-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {monVote.decision === "POUR" ? "Pour" : monVote.decision === "CONTRE" ? "Contre" : "Abstention"}
                  </span>
                </div>
              )}

              {/* Boutons vote */}
              {peutVoter && !monVote && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleVoter(res.id, "POUR")}
                    disabled={voteLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ThumbsUp size={13} /> Pour
                  </button>
                  <button
                    onClick={() => handleVoter(res.id, "CONTRE")}
                    disabled={voteLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ThumbsDown size={13} /> Contre
                  </button>
                  <button
                    onClick={() => handleVoter(res.id, "ABSTENTION")}
                    disabled={voteLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Minus size={13} /> Abstention
                  </button>
                </div>
              )}

              {/* Pas encore invité */}
              {!myParticipation && peutVoter === false && assemblee.statut !== "TERMINEE" && assemblee.statut !== "ANNULEE" && (
                <p className="text-xs text-amber-600 italic mt-1">Vous n&apos;êtes pas encore invité à cette assemblée.</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render une carte d'assemblée ───────────────────────────────────────────
  const renderAssemblee = (assemblee: Assemblee) => {
    const myParticipation = assemblee.participants[0] ?? null;
    const isExpanded = expandedAssemblee === assemblee.id;
    const isPast = assemblee.statut === "TERMINEE" || assemblee.statut === "ANNULEE";
    const { label: sLabel, cls: sCls } = statutAssembleeLabel[assemblee.statut];
    const peutConfirmer =
      gestionnaireId !== null &&
      (!myParticipation || myParticipation.statut === "INVITE") &&
      !isPast;

    return (
      <div key={assemblee.id} className={`rounded-xl border transition-all ${isPast ? "border-slate-200 bg-slate-50/50 opacity-70" : "border-slate-200 bg-white hover:border-indigo-300"}`}>
        <div
          className="p-5 cursor-pointer flex items-start justify-between gap-4"
          onClick={() => setExpandedAssemblee(isExpanded ? null : assemblee.id)}
        >
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={`${isPast ? "bg-slate-100" : "bg-indigo-100"} rounded-xl p-3 flex-shrink-0`}>
              <Building2 className={`${isPast ? "text-slate-400" : "text-indigo-600"} w-5 h-5`} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h4 className="font-bold text-slate-800 text-sm">{assemblee.titre}</h4>
                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
                  {typeAssembleeLabel[assemblee.type]}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${sCls}`}>{sLabel}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(assemblee.dateAssemblee)}</span>
                <span className="flex items-center gap-1"><Building2 size={12} />{assemblee.lieu}</span>
                <span className="flex items-center gap-1"><Users size={12} />{assemblee._count.participants} participant(s)</span>
              </div>
              {myParticipation && (
                <div className="mt-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    myParticipation.statut === "CONFIRME" || myParticipation.statut === "PRESENT"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {myParticipation.statut === "CONFIRME" ? "Participation confirmée" :
                     myParticipation.statut === "PRESENT"  ? "Présent" :
                     myParticipation.statut === "ABSENT"   ? "Absent" : "Invité"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {peutConfirmer && (
              <button
                onClick={(e) => { e.stopPropagation(); handleParticiper(assemblee.id); }}
                disabled={confirmLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {confirmLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                Confirmer
              </button>
            )}
            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </div>
        </div>

        {/* Résolutions expandées */}
        {isExpanded && (
          <div className="px-5 pb-5 border-t border-slate-100">
            {assemblee.ordreJour && (
              <div className="mt-4 mb-3 p-3 bg-indigo-50 rounded-lg">
                <p className="text-xs font-semibold text-indigo-700 mb-1">Ordre du jour</p>
                <p className="text-xs text-indigo-600 whitespace-pre-line">{assemblee.ordreJour}</p>
              </div>
            )}
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4 mb-1">
              Résolutions à voter
            </h5>
            {renderResolutions(assemblee)}
          </div>
        )}
      </div>
    );
  };

  // ── Rendu principal ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/20 font-['DM_Sans',sans-serif]">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                Espace Actionnaire
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">A</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Tableau de Bord — Actionnaire</h2>
            <p className="text-slate-500">Vue d&apos;ensemble de vos investissements et performances</p>
          </div>
          <button
            onClick={handleRefreshAll}
            className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium"
          >
            <RefreshCw size={18} />
            Actualiser
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((stat, i) => <StatCard key={i} {...stat} />)}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 flex gap-1 flex-wrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ================================================================ */}
        {/* TAB: Rapports Financiers                                          */}
        {/* ================================================================ */}
        {activeTab === "rapports" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-8 text-white shadow-lg shadow-indigo-200">
              <h3 className="text-lg font-semibold text-indigo-100 mb-6">Indicateurs Clés de Performance</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-indigo-200 text-sm">Revenus Cotisations</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(cotisationsStats?.montantTotal ?? 0)}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Montant Crédits</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(creditsStats?.montantTotalPlafond ?? 0)}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Valeur Stock</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(stockStats?.valeurTotale ?? 0)}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Chiffre Ventes</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(ventesStats?.montantTotal ?? 0)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <PieChart size={20} className="text-indigo-600" />
                  Répartition Financière
                </h3>
                <div className="space-y-4">
                  {[
                    { label: "Cotisations", value: Number(cotisationsStats?.montantTotal ?? 0), color: "bg-emerald-500" },
                    { label: "Crédits Alimentaires", value: Number(creditsStats?.montantTotalPlafond ?? 0), color: "bg-blue-500" },
                    { label: "Stock", value: Number(stockStats?.valeurTotale ?? 0), color: "bg-indigo-500" },
                    { label: "Ventes", value: Number(ventesStats?.montantTotal ?? 0), color: "bg-purple-500" },
                  ].map((item, i) => {
                    const total = valeurPortefeuille + Number(ventesStats?.montantTotal ?? 0);
                    const pct = total > 0 ? (item.value / total) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-600">{item.label}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(item.value)}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-emerald-600" />
                  Statistiques Clés
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Total Ventes", value: ventesStats?.totalVentes ?? 0 },
                    { label: "Produits en Stock", value: stockStats?.totalProduits ?? 0 },
                    { label: "Cotisations Payées", value: cotisationsStats?.payees ?? 0 },
                    { label: "Crédits Actifs", value: creditsStats?.totalActifs ?? 0 },
                    { label: "Tontines Actives", value: tontinesActives.length },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                      <span className="text-slate-600 text-sm">{row.label}</span>
                      <span className="font-bold text-slate-800">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Dividendes                                                   */}
        {/* ================================================================ */}
        {activeTab === "dividendes" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-emerald-100 text-sm">Total Dividendes Versés</p>
                  <p className="text-3xl font-bold">{formatCurrency(totalVerse)}</p>
                </div>
              </div>
              <p className="text-emerald-100 text-sm">
                {dividendes.filter((d) => d.statut === "VERSE").length} versement(s) effectué(s)
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText size={20} className="text-indigo-600" />
                  Historique des Dividendes
                </h3>
                {dividendesLoading && <Loader2 size={18} className="animate-spin text-slate-400" />}
              </div>

              {dividendes.length === 0 && !dividendesLoading ? (
                <div className="p-12 text-center">
                  <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">Aucun dividende enregistré pour le moment.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Période</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Montant Total</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Par Part</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date de Versement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dividendes.map((div) => {
                        const { label, cls } = statutDividendeLabel[div.statut];
                        return (
                          <tr key={div.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-800">{div.periode}</td>
                            <td className="px-6 py-4 font-bold text-emerald-600">{formatCurrency(div.montantTotal)}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {div.montantParPart ? formatCurrency(div.montantParPart) : "—"}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`${cls} px-3 py-1 rounded-full text-xs font-bold`}>{label}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {div.dateVersement ? formatDate(div.dateVersement) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <Star className="text-indigo-600 w-6 h-6 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-indigo-800">Information</h4>
                  <p className="text-sm text-indigo-700 mt-1">
                    Les dividendes sont calculés et versés selon les décisions prises lors des assemblées générales.
                    Consultez l&apos;onglet Assemblées pour suivre les résolutions liées aux distributions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Assemblées                                                   */}
        {/* ================================================================ */}
        {activeTab === "assemblees" && (
          <div className="space-y-6">
            {/* Prochaines */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Calendar size={20} className="text-indigo-600" />
                  Prochaines Assemblées
                  <span className="ml-1 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {prochaines.length}
                  </span>
                </h3>
                {assemLoading && <Loader2 size={18} className="animate-spin text-slate-400" />}
              </div>

              {prochaines.length === 0 && !assemLoading ? (
                <div className="text-center py-8">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">Aucune assemblée planifiée.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {prochaines.map(renderAssemblee)}
                </div>
              )}
            </div>

            {/* Passées */}
            {passees.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-5">
                  <Clock size={20} className="text-slate-400" />
                  Assemblées Passées
                  <span className="ml-1 bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">
                    {passees.length}
                  </span>
                </h3>
                <div className="space-y-3">
                  {passees.map(renderAssemblee)}
                </div>
              </div>
            )}

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <Clock className="text-indigo-600 w-6 h-6 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-indigo-800">Participation & Vote</h4>
                  <p className="text-sm text-indigo-700 mt-1">
                    Cliquez sur une assemblée pour voir les résolutions et voter.
                    Vous devez d&apos;abord confirmer votre participation pour pouvoir voter sur les résolutions.
                    Les convocations vous sont envoyées via les notifications.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Projets (Tontines)                                           */}
        {/* ================================================================ */}
        {activeTab === "projets" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Target size={24} />
                </div>
                <div>
                  <p className="text-purple-100 text-sm">Tontines Actives</p>
                  <p className="text-3xl font-bold">{tontinesActives.length}</p>
                </div>
              </div>
              <p className="text-purple-100 text-sm">
                {tontines.length} tontines au total — {tontines.reduce((sum, t) => sum + t.membres.length, 0)} membres
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {tontines.map((tontine) => {
                const isActive = !tontine.dateFin || new Date(tontine.dateFin) > new Date();
                return (
                  <div key={tontine.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`${isActive ? "bg-purple-100" : "bg-slate-100"} rounded-xl p-3`}>
                          <Users className={`${isActive ? "text-purple-600" : "text-slate-400"} w-6 h-6`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">{tontine.nom}</h4>
                          {tontine.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{tontine.description}</p>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {isActive ? "Active" : "Terminée"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "Montant/cycle", value: formatCurrency(tontine.montantCycle) },
                        { label: "Fréquence", value: tontine.frequence },
                        { label: "Membres", value: String(tontine.membres.length) },
                        { label: "Début", value: formatDate(tontine.dateDebut) },
                        ...(tontine.dateFin ? [{ label: "Fin", value: formatDate(tontine.dateFin) }] : []),
                      ].map((row, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-slate-600">{row.label}</span>
                          <span className="font-semibold text-slate-800">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {tontines.length === 0 && (
                <div className="col-span-full bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
                  <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Aucune tontine enregistrée</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
