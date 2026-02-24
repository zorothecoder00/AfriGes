"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield, Search, ArrowLeft, RefreshCw, AlertTriangle, Activity,
  FileText, Package, CreditCard as CreditCardIcon, Users, TrendingUp,
  BarChart3, LucideIcon, ChevronLeft, ChevronRight, Calendar, Truck,
  CheckCircle, XCircle, Clock, Eye, Loader2, Filter, BadgeAlert,
  ShieldAlert, ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

// ============================================================================
// TYPES
// ============================================================================

type NiveauAnomalie = "CRITIQUE" | "HAUTE" | "MOYENNE" | "BASSE";

interface Anomalie {
  type: string;
  niveau: NiveauAnomalie;
  description: string;
  entite: string;
  entiteId?: number;
}

interface ProduitAudit {
  id: number;
  nom: string;
  prixUnitaire: string;
  stock: number;
  alerteStock: number;
}

interface VenteAudit {
  id: number;
  produitNom: string;
  quantite: number;
  prixUnitaire: string;
  prixCatalogue: string;
  montant: string;
  createdAt: string;
  client: string;
  hasAnomalie: boolean;
}

interface PrixAnomalie {
  id: number;
  produitNom: string;
  prixVente: string;
  prixCatalogue: string;
  quantite: number;
  createdAt: string;
  client: string;
}

interface LivraisonAudit {
  id: number;
  reference: string;
  type: string;
  statut: string;
  fournisseurNom: string | null;
  destinataireNom: string | null;
  datePrevisionnelle: string;
  dateLivraison: string | null;
  planifiePar: string;
  isEnRetard: boolean;
  nbLignes: number;
}

interface ClotureCaisseItem {
  id: number;
  date: string;
  caissierNom: string;
  totalVentes: number;
  montantTotal: string;
  panierMoyen: string;
  nbClients: number;
  notes?: string | null;
}

interface GestionnaireActivite {
  id: number;
  nom: string;
  prenom: string;
  role: string;
  actionsCount: number;
  derniereAction: string | null;
}

interface DashboardData {
  stats: {
    totalAuditLogs: number;
    actionsToday: number;
    anomaliesCount: number;
    scoreConformite: number;
    gestionnaireActifs: number;
  };
  anomalies: Anomalie[];
  stock: {
    totalProduits: number;
    enRupture: number;
    stockFaible: number;
    valeurTotale: number;
    produits: ProduitAudit[];
  };
  ventes: {
    totalCe30Jours: number;
    montantTotal30Jours: number;
    anomaliesPrix: PrixAnomalie[];
    recentes: VenteAudit[];
  };
  livraisons: {
    stats: Record<string, number>;
    enRetard: number;
    recentes: LivraisonAudit[];
  };
  clotureCaisse: {
    derniere: ClotureCaisseItem | null;
    joursManquants: string[];
    historique: ClotureCaisseItem[];
  };
  finances: {
    creditsAlim: {
      actifs: number; epuises: number; expires: number;
      montantTotal: number; montantUtilise: number; montantRestant: number;
    };
    cotisations: { payees: number; enAttente: number; expirees: number; montantTotal: number };
    tontines: { actives: number; terminees: number; total: number };
  };
  gestionnaireActivite: GestionnaireActivite[];
}

interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  entite: string;
  entiteId: number | null;
  createdAt: string;
  user: { id: number; nom: string; prenom: string; email: string } | null;
}

interface AuditLogsResponse {
  data: AuditLog[];
  stats: { totalActions: number; actionsToday: number; entitesDistinctes: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ============================================================================
// HELPERS
// ============================================================================

const niveauConfig: Record<NiveauAnomalie, { cls: string; bg: string; border: string; icon: LucideIcon }> = {
  CRITIQUE: { cls: "text-red-700",    bg: "bg-red-50",    border: "border-red-400",  icon: XCircle },
  HAUTE:    { cls: "text-orange-700", bg: "bg-orange-50", border: "border-orange-400", icon: ShieldAlert },
  MOYENNE:  { cls: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-400",  icon: AlertTriangle },
  BASSE:    { cls: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-400",   icon: Eye },
};

const niveauBadgeCls: Record<NiveauAnomalie, string> = {
  CRITIQUE: "bg-red-100 text-red-700",
  HAUTE:    "bg-orange-100 text-orange-700",
  MOYENNE:  "bg-amber-100 text-amber-700",
  BASSE:    "bg-blue-100 text-blue-700",
};

const getActionColor = (action: string) => {
  const a = action.toLowerCase();
  if (a.includes("creat") || a.includes("ajout") || a.includes("ajouté")) return "bg-emerald-100 text-emerald-700";
  if (a.includes("update") || a.includes("modif")) return "bg-blue-100 text-blue-700";
  if (a.includes("delete") || a.includes("supprim") || a.includes("annul")) return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
};

const statutLivraisonCls: Record<string, string> = {
  EN_ATTENTE: "bg-amber-100 text-amber-700",
  EN_COURS:   "bg-blue-100 text-blue-700",
  LIVREE:     "bg-emerald-100 text-emerald-700",
  ANNULEE:    "bg-red-100 text-red-700",
};

const roleLabel: Record<string, string> = {
  RESPONSABLE_POINT_DE_VENTE: "RPV",
  CAISSIER: "Caissier",
  COMPTABLE: "Comptable",
  MAGAZINIER: "Magasinier",
  AGENT_LOGISTIQUE_APPROVISIONNEMENT: "Logistique",
  AGENT_TERRAIN: "Agent Terrain",
  AUDITEUR_INTERNE: "Auditeur",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
  ACTIONNAIRE: "Actionnaire",
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const StatCard = ({
  label, value, subtitle, icon: Icon, color, lightBg, alert,
}: {
  label: string; value: string; subtitle?: string; icon: LucideIcon;
  color: string; lightBg: string; alert?: boolean;
}) => (
  <div className={`bg-white rounded-2xl p-6 shadow-sm border transition-all group hover:shadow-md ${alert ? "border-red-200" : "border-slate-200/60"}`}>
    <div className="flex items-start justify-between mb-4">
      <div className={`${lightBg} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
        <Icon className={`${color} w-6 h-6`} />
      </div>
      {alert && <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Alerte</span>}
    </div>
    <h3 className="text-slate-600 text-sm font-medium mb-1">{label}</h3>
    <p className="text-3xl font-bold text-slate-800">{value}</p>
    {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
  </div>
);

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AuditeurInternePage() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "journal" | "stock" | "finances" | "ventes"
  >("overview");

  // ── Journal filters ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterEntite, setFilterEntite] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [logsPage, setLogsPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Dashboard global ────────────────────────────────────────────────────────
  const { data: dashboard, loading: dashLoading, refetch: refetchDashboard } =
    useApi<DashboardData>("/api/auditeur/dashboard");

  // ── Journal d'audit ────────────────────────────────────────────────────────
  const logsParams = new URLSearchParams({ page: String(logsPage), limit: "20" });
  if (debouncedSearch)  logsParams.set("search", debouncedSearch);
  if (filterAction)     logsParams.set("action", filterAction);
  if (filterEntite)     logsParams.set("entite", filterEntite);
  if (filterStartDate)  logsParams.set("startDate", filterStartDate);
  if (filterEndDate)    logsParams.set("endDate", filterEndDate);

  const { data: auditResponse, loading: auditLoading, refetch: refetchAudit } =
    useApi<AuditLogsResponse>(`/api/admin/auditLogs?${logsParams}`);

  const logs = auditResponse?.data ?? [];
  const auditMeta = auditResponse?.meta;

  const handleRefreshAll = useCallback(() => {
    refetchDashboard();
    refetchAudit();
  }, [refetchDashboard, refetchAudit]);

  const resetJournalFilters = () => {
    setSearchQuery(""); setDebouncedSearch("");
    setFilterAction(""); setFilterEntite("");
    setFilterStartDate(""); setFilterEndDate("");
    setLogsPage(1);
  };

  const isLoading = dashLoading && !dashboard;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  const d = dashboard;
  const score = d?.stats.scoreConformite ?? 100;
  const scoreColor =
    score >= 90 ? "text-emerald-600" :
    score >= 70 ? "text-blue-600" :
    score >= 50 ? "text-amber-600" :
    "text-red-600";
  const scoreBg =
    score >= 90 ? "from-emerald-500 to-emerald-600" :
    score >= 70 ? "from-blue-500 to-blue-600" :
    score >= 50 ? "from-amber-500 to-amber-600" :
    "from-red-500 to-red-600";
  const scoreLabel =
    score >= 90 ? "Excellent" :
    score >= 70 ? "Bon" :
    score >= 50 ? "Attention requise" :
    "Situation critique";

  const statCards = [
    { label: "Opérations Auditées", value: String(d?.stats.totalAuditLogs ?? 0), icon: Activity, color: "text-amber-500", lightBg: "bg-amber-50" },
    { label: "Actions Aujourd'hui", value: String(d?.stats.actionsToday ?? 0), icon: Clock, color: "text-orange-500", lightBg: "bg-orange-50" },
    { label: "Anomalies Détectées", value: String(d?.stats.anomaliesCount ?? 0), icon: BadgeAlert, color: "text-red-500", lightBg: "bg-red-50", alert: (d?.stats.anomaliesCount ?? 0) > 0 },
    { label: "Gestionnaires Actifs", value: String(d?.stats.gestionnaireActifs ?? 0), icon: Users, color: "text-indigo-500", lightBg: "bg-indigo-50" },
  ];

  const tabs = [
    { key: "overview" as const,  label: "Vue Générale",        icon: Shield },
    { key: "journal"  as const,  label: "Journal d'Audit",     icon: FileText },
    { key: "stock"    as const,  label: "Stock & Inventaire",  icon: Package },
    { key: "finances" as const,  label: "Finances & Caisse",   icon: CreditCardIcon },
    { key: "ventes"   as const,  label: "Ventes & Logistique", icon: Truck },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/20 font-['DM_Sans',sans-serif]">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Audit Interne
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">A</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-1">Tableau de Bord — Auditeur Interne</h2>
            <p className="text-slate-500">Supervisez la conformité, analysez les flux et détectez les anomalies</p>
          </div>
          <button
            onClick={handleRefreshAll}
            className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium"
          >
            <RefreshCw size={18} />
            Actualiser
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 flex gap-1 flex-wrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-200"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={17} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ================================================================== */}
        {/* TAB: Vue Générale                                                   */}
        {/* ================================================================== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Score de conformité */}
            <div className={`bg-gradient-to-br ${scoreBg} rounded-2xl p-8 text-white shadow-lg`}>
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-2">Score de Conformité Global</p>
                  <div className="flex items-end gap-3">
                    <span className="text-7xl font-black">{score}</span>
                    <span className="text-2xl font-light text-white/70 mb-2">/100</span>
                  </div>
                  <p className="text-white/90 font-semibold text-lg mt-1">{scoreLabel}</p>
                  <p className="text-white/70 text-sm mt-1">
                    {d?.stats.anomaliesCount === 0
                      ? "Aucune anomalie détectée — situation nominale"
                      : `${d?.stats.anomaliesCount} anomalie(s) nécessitent votre attention`}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  {[
                    { label: "Critiques", count: d?.anomalies.filter(a => a.niveau === "CRITIQUE").length ?? 0, cls: "bg-red-900/30" },
                    { label: "Hautes", count: d?.anomalies.filter(a => a.niveau === "HAUTE").length ?? 0, cls: "bg-orange-900/30" },
                    { label: "Moyennes", count: d?.anomalies.filter(a => a.niveau === "MOYENNE").length ?? 0, cls: "bg-yellow-900/30" },
                    { label: "Basses", count: d?.anomalies.filter(a => a.niveau === "BASSE").length ?? 0, cls: "bg-blue-900/30" },
                  ].map((item, i) => (
                    <div key={i} className={`${item.cls} rounded-xl p-4 min-w-[80px]`}>
                      <p className="text-3xl font-bold">{item.count}</p>
                      <p className="text-white/70 text-xs mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-6 bg-white/20 rounded-full h-2.5">
                <div
                  className="bg-white h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            {/* Anomalies */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                <BadgeAlert size={20} className="text-red-600" />
                Anomalies Détectées
                {(d?.stats.anomaliesCount ?? 0) > 0 && (
                  <span className="ml-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {d?.stats.anomaliesCount}
                  </span>
                )}
              </h3>
              {d?.anomalies.length === 0 ? (
                <div className="flex items-center gap-3 py-6 text-emerald-600">
                  <ShieldCheck size={32} />
                  <div>
                    <p className="font-bold text-lg">Aucune anomalie détectée</p>
                    <p className="text-sm text-slate-500">Toutes les opérations semblent conformes aux procédures.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {d?.anomalies.map((anomalie, i) => {
                    const cfg = niveauConfig[anomalie.niveau];
                    const Icon = cfg.icon;
                    return (
                      <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border-l-4 ${cfg.bg} ${cfg.border}`}>
                        <Icon className={`${cfg.cls} w-5 h-5 mt-0.5 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${niveauBadgeCls[anomalie.niveau]}`}>
                              {anomalie.niveau}
                            </span>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              {anomalie.entite}
                            </span>
                          </div>
                          <p className={`font-semibold text-sm mt-1 ${cfg.cls}`}>{anomalie.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Activité des gestionnaires */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                <Users size={20} className="text-indigo-600" />
                Activité des Gestionnaires (7 derniers jours)
              </h3>
              {(d?.gestionnaireActivite.length ?? 0) === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">Aucune activité enregistrée cette semaine.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Gestionnaire</th>
                        <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Rôle</th>
                        <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Actions (7j)</th>
                        <th className="text-left text-xs font-semibold text-slate-500 pb-3">Dernière action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d?.gestionnaireActivite.map((g) => (
                        <tr key={g.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="py-3 pr-4">
                            <span className="font-semibold text-slate-800 text-sm">{g.prenom} {g.nom}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                              {roleLabel[g.role] ?? g.role}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{g.actionsCount}</span>
                              <div className="bg-amber-100 rounded-full h-1.5 flex-1 max-w-[80px]">
                                <div
                                  className="bg-amber-500 h-1.5 rounded-full"
                                  style={{
                                    width: `${Math.min(100, (g.actionsCount / (d?.gestionnaireActivite[0]?.actionsCount || 1)) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-xs text-slate-500">
                            {g.derniereAction ? formatDateTime(g.derniereAction) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: Journal d'Audit                                                */}
        {/* ================================================================== */}
        {activeTab === "journal" && (
          <div className="space-y-5">
            {/* Filtres avancés */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <Filter size={16} className="text-amber-600" /> Filtres
                </h3>
                <button onClick={resetJournalFilters} className="text-xs text-amber-600 hover:underline">
                  Réinitialiser
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Rechercher action, entité, utilisateur…"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setLogsPage(1); }}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
                  />
                </div>
                <select
                  value={filterEntite}
                  onChange={(e) => { setFilterEntite(e.target.value); setLogsPage(1); }}
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-slate-700"
                >
                  <option value="">Toutes les entités</option>
                  {["Produit", "CreditAlimentaire", "Cotisation", "Tontine", "Livraison", "User", "Vente", "Credit", "Cloture"].map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Type d'action…"
                  value={filterAction}
                  onChange={(e) => { setFilterAction(e.target.value); setLogsPage(1); }}
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
                />
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => { setFilterStartDate(e.target.value); setLogsPage(1); }}
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-slate-700"
                />
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => { setFilterEndDate(e.target.value); setLogsPage(1); }}
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-slate-700"
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  {auditMeta ? <>{auditMeta.total} entrée(s) trouvée(s)</> : "Chargement…"}
                </p>
                {auditLoading && <Loader2 size={16} className="animate-spin text-amber-500" />}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date & Heure</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Utilisateur</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Entité</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                        <td className="px-5 py-4">
                          {log.user ? (
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{log.user.prenom} {log.user.nom}</p>
                              <p className="text-xs text-slate-400">{log.user.email}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm italic">Système</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-medium">
                            {log.entite}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500 font-mono">{log.entiteId ?? "—"}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && !auditLoading && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          Aucune entrée correspondant aux filtres
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {auditMeta && auditMeta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Page <b>{auditMeta.page}</b> / <b>{auditMeta.totalPages}</b>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                      disabled={logsPage <= 1}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 text-sm"
                    >
                      <ChevronLeft size={15} /> Préc.
                    </button>
                    <span className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold text-sm">
                      {logsPage}
                    </span>
                    <button
                      onClick={() => setLogsPage((p) => Math.min(auditMeta.totalPages, p + 1))}
                      disabled={logsPage >= auditMeta.totalPages}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 text-sm"
                    >
                      Suiv. <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: Stock & Inventaire                                             */}
        {/* ================================================================== */}
        {activeTab === "stock" && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: "Total Produits",  value: String(d?.stock.totalProduits ?? 0), cls: "text-slate-700",   bg: "bg-slate-100",   icon: Package },
                { label: "En Rupture",      value: String(d?.stock.enRupture ?? 0),     cls: "text-red-700",    bg: "bg-red-100",     icon: XCircle },
                { label: "Stock Faible",    value: String(d?.stock.stockFaible ?? 0),   cls: "text-amber-700",  bg: "bg-amber-100",   icon: AlertTriangle },
                { label: "Valeur Totale",   value: formatCurrency(d?.stock.valeurTotale ?? 0), cls: "text-emerald-700", bg: "bg-emerald-100", icon: TrendingUp },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className={`${item.bg} rounded-2xl p-5 flex items-center gap-4`}>
                    <Icon className={`${item.cls} w-8 h-8 flex-shrink-0`} />
                    <div>
                      <p className="text-xs font-medium text-slate-600">{item.label}</p>
                      <p className={`text-2xl font-bold ${item.cls}`}>{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Produits table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <BarChart3 size={18} className="text-amber-600" />
                  Inventaire Complet — Trié par niveau de risque
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Stock</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Seuil d&apos;alerte</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Prix unitaire</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Valeur stock</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(d?.stock.produits ?? []).map((p) => {
                      const isRupture = p.stock === 0;
                      const isFaible = !isRupture && p.alerteStock > 0 && p.stock <= p.alerteStock;
                      const rowCls = isRupture ? "bg-red-50/60" : isFaible ? "bg-amber-50/40" : "";
                      return (
                        <tr key={p.id} className={`${rowCls} hover:bg-slate-50 transition-colors`}>
                          <td className="px-5 py-4 font-semibold text-slate-800 text-sm">{p.nom}</td>
                          <td className="px-5 py-4">
                            <span className={`font-bold text-lg ${isRupture ? "text-red-600" : isFaible ? "text-amber-600" : "text-emerald-600"}`}>
                              {p.stock}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-500">{p.alerteStock}</td>
                          <td className="px-5 py-4 text-sm text-slate-700">{formatCurrency(p.prixUnitaire)}</td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                            {formatCurrency(Number(p.prixUnitaire) * p.stock)}
                          </td>
                          <td className="px-5 py-4">
                            {isRupture ? (
                              <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold">Rupture</span>
                            ) : isFaible ? (
                              <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold">Stock faible</span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold">Normal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(d?.stock.produits.length ?? 0) === 0 && (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Aucun produit trouvé</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: Finances & Caisse                                              */}
        {/* ================================================================== */}
        {activeTab === "finances" && (
          <div className="space-y-6">
            {/* Crédits alimentaires */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                <CreditCardIcon size={20} className="text-emerald-600" />
                Crédits Alimentaires
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                {[
                  { label: "Actifs", count: d?.finances.creditsAlim.actifs ?? 0, extra: formatCurrency(d?.finances.creditsAlim.montantRestant ?? 0) + " restant", bg: "bg-emerald-50 border-emerald-200", cls: "text-emerald-700" },
                  { label: "Épuisés", count: d?.finances.creditsAlim.epuises ?? 0, extra: "Entièrement utilisés", bg: "bg-slate-50 border-slate-200", cls: "text-slate-700" },
                  { label: "Expirés", count: d?.finances.creditsAlim.expires ?? 0, extra: "Non réglés", bg: "bg-red-50 border-red-200", cls: "text-red-700" },
                ].map((item, i) => (
                  <div key={i} className={`${item.bg} rounded-xl p-5 border`}>
                    <p className={`text-3xl font-bold ${item.cls}`}>{item.count}</p>
                    <p className={`font-semibold ${item.cls} mt-1`}>{item.label}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.extra}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm bg-slate-50 rounded-xl p-4">
                <div>
                  <p className="text-slate-500 text-xs">Plafond total</p>
                  <p className="font-bold text-slate-800">{formatCurrency(d?.finances.creditsAlim.montantTotal ?? 0)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Utilisé</p>
                  <p className="font-bold text-red-600">{formatCurrency(d?.finances.creditsAlim.montantUtilise ?? 0)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Restant</p>
                  <p className="font-bold text-emerald-600">{formatCurrency(d?.finances.creditsAlim.montantRestant ?? 0)}</p>
                </div>
              </div>
            </div>

            {/* Cotisations + Tontines */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Users size={20} className="text-purple-600" /> Cotisations
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Payées",     count: d?.finances.cotisations.payees ?? 0,    cls: "text-emerald-700", bg: "bg-emerald-100" },
                    { label: "En attente", count: d?.finances.cotisations.enAttente ?? 0,  cls: "text-amber-700",   bg: "bg-amber-100" },
                    { label: "Expirées",   count: d?.finances.cotisations.expirees ?? 0,   cls: "text-red-700",     bg: "bg-red-100" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-slate-600 text-sm">{item.label}</span>
                      <span className={`${item.bg} ${item.cls} font-bold px-3 py-0.5 rounded-full text-sm`}>{item.count}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 mt-1 bg-slate-50 rounded-lg px-3">
                    <span className="text-slate-600 text-sm font-medium">Total encaissé</span>
                    <span className="font-bold text-slate-800">{formatCurrency(d?.finances.cotisations.montantTotal ?? 0)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Activity size={20} className="text-indigo-600" /> Tontines
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Actives",    count: d?.finances.tontines.actives ?? 0,   cls: "text-emerald-700", bg: "bg-emerald-100" },
                    { label: "Terminées",  count: d?.finances.tontines.terminees ?? 0, cls: "text-slate-700",   bg: "bg-slate-100" },
                    { label: "Total",      count: d?.finances.tontines.total ?? 0,     cls: "text-indigo-700",  bg: "bg-indigo-100" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-slate-600 text-sm">{item.label}</span>
                      <span className={`${item.bg} ${item.cls} font-bold px-3 py-0.5 rounded-full text-sm`}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Clôtures caisse */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                <Calendar size={20} className="text-amber-600" />
                Clôtures de Caisse (7 derniers jours)
              </h3>

              {(d?.clotureCaisse.joursManquants.length ?? 0) > 0 && (
                <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="text-red-600 w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-red-700 text-sm">
                      {d?.clotureCaisse.joursManquants.length} jour(s) sans clôture de caisse
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {d?.clotureCaisse.joursManquants.map((j) => formatDate(j)).join(", ")}
                    </p>
                  </div>
                </div>
              )}

              {(d?.clotureCaisse.historique.length ?? 0) === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">Aucune clôture enregistrée cette semaine.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Date</th>
                        <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Caissier</th>
                        <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Ventes</th>
                        <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Montant</th>
                        <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Panier moy.</th>
                        <th className="text-left text-xs font-semibold text-slate-500 pb-3">Clients</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d?.clotureCaisse.historique.map((c) => (
                        <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                          <td className="py-3 pr-4 text-sm font-medium text-slate-800">{formatDate(c.date)}</td>
                          <td className="py-3 pr-4 text-sm text-slate-600">{c.caissierNom}</td>
                          <td className="py-3 pr-4 text-sm font-bold text-slate-800">{c.totalVentes}</td>
                          <td className="py-3 pr-4 text-sm font-bold text-emerald-600">{formatCurrency(c.montantTotal)}</td>
                          <td className="py-3 pr-4 text-sm text-slate-600">{formatCurrency(c.panierMoyen)}</td>
                          <td className="py-3 text-sm text-slate-600">{c.nbClients}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: Ventes & Logistique                                            */}
        {/* ================================================================== */}
        {activeTab === "ventes" && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg shadow-amber-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                    <BarChart3 size={22} />
                  </div>
                  <div>
                    <p className="text-amber-100 text-xs">Ventes (30j)</p>
                    <p className="text-2xl font-bold">{formatCurrency(d?.ventes.montantTotal30Jours ?? 0)}</p>
                  </div>
                </div>
                <p className="text-amber-100 text-sm">{d?.ventes.totalCe30Jours ?? 0} transactions</p>
              </div>
              <div className={`rounded-2xl p-6 text-white shadow-lg ${(d?.ventes.anomaliesPrix.length ?? 0) > 0 ? "bg-gradient-to-br from-red-500 to-red-600 shadow-red-200" : "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-200"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                    {(d?.ventes.anomaliesPrix.length ?? 0) > 0 ? <AlertTriangle size={22} /> : <CheckCircle size={22} />}
                  </div>
                  <div>
                    <p className="text-white/80 text-xs">Anomalies Prix</p>
                    <p className="text-2xl font-bold">{d?.ventes.anomaliesPrix.length ?? 0}</p>
                  </div>
                </div>
                <p className="text-white/80 text-sm">
                  {(d?.ventes.anomaliesPrix.length ?? 0) === 0 ? "Aucun écart détecté" : "Prix ≠ catalogue"}
                </p>
              </div>
              <div className={`rounded-2xl p-6 text-white shadow-lg ${(d?.livraisons.enRetard ?? 0) > 0 ? "bg-gradient-to-br from-orange-500 to-red-500 shadow-orange-200" : "bg-gradient-to-br from-slate-600 to-slate-700"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                    <Truck size={22} />
                  </div>
                  <div>
                    <p className="text-white/80 text-xs">Livraisons en retard</p>
                    <p className="text-2xl font-bold">{d?.livraisons.enRetard ?? 0}</p>
                  </div>
                </div>
                <p className="text-white/80 text-sm">
                  {Object.entries(d?.livraisons.stats ?? {}).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(" · ")}
                </p>
              </div>
            </div>

            {/* Anomalies de prix */}
            {(d?.ventes.anomaliesPrix.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
                <div className="px-6 py-4 bg-red-50 border-b border-red-200 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-600" />
                  <h3 className="font-bold text-red-800">
                    Ventes avec prix hors catalogue — {d?.ventes.anomaliesPrix.length} cas détecté(s)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Produit</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Qté</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Prix vendu</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Prix catalogue</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Écart</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d?.ventes.anomaliesPrix.map((v) => {
                        const ecart = Number(v.prixVente) - Number(v.prixCatalogue);
                        return (
                          <tr key={v.id} className="bg-red-50/30 hover:bg-red-50 transition-colors">
                            <td className="px-5 py-3 font-semibold text-slate-800 text-sm">{v.produitNom}</td>
                            <td className="px-5 py-3 text-sm text-slate-600">{v.client}</td>
                            <td className="px-5 py-3 text-sm text-slate-700">{v.quantite}</td>
                            <td className="px-5 py-3 text-sm font-bold text-red-600">{formatCurrency(v.prixVente)}</td>
                            <td className="px-5 py-3 text-sm text-slate-600">{formatCurrency(v.prixCatalogue)}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-bold ${ecart > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {ecart > 0 ? "+" : ""}{formatCurrency(ecart)}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-xs text-slate-500">{formatDate(v.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ventes récentes */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Clock size={18} className="text-amber-600" />
                  Ventes Récentes (30 jours)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Produit</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Qté</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Montant</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Conformité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(d?.ventes.recentes ?? []).map((v) => (
                      <tr key={v.id} className={`transition-colors ${v.hasAnomalie ? "bg-red-50/20 hover:bg-red-50/40" : "hover:bg-slate-50"}`}>
                        <td className="px-5 py-3 font-semibold text-slate-800 text-sm">{v.produitNom}</td>
                        <td className="px-5 py-3 text-sm text-slate-600">{v.client}</td>
                        <td className="px-5 py-3 text-sm text-slate-700">{v.quantite}</td>
                        <td className="px-5 py-3 font-bold text-emerald-600 text-sm">{formatCurrency(v.montant)}</td>
                        <td className="px-5 py-3 text-xs text-slate-500">{formatDateTime(v.createdAt)}</td>
                        <td className="px-5 py-3">
                          {v.hasAnomalie ? (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                              <AlertTriangle size={11} /> Écart prix
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                              <CheckCircle size={11} /> Conforme
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(d?.ventes.recentes.length ?? 0) === 0 && (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">Aucune vente ce mois-ci</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Livraisons */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Truck size={18} className="text-slate-600" />
                  Livraisons Récentes
                </h3>
              </div>
              {(d?.livraisons.recentes.length ?? 0) === 0 ? (
                <p className="text-center text-slate-400 py-10 text-sm">Aucune livraison enregistrée.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Référence</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Fournisseur / Dest.</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date prév.</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Statut</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Lignes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d?.livraisons.recentes.map((l) => (
                        <tr key={l.id} className={`transition-colors ${l.isEnRetard ? "bg-orange-50/40 hover:bg-orange-50/70" : "hover:bg-slate-50"}`}>
                          <td className="px-5 py-3 font-mono text-xs text-slate-700">{l.reference}</td>
                          <td className="px-5 py-3">
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                              {l.type}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">
                            {l.fournisseurNom ?? l.destinataireNom ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">
                            <span className={l.isEnRetard ? "text-red-600 font-bold" : ""}>
                              {formatDate(l.datePrevisionnelle)}
                              {l.isEnRetard && " ⚠"}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statutLivraisonCls[l.statut] ?? "bg-slate-100 text-slate-600"}`}>
                              {l.statut.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">{l.nbLignes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
