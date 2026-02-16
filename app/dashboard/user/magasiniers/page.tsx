"use client";

import React, { useState, useEffect } from 'react';
import {
  Package, Archive, AlertTriangle, TrendingUp, Search, ArrowLeft,
  RefreshCw, Download, Eye, Edit, ClipboardList, ArrowUpCircle,
  ArrowDownCircle, BarChart3, Boxes, LucideIcon, CheckCircle, Clock
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';

// ============================================================================
// TYPES
// ============================================================================

interface Produit {
  id: number;
  nom: string;
  description: string | null;
  prixUnitaire: string;
  stock: number;
  alerteStock: number;
  createdAt: string;
  updatedAt: string;
}

interface StockResponse {
  data: Produit[];
  stats: {
    totalProduits: number;
    enRupture: number;
    stockFaible: number;
    valeurTotale: number | string;
  };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type StatutStock = 'EN_STOCK' | 'STOCK_FAIBLE' | 'RUPTURE';

const getStockStatut = (stock: number, alerte: number): StatutStock => {
  if (stock === 0) return 'RUPTURE';
  if (stock <= alerte) return 'STOCK_FAIBLE';
  return 'EN_STOCK';
};

const statutStyles: Record<StatutStock, { bg: string; text: string; border: string; dot: string; label: string }> = {
  EN_STOCK: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'En stock' },
  STOCK_FAIBLE: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Stock faible' },
  RUPTURE: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', label: 'Rupture' },
};

type InventaireStatut = 'A_VERIFIER' | 'CONFORME' | 'ECART';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const StatCard = ({ label, value, icon: Icon, color, lightBg }: {
  label: string; value: string; icon: LucideIcon; color: string; lightBg: string;
}) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
    <div className="flex items-start justify-between mb-4">
      <div className={`${lightBg} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
        <Icon className={`${color} w-6 h-6`} />
      </div>
    </div>
    <h3 className="text-slate-600 text-sm font-medium mb-1">{label}</h3>
    <p className="text-3xl font-bold text-slate-800">{value}</p>
  </div>
);

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function MagazinierPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'inventaire' | 'mouvements' | 'alertes'>('inventaire');
  const [filterStatut, setFilterStatut] = useState<StatutStock | ''>('');
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data: response, loading, error, refetch } = useApi<StockResponse>(`/api/admin/stock?${params}`);
  const produits = response?.data ?? [];
  const stats = response?.stats;
  const meta = response?.meta;

  // Filtrage local par statut stock
  const filteredProduits = filterStatut
    ? produits.filter(p => getStockStatut(p.stock, p.alerteStock) === filterStatut)
    : produits;

  // Produits en alerte (rupture + stock faible)
  const produitsAlerte = produits.filter(p => {
    const s = getStockStatut(p.stock, p.alerteStock);
    return s === 'RUPTURE' || s === 'STOCK_FAIBLE';
  });

  const getProgressColor = (quantite: number, seuil: number): string => {
    if (seuil === 0) return quantite > 0 ? 'bg-emerald-500' : 'bg-red-500';
    const pct = (quantite / seuil) * 100;
    if (pct > 100) return 'bg-emerald-500';
    if (pct > 50) return 'bg-blue-500';
    if (pct > 25) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getProgressPct = (quantite: number, seuil: number): number => {
    if (seuil === 0) return quantite > 0 ? 100 : 0;
    return Math.min((quantite / seuil) * 100, 100);
  };

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement de l&apos;inventaire...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Valeur Totale Stock', value: formatCurrency(stats?.valeurTotale ?? 0), icon: TrendingUp, color: 'text-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Produits en Stock', value: String(stats?.totalProduits ?? 0), icon: Package, color: 'text-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Stock Faible', value: String(stats?.stockFaible ?? 0), icon: AlertTriangle, color: 'text-amber-500', lightBg: 'bg-amber-50' },
    { label: 'Ruptures', value: String(stats?.enRupture ?? 0), icon: Archive, color: 'text-red-500', lightBg: 'bg-red-50' },
  ];

  const tabs = [
    { key: 'inventaire' as const, label: 'Inventaire', icon: ClipboardList },
    { key: 'mouvements' as const, label: 'Mouvements', icon: BarChart3 },
    { key: 'alertes' as const, label: 'Alertes', icon: AlertTriangle, badge: (stats?.enRupture ?? 0) + (stats?.stockFaible ?? 0) },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20 font-['DM_Sans',sans-serif]">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                Magazinier
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/user/notifications" className="text-slate-600 hover:text-slate-800 px-2">
                <span role="img" aria-label="notifications">&#x1F514;</span>
              </Link>
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-sm">M</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Tableau de Bord - Magazinier</h2>
            <p className="text-slate-500">Gerez l&apos;inventaire physique et suivez les mouvements de stock</p>
          </div>
          <div className="flex gap-3">
            <button onClick={refetch} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <RefreshCw size={18} />
              Actualiser
            </button>
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Exporter
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((stat, i) => (
            <StatCard key={i} {...stat} />
          ))}
        </div>

        {/* Alert Banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg shadow-red-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Archive size={24} />
              </div>
              <div>
                <p className="text-red-100 text-sm">Ruptures de stock</p>
                <p className="text-3xl font-bold">{stats?.enRupture ?? 0} produits</p>
              </div>
            </div>
            <p className="text-red-100 text-sm">Reapprovisionnement urgent necessaire</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg shadow-amber-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-amber-100 text-sm">Stock faible</p>
                <p className="text-3xl font-bold">{stats?.stockFaible ?? 0} produits</p>
              </div>
            </div>
            <p className="text-amber-100 text-sm">Prevoir une commande prochainement</p>
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
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un produit par nom..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
              />
            </div>
            {activeTab === 'inventaire' && (
              <select
                value={filterStatut}
                onChange={(e) => setFilterStatut(e.target.value as StatutStock | '')}
                className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
              >
                <option value="">Tous les statuts</option>
                <option value="EN_STOCK">En stock</option>
                <option value="STOCK_FAIBLE">Stock faible</option>
                <option value="RUPTURE">Rupture</option>
              </select>
            )}
          </div>
        </div>

        {/* TAB: Inventaire */}
        {activeTab === 'inventaire' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList size={20} className="text-orange-600" />
                <h3 className="font-bold text-slate-800">Inventaire Physique</h3>
              </div>
              <span className="text-sm text-slate-500">{filteredProduits.length} produit{filteredProduits.length !== 1 ? 's' : ''} affiche{filteredProduits.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Stock Actuel</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Seuil Alerte</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Niveau</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Prix Unitaire</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Valeur Stock</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Derniere MAJ</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProduits.map((produit) => {
                    const statut = getStockStatut(produit.stock, produit.alerteStock);
                    const style = statutStyles[statut];
                    const progressColor = getProgressColor(produit.stock, produit.alerteStock);
                    const progressPct = getProgressPct(produit.stock, produit.alerteStock);
                    const valeurStock = produit.stock * Number(produit.prixUnitaire);

                    return (
                      <tr key={produit.id} className={`hover:bg-slate-50 transition-colors ${statut === 'RUPTURE' ? 'bg-red-50/30' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              statut === 'RUPTURE' ? 'bg-red-100' : statut === 'STOCK_FAIBLE' ? 'bg-amber-100' : 'bg-emerald-100'
                            }`}>
                              <Boxes size={20} className={
                                statut === 'RUPTURE' ? 'text-red-600' : statut === 'STOCK_FAIBLE' ? 'text-amber-600' : 'text-emerald-600'
                              } />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{produit.nom}</p>
                              {produit.description && <p className="text-xs text-slate-500">{produit.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className={`text-lg font-bold ${statut === 'RUPTURE' ? 'text-red-600' : statut === 'STOCK_FAIBLE' ? 'text-amber-600' : 'text-slate-800'}`}>
                            {produit.stock}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{produit.alerteStock}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1.5 w-28">
                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${progressColor} rounded-full transition-all`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">{Math.round(progressPct)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-slate-800">{formatCurrency(produit.prixUnitaire)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-base font-bold text-slate-800">{formatCurrency(valeurStock)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                            <div className={`w-2 h-2 rounded-full ${style.dot}`}></div>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600">{formatDate(produit.updatedAt)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link href={`/dashboard/admin/stock/${produit.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                              <Eye size={16} />
                            </Link>
                            <Link href={`/dashboard/admin/stock/${produit.id}/edit`} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                              <Edit size={16} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProduits.length === 0 && (
                    <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-500">Aucun produit trouve</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {meta && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Page <span className="font-semibold">{meta.page}</span> sur <span className="font-semibold">{meta.totalPages}</span> ({meta.total} produits)
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                  <span className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium">{page}</span>
                  <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Mouvements */}
        {activeTab === 'mouvements' && (
          <div className="space-y-6">
            {/* Resume des mouvements */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-emerald-50 p-3 rounded-xl">
                    <ArrowUpCircle className="text-emerald-500 w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-slate-600 text-sm">Entrees recentes</p>
                    <p className="text-2xl font-bold text-slate-800">-</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Receptions et approvisionnements</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-red-50 p-3 rounded-xl">
                    <ArrowDownCircle className="text-red-500 w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-slate-600 text-sm">Sorties recentes</p>
                    <p className="text-2xl font-bold text-slate-800">-</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Ventes et distributions</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-50 p-3 rounded-xl">
                    <ClipboardList className="text-blue-500 w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-slate-600 text-sm">Inventaires effectues</p>
                    <p className="text-2xl font-bold text-slate-800">-</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Ce mois</p>
              </div>
            </div>

            {/* Historique des mouvements (base sur les produits existants) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <BarChart3 size={20} className="text-orange-600" />
                <h3 className="font-bold text-slate-800">Produits par Date de Mise a Jour</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Stock</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date Creation</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Derniere MAJ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...produits].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((produit) => {
                      const statut = getStockStatut(produit.stock, produit.alerteStock);
                      const style = statutStyles[statut];
                      return (
                        <tr key={produit.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-800">{produit.nom}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-lg font-bold text-slate-800">{produit.stock}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                              <div className={`w-2 h-2 rounded-full ${style.dot}`}></div>
                              {style.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600">{formatDate(produit.createdAt)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600">{formatDate(produit.updatedAt)}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {produits.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Aucun mouvement enregistre</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Alertes */}
        {activeTab === 'alertes' && (
          <div className="space-y-6">
            {/* Produits en rupture */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Archive className="text-red-600" size={22} />
                <h3 className="text-xl font-bold text-slate-800">Produits en Rupture</h3>
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">{stats?.enRupture ?? 0}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {produits.filter(p => p.stock === 0).map(produit => (
                  <div key={produit.id} className="bg-white rounded-xl p-5 shadow-sm border border-red-200 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                          <Archive size={20} className="text-red-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{produit.nom}</p>
                          <p className="text-xs text-slate-500">Seuil: {produit.alerteStock}</p>
                        </div>
                      </div>
                      <span className="bg-red-100 text-red-700 border border-red-200 text-xs font-semibold px-3 py-1.5 rounded-full">Rupture</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">Prix unitaire</span>
                      <span className="font-bold text-slate-800">{formatCurrency(produit.prixUnitaire)}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link href={`/dashboard/admin/stock/${produit.id}/edit`} className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-sm font-medium text-center transition-colors">
                        Reapprovisionner
                      </Link>
                    </div>
                  </div>
                ))}
                {produits.filter(p => p.stock === 0).length === 0 && (
                  <div className="col-span-full bg-emerald-50 rounded-xl p-8 text-center border border-emerald-200">
                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                    <p className="text-emerald-700 font-medium">Aucune rupture de stock</p>
                  </div>
                )}
              </div>
            </div>

            {/* Produits en stock faible */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="text-amber-600" size={22} />
                <h3 className="text-xl font-bold text-slate-800">Stock Faible</h3>
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{stats?.stockFaible ?? 0}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {produits.filter(p => p.stock > 0 && p.stock <= p.alerteStock).map(produit => {
                  const pct = produit.alerteStock > 0 ? Math.round((produit.stock / produit.alerteStock) * 100) : 100;
                  return (
                    <div key={produit.id} className="bg-white rounded-xl p-5 shadow-sm border border-amber-200 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <AlertTriangle size={20} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{produit.nom}</p>
                            <p className="text-xs text-slate-500">Stock: {produit.stock} / Seuil: {produit.alerteStock}</p>
                          </div>
                        </div>
                        <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold px-3 py-1.5 rounded-full">Faible</span>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs text-slate-600">Niveau</span>
                          <span className="text-xs font-bold text-slate-900">{pct}%</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/dashboard/admin/stock/${produit.id}/edit`} className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-sm font-medium text-center transition-colors">
                          Reapprovisionner
                        </Link>
                      </div>
                    </div>
                  );
                })}
                {produits.filter(p => p.stock > 0 && p.stock <= p.alerteStock).length === 0 && (
                  <div className="col-span-full bg-emerald-50 rounded-xl p-8 text-center border border-emerald-200">
                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                    <p className="text-emerald-700 font-medium">Tous les stocks sont au-dessus du seuil</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
