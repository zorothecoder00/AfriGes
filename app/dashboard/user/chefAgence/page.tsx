"use client";

import React, { useState, useMemo } from "react";
import {
  LayoutDashboard, Store, TrendingUp, Package, Wallet, Users,
  UserCheck, ShoppingBag, FileText, RefreshCw, Download,
  AlertTriangle, CheckCircle, XCircle, Clock, Search,
  ArrowRight, BarChart3, ArrowLeftRight, Plus, X,
  ChevronDown, ChevronUp, Eye, MapPin,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import UserPdvBadge from "@/components/UserPdvBadge";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToCsv } from "@/lib/exportCsv";

// ============================================================================
// TYPES
// ============================================================================

interface DashboardResponse {
  success: boolean;
  data: {
    zone: { nbPdvs: number; nbAgents: number; nbClients: number };
    ca: { aujourd: number; mois30j: number };
    stock: { valeur: number; ruptures: number; faibles: number };
    alertes: { type: "danger" | "warning" | "info"; message: string }[];
    anomalies: { stock: number };
    topPdvs: {
      id: number; nom: string; code: string; type: string;
      ca30j: number; caissOuverte: boolean;
      stock: { valeur: number; ruptures: number; faibles: number };
    }[];
    derniersClotures: {
      date: string; pdvId: number; pdvNom: string; caissierNom: string;
      totalVentes: number; montantTotal: number; ecart: number; hasEcart: boolean;
    }[];
    divers: { receptionsAttente: number; transfertsAttente: number; cloturesManquantes: number };
  };
}

interface PdvStatsResponse {
  success: boolean;
  data: {
    id: number; nom: string; code: string; type: string;
    ca: { total: number; vd: number; vp: number; nbVentes: number };
    stock: { valeur: number; ruptures: number; faibles: number };
    equipe: { total: number; parRole: Record<string, number> };
    derniereCloture: { date: string; montantTotal: number; ecart: number } | null;
    anomalies: number;
  }[];
  period: number;
}

interface Vente {
  id: number;
  source: "VD" | "VP";
  reference: string;
  date: string;
  montant: number;
  clientNom: string;
  agentNom: string;
  agentId: number | null;
  pdvNom: string;
  pdvId: number;
  modePaiement: string | null;
  packNom: string | null;
  lignes: { produitNom: string; quantite: number; prixUnitaire: number; total: number }[];
}

interface VentesResponse {
  success: boolean;
  ventes: Vente[];
  stats: { totalCA: number; totalVD: number; totalVP: number; nbVentes: number; nbVD: number; nbVP: number };
  meta: { total: number; page: number; limit: number };
}

interface StockPdv {
  pdvId: number; pdvNom: string; pdvCode: string;
  valeur: number; ruptures: number; faibles: number;
  produits: {
    id: number; nom: string; reference: string | null; categorie: string | null;
    unite: string | null; prixUnitaire: number; quantite: number;
    seuilAlerte: number; statut: "RUPTURE" | "ALERTE" | "OK"; valeur: number;
  }[];
}

interface StockResponse {
  success: boolean;
  data: {
    parPdv: StockPdv[];
    transfertsActifs: {
      id: number; reference: string; statut: string;
      origineNom: string; destinationNom: string;
      dateExpedition: string | null; createdAt: string;
      lignesResume: string; totalQuantite: number;
    }[];
    inventairesRecents: {
      id: number; reference: string; statut: string; date: string;
      pdvNom: string; realisePar: string; nbLignes: number; totalEcart: number;
      alertes: { produit: string; systeme: number; constate: number; ecart: number }[];
    }[];
    stats: { totalValeur: number; totalRuptures: number; totalFaibles: number; nbPdvs: number };
  };
}

interface CaisseResponse {
  success: boolean;
  data: {
    periode: { jours: number; depuis: string };
    stats: {
      totalClotureMontant: number; totalEcart: number; cloturesAvecEcart: number;
      totalEncaissements: number; totalDecaissements: number; soldeNet: number;
    };
    depensesParCategorie: { salaires: number; avances: number; fournisseurs: number; autres: number; total: number };
    sessionsActives: { id: number; caissierNom: string; statut: string; fondsCaisse: number; dateOuverture: string; pdvNom: string; pdvId: number | null }[];
    clotures: {
      id: number; date: string; pdvNom: string; pdvId: number | null; caissierNom: string;
      totalVentes: number; nbClients: number; montantTotal: number; panierMoyen: number;
      fondsCaisse: number; totalDecaissements: number; soldeTheorique: number;
      soldeReel: number | null; ecart: number; hasEcart: boolean; notes: string | null;
    }[];
    parPdv: { pdvId: number; pdvNom: string; totalMontant: number; totalEcart: number; count: number; avecEcart: number }[];
  };
}

interface Agent {
  affectationId: number;
  dateDebut: string;
  pdv: { id: number; nom: string; code: string };
  agent: { id: number; nom: string; prenom: string; email: string; telephone: string | null; etat: string; dateAdhesion: string; role: string; actif: boolean };
  performance: { nbVD: number; montantVD: number; nbVP: number; montantVP: number; totalCA: number; totalOps: number };
}

interface EquipeResponse {
  success: boolean;
  data: Agent[];
  stats: { total: number; actifs: number; statsPdv: Record<number, { nbAgents: number; parRole: Record<string, number> }> };
}

interface ClientItem {
  id: number; nom: string; prenom: string; telephone: string | null;
  adresse: string | null; etat: string; createdAt: string;
  pdv: { id: number; nom: string; code: string } | null;
  souscriptionsActives: { id: number; statut: string; packNom: string; packType: string; montantTotal: number; montantVerse: number; montantRestant: number }[];
  nbVentes: number; nbSouscriptions: number;
}

interface ClientsResponse {
  success: boolean;
  data: ClientItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface ApprovItem {
  id: number;
  docType: "COMMANDE" | "RECEPTION";
  reference: string;
  statut: string;
  createdAt: string;
  pdv: { id: number; nom: string; code: string };
  demandeurNom: string;
  notes: string | null;
  fournisseurNom?: string;
  datePrevisionnelle?: string;
  dateReception?: string | null;
  lignes: { produitId: number; produitNom: string; unite: string; quantiteDemandee?: number; quantiteValidee?: number; quantiteAttendue?: number; quantiteRecue?: number }[];
}

interface ApprovResponse {
  success: boolean;
  commandes: ApprovItem[];
  receptions: ApprovItem[];
  stats: { commandesAttente: number; receptionsAttente: number };
  meta: { totalCommandes: number; totalReceptions: number; page: number; limit: number };
}

type Tab = "vue_generale" | "pdvs" | "ventes" | "stock" | "caisse" | "equipe" | "clients" | "approvisionnement" | "rapports";

// ============================================================================
// HELPERS
// ============================================================================

function StatCard({ label, value, sub, color = "blue", icon: Icon }: {
  label: string; value: string | number; sub?: string;
  color?: "blue" | "green" | "red" | "orange" | "purple" | "indigo";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const colors = {
    blue:   "bg-blue-50 border-blue-200 text-blue-700",
    green:  "bg-green-50 border-green-200 text-green-700",
    red:    "bg-red-50 border-red-200 text-red-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium opacity-75">{label}</p>
        {Icon && <Icon className="w-4 h-4 opacity-60" />}
      </div>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function Badge({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    BROUILLON: "bg-gray-100 text-gray-700",
    SOUMISE: "bg-blue-100 text-blue-700",
    VALIDEE: "bg-green-100 text-green-700",
    EN_COURS: "bg-yellow-100 text-yellow-700",
    EXPEDIE: "bg-indigo-100 text-indigo-700",
    LIVREE: "bg-green-100 text-green-700",
    ANNULEE: "bg-red-100 text-red-700",
    TERMINEE: "bg-green-100 text-green-700",
    ACTIF: "bg-green-100 text-green-700",
    INACTIF: "bg-gray-100 text-gray-700",
    SUSPENDU: "bg-orange-100 text-orange-700",
    OUVERTE: "bg-green-100 text-green-700",
    SUSPENDUE: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[statut] ?? "bg-gray-100 text-gray-600"}`}>
      {statut.replace(/_/g, " ")}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ============================================================================
// PAGE PRINCIPALE
// ============================================================================

export default function ChefAgenceDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("vue_generale");

  // ── Filtres Ventes ───────────────────────────────────────────────────────
  const [ventePeriod,  setVentePeriod]  = useState(30);
  const [ventePdvId,   setVentePdvId]   = useState("");
  const [venteAgentId, setVenteAgentId] = useState("");
  const [venteType,    setVenteType]    = useState("all");
  const [ventePage,    setVentePage]    = useState(1);
  const [venteSearch,  setVenteSearch]  = useState("");
  const [venteExpanded, setVenteExpanded] = useState<number | null>(null);

  // ── Filtres Stock ────────────────────────────────────────────────────────
  const [stockPdvId,    setStockPdvId]    = useState("");
  const [stockExpanded, setStockExpanded] = useState<number | null>(null);

  // ── Filtres Caisse ───────────────────────────────────────────────────────
  const [caissePeriod, setCaissePeriod] = useState(30);
  const [caissePdvId,  setCaissePdvId]  = useState("");

  // ── Filtres PDVs ─────────────────────────────────────────────────────────
  const [pdvPeriod, setPdvPeriod] = useState(30);

  // ── Filtres Équipe ───────────────────────────────────────────────────────
  const [equipePdvId,  setEquipePdvId]  = useState("");
  const [equipeRole,   setEquipeRole]   = useState("");
  const [equipeSearch, setEquipeSearch] = useState("");

  // ── Filtres Clients ──────────────────────────────────────────────────────
  const [clientSearch,  setClientSearch]  = useState("");
  const [clientPdvId,   setClientPdvId]   = useState("");
  const [clientEtat,    setClientEtat]    = useState("");
  const [clientPage,    setClientPage]    = useState(1);

  // ── Filtres Approvisionnement ────────────────────────────────────────────
  const [approvType,   setApprovType]   = useState("all");
  const [approvStatut, setApprovStatut] = useState("");
  const [approvPage,   setApprovPage]   = useState(1);
  const [approvPdvId,  setApprovPdvId]  = useState("");

  // ── Modal affectation agent ──────────────────────────────────────────────
  const [showAffectModal, setShowAffectModal] = useState(false);
  const [affectUserId,    setAffectUserId]    = useState("");
  const [affectPdvId,     setAffectPdvId]     = useState("");
  const [affectNotes,     setAffectNotes]     = useState("");

  // ── useApi hooks ─────────────────────────────────────────────────────────
  const dashUrl = "/api/chef-agence/dashboard";
  const { data: dashData, loading: dashLoading, refetch: dashRefetch } =
    useApi<DashboardResponse>(dashUrl);

  const pdvUrl = `/api/chef-agence/pdv?period=${pdvPeriod}`;
  const { data: pdvData, loading: pdvLoading, refetch: pdvRefetch } =
    useApi<PdvStatsResponse>(activeTab === "pdvs" ? pdvUrl : null);

  const ventesUrl = useMemo(() => {
    const p = new URLSearchParams({
      period: String(ventePeriod),
      type: venteType,
      page: String(ventePage),
      limit: "20",
    });
    if (ventePdvId)   p.set("pdvId",   ventePdvId);
    if (venteAgentId) p.set("agentId", venteAgentId);
    return `/api/chef-agence/ventes?${p}`;
  }, [ventePeriod, venteType, ventePage, ventePdvId, venteAgentId]);
  const { data: ventesData, loading: ventesLoading, refetch: ventesRefetch } =
    useApi<VentesResponse>(activeTab === "ventes" ? ventesUrl : null);

  const stockUrl = `/api/chef-agence/stock${stockPdvId ? `?pdvId=${stockPdvId}` : ""}`;
  const { data: stockData, loading: stockLoading, refetch: stockRefetch } =
    useApi<StockResponse>(activeTab === "stock" ? stockUrl : null);

  const caisseUrl = `/api/chef-agence/caisse?period=${caissePeriod}${caissePdvId ? `&pdvId=${caissePdvId}` : ""}`;
  const { data: caisseData, loading: caisseLoading, refetch: caisseRefetch } =
    useApi<CaisseResponse>(activeTab === "caisse" ? caisseUrl : null);

  const equipeUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (equipePdvId)  p.set("pdvId",  equipePdvId);
    if (equipeRole)   p.set("role",   equipeRole);
    if (equipeSearch) p.set("search", equipeSearch);
    return `/api/chef-agence/equipe?${p}`;
  }, [equipePdvId, equipeRole, equipeSearch]);
  const { data: equipeData, loading: equipeLoading, refetch: equipeRefetch } =
    useApi<EquipeResponse>(activeTab === "equipe" ? equipeUrl : null);

  const clientsUrl = useMemo(() => {
    const p = new URLSearchParams({ page: String(clientPage), limit: "25" });
    if (clientSearch) p.set("search", clientSearch);
    if (clientPdvId)  p.set("pdvId",  clientPdvId);
    if (clientEtat)   p.set("etat",   clientEtat);
    return `/api/chef-agence/clients?${p}`;
  }, [clientPage, clientSearch, clientPdvId, clientEtat]);
  const { data: clientsData, loading: clientsLoading, refetch: clientsRefetch } =
    useApi<ClientsResponse>(activeTab === "clients" ? clientsUrl : null);

  const approvUrl = useMemo(() => {
    const p = new URLSearchParams({ type: approvType, page: String(approvPage) });
    if (approvStatut) p.set("statut", approvStatut);
    if (approvPdvId)  p.set("pdvId",  approvPdvId);
    return `/api/chef-agence/approvisionnement?${p}`;
  }, [approvType, approvPage, approvStatut, approvPdvId]);
  const { data: approvData, loading: approvLoading, refetch: approvRefetch } =
    useApi<ApprovResponse>(activeTab === "approvisionnement" ? approvUrl : null);

  // ── Mutation affectation ─────────────────────────────────────────────────
  const { mutate: affecterAgent, loading: affectLoading } = useMutation<
    { message: string },
    { userId: number; pointDeVenteId: number; notes?: string }
  >("/api/chef-agence/equipe", "POST", {
    successMessage: "Agent affecté avec succès",
    errorMessage: "Erreur lors de l'affectation",
  });

  // ── Helpers locaux ───────────────────────────────────────────────────────
  const pdvList = dashData?.data?.topPdvs?.map(p => ({ id: p.id, nom: p.nom, code: p.code })) ?? [];

  const ventesFiltrees = useMemo(() => {
    if (!ventesData?.ventes) return [];
    if (!venteSearch) return ventesData.ventes;
    const s = venteSearch.toLowerCase();
    return ventesData.ventes.filter(
      (v) =>
        v.reference.toLowerCase().includes(s) ||
        v.clientNom.toLowerCase().includes(s) ||
        v.agentNom.toLowerCase().includes(s)
    );
  }, [ventesData, venteSearch]);

  async function handleAffecterAgent() {
    if (!affectUserId || !affectPdvId) return;
    const result = await affecterAgent({
      userId: Number(affectUserId),
      pointDeVenteId: Number(affectPdvId),
      notes: affectNotes || undefined,
    });
    if (result) {
      setShowAffectModal(false);
      setAffectUserId("");
      setAffectPdvId("");
      setAffectNotes("");
      equipeRefetch();
    }
  }

  // ── CSV Exports ──────────────────────────────────────────────────────────
  function exportVentesCsv() {
    if (!ventesData?.ventes.length) return;
    exportToCsv(
      ventesData.ventes,
      [
        { label: "Référence",    key: "reference" },
        { label: "Type",         key: "source" },
        { label: "Date",         key: "date",    format: (v) => formatDate(v as string) },
        { label: "PDV",          key: "pdvNom" },
        { label: "Agent",        key: "agentNom" },
        { label: "Client",       key: "clientNom" },
        { label: "Montant (XAF)",key: "montant", format: (v) => String(v) },
        { label: "Paiement",     key: "modePaiement", format: (v) => (v as string | null) ?? "" },
      ],
      `ventes_zone_${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  function exportClientsCsv() {
    if (!clientsData?.data.length) return;
    exportToCsv(
      clientsData.data,
      [
        { label: "Nom",       key: "nom" },
        { label: "Prénom",    key: "prenom" },
        { label: "Téléphone", key: "telephone", format: (v) => (v as string | null) ?? "" },
        { label: "PDV",       key: "pdv", format: (_v, row) => (row.pdv as ClientItem["pdv"])?.nom ?? "" },
        { label: "État",      key: "etat" },
        { label: "Nb Ventes", key: "nbVentes", format: (v) => String(v) },
        { label: "Nb Souscriptions", key: "nbSouscriptions", format: (v) => String(v) },
        { label: "Inscrit le", key: "createdAt", format: (v) => formatDate(v as string) },
      ],
      `clients_zone_${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  function exportEquipeCsv() {
    if (!equipeData?.data.length) return;
    exportToCsv(
      equipeData.data,
      [
        { label: "Nom",       key: "agent", format: (_v, row) => `${(row as Agent).agent.prenom} ${(row as Agent).agent.nom}` },
        { label: "Rôle",      key: "agent", format: (_v, row) => (row as Agent).agent.role },
        { label: "PDV",       key: "pdv",   format: (_v, row) => (row as Agent).pdv.nom },
        { label: "Téléphone", key: "agent", format: (_v, row) => (row as Agent).agent.telephone ?? "" },
        { label: "CA 30j",    key: "performance", format: (_v, row) => String((row as Agent).performance.totalCA) },
        { label: "Nb Ops 30j",key: "performance", format: (_v, row) => String((row as Agent).performance.totalOps) },
      ],
      `equipe_zone_${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  // ── Tabs config ──────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "vue_generale",     label: "Vue Générale",     icon: LayoutDashboard },
    { key: "pdvs",             label: "Points de Vente",  icon: Store },
    { key: "ventes",           label: "Ventes",           icon: TrendingUp },
    { key: "stock",            label: "Stock",            icon: Package },
    { key: "caisse",           label: "Caisse",           icon: Wallet },
    { key: "equipe",           label: "Équipe",           icon: Users },
    { key: "clients",          label: "Clients",          icon: UserCheck },
    { key: "approvisionnement",label: "Approvisionnement",icon: ShoppingBag },
    { key: "rapports",         label: "Rapports",         icon: FileText },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <ArrowRight className="w-4 h-4 rotate-180" />
            </Link>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-600" />
              <span className="font-semibold text-gray-900">Chef d&apos;Agence</span>
            </div>
            {dashData?.data?.zone && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {dashData.data.zone.nbPdvs} PDV{dashData.data.zone.nbPdvs !== 1 ? "s" : ""} dans ma zone
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={dashRefetch} className="p-1.5 text-gray-400 hover:text-gray-600">
              <RefreshCw className="w-4 h-4" />
            </button>
            <MessagesLink />
            <NotificationBell href="/dashboard/user/notifications" />
            <UserPdvBadge />
            <SignOutButton />
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-screen-2xl mx-auto px-4 flex gap-1 overflow-x-auto pb-0">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-6">

        {/* ================================================================ */}
        {/* TAB: VUE GÉNÉRALE                                                 */}
        {/* ================================================================ */}
        {activeTab === "vue_generale" && (
          <div className="space-y-6">
            {dashLoading && <Spinner />}
            {!dashLoading && dashData?.data && (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <StatCard label="CA Aujourd'hui" value={formatCurrency(dashData.data.ca.aujourd)} color="green" icon={TrendingUp} />
                  <StatCard label="CA 30 jours" value={formatCurrency(dashData.data.ca.mois30j)} color="blue" icon={BarChart3} />
                  <StatCard label="Valeur Stock" value={formatCurrency(dashData.data.stock.valeur)} color="indigo" icon={Package} />
                  <StatCard label="Ruptures Stock" value={dashData.data.stock.ruptures} color={dashData.data.stock.ruptures > 0 ? "red" : "green"} icon={AlertTriangle} />
                  <StatCard label="Agents Équipe" value={dashData.data.zone.nbAgents} color="purple" icon={Users} />
                  <StatCard label="Clients Zone" value={dashData.data.zone.nbClients} color="orange" icon={UserCheck} />
                </div>

                {/* Alertes */}
                {dashData.data.alertes.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-gray-700">Alertes actives</h2>
                    <div className="grid gap-2">
                      {dashData.data.alertes.map((a, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                            a.type === "danger"
                              ? "bg-red-50 border-red-200 text-red-800"
                              : a.type === "warning"
                              ? "bg-orange-50 border-orange-200 text-orange-800"
                              : "bg-blue-50 border-blue-200 text-blue-800"
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <p className="text-xs">{a.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Top PDVs */}
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3">Top PDVs — CA 30 jours</h2>
                    <div className="bg-white rounded-lg border border-gray-200 divide-y">
                      {dashData.data.topPdvs.length === 0 && <EmptyState message="Aucune donnée" />}
                      {dashData.data.topPdvs.map((pdv, i) => (
                        <div key={pdv.id} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <span className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded-full ${i === 0 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{pdv.nom}</p>
                              <p className="text-xs text-gray-400">{pdv.code}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-indigo-600">{formatCurrency(pdv.ca30j)}</p>
                            {pdv.stock.ruptures > 0 && (
                              <p className="text-xs text-red-500">{pdv.stock.ruptures} rupture{pdv.stock.ruptures > 1 ? "s" : ""}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Anomalies + Dernières clôtures */}
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-700 mb-3">Anomalies à traiter</h2>
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Stocks en rupture" value={dashData.data.anomalies.stock} color={dashData.data.anomalies.stock > 0 ? "red" : "green"} />
                        <StatCard label="Clôtures manquantes" value={dashData.data.divers.cloturesManquantes} color={dashData.data.divers.cloturesManquantes > 0 ? "orange" : "green"} />
                        <StatCard label="Réceptions en attente" value={dashData.data.divers.receptionsAttente} color={dashData.data.divers.receptionsAttente > 0 ? "purple" : "green"} />
                        <StatCard label="Transferts en cours" value={dashData.data.divers.transfertsAttente} color={dashData.data.divers.transfertsAttente > 0 ? "blue" : "green"} />
                      </div>
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold text-gray-700 mb-3">Dernières clôtures</h2>
                      <div className="bg-white rounded-lg border border-gray-200 divide-y">
                        {dashData.data.derniersClotures.length === 0 && <EmptyState message="Aucune clôture récente" />}
                        {dashData.data.derniersClotures.map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{c.pdvNom}</p>
                              <p className="text-xs text-gray-400">{c.caissierNom} · {formatDate(c.date)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">{formatCurrency(c.montantTotal)}</p>
                              {c.ecart !== 0 && (
                                <p className={`text-xs font-medium ${c.ecart < 0 ? "text-red-600" : "text-orange-500"}`}>
                                  Écart {c.ecart > 0 ? "+" : ""}{formatCurrency(c.ecart)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: POINTS DE VENTE                                             */}
        {/* ================================================================ */}
        {activeTab === "pdvs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Statistiques par PDV</h2>
              <div className="flex items-center gap-2">
                <select
                  value={pdvPeriod}
                  onChange={(e) => { setPdvPeriod(Number(e.target.value)); pdvRefetch(); }}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5"
                >
                  <option value={7}>7 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={90}>90 jours</option>
                </select>
                <button onClick={pdvRefetch} className="p-1.5 text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {pdvLoading && <Spinner />}
            {!pdvLoading && pdvData && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pdvData.data.map((pdv) => (
                  <div key={pdv.id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{pdv.nom}</h3>
                        <p className="text-xs text-gray-400">{pdv.code} · {pdv.type}</p>
                      </div>
                      {pdv.anomalies > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          {pdv.anomalies}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-green-50 rounded p-2">
                        <p className="text-xs text-green-600 font-medium">CA {pdvPeriod}j</p>
                        <p className="font-bold text-green-700">{formatCurrency(pdv.ca.total)}</p>
                        <p className="text-xs text-green-500">{pdv.ca.nbVentes} ventes</p>
                      </div>
                      <div className="bg-indigo-50 rounded p-2">
                        <p className="text-xs text-indigo-600 font-medium">Stock</p>
                        <p className="font-bold text-indigo-700">{formatCurrency(pdv.stock.valeur)}</p>
                        <p className="text-xs text-indigo-500">
                          {pdv.stock.ruptures > 0 && <span className="text-red-500">{pdv.stock.ruptures} rupture{pdv.stock.ruptures !== 1 ? "s" : ""} </span>}
                          {pdv.stock.faibles > 0 && <span className="text-orange-500">{pdv.stock.faibles} alerte{pdv.stock.faibles !== 1 ? "s" : ""}</span>}
                          {pdv.stock.ruptures === 0 && pdv.stock.faibles === 0 && <span className="text-green-500">OK</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {pdv.equipe.total} agent{pdv.equipe.total !== 1 ? "s" : ""}
                      </span>
                      {pdv.derniereCloture ? (
                        <span className={pdv.derniereCloture.ecart !== 0 ? "text-red-500 font-medium" : "text-gray-400"}>
                          Clôture {formatDate(pdv.derniereCloture.date)}
                          {pdv.derniereCloture.ecart !== 0 && ` · Écart ${formatCurrency(pdv.derniereCloture.ecart)}`}
                        </span>
                      ) : (
                        <span className="text-orange-500">Pas de clôture récente</span>
                      )}
                    </div>

                    {Object.keys(pdv.equipe?.parRole || {}).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(pdv.equipe?.parRole || {}).map(([role, count]) => (
                          <span key={role} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {role.replace(/_/g, " ")} ({count})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {pdvData.data.length === 0 && <EmptyState message="Aucun PDV dans votre zone" />}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: VENTES                                                       */}
        {/* ================================================================ */}
        {activeTab === "ventes" && (
          <div className="space-y-4">
            {/* Filtres */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Période</label>
                  <select value={ventePeriod} onChange={(e) => { setVentePeriod(Number(e.target.value)); setVentePage(1); }}
                    className="text-sm border border-gray-300 rounded px-2 py-1.5">
                    <option value={7}>7 jours</option>
                    <option value={30}>30 jours</option>
                    <option value={90}>90 jours</option>
                    <option value={365}>1 an</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select value={venteType} onChange={(e) => { setVenteType(e.target.value); setVentePage(1); }}
                    className="text-sm border border-gray-300 rounded px-2 py-1.5">
                    <option value="all">Tout</option>
                    <option value="VD">Ventes directes</option>
                    <option value="VP">Versements pack</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">PDV</label>
                  <select value={ventePdvId} onChange={(e) => { setVentePdvId(e.target.value); setVentePage(1); }}
                    className="text-sm border border-gray-300 rounded px-2 py-1.5">
                    <option value="">Tous les PDVs</option>
                    {pdvList.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Recherche</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      value={venteSearch} onChange={(e) => setVenteSearch(e.target.value)}
                      placeholder="Réf, client, agent..."
                      className="pl-7 pr-3 py-1.5 text-sm border border-gray-300 rounded w-48"
                    />
                  </div>
                </div>
                <div className="flex gap-2 ml-auto">
                  <button onClick={ventesRefetch} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                    <RefreshCw className="w-3.5 h-3.5" /> Actualiser
                  </button>
                  <button onClick={exportVentesCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700">
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Stats ventes */}
            {ventesData?.stats && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <StatCard label="CA Total" value={formatCurrency(ventesData.stats.totalCA)} color="green" />
                <StatCard label="CA Ventes Directes" value={formatCurrency(ventesData.stats.totalVD)} color="blue" />
                <StatCard label="CA Versements Pack" value={formatCurrency(ventesData.stats.totalVP)} color="indigo" />
                <StatCard label="Nb Opérations" value={ventesData.stats.nbVentes} color="purple" />
                <StatCard label="Nb VD" value={ventesData.stats.nbVD} color="blue" />
                <StatCard label="Nb VP" value={ventesData.stats.nbVP} color="indigo" />
              </div>
            )}

            {ventesLoading && <Spinner />}
            {!ventesLoading && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Référence</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">PDV</th>
                      <th className="px-3 py-2 text-left">Agent</th>
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-right">Montant</th>
                      <th className="px-3 py-2 text-center">Détail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ventesFiltrees.length === 0 && (
                      <tr><td colSpan={8}><EmptyState message="Aucune vente pour ces critères" /></td></tr>
                    )}
                    {ventesFiltrees.map((v) => (
                      <React.Fragment key={`${v.source}-${v.id}`}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">{v.reference}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${v.source === "VD" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                              {v.source === "VD" ? "Vente directe" : "Versement pack"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{formatDate(v.date)}</td>
                          <td className="px-3 py-2 text-gray-600">{v.pdvNom}</td>
                          <td className="px-3 py-2 text-gray-600">{v.agentNom}</td>
                          <td className="px-3 py-2 text-gray-600">{v.clientNom}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(v.montant)}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => setVenteExpanded(venteExpanded === v.id ? null : v.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {venteExpanded === v.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>
                        {venteExpanded === v.id && (
                          <tr className="bg-gray-50">
                            <td colSpan={8} className="px-4 py-2">
                              <div className="text-xs text-gray-600 space-y-1">
                                {v.packNom && <p><span className="font-medium">Pack :</span> {v.packNom}</p>}
                                {v.modePaiement && <p><span className="font-medium">Paiement :</span> {v.modePaiement}</p>}
                                {v.lignes.length > 0 && (
                                  <table className="mt-1 w-full">
                                    <thead className="text-gray-400 border-b border-gray-200">
                                      <tr>
                                        <th className="text-left py-1">Produit</th>
                                        <th className="text-right py-1">Qté</th>
                                        <th className="text-right py-1">Prix U.</th>
                                        <th className="text-right py-1">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {v.lignes.map((l, i) => (
                                        <tr key={i}>
                                          <td className="py-1">{l.produitNom}</td>
                                          <td className="text-right py-1">{l.quantite}</td>
                                          <td className="text-right py-1">{formatCurrency(l.prixUnitaire)}</td>
                                          <td className="text-right py-1 font-medium">{formatCurrency(l.total)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {ventesData && ventesData.meta.total > 20 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
                    <span>{ventesData.meta.total} résultats</span>
                    <div className="flex gap-1">
                      <button onClick={() => setVentePage(p => Math.max(1, p - 1))} disabled={ventePage === 1}
                        className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">‹</button>
                      <span className="px-3 py-1">Page {ventePage}</span>
                      <button onClick={() => setVentePage(p => p + 1)} disabled={ventesData.meta.total <= ventePage * 20}
                        className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">›</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: STOCK                                                        */}
        {/* ================================================================ */}
        {activeTab === "stock" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Gestion du Stock</h2>
              <div className="flex items-center gap-2">
                <select value={stockPdvId} onChange={(e) => setStockPdvId(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Tous les PDVs</option>
                  {pdvList.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
                <button onClick={stockRefetch} className="p-1.5 text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {stockLoading && <Spinner />}
            {!stockLoading && stockData && (
              <>
                {/* Stats globales */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Valeur totale" value={formatCurrency(stockData.data.stats.totalValeur)} color="indigo" icon={Package} />
                  <StatCard label="Ruptures" value={stockData.data.stats.totalRuptures} color={stockData.data.stats.totalRuptures > 0 ? "red" : "green"} icon={XCircle} />
                  <StatCard label="Alertes faibles" value={stockData.data.stats.totalFaibles} color={stockData.data.stats.totalFaibles > 0 ? "orange" : "green"} icon={AlertTriangle} />
                </div>

                {/* Par PDV */}
                <div className="space-y-3">
                  {stockData.data.parPdv.map((pdv) => (
                    <div key={pdv.pdvId} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setStockExpanded(stockExpanded === pdv.pdvId ? null : pdv.pdvId)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <Store className="w-4 h-4 text-gray-400" />
                          <div className="text-left">
                            <p className="font-medium text-gray-900">{pdv.pdvNom}</p>
                            <p className="text-xs text-gray-400">{pdv.pdvCode}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-indigo-600">{formatCurrency(pdv.valeur)}</p>
                            <p className="text-xs text-gray-400">{pdv.produits.length} produits</p>
                          </div>
                          {pdv.ruptures > 0 && <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{pdv.ruptures} rupture{pdv.ruptures !== 1 ? "s" : ""}</span>}
                          {pdv.faibles > 0 && <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">{pdv.faibles} alerte{pdv.faibles !== 1 ? "s" : ""}</span>}
                          {stockExpanded === pdv.pdvId ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </button>

                      {stockExpanded === pdv.pdvId && (
                        <div className="border-t border-gray-100 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500">
                              <tr>
                                <th className="px-3 py-2 text-left">Produit</th>
                                <th className="px-3 py-2 text-left">Catégorie</th>
                                <th className="px-3 py-2 text-right">Qté</th>
                                <th className="px-3 py-2 text-right">Seuil</th>
                                <th className="px-3 py-2 text-right">Valeur</th>
                                <th className="px-3 py-2 text-center">Statut</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {pdv.produits.map((p) => (
                                <tr key={p.id} className={p.statut === "RUPTURE" ? "bg-red-50" : p.statut === "ALERTE" ? "bg-orange-50" : ""}>
                                  <td className="px-3 py-2 font-medium">{p.nom}</td>
                                  <td className="px-3 py-2 text-gray-400">{p.categorie ?? "—"}</td>
                                  <td className="px-3 py-2 text-right">{p.quantite} {p.unite ?? ""}</td>
                                  <td className="px-3 py-2 text-right text-gray-400">{p.seuilAlerte > 0 ? p.seuilAlerte : "—"}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(p.valeur)}</td>
                                  <td className="px-3 py-2 text-center">
                                    {p.statut === "RUPTURE" && <span className="text-red-600 font-semibold">RUPTURE</span>}
                                    {p.statut === "ALERTE" && <span className="text-orange-600 font-semibold">ALERTE</span>}
                                    {p.statut === "OK" && <CheckCircle className="w-3.5 h-3.5 text-green-500 mx-auto" />}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Transferts actifs */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <ArrowLeftRight className="w-4 h-4" /> Transferts actifs
                    </h3>
                    <div className="bg-white border border-gray-200 rounded-lg divide-y">
                      {stockData.data.transfertsActifs.length === 0 && <EmptyState message="Aucun transfert en cours" />}
                      {stockData.data.transfertsActifs.map((t) => (
                        <div key={t.id} className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-gray-500">{t.reference}</span>
                            <Badge statut={t.statut} />
                          </div>
                          <p className="text-sm text-gray-700">
                            {t.origineNom} → {t.destinationNom}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{t.lignesResume} · {t.totalQuantite} unités</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Inventaires récents */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Inventaires récents</h3>
                    <div className="bg-white border border-gray-200 rounded-lg divide-y">
                      {stockData.data.inventairesRecents.length === 0 && <EmptyState message="Aucun inventaire récent" />}
                      {stockData.data.inventairesRecents.map((inv) => (
                        <div key={inv.id} className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <span className="text-xs font-medium text-gray-700">{inv.pdvNom}</span>
                              <span className="text-xs text-gray-400 ml-1">· {formatDate(inv.date)}</span>
                            </div>
                            <Badge statut={inv.statut} />
                          </div>
                          <p className="text-xs text-gray-400">{inv.realisePar} · {inv.nbLignes} lignes</p>
                          {inv.totalEcart !== 0 && (
                            <p className="text-xs text-red-600 font-medium mt-1">Écart total : {inv.totalEcart}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: CAISSE (lecture seule)                                       */}
        {/* ================================================================ */}
        {activeTab === "caisse" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">Supervision Caisses</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Lecture seule</span>
              </div>
              <div className="flex items-center gap-2">
                <select value={caissePeriod} onChange={(e) => setCaissePeriod(Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value={7}>7 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={90}>90 jours</option>
                </select>
                <select value={caissePdvId} onChange={(e) => setCaissePdvId(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Tous les PDVs</option>
                  {pdvList.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
                <button onClick={caisseRefetch} className="p-1.5 text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {caisseLoading && <Spinner />}
            {!caisseLoading && caisseData && (
              <>
                {/* Stats globales */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  <StatCard label="Total clôtures" value={formatCurrency(caisseData.data.stats.totalClotureMontant)} color="green" />
                  <StatCard label="Écart total" value={formatCurrency(caisseData.data.stats.totalEcart)} color={caisseData.data.stats.totalEcart !== 0 ? "red" : "green"} />
                  <StatCard label="Clôtures avec écart" value={caisseData.data.stats.cloturesAvecEcart} color={caisseData.data.stats.cloturesAvecEcart > 0 ? "orange" : "green"} />
                  <StatCard label="Encaissements" value={formatCurrency(caisseData.data.stats.totalEncaissements)} color="blue" />
                  <StatCard label="Décaissements" value={formatCurrency(caisseData.data.stats.totalDecaissements)} color="purple" />
                  <StatCard label="Solde net" value={formatCurrency(caisseData.data.stats.soldeNet)} color={caisseData.data.stats.soldeNet >= 0 ? "green" : "red"} />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Sessions actives */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-green-500" />
                      Sessions actives ({caisseData.data.sessionsActives.length})
                    </h3>
                    <div className="bg-white border border-gray-200 rounded-lg divide-y">
                      {caisseData.data.sessionsActives.length === 0 && <EmptyState message="Aucune session active" />}
                      {caisseData.data.sessionsActives.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{s.caissierNom}</p>
                            <p className="text-xs text-gray-400">{s.pdvNom} · Depuis {formatDate(s.dateOuverture)}</p>
                          </div>
                          <div className="text-right">
                            <Badge statut={s.statut} />
                            <p className="text-xs text-gray-400 mt-1">Fonds : {formatCurrency(s.fondsCaisse)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dépenses par catégorie */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Dépenses par catégorie</h3>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                      {[
                        { label: "Salaires", value: caisseData.data.depensesParCategorie.salaires },
                        { label: "Avances", value: caisseData.data.depensesParCategorie.avances },
                        { label: "Fournisseurs", value: caisseData.data.depensesParCategorie.fournisseurs },
                        { label: "Autres", value: caisseData.data.depensesParCategorie.autres },
                      ].map(({ label, value }) => {
                        const total = caisseData.data.depensesParCategorie.total || 1;
                        const pct = Math.round((value / total) * 100);
                        return (
                          <div key={label}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">{label}</span>
                              <span className="font-medium">{formatCurrency(value)}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold">
                        <span>Total</span>
                        <span>{formatCurrency(caisseData.data.depensesParCategorie.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clôtures récentes */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Clôtures récentes</h3>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">PDV</th>
                          <th className="px-3 py-2 text-left">Caissier</th>
                          <th className="px-3 py-2 text-right">Ventes</th>
                          <th className="px-3 py-2 text-right">Montant</th>
                          <th className="px-3 py-2 text-right">Solde théorique</th>
                          <th className="px-3 py-2 text-right">Solde réel</th>
                          <th className="px-3 py-2 text-right">Écart</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {caisseData.data.clotures.length === 0 && (
                          <tr><td colSpan={8}><EmptyState message="Aucune clôture" /></td></tr>
                        )}
                        {caisseData.data.clotures.map((c) => (
                          <tr key={c.id} className={c.hasEcart ? "bg-red-50" : ""}>
                            <td className="px-3 py-2 text-gray-500">{formatDate(c.date)}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">{c.pdvNom}</td>
                            <td className="px-3 py-2 text-gray-600">{c.caissierNom}</td>
                            <td className="px-3 py-2 text-right">{c.totalVentes}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(c.montantTotal)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(c.soldeTheorique)}</td>
                            <td className="px-3 py-2 text-right">{c.soldeReel !== null ? formatCurrency(c.soldeReel) : "—"}</td>
                            <td className={`px-3 py-2 text-right font-medium ${c.ecart < 0 ? "text-red-600" : c.ecart > 0 ? "text-orange-600" : "text-green-600"}`}>
                              {c.ecart === 0 ? "—" : (c.ecart > 0 ? "+" : "") + formatCurrency(c.ecart)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Par PDV */}
                {caisseData.data.parPdv.length > 1 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Récapitulatif par PDV</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {caisseData.data.parPdv.map((p) => (
                        <div key={p.pdvId} className="bg-white border border-gray-200 rounded-lg p-3">
                          <p className="font-medium text-gray-900 mb-2">{p.pdvNom}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-gray-400">Total clôtures</p>
                              <p className="font-semibold">{p.count}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Montant</p>
                              <p className="font-semibold">{formatCurrency(p.totalMontant)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Avec écart</p>
                              <p className={`font-semibold ${p.avecEcart > 0 ? "text-red-600" : "text-green-600"}`}>{p.avecEcart}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Écart total</p>
                              <p className={`font-semibold ${p.totalEcart !== 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(p.totalEcart)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: ÉQUIPE                                                       */}
        {/* ================================================================ */}
        {activeTab === "equipe" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-base font-semibold text-gray-900">Mon Équipe</h2>
                {equipeData && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {equipeData.stats.total} agent{equipeData.stats.total !== 1 ? "s" : ""} · {equipeData.stats.actifs} actif{equipeData.stats.actifs !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input value={equipeSearch} onChange={(e) => setEquipeSearch(e.target.value)}
                    placeholder="Nom, email..."
                    className="pl-7 pr-3 py-1.5 text-sm border border-gray-300 rounded w-40" />
                </div>
                <select value={equipePdvId} onChange={(e) => setEquipePdvId(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Tous les PDVs</option>
                  {pdvList.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
                <select value={equipeRole} onChange={(e) => setEquipeRole(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Tous les rôles</option>
                  <option value="CAISSIER">Caissier</option>
                  <option value="AGENT_TERRAIN">Agent terrain</option>
                  <option value="COMMERCIAL">Commercial</option>
                  <option value="RESPONSABLE_POINT_DE_VENTE">RPV</option>
                </select>
                <button onClick={equipeRefetch} className="p-1.5 text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowAffectModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Affecter un agent
                </button>
                <button onClick={exportEquipeCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>

            {equipeLoading && <Spinner />}
            {!equipeLoading && equipeData && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Agent</th>
                      <th className="px-3 py-2 text-left">Rôle</th>
                      <th className="px-3 py-2 text-left">PDV</th>
                      <th className="px-3 py-2 text-left">Contact</th>
                      <th className="px-3 py-2 text-right">CA 30j</th>
                      <th className="px-3 py-2 text-right">Ops 30j</th>
                      <th className="px-3 py-2 text-center">État</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {equipeData.data.length === 0 && (
                      <tr><td colSpan={7}><EmptyState message="Aucun agent dans cette sélection" /></td></tr>
                    )}
                    {equipeData.data.map((a) => (
                      <tr key={a.affectationId} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900">{a.agent.prenom} {a.agent.nom}</p>
                          <p className="text-xs text-gray-400">{a.agent.email}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                            {a.agent.role.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{a.pdv.nom}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{a.agent.telephone ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold text-indigo-600">{formatCurrency(a.performance.totalCA)}</td>
                        <td className="px-3 py-2 text-right">{a.performance.totalOps}</td>
                        <td className="px-3 py-2 text-center">
                          {a.agent.actif && a.agent.etat === "ACTIF"
                            ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                            : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: CLIENTS                                                      */}
        {/* ================================================================ */}
        {activeTab === "clients" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-base font-semibold text-gray-900">Base Clients</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setClientPage(1); }}
                    placeholder="Nom, téléphone..."
                    className="pl-7 pr-3 py-1.5 text-sm border border-gray-300 rounded w-44" />
                </div>
                <select value={clientPdvId} onChange={(e) => { setClientPdvId(e.target.value); setClientPage(1); }}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Tous les PDVs</option>
                  {pdvList.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
                <select value={clientEtat} onChange={(e) => { setClientEtat(e.target.value); setClientPage(1); }}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Tous les états</option>
                  <option value="ACTIF">Actif</option>
                  <option value="INACTIF">Inactif</option>
                  <option value="SUSPENDU">Suspendu</option>
                </select>
                <button onClick={clientsRefetch} className="p-1.5 text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={exportClientsCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>

            {clientsLoading && <Spinner />}
            {!clientsLoading && clientsData && (
              <>
                {clientsData.meta && (
                  <p className="text-xs text-gray-500">{clientsData.meta.total} client{clientsData.meta.total !== 1 ? "s" : ""} trouvé{clientsData.meta.total !== 1 ? "s" : ""}</p>
                )}
                <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Client</th>
                        <th className="px-3 py-2 text-left">PDV</th>
                        <th className="px-3 py-2 text-left">Téléphone</th>
                        <th className="px-3 py-2 text-right">Nb Ventes</th>
                        <th className="px-3 py-2 text-right">Souscriptions actives</th>
                        <th className="px-3 py-2 text-center">État</th>
                        <th className="px-3 py-2 text-left">Inscrit le</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {clientsData.data.length === 0 && (
                        <tr><td colSpan={7}><EmptyState message="Aucun client" /></td></tr>
                      )}
                      {clientsData.data.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-900">{c.prenom} {c.nom}</p>
                            {c.adresse && <p className="text-xs text-gray-400">{c.adresse}</p>}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{c.pdv?.nom ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{c.telephone ?? "—"}</td>
                          <td className="px-3 py-2 text-right">{c.nbVentes}</td>
                          <td className="px-3 py-2 text-right">
                            {c.souscriptionsActives.length > 0 ? (
                              <div className="space-y-0.5">
                                {c.souscriptionsActives.map((s) => (
                                  <div key={s.id} className="text-xs">
                                    <span className="font-medium">{s.packNom}</span>
                                    <span className="text-gray-400 ml-1">{formatCurrency(s.montantRestant)} restant</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center"><Badge statut={c.etat} /></td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {clientsData.meta.totalPages > 1 && (
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Page {clientsData.meta.page} / {clientsData.meta.totalPages}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setClientPage(p => Math.max(1, p - 1))} disabled={clientPage === 1}
                        className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">‹</button>
                      <button onClick={() => setClientPage(p => Math.min(clientsData.meta.totalPages, p + 1))} disabled={clientPage >= clientsData.meta.totalPages}
                        className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">›</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: APPROVISIONNEMENT                                            */}
        {/* ================================================================ */}
        {activeTab === "approvisionnement" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-gray-900">Approvisionnement</h2>
                {approvData?.stats && (
                  <div className="flex gap-2">
                    {approvData.stats.commandesAttente > 0 && (
                      <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        {approvData.stats.commandesAttente} commande{approvData.stats.commandesAttente !== 1 ? "s" : ""} en attente
                      </span>
                    )}
                    {approvData.stats.receptionsAttente > 0 && (
                      <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                        {approvData.stats.receptionsAttente} réception{approvData.stats.receptionsAttente !== 1 ? "s" : ""} en attente
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={approvType} onChange={(e) => { setApprovType(e.target.value); setApprovPage(1); }}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="all">Tout</option>
                  <option value="commande">Commandes internes</option>
                  <option value="reception">Réceptions</option>
                </select>
                <select value={approvStatut} onChange={(e) => { setApprovStatut(e.target.value); setApprovPage(1); }}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Tous les statuts</option>
                  <option value="BROUILLON">Brouillon</option>
                  <option value="SOUMISE">Soumise</option>
                  <option value="VALIDEE">Validée</option>
                  <option value="EN_COURS">En cours</option>
                  <option value="LIVREE">Livrée</option>
                  <option value="ANNULEE">Annulée</option>
                </select>
                <select value={approvPdvId} onChange={(e) => { setApprovPdvId(e.target.value); setApprovPage(1); }}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">Tous les PDVs</option>
                  {pdvList.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
                <button onClick={approvRefetch} className="p-1.5 text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {approvLoading && <Spinner />}
            {!approvLoading && approvData && (
              <div className="space-y-4">
                {/* Commandes internes */}
                {(approvType === "all" || approvType === "commande") && approvData.commandes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Commandes internes ({approvData.meta.totalCommandes})</h3>
                    <div className="bg-white border border-gray-200 rounded-lg divide-y">
                      {approvData.commandes.map((c) => (
                        <div key={c.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-gray-500">{c.reference}</span>
                                <Badge statut={c.statut} />
                              </div>
                              <p className="text-sm font-medium text-gray-900 mt-0.5">{c.pdv.nom}</p>
                              <p className="text-xs text-gray-400">Par {c.demandeurNom} · {formatDate(c.createdAt)}</p>
                            </div>
                            <Eye className="w-4 h-4 text-gray-300" />
                          </div>
                          {c.lignes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {c.lignes.map((l) => (
                                <span key={l.produitId} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                  {l.produitNom} × {l.quantiteDemandee ?? l.quantiteAttendue ?? 0} {l.unite}
                                </span>
                              ))}
                            </div>
                          )}
                          {c.notes && <p className="text-xs text-gray-400 mt-1 italic">{c.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Réceptions */}
                {(approvType === "all" || approvType === "reception") && approvData.receptions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Réceptions ({approvData.meta.totalReceptions})</h3>
                    <div className="bg-white border border-gray-200 rounded-lg divide-y">
                      {approvData.receptions.map((r) => (
                        <div key={r.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-gray-500">{r.reference}</span>
                                <Badge statut={r.statut} />
                              </div>
                              <p className="text-sm font-medium text-gray-900 mt-0.5">{r.pdv.nom}</p>
                              <p className="text-xs text-gray-400">
                                Fournisseur : {r.fournisseurNom ?? "—"} · {formatDate(r.createdAt)}
                              </p>
                              {r.datePrevisionnelle && (
                                <p className="text-xs text-gray-400">Prévu : {formatDate(r.datePrevisionnelle)}</p>
                              )}
                              {r.dateReception && (
                                <p className="text-xs text-green-600">Reçu le : {formatDate(r.dateReception)}</p>
                              )}
                            </div>
                            <Eye className="w-4 h-4 text-gray-300" />
                          </div>
                          {r.lignes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {r.lignes.map((l) => (
                                <span key={l.produitId} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                  {l.produitNom} : attendu {l.quantiteAttendue ?? 0} / reçu {l.quantiteRecue ?? 0} {l.unite}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {approvData.commandes.length === 0 && approvData.receptions.length === 0 && (
                  <EmptyState message="Aucun document d'approvisionnement" />
                )}

                {/* Pagination */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>
                    {approvType !== "reception" && `${approvData.meta.totalCommandes} commandes`}
                    {approvType === "all" && " · "}
                    {approvType !== "commande" && `${approvData.meta.totalReceptions} réceptions`}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => setApprovPage(p => Math.max(1, p - 1))} disabled={approvPage === 1}
                      className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">‹</button>
                    <span className="px-3 py-1">Page {approvPage}</span>
                    <button onClick={() => setApprovPage(p => p + 1)}
                      disabled={approvType === "commande" ? approvData.meta.totalCommandes <= approvPage * 20 : approvData.meta.totalReceptions <= approvPage * 20}
                      className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">›</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: RAPPORTS                                                     */}
        {/* ================================================================ */}
        {activeTab === "rapports" && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-gray-900">Exports & Rapports</h2>
            <p className="text-sm text-gray-500">Générez des rapports CSV pour votre zone. Les données exportées correspondent aux filtres actifs sur chaque onglet.</p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  title: "Rapport Ventes",
                  desc: "Exporte toutes les ventes (VD + VP) de la zone avec client, agent, PDV, montant.",
                  icon: TrendingUp,
                  color: "green",
                  action: () => {
                    setActiveTab("ventes");
                  },
                  actionLabel: "Aller à l'onglet Ventes",
                },
                {
                  title: "Rapport Équipe",
                  desc: "Liste de tous les agents de la zone avec leur PDV et leurs performances sur 30 jours.",
                  icon: Users,
                  color: "blue",
                  action: exportEquipeCsv,
                  actionLabel: "Exporter CSV Équipe",
                  disabled: !equipeData?.data.length,
                },
                {
                  title: "Rapport Clients",
                  desc: "Base clients complète de la zone avec souscriptions actives et statistiques.",
                  icon: UserCheck,
                  color: "purple",
                  action: exportClientsCsv,
                  actionLabel: "Exporter CSV Clients",
                  disabled: !clientsData?.data.length,
                },
                {
                  title: "Vue Globale PDVs",
                  desc: "Statistiques comparatives entre tous les PDVs de la zone (CA, stock, anomalies).",
                  icon: Store,
                  color: "indigo",
                  action: () => setActiveTab("pdvs"),
                  actionLabel: "Aller à l'onglet PDVs",
                },
                {
                  title: "Supervision Caisse",
                  desc: "Clôtures, écarts et dépenses par catégorie pour tous les PDVs.",
                  icon: Wallet,
                  color: "orange",
                  action: () => setActiveTab("caisse"),
                  actionLabel: "Aller à l'onglet Caisse",
                },
                {
                  title: "Stock Zone",
                  desc: "Valeur et statut du stock par PDV, transferts actifs, inventaires récents.",
                  icon: Package,
                  color: "red",
                  action: () => setActiveTab("stock"),
                  actionLabel: "Aller à l'onglet Stock",
                },
              ].map(({ title, desc, icon: Icon, color, action, actionLabel, disabled }) => (
                <div key={title} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${
                      color === "green" ? "bg-green-50" :
                      color === "blue" ? "bg-blue-50" :
                      color === "purple" ? "bg-purple-50" :
                      color === "indigo" ? "bg-indigo-50" :
                      color === "orange" ? "bg-orange-50" : "bg-red-50"
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        color === "green" ? "text-green-600" :
                        color === "blue" ? "text-blue-600" :
                        color === "purple" ? "text-purple-600" :
                        color === "indigo" ? "text-indigo-600" :
                        color === "orange" ? "text-orange-600" : "text-red-600"
                      }`} />
                    </div>
                    <h3 className="font-medium text-gray-900">{title}</h3>
                  </div>
                  <p className="text-xs text-gray-500">{desc}</p>
                  <button
                    onClick={action}
                    disabled={disabled}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {actionLabel}
                  </button>
                </div>
              ))}
            </div>

            {/* Note info zone */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              <p className="font-medium mb-1">À propos de votre zone</p>
              <p className="text-xs">
                Votre zone est définie par les points de vente qui vous ont été attribués par l&apos;administrateur.
                Pour modifier votre zone (ajouter/retirer des PDVs), contactez un administrateur —
                il peut le faire via la page de gestion des PDVs en modifiant le champ &quot;Chef d&apos;Agence&quot; de chaque point de vente.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* ================================================================== */}
      {/* MODAL AFFECTATION AGENT                                             */}
      {/* ================================================================== */}
      {showAffectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Affecter un agent à un PDV</h3>
              <button onClick={() => setShowAffectModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              L&apos;agent sera affecté au point de vente sélectionné. Son éventuelle affectation précédente sera automatiquement clôturée.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ID de l&apos;agent *</label>
                <input
                  type="number"
                  value={affectUserId}
                  onChange={(e) => setAffectUserId(e.target.value)}
                  placeholder="ID utilisateur"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Retrouvez l&apos;ID dans la liste des agents ci-dessus</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Point de vente *</label>
                <select
                  value={affectPdvId}
                  onChange={(e) => setAffectPdvId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Sélectionner un PDV</option>
                  {pdvList.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                <textarea
                  value={affectNotes}
                  onChange={(e) => setAffectNotes(e.target.value)}
                  placeholder="Motif, remarques..."
                  rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAffectModal(false)}
                className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={handleAffecterAgent}
                disabled={!affectUserId || !affectPdvId || affectLoading}
                className="flex-1 px-4 py-2 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-40"
              >
                {affectLoading ? "En cours..." : "Affecter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
