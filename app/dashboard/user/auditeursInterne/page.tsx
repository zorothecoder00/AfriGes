"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield, Search, ArrowLeft, RefreshCw, AlertTriangle, Activity,
  FileText, Package, CreditCard as CreditCardIcon, Users, TrendingUp,
  BarChart3, LucideIcon, ChevronLeft, ChevronRight, Calendar, Truck,
  CheckCircle, XCircle, Clock, Eye, Loader2, Filter, BadgeAlert,
  ShieldAlert, ShieldCheck, Download, Layers, ClipboardList, PenLine,
  AlertOctagon, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import UserPdvBadge from "@/components/UserPdvBadge";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { exportToCsv } from "@/lib/exportCsv";

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

interface VersementAudit {
  id: number;
  packNom: string;
  packType: string;
  montant: string;
  type: string;
  datePaiement: string;
  beneficiaire: string;
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

interface ReceptionPackAudit {
  id: number;
  statut: string;
  packNom: string;
  packType: string;
  souscriptionId: number;
  beneficiaire: string;
  livreurNom: string;
  datePrevisionnelle: string;
  dateLivraison: string | null;
  notes: string | null;
  produits: string;
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
    recentes: VersementAudit[];
  };
  livraisons: {
    stats: Record<string, number>;
    enRetard: number;
    recentes: LivraisonAudit[];
  };
  receptionsPack: {
    stats: Record<string, number>;
    recentes: ReceptionPackAudit[];
  };
  clotureCaisse: {
    derniere: ClotureCaisseItem | null;
    joursManquants: string[];
    historique: ClotureCaisseItem[];
  };
  finances: {
    souscriptions: {
      actives: number; completes: number; annulees: number;
      montantTotalVerse: number; montantRestant: number;
    };
    packs: { actifs: number; total: number };
    echeancesEnRetard: number;
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

interface MouvementStockAudit {
  id: number;
  type: "ENTREE" | "SORTIE" | "AJUSTEMENT";
  quantite: number;
  motif: string | null;
  reference: string;
  dateMouvement: string;
  produit: { id: number; nom: string };
}
interface MouvementsStockResponse {
  data: MouvementStockAudit[];
  stats: Record<string, number>;
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface AnomalieStockAudit {
  id: number;
  reference: string;
  type: "MANQUANT" | "SURPLUS" | "DEFECTUEUX";
  quantite: number;
  description: string;
  statut: "EN_ATTENTE" | "EN_COURS" | "TRAITEE" | "TRANSMISE";
  commentaire: string | null;
  createdAt: string;
  produit: { id: number; nom: string; stock: number };
  magasinier: { id: number; nom: string; prenom: string };
  traiteur: { id: number; nom: string; prenom: string } | null;
}
interface AnomaliesStockResponse {
  data: AnomalieStockAudit[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface LigneBonSortieAudit {
  id: number;
  quantite: number;
  prixUnit: string;
  produit: { id: number; nom: string };
}
interface BonSortieAudit {
  id: number;
  reference: string;
  type: string;
  statut: string;
  destinataire: string | null;
  motif: string;
  notes: string | null;
  createdAt: string;
  magasinier: { id: number; nom: string; prenom: string };
  lignes: LigneBonSortieAudit[];
}
interface BonsSortieResponse {
  data: BonSortieAudit[];
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
    "overview" | "journal" | "stock" | "finances" | "ventes" | "mouvements" | "rapports"
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

  // ── Mouvements stock ────────────────────────────────────────────────────────
  const [mouvPage, setMouvPage] = useState(1);
  const [mouvType, setMouvType] = useState("");
  const mouvParams = new URLSearchParams({ page: String(mouvPage), limit: "20" });
  if (mouvType) mouvParams.set("type", mouvType);
  const { data: mouvResponse, loading: mouvLoading } = useApi<MouvementsStockResponse>(
    activeTab === "mouvements" ? `/api/auditeur/mouvements-stock?${mouvParams}` : null
  );

  // ── Anomalies stock ─────────────────────────────────────────────────────────
  const [anomaliesPage, setAnomaliesPage] = useState(1);
  const [anomaliesStatut, setAnomaliesStatut] = useState("");
  const anomaliesParams = new URLSearchParams({ page: String(anomaliesPage), limit: "20" });
  if (anomaliesStatut) anomaliesParams.set("statut", anomaliesStatut);
  const { data: anomaliesResponse, loading: anomaliesLoading } = useApi<AnomaliesStockResponse>(
    activeTab === "mouvements" ? `/api/auditeur/anomalies-stock?${anomaliesParams}` : null
  );

  // ── Bons de sortie ──────────────────────────────────────────────────────────
  const [bonsPage, setBonsPage] = useState(1);
  const [bonsStatut, setBonsStatut] = useState("");
  const bonsParams = new URLSearchParams({ page: String(bonsPage), limit: "20" });
  if (bonsStatut) bonsParams.set("statut", bonsStatut);
  const { data: bonsResponse, loading: bonsLoading } = useApi<BonsSortieResponse>(
    activeTab === "mouvements" ? `/api/auditeur/bons-sortie?${bonsParams}` : null
  );

  // ── Sous-onglet dans "mouvements" ───────────────────────────────────────────
  const [mouvSubTab, setMouvSubTab] = useState<"mouvements" | "anomalies" | "bons">("mouvements");

  // ── Rapport form state ──────────────────────────────────────────────────────
  const [rapportType, setRapportType] = useState<"AUDIT" | "ANOMALIES" | "RECOMMANDATIONS" | "CONSOLIDE">("AUDIT");
  const [rapportTitre, setRapportTitre] = useState("");
  const [rapportContenu, setRapportContenu] = useState("");
  const [rapportPeriode, setRapportPeriode] = useState("");

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

  // ── Export CSV logs ─────────────────────────────────────────────────────────
  const handleExportLogs = () => {
    if (!logs.length) return;
    exportToCsv(
      logs.map((l) => ({
        date: formatDateTime(l.createdAt),
        utilisateur: l.user ? `${l.user.prenom} ${l.user.nom}` : "Système",
        email: l.user?.email ?? "",
        action: l.action,
        entite: l.entite,
        entiteId: l.entiteId ?? "",
      })),
      [
        { label: "Date & Heure",  key: "date" },
        { label: "Utilisateur",   key: "utilisateur" },
        { label: "Email",         key: "email" },
        { label: "Action",        key: "action" },
        { label: "Entité",        key: "entite" },
        { label: "ID Entité",     key: "entiteId" },
      ],
      "journal-audit.csv"
    );
  };

  // ── Export CSV mouvements ───────────────────────────────────────────────────
  const handleExportMouvements = () => {
    const data = mouvResponse?.data ?? [];
    if (!data.length) return;
    exportToCsv(
      data.map((m) => ({
        date: formatDateTime(m.dateMouvement),
        reference: m.reference,
        type: m.type,
        produit: m.produit.nom,
        quantite: m.quantite,
        motif: m.motif ?? "",
      })),
      [
        { label: "Date",       key: "date" },
        { label: "Référence",  key: "reference" },
        { label: "Type",       key: "type" },
        { label: "Produit",    key: "produit" },
        { label: "Quantité",   key: "quantite" },
        { label: "Motif",      key: "motif" },
      ],
      "mouvements-stock.csv"
    );
  };

  // ── Génération rapport texte ────────────────────────────────────────────────
  const handleGenerateRapport = () => {
    const now = new Date().toLocaleDateString("fr-FR");
    const score = d?.stats.scoreConformite ?? 100;
    const templates: Record<string, string> = {
      AUDIT: `RAPPORT D'AUDIT INTERNE\n${"=".repeat(40)}\nDate : ${now}\nPériode : ${rapportPeriode || "Non précisée"}\nTitre : ${rapportTitre || "Rapport d'audit"}\n\nSCORE DE CONFORMITÉ : ${score}/100\nAnomalies détectées : ${d?.stats.anomaliesCount ?? 0}\n\nCONTENU :\n${rapportContenu || "[Saisir le contenu du rapport]"}\n\n--- Généré par AfriGes Audit Interne ---`,
      ANOMALIES: `RAPPORT D'ANOMALIES DÉTECTÉES\n${"=".repeat(40)}\nDate : ${now}\nPériode : ${rapportPeriode || "Non précisée"}\nTitre : ${rapportTitre || "Rapport d'anomalies"}\n\nANOMALIES IDENTIFIÉES :\n${(d?.anomalies ?? []).map((a, i) => `${i + 1}. [${a.niveau}] ${a.description} (${a.entite})`).join("\n") || "Aucune anomalie détectée."}\n\nOBSERVATIONS :\n${rapportContenu || "[Saisir les observations]"}\n\n--- Généré par AfriGes Audit Interne ---`,
      RECOMMANDATIONS: `RAPPORT DE RECOMMANDATIONS\n${"=".repeat(40)}\nDate : ${now}\nPériode : ${rapportPeriode || "Non précisée"}\nTitre : ${rapportTitre || "Recommandations"}\n\nRECOMMANDATIONS :\n${rapportContenu || "[Saisir les recommandations]"}\n\n--- Généré par AfriGes Audit Interne ---`,
      CONSOLIDE: `RAPPORT CONSOLIDÉ\n${"=".repeat(40)}\nDate : ${now}\nPériode : ${rapportPeriode || "Non précisée"}\nTitre : ${rapportTitre || "Rapport consolidé"}\n\nSYNTHÈSE STOCK :\n- Produits : ${d?.stock.totalProduits ?? 0} | Ruptures : ${d?.stock.enRupture ?? 0} | Stock faible : ${d?.stock.stockFaible ?? 0}\n- Valeur totale : ${formatCurrency(d?.stock.valeurTotale ?? 0)}\n\nSYNTHÈSE FINANCES :\n- Souscriptions actives : ${d?.finances.souscriptions.actives ?? 0}\n- Montant versé : ${formatCurrency(d?.finances.souscriptions.montantTotalVerse ?? 0)}\n- Échéances en retard : ${d?.finances.echeancesEnRetard ?? 0}\n\nSYNTHÈSE CAISSE (7j) :\n${(d?.clotureCaisse.historique ?? []).map((c) => `  ${formatDate(c.date)} — ${c.totalVentes} ventes — ${formatCurrency(c.montantTotal)}`).join("\n") || "  Aucune clôture."}\n\nCONTENU LIBRE :\n${rapportContenu || "[Saisir le contenu]"}\n\n--- Généré par AfriGes Audit Interne ---`,
    };
    const blob = new Blob([templates[rapportType]], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `rapport-${rapportType.toLowerCase()}-${now.replace(/\//g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { key: "overview"    as const, label: "Vue Générale",        icon: Shield },
    { key: "journal"     as const, label: "Journal d'Audit",     icon: FileText },
    { key: "stock"       as const, label: "Stock & Inventaire",  icon: Package },
    { key: "finances"    as const, label: "Finances & Caisse",   icon: CreditCardIcon },
    { key: "ventes"      as const, label: "Ventes & Logistique", icon: Truck },
    { key: "mouvements"  as const, label: "Mouvements & Sorties", icon: Layers },
    { key: "rapports"    as const, label: "Rapports",            icon: ClipboardList },
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
              <UserPdvBadge />
              <MessagesLink />
              <NotificationBell href="/dashboard/user/notifications" />
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
                  {["Produit", "SouscriptionPack", "VersementPack", "EcheancePack", "Livraison", "ReceptionProduitPack", "MouvementStock", "User", "ClotureCaisse", "Pack"].map((e) => (
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
                <div className="flex items-center gap-3">
                  {auditLoading && <Loader2 size={16} className="animate-spin text-amber-500" />}
                  <button
                    onClick={handleExportLogs}
                    disabled={!logs.length}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 disabled:opacity-40 transition-colors"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                </div>
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
            {/* Souscriptions Packs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                <Package size={20} className="text-emerald-600" />
                Souscriptions aux Packs
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                {[
                  { label: "Actives",   count: d?.finances.souscriptions.actives ?? 0,   extra: formatCurrency(d?.finances.souscriptions.montantRestant ?? 0) + " restant", bg: "bg-emerald-50 border-emerald-200", cls: "text-emerald-700" },
                  { label: "Complètes", count: d?.finances.souscriptions.completes ?? 0,  extra: "Entièrement réglées", bg: "bg-slate-50 border-slate-200", cls: "text-slate-700" },
                  { label: "Annulées",  count: d?.finances.souscriptions.annulees ?? 0,   extra: "Non poursuivies", bg: "bg-red-50 border-red-200", cls: "text-red-700" },
                ].map((item, i) => (
                  <div key={i} className={`${item.bg} rounded-xl p-5 border`}>
                    <p className={`text-3xl font-bold ${item.cls}`}>{item.count}</p>
                    <p className={`font-semibold ${item.cls} mt-1`}>{item.label}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.extra}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-center text-sm bg-slate-50 rounded-xl p-4">
                <div>
                  <p className="text-slate-500 text-xs">Total versé</p>
                  <p className="font-bold text-slate-800">{formatCurrency(d?.finances.souscriptions.montantTotalVerse ?? 0)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Restant à percevoir</p>
                  <p className="font-bold text-emerald-600">{formatCurrency(d?.finances.souscriptions.montantRestant ?? 0)}</p>
                </div>
              </div>
            </div>

            {/* Packs & Échéances */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-purple-600" /> Packs
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Packs actifs",     count: d?.finances.packs.actifs ?? 0, cls: "text-emerald-700", bg: "bg-emerald-100" },
                    { label: "Total catalogues", count: d?.finances.packs.total ?? 0,  cls: "text-indigo-700",  bg: "bg-indigo-100" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-slate-600 text-sm">{item.label}</span>
                      <span className={`${item.bg} ${item.cls} font-bold px-3 py-0.5 rounded-full text-sm`}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-amber-600" /> Échéances en Retard
                </h3>
                <div className="flex items-center gap-4 py-2">
                  <span className={`text-5xl font-black ${(d?.finances.echeancesEnRetard ?? 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {d?.finances.echeancesEnRetard ?? 0}
                  </span>
                  <p className="text-sm text-slate-500">
                    {(d?.finances.echeancesEnRetard ?? 0) === 0
                      ? "Aucune échéance en retard — situation nominale"
                      : "échéance(s) de packs non honorées à ce jour"}
                  </p>
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
                    <p className="text-amber-100 text-xs">Versements (30j)</p>
                    <p className="text-2xl font-bold">{formatCurrency(d?.ventes.montantTotal30Jours ?? 0)}</p>
                  </div>
                </div>
                <p className="text-amber-100 text-sm">{d?.ventes.totalCe30Jours ?? 0} versements</p>
              </div>
              <div className={`rounded-2xl p-6 text-white shadow-lg ${(d?.finances.echeancesEnRetard ?? 0) > 0 ? "bg-gradient-to-br from-red-500 to-red-600 shadow-red-200" : "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-200"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                    {(d?.finances.echeancesEnRetard ?? 0) > 0 ? <AlertTriangle size={22} /> : <CheckCircle size={22} />}
                  </div>
                  <div>
                    <p className="text-white/80 text-xs">Échéances en retard</p>
                    <p className="text-2xl font-bold">{d?.finances.echeancesEnRetard ?? 0}</p>
                  </div>
                </div>
                <p className="text-white/80 text-sm">
                  {(d?.finances.echeancesEnRetard ?? 0) === 0 ? "Toutes échéances à jour" : "packs avec retard de paiement"}
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

            {/* Versements récents */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Clock size={18} className="text-amber-600" />
                  Versements Récents — Packs (30 jours)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Pack</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Bénéficiaire</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Montant</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(d?.ventes.recentes ?? []).map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-800 text-sm">
                          {v.packNom}
                          <span className="ml-1 text-xs text-slate-400">({v.packType})</span>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">{v.beneficiaire}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            {v.type}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-bold text-emerald-600 text-sm">{formatCurrency(v.montant)}</td>
                        <td className="px-5 py-3 text-xs text-slate-500">{formatDateTime(v.datePaiement)}</td>
                      </tr>
                    ))}
                    {(d?.ventes.recentes.length ?? 0) === 0 && (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">Aucun versement ce mois-ci</td></tr>
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

            {/* Livraisons de packs clients */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Package size={18} className="text-amber-600" />
                  Livraisons de Packs Clients (30 jours)
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(d?.receptionsPack.stats ?? {}).map(([statut, count]) => (
                    <span
                      key={statut}
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${statutLivraisonCls[statut] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {count} {statut.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
              {(d?.receptionsPack.recentes.length ?? 0) === 0 ? (
                <p className="text-center text-slate-400 py-10 text-sm">Aucune livraison de pack ce mois-ci.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Pack</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Bénéficiaire</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Produits</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Livreur</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date prév.</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date livr.</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d?.receptionsPack.recentes.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <span className="font-semibold text-slate-800 text-sm">{r.packNom}</span>
                            <span className="ml-1 text-xs text-slate-400">({r.packType})</span>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">{r.beneficiaire}</td>
                          <td className="px-5 py-3 text-xs text-slate-500 max-w-[200px] truncate" title={r.produits}>
                            {r.produits || "—"}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">{r.livreurNom}</td>
                          <td className="px-5 py-3 text-xs text-slate-500">{formatDate(r.datePrevisionnelle)}</td>
                          <td className="px-5 py-3 text-xs text-slate-500">
                            {r.dateLivraison ? formatDate(r.dateLivraison) : "—"}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statutLivraisonCls[r.statut] ?? "bg-slate-100 text-slate-600"}`}>
                              {r.statut.replace("_", " ")}
                            </span>
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
        {/* TAB: Mouvements & Sorties (stock)                                   */}
        {/* ================================================================== */}
        {activeTab === "mouvements" && (
          <div className="space-y-5">
            {/* Sous-onglets */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 flex gap-1">
              {[
                { key: "mouvements" as const, label: "Mouvements de stock",  icon: ArrowRightLeft },
                { key: "anomalies"  as const, label: "Anomalies signalées",  icon: AlertOctagon },
                { key: "bons"       as const, label: "Bons de sortie",       icon: FileText },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <button key={s.key} onClick={() => setMouvSubTab(s.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${mouvSubTab === s.key ? "bg-amber-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    <Icon size={15} /> {s.label}
                  </button>
                );
              })}
            </div>

            {/* ── Mouvements de stock ── */}
            {mouvSubTab === "mouvements" && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><ArrowRightLeft size={18} className="text-amber-600" />Historique complet des mouvements</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{mouvResponse?.meta.total ?? 0} enregistrements</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={mouvType} onChange={(e) => { setMouvType(e.target.value); setMouvPage(1); }} className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="">Tous types</option>
                      <option value="ENTREE">Entrées</option>
                      <option value="SORTIE">Sorties</option>
                      <option value="AJUSTEMENT">Ajustements</option>
                    </select>
                    <button onClick={handleExportMouvements} disabled={!(mouvResponse?.data.length)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-medium hover:bg-amber-100 disabled:opacity-40">
                      <Download size={13} /> Export CSV
                    </button>
                  </div>
                </div>
                {mouvResponse?.stats && (
                  <div className="px-6 py-3 border-b border-slate-100 flex gap-3 flex-wrap">
                    {[
                      { label: "Entrées",     key: "ENTREE",     cls: "bg-emerald-100 text-emerald-700", icon: ArrowUpCircle },
                      { label: "Sorties",     key: "SORTIE",     cls: "bg-red-100 text-red-700",         icon: ArrowDownCircle },
                      { label: "Ajustements", key: "AJUSTEMENT", cls: "bg-blue-100 text-blue-700",       icon: ArrowRightLeft },
                    ].map(({ label, key, cls, icon: Icon }) => (
                      <span key={key} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cls}`}>
                        <Icon size={12} /> {label} : {mouvResponse.stats[key] ?? 0}
                      </span>
                    ))}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Référence</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Produit</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Qté</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Motif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mouvLoading ? (
                        <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="animate-spin text-amber-500 mx-auto" /></td></tr>
                      ) : (mouvResponse?.data ?? []).length === 0 ? (
                        <tr><td colSpan={6} className="py-10 text-center text-slate-400">Aucun mouvement</td></tr>
                      ) : (mouvResponse?.data ?? []).map((m) => {
                        const typeCls = m.type === "ENTREE" ? "bg-emerald-100 text-emerald-700" : m.type === "SORTIE" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700";
                        const TypeIcon = m.type === "ENTREE" ? ArrowUpCircle : m.type === "SORTIE" ? ArrowDownCircle : ArrowRightLeft;
                        return (
                          <tr key={m.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(m.dateMouvement)}</td>
                            <td className="px-5 py-3 font-mono text-xs text-slate-600">{m.reference}</td>
                            <td className="px-5 py-3"><span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-bold ${typeCls}`}><TypeIcon size={11} /> {m.type}</span></td>
                            <td className="px-5 py-3 font-semibold text-slate-800 text-sm">{m.produit.nom}</td>
                            <td className="px-5 py-3 font-bold text-slate-700">{m.quantite}</td>
                            <td className="px-5 py-3 text-sm text-slate-500">{m.motif ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(mouvResponse?.meta?.totalPages ?? 0) > 1 && (
                  <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-sm text-slate-600">Page <b>{mouvPage}</b> / <b>{mouvResponse!.meta.totalPages}</b></p>
                    <div className="flex gap-2">
                      <button onClick={() => setMouvPage((p) => Math.max(1, p - 1))} disabled={mouvPage <= 1} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40 flex items-center gap-1"><ChevronLeft size={14} /> Préc.</button>
                      <button onClick={() => setMouvPage((p) => Math.min(mouvResponse!.meta.totalPages, p + 1))} disabled={mouvPage >= mouvResponse!.meta.totalPages} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40 flex items-center gap-1">Suiv. <ChevronRight size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Anomalies stock ── */}
            {mouvSubTab === "anomalies" && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <AlertOctagon size={18} className="text-red-600" />
                    Anomalies de stock signalées
                    <span className="text-sm text-slate-500 font-normal">{anomaliesResponse?.meta.total ?? 0} au total</span>
                  </h3>
                  <select value={anomaliesStatut} onChange={(e) => { setAnomaliesStatut(e.target.value); setAnomaliesPage(1); }} className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500">
                    <option value="">Tous les statuts</option>
                    <option value="EN_ATTENTE">En attente</option>
                    <option value="EN_COURS">En cours</option>
                    <option value="TRAITEE">Traitée</option>
                    <option value="TRANSMISE">Transmise</option>
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Référence</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Produit</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Qté</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Magasinier</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Statut</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {anomaliesLoading ? (
                        <tr><td colSpan={7} className="py-10 text-center"><Loader2 className="animate-spin text-amber-500 mx-auto" /></td></tr>
                      ) : (anomaliesResponse?.data ?? []).length === 0 ? (
                        <tr><td colSpan={7} className="py-10 text-center text-slate-400">Aucune anomalie</td></tr>
                      ) : (anomaliesResponse?.data ?? []).map((a) => {
                        const typeCls = a.type === "MANQUANT" ? "bg-red-100 text-red-700" : a.type === "SURPLUS" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700";
                        const statutCls = a.statut === "TRAITEE" ? "bg-emerald-100 text-emerald-700" : a.statut === "EN_ATTENTE" ? "bg-amber-100 text-amber-700" : a.statut === "TRANSMISE" ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700";
                        return (
                          <tr key={a.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3 font-mono text-xs text-slate-600">{a.reference}</td>
                            <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeCls}`}>{a.type}</span></td>
                            <td className="px-5 py-3 font-semibold text-slate-800 text-sm">{a.produit.nom}</td>
                            <td className="px-5 py-3 font-bold text-slate-700">{a.quantite}</td>
                            <td className="px-5 py-3 text-sm text-slate-600">{a.magasinier.prenom} {a.magasinier.nom}</td>
                            <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statutCls}`}>{a.statut.replace("_", " ")}</span></td>
                            <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(anomaliesResponse?.meta?.totalPages ?? 0) > 1 && (
                  <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-sm text-slate-600">Page <b>{anomaliesPage}</b> / <b>{anomaliesResponse!.meta.totalPages}</b></p>
                    <div className="flex gap-2">
                      <button onClick={() => setAnomaliesPage((p) => Math.max(1, p - 1))} disabled={anomaliesPage <= 1} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40 flex items-center gap-1"><ChevronLeft size={14} /> Préc.</button>
                      <button onClick={() => setAnomaliesPage((p) => Math.min(anomaliesResponse!.meta.totalPages, p + 1))} disabled={anomaliesPage >= anomaliesResponse!.meta.totalPages} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40 flex items-center gap-1">Suiv. <ChevronRight size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Bons de sortie ── */}
            {mouvSubTab === "bons" && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={18} className="text-slate-600" />
                    Bons de sortie — Rapport complet
                    <span className="text-sm text-slate-500 font-normal">{bonsResponse?.meta.total ?? 0} au total</span>
                  </h3>
                  <select value={bonsStatut} onChange={(e) => { setBonsStatut(e.target.value); setBonsPage(1); }} className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500">
                    <option value="">Tous les statuts</option>
                    <option value="EN_COURS">En cours</option>
                    <option value="EXPEDIE">Expédié</option>
                    <option value="RECU">Reçu</option>
                    <option value="ANNULE">Annulé</option>
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Référence</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Motif</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Magasinier</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Lignes</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Montant</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Statut</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bonsLoading ? (
                        <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="animate-spin text-amber-500 mx-auto" /></td></tr>
                      ) : (bonsResponse?.data ?? []).length === 0 ? (
                        <tr><td colSpan={8} className="py-10 text-center text-slate-400">Aucun bon de sortie</td></tr>
                      ) : (bonsResponse?.data ?? []).map((b) => {
                        const total = b.lignes.reduce((s, l) => s + l.quantite * Number(l.prixUnit), 0);
                        const statutCls = b.statut === "ANNULE" ? "bg-red-100 text-red-700" : b.statut === "RECU" ? "bg-emerald-100 text-emerald-700" : b.statut === "EXPEDIE" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700";
                        return (
                          <tr key={b.id} className={`hover:bg-slate-50 ${b.statut === "ANNULE" ? "bg-red-50/30" : ""}`}>
                            <td className="px-5 py-3 font-mono text-xs text-slate-600">{b.reference}</td>
                            <td className="px-5 py-3"><span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">{b.type}</span></td>
                            <td className="px-5 py-3 text-sm text-slate-600 max-w-[140px] truncate" title={b.motif}>{b.motif}</td>
                            <td className="px-5 py-3 text-sm text-slate-600">{b.magasinier.prenom} {b.magasinier.nom}</td>
                            <td className="px-5 py-3 text-sm text-slate-700">{b.lignes.length}</td>
                            <td className="px-5 py-3 font-bold text-slate-700 text-sm">{total > 0 ? formatCurrency(total) : "—"}</td>
                            <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statutCls}`}>{b.statut.replace("_", " ")}</span></td>
                            <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(b.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(bonsResponse?.meta?.totalPages ?? 0) > 1 && (
                  <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-sm text-slate-600">Page <b>{bonsPage}</b> / <b>{bonsResponse!.meta.totalPages}</b></p>
                    <div className="flex gap-2">
                      <button onClick={() => setBonsPage((p) => Math.max(1, p - 1))} disabled={bonsPage <= 1} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40 flex items-center gap-1"><ChevronLeft size={14} /> Préc.</button>
                      <button onClick={() => setBonsPage((p) => Math.min(bonsResponse!.meta.totalPages, p + 1))} disabled={bonsPage >= bonsResponse!.meta.totalPages} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-40 flex items-center gap-1">Suiv. <ChevronRight size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB: Rapports d'audit                                               */}
        {/* ================================================================== */}
        {activeTab === "rapports" && (
          <div className="space-y-6">
            {/* Formulaire de création */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                <PenLine size={20} className="text-amber-600" />
                Créer un rapport d&apos;audit
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type de rapport</label>
                  <select value={rapportType} onChange={(e) => setRapportType(e.target.value as typeof rapportType)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                    <option value="AUDIT">Rapport d&apos;audit interne</option>
                    <option value="ANOMALIES">Rapport d&apos;anomalies détectées</option>
                    <option value="RECOMMANDATIONS">Rapport de recommandations</option>
                    <option value="CONSOLIDE">Rapport consolidé (trimestriel / annuel)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Titre du rapport</label>
                  <input type="text" value={rapportTitre} onChange={(e) => setRapportTitre(e.target.value)} placeholder="Ex : Audit Q1 2026 — Point de vente Nord" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Période couverte</label>
                  <input type="text" value={rapportPeriode} onChange={(e) => setRapportPeriode(e.target.value)} placeholder="Ex : Janvier — Mars 2026" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Contenu / Observations / Recommandations</label>
                <textarea rows={8} value={rapportContenu} onChange={(e) => setRapportContenu(e.target.value)} placeholder="Saisir le contenu détaillé du rapport, les observations, les anomalies constatées, les recommandations..." className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y" />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={handleGenerateRapport} className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 font-semibold">
                  <Download size={18} /> Générer &amp; Télécharger (.txt)
                </button>
                <p className="text-xs text-slate-400">Pré-rempli avec les données actuelles du tableau de bord</p>
              </div>
            </div>

            {/* Exports disponibles */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Download size={20} className="text-slate-600" /> Exports CSV disponibles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Journal d'audit",      desc: "Tous les logs système",              action: () => setActiveTab("journal"),                                              icon: FileText,       color: "bg-amber-50 border-amber-200 text-amber-700" },
                  { label: "Mouvements de stock",  desc: "Historique entrées/sorties/ajust.",  action: () => { setActiveTab("mouvements"); setMouvSubTab("mouvements"); },         icon: ArrowRightLeft, color: "bg-blue-50 border-blue-200 text-blue-700" },
                  { label: "Anomalies de stock",   desc: "Toutes les anomalies signalées",     action: () => { setActiveTab("mouvements"); setMouvSubTab("anomalies"); },          icon: AlertOctagon,   color: "bg-red-50 border-red-200 text-red-700" },
                  { label: "Bons de sortie",       desc: "Rapport complet des sorties stock",  action: () => { setActiveTab("mouvements"); setMouvSubTab("bons"); },               icon: CheckCircle,    color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button key={i} onClick={item.action} className={`flex items-start gap-4 p-4 rounded-xl border text-left hover:opacity-80 transition-opacity ${item.color}`}>
                      <Icon size={22} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm">{item.label}</p>
                        <p className="text-xs opacity-70 mt-0.5">{item.desc} — cliquer pour aller à l&apos;onglet et exporter</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Synthèse auto pour rapport consolidé */}
            <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-lg"><BarChart3 size={20} /> Synthèse automatique — données actuelles</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                {[
                  { label: "Score conformité", value: `${d?.stats.scoreConformite ?? 100}/100` },
                  { label: "Anomalies",         value: String(d?.stats.anomaliesCount ?? 0) },
                  { label: "Logs système",      value: String(d?.stats.totalAuditLogs ?? 0) },
                  { label: "Gestionnaires",     value: String(d?.stats.gestionnaireActifs ?? 0) },
                  { label: "Produits stock",    value: String(d?.stock.totalProduits ?? 0) },
                  { label: "Ruptures stock",    value: String(d?.stock.enRupture ?? 0) },
                  { label: "Valeur stock",      value: formatCurrency(d?.stock.valeurTotale ?? 0) },
                  { label: "Éch. en retard",    value: String(d?.finances.echeancesEnRetard ?? 0) },
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 rounded-xl p-3">
                    <p className="text-2xl font-bold">{item.value}</p>
                    <p className="text-white/60 text-xs mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
