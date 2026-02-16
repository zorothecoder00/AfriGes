"use client";

import React, { useState, useEffect } from 'react';
import {
  Users, MapPin, Phone, CreditCard as CreditCardIcon, TrendingUp, Clock, CheckCircle,
  AlertCircle, Search, ArrowLeft, RefreshCw, Download, UserPlus,
  Banknote, Target, Calendar, ChevronRight, Eye, LucideIcon, XCircle
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { getStatusStyle, getStatusLabel } from '@/lib/status';

// ============================================================================
// TYPES
// ============================================================================

interface Credit {
  id: number;
  montant: string;
  montantRestant: string;
  dateDemande: string;
  statut: string;
  scoreRisque: string | null;
  membre?: { id: number; nom: string; prenom: string; telephone: string | null } | null;
  client?: { id: number; nom: string; prenom: string; telephone: string } | null;
  transactions?: CreditTransaction[];
}

interface CreditTransaction {
  id: number;
  montant: string;
  type: string;
  datePaiement: string;
}

interface CreditsResponse {
  data: Credit[];
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
  membre?: { nom: string; prenom: string } | null;
  client?: { nom: string; prenom: string } | null;
}

interface CotisationsResponse {
  data: Cotisation[];
  meta: { total: number; page: number; limit: number; totalPages: number };
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

const CreditCard = ({ credit }: { credit: Credit }) => {
  const montant = Number(credit.montant);
  const restant = Number(credit.montantRestant);
  const pct = montant > 0 ? Math.round(((montant - restant) / montant) * 100) : 0;
  const person = credit.client ?? credit.membre;

  const statutConfig: Record<string, { color: string; icon: LucideIcon; label: string }> = {
    EN_ATTENTE: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'En attente' },
    APPROUVE: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Approuve' },
    REJETE: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejete' },
    REMBOURSE_PARTIEL: { color: 'bg-indigo-100 text-indigo-800', icon: TrendingUp, label: 'En cours' },
    REMBOURSE_TOTAL: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Rembourse' },
  };
  const config = statutConfig[credit.statut] || { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: credit.statut };
  const StatusIcon = config.icon;

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-5 border border-slate-100">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
            {person ? `${person.prenom?.[0]}${person.nom?.[0]}` : '??'}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{person ? `${person.prenom} ${person.nom}` : 'Inconnu'}</p>
            {person && 'telephone' in person && person.telephone && (
              <p className="text-xs text-slate-500 flex items-center gap-1"><Phone size={10} />{person.telephone}</p>
            )}
          </div>
        </div>
        <span className={`${config.color} text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1`}>
          <StatusIcon size={12} />{config.label}
        </span>
      </div>
      <div className="space-y-2 mb-3">
        <div className="flex justify-between">
          <span className="text-sm text-slate-600">Montant</span>
          <span className="font-bold text-slate-900">{formatCurrency(montant)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-600">Reste</span>
          <span className="font-bold text-red-600">{formatCurrency(restant)}</span>
        </div>
      </div>
      {credit.statut !== 'REJETE' && credit.statut !== 'EN_ATTENTE' && (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-600">Remboursement</span>
            <span className="text-xs font-bold text-slate-900">{pct}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400 mt-3">Demande le {formatDate(credit.dateDemande)}</p>
    </div>
  );
};

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AgentTerrainPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'remboursements' | 'prospects' | 'cotisations'>('remboursements');
  const [clientPage, setClientPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const clientParams = new URLSearchParams({ page: String(clientPage), limit: '10' });
  if (debouncedSearch && activeTab === 'prospects') clientParams.set('search', debouncedSearch);

  // Fetch credits (pour les remboursements a collecter)
  const { data: creditsResponse, loading: creditsLoading, refetch: refetchCredits } = useApi<CreditsResponse>('/api/admin/creditsAlimentaires?limit=50');
  // Fetch clients (pour prospection)
  const { data: clientsResponse, loading: clientsLoading, refetch: refetchClients } = useApi<ClientsResponse>(`/api/admin/clients?${clientParams}`);
  // Fetch cotisations
  const { data: cotisationsResponse, loading: cotisationsLoading } = useApi<CotisationsResponse>('/api/admin/cotisations?limit=20');

  const credits = creditsResponse?.data ?? [];
  const clients = clientsResponse?.data ?? [];
  const clientsMeta = clientsResponse?.meta;
  const cotisations = cotisationsResponse?.data ?? [];

  // Stats calculees
  const creditsEnCours = credits.filter(c => c.statut === 'ACTIF' || c.statut === 'APPROUVE' || c.statut === 'REMBOURSE_PARTIEL');
  const totalACollecter = credits.reduce((sum, c) => sum + Number(c.montantRestant || 0), 0);
  const cotisationsEnAttente = cotisations.filter(c => c.statut === 'EN_ATTENTE');

  const isLoading = creditsLoading && !creditsResponse;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }   

  const statCards = [
    { label: 'Credits en Cours', value: String(creditsEnCours.length), subtitle: 'A suivre sur le terrain', icon: CreditCardIcon, color: 'text-teal-500', lightBg: 'bg-teal-50' },
    { label: 'Montant a Collecter', value: formatCurrency(totalACollecter), subtitle: 'Remboursements restants', icon: Banknote, color: 'text-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Clients Repertories', value: String(clientsMeta?.total ?? 0), subtitle: 'Prospection active', icon: Users, color: 'text-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Cotisations en Attente', value: String(cotisationsEnAttente.length), subtitle: 'A encaisser', icon: Target, color: 'text-purple-500', lightBg: 'bg-purple-50' },
  ];

  const tabs = [
    { key: 'remboursements' as const, label: 'Remboursements', icon: Banknote },
    { key: 'prospects' as const, label: 'Prospection', icon: UserPlus },
    { key: 'cotisations' as const, label: 'Cotisations', icon: Calendar },
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
              <Link href="/dashboard/user/notifications" className="text-slate-600 hover:text-slate-800 px-2">
                <span role="img" aria-label="notifications">&#x1F514;</span>
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
            <p className="text-slate-500">Collectez les remboursements et developpez votre portefeuille clients</p>
          </div>
          <div className="flex gap-3">
            <button onClick={refetchCredits} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <RefreshCw size={18} />
              Actualiser
            </button>
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Rapport
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((stat, i) => (
            <StatCard key={i} {...stat} />
          ))}
        </div>

        {/* Objectifs terrain */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-teal-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Banknote size={24} />
              </div>
              <div>
                <p className="text-teal-100 text-sm">Remboursements a collecter</p>
                <p className="text-3xl font-bold">{formatCurrency(totalACollecter)}</p>
              </div>
            </div>
            <p className="text-teal-100 text-sm">Sur {creditsEnCours.length} credits actifs</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <UserPlus size={24} />
              </div>
              <div>
                <p className="text-blue-100 text-sm">Prospection</p>
                <p className="text-3xl font-bold">{clientsMeta?.total ?? 0} clients</p>
              </div>
            </div>
            <p className="text-blue-100 text-sm">Portefeuille total</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5 flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder={activeTab === 'remboursements' ? "Rechercher un credit..." : activeTab === 'prospects' ? "Rechercher un client..." : "Rechercher une cotisation..."}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setClientPage(1); }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* TAB: Remboursements */}
        {activeTab === 'remboursements' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">Credits a Suivre</h3>
              <span className="bg-teal-100 text-teal-800 text-sm font-semibold px-4 py-2 rounded-full">
                {credits.length} credits
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {credits.filter(c => {
                if (!debouncedSearch) return true;
                const q = debouncedSearch.toLowerCase();
                const person = c.client ?? c.membre;
                return person ? (`${person.prenom} ${person.nom}`).toLowerCase().includes(q) : false;
              }).map(credit => (
                <CreditCard key={credit.id} credit={credit} />
              ))}
            </div>
            {credits.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200/60">
                <Banknote className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Aucun credit a suivre pour le moment</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: Prospection */}
        {activeTab === 'prospects' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Telephone</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Adresse</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Activite</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Inscription</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => {
                    const totalActivites = (client._count?.credits ?? 0) + (client._count?.creditsAlim ?? 0) + (client._count?.cotisations ?? 0) + (client._count?.tontines ?? 0);
                    return (
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-semibold shadow-md text-sm">
                              {client.prenom?.[0]}{client.nom?.[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{client.prenom} {client.nom}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <Phone size={14} className="text-slate-400" />
                            {client.telephone}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <MapPin size={14} className="text-slate-400" />
                            {client.adresse ?? '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(client.etat)}`}>
                            {getStatusLabel(client.etat)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${totalActivites > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {totalActivites} activite{totalActivites !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600">{formatDate(client.createdAt)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/dashboard/admin/clients/${client.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors inline-flex">
                            <Eye size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {clients.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Aucun client trouve</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {clientsMeta && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Page <span className="font-semibold">{clientsMeta.page}</span> sur <span className="font-semibold">{clientsMeta.totalPages}</span> ({clientsMeta.total} clients)
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setClientPage(p => Math.max(1, p - 1))} disabled={clientPage <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                  <span className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium">{clientPage}</span>
                  <button onClick={() => setClientPage(p => Math.min(clientsMeta.totalPages, p + 1))} disabled={clientPage >= clientsMeta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Cotisations */}
        {activeTab === 'cotisations' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Membre / Client</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Montant</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Periode</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Paiement</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Expiration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cotisations.filter(c => {
                    if (!debouncedSearch) return true;
                    const q = debouncedSearch.toLowerCase();
                    const person = c.client ?? c.membre;
                    return person ? (`${person.prenom} ${person.nom}`).toLowerCase().includes(q) : false;
                  }).map((cot) => {
                    const person = cot.client ?? cot.membre;
                    return (
                      <tr key={cot.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500">#{cot.id}</td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800">{person ? `${person.prenom} ${person.nom}` : '-'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-800">{formatCurrency(cot.montant)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(cot.periode)}`}>
                            {getStatusLabel(cot.periode)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(cot.statut)}`}>
                            {getStatusLabel(cot.statut)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600">{formatDate(cot.datePaiement)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600">{formatDate(cot.dateExpiration)}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {cotisations.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Aucune cotisation trouvee</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
