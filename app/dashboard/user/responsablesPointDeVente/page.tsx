"use client";

import React, { useState, useEffect } from 'react';
import {
  Package, Users, ShoppingCart, TrendingUp, AlertTriangle, Archive,
  Search, Eye, ArrowLeft, RefreshCw, Download, UserCheck, Wallet,
  BarChart3, Clock, CheckCircle, XCircle, LucideIcon
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { getStatusStyle, getStatusLabel } from '@/lib/status';

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

interface Vente {
  id: number;
  montant: string;
  quantite: number;
  createdAt: string;
  produit: { nom: string };
  creditAlimentaire?: { membre?: { nom: string; prenom: string } | null; client?: { nom: string; prenom: string } | null } | null;
}

interface VentesResponse {
  data: Vente[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Gestionnaire {
  id: number;
  role: string;
  membre: { id: number; nom: string; prenom: string; email: string; photo: string | null; etat: string };
}

interface GestionnairesResponse {
  data: Gestionnaire[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type StatutStock = 'EN_STOCK' | 'STOCK_FAIBLE' | 'RUPTURE';

const getStockStatut = (stock: number, alerte: number): StatutStock => {
  if (stock === 0) return 'RUPTURE';
  if (stock <= alerte) return 'STOCK_FAIBLE';
  return 'EN_STOCK';
};

const statutStyles: Record<StatutStock, { bg: string; text: string; dot: string; label: string }> = {
  EN_STOCK: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'En stock' },
  STOCK_FAIBLE: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Stock faible' },
  RUPTURE: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'Rupture' },
};

const roleLabels: Record<string, string> = {
  CAISSIER: 'Caissier',
  MAGAZINIER: 'Magazinier',
  AGENT_TERRAIN: 'Agent terrain',
  COMMERCIAL: 'Commercial',
  CONTROLEUR_TERRAIN: 'Controleur terrain',
  RESPONSABLE_VENTE_CREDIT: 'Resp. vente credit',
};

const roleColors: Record<string, string> = {
  CAISSIER: 'bg-blue-100 text-blue-700',
  MAGAZINIER: 'bg-purple-100 text-purple-700',
  AGENT_TERRAIN: 'bg-teal-100 text-teal-700',
  COMMERCIAL: 'bg-orange-100 text-orange-700',
  CONTROLEUR_TERRAIN: 'bg-indigo-100 text-indigo-700',
  RESPONSABLE_VENTE_CREDIT: 'bg-pink-100 text-pink-700',
};

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

export default function ResponsablePointDeVentePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stockPage, setStockPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'produits' | 'equipe' | 'ventes'>('produits');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const stockParams = new URLSearchParams({ page: String(stockPage), limit: '10' });
  if (debouncedSearch && activeTab === 'produits') stockParams.set('search', debouncedSearch);

  const { data: stockResponse, loading: stockLoading, refetch: refetchStock } = useApi<StockResponse>(`/api/admin/stock?${stockParams}`);
  const { data: ventesResponse, loading: ventesLoading } = useApi<VentesResponse>('/api/admin/ventes?limit=10');
  const { data: gestionResponse, loading: gestionLoading } = useApi<GestionnairesResponse>('/api/admin/gestionnaires?limit=50');

  const produits = stockResponse?.data ?? [];
  const stockStats = stockResponse?.stats;
  const stockMeta = stockResponse?.meta;
  const ventes = ventesResponse?.data ?? [];
  const ventesMeta = ventesResponse?.meta;
  const gestionnaires = gestionResponse?.data ?? [];

  // Filtrer l'equipe du point de vente (caissiers, magaziniers, agents)
  const equipeRoles = ['CAISSIER', 'MAGAZINIER', 'AGENT_TERRAIN', 'COMMERCIAL', 'CONTROLEUR_TERRAIN', 'RESPONSABLE_VENTE_CREDIT'];
  const equipe = gestionnaires.filter(g => equipeRoles.includes(g.role));

  const isLoading = stockLoading && !stockResponse;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Valeur Totale Stock', value: formatCurrency(stockStats?.valeurTotale ?? 0), icon: TrendingUp, color: 'text-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Produits en Stock', value: String(stockStats?.totalProduits ?? 0), icon: Package, color: 'text-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Equipe Active', value: String(equipe.length), icon: Users, color: 'text-indigo-500', lightBg: 'bg-indigo-50' },
    { label: 'Ventes Recentes', value: String(ventesMeta?.total ?? 0), icon: ShoppingCart, color: 'text-purple-500', lightBg: 'bg-purple-50' },
  ];

  const alertCards = [
    { label: 'Ruptures de stock', value: stockStats?.enRupture ?? 0, icon: Archive, gradient: 'from-red-500 to-red-600', shadow: 'shadow-red-200', subtitle: 'Action immediate requise' },
    { label: 'Stock faible', value: stockStats?.stockFaible ?? 0, icon: AlertTriangle, gradient: 'from-amber-500 to-amber-600', shadow: 'shadow-amber-200', subtitle: 'Reapprovisionnement necessaire' },
  ];

  const tabs = [
    { key: 'produits' as const, label: 'Produits', icon: Package },
    { key: 'equipe' as const, label: 'Equipe', icon: Users },
    { key: 'ventes' as const, label: 'Ventes', icon: ShoppingCart },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 font-['DM_Sans',sans-serif]">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Point de Vente
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/user/notifications" className="text-slate-600 hover:text-slate-800 px-2">
                <span role="img" aria-label="notifications">&#x1F514;</span>
              </Link>
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">R</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Tableau de Bord - Responsable PDV</h2>
            <p className="text-slate-500">Gerez vos produits, supervisez votre equipe et suivez les ventes</p>
          </div>
          <div className="flex gap-3">
            <button onClick={refetchStock} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
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

        {/* Alert Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {alertCards.map((alert, i) => {
            const Icon = alert.icon;
            return (
              <div key={i} className={`bg-gradient-to-br ${alert.gradient} rounded-2xl p-6 text-white shadow-lg ${alert.shadow}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Icon size={24} />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm">{alert.label}</p>
                    <p className="text-3xl font-bold">{alert.value} produits</p>
                  </div>
                </div>
                <p className="text-white/80 text-sm">{alert.subtitle}</p>
              </div>
            );
          })}
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
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
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
                placeholder={activeTab === 'produits' ? "Rechercher un produit..." : activeTab === 'equipe' ? "Rechercher un membre..." : "Rechercher une vente..."}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setStockPage(1); }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* TAB: Produits */}
        {activeTab === 'produits' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantite</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Niveau</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Prix Unitaire</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Valeur</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {produits.map((produit) => {
                    const statut = getStockStatut(produit.stock, produit.alerteStock);
                    const style = statutStyles[statut];
                    const valeur = produit.stock * Number(produit.prixUnitaire);
                    const pct = produit.alerteStock > 0 ? Math.min((produit.stock / produit.alerteStock) * 100, 100) : (produit.stock > 0 ? 100 : 0);

                    return (
                      <tr key={produit.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800">{produit.nom}</p>
                          {produit.description && <p className="text-xs text-slate-500">{produit.description}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-lg font-bold text-slate-800">{produit.stock}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2 w-28">
                            <span className="text-xs text-slate-600">Seuil: {produit.alerteStock}</span>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${statut === 'EN_STOCK' ? 'bg-emerald-500' : statut === 'STOCK_FAIBLE' ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-slate-800">{formatCurrency(produit.prixUnitaire)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-base font-bold text-slate-800">{formatCurrency(valeur)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
                            <div className={`w-2 h-2 rounded-full ${style.dot}`}></div>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/dashboard/admin/stock/${produit.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors inline-flex">
                            <Eye size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {produits.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Aucun produit trouve</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {stockMeta && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Page <span className="font-semibold">{stockMeta.page}</span> sur <span className="font-semibold">{stockMeta.totalPages}</span> ({stockMeta.total} produits)
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setStockPage(p => Math.max(1, p - 1))} disabled={stockPage <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                  <span className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium">{stockPage}</span>
                  <button onClick={() => setStockPage(p => Math.min(stockMeta.totalPages, p + 1))} disabled={stockPage >= stockMeta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Equipe */}
        {activeTab === 'equipe' && (
          <div className="space-y-6">
            {/* Repartition par role */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {equipeRoles.map(role => {
                const count = equipe.filter(g => g.role === role).length;
                return (
                  <div key={role} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 text-center">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mb-3 ${roleColors[role] ?? 'bg-gray-100 text-gray-700'}`}>
                      {roleLabels[role] ?? role}
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{count}</p>
                  </div>
                );
              })}
            </div>

            {/* Liste de l'equipe */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Membre</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {equipe.filter(g => {
                      if (!debouncedSearch) return true;
                      const q = debouncedSearch.toLowerCase();
                      return g.membre.nom.toLowerCase().includes(q) || g.membre.prenom.toLowerCase().includes(q) || g.membre.email.toLowerCase().includes(q);
                    }).map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold shadow-md text-sm">
                              {g.membre.prenom?.[0]}{g.membre.nom?.[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{g.membre.prenom} {g.membre.nom}</p>
                              <p className="text-sm text-slate-500">{g.membre.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${roleColors[g.role] ?? 'bg-gray-100 text-gray-700'}`}>
                            {roleLabels[g.role] ?? g.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(g.membre.etat)}`}>
                            {g.membre.etat === 'ACTIF' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {getStatusLabel(g.membre.etat)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/dashboard/admin/gestionnaires/${g.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors inline-flex">
                            <Eye size={16} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {equipe.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">Aucun membre d&apos;equipe trouve</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Ventes */}
        {activeTab === 'ventes' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantite</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Montant</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ventes.map((vente) => {
                    const client = vente.creditAlimentaire?.client ?? vente.creditAlimentaire?.membre;
                    return (
                      <tr key={vente.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500">#{vente.id}</td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800">{vente.produit?.nom ?? '-'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-700">{client ? `${client.prenom} ${client.nom}` : '-'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-slate-800">{vente.quantite}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-base font-bold text-emerald-600">{formatCurrency(vente.montant)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600">{formatDateTime(vente.createdAt)}</span>
                        </td>
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
        )}
      </main>
    </div>
  );
}
