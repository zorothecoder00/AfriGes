"use client";

import React, { useState, useEffect } from 'react';
import {
  Calculator, TrendingUp, CreditCard, Search, ArrowLeft,
  RefreshCw, Download, Eye, BarChart3, PieChart, Users, Wallet,
  LucideIcon, Calendar, ShoppingCart, Banknote, FileText,
  ArrowUpRight, ArrowDownRight, DollarSign, Receipt, CheckCircle,
  Clock, AlertCircle, ShoppingBag
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { getStatusStyle, getStatusLabel } from '@/lib/status';

// ============================================================================
// TYPES
// ============================================================================

interface AdminDashResponse {
  success: boolean;
  data: {
    membresActifs: number;
    tontinesActives: number;
    creditsEnCours: number;
    achatsCreditAlimentaire: { nombreAchats: number; montantTotal: number | string };
  };
}

interface VentesResponse {
  data: Vente[];
  stats: { totalVentes: number; montantTotal: number | string; clientsActifs: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Vente {
  id: number;
  quantite: number;
  prixUnitaire: string;
  createdAt: string;
  produit: { id: number; nom: string; prixUnitaire: string };
  creditAlimentaire: {
    id: number;
    member?: { id: number; nom: string; prenom: string; email: string } | null;
  } | null;
}

interface CotisationsResponse {
  data: Cotisation[];
  stats: {
    totalPayees: number;
    totalEnAttente: number;
    totalExpirees: number;
    montantTotalCollecte: number | string;
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

interface CreditsAlimResponse {
  data: CreditAlim[];
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

interface CreditAlim {
  id: number;
  plafond: string;
  montantUtilise: string;
  montantRestant: string;
  statut: string;
  source: string;
  dateAttribution: string;
  dateExpiration: string | null;
  client?: { id: number; nom: string; prenom: string; telephone: string } | null;
}

interface StockResponse {
  data: unknown[];
  stats: { totalProduits: number; enRupture: number; stockFaible: number; valeurTotale: number | string };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface TontinesResponse {
  data: Tontine[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Tontine {
  id: number;
  nom: string;
  montantCycle: string;
  frequence: string;
  statut: string;
  dateDebut: string;
  _count?: { membres: number };
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

const FinancialRow = ({ label, value, type, icon: Icon }: {
  label: string; value: string; type: 'positive' | 'negative' | 'neutral'; icon: LucideIcon;
}) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${type === 'positive' ? 'bg-emerald-50' : type === 'negative' ? 'bg-red-50' : 'bg-slate-50'}`}>
        <Icon size={18} className={type === 'positive' ? 'text-emerald-600' : type === 'negative' ? 'text-red-600' : 'text-slate-600'} />
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
    <span className={`font-bold ${type === 'positive' ? 'text-emerald-600' : type === 'negative' ? 'text-red-600' : 'text-slate-800'}`}>
      {type === 'positive' ? '+' : type === 'negative' ? '-' : ''}{value}
    </span>
  </div>
);

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ComptablePage() {
  const [activeTab, setActiveTab] = useState<'synthese' | 'operations' | 'etats'>('synthese');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cotisationsPage, setCotisationsPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch data
  const { data: adminDash, loading: adminLoading, refetch: refetchAdmin } = useApi<AdminDashResponse>('/api/admin/dashboard');
  const { data: ventesResponse } = useApi<VentesResponse>('/api/admin/ventes?limit=50');
  const { data: cotisationsResponse } = useApi<CotisationsResponse>(`/api/admin/cotisations?page=${cotisationsPage}&limit=15`);
  const { data: creditsAlimResponse } = useApi<CreditsAlimResponse>('/api/admin/creditsAlimentaires?limit=50');
  const { data: stockResponse } = useApi<StockResponse>('/api/admin/stock?limit=1');
  const { data: tontinesResponse } = useApi<TontinesResponse>('/api/admin/tontines?limit=50');

  const adminData = adminDash?.data;
  const ventesStats = ventesResponse?.stats;
  const ventes = ventesResponse?.data ?? [];
  const cotisationsStats = cotisationsResponse?.stats;
  const cotisations = cotisationsResponse?.data ?? [];
  const cotisationsMeta = cotisationsResponse?.meta;
  const creditsStats = creditsAlimResponse?.stats;
  const stockStats = stockResponse?.stats;
  const tontines = tontinesResponse?.data ?? [];
  const tontinesActives = tontines.filter(t => t.statut === 'ACTIVE');

  // Calculs financiers
  const totalRevenus = Number(ventesStats?.montantTotal ?? 0) + Number(cotisationsStats?.montantTotalCollecte ?? 0);
  const totalCreditsAlloues = Number(creditsStats?.montantTotalPlafond ?? 0);
  const totalCreditsUtilises = Number(creditsStats?.montantTotalUtilise ?? 0);
  const totalCreditsRestant = Number(creditsStats?.montantTotalRestant ?? 0);
  const valeurStock = Number(stockStats?.valeurTotale ?? 0);

  const isLoading = adminLoading && !adminDash;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement de la comptabilite...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Revenus Totaux', value: formatCurrency(totalRevenus), subtitle: 'Ventes + Cotisations', icon: TrendingUp, color: 'text-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Credits Alloues', value: formatCurrency(totalCreditsAlloues), subtitle: `${formatCurrency(totalCreditsUtilises)} utilises`, icon: CreditCard, color: 'text-violet-500', lightBg: 'bg-violet-50' },
    { label: 'Valeur du Stock', value: formatCurrency(valeurStock), subtitle: `${stockStats?.totalProduits ?? 0} produits`, icon: ShoppingBag, color: 'text-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Membres Actifs', value: String(adminData?.membresActifs ?? 0), subtitle: `${adminData?.tontinesActives ?? 0} tontines actives`, icon: Users, color: 'text-orange-500', lightBg: 'bg-orange-50' },
  ];

  const tabs = [
    { key: 'synthese' as const, label: 'Synthese Financiere', icon: PieChart },
    { key: 'operations' as const, label: 'Operations', icon: Receipt },
    { key: 'etats' as const, label: 'Etats Financiers', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/20 font-['DM_Sans',sans-serif]">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                <Calculator size={22} className="text-violet-600" />
                Comptabilite
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/user/notifications" className="text-slate-600 hover:text-slate-800 px-2">
                <span role="img" aria-label="notifications">&#x1F514;</span>
              </Link>
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">$</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Comptabilite Generale</h2>
            <p className="text-slate-500">Vue d&apos;ensemble financiere, operations et etats comptables</p>
          </div>
          <div className="flex gap-3">
            <button onClick={refetchAdmin} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <RefreshCw size={18} />
              Actualiser
            </button>
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Exporter PDF
            </button>
          </div>
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
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB: Synthese */}
        {activeTab === 'synthese' && (
          <div className="space-y-6">
            {/* Revenus vs Engagements */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenus */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ArrowUpRight size={20} className="text-emerald-600" />
                  Revenus &amp; Entrees
                </h3>
                <div className="space-y-1">
                  <FinancialRow label="Ventes (Credit Alimentaire)" value={formatCurrency(ventesStats?.montantTotal ?? 0)} type="positive" icon={ShoppingCart} />
                  <FinancialRow label="Cotisations Collectees" value={formatCurrency(cotisationsStats?.montantTotalCollecte ?? 0)} type="positive" icon={Calendar} />
                </div>
                <div className="mt-4 pt-4 border-t-2 border-emerald-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800">Total Revenus</span>
                  <span className="text-2xl font-bold text-emerald-600">{formatCurrency(totalRevenus)}</span>
                </div>
              </div>

              {/* Engagements */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ArrowDownRight size={20} className="text-red-600" />
                  Engagements &amp; Credits
                </h3>
                <div className="space-y-1">
                  <FinancialRow label="Credits Alimentaires Alloues" value={formatCurrency(totalCreditsAlloues)} type="negative" icon={ShoppingBag} />
                  <FinancialRow label="Credits Utilises" value={formatCurrency(totalCreditsUtilises)} type="neutral" icon={CreditCard} />
                  <FinancialRow label="Solde Restant Credits" value={formatCurrency(totalCreditsRestant)} type="neutral" icon={Wallet} />
                </div>
                <div className="mt-4 pt-4 border-t-2 border-red-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800">Total Engage</span>
                  <span className="text-2xl font-bold text-red-600">{formatCurrency(totalCreditsAlloues)}</span>
                </div>
              </div>
            </div>

            {/* Indicateurs cles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><Banknote size={24} /></div>
                  <div>
                    <p className="text-emerald-100 text-sm">Cotisations Collectees</p>
                    <p className="text-3xl font-bold">{formatCurrency(cotisationsStats?.montantTotalCollecte ?? 0)}</p>
                  </div>
                </div>
                <p className="text-emerald-100 text-sm">{cotisationsStats?.totalPayees ?? 0} cotisations payees</p>
              </div>
              <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-6 text-white shadow-lg shadow-violet-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><ShoppingCart size={24} /></div>
                  <div>
                    <p className="text-violet-100 text-sm">Volume de Ventes</p>
                    <p className="text-3xl font-bold">{ventesStats?.totalVentes ?? 0}</p>
                  </div>
                </div>
                <p className="text-violet-100 text-sm">{formatCurrency(ventesStats?.montantTotal ?? 0)} encaisses</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><BarChart3 size={24} /></div>
                  <div>
                    <p className="text-blue-100 text-sm">Credits en Cours</p>
                    <p className="text-3xl font-bold">{adminData?.creditsEnCours ?? 0}</p>
                  </div>
                </div>
                <p className="text-blue-100 text-sm">{creditsStats?.totalActifs ?? 0} credits alimentaires actifs</p>
              </div>
            </div>

            {/* Tontines actives - sommaire */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Users size={20} className="text-violet-600" />
                Tontines Actives — Engagements Cycliques
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Tontine</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Montant/Cycle</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Frequence</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Membres</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Flux / Cycle</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Debut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tontinesActives.map(t => {
                      const nbMembres = t._count?.membres ?? 0;
                      const fluxParCycle = Number(t.montantCycle) * nbMembres;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800">{t.nom}</td>
                          <td className="px-4 py-3 font-bold text-violet-600">{formatCurrency(t.montantCycle)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${t.frequence === 'MENSUEL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {t.frequence === 'MENSUEL' ? 'Mensuel' : 'Hebdomadaire'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{nbMembres}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{formatCurrency(fluxParCycle)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatDate(t.dateDebut)}</td>
                        </tr>
                      );
                    })}
                    {tontinesActives.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Aucune tontine active</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Operations */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            {/* Filtres */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher une cotisation par nom ou telephone..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCotisationsPage(1); }}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                />
              </div>
            </div>

            {/* Stats cotisations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-50 p-2.5 rounded-lg"><CheckCircle className="text-emerald-500 w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-slate-500">Payees</p>
                    <p className="text-xl font-bold text-slate-800">{cotisationsStats?.totalPayees ?? 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-50 p-2.5 rounded-lg"><Clock className="text-yellow-500 w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-slate-500">En attente</p>
                    <p className="text-xl font-bold text-slate-800">{cotisationsStats?.totalEnAttente ?? 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="bg-red-50 p-2.5 rounded-lg"><AlertCircle className="text-red-500 w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-slate-500">Expirees</p>
                    <p className="text-xl font-bold text-slate-800">{cotisationsStats?.totalExpirees ?? 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="bg-violet-50 p-2.5 rounded-lg"><DollarSign className="text-violet-500 w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-slate-500">Total Collecte</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(cotisationsStats?.montantTotalCollecte ?? 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tableau des cotisations */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <Receipt size={20} className="text-violet-600" />
                <h3 className="font-bold text-slate-800">Operations - Cotisations</h3>
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
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Echeance</th>
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
                  <p className="text-sm text-slate-600">Page <span className="font-semibold">{cotisationsMeta.page}</span> sur <span className="font-semibold">{cotisationsMeta.totalPages}</span> ({cotisationsMeta.total} cotisations)</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCotisationsPage(p => Math.max(1, p - 1))} disabled={cotisationsPage <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                    <span className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium">{cotisationsPage}</span>
                    <button onClick={() => setCotisationsPage(p => Math.min(cotisationsMeta.totalPages, p + 1))} disabled={cotisationsPage >= cotisationsMeta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Etats Financiers */}
        {activeTab === 'etats' && (
          <div className="space-y-6">
            {/* Bilan simplifie */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-200">
                  <h3 className="font-bold text-emerald-800 flex items-center gap-2">
                    <ArrowUpRight size={20} />
                    Actif
                  </h3>
                </div>
                <div className="p-6 space-y-1">
                  <FinancialRow label="Valeur du Stock" value={formatCurrency(valeurStock)} type="positive" icon={ShoppingBag} />
                  <FinancialRow label="Cotisations Collectees" value={formatCurrency(cotisationsStats?.montantTotalCollecte ?? 0)} type="positive" icon={Calendar} />
                  <FinancialRow label="Ventes Realisees" value={formatCurrency(ventesStats?.montantTotal ?? 0)} type="positive" icon={ShoppingCart} />
                  <FinancialRow label="Credits Restant a Percevoir" value={formatCurrency(totalCreditsRestant)} type="positive" icon={CreditCard} />
                </div>
                <div className="px-6 py-4 bg-emerald-50 border-t border-emerald-200 flex justify-between items-center">
                  <span className="font-bold text-emerald-800">Total Actif</span>
                  <span className="text-2xl font-bold text-emerald-700">{formatCurrency(valeurStock + totalRevenus + totalCreditsRestant)}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 bg-red-50 border-b border-red-200">
                  <h3 className="font-bold text-red-800 flex items-center gap-2">
                    <ArrowDownRight size={20} />
                    Passif &amp; Engagements
                  </h3>
                </div>
                <div className="p-6 space-y-1">
                  <FinancialRow label="Credits Alimentaires Alloues" value={formatCurrency(totalCreditsAlloues)} type="negative" icon={ShoppingBag} />
                  <FinancialRow label="Credits Bancaires en Cours" value={String(adminData?.creditsEnCours ?? 0) + ' credits'} type="neutral" icon={Banknote} />
                  <FinancialRow label="Cotisations en Attente" value={String(cotisationsStats?.totalEnAttente ?? 0) + ' en attente'} type="neutral" icon={Clock} />
                  <FinancialRow label="Cotisations Expirees" value={String(cotisationsStats?.totalExpirees ?? 0) + ' expirees'} type="negative" icon={AlertCircle} />
                </div>
                <div className="px-6 py-4 bg-red-50 border-t border-red-200 flex justify-between items-center">
                  <span className="font-bold text-red-800">Total Engagements</span>
                  <span className="text-2xl font-bold text-red-700">{formatCurrency(totalCreditsAlloues)}</span>
                </div>
              </div>
            </div>

            {/* Ratios */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <BarChart3 size={20} className="text-violet-600" />
                Ratios &amp; Indicateurs Cles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Taux d&apos;Utilisation Credit</p>
                  <p className="text-3xl font-bold text-violet-600">
                    {totalCreditsAlloues > 0 ? Math.round((totalCreditsUtilises / totalCreditsAlloues) * 100) : 0}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{formatCurrency(totalCreditsUtilises)} / {formatCurrency(totalCreditsAlloues)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Taux Cotisation Payees</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {(cotisationsStats?.totalPayees ?? 0) + (cotisationsStats?.totalEnAttente ?? 0) + (cotisationsStats?.totalExpirees ?? 0) > 0
                      ? Math.round(((cotisationsStats?.totalPayees ?? 0) / ((cotisationsStats?.totalPayees ?? 0) + (cotisationsStats?.totalEnAttente ?? 0) + (cotisationsStats?.totalExpirees ?? 0))) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{cotisationsStats?.totalPayees ?? 0} payees</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Panier Moyen Vente</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {(ventesStats?.totalVentes ?? 0) > 0 ? formatCurrency(Number(ventesStats?.montantTotal ?? 0) / (ventesStats?.totalVentes ?? 1)) : '-'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">sur {ventesStats?.totalVentes ?? 0} ventes</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Credits Alimentaires Actifs</p>
                  <p className="text-3xl font-bold text-orange-600">{creditsStats?.totalActifs ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">{creditsStats?.totalEpuises ?? 0} epuises, {creditsStats?.totalExpires ?? 0} expires</p>
                </div>
              </div>
            </div>

            {/* Dernieres ventes pour audit */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <FileText size={20} className="text-violet-600" />
                <h3 className="font-bold text-slate-800">Journal des Ventes</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">#</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Qte</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Prix Unit.</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Montant Total</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ventes.slice(0, 15).map(vente => {
                      const montant = Number(vente.prixUnitaire) * vente.quantite;
                      return (
                        <tr key={vente.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-500 font-mono">#{vente.id}</td>
                          <td className="px-6 py-4 font-semibold text-slate-800">{vente.produit?.nom ?? '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{vente.quantite}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-800">{formatCurrency(vente.prixUnitaire)}</td>
                          <td className="px-6 py-4 font-bold text-emerald-600">{formatCurrency(montant)}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{formatDateTime(vente.createdAt)}</td>
                        </tr>
                      );
                    })}
                    {ventes.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Aucune vente enregistree</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
