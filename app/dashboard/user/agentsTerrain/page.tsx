"use client";

import React, { useState, useEffect } from 'react';
import {
  Users, MapPin, Phone, CreditCard as CreditCardIcon, TrendingUp, Clock, CheckCircle,
  AlertCircle, Search, ArrowLeft, RefreshCw, UserPlus,
  Banknote, Calendar, Eye, LucideIcon, XCircle, ShoppingBag, Loader2, Plus
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStatusStyle, getStatusLabel } from '@/lib/status';

// ============================================================================
// TYPES
// ============================================================================

interface Credit {
  id: number;
  montant: string;
  montantRestant: string;
  dateDemande: string;
  statut: 'EN_ATTENTE' | 'APPROUVE' | 'REJETE' | 'REMBOURSE_PARTIEL' | 'REMBOURSE_TOTAL';
  member?: { id: number; nom: string; prenom: string; telephone: string | null } | null;
  client?: { id: number; nom: string; prenom: string; telephone: string } | null;
}

interface CreditsResponse {
  data: Credit[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface VenteProduit {
  id: number;
  quantite: number;
  prixUnitaire: string;
  createdAt: string;
  produit: { id: number; nom: string; prixUnitaire: string };
}

interface CreditAlimentaire {
  id: number;
  plafond: string;
  montantUtilise: string;
  montantRestant: string;
  source: 'COTISATION' | 'TONTINE';
  dateExpiration: string | null;
  statut: 'ACTIF' | 'EPUISE' | 'EXPIRE';
  client?: { id: number; nom: string; prenom: string; telephone: string } | null;
  ventes?: VenteProduit[];
}

interface CreditsAlimResponse {
  data: CreditAlimentaire[];
  stats: { totalActifs: number; totalEpuises: number; totalExpires: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  etat: string;
  createdAt: string;
  _count?: { credits: number; creditsAlim: number; cotisations: number; tontines: number };
}

interface ClientsResponse {
  data: Client[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Cotisation {
  id: number;
  montant: string;
  periode: string;
  datePaiement: string | null;
  dateExpiration: string | null;
  statut: string;
  client?: { id: number; nom: string; prenom: string; telephone: string } | null;
}

interface CotisationsResponse {
  data: Cotisation[];
  stats: { totalPayees: number; totalEnAttente: number; totalExpirees: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface TontineContribution {
  id: number;
  montant: string;
  statut: 'EN_ATTENTE' | 'PAYEE';
  datePaiement: string | null;
  membre: {
    id: number;
    ordreTirage: number | null;
    client: { id: number; nom: string; prenom: string; telephone: string } | null;
  };
}

interface TontineCycle {
  id: number;
  numeroCycle: number;
  montantPot: string;
  statut: 'EN_COURS' | 'COMPLETE' | 'ANNULE';
  dateDebut: string;
  beneficiaire: {
    client: { id: number; nom: string; prenom: string; telephone: string } | null;
  };
  contributions: TontineContribution[];
}

interface Tontine {
  id: number;
  nom: string;
  montantCycle: string;
  frequence: string;
  statut: string;
  cycles: TontineCycle[];
  _count?: { membres: number };
}

interface TontinesResponse {
  data: Tontine[];
}

interface Produit {
  id: number;
  nom: string;
  prixUnitaire: string;
  stock: number;
}

interface StockResponse {
  data: Produit[];
}

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

type TabKey = 'prospects' | 'cotisations' | 'tontines' | 'creditsAlim' | 'creditsSimples';

export default function AgentTerrainPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('prospects');
  const [clientPage, setClientPage] = useState(1);
  const [cotisationPage, setCotisationPage] = useState(1);
  const [cotisationFilter, setCotisationFilter] = useState('');

  // Modals
  const [addClientModal, setAddClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({ nom: '', prenom: '', telephone: '', adresse: '' });
  const [collectId, setCollectId] = useState<number | null>(null);
  const [payingContrib, setPayingContrib] = useState<{ tontineId: number; contributionId: number } | null>(null);
  const [venteModal, setVenteModal] = useState<CreditAlimentaire | null>(null);
  const [venteForm, setVenteForm] = useState({ produitId: '', quantite: '1' });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- API Calls ---
  const clientParams = new URLSearchParams({ page: String(clientPage), limit: '10' });
  if (debouncedSearch && activeTab === 'prospects') clientParams.set('search', debouncedSearch);

  const cotisationParams = new URLSearchParams({ page: String(cotisationPage), limit: '10' });
  if (debouncedSearch && activeTab === 'cotisations') cotisationParams.set('search', debouncedSearch);
  if (cotisationFilter) cotisationParams.set('statut', cotisationFilter);

  const { data: clientsResponse, loading: clientsLoading, refetch: refetchClients } = useApi<ClientsResponse>(`/api/agentTerrain/clients?${clientParams}`);
  const { data: cotisationsResponse, loading: cotisationsLoading, refetch: refetchCotisations } = useApi<CotisationsResponse>(`/api/agentTerrain/cotisations?${cotisationParams}`);
  const { data: tontinesResponse, refetch: refetchTontines } = useApi<TontinesResponse>('/api/agentTerrain/tontines');
  const { data: creditsAlimResponse, refetch: refetchCreditsAlim } = useApi<CreditsAlimResponse>('/api/agentTerrain/creditsAlimentaires?limit=50');
  const { data: creditsResponse } = useApi<CreditsResponse>('/api/admin/credits?limit=50');
  const { data: stockResponse } = useApi<StockResponse>(venteModal ? '/api/admin/stock?limit=200' : null);

  // Mutations
  const { mutate: addClient, loading: addingClient, error: addClientError } = useMutation('/api/agentTerrain/clients', 'POST', { successMessage: 'Client ajoute avec succes' });
  const { mutate: collectCotisation, loading: collecting } = useMutation(
    `/api/agentTerrain/cotisations/${collectId}/collect`,
    'PATCH',
    { successMessage: 'Cotisation collectee avec succes' }
  );
  const { mutate: markContribPaid, loading: markingContrib } = useMutation(
    payingContrib ? `/api/agentTerrain/tontines/${payingContrib.tontineId}/contributions/${payingContrib.contributionId}` : '/api/agentTerrain/tontines/0/contributions/0',
    'PATCH',
    { successMessage: 'Contribution collectee avec succes' }
  );
  const { mutate: createVente, loading: creatingVente } = useMutation('/api/agentTerrain/ventes', 'POST', { successMessage: 'Vente effectuee avec succes' });

  // Data
  const clients = clientsResponse?.data ?? [];
  const clientsMeta = clientsResponse?.meta;
  const cotisations = cotisationsResponse?.data ?? [];
  const cotisationsMeta = cotisationsResponse?.meta;
  const cotisationsStats = cotisationsResponse?.stats;
  const tontines = tontinesResponse?.data ?? [];
  const creditsAlim = creditsAlimResponse?.data ?? [];
  const creditsAlimStats = creditsAlimResponse?.stats;
  const credits = creditsResponse?.data ?? [];
  const produits = stockResponse?.data ?? [];

  const creditsEnCours = credits.filter(c => c.statut === 'APPROUVE' || c.statut === 'REMBOURSE_PARTIEL');
  const totalACollecter = creditsEnCours.reduce((sum, c) => sum + Number(c.montantRestant || 0), 0);

  const refetchAll = () => {
    refetchClients();
    refetchCotisations();
    refetchTontines();
    refetchCreditsAlim();
  };

  // --- Handlers ---
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addClient(clientForm);
    if (result) {
      setAddClientModal(false);
      setClientForm({ nom: '', prenom: '', telephone: '', adresse: '' });
      refetchClients();
    }
  };

  const handleCollect = async () => {
    if (!collectId) return;
    const result = await collectCotisation({});
    if (result) {
      setCollectId(null);
      refetchCotisations();
      refetchCreditsAlim();
    }
  };

  const handleMarkContribPaid = async () => {
    if (!payingContrib) return;
    const result = await markContribPaid({});
    if (result) {
      setPayingContrib(null);
      refetchTontines();
      refetchCreditsAlim();
    }
  };

  const handleVente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venteModal) return;
    const result = await createVente({
      creditAlimentaireId: venteModal.id,
      produitId: Number(venteForm.produitId),
      quantite: Number(venteForm.quantite),
    });
    if (result) {
      setVenteModal(null);
      setVenteForm({ produitId: '', quantite: '1' });
      refetchCreditsAlim();
    }
  };

  // --- Loading ---
  if (clientsLoading && !clientsResponse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  const selectedProduit = produits.find(p => p.id === Number(venteForm.produitId));
  const venteMontant = selectedProduit ? Number(selectedProduit.prixUnitaire) * Number(venteForm.quantite || 0) : 0;

  const statCards = [
    { label: 'Clients', value: String(clientsMeta?.total ?? 0), subtitle: 'Portefeuille', icon: Users, color: 'text-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Cotisations en attente', value: String(cotisationsStats?.totalEnAttente ?? 0), subtitle: 'A collecter', icon: Calendar, color: 'text-amber-500', lightBg: 'bg-amber-50' },
    { label: 'Credits Alim. Actifs', value: String(creditsAlimStats?.totalActifs ?? 0), subtitle: 'Consommables', icon: ShoppingBag, color: 'text-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'A Collecter (Prets)', value: formatCurrency(totalACollecter), subtitle: `${creditsEnCours.length} pret(s)`, icon: Banknote, color: 'text-teal-500', lightBg: 'bg-teal-50' },
  ];

  const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
    { key: 'prospects', label: 'Prospection', icon: UserPlus },
    { key: 'cotisations', label: 'Cotisations', icon: Calendar },
    { key: 'tontines', label: 'Tontines', icon: TrendingUp },
    { key: 'creditsAlim', label: 'Credits Alim.', icon: ShoppingBag },
    { key: 'creditsSimples', label: 'Credits', icon: Banknote },
  ];

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
              <Link href="/dashboard/user/notifications" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                <AlertCircle className="w-5 h-5" />
              </Link>
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
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Tableau de Bord - Agent Terrain</h2>
            <p className="text-slate-500">Gerez les clients, collectez les cotisations et tontines, vendez via credits alimentaires</p>
          </div>
          <button onClick={refetchAll} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
            <RefreshCw size={18} />
            Actualiser
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((stat, i) => <StatCard key={i} {...stat} />)}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key ? 'bg-teal-600 text-white shadow-lg shadow-teal-200' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search bar (sauf tontines) */}
        {activeTab !== 'tontines' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setClientPage(1); setCotisationPage(1); }}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
                />
              </div>
              {activeTab === 'cotisations' && (
                <select
                  value={cotisationFilter}
                  onChange={(e) => { setCotisationFilter(e.target.value); setCotisationPage(1); }}
                  className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 bg-slate-50"
                >
                  <option value="">Tous les statuts</option>
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="PAYEE">Payee</option>
                  <option value="EXPIREE">Expiree</option>
                </select>
              )}
              {activeTab === 'prospects' && (
                <button onClick={() => setAddClientModal(true)} className="px-5 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-200 flex items-center gap-2 font-medium">
                  <Plus size={18} />
                  Ajouter client
                </button>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: PROSPECTION */}
        {/* ============================================================ */}
        {activeTab === 'prospects' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Telephone</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Adresse</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Activites</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Inscription</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => {
                    const totalAct = (client._count?.credits ?? 0) + (client._count?.creditsAlim ?? 0) + (client._count?.cotisations ?? 0) + (client._count?.tontines ?? 0);
                    return (
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                              {client.prenom?.[0]}{client.nom?.[0]}
                            </div>
                            <p className="font-semibold text-slate-800">{client.prenom} {client.nom}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600"><Phone size={14} className="inline mr-1 text-slate-400" />{client.telephone}</td>
                        <td className="px-6 py-4 text-sm text-slate-600"><MapPin size={14} className="inline mr-1 text-slate-400" />{client.adresse ?? '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(client.etat)}`}>{getStatusLabel(client.etat)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${totalAct > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {totalAct} activite{totalAct !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(client.createdAt)}</td>
                      </tr>
                    );
                  })}
                  {clients.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Aucun client trouve</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {clientsMeta && clientsMeta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">Page {clientsMeta.page} sur {clientsMeta.totalPages} ({clientsMeta.total} clients)</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setClientPage(p => Math.max(1, p - 1))} disabled={clientPage <= 1} className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                  <span className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium">{clientPage}</span>
                  <button onClick={() => setClientPage(p => Math.min(clientsMeta.totalPages, p + 1))} disabled={clientPage >= clientsMeta.totalPages} className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: COTISATIONS */}
        {/* ============================================================ */}
        {activeTab === 'cotisations' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Montant</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Periode</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Echeance</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Paiement</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cotisations.map((cot) => (
                    <tr key={cot.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800">{cot.client ? `${cot.client.prenom} ${cot.client.nom}` : '-'}</p>
                        {cot.client?.telephone && <p className="text-xs text-slate-500">{cot.client.telephone}</p>}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">{formatCurrency(cot.montant)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(cot.periode)}`}>{getStatusLabel(cot.periode)}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{cot.dateExpiration ? formatDate(cot.dateExpiration) : '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(cot.statut)}`}>{getStatusLabel(cot.statut)}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{cot.datePaiement ? formatDate(cot.datePaiement) : '-'}</td>
                      <td className="px-6 py-4 text-right">
                        {cot.statut === 'EN_ATTENTE' && (
                          collectId === cot.id ? (
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={handleCollect} disabled={collecting} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium">
                                {collecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmer'}
                              </button>
                              <button onClick={() => setCollectId(null)} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 font-medium">Annuler</button>
                            </div>
                          ) : (
                            <button onClick={() => setCollectId(cot.id)} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700 font-medium">
                              Collecter
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                  {cotisations.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Aucune cotisation trouvee</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {cotisationsMeta && cotisationsMeta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">Page {cotisationsMeta.page} sur {cotisationsMeta.totalPages} ({cotisationsMeta.total} cotisations)</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCotisationPage(p => Math.max(1, p - 1))} disabled={cotisationPage <= 1} className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                  <span className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium">{cotisationPage}</span>
                  <button onClick={() => setCotisationPage(p => Math.min(cotisationsMeta.totalPages, p + 1))} disabled={cotisationPage >= cotisationsMeta.totalPages} className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: TONTINES */}
        {/* ============================================================ */}
        {activeTab === 'tontines' && (
          <div className="space-y-6">
            {tontines.map((tontine) => {
              const cycleEnCours = tontine.cycles.find(c => c.statut === 'EN_COURS');
              if (!cycleEnCours) return (
                <div key={tontine.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{tontine.nom}</h3>
                      <p className="text-sm text-slate-500">{tontine._count?.membres ?? 0} membres | {formatCurrency(tontine.montantCycle)}/cycle</p>
                    </div>
                    <span className="text-sm text-slate-400">Aucun cycle en cours</span>
                  </div>
                </div>
              );

              const payees = cycleEnCours.contributions.filter(c => c.statut === 'PAYEE').length;
              const totalC = cycleEnCours.contributions.length;
              const pct = totalC > 0 ? Math.round((payees / totalC) * 100) : 0;

              return (
                <div key={tontine.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{tontine.nom}</h3>
                      <p className="text-sm text-slate-500">Cycle {cycleEnCours.numeroCycle} | Pot : {formatCurrency(cycleEnCours.montantPot)}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      <Clock className="w-3.5 h-3.5" /> En cours
                    </span>
                  </div>

                  {/* Beneficiaire */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                    <p className="text-sm text-amber-700 font-medium">
                      Beneficiaire : {cycleEnCours.beneficiaire.client ? `${cycleEnCours.beneficiaire.client.prenom} ${cycleEnCours.beneficiaire.client.nom}` : 'Inconnu'}
                    </p>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">Contributions</span>
                      <span className="font-medium">{payees}/{totalC} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Table contributions */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">#</th>
                        <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">Membre</th>
                        <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">Montant</th>
                        <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">Statut</th>
                        <th className="text-right py-2 px-2 text-slate-500 font-medium text-xs">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cycleEnCours.contributions.map((contrib) => (
                        <tr key={contrib.id} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 px-2 text-slate-600">{contrib.membre.ordreTirage || '-'}</td>
                          <td className="py-2 px-2 font-medium text-slate-800">
                            {contrib.membre.client ? `${contrib.membre.client.prenom} ${contrib.membre.client.nom}` : 'Inconnu'}
                          </td>
                          <td className="py-2 px-2">{formatCurrency(contrib.montant)}</td>
                          <td className="py-2 px-2">
                            {contrib.statut === 'PAYEE' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700"><CheckCircle className="w-3 h-3" /> Payee</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700"><Clock className="w-3 h-3" /> En attente</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {contrib.statut === 'EN_ATTENTE' && (
                              payingContrib?.contributionId === contrib.id ? (
                                <div className="flex items-center gap-2 justify-end">
                                  <button onClick={handleMarkContribPaid} disabled={markingContrib} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium">
                                    {markingContrib ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmer'}
                                  </button>
                                  <button onClick={() => setPayingContrib(null)} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded-lg font-medium">Annuler</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setPayingContrib({ tontineId: tontine.id, contributionId: contrib.id })}
                                  className="px-3 py-1 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700 font-medium"
                                >
                                  Collecter
                                </button>
                              )
                            )}
                            {contrib.statut === 'PAYEE' && contrib.datePaiement && (
                              <span className="text-xs text-slate-500">{formatDate(contrib.datePaiement)}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {tontines.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200/60">
                <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Aucune tontine active</p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: CREDITS ALIMENTAIRES + VENTE */}
        {/* ============================================================ */}
        {activeTab === 'creditsAlim' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {creditsAlim.filter(c => {
              if (!debouncedSearch) return true;
              const q = debouncedSearch.toLowerCase();
              return c.client ? (`${c.client.prenom} ${c.client.nom}`).toLowerCase().includes(q) : false;
            }).map(ca => {
              const plafond = Number(ca.plafond);
              const utilise = Number(ca.montantUtilise);
              const restant = Number(ca.montantRestant);
              const pctUtilise = plafond > 0 ? Math.round((utilise / plafond) * 100) : 0;

              return (
                <div key={ca.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-5 border border-slate-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {ca.client ? `${ca.client.prenom?.[0]}${ca.client.nom?.[0]}` : '??'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{ca.client ? `${ca.client.prenom} ${ca.client.nom}` : 'Inconnu'}</p>
                        {ca.client?.telephone && <p className="text-xs text-slate-500">{ca.client.telephone}</p>}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      ca.statut === 'ACTIF' ? 'bg-emerald-100 text-emerald-800' :
                      ca.statut === 'EPUISE' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                    }`}>{ca.statut === 'ACTIF' ? 'Actif' : ca.statut === 'EPUISE' ? 'Epuise' : 'Expire'}</span>
                  </div>

                  <div className="space-y-1.5 mb-3 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Plafond</span><span className="font-bold">{formatCurrency(plafond)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Utilise</span><span className="font-bold text-orange-600">{formatCurrency(utilise)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Disponible</span><span className="font-bold text-emerald-600">{formatCurrency(restant)}</span></div>
                  </div>

                  <div className="mb-3">
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${pctUtilise >= 90 ? 'bg-red-500' : pctUtilise >= 60 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${pctUtilise}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span>Source : {ca.source === 'COTISATION' ? 'Cotisation' : 'Tontine'}</span>
                    {ca.dateExpiration && <span>Expire {formatDate(ca.dateExpiration)}</span>}
                  </div>

                  {/* Dernières ventes */}
                  {ca.ventes && ca.ventes.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 mb-3">
                      <p className="text-xs font-medium text-slate-500 mb-1">Derniers achats :</p>
                      {ca.ventes.slice(0, 3).map(v => (
                        <div key={v.id} className="flex justify-between text-xs text-slate-500">
                          <span>{v.produit.nom} x{v.quantite}</span>
                          <span>{formatDate(v.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {ca.statut === 'ACTIF' && (
                    <button
                      onClick={() => setVenteModal(ca)}
                      className="w-full py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 font-medium flex items-center justify-center gap-2"
                    >
                      <ShoppingBag size={14} />
                      Vendre un produit
                    </button>
                  )}
                </div>
              );
            })}
            {creditsAlim.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200/60">
                <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Aucun credit alimentaire</p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: CREDITS SIMPLES (lecture seule) */}
        {/* ============================================================ */}
        {activeTab === 'creditsSimples' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {credits.filter(c => {
              if (!debouncedSearch) return true;
              const q = debouncedSearch.toLowerCase();
              const person = c.client ?? c.member;
              return person ? (`${person.prenom} ${person.nom}`).toLowerCase().includes(q) : false;
            }).map(credit => {
              const montant = Number(credit.montant);
              const restant = Number(credit.montantRestant);
              const pct = montant > 0 ? Math.round(((montant - restant) / montant) * 100) : 0;
              const person = credit.client ?? credit.member;

              return (
                <div key={credit.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-5 border border-slate-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {person ? `${person.prenom?.[0]}${person.nom?.[0]}` : '??'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{person ? `${person.prenom} ${person.nom}` : 'Inconnu'}</p>
                        {person && 'telephone' in person && person.telephone && <p className="text-xs text-slate-500">{person.telephone}</p>}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusStyle(credit.statut)}`}>{getStatusLabel(credit.statut)}</span>
                  </div>
                  <div className="space-y-1.5 mb-3 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Prete</span><span className="font-bold">{formatCurrency(montant)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Restant</span><span className="font-bold text-red-600">{formatCurrency(restant)}</span></div>
                  </div>
                  {(credit.statut === 'APPROUVE' || credit.statut === 'REMBOURSE_PARTIEL') && (
                    <div>
                      <div className="flex justify-between items-center mb-1"><span className="text-xs text-slate-600">Remboursement</span><span className="text-xs font-bold">{pct}%</span></div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-3">Demande le {formatDate(credit.dateDemande)}</p>
                </div>
              );
            })}
            {credits.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200/60">
                <Banknote className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Aucun credit simple</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* MODAL: AJOUTER CLIENT */}
      {/* ============================================================ */}
      {addClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
            <button onClick={() => setAddClientModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold">X</button>
            <h2 className="text-xl font-bold mb-4">Ajouter un client</h2>
            {addClientError && <p className="text-red-500 mb-2 text-sm">{addClientError}</p>}
            <form onSubmit={handleAddClient} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prenom</label>
                <input type="text" required value={clientForm.prenom} onChange={e => setClientForm({ ...clientForm, prenom: e.target.value })} className="w-full px-4 py-2 border rounded-xl" placeholder="Ex: Fatou" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom</label>
                <input type="text" required value={clientForm.nom} onChange={e => setClientForm({ ...clientForm, nom: e.target.value })} className="w-full px-4 py-2 border rounded-xl" placeholder="Ex: Diallo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telephone</label>
                <input type="tel" required value={clientForm.telephone} onChange={e => setClientForm({ ...clientForm, telephone: e.target.value })} className="w-full px-4 py-2 border rounded-xl" placeholder="Ex: 77 123 45 67" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Adresse (optionnel)</label>
                <input type="text" value={clientForm.adresse} onChange={e => setClientForm({ ...clientForm, adresse: e.target.value })} className="w-full px-4 py-2 border rounded-xl" placeholder="Ex: Dakar, Medina" />
              </div>
              <button type="submit" disabled={addingClient} className="w-full py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-medium">
                {addingClient ? 'Ajout en cours...' : 'Ajouter le client'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: VENTE PRODUIT */}
      {/* ============================================================ */}
      {venteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
            <button onClick={() => { setVenteModal(null); setVenteForm({ produitId: '', quantite: '1' }); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold">X</button>
            <h2 className="text-xl font-bold mb-2">Vendre un produit</h2>
            <p className="text-sm text-slate-500 mb-4">
              Credit de {venteModal.client ? `${venteModal.client.prenom} ${venteModal.client.nom}` : 'Inconnu'} — Disponible : <span className="font-bold text-emerald-600">{formatCurrency(venteModal.montantRestant)}</span>
            </p>
            <form onSubmit={handleVente} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Produit</label>
                <select required value={venteForm.produitId} onChange={e => setVenteForm({ ...venteForm, produitId: e.target.value })} className="w-full px-4 py-2 border rounded-xl bg-white">
                  <option value="">Selectionner un produit</option>
                  {produits.filter(p => p.stock > 0).map(p => (
                    <option key={p.id} value={p.id}>{p.nom} — {formatCurrency(p.prixUnitaire)} (stock: {p.stock})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantite</label>
                <input
                  type="number" required min="1"
                  max={selectedProduit ? selectedProduit.stock : undefined}
                  value={venteForm.quantite}
                  onChange={e => setVenteForm({ ...venteForm, quantite: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl"
                />
              </div>
              {selectedProduit && (
                <div className={`rounded-xl p-4 ${venteMontant > Number(venteModal.montantRestant) ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                  <div className="flex justify-between text-sm">
                    <span>Total</span>
                    <span className="font-bold">{formatCurrency(venteMontant)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span>Solde apres vente</span>
                    <span className="font-bold">{formatCurrency(Number(venteModal.montantRestant) - venteMontant)}</span>
                  </div>
                  {venteMontant > Number(venteModal.montantRestant) && (
                    <p className="text-xs text-red-600 mt-1">Solde insuffisant</p>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={creatingVente || !venteForm.produitId || venteMontant > Number(venteModal.montantRestant) || venteMontant <= 0}
                className="w-full py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-medium disabled:opacity-50"
              >
                {creatingVente ? 'Vente en cours...' : 'Valider la vente'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
