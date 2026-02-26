"use client";

import React, { useState, useEffect } from "react";
import {
  Users, MapPin, Phone, TrendingUp, Clock, CheckCircle,
  AlertCircle, Search, ArrowLeft, RefreshCw, UserPlus,
  Banknote, Calendar, LucideIcon, Layers, Plus, ChevronRight,
  Loader2, Truck, Package,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { getStatusStyle, getStatusLabel } from "@/lib/status";

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
  stats: { total: number; totalMontantRestant: number; enRetard: number };
}

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  etat: string;
  createdAt: string;
  _count?: { souscriptions: number };
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
          <h2 className="text-xl font-bold text-slate-800">Collecte terrain</h2>
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
          <p className="text-sm text-slate-600"><span className="font-medium">Client :</span> {personne}</p>
          <p className="text-xs text-slate-500 italic">{typeInfo[type]}</p>
          <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
            <span className="text-slate-500">Restant</span>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Montant collecté (FCFA) *</label>
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
              Maximum autorisé : <span className="font-semibold text-slate-600">{formatCurrency(Number(souscription.montantRestant))}</span>
            </p>
            {montant && parseFloat(montant) > Number(souscription.montantRestant) && (
              <p className="text-xs text-red-600 mt-1 font-medium">
                Le montant saisi dépasse le restant dû ({formatCurrency(Number(souscription.montantRestant))})
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optionnel)</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Observations terrain…"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !montant || parseFloat(montant) <= 0 || parseFloat(montant) > Number(souscription.montantRestant)}
              className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : "Confirmer collecte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type TabKey = "prospects" | "packs" | "livraisons";

export default function AgentTerrainPage() {
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
    { label: "En retard", value: String(packStats?.enRetard ?? 0), subtitle: "Échéances dépassées", icon: AlertCircle, color: "text-red-500", lightBg: "bg-red-50" },
  ];

  const tabs: { key: TabKey; label: string; icon: LucideIcon; badge?: number }[] = [
    { key: "packs",       label: "Collecte Packs",  icon: Banknote },
    { key: "livraisons",  label: "Livraisons",       icon: Truck,
      badge: livraisonsResponse?.stats.totalPlanifiees ?? 0 },
    { key: "prospects",   label: "Clients",          icon: Users },
  ];

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
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                Agent Terrain
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <MessagesLink />
              <NotificationBell href="/dashboard/user/notifications" />
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">A</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-1">Tableau de Bord — Agent Terrain</h2>
            <p className="text-slate-500 text-sm">Collectez les versements packs et gérez votre portefeuille clients</p>
          </div>
          <button onClick={refetchAll} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
            <RefreshCw size={18} /> Actualiser
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
                <option value="">Tous les types</option>
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
                <Plus size={16} /> Ajouter client
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
                <p className="text-slate-500 font-medium">Aucune souscription active à collecter</p>
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
                          <span>{formatCurrency(Number(s.montantVerse))} versés</span>
                          <span>{formatCurrency(Number(s.montantRestant))} restants</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${progression}%` }} />
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{progression}% payé</p>
                      </div>

                      {/* Prochaine échéance */}
                      {prochaine ? (
                        <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${retard ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"}`}>
                          {retard ? <AlertCircle size={14} className="text-red-500 shrink-0" /> : <Calendar size={14} className="text-slate-400 shrink-0" />}
                          <span>
                            Échéance #{prochaine.numero} — <strong>{formatCurrency(Number(prochaine.montant))}</strong>
                            {" "}— {formatDate(prochaine.datePrevue)}
                            {retard && <span className="ml-1 font-bold">⚠ EN RETARD</span>}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                          <CheckCircle size={14} className="shrink-0" />
                          <span>Toutes les échéances sont à jour</span>
                        </div>
                      )}
                    </div>

                    {/* Bouton collecter */}
                    <button
                      onClick={() => setCollectTarget(s)}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium transition-colors shadow-sm">
                      <Banknote size={15} /> Collecter
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
                  <p className="text-slate-500 text-sm">À confirmer</p>
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
                  <p className="text-slate-500 text-sm">Total livrées</p>
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
                <h3 className="font-bold text-slate-800">Livraisons à confirmer</h3>
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
                  <p className="text-slate-500">Aucune livraison planifiée en attente</p>
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
                  <h3 className="font-bold text-slate-800">Confirmées récemment (30j)</h3>
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

        {/* ── TAB : CLIENTS / PROSPECTION ── */}
        {activeTab === "prospects" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Téléphone</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Adresse</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Souscriptions</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Inscription</th>
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
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${(client._count?.souscriptions ?? 0) > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {client._count?.souscriptions ?? 0} souscription(s)
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(client.createdAt)}</td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Aucun client trouvé</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {clientsMeta && clientsMeta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">Page {clientsMeta.page} sur {clientsMeta.totalPages} ({clientsMeta.total} clients)</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setClientPage((p) => Math.max(1, p - 1))} disabled={clientPage <= 1}
                    className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm">Précédent</button>
                  <span className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium text-sm">{clientPage}</span>
                  <button onClick={() => setClientPage((p) => Math.min(clientsMeta.totalPages, p + 1))} disabled={clientPage >= clientsMeta.totalPages}
                    className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm">Suivant</button>
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
              <h2 className="text-xl font-bold text-slate-800">Nouveau client</h2>
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
                  Annuler
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
