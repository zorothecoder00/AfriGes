"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Briefcase, TrendingUp, ArrowLeft, RefreshCw, DollarSign,
  PieChart, Users, Calendar, Building2, Clock, Package,
  BarChart3, LucideIcon, FileText, Star, Target, CheckCircle,
  ThumbsUp, ThumbsDown, Minus, ChevronDown, ChevronUp, AlertCircle,
  Loader2, User, Shield, BookOpen, Download, ArrowUpRight, ArrowDownRight,
  Repeat, Settings2, ExternalLink, TrendingDown, Info, Lock, Globe,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";

// ============================================================================
// TYPES
// ============================================================================

interface ActionnaireStatsResponse {
  packsStats: { total: number; parType: Record<string, number> };
  souscriptionsStats: {
    total: number; actives: number; completes: number; annulees: number;
    montantTotalVerse: number; montantRestant: number;
  };
  versementsStats: { count30j: number; montant30j: number };
  stockStats: { valeurTotale: number; totalProduits: number };
}

interface Dividende {
  id: number; periode: string; montantTotal: string;
  montantParPart: string | null; dateVersement: string | null;
  statut: "PLANIFIE" | "EN_COURS" | "VERSE" | "ANNULE"; notes: string | null;
}
interface DividendesResponse { data: Dividende[]; totalVerse: number }

interface Vote { id: number; decision: "POUR" | "CONTRE" | "ABSTENTION" }
interface Resolution {
  id: number; numero: number; titre: string; description: string | null;
  statut: "EN_ATTENTE" | "APPROUVEE" | "REJETEE"; votes: Vote[];
}
interface Participant {
  id: number; statut: "INVITE" | "CONFIRME" | "ABSENT" | "PRESENT";
}
interface Assemblee {
  id: number; titre: string; description: string | null;
  type: "AGO" | "AGE" | "CS" | "CA";
  statut: "PLANIFIEE" | "EN_COURS" | "TERMINEE" | "ANNULEE";
  dateAssemblee: string; lieu: string; ordreJour: string | null;
  resolutions: Resolution[]; participants: Participant[];
  _count: { participants: number };
}
interface AssembleesResponse { data: Assemblee[]; gestionnaireId: number | null }

interface ProfilResponse {
  user: { id: number; nom: string; prenom: string; email: string; createdAt: string } | null;
  profile: {
    id: number; statut: "ACTIF" | "INACTIF" | "EN_ATTENTE" | "SUSPENDU";
    typeAction: "ORDINAIRE" | "PRIVILEGIEE" | "FONDATEUR" | "PREFERENTIELLE";
    nombreActions: number; prixUnitaire: string; valeurPortefeuille: number;
    pourcentageCapital: string; dateEntree: string | null; notes: string | null;
    derniersMovements: MouvementAction[];
  } | null;
  capitalTotal: { totalActionsEmises: number };
}

interface MouvementAction {
  id: number; type: string; quantite: number;
  prixUnitaire: string; montantTotal: string; date: string; description: string | null;
}
interface MouvementsResponse { data: MouvementAction[]; evolution: unknown[]; profil: unknown }

interface Document {
  id: number; titre: string; type: string; description: string | null;
  fichierUrl: string | null; fichierNom: string | null; annee: number | null; estPublic: boolean;
  createdAt: string;
}
interface DocumentsResponse { data: Document[]; parType: Record<string, Document[]> }

// ============================================================================
// HELPERS & MAPS
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

const typePackLabel: Record<string, { label: string; color: string }> = {
  ALIMENTAIRE: { label: "Alimentaire", color: "bg-emerald-100 text-emerald-700" },
  REVENDEUR:   { label: "Revendeur",   color: "bg-blue-100 text-blue-700" },
  FAMILIAL:    { label: "Familial",    color: "bg-purple-100 text-purple-700" },
  URGENCE:     { label: "Urgence",     color: "bg-red-100 text-red-700" },
  FIDELITE:    { label: "Fidélité",    color: "bg-amber-100 text-amber-700" },
};

const statutActionnaireLabel: Record<string, { label: string; cls: string; dot: string }> = {
  ACTIF:      { label: "Actif",      cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  INACTIF:    { label: "Inactif",    cls: "bg-slate-100 text-slate-600",     dot: "bg-slate-400" },
  EN_ATTENTE: { label: "En attente", cls: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  SUSPENDU:   { label: "Suspendu",   cls: "bg-red-100 text-red-700",         dot: "bg-red-500" },
};

const typeActionLabel: Record<string, { label: string; cls: string }> = {
  ORDINAIRE:      { label: "Action Ordinaire",      cls: "bg-blue-100 text-blue-700" },
  PRIVILEGIEE:    { label: "Action Privilégiée",    cls: "bg-purple-100 text-purple-700" },
  FONDATEUR:      { label: "Action de Fondateur",   cls: "bg-amber-100 text-amber-700" },
  PREFERENTIELLE: { label: "Action Préférentielle", cls: "bg-indigo-100 text-indigo-700" },
};

const typeMouvementLabel: Record<string, { label: string; icon: LucideIcon; cls: string; sign: string }> = {
  ACHAT:              { label: "Achat",              icon: ArrowUpRight,   cls: "text-emerald-600", sign: "+" },
  CESSION:            { label: "Cession",            icon: ArrowDownRight, cls: "text-red-600",     sign: "-" },
  TRANSFERT_ENTRANT:  { label: "Transfert entrant",  icon: ArrowUpRight,   cls: "text-blue-600",    sign: "+" },
  TRANSFERT_SORTANT:  { label: "Transfert sortant",  icon: ArrowDownRight, cls: "text-orange-600",  sign: "-" },
  AJUSTEMENT:         { label: "Ajustement",         icon: Settings2,      cls: "text-slate-600",   sign: "±" },
};

const typeDocumentLabel: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  BILAN:            { label: "Bilan",              icon: BarChart3,  color: "text-blue-600 bg-blue-50" },
  COMPTE_RESULTAT:  { label: "Compte de résultat", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
  RAPPORT_ANNUEL:   { label: "Rapport annuel",     icon: BookOpen,   color: "text-indigo-600 bg-indigo-50" },
  PV_AG:            { label: "Procès-verbal AG",   icon: FileText,   color: "text-purple-600 bg-purple-50" },
  CONVOCATION:      { label: "Convocation",        icon: Calendar,   color: "text-amber-600 bg-amber-50" },
  RAPPORT_AUDIT:    { label: "Rapport d'audit",    icon: Shield,     color: "text-red-600 bg-red-50" },
  STATUTS:          { label: "Statuts",             icon: Lock,       color: "text-slate-600 bg-slate-50" },
  PLAN_STRATEGIQUE: { label: "Plan stratégique",   icon: Target,     color: "text-teal-600 bg-teal-50" },
  AUTRE:            { label: "Autre document",      icon: Globe,      color: "text-gray-600 bg-gray-50" },
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
  const [activeTab, setActiveTab] = useState<
    "profil" | "actions" | "rapports" | "dividendes" | "assemblees" | "documents" | "packs"
  >("profil");
  const [expandedAssemblee, setExpandedAssemblee] = useState<number | null>(null);
  const [showProcurationModal, setShowProcurationModal] = useState<number | null>(null);
  const [procurationNotes, setProcurationNotes] = useState("");
  const [procurationMandataireId, setProcurationMandataireId] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("TOUS");

  // ── Données ──────────────────────────────────────────────────────────────
  const { data: statsResponse, loading: statsLoading, refetch: refetchStats } =
    useApi<ActionnaireStatsResponse>("/api/actionnaire/stats");

  const { data: dividendesResponse, loading: dividendesLoading, refetch: refetchDividendes } =
    useApi<DividendesResponse>("/api/actionnaire/dividendes");

  const { data: assemResponse, loading: assemLoading, refetch: refetchAssemblees } =
    useApi<AssembleesResponse>("/api/actionnaire/assemblees");

  const { data: profilResponse, loading: profilLoading, refetch: refetchProfil } =
    useApi<ProfilResponse>("/api/actionnaire/profil");

  const { data: mouvementsResponse, loading: mouvementsLoading, refetch: refetchMouvements } =
    useApi<MouvementsResponse>("/api/actionnaire/mouvements-actions");

  const { data: documentsResponse, loading: documentsLoading, refetch: refetchDocuments } =
    useApi<DocumentsResponse>("/api/actionnaire/documents");

  // ── Mutations participation ───────────────────────────────────────────────
  const [pendingParticiId, setPendingParticiId] = useState<number | null>(null);
  const { mutate: doParticiper, loading: confirmLoading } = useMutation<unknown, Record<string, never>>(
    pendingParticiId !== null ? `/api/actionnaire/assemblees/${pendingParticiId}/participer` : "",
    "POST",
    { successMessage: "Participation confirmée !" }
  );
  useEffect(() => {
    if (pendingParticiId === null) return;
    doParticiper({}).then(() => { setPendingParticiId(null); refetchAssemblees(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingParticiId]);

  // ── Mutations vote ────────────────────────────────────────────────────────
  const [pendingVote, setPendingVote] = useState<{ resolutionId: number; decision: string } | null>(null);
  const { mutate: doVoter, loading: voteLoading } = useMutation<unknown, { decision: string }>(
    pendingVote !== null ? `/api/actionnaire/resolutions/${pendingVote.resolutionId}/voter` : "",
    "POST",
    { successMessage: "Vote enregistré !" }
  );
  useEffect(() => {
    if (pendingVote === null) return;
    doVoter({ decision: pendingVote.decision }).then(() => { setPendingVote(null); refetchAssemblees(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVote]);

  // ── Mutations procuration ─────────────────────────────────────────────────
  const [procurationAssembleeId, setProcurationAssembleeId] = useState<number | null>(null);
  const { mutate: doProcuration, loading: procurationLoading } = useMutation<
    unknown, { mandataireId: number; notes?: string }
  >(
    procurationAssembleeId !== null
      ? `/api/actionnaire/assemblees/${procurationAssembleeId}/procuration`
      : "",
    "POST",
    { successMessage: "Procuration accordée !" }
  );

  // ── Données calculées ─────────────────────────────────────────────────────
  const packsStats     = statsResponse?.packsStats;
  const souscStats     = statsResponse?.souscriptionsStats;
  const versStats      = statsResponse?.versementsStats;
  const stockStats     = statsResponse?.stockStats;
  const valeurPortefeuille = (stockStats?.valeurTotale ?? 0) + (souscStats?.montantTotalVerse ?? 0);

  const dividendes  = dividendesResponse?.data ?? [];
  const totalVerse  = dividendesResponse?.totalVerse ?? 0;
  const assemblees  = assemResponse?.data ?? [];
  const gestionnaireId = assemResponse?.gestionnaireId ?? null;
  const prochaines  = assemblees.filter((a) => a.statut !== "TERMINEE" && a.statut !== "ANNULEE");
  const passees     = assemblees.filter((a) => a.statut === "TERMINEE" || a.statut === "ANNULEE");

  const profil      = profilResponse?.profile ?? null;
  const userInfo    = profilResponse?.user ?? null;
  const capitalTotal = profilResponse?.capitalTotal?.totalActionsEmises ?? 0;
  const mouvements  = mouvementsResponse?.data ?? [];
  const documents   = documentsResponse?.data ?? [];

  const dividendesVerse = dividendes.filter((d) => d.statut === "VERSE");
  const dividendesPlanifies = dividendes.filter((d) => d.statut === "PLANIFIE" || d.statut === "EN_COURS");

  const isLoading = statsLoading && !statsResponse;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleParticiper = useCallback((assembleeId: number) => {
    setPendingParticiId(assembleeId);
  }, []);

  const handleVoter = useCallback((resolutionId: number, decision: string) => {
    setPendingVote({ resolutionId, decision });
  }, []);

  const handleProcuration = useCallback(async () => {
    if (!showProcurationModal || !procurationMandataireId) return;
    setProcurationAssembleeId(showProcurationModal);
    // petit délai pour que le state se mette à jour
    await new Promise((r) => setTimeout(r, 50));
    doProcuration({
      mandataireId: parseInt(procurationMandataireId),
      notes: procurationNotes || undefined,
    }).then(() => {
      setShowProcurationModal(null);
      setProcurationMandataireId("");
      setProcurationNotes("");
      refetchAssemblees();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProcurationModal, procurationMandataireId, procurationNotes]);

  const handleRefreshAll = useCallback(() => {
    refetchStats(); refetchDividendes(); refetchAssemblees();
    refetchProfil(); refetchMouvements(); refetchDocuments();
  }, [refetchStats, refetchDividendes, refetchAssemblees, refetchProfil, refetchMouvements, refetchDocuments]);

  if (isLoading || profilLoading) {
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
    { label: "Valeur Portefeuille",   value: formatCurrency(valeurPortefeuille),         icon: Briefcase,  color: "text-indigo-500",  lightBg: "bg-indigo-50" },
    { label: "Mes Actions",           value: String(profil?.nombreActions ?? "—"),        subtitle: `${profil?.pourcentageCapital ?? "0"}% du capital`, icon: PieChart, color: "text-purple-500", lightBg: "bg-purple-50" },
    { label: "Versements (30j)",      value: formatCurrency(versStats?.montant30j ?? 0), subtitle: `${versStats?.count30j ?? 0} versements`, icon: DollarSign, color: "text-emerald-500", lightBg: "bg-emerald-50" },
    { label: "Dividendes reçus",      value: formatCurrency(totalVerse),                 subtitle: `${dividendesVerse.length} versement(s)`, icon: Star, color: "text-amber-500", lightBg: "bg-amber-50" },
  ];

  const tabs = [
    { key: "profil"     as const, label: "Mon Profil",     icon: User },
    { key: "actions"    as const, label: "Mes Actions",    icon: PieChart },
    { key: "rapports"   as const, label: "Rapports",       icon: BarChart3 },
    { key: "dividendes" as const, label: "Dividendes",     icon: DollarSign },
    { key: "assemblees" as const, label: "Assemblées",     icon: Calendar },
    { key: "documents"  as const, label: "Documents",      icon: BookOpen },
    { key: "packs"      as const, label: "Packs",          icon: Package },
  ];

  // ── Render résolutions ────────────────────────────────────────────────────
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
              {monVote && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-500">Mon vote :</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    monVote.decision === "POUR"   ? "bg-emerald-100 text-emerald-700" :
                    monVote.decision === "CONTRE" ? "bg-red-100 text-red-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {monVote.decision === "POUR" ? "Pour" : monVote.decision === "CONTRE" ? "Contre" : "Abstention"}
                  </span>
                </div>
              )}
              {peutVoter && !monVote && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleVoter(res.id, "POUR")} disabled={voteLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors disabled:opacity-50">
                    <ThumbsUp size={13} /> Pour
                  </button>
                  <button onClick={() => handleVoter(res.id, "CONTRE")} disabled={voteLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors disabled:opacity-50">
                    <ThumbsDown size={13} /> Contre
                  </button>
                  <button onClick={() => handleVoter(res.id, "ABSTENTION")} disabled={voteLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors disabled:opacity-50">
                    <Minus size={13} /> Abstention
                  </button>
                </div>
              )}
              {!myParticipation && !peutVoter && assemblee.statut !== "TERMINEE" && assemblee.statut !== "ANNULEE" && (
                <p className="text-xs text-amber-600 italic mt-1">Vous n&apos;êtes pas encore invité à cette assemblée.</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render assemblée ──────────────────────────────────────────────────────
  const renderAssemblee = (assemblee: Assemblee) => {
    const myParticipation = assemblee.participants[0] ?? null;
    const isExpanded = expandedAssemblee === assemblee.id;
    const isPast = assemblee.statut === "TERMINEE" || assemblee.statut === "ANNULEE";
    const { label: sLabel, cls: sCls } = statutAssembleeLabel[assemblee.statut];
    const peutConfirmer =
      gestionnaireId !== null &&
      (!myParticipation || myParticipation.statut === "INVITE") &&
      !isPast;
    const peutDonnerProcuration =
      gestionnaireId !== null && !isPast &&
      (!myParticipation || myParticipation.statut === "INVITE");

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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">
                {confirmLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                Confirmer
              </button>
            )}
            {peutDonnerProcuration && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowProcurationModal(assemblee.id); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition-colors">
                <Repeat size={13} /> Procuration
              </button>
            )}
            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </div>
        </div>

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

  // ── Documents filtrés ─────────────────────────────────────────────────────
  const docsFiltres = docTypeFilter === "TOUS"
    ? documents
    : documents.filter((d) => d.type === docTypeFilter);

  // ── Render principal ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/20 font-['DM_Sans',sans-serif]">

      {/* Modal Procuration */}
      {showProcurationModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-slate-800 text-lg mb-1 flex items-center gap-2">
              <Repeat size={20} className="text-purple-600" /> Donner Procuration
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              Désignez un autre actionnaire pour voter en votre nom à cette assemblée.
            </p>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              ID du mandataire (actionnaire désigné)
            </label>
            <input
              type="number"
              value={procurationMandataireId}
              onChange={(e) => setProcurationMandataireId(e.target.value)}
              placeholder="Ex: 12"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-4"
            />
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Notes (optionnel)
            </label>
            <textarea
              value={procurationNotes}
              onChange={(e) => setProcurationNotes(e.target.value)}
              rows={3}
              placeholder="Instructions particulières..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-5 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowProcurationModal(null); setProcurationMandataireId(""); setProcurationNotes(""); }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                Annuler
              </button>
              <button
                onClick={handleProcuration}
                disabled={!procurationMandataireId || procurationLoading}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {procurationLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
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
              <MessagesLink />
              <NotificationBell href="/dashboard/user/notifications" />
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                {userInfo?.prenom?.[0] ?? "A"}
              </div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-1">
              Bonjour, {userInfo?.prenom ?? ""} {userInfo?.nom ?? "Actionnaire"}
            </h2>
            <div className="flex items-center gap-3">
              <p className="text-slate-500">Vue d&apos;ensemble de vos investissements</p>
              {profil && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${statutActionnaireLabel[profil.statut]?.cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statutActionnaireLabel[profil.statut]?.dot}`}></span>
                  {statutActionnaireLabel[profil.statut]?.label}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleRefreshAll}
            className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
            <RefreshCw size={18} /> Actualiser
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
                className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                    : "text-slate-600 hover:bg-slate-100"
                }`}>
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ================================================================ */}
        {/* TAB: Mon Profil                                                   */}
        {/* ================================================================ */}
        {activeTab === "profil" && (
          <div className="space-y-6">
            {/* Carte identité actionnaire */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-8 text-white shadow-lg shadow-indigo-200">
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-black">
                  {userInfo?.prenom?.[0] ?? "A"}{userInfo?.nom?.[0] ?? ""}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold">{userInfo?.prenom} {userInfo?.nom}</h3>
                  <p className="text-indigo-200 mt-0.5">{userInfo?.email}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {profil && (
                      <>
                        <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-lg text-sm font-semibold">
                          {typeActionLabel[profil.typeAction]?.label ?? profil.typeAction}
                        </span>
                        <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-lg text-sm font-semibold">
                          {statutActionnaireLabel[profil.statut]?.label} · Depuis {profil.dateEntree ? formatDate(profil.dateEntree) : "—"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {profil && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                  <div>
                    <p className="text-indigo-200 text-xs">Actions détenues</p>
                    <p className="text-2xl font-bold">{profil.nombreActions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-indigo-200 text-xs">% du capital</p>
                    <p className="text-2xl font-bold">{profil.pourcentageCapital}%</p>
                  </div>
                  <div>
                    <p className="text-indigo-200 text-xs">Valeur nominale</p>
                    <p className="text-2xl font-bold">{formatCurrency(profil.prixUnitaire)}</p>
                  </div>
                  <div>
                    <p className="text-indigo-200 text-xs">Valeur portefeuille</p>
                    <p className="text-2xl font-bold">{formatCurrency(profil.valeurPortefeuille)}</p>
                  </div>
                </div>
              )}
            </div>

            {profil === null && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
                <AlertCircle className="text-amber-600 w-6 h-6 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-800">Profil actionnaire non configuré</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Votre profil d&apos;actionnaire n&apos;a pas encore été configuré par l&apos;administration.
                    Contactez l&apos;équipe de gestion pour finaliser votre inscription.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Informations personnelles */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <User size={20} className="text-indigo-600" /> Informations Personnelles
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Prénom", value: userInfo?.prenom ?? "—" },
                    { label: "Nom",    value: userInfo?.nom ?? "—" },
                    { label: "Email",  value: userInfo?.email ?? "—" },
                    { label: "Membre depuis", value: userInfo?.createdAt ? formatDate(userInfo.createdAt) : "—" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                      <span className="text-slate-500 text-sm">{row.label}</span>
                      <span className="font-semibold text-slate-800 text-sm">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statut & type d'action */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Shield size={20} className="text-purple-600" /> Statut & Type d&apos;Action
                </h3>
                {profil ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-sm">Statut actionnaire</span>
                      <span className={`text-xs px-3 py-1 rounded-full font-bold ${statutActionnaireLabel[profil.statut]?.cls}`}>
                        {statutActionnaireLabel[profil.statut]?.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-sm">Type d&apos;action</span>
                      <span className={`text-xs px-3 py-1 rounded-full font-bold ${typeActionLabel[profil.typeAction]?.cls}`}>
                        {typeActionLabel[profil.typeAction]?.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-sm">Actions détenues</span>
                      <span className="font-bold text-slate-800">{profil.nombreActions.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-sm">Total actions émises</span>
                      <span className="font-bold text-slate-800">{capitalTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-sm">Part du capital</span>
                      <span className="font-bold text-indigo-600">{profil.pourcentageCapital}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-sm">Date d&apos;entrée</span>
                      <span className="font-bold text-slate-800">
                        {profil.dateEntree ? formatDate(profil.dateEntree) : "—"}
                      </span>
                    </div>
                    {profil.notes && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Notes</p>
                        <p className="text-sm text-slate-700">{profil.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm italic">Profil non configuré</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Mes Actions                                                  */}
        {/* ================================================================ */}
        {activeTab === "actions" && (
          <div className="space-y-6">
            {/* Bannière capital */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg">
              <h3 className="text-lg font-semibold text-purple-100 mb-6">Portefeuille d&apos;Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-purple-200 text-sm">Actions détenues</p>
                  <p className="text-3xl font-bold mt-1">{(profil?.nombreActions ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-purple-200 text-sm">% du capital</p>
                  <p className="text-3xl font-bold mt-1">{profil?.pourcentageCapital ?? "0"}%</p>
                </div>
                <div>
                  <p className="text-purple-200 text-sm">Valeur unitaire</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(profil?.prixUnitaire ?? 0)}</p>
                </div>
                <div>
                  <p className="text-purple-200 text-sm">Valeur totale</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(profil?.valeurPortefeuille ?? 0)}</p>
                </div>
              </div>
            </div>

            {/* Infos capital social */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 text-center">
                <p className="text-slate-500 text-sm mb-1">Total actions émises</p>
                <p className="text-3xl font-bold text-slate-800">{capitalTotal.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">Capital social global</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 text-center">
                <p className="text-slate-500 text-sm mb-1">Mes actions</p>
                <p className="text-3xl font-bold text-indigo-600">{(profil?.nombreActions ?? 0).toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">Actions en portefeuille</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 text-center">
                <p className="text-slate-500 text-sm mb-1">Part détenue</p>
                <p className="text-3xl font-bold text-purple-600">{profil?.pourcentageCapital ?? "0"}%</p>
                <p className="text-xs text-slate-400 mt-1">Du capital social</p>
              </div>
            </div>

            {/* Historique mouvements */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp size={20} className="text-indigo-600" />
                  Historique des Mouvements d&apos;Actions
                </h3>
                {mouvementsLoading && <Loader2 size={18} className="animate-spin text-slate-400" />}
              </div>

              {mouvements.length === 0 && !mouvementsLoading ? (
                <div className="p-12 text-center">
                  <TrendingDown className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">Aucun mouvement enregistré.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantité</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Prix unitaire</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Montant total</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mouvements.map((mv) => {
                        const meta = typeMouvementLabel[mv.type] ?? { label: mv.type, icon: Repeat, cls: "text-slate-600", sign: "" };
                        const MvIcon = meta.icon;
                        return (
                          <tr key={mv.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-600">{formatDate(mv.date)}</td>
                            <td className="px-6 py-4">
                              <span className={`flex items-center gap-1.5 font-semibold text-sm ${meta.cls}`}>
                                <MvIcon size={14} /> {meta.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800">
                              <span className={meta.cls}>{meta.sign}{Math.abs(mv.quantite).toLocaleString()}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{formatCurrency(mv.prixUnitaire)}</td>
                            <td className="px-6 py-4 font-bold text-slate-800">{formatCurrency(mv.montantTotal)}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{mv.description ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Info dilution */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <Info className="text-indigo-600 w-6 h-6 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-indigo-800">Dilution & Augmentation de Capital</h4>
                  <p className="text-sm text-indigo-700 mt-1">
                    Tout changement du capital social (augmentation ou dilution) sera reflété automatiquement
                    dans votre pourcentage de participation. Les rapports annuels et PV d&apos;assemblée
                    détaillent ces opérations — consultez la bibliothèque documentaire.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Rapports Financiers                                          */}
        {/* ================================================================ */}
        {activeTab === "rapports" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-8 text-white shadow-lg shadow-indigo-200">
              <h3 className="text-lg font-semibold text-indigo-100 mb-6">Indicateurs Clés de Performance</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-indigo-200 text-sm">Versements Packs (30j)</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(versStats?.montant30j ?? 0)}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Total Encaissé (Packs)</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(souscStats?.montantTotalVerse ?? 0)}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Valeur Stock</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(stockStats?.valeurTotale ?? 0)}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Restant à Percevoir</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(souscStats?.montantRestant ?? 0)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <PieChart size={20} className="text-indigo-600" /> Répartition Financière
                </h3>
                <div className="space-y-4">
                  {[
                    { label: "Versements encaissés (packs)", value: souscStats?.montantTotalVerse ?? 0, color: "bg-emerald-500" },
                    { label: "Restant à percevoir",          value: souscStats?.montantRestant ?? 0,    color: "bg-indigo-500" },
                    { label: "Valeur Stock",                 value: stockStats?.valeurTotale ?? 0,      color: "bg-blue-500" },
                  ].map((item, i) => {
                    const total = (souscStats?.montantTotalVerse ?? 0) + (souscStats?.montantRestant ?? 0) + (stockStats?.valeurTotale ?? 0);
                    const pct = total > 0 ? (item.value / total) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-600">{item.label}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(item.value)}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className={`${item.color} h-2 rounded-full`} style={{ width: `${Math.min(100, pct)}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-emerald-600" /> Statistiques Clés
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Versements ce mois",       value: versStats?.count30j ?? 0 },
                    { label: "Souscriptions actives",    value: souscStats?.actives ?? 0 },
                    { label: "Souscriptions complètes",  value: souscStats?.completes ?? 0 },
                    { label: "Souscriptions annulées",   value: souscStats?.annulees ?? 0 },
                    { label: "Produits en stock",        value: stockStats?.totalProduits ?? 0 },
                    { label: "Packs au catalogue",       value: packsStats?.total ?? 0 },
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
            {/* Bilan dividendes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
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
                  {dividendesVerse.length} versement(s) effectué(s)
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Star size={18} className="text-amber-500" /> Prévisionnel
                </h4>
                {dividendesPlanifies.length > 0 ? (
                  <div className="space-y-2">
                    {dividendesPlanifies.map((d) => (
                      <div key={d.id} className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="font-semibold text-slate-800 text-sm">{d.periode}</p>
                        <p className="text-emerald-600 font-bold">{formatCurrency(d.montantTotal)}</p>
                        {d.dateVersement && (
                          <p className="text-xs text-slate-500 mt-0.5">Prévu le {formatDate(d.dateVersement)}</p>
                        )}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${statutDividendeLabel[d.statut].cls}`}>
                          {statutDividendeLabel[d.statut].label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm italic">Aucun dividende prévisionnel</p>
                )}
              </div>
            </div>

            {/* Règles de distribution */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <Info className="text-indigo-600 w-6 h-6 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-indigo-800 mb-2">Règles de Distribution des Dividendes</h4>
                  <ul className="text-sm text-indigo-700 space-y-1.5 list-disc list-inside">
                    <li>Les dividendes sont votés en Assemblée Générale Ordinaire (AGO) sur proposition du conseil</li>
                    <li>La distribution est proportionnelle au nombre d&apos;actions détenues</li>
                    <li>Les actionnaires privilégiés bénéficient d&apos;un dividende prioritaire</li>
                    <li>Le versement intervient dans les 90 jours suivant l&apos;approbation en AG</li>
                    <li>Consultez les PV d&apos;AG dans la bibliothèque documentaire pour les historiques de vote</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Historique */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText size={20} className="text-indigo-600" /> Historique des Dividendes
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
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Bulletin</th>
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
                            <td className="px-6 py-4">
                              {div.statut === "VERSE" ? (
                                <button className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                                  <Download size={13} /> Télécharger
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Assemblées                                                   */}
        {/* ================================================================ */}
        {activeTab === "assemblees" && (
          <div className="space-y-6">
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
                <div className="space-y-3">{prochaines.map(renderAssemblee)}</div>
              )}
            </div>

            {passees.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-5">
                  <Clock size={20} className="text-slate-400" />
                  Assemblées Passées
                  <span className="ml-1 bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">
                    {passees.length}
                  </span>
                </h3>
                <div className="space-y-3">{passees.map(renderAssemblee)}</div>
              </div>
            )}

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <Clock className="text-indigo-600 w-6 h-6 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-indigo-800">Participation & Vote</h4>
                  <p className="text-sm text-indigo-700 mt-1">
                    Cliquez sur une assemblée pour voir les résolutions et voter.
                    Confirmez votre participation pour activer votre droit de vote.
                    Si vous ne pouvez pas être présent, utilisez le bouton <strong>Procuration</strong> pour déléguer votre vote à un autre actionnaire.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Bibliothèque Documentaire                                    */}
        {/* ================================================================ */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            {/* Bannière */}
            <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <BookOpen size={24} />
                </div>
                <div>
                  <p className="text-slate-300 text-sm">Bibliothèque Documentaire</p>
                  <p className="text-2xl font-bold">{documents.length} document(s)</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm">
                États financiers, PV d&apos;assemblées, rapports d&apos;audit et documents stratégiques.
              </p>
            </div>

            {/* Filtres par type */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 flex flex-wrap gap-2">
              {["TOUS", "BILAN", "COMPTE_RESULTAT", "RAPPORT_ANNUEL", "PV_AG", "CONVOCATION", "RAPPORT_AUDIT", "STATUTS", "PLAN_STRATEGIQUE", "AUTRE"].map((type) => {
                const meta = typeDocumentLabel[type] ?? { label: "Tous", icon: Globe, color: "" };
                const count = type === "TOUS" ? documents.length : (documentsResponse?.parType?.[type]?.length ?? 0);
                return (
                  <button
                    key={type}
                    onClick={() => setDocTypeFilter(type)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                      docTypeFilter === type
                        ? "bg-indigo-600 text-white shadow"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {type === "TOUS" ? "Tous" : meta.label}
                    {count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                        docTypeFilter === type ? "bg-white/20 text-white" : "bg-white text-slate-600"
                      }`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Liste documents */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">
                  {docTypeFilter === "TOUS" ? "Tous les documents" : typeDocumentLabel[docTypeFilter]?.label}
                </h3>
                {documentsLoading && <Loader2 size={18} className="animate-spin text-slate-400" />}
              </div>

              {docsFiltres.length === 0 && !documentsLoading ? (
                <div className="p-12 text-center">
                  <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">Aucun document disponible dans cette catégorie.</p>
                  <p className="text-xs text-slate-400 mt-1">Les documents seront publiés par l&apos;administration.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {docsFiltres.map((doc) => {
                    const meta = typeDocumentLabel[doc.type] ?? { label: doc.type, icon: Globe, color: "text-gray-600 bg-gray-50" };
                    const DocIcon = meta.icon;
                    return (
                      <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                          <DocIcon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{doc.titre}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400">{meta.label}</span>
                            {doc.annee && <span className="text-xs text-slate-400">· {doc.annee}</span>}
                            {doc.description && <span className="text-xs text-slate-400">· {doc.description}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-slate-400">{formatDate(doc.createdAt)}</span>
                          {doc.fichierUrl ? (
                            <a
                              href={doc.fichierUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download size={13} /> Télécharger
                            </a>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-slate-400 px-3 py-1.5 bg-slate-50 rounded-lg">
                              <ExternalLink size={12} /> À venir
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Catalogue Packs                                              */}
        {/* ================================================================ */}
        {activeTab === "packs" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Package size={24} />
                </div>
                <div>
                  <p className="text-purple-100 text-sm">Packs au Catalogue</p>
                  <p className="text-3xl font-bold">{packsStats?.total ?? 0}</p>
                </div>
              </div>
              <p className="text-purple-100 text-sm">
                {souscStats?.total ?? 0} souscriptions au total — {souscStats?.actives ?? 0} actives
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                <BarChart3 size={20} className="text-purple-600" /> Répartition des Packs par Type
              </h3>
              {Object.keys(packsStats?.parType ?? {}).length === 0 ? (
                <div className="text-center py-10">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Aucun pack dans le catalogue</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {Object.entries(packsStats?.parType ?? {}).map(([type, count]) => {
                    const meta = typePackLabel[type] ?? { label: type, color: "bg-slate-100 text-slate-700" };
                    return (
                      <div key={type} className={`${meta.color} rounded-2xl p-5 text-center`}>
                        <p className="text-3xl font-black">{count}</p>
                        <p className="text-sm font-semibold mt-1">{meta.label}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                <Target size={20} className="text-indigo-600" /> Souscriptions — Vue d&apos;ensemble
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Actives",   count: souscStats?.actives ?? 0,   extra: "En cours de versement", bg: "bg-emerald-50 border-emerald-200", cls: "text-emerald-700" },
                  { label: "Complètes", count: souscStats?.completes ?? 0,  extra: "Entièrement réglées",   bg: "bg-slate-50 border-slate-200",    cls: "text-slate-700" },
                  { label: "Annulées",  count: souscStats?.annulees ?? 0,   extra: "Non poursuivies",       bg: "bg-red-50 border-red-200",        cls: "text-red-700" },
                ].map((item, i) => (
                  <div key={i} className={`${item.bg} rounded-xl p-5 border`}>
                    <p className={`text-3xl font-bold ${item.cls}`}>{item.count}</p>
                    <p className={`font-semibold ${item.cls} mt-1`}>{item.label}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.extra}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-center bg-slate-50 rounded-xl p-4">
                <div>
                  <p className="text-slate-500 text-xs">Total versé (tous packs)</p>
                  <p className="font-bold text-slate-800 text-lg">{formatCurrency(souscStats?.montantTotalVerse ?? 0)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Restant à percevoir</p>
                  <p className="font-bold text-emerald-600 text-lg">{formatCurrency(souscStats?.montantRestant ?? 0)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
