"use client";

import React, { useState, useEffect } from 'react';
import {
  Users, ShoppingBag, CreditCard, TrendingUp, Search, ArrowLeft,
  RefreshCw, Download, Eye, Clock, CheckCircle, AlertCircle, XCircle,
  Calendar, DollarSign, PieChart, BarChart3, LucideIcon, ChevronRight, Target
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStatusStyle, getStatusLabel } from '@/lib/status';

// ============================================================================
// TYPES
// ============================================================================

interface Tontine {
  id: number;
  nom: string;
  description: string | null;
  montantCycle: string;
  frequence: string;
  statut: string;
  dateDebut: string;
  dateFin: string | null;
  _count?: { membres: number };
}

interface TontinesResponse {
  data: Tontine[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface CreditAlimentaire {
  id: number;
  plafond: string;
  montantUtilise: string;
  montantRestant: string;
  source: string;
  dateAttribution: string;
  dateExpiration: string | null;
  statut: string;
  client?: { id: number; nom: string; prenom: string; telephone: string } | null;
}

interface CreditsAlimResponse {
  data: CreditAlimentaire[];
  stats: {
    totalActifs: number;
    totalEpuises: number;
    totalExpires: number;
    montantTotalPlafond: number | string;
    montantTotalUtilise: number | string;
    montantTotalRestant: number | string;
  };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Cotisation {
  id: number;
  montant: string;
  periode: string;
  datePaiement: string | null;
  dateExpiration: string;
  statut: string;
  client?: { id: number; nom: string; prenom: string; telephone: string } | null;
  member?: { id: number; nom: string; prenom: string; email: string } | null;
}

interface CotisationsResponse {
  data: Cotisation[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  etat: string;
  _count?: { credits: number; creditsAlim: number; cotisations: number; tontines: number };
}

interface ClientsResponse {
  data: Client[];
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

const TontineCard = ({ tontine }: { tontine: Tontine }) => {
  const statutConfig: Record<string, { color: string; label: string }> = {
    ACTIVE: { color: 'bg-green-100 text-green-800', label: 'Active' },
    TERMINEE: { color: 'bg-gray-100 text-gray-800', label: 'Terminee' },
    SUSPENDUE: { color: 'bg-yellow-100 text-yellow-800', label: 'Suspendue' },
  };
  const config = statutConfig[tontine.statut] || { color: 'bg-gray-100 text-gray-800', label: tontine.statut };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-5 border border-slate-100">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-lg font-bold text-slate-800 mb-1">{tontine.nom}</h4>
          {tontine.description && <p className="text-sm text-slate-500 line-clamp-1">{tontine.description}</p>}
        </div>
        <span className={`${config.color} text-xs font-semibold px-3 py-1 rounded-full ml-2 flex-shrink-0`}>{config.label}</span>
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Montant/cycle</span>
          <span className="font-bold text-slate-800">{formatCurrency(tontine.montantCycle)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Frequence</span>
          <span className="font-semibold text-slate-700">{tontine.frequence === 'MENSUEL' ? 'Mensuel' : 'Hebdomadaire'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Membres</span>
          <span className="font-semibold text-slate-700">{tontine._count?.membres ?? '-'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Debut</span>
          <span className="font-semibold text-slate-700">{formatDate(tontine.dateDebut)}</span>
        </div>
      </div>
      <Link href={`/dashboard/admin/tontines/${tontine.id}`} className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center text-sm">
        <Eye className="w-4 h-4 mr-2" />
        Gerer
      </Link>
    </div>
  );
};

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ResponsableCommunautePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'tontines' | 'creditsAlim' | 'cotisations' | 'membres'>('tontines');
  const [creditsPage, setCreditsPage] = useState(1);
  const [cotisationsPage, setCotisationsPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const creditsParams = new URLSearchParams({ page: String(creditsPage), limit: '10' });
  if (debouncedSearch && activeTab === 'creditsAlim') creditsParams.set('search', debouncedSearch);

  // Fetch data
  const { data: tontinesResponse, loading: tontinesLoading, refetch: refetchTontines } = useApi<TontinesResponse>('/api/admin/tontines?limit=50');
  const { data: creditsAlimResponse, loading: creditsLoading } = useApi<CreditsAlimResponse>(`/api/admin/creditsAlimentaires?${creditsParams}`);
  const { data: cotisationsResponse } = useApi<CotisationsResponse>(`/api/admin/cotisations?page=${cotisationsPage}&limit=10`);
  const { data: clientsResponse } = useApi<ClientsResponse>('/api/admin/clients?limit=50');

  const tontines = tontinesResponse?.data ?? [];
  const creditsAlim = creditsAlimResponse?.data ?? [];
  const creditsStats = creditsAlimResponse?.stats;
  const creditsMeta = creditsAlimResponse?.meta;
  const cotisations = cotisationsResponse?.data ?? [];
  const cotisationsMeta = cotisationsResponse?.meta;
  const clients = clientsResponse?.data ?? [];

  const tontinesActives = tontines.filter(t => t.statut === 'ACTIVE');
  const cotisationsEnAttente = cotisations.filter(c => c.statut === 'EN_ATTENTE');

  const isLoading = tontinesLoading && !tontinesResponse;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-green-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement de la communaute...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Tontines Actives', value: String(tontinesActives.length), subtitle: `sur ${tontines.length} au total`, icon: Users, color: 'text-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Credits Alimentaires Actifs', value: String(creditsStats?.totalActifs ?? 0), subtitle: formatCurrency(creditsStats?.montantTotalRestant ?? 0) + ' disponible', icon: ShoppingBag, color: 'text-purple-500', lightBg: 'bg-purple-50' },
    { label: 'Plafonds Alloues', value: formatCurrency(creditsStats?.montantTotalPlafond ?? 0), subtitle: formatCurrency(creditsStats?.montantTotalUtilise ?? 0) + ' utilise', icon: Target, color: 'text-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Membres Communaute', value: String(clients.length), subtitle: `${cotisationsEnAttente.length} cotisations en attente`, icon: Calendar, color: 'text-orange-500', lightBg: 'bg-orange-50' },
  ];

  const tabs = [
    { key: 'tontines' as const, label: 'Tontines', icon: Users },
    { key: 'creditsAlim' as const, label: 'Credits Alimentaires', icon: ShoppingBag },
    { key: 'cotisations' as const, label: 'Cotisations', icon: Calendar },
    { key: 'membres' as const, label: 'Membres', icon: Target },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-green-50/20 font-['DM_Sans',sans-serif]">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                Responsable Communaute
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/user/notifications" className="text-slate-600 hover:text-slate-800 px-2">
                <span role="img" aria-label="notifications">&#x1F514;</span>
              </Link>
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 flex items-center justify-center text-white font-bold text-sm">C</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Responsable Communaute</h2>
            <p className="text-slate-500">Definissez les plafonds, gerez les tontines et pilotez le credit alimentaire</p>
          </div>
          <div className="flex gap-3">
            <button onClick={refetchTontines} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <RefreshCw size={18} />
              Actualiser
            </button>
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Rapport
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((stat, i) => <StatCard key={i} {...stat} />)}
        </div>

        {/* Banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <PieChart size={24} />
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Credit Alimentaire - Utilisation</p>
                <p className="text-3xl font-bold">{formatCurrency(creditsStats?.montantTotalUtilise ?? 0)}</p>
              </div>
            </div>
            <p className="text-emerald-100 text-sm">sur {formatCurrency(creditsStats?.montantTotalPlafond ?? 0)} alloues au total</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <BarChart3 size={24} />
              </div>
              <div>
                <p className="text-purple-100 text-sm">Credits epuises + expires</p>
                <p className="text-3xl font-bold">{(creditsStats?.totalEpuises ?? 0) + (creditsStats?.totalExpires ?? 0)}</p>
              </div>
            </div>
            <p className="text-purple-100 text-sm">{creditsStats?.totalEpuises ?? 0} epuises, {creditsStats?.totalExpires ?? 0} expires</p>
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
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
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
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder={
                activeTab === 'tontines' ? "Rechercher une tontine..."
                : activeTab === 'creditsAlim' ? "Rechercher un beneficiaire..."
                : activeTab === 'cotisations' ? "Rechercher une cotisation..."
                : "Rechercher un membre..."
              }
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCreditsPage(1); setCotisationsPage(1); }}
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            />
          </div>
        </div>

        {/* TAB: Tontines */}
        {activeTab === 'tontines' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">Tontines de la Communaute</h3>
              <span className="bg-emerald-100 text-emerald-700 text-sm font-semibold px-4 py-2 rounded-full">
                {tontinesActives.length} actives / {tontines.length} total
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {tontines.filter(t => {
                if (!debouncedSearch) return true;
                return t.nom.toLowerCase().includes(debouncedSearch.toLowerCase());
              }).map(tontine => (
                <TontineCard key={tontine.id} tontine={tontine} />
              ))}
            </div>
            {tontines.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200/60">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Aucune tontine dans la communaute</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: Credits Alimentaires */}
        {activeTab === 'creditsAlim' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag size={20} className="text-purple-600" />
                <h3 className="font-bold text-slate-800">Gestion des Credits Alimentaires</h3>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">{creditsStats?.totalActifs ?? 0} actifs</span>
                <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-semibold">{creditsStats?.totalEpuises ?? 0} epuises</span>
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">{creditsStats?.totalExpires ?? 0} expires</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Beneficiaire</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Plafond</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Utilise</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Restant</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Utilisation</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Source</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Expiration</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creditsAlim.map((credit) => {
                    const plafond = Number(credit.plafond);
                    const utilise = Number(credit.montantUtilise);
                    const pct = plafond > 0 ? Math.round((utilise / plafond) * 100) : 0;
                    return (
                      <tr key={credit.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                              {credit.client ? `${credit.client.prenom?.[0]}${credit.client.nom?.[0]}` : '??'}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{credit.client ? `${credit.client.prenom} ${credit.client.nom}` : '-'}</p>
                              {credit.client?.telephone && <p className="text-xs text-slate-500">{credit.client.telephone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-800">{formatCurrency(credit.plafond)}</td>
                        <td className="px-6 py-4 font-semibold text-purple-600">{formatCurrency(credit.montantUtilise)}</td>
                        <td className="px-6 py-4 font-bold text-emerald-600">{formatCurrency(credit.montantRestant)}</td>
                        <td className="px-6 py-4">
                          <div className="w-24">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-500">{pct}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-purple-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${credit.source === 'COTISATION' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {credit.source === 'COTISATION' ? 'Cotisation' : 'Tontine'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(credit.statut)}`}>
                            {getStatusLabel(credit.statut)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(credit.dateExpiration)}</td>
                        <td className="px-6 py-4">
                          <Link href={`/dashboard/admin/creditsAlimentaires/${credit.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors inline-flex">
                            <Eye size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {creditsAlim.length === 0 && (
                    <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-500">Aucun credit alimentaire trouve</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {creditsMeta && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">Page <span className="font-semibold">{creditsMeta.page}</span> sur <span className="font-semibold">{creditsMeta.totalPages}</span> ({creditsMeta.total} credits)</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCreditsPage(p => Math.max(1, p - 1))} disabled={creditsPage <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                  <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">{creditsPage}</span>
                  <button onClick={() => setCreditsPage(p => Math.min(creditsMeta.totalPages, p + 1))} disabled={creditsPage >= creditsMeta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Cotisations */}
        {activeTab === 'cotisations' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <Calendar size={20} className="text-orange-600" />
              <h3 className="font-bold text-slate-800">Cotisations de la Communaute</h3>
            </div>
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
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cotisations.filter(c => {
                    if (!debouncedSearch) return true;
                    const q = debouncedSearch.toLowerCase();
                    const person = c.client ?? c.member;
                    return person ? `${person.prenom} ${person.nom}`.toLowerCase().includes(q) : false;
                  }).map((cot) => {
                    const person = cot.client ?? cot.member;
                    return (
                      <tr key={cot.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500">#{cot.id}</td>
                        <td className="px-6 py-4 font-semibold text-slate-800">{person ? `${person.prenom} ${person.nom}` : '-'}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{formatCurrency(cot.montant)}</td>
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
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(cot.datePaiement)}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(cot.dateExpiration)}</td>
                        <td className="px-6 py-4">
                          <Link href={`/dashboard/admin/cotisations/${cot.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors inline-flex">
                            <Eye size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {cotisations.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500">Aucune cotisation trouvee</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {cotisationsMeta && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">Page <span className="font-semibold">{cotisationsMeta.page}</span> sur <span className="font-semibold">{cotisationsMeta.totalPages}</span></p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCotisationsPage(p => Math.max(1, p - 1))} disabled={cotisationsPage <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                  <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">{cotisationsPage}</span>
                  <button onClick={() => setCotisationsPage(p => Math.min(cotisationsMeta.totalPages, p + 1))} disabled={cotisationsPage >= cotisationsMeta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Membres */}
        {activeTab === 'membres' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <Target size={20} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800">Membres de la Communaute</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Telephone</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Credits</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Credits Alim.</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Cotisations</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Tontines</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.filter(c => {
                    if (!debouncedSearch) return true;
                    const q = debouncedSearch.toLowerCase();
                    return `${c.prenom} ${c.nom}`.toLowerCase().includes(q) || c.telephone.includes(q);
                  }).map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                            {client.prenom?.[0]}{client.nom?.[0]}
                          </div>
                          <p className="font-semibold text-slate-800">{client.prenom} {client.nom}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{client.telephone}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(client.etat)}`}>
                          {client.etat === 'ACTIF' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {getStatusLabel(client.etat)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold">{client._count?.credits ?? 0}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full text-xs font-bold">{client._count?.creditsAlim ?? 0}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-xs font-bold">{client._count?.cotisations ?? 0}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold">{client._count?.tontines ?? 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/admin/clients/${client.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors inline-flex">
                          <Eye size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500">Aucun membre trouve</td></tr>
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
