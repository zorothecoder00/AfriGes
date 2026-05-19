"use client";

import React, { useState, useEffect, useRef } from "react";
import {    
  Users, MapPin, Phone, TrendingUp, Clock, CheckCircle,
  AlertCircle, Search, ArrowLeft, RefreshCw, UserPlus,
  Banknote, Calendar, LucideIcon, Layers, Plus, ChevronRight,
  Loader2, Truck, Package, ShoppingCart, X, Send, BadgeCheck, XCircle,
} from "lucide-react";
import Link from "next/link";      
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import UserPdvBadge from "@/components/UserPdvBadge";
import DashboardBackButton from "@/components/DashboardBackButton";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { getStatusStyle, getStatusLabel } from "@/lib/status";
import { useT } from "@/contexts/AppSettingsContext";
import { usePageAccess } from "@/hooks/usePageAccess";

// ─── Types ────────────────────────────────────────────────────────────────────

type TypePack = "ALIMENTAIRE" | "REVENDEUR" | "FAMILIAL" | "URGENCE" | "EPARGNE_PRODUIT" | "FIDELITE";

interface Echeance {
  id: number;
  numero: number;
  montant: string;
  datePrevue: string;
  statut: "EN_ATTENTE" | "EN_RETARD" | "PAYE" | "ANNULE";
}

interface Souscription {
  id: number;
  statut: "EN_ATTENTE" | "ACTIF" | "COMPLETE" | "SUSPENDU" | "ANNULE";
  montantTotal: string;
  montantVerse: string;
  montantRestant: string;
  numeroCycle: number;
  formuleRevendeur?: string | null;
  dateDebut: string;
  pack: { nom: string; type: TypePack; frequenceVersement: string };
  client?: { id: number; nom: string; prenom: string; telephone: string } | null;
  user?: { id: number; nom: string; prenom: string; telephone: string } | null;
  echeances: Echeance[];
  _count: { versements: number };
}

interface PacksResponse {
  souscriptions: Souscription[];
  stats: { total: number; totalMontantRestant: number; enRetard: number; expirees: number };
}

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  etat: string;
  createdAt: string;
  _count?: { souscriptionsPacks: number };
}

interface ClientsResponse {
  data: Client[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface LigneLivraison {
  id: number;
  quantite: number;
  prixUnitaire: string;
  produit: { nom: string; prixUnitaire: string };
}

interface ReceptionPack {
  id: number;
  statut: "PLANIFIEE" | "LIVREE";
  datePrevisionnelle: string;
  dateLivraison?: string;
  livreurNom?: string;
  notes?: string;
  souscription: {
    id: number;
    pack: { nom: string; type: TypePack };
    client?: { nom: string; prenom: string; telephone: string } | null;
    user?: { nom: string; prenom: string } | null;
  };
  lignes: LigneLivraison[];
}

interface LivraisonsResponse {
  planifiees: ReceptionPack[];
  livreesRecentes: ReceptionPack[];
  stats: { totalPlanifiees: number; totalLivrees: number };
}

interface LigneVente {
  id: number; produitId: number; quantite: number; prixUnitaire: string; montant: string;
  produit: { id: number; nom: string; unite: string | null };
}
interface VenteTerrain {
  id: number; reference: string;
  statut: "BROUILLON" | "CONFIRMEE" | "SORTIE_VALIDEE" | "LIVREE" | "ANNULEE";
  montantTotal: string; montantPaye: string;
  modePaiement: string; notes: string | null;
  clientNom: string | null; clientTelephone: string | null;
  client: { id: number; nom: string; prenom: string; telephone: string } | null;
  lignes: LigneVente[];
  createdAt: string;   
}
interface VentesTerrainResponse {
  data: VenteTerrain[];
  produitsDispo: { id: number; quantite: number; produit: { id: number; nom: string; unite: string | null; prixUnitaire: string } }[];
  clients: { id: number; nom: string; prenom: string; telephone: string }[];
  stats: { total: number; montantTotal: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}
interface StockDispoItem {
  id: number; quantite: number;
  produit: { id: number; nom: string; unite: string | null; prixUnitaire: string };
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PACK_LABELS: Record<TypePack, string> = {
  ALIMENTAIRE: "Alimentaire", REVENDEUR: "Revendeur", FAMILIAL: "Familial",
  URGENCE: "Urgence", EPARGNE_PRODUIT: "Épargne-Produit", FIDELITE: "Fidélité",
};

const PACK_COLORS: Record<TypePack, { badge: string; border: string }> = {
  ALIMENTAIRE:   { badge: "bg-green-100 text-green-800",  border: "border-green-200" },
  REVENDEUR:     { badge: "bg-blue-100 text-blue-800",    border: "border-blue-200" },
  FAMILIAL:      { badge: "bg-purple-100 text-purple-800",border: "border-purple-200" },
  URGENCE:       { badge: "bg-red-100 text-red-800",      border: "border-red-200" },
  EPARGNE_PRODUIT:{ badge: "bg-amber-100 text-amber-800", border: "border-amber-200" },
  FIDELITE:      { badge: "bg-pink-100 text-pink-800",    border: "border-pink-200" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Modal Collecte ───────────────────────────────────────────────────────────

function ModalCollecte({
  souscription,
  onClose,
  onSuccess,
}: {
  souscription: Souscription;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const prochaine = souscription.echeances[0];
  const type = souscription.pack.type;

  const [montant, setMontant] = useState(prochaine ? String(prochaine.montant) : "");
  const [notes, setNotes] = useState("");

  const { mutate, loading } = useMutation(
    `/api/agentTerrain/packs/${souscription.id}/collecte`,
    "POST",
    { successMessage: "Versement collecté !" }
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      montant: parseFloat(montant),
      notes: notes || undefined,
    };
    if (prochaine) payload.echeanceId = prochaine.id;
    const res = await mutate(payload);
    if (res) { onSuccess(); onClose(); }
  }

  const personne = souscription.client
    ? `${souscription.client.prenom} ${souscription.client.nom}`
    : souscription.user
    ? `${souscription.user.prenom} ${souscription.user.nom}`
    : "—";

  const typeInfo: Record<TypePack, string> = {
    ALIMENTAIRE: "Cotisation périodique — produit remis à solde complet",
    REVENDEUR: souscription.formuleRevendeur === "FORMULE_1"
      ? "Remboursement hebdomadaire (F1)"
      : "Remboursement quotidien 16j (F2)",
    FAMILIAL: `Cycle ${souscription.numeroCycle} — panier remis à solde`,
    URGENCE: "Remboursement journalier (7-10j)",
    EPARGNE_PRODUIT: "Épargne progressive",
    FIDELITE: "Points bonus",
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-800">{t("field_collection")}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg font-bold text-lg transition-colors">×</button>
        </div>

        {/* Info souscription */}
        <div className={`p-4 rounded-xl border ${PACK_COLORS[type].border} bg-opacity-30 mb-5 space-y-2`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PACK_COLORS[type].badge}`}>
              {PACK_LABELS[type]}
            </span>
            <span className="text-sm font-semibold text-slate-800">{souscription.pack.nom}</span>
          </div>
          <p className="text-sm text-slate-600"><span className="font-medium">{t('field_client')} :</span> {personne}</p>
          <p className="text-xs text-slate-500 italic">{typeInfo[type]}</p>
          <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
            <span className="text-slate-500">{t('remaining')}</span>
            <span className="font-bold text-red-600">{formatCurrency(Number(souscription.montantRestant))}</span>
          </div>
          {prochaine && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Échéance #{prochaine.numero}</span>
              <span className={`font-medium ${prochaine.statut === "EN_RETARD" ? "text-red-600" : "text-slate-700"}`}>
                {formatCurrency(Number(prochaine.montant))} — {formatDate(prochaine.datePrevue)}
                {prochaine.statut === "EN_RETARD" && " (EN RETARD)"}
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('amount_collected')} *</label>
            <input
              type="number" min="1" max={Number(souscription.montantRestant)} required
              value={montant} onChange={(e) => setMontant(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                montant && parseFloat(montant) > Number(souscription.montantRestant)
                  ? "border-red-400 bg-red-50"
                  : "border-slate-200"
              }`}
              placeholder="Ex : 5000"
            />
            <p className="text-xs text-slate-400 mt-1">
              {t('max_allowed')} : <span className="font-semibold text-slate-600">{formatCurrency(Number(souscription.montantRestant))}</span>
            </p>
            {montant && parseFloat(montant) > Number(souscription.montantRestant) && (
              <p className="text-xs text-red-600 mt-1 font-medium">
                {t('amount_exceeds_remaining')} ({formatCurrency(Number(souscription.montantRestant))})
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes_optional')}</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Observations terrain…"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
              {t('field_cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !montant || parseFloat(montant) <= 0 || parseFloat(montant) > Number(souscription.montantRestant)}
              className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('saving')}</> : "Confirmer collecte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type TabKey = "prospects" | "packs" | "livraisons" | "ventes";

export default function AgentTerrainPage() {
  const t = useT();
  const { isAllowed, allowedPages } = usePageAccess();

  const [searchQuery, setSearchQuery]   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab]       = useState<TabKey>("packs");
  const [clientPage, setClientPage]     = useState(1);
  const [packTypeFilter, setPackTypeFilter] = useState("");
  const [collectTarget, setCollectTarget] = useState<Souscription | null>(null);
  const [addClientModal, setAddClientModal] = useState(false);
  const [clientForm, setClientForm]     = useState({ nom: "", prenom: "", telephone: "", adresse: "" });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── API ──
  const clientParams = new URLSearchParams({ page: String(clientPage), limit: "10" });
  if (debouncedSearch && activeTab === "prospects") clientParams.set("search", debouncedSearch);

  const packParams = new URLSearchParams();
  if (debouncedSearch && activeTab === "packs") packParams.set("search", debouncedSearch);
  if (packTypeFilter) packParams.set("type", packTypeFilter);

  const { data: clientsResponse, loading: clientsLoading, refetch: refetchClients } =
    useApi<ClientsResponse>(`/api/agentTerrain/clients?${clientParams}`);
  const { data: packsResponse, loading: packsLoading, refetch: refetchPacks } =
    useApi<PacksResponse>(`/api/agentTerrain/packs?${packParams}`);
  const { data: livraisonsResponse, loading: livraisonsLoading, refetch: refetchLivraisons } =
    useApi<LivraisonsResponse>("/api/agentTerrain/livraisons");

  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const { mutate: doConfirm } = useMutation(
    confirmingId !== null ? `/api/agentTerrain/livraisons/${confirmingId}/confirmer` : "",
    "POST",
    { successMessage: "Livraison confirmée !" }
  );

  useEffect(() => {
    if (confirmingId === null) return;
    doConfirm({}).then((res) => {
      if (res) refetchLivraisons();
      setConfirmingId(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmingId]);

  // ── Ventes terrain ──
  const [showVenteForm, setShowVenteForm] = useState(false);
  const [vClientId, setVClientId]         = useState("");
  const [vClientNom, setVClientNom]       = useState("");
  const [vClientTel, setVClientTel]       = useState("");
  const [vModePaiement, setVModePaiement] = useState("ESPECES");
  const [vMontantPaye, setVMontantPaye]   = useState("");
  const [vNotes, setVNotes]               = useState("");
  const [vLignes, setVLignes]             = useState<{ produitId: string; quantite: string; prixUnitaire: string }[]>([
    { produitId: "", quantite: "", prixUnitaire: "" },
  ]);

  const cancelVenteIdRef  = useRef<number | null>(null);
  const livrerVenteIdRef  = useRef<number | null>(null);

  const { data: ventesRes, loading: ventesLoading, refetch: refetchVentes } =
    useApi<VentesTerrainResponse>(activeTab === "ventes" ? "/api/agentTerrain/ventes" : null);
  const ventesData      = ventesRes?.data ?? [];
  const produitsDispo   = (ventesRes?.produitsDispo ?? []) as StockDispoItem[];
  const clientsDispo    = ventesRes?.clients ?? [];
  const ventesEnAttente = ventesData.filter(v => v.statut === "BROUILLON").length;

  const { mutate: submitVente, loading: venteSubmitLoading } =
    useMutation<unknown, object>("/api/agentTerrain/ventes", "POST", {
      successMessage: "Demande envoyée au RPV pour confirmation !",
    });

  const { mutate: doCancelVente } = useMutation<unknown, object>(
    () => cancelVenteIdRef.current ? `/api/agentTerrain/ventes/${cancelVenteIdRef.current}` : "",
    "PATCH",
    { successMessage: "Demande annulée." }
  );

  const { mutate: doLivrerVente, loading: livrerLoading } = useMutation<unknown, object>(
    () => livrerVenteIdRef.current ? `/api/agentTerrain/ventes/${livrerVenteIdRef.current}` : "",
    "PATCH",
    { successMessage: "Livraison confirmée !" }
  );

  const handleSubmitVente = async (e: React.FormEvent) => {
    e.preventDefault();
    const lignesValides = vLignes.filter(l => l.produitId && l.quantite);
    if (!lignesValides.length) return;
    const montantTotal = lignesValides.reduce((s, l) => {
      const prix = Number(l.prixUnitaire) || Number(produitsDispo.find(p => p.produit.id === Number(l.produitId))?.produit.prixUnitaire || 0);
      return s + Number(l.quantite) * prix;
    }, 0);
    const res = await submitVente({
      modePaiement: vModePaiement,
      montantPaye: Number(vMontantPaye) || montantTotal,
      clientId: vClientId || undefined,
      clientNom: !vClientId ? vClientNom || undefined : undefined,
      clientTelephone: !vClientId ? vClientTel || undefined : undefined,
      notes: vNotes || undefined,
      lignes: lignesValides.map(l => ({
        produitId: Number(l.produitId),
        quantite:  Number(l.quantite),
        prixUnitaire: Number(l.prixUnitaire) || undefined,
      })),
    });
    if (res) {
      setShowVenteForm(false);
      setVClientId(""); setVClientNom(""); setVClientTel("");
      setVMontantPaye(""); setVNotes("");
      setVLignes([{ produitId: "", quantite: "", prixUnitaire: "" }]);
      refetchVentes();
    }
  };

  const handleCancelVente = async (id: number) => {
    cancelVenteIdRef.current = id;
    const res = await doCancelVente({ action: "ANNULER" });
    if (res) refetchVentes();
    cancelVenteIdRef.current = null;
  };

  const handleLivrerVente = async (id: number) => {
    livrerVenteIdRef.current = id;
    const res = await doLivrerVente({ action: "LIVRER" });
    if (res) refetchVentes();
    livrerVenteIdRef.current = null;
  };

  const vMontantCalcule = vLignes.reduce((s, l) => {
    if (!l.produitId || !l.quantite) return s;
    const prix = Number(l.prixUnitaire) || Number(produitsDispo.find(p => p.produit.id === Number(l.produitId))?.produit.prixUnitaire || 0);
    return s + Number(l.quantite) * prix;
  }, 0);

  const { mutate: addClient, loading: addingClient } = useMutation(
    "/api/agentTerrain/clients", "POST", { successMessage: "Client ajouté !" }
  );

  const clients        = clientsResponse?.data ?? [];
  const clientsMeta    = clientsResponse?.meta;
  const souscriptions  = packsResponse?.souscriptions ?? [];
  const packStats      = packsResponse?.stats;

  const refetchAll = () => { refetchClients(); refetchPacks(); };

  // ── Handlers ──
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await addClient(clientForm);
    if (res) {
      setAddClientModal(false);
      setClientForm({ nom: "", prenom: "", telephone: "", adresse: "" });
      refetchClients();
    }
  };

  // ── Stat cards ──
  const statCards = [
    { label: "Clients", value: String(clientsMeta?.total ?? 0), subtitle: "Portefeuille", icon: Users, color: "text-blue-500", lightBg: "bg-blue-50" },
    { label: "Souscriptions actives", value: String(packStats?.total ?? 0), subtitle: "À collecter", icon: Layers, color: "text-teal-500", lightBg: "bg-teal-50" },
    { label: "Montant restant", value: formatCurrency(packStats?.totalMontantRestant ?? 0), subtitle: "Total à collecter", icon: Banknote, color: "text-emerald-500", lightBg: "bg-emerald-50" },
    { label: "Échéances en retard", value: String(packStats?.enRetard ?? 0), subtitle: "Paiements dépassés", icon: AlertCircle, color: "text-red-500", lightBg: "bg-red-50" },
    { label: "Souscriptions échues", value: String(packStats?.expirees ?? 0), subtitle: "Suspendues automatiquement", icon: XCircle, color: "text-amber-600", lightBg: "bg-amber-50" },
  ];

  const allTabs: { key: TabKey; label: string; icon: LucideIcon; badge?: number }[] = [
    { key: "packs",       label: "Collecte Packs",   icon: Banknote },
    { key: "livraisons",  label: "Livraisons Pack",  icon: Truck,
      badge: livraisonsResponse?.stats.totalPlanifiees ?? 0 },
    { key: "ventes",      label: "Ventes Terrain",   icon: ShoppingCart,
      badge: ventesEnAttente },
    { key: "prospects",   label: "Clients",          icon: Users },
  ];
  const tabs = allTabs.filter((t) => isAllowed(t.key));

  useEffect(() => {
    if (allowedPages && !allowedPages.includes(activeTab)) {
      const first = allTabs.find((t) => allowedPages.includes(t.key));
      if (first) setActiveTab(first.key);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedPages]);

  if (clientsLoading && !clientsResponse && !packsResponse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 font-['DM_Sans',sans-serif]">

      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <DashboardBackButton />
              <h1 className="text-xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                {t('field_agent')}
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-1">{t("field_dash_title")}</h2>
            <p className="text-slate-500 text-sm">{t('field_dash_subtitle')}</p>
          </div>
          <button onClick={refetchAll} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
            <RefreshCw size={18} /> {t('refresh')}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSearchQuery(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key ? "bg-teal-600 text-white shadow-lg shadow-teal-200" : "text-slate-600 hover:bg-slate-100"
                }`}>
                <Icon size={18} />{tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-amber-500 text-white"}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + filtres */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Rechercher…" value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setClientPage(1); }}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
              />
            </div>
            {activeTab === "packs" && (
              <select value={packTypeFilter} onChange={(e) => setPackTypeFilter(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">{t("field_all_types")}</option>
                <option value="ALIMENTAIRE">Alimentaire</option>
                <option value="REVENDEUR">Revendeur</option>
                <option value="FAMILIAL">Familial</option>
                <option value="URGENCE">Urgence</option>
                <option value="EPARGNE_PRODUIT">Épargne-Produit</option>
              </select>
            )}
            {activeTab === "prospects" && (
              <button onClick={() => setAddClientModal(true)}
                className="px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-200 flex items-center gap-2 text-sm font-medium">
                <Plus size={16} /> {t("field_add_client")}
              </button>
            )}
          </div>
        </div>

        {/* ── TAB : COLLECTE PACKS ── */}
        {activeTab === "packs" && (
          <div className="space-y-3">
            {packsLoading && (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
              </div>
            )}

            {!packsLoading && souscriptions.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">{t('no_active_subscription')}</p>
              </div>
            )}

            {souscriptions.map((s) => {
              const personne = s.client
                ? `${s.client.prenom} ${s.client.nom}`
                : s.user ? `${s.user.prenom} ${s.user.nom}` : "—";
              const telephone = s.client?.telephone ?? s.user?.telephone ?? "";
              const prochaine = s.echeances[0];
              const retard = prochaine?.statut === "EN_RETARD";
              const colors = PACK_COLORS[s.pack.type];
              const progression = Number(s.montantTotal) > 0
                ? Math.min(100, Math.round((Number(s.montantVerse) / Number(s.montantTotal)) * 100))
                : 0;

              return (
                <div key={s.id} className={`bg-white rounded-2xl border ${retard ? "border-red-300" : "border-slate-200"} p-5 shadow-sm hover:shadow-md transition-shadow`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Client + pack */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-slate-800">{personne}</span>
                        {telephone && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone size={11} />{telephone}</span>}
                      </div>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                          {PACK_LABELS[s.pack.type]}
                        </span>
                        <span className="text-sm text-slate-600">{s.pack.nom}</span>
                        {s.formuleRevendeur && (
                          <span className="text-xs text-blue-600 font-medium">
                            {s.formuleRevendeur === "FORMULE_1" ? "F1" : "F2"}
                          </span>
                        )}
                        {s.pack.type === "FAMILIAL" && (
                          <span className="text-xs text-purple-600 font-medium">Cycle {s.numeroCycle}</span>
                        )}
                      </div>

                      {/* Barre de progression */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>{formatCurrency(Number(s.montantVerse))} {t('paid')}</span>
                          <span>{formatCurrency(Number(s.montantRestant))} {t('remaining_plural')}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${progression}%` }} />
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{progression}% {t('paid_status')}</p>
                      </div>

                      {/* Prochaine échéance */}
                      {prochaine ? (
                        <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${retard ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"}`}>
                          {retard ? <AlertCircle size={14} className="text-red-500 shrink-0" /> : <Calendar size={14} className="text-slate-400 shrink-0" />}
                          <span>
                            {t('due_date')} #{prochaine.numero} — <strong>{formatCurrency(Number(prochaine.montant))}</strong>
                            {" "}— {formatDate(prochaine.datePrevue)}
                            {retard && <span className="ml-1 font-bold">⚠ {t('overdue')}</span>}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                          <CheckCircle size={14} className="shrink-0" />
                          <span>{t('field_due_up_to_date')}</span>
                        </div>
                      )}
                    </div>

                    {/* Bouton collecter */}
                    <button
                      onClick={() => setCollectTarget(s)}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium transition-colors shadow-sm">
                      <Banknote size={15} /> {t('field_collect')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB : LIVRAISONS PACKS ── */}
        {activeTab === "livraisons" && (
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm">{t('to_confirm')}</p>
                  <p className="text-3xl font-bold text-amber-600">
                    {livraisonsResponse?.stats.totalPlanifiees ?? 0}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-slate-500 text-sm">{t('field_total_delivered')}</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {livraisonsResponse?.stats.totalLivrees ?? 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Livraisons planifiées — à confirmer */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-amber-50 flex items-center gap-2">
                <Truck size={18} className="text-amber-600" />
                <h3 className="font-bold text-slate-800">{t('field_deliveries_to_confirm')}</h3>
                {(livraisonsResponse?.planifiees.length ?? 0) > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {livraisonsResponse!.planifiees.length}
                  </span>
                )}
              </div>

              {livraisonsLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
                </div>
              ) : (livraisonsResponse?.planifiees.length ?? 0) === 0 ? (
                <div className="p-12 text-center">
                  <Truck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500">{t('field_no_planned_pending_delivery')}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {livraisonsResponse!.planifiees.map((rec) => {
                    const s = rec.souscription;
                    const beneficiaire = s.client
                      ? `${s.client.prenom} ${s.client.nom}`
                      : s.user ? `${s.user.prenom} ${s.user.nom}` : "—";
                    const telephone = s.client?.telephone ?? "";
                    const montantTotal = rec.lignes.reduce(
                      (acc, l) => acc + Number(l.prixUnitaire) * l.quantite, 0
                    );
                    const colors = PACK_COLORS[s.pack.type];
                    return (
                      <div key={rec.id} className="p-5 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                                {PACK_LABELS[s.pack.type]}
                              </span>
                              <span className="font-semibold text-slate-800 text-sm">{s.pack.nom}</span>
                            </div>
                            <p className="text-sm text-slate-700 font-medium">{beneficiaire}</p>
                            {telephone && (
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone size={11} />{telephone}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {rec.lignes.map((l) => (
                                <span key={l.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                                  {l.produit.nom} × {l.quantite}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5">
                              Prévu le {formatDate(rec.datePrevisionnelle)} — {
                                new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF" }).format(montantTotal)
                              }
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setConfirmingId(rec.id)}
                          disabled={confirmingId === rec.id}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium transition-all shadow-md shadow-emerald-200 shrink-0 disabled:opacity-60"
                        >
                          <CheckCircle size={15} />
                          {confirmingId === rec.id ? "En cours…" : "Confirmer"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Historique récent (LIVREE 30j) */}
            {(livraisonsResponse?.livreesRecentes.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-emerald-50 flex items-center gap-2">
                  <CheckCircle size={18} className="text-emerald-600" />
                  <h3 className="font-bold text-slate-800">{t('field_recent_confirmed_30d')}</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {livraisonsResponse!.livreesRecentes.map((rec) => {
                    const s = rec.souscription;
                    const beneficiaire = s.client
                      ? `${s.client.prenom} ${s.client.nom}`
                      : s.user ? `${s.user.prenom} ${s.user.nom}` : "—";
                    const colors = PACK_COLORS[s.pack.type];
                    return (
                      <div key={rec.id} className="px-5 py-3 flex items-center gap-3">
                        <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                              {PACK_LABELS[s.pack.type]}
                            </span>
                            <span className="text-sm font-medium text-slate-800 truncate">{s.pack.nom}</span>
                            <span className="text-sm text-slate-500">— {beneficiaire}</span>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">
                          {rec.dateLivraison ? formatDate(rec.dateLivraison) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB : VENTES TERRAIN ── */}
        {activeTab === "ventes" && (
          <div className="space-y-5">

            {/* En-tête + bouton */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  {t('field_direct_sale_help')}
                </p>
              </div>
              <button
                onClick={() => setShowVenteForm(v => !v)}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium shadow-lg shadow-teal-200"
              >
                <Plus size={16} /> {t("field_new_request")}
              </button>
            </div>

            {/* Formulaire création vente */}
            {showVenteForm && (
              <div className="bg-white rounded-2xl border border-teal-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-teal-200 bg-teal-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={18} className="text-teal-600" />
                    <h3 className="font-bold text-slate-800">{t("field_new_direct_sale_request")}</h3>
                  </div>
                  <button onClick={() => setShowVenteForm(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmitVente} className="p-5 space-y-4">
                  <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    {t('field_request_flow')}
                  </p>

                  {/* Client */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t('client_from_pdv')}</label>
                      <select value={vClientId} onChange={e => { setVClientId(e.target.value); setVClientNom(""); setVClientTel(""); }}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                        <option value="">— {t('manual_entry')} —</option>
                        {clientsDispo.map(c => (
                          <option key={c.id} value={c.id}>{c.prenom} {c.nom} ({c.telephone})</option>
                        ))}
                      </select>
                    </div>
                    {!vClientId && (
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Nom client" value={vClientNom} onChange={e => setVClientNom(e.target.value)}
                          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                        <input placeholder="Téléphone" value={vClientTel} onChange={e => setVClientTel(e.target.value)}
                          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      </div>
                    )}
                  </div>

                  {/* Produits */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t('products')} *</label>
                    <div className="space-y-2">
                      {vLignes.map((l, i) => {
                        const produitSel = produitsDispo.find(p => p.produit.id === Number(l.produitId));
                        return (
                          <div key={i} className="flex gap-2 items-center">
                            <select value={l.produitId}
                              onChange={e => {
                                const p = produitsDispo.find(p => p.produit.id === Number(e.target.value));
                                setVLignes(prev => prev.map((x, j) => j === i ? { ...x, produitId: e.target.value, prixUnitaire: p ? String(p.produit.prixUnitaire) : "" } : x));
                              }}
                              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                              <option value="">{t('choose_product')}…</option>
                              {produitsDispo.map(p => (
                                <option key={p.produit.id} value={p.produit.id}>
                                  {p.produit.nom} (dispo: {p.quantite})
                                </option>
                              ))}
                            </select>
                            <input type="number" min="1" max={produitSel?.quantite} placeholder="Qté"
                              value={l.quantite} onChange={e => setVLignes(prev => prev.map((x, j) => j === i ? { ...x, quantite: e.target.value } : x))}
                              className="w-20 px-2 py-2.5 border border-slate-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500" />
                            <input type="number" min="0" placeholder="Prix unit."
                              value={l.prixUnitaire} onChange={e => setVLignes(prev => prev.map((x, j) => j === i ? { ...x, prixUnitaire: e.target.value } : x))}
                              className="w-28 px-2 py-2.5 border border-slate-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500" />
                            {vLignes.length > 1 && (
                              <button type="button" onClick={() => setVLignes(prev => prev.filter((_, j) => j !== i))}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><X size={14} /></button>
                            )}
                          </div>
                        );
                      })}
                      <button type="button" onClick={() => setVLignes(prev => [...prev, { produitId: "", quantite: "", prixUnitaire: "" }])}
                        className="text-xs text-teal-700 hover:underline flex items-center gap-1">
                        <Plus size={12} /> {t('field_add_product')}
                      </button>
                    </div>
                  </div>

                  {/* Paiement */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t('field_payment_mode')}</label>
                      <select value={vModePaiement} onChange={e => setVModePaiement(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                        <option value="ESPECES">Espèces</option>
                        <option value="MOBILE_MONEY">Mobile Money</option>
                        <option value="CREDIT">Crédit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Montant payé (auto: {vMontantCalcule.toLocaleString("fr-FR")} FCFA)
                      </label>
                      <input type="number" min="0" placeholder={String(vMontantCalcule)}
                        value={vMontantPaye} onChange={e => setVMontantPaye(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                  </div>

                  <textarea placeholder="Notes (optionnel)" rows={2} value={vNotes} onChange={e => setVNotes(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" />

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setShowVenteForm(false)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm">{t('field_cancel')}</button>
                    <button type="submit" disabled={venteSubmitLoading || vLignes.every(l => !l.produitId)}
                      className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-semibold flex items-center justify-center gap-2">
                      {venteSubmitLoading ? <><Loader2 size={14} className="animate-spin" /> {t('sending')}…</> : <><Send size={14} /> {t('send_to_rpv')}</>}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Liste des ventes */}
            {ventesLoading && !ventesRes ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
              </div>
            ) : ventesData.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">{t('field_no_sales')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ventesData.map(v => {
                  const clientNom = v.client
                    ? `${v.client.prenom} ${v.client.nom}`
                    : v.clientNom ?? "Client non précisé";
                  const tel = v.client?.telephone ?? v.clientTelephone;
                  const statutColors: Record<string, string> = {
                    BROUILLON:      "bg-amber-100 text-amber-700",
                    CONFIRMEE:      "bg-blue-100 text-blue-700",
                    SORTIE_VALIDEE: "bg-violet-100 text-violet-700",
                    LIVREE:         "bg-emerald-100 text-emerald-700",
                    ANNULEE:        "bg-red-100 text-red-700",
                  };
                  const statutLabels: Record<string, string> = {
                    BROUILLON:      "En attente RPV",
                    CONFIRMEE:      "Approuvée — préparation stock",
                    SORTIE_VALIDEE: "Stock sorti — à livrer",
                    LIVREE:         "Livrée",
                    ANNULEE:        "Annulée",
                  };
                  return (
                    <div key={v.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{v.reference}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statutColors[v.statut]}`}>
                              {statutLabels[v.statut]}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-800">{clientNom}</p>
                          {tel && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone size={11} />{tel}</p>}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {v.lignes.map(l => (
                              <span key={l.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                                {l.produit.nom} × {l.quantite}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm font-bold text-slate-700 mt-1">
                            {Number(v.montantTotal).toLocaleString("fr-FR")} FCFA — {v.modePaiement}
                          </p>
                        </div>
                        {v.statut === "BROUILLON" && (
                          <button onClick={() => handleCancelVente(v.id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 text-xs font-medium shrink-0">
                            <XCircle size={14} /> {t('field_cancel')}
                          </button>
                        )}
                        {v.statut === "CONFIRMEE" && (
                          <span className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-medium shrink-0">
                            <Package size={14} /> {t("field_storekeeper_release_stock")}
                          </span>
                        )}
                        {v.statut === "SORTIE_VALIDEE" && (
                          <button
                            onClick={() => handleLivrerVente(v.id)}
                            disabled={livrerLoading && livrerVenteIdRef.current === v.id}
                            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white border border-violet-600 rounded-xl hover:bg-violet-700 text-xs font-medium shrink-0 disabled:opacity-60"
                          >
                            {livrerLoading && livrerVenteIdRef.current === v.id
                              ? <><Loader2 size={13} className="animate-spin" /> {t('field_in_progress')}…</>
                              : <><Truck size={13} /> {t('field_confirm_delivery')}</>
                            }
                          </button>
                        )}
                        {v.statut === "LIVREE" && (
                          <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-medium shrink-0">
                            <CheckCircle size={14} /> {t('field_delivered')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB : CLIENTS / PROSPECTION ── */}
        {activeTab === "prospects" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('field_client')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('field_phone')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('field_address')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('field_status')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('field_subscriptions')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('field_registration')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {client.prenom?.[0]}{client.nom?.[0]}
                          </div>
                          <p className="font-semibold text-slate-800">{client.prenom} {client.nom}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <Phone size={13} className="inline mr-1 text-slate-400" />{client.telephone}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <MapPin size={13} className="inline mr-1 text-slate-400" />{client.adresse ?? "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(client.etat)}`}>
                          {getStatusLabel(client.etat)}
                        </span>
                      </td>  
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${(client._count?.souscriptionsPacks ?? 0) > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {client._count?.souscriptionsPacks ?? 0} souscription(s)
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(client.createdAt)}</td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">{t("field_no_client_found")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {clientsMeta && clientsMeta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">{t('page')} {clientsMeta.page} sur {clientsMeta.totalPages} ({clientsMeta.total} clients)</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setClientPage((p) => Math.max(1, p - 1))} disabled={clientPage <= 1}
                    className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm">Précédent</button>
                  <span className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium text-sm">{clientPage}</span>
                  <button onClick={() => setClientPage((p) => Math.min(clientsMeta.totalPages, p + 1))} disabled={clientPage >= clientsMeta.totalPages}
                    className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm">{t('field_next')}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal collecte */}
      {collectTarget && (
        <ModalCollecte
          souscription={collectTarget}
          onClose={() => setCollectTarget(null)}
          onSuccess={() => { refetchPacks(); setCollectTarget(null); }}
        />
      )}

      {/* Modal ajout client */}
      {addClientModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-slate-800">{t('field_new_client')}</h2>
              <button onClick={() => setAddClientModal(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg font-bold text-lg">×</button>
            </div>
            <form onSubmit={handleAddClient} className="space-y-4">
              {(["prenom", "nom", "telephone", "adresse"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">
                    {field}{field !== "adresse" && " *"}
                  </label>
                  <input
                    required={field !== "adresse"}
                    value={clientForm[field]}
                    onChange={(e) => setClientForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder={field === "telephone" ? "Ex : 07XXXXXXXX" : ""}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setAddClientModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
                  {t('field_cancel')}
                </button>
                <button type="submit" disabled={addingClient}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-medium">
                  {addingClient ? "Ajout…" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
