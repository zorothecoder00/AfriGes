"use client";

import React, { useState, useEffect } from 'react';
import {
  Truck, Package, ArrowUpCircle, ArrowDownCircle, Search, ArrowLeft,
  RefreshCw, Download, Eye, Edit, AlertTriangle, Archive, CheckCircle,
  Clock, MapPin, ClipboardCheck, Boxes, LucideIcon, BarChart3, Plus, X
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';

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
  quantite: number;
  prixUnitaire: string;
  createdAt: string;
  produit: { id: number; nom: string; prixUnitaire: string };
  creditAlimentaire: {
    id: number;
    member?: { id: number; nom: string; prenom: string; email: string } | null;
  } | null;
}

interface VentesResponse {
  data: Vente[];
  stats: { totalVentes: number; montantTotal: number | string; clientsActifs: number };
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

export default function LogistiqueApprovisionnementPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'reception' | 'affectation' | 'livraisons'>('reception');
  const [receptionModal, setReceptionModal] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
  const [receptionQte, setReceptionQte] = useState('');
  const [receptionMotif, setReceptionMotif] = useState('');
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data: stockResponse, loading: stockLoading, error: stockError, refetch: refetchStock } = useApi<StockResponse>(`/api/admin/stock?${params}`);
  const { data: ventesResponse } = useApi<VentesResponse>('/api/admin/ventes?limit=20');

  const produits = stockResponse?.data ?? [];
  const stats = stockResponse?.stats;
  const meta = stockResponse?.meta;
  const ventes = ventesResponse?.data ?? [];
  const ventesStats = ventesResponse?.stats;

  // Produits a reapprovisionner (rupture + stock faible)
  const produitsAReapprovisionner = produits.filter(p => {
    const s = getStockStatut(p.stock, p.alerteStock);
    return s === 'RUPTURE' || s === 'STOCK_FAIBLE';
  });

  const isLoading = stockLoading && !stockResponse;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-blue-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement de la logistique...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Produits en Stock', value: String(stats?.totalProduits ?? 0), icon: Package, color: 'text-cyan-500', lightBg: 'bg-cyan-50' },
    { label: 'Valeur Stock', value: formatCurrency(stats?.valeurTotale ?? 0), icon: BarChart3, color: 'text-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'A Reapprovisionner', value: String(produitsAReapprovisionner.length), subtitle: 'Ruptures + stock faible', icon: Truck, color: 'text-amber-500', lightBg: 'bg-amber-50' },
    { label: 'Sorties Recentes', value: String(ventesStats?.totalVentes ?? 0), subtitle: `${formatCurrency(ventesStats?.montantTotal ?? 0)} distribues`, icon: ArrowDownCircle, color: 'text-purple-500', lightBg: 'bg-purple-50' },
  ];

  const tabs = [
    { key: 'reception' as const, label: 'Reception', icon: ArrowUpCircle },
    { key: 'affectation' as const, label: 'Affectation Stock', icon: Boxes },
    { key: 'livraisons' as const, label: 'Suivi Livraisons', icon: Truck },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-blue-50/20 font-['DM_Sans',sans-serif]">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                Logistique &amp; Approvisionnement
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/user/notifications" className="text-slate-600 hover:text-slate-800 px-2">
                <span role="img" aria-label="notifications">&#x1F514;</span>
              </Link>
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">L</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Logistique &amp; Approvisionnement</h2>
            <p className="text-slate-500">Receptionnez les produits, affectez les stocks et suivez les livraisons</p>
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

        {/* Erreur non-bloquante */}
        {stockError && !stockResponse && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2.5 rounded-xl">
                <AlertTriangle className="text-amber-600 w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-amber-800">Impossible de charger les donnees</p>
                <p className="text-sm text-amber-600">Les donnees de stock ne sont pas disponibles pour le moment. Verifiez vos droits d&apos;acces.</p>
              </div>
            </div>
            <button onClick={refetchStock} className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-medium text-sm flex items-center gap-2 shrink-0">
              <RefreshCw size={16} />
              Reessayer
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((stat, i) => <StatCard key={i} {...stat} />)}
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
            <p className="text-red-100 text-sm">Commande urgente a passer</p>
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
            <p className="text-amber-100 text-sm">Reapprovisionnement a planifier</p>
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
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-200'
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
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Modal Reception */}
        {receptionModal && selectedProduit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
              <button onClick={() => { setReceptionModal(false); setSelectedProduit(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-cyan-50 p-3 rounded-xl">
                  <ArrowUpCircle className="text-cyan-600 w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Receptioner du stock</h2>
                  <p className="text-sm text-slate-500">{selectedProduit.nom}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Stock actuel</span>
                  <span className="font-bold text-slate-800">{selectedProduit.stock} unites</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Seuil d&apos;alerte</span>
                  <span className="font-bold text-slate-800">{selectedProduit.alerteStock}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-600 mb-1 block">Quantite recue</label>
                  <input
                    type="number" placeholder="Ex: 50" min="1" required
                    value={receptionQte}
                    onChange={e => setReceptionQte(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600 mb-1 block">Motif / Reference livraison</label>
                  <input
                    type="text" placeholder="Ex: Livraison fournisseur #42"
                    value={receptionMotif}
                    onChange={e => setReceptionMotif(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-50"
                  />
                </div>
                <button
                  onClick={() => { setReceptionModal(false); setSelectedProduit(null); setReceptionQte(''); setReceptionMotif(''); }}
                  className="w-full py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-all font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  Valider la reception
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Reception */}
        {activeTab === 'reception' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpCircle size={20} className="text-cyan-600" />
                <h3 className="font-bold text-slate-800">Reception de Marchandises</h3>
              </div>
              <span className="text-sm text-slate-500">Cliquez sur &quot;Receptioner&quot; pour enregistrer une entree</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Stock Actuel</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Seuil Alerte</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Niveau</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Derniere MAJ</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {produits.map((produit) => {
                    const statut = getStockStatut(produit.stock, produit.alerteStock);
                    const style = statutStyles[statut];
                    const pct = produit.alerteStock > 0 ? Math.min((produit.stock / produit.alerteStock) * 100, 100) : (produit.stock > 0 ? 100 : 0);

                    return (
                      <tr key={produit.id} className={`hover:bg-slate-50 transition-colors ${statut === 'RUPTURE' ? 'bg-red-50/40' : ''}`}>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800">{produit.nom}</p>
                          {produit.description && <p className="text-xs text-slate-500">{produit.description}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-lg font-bold ${statut === 'RUPTURE' ? 'text-red-600' : 'text-slate-800'}`}>{produit.stock}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{produit.alerteStock}</td>
                        <td className="px-6 py-4">
                          <div className="w-24">
                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${statut === 'EN_STOCK' ? 'bg-emerald-500' : statut === 'STOCK_FAIBLE' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
                            <div className={`w-2 h-2 rounded-full ${style.dot}`}></div>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(produit.updatedAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setSelectedProduit(produit); setReceptionModal(true); }}
                              className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              <ArrowUpCircle size={14} />
                              Receptioner
                            </button>
                            <Link href={`/dashboard/admin/stock/${produit.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                              <Eye size={16} />
                            </Link>
                          </div>
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
            {meta && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Page <span className="font-semibold">{meta.page}</span> sur <span className="font-semibold">{meta.totalPages}</span> ({meta.total} produits)
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                  <span className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium">{page}</span>
                  <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Affectation Stock */}
        {activeTab === 'affectation' && (
          <div className="space-y-6">
            {/* Produits urgents */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="text-red-600" size={22} />
                <h3 className="text-xl font-bold text-slate-800">Produits a Reapprovisionner en Priorite</h3>
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">{produitsAReapprovisionner.length}</span>
              </div>
              {produitsAReapprovisionner.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {produitsAReapprovisionner.map(produit => {
                    const statut = getStockStatut(produit.stock, produit.alerteStock);
                    const isRupture = statut === 'RUPTURE';
                    return (
                      <div key={produit.id} className={`bg-white rounded-xl p-5 shadow-sm border ${isRupture ? 'border-red-200' : 'border-amber-200'} hover:shadow-md transition-all`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isRupture ? 'bg-red-100' : 'bg-amber-100'}`}>
                              {isRupture ? <Archive size={20} className="text-red-600" /> : <AlertTriangle size={20} className="text-amber-600" />}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{produit.nom}</p>
                              <p className="text-xs text-slate-500">Stock: {produit.stock} / Seuil: {produit.alerteStock}</p>
                            </div>
                          </div>
                          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${isRupture ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isRupture ? 'Rupture' : 'Faible'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mb-3">
                          <span className="text-slate-600">Valeur unitaire</span>
                          <span className="font-bold text-slate-800">{formatCurrency(produit.prixUnitaire)}</span>
                        </div>
                        <button
                          onClick={() => { setSelectedProduit(produit); setReceptionModal(true); }}
                          className={`w-full py-2 rounded-lg text-sm font-medium text-center transition-colors flex items-center justify-center gap-1.5 ${
                            isRupture
                              ? 'bg-red-50 hover:bg-red-100 text-red-600'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-600'
                          }`}
                        >
                          <Truck size={16} />
                          Commander / Receptioner
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-emerald-50 rounded-xl p-8 text-center border border-emerald-200">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-emerald-700 font-medium">Tous les stocks sont suffisants</p>
                </div>
              )}
            </div>

            {/* Repartition du stock */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Boxes size={20} className="text-cyan-600" />
                Repartition Globale du Stock
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200 text-center">
                  <p className="text-4xl font-bold text-emerald-700">{(stats?.totalProduits ?? 0) - (stats?.enRupture ?? 0) - (stats?.stockFaible ?? 0)}</p>
                  <p className="text-sm text-emerald-600 mt-1">Produits en stock normal</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-5 border border-amber-200 text-center">
                  <p className="text-4xl font-bold text-amber-700">{stats?.stockFaible ?? 0}</p>
                  <p className="text-sm text-amber-600 mt-1">Stock faible</p>
                </div>
                <div className="bg-red-50 rounded-xl p-5 border border-red-200 text-center">
                  <p className="text-4xl font-bold text-red-700">{stats?.enRupture ?? 0}</p>
                  <p className="text-sm text-red-600 mt-1">En rupture</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Suivi Livraisons */}
        {activeTab === 'livraisons' && (
          <div className="space-y-6">
            {/* Resume des sorties */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-purple-50 p-3 rounded-xl"><ArrowDownCircle className="text-purple-500 w-6 h-6" /></div>
                  <div>
                    <p className="text-slate-600 text-sm">Total Sorties</p>
                    <p className="text-2xl font-bold text-slate-800">{ventesStats?.totalVentes ?? 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-emerald-50 p-3 rounded-xl"><BarChart3 className="text-emerald-500 w-6 h-6" /></div>
                  <div>
                    <p className="text-slate-600 text-sm">Montant Distribue</p>
                    <p className="text-2xl font-bold text-slate-800">{formatCurrency(ventesStats?.montantTotal ?? 0)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-blue-50 p-3 rounded-xl"><MapPin className="text-blue-500 w-6 h-6" /></div>
                  <div>
                    <p className="text-slate-600 text-sm">Beneficiaires Actifs</p>
                    <p className="text-2xl font-bold text-slate-800">{ventesStats?.clientsActifs ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tableau des sorties recentes */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <Truck size={20} className="text-cyan-600" />
                <h3 className="font-bold text-slate-800">Sorties de Stock Recentes</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">#</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Beneficiaire</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantite</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Montant</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ventes.map((vente) => {
                      const beneficiaire = vente.creditAlimentaire?.member;
                      const montant = Number(vente.prixUnitaire) * vente.quantite;
                      return (
                        <tr key={vente.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-500">#{vente.id}</td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-800">{vente.produit?.nom ?? '-'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-700">{beneficiaire ? `${beneficiaire.prenom} ${beneficiaire.nom}` : '-'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-800">{vente.quantite}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-red-600">{formatCurrency(montant)}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{formatDateTime(vente.createdAt)}</td>
                        </tr>
                      );
                    })}
                    {ventes.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Aucune sortie enregistree</td></tr>
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
