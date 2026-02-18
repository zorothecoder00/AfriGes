"use client";

import React, { useState, useEffect } from 'react';
import {
  Package, Archive, AlertTriangle, TrendingUp, Search, ArrowLeft,
  RefreshCw, Eye, ClipboardList, ArrowUpCircle, ArrowDownCircle,
  BarChart3, Boxes, LucideIcon, CheckCircle, X, Plus, ArrowRightLeft,
  ChevronDown, ChevronUp
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi, useMutation } from '@/hooks/useApi';
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

interface MouvementStock {
  id: number;
  produitId: number;
  type: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';
  quantite: number;
  motif: string | null;
  reference: string;
  dateMouvement: string;
  produit: { id: number; nom: string; stock: number; prixUnitaire: string };
}

interface ProduitDetail extends Produit {
  mouvements: Omit<MouvementStock, 'produit'>[];
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

interface MouvementsResponse {
  data: MouvementStock[];
  stats: { totalEntrees: number; totalSorties: number; totalAjustements: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface ProduitDetailResponse {
  data: ProduitDetail;
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

const typeStyles: Record<string, { bg: string; text: string; icon: typeof ArrowUpCircle; label: string }> = {
  ENTREE: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: ArrowUpCircle, label: 'Entree' },
  SORTIE: { bg: 'bg-red-100', text: 'text-red-700', icon: ArrowDownCircle, label: 'Sortie' },
  AJUSTEMENT: { bg: 'bg-blue-100', text: 'text-blue-700', icon: ArrowRightLeft, label: 'Ajustement' },
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

export default function MagasinierPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'inventaire' | 'journal' | 'reception' | 'alertes'>('inventaire');
  const [filterStatut, setFilterStatut] = useState<StatutStock | ''>('');
  const [filterType, setFilterType] = useState<'ENTREE' | 'SORTIE' | 'AJUSTEMENT' | ''>('');
  const [journalPage, setJournalPage] = useState(1);
  const limit = 10;

  // Modal states
  const [detailProduitId, setDetailProduitId] = useState<number | null>(null);
  const [showAjustementModal, setShowAjustementModal] = useState(false);
  const [ajustementProduitId, setAjustementProduitId] = useState<number | null>(null);
  const [ajustementType, setAjustementType] = useState<'ENTREE' | 'AJUSTEMENT'>('ENTREE');
  const [ajustementQuantite, setAjustementQuantite] = useState('');
  const [ajustementMotif, setAjustementMotif] = useState('');

  // Reception form state
  const [recProduitId, setRecProduitId] = useState('');
  const [recType, setRecType] = useState<'ENTREE' | 'AJUSTEMENT'>('ENTREE');
  const [recQuantite, setRecQuantite] = useState('');
  const [recMotif, setRecMotif] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ---- API calls ----
  const stockParams = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) stockParams.set('search', debouncedSearch);

  const { data: stockResponse, loading: stockLoading, refetch: refetchStock } = useApi<StockResponse>(`/api/admin/stock?${stockParams}`);
  const produits = stockResponse?.data ?? [];
  const stats = stockResponse?.stats;
  const meta = stockResponse?.meta;

  const journalParams = new URLSearchParams({ page: String(journalPage), limit: '20' });
  if (filterType) journalParams.set('type', filterType);
  if (debouncedSearch && activeTab === 'journal') journalParams.set('search', debouncedSearch);

  const { data: journalResponse, loading: journalLoading, refetch: refetchJournal } = useApi<MouvementsResponse>(
    activeTab === 'journal' ? `/api/magasinier/mouvements?${journalParams}` : null
  );

  const { data: detailResponse, loading: detailLoading } = useApi<ProduitDetailResponse>(
    detailProduitId ? `/api/magasinier/stock/${detailProduitId}` : null
  );

  const { mutate: submitAjustement, loading: ajustementLoading } = useMutation<unknown, { type: string; quantite: number; motif: string }>(
    `/api/magasinier/stock/${ajustementProduitId}/ajustement`,
    'POST',
    { successMessage: 'Operation effectuee avec succes' }
  );

  const { mutate: submitReception, loading: receptionLoading } = useMutation<unknown, { type: string; quantite: number; motif: string }>(
    `/api/magasinier/stock/${recProduitId}/ajustement`,
    'POST',
    { successMessage: 'Operation effectuee avec succes' }
  );

  // Filtrage local par statut stock
  const filteredProduits = filterStatut
    ? produits.filter(p => getStockStatut(p.stock, p.alerteStock) === filterStatut)
    : produits;

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

  const handleAjustement = async () => {
    if (!ajustementProduitId || !ajustementQuantite || !ajustementMotif) return;
    const qty = ajustementType === 'ENTREE' ? Math.abs(Number(ajustementQuantite)) : Number(ajustementQuantite);
    const result = await submitAjustement({ type: ajustementType, quantite: qty, motif: ajustementMotif });
    if (result) {
      setShowAjustementModal(false);
      setAjustementQuantite('');
      setAjustementMotif('');
      refetchStock();
    }
  };

  const handleReception = async () => {
    if (!recProduitId || !recQuantite || !recMotif) return;
    const qty = recType === 'ENTREE' ? Math.abs(Number(recQuantite)) : Number(recQuantite);
    const result = await submitReception({ type: recType, quantite: qty, motif: recMotif });
    if (result) {
      setRecQuantite('');
      setRecMotif('');
      refetchStock();
      if (activeTab === 'journal') refetchJournal();
    }
  };

  if (stockLoading && !stockResponse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement de l&apos;inventaire...</p>
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
    { key: 'journal' as const, label: 'Journal', icon: BarChart3 },
    { key: 'reception' as const, label: 'Reception', icon: Plus },
    { key: 'alertes' as const, label: 'Alertes', icon: AlertTriangle, badge: (stats?.enRupture ?? 0) + (stats?.stockFaible ?? 0) },
  ];

  const detailProduit = detailResponse?.data;

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
                Magasinier
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/user/notifications" className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
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
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Tableau de Bord - Magasinier</h2>
            <p className="text-slate-500">Gerez l&apos;inventaire, suivez les mouvements et receptionnez le stock</p>
          </div>
          <button onClick={() => { refetchStock(); if (activeTab === 'journal') refetchJournal(); }} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
            <RefreshCw size={18} />
            Actualiser
          </button>
        </div>

        {/* Stats Cards */}
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
                onClick={() => { setActiveTab(tab.key); setPage(1); setJournalPage(1); }}
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
                  }`}>{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder={activeTab === 'journal' ? "Rechercher par produit, motif ou reference..." : "Rechercher un produit par nom..."}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); setJournalPage(1); }}
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
            {activeTab === 'journal' && (
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value as typeof filterType); setJournalPage(1); }}
                className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
              >
                <option value="">Tous les types</option>
                <option value="ENTREE">Entrees</option>
                <option value="SORTIE">Sorties</option>
                <option value="AJUSTEMENT">Ajustements</option>
              </select>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* TAB: Inventaire */}
        {/* ================================================================ */}
        {activeTab === 'inventaire' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList size={20} className="text-orange-600" />
                <h3 className="font-bold text-slate-800">Inventaire Physique</h3>
              </div>
              <span className="text-sm text-slate-500">{filteredProduits.length} produit{filteredProduits.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Seuil</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Niveau</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Prix Unit.</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Valeur</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
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
                              <div className={`h-full ${progressColor} rounded-full transition-all`} style={{ width: `${progressPct}%` }} />
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDetailProduitId(produit.id)}
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Voir les mouvements"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => { setAjustementProduitId(produit.id); setAjustementType('ENTREE'); setShowAjustementModal(true); }}
                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Receptionner / Ajuster"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProduits.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500">Aucun produit trouve</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {meta && meta.totalPages > 1 && (
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

        {/* ================================================================ */}
        {/* TAB: Journal des Mouvements */}
        {/* ================================================================ */}
        {activeTab === 'journal' && (
          <div className="space-y-6">
            {/* Stats 30 jours */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-emerald-50 p-3 rounded-xl">
                    <ArrowUpCircle className="text-emerald-500 w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-slate-600 text-sm">Entrees (30j)</p>
                    <p className="text-2xl font-bold text-slate-800">{journalResponse?.stats.totalEntrees ?? '-'}</p>
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
                    <p className="text-slate-600 text-sm">Sorties (30j)</p>
                    <p className="text-2xl font-bold text-slate-800">{journalResponse?.stats.totalSorties ?? '-'}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Ventes et distributions</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-50 p-3 rounded-xl">
                    <ArrowRightLeft className="text-blue-500 w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-slate-600 text-sm">Ajustements (30j)</p>
                    <p className="text-2xl font-bold text-slate-800">{journalResponse?.stats.totalAjustements ?? '-'}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Corrections d&apos;inventaire</p>
              </div>
            </div>

            {/* Table mouvements */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <BarChart3 size={20} className="text-orange-600" />
                <h3 className="font-bold text-slate-800">Journal des Mouvements</h3>
              </div>
              {journalLoading && !journalResponse ? (
                <div className="p-12 text-center">
                  <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-slate-500">Chargement du journal...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantite</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Motif</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(journalResponse?.data ?? []).map((mvt) => {
                          const ts = typeStyles[mvt.type];
                          const TypeIcon = ts.icon;
                          return (
                            <tr key={mvt.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="text-sm text-slate-700">{formatDate(mvt.dateMouvement)}</span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-semibold text-slate-800">{mvt.produit.nom}</p>
                                <p className="text-xs text-slate-500">Stock actuel: {mvt.produit.stock}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${ts.bg} ${ts.text}`}>
                                  <TypeIcon size={14} />
                                  {ts.label}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-lg font-bold ${mvt.type === 'ENTREE' ? 'text-emerald-600' : mvt.type === 'SORTIE' ? 'text-red-600' : 'text-blue-600'}`}>
                                  {mvt.type === 'ENTREE' ? '+' : mvt.type === 'SORTIE' ? '-' : ''}{mvt.quantite}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-slate-600">{mvt.motif || '-'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs text-slate-400 font-mono">{mvt.reference}</span>
                              </td>
                            </tr>
                          );
                        })}
                        {(journalResponse?.data ?? []).length === 0 && (
                          <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Aucun mouvement enregistre</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {journalResponse?.meta && journalResponse.meta.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                      <p className="text-sm text-slate-600">
                        Page <span className="font-semibold">{journalResponse.meta.page}</span> sur <span className="font-semibold">{journalResponse.meta.totalPages}</span> ({journalResponse.meta.total} mouvements)
                      </p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setJournalPage(p => Math.max(1, p - 1))} disabled={journalPage <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                        <span className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium">{journalPage}</span>
                        <button onClick={() => setJournalPage(p => Math.min(journalResponse.meta.totalPages, p + 1))} disabled={journalPage >= journalResponse.meta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Reception & Ajustement */}
        {/* ================================================================ */}
        {activeTab === 'reception' && (
          <div className="space-y-6">
            {/* Formulaire */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Plus size={20} className="text-orange-600" />
                <h3 className="font-bold text-slate-800">Nouvelle Operation</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Produit</label>
                  <select
                    value={recProduitId}
                    onChange={(e) => setRecProduitId(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                  >
                    <option value="">Selectionner un produit</option>
                    {produits.map(p => (
                      <option key={p.id} value={p.id}>{p.nom} (stock: {p.stock})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Type d&apos;operation</label>
                  <select
                    value={recType}
                    onChange={(e) => setRecType(e.target.value as 'ENTREE' | 'AJUSTEMENT')}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                  >
                    <option value="ENTREE">Reception (entree de stock)</option>
                    <option value="AJUSTEMENT">Ajustement (correction inventaire)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Quantite {recType === 'AJUSTEMENT' && <span className="text-xs text-slate-500">(negatif pour diminuer)</span>}
                  </label>
                  <input
                    type="number"
                    value={recQuantite}
                    onChange={(e) => setRecQuantite(e.target.value)}
                    min={recType === 'ENTREE' ? 1 : undefined}
                    placeholder={recType === 'ENTREE' ? 'Quantite recue' : 'Ex: -5 ou +10'}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Motif (obligatoire)</label>
                  <input
                    type="text"
                    value={recMotif}
                    onChange={(e) => setRecMotif(e.target.value)}
                    placeholder={recType === 'ENTREE' ? 'Ex: Reception commande #123' : 'Ex: Correction apres inventaire physique'}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                  />
                </div>
              </div>

              {/* Apercu */}
              {recProduitId && recQuantite && (
                <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">Apercu :</span>{' '}
                    {recType === 'ENTREE' ? 'Reception de' : 'Ajustement de'}{' '}
                    <span className="font-bold">{recQuantite}</span> unites sur{' '}
                    <span className="font-bold">{produits.find(p => p.id === Number(recProduitId))?.nom}</span>
                    {' → '}Stock actuel: {produits.find(p => p.id === Number(recProduitId))?.stock}
                    {' → '}Nouveau stock: <span className="font-bold">
                      {(produits.find(p => p.id === Number(recProduitId))?.stock ?? 0) + Number(recQuantite)}
                    </span>
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleReception}
                  disabled={!recProduitId || !recQuantite || !recMotif || receptionLoading}
                  className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {receptionLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Plus size={18} />
                  )}
                  {recType === 'ENTREE' ? 'Receptionner' : 'Ajuster'}
                </button>
              </div>
            </div>

            {/* Produits en alerte - raccourci */}
            {produits.filter(p => getStockStatut(p.stock, p.alerteStock) !== 'EN_STOCK').length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={20} className="text-amber-600" />
                  <h3 className="font-bold text-slate-800">Produits necessitant une reception</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {produits.filter(p => getStockStatut(p.stock, p.alerteStock) !== 'EN_STOCK').map(p => {
                    const statut = getStockStatut(p.stock, p.alerteStock);
                    return (
                      <div key={p.id} className={`p-4 rounded-xl border ${statut === 'RUPTURE' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-slate-800">{p.nom}</p>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${statut === 'RUPTURE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {statut === 'RUPTURE' ? 'Rupture' : 'Faible'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">Stock: {p.stock} / Seuil: {p.alerteStock}</p>
                        <button
                          onClick={() => { setRecProduitId(String(p.id)); setRecType('ENTREE'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="w-full py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-sm font-medium transition-colors"
                        >
                          Receptionner
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Alertes */}
        {/* ================================================================ */}
        {activeTab === 'alertes' && (
          <div className="space-y-6">
            {/* Banners */}
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
                    <div className="flex justify-between items-center text-sm mb-3">
                      <span className="text-slate-600">Prix unitaire</span>
                      <span className="font-bold text-slate-800">{formatCurrency(produit.prixUnitaire)}</span>
                    </div>
                    <button
                      onClick={() => { setActiveTab('reception'); setRecProduitId(String(produit.id)); setRecType('ENTREE'); }}
                      className="w-full py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-sm font-medium text-center transition-colors"
                    >
                      Receptionner
                    </button>
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
                      <button
                        onClick={() => { setActiveTab('reception'); setRecProduitId(String(produit.id)); setRecType('ENTREE'); }}
                        className="w-full py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-sm font-medium text-center transition-colors"
                      >
                        Receptionner
                      </button>
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

      {/* ================================================================ */}
      {/* MODAL: Detail produit (mouvements) */}
      {/* ================================================================ */}
      {detailProduitId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetailProduitId(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800">
                {detailLoading ? 'Chargement...' : `Mouvements - ${detailProduit?.nom ?? ''}`}
              </h3>
              <button onClick={() => setDetailProduitId(null)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                <X size={20} className="text-slate-600" />
              </button>
            </div>
            {detailLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-slate-500">Chargement des mouvements...</p>
              </div>
            ) : detailProduit ? (
              <div className="overflow-y-auto max-h-[70vh]">
                {/* Resume produit */}
                <div className="px-6 py-4 border-b border-slate-200 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Stock actuel</p>
                    <p className="text-2xl font-bold text-slate-800">{detailProduit.stock}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Seuil alerte</p>
                    <p className="text-2xl font-bold text-slate-800">{detailProduit.alerteStock}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Prix unitaire</p>
                    <p className="text-2xl font-bold text-slate-800">{formatCurrency(detailProduit.prixUnitaire)}</p>
                  </div>
                </div>

                {/* Mouvements */}
                <div className="px-6 py-4">
                  <h4 className="font-semibold text-slate-700 mb-3">Derniers mouvements ({detailProduit.mouvements.length})</h4>
                  {detailProduit.mouvements.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Aucun mouvement enregistre</p>
                  ) : (
                    <div className="space-y-2">
                      {detailProduit.mouvements.map(mvt => {
                        const ts = typeStyles[mvt.type];
                        const TypeIcon = ts.icon;
                        return (
                          <div key={mvt.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <div className={`p-2 rounded-lg ${ts.bg}`}>
                              <TypeIcon size={16} className={ts.text} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${mvt.type === 'ENTREE' ? 'text-emerald-600' : mvt.type === 'SORTIE' ? 'text-red-600' : 'text-blue-600'}`}>
                                  {mvt.type === 'ENTREE' ? '+' : mvt.type === 'SORTIE' ? '-' : ''}{mvt.quantite}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>{ts.label}</span>
                              </div>
                              <p className="text-xs text-slate-500 truncate">{mvt.motif || '-'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-slate-500">{formatDate(mvt.dateMouvement)}</p>
                              <p className="text-xs text-slate-400 font-mono">{mvt.reference}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">Produit introuvable</div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL: Ajustement rapide (depuis inventaire) */}
      {/* ================================================================ */}
      {showAjustementModal && ajustementProduitId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAjustementModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800">
                {ajustementType === 'ENTREE' ? 'Receptionner' : 'Ajuster'} - {produits.find(p => p.id === ajustementProduitId)?.nom}
              </h3>
              <button onClick={() => setShowAjustementModal(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                <X size={20} className="text-slate-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                <select
                  value={ajustementType}
                  onChange={(e) => setAjustementType(e.target.value as 'ENTREE' | 'AJUSTEMENT')}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                >
                  <option value="ENTREE">Reception (entree)</option>
                  <option value="AJUSTEMENT">Ajustement (correction)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quantite</label>
                <input
                  type="number"
                  value={ajustementQuantite}
                  onChange={(e) => setAjustementQuantite(e.target.value)}
                  min={ajustementType === 'ENTREE' ? 1 : undefined}
                  placeholder={ajustementType === 'ENTREE' ? 'Quantite recue' : 'Ex: -5 ou +10'}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Motif</label>
                <input
                  type="text"
                  value={ajustementMotif}
                  onChange={(e) => setAjustementMotif(e.target.value)}
                  placeholder="Ex: Reception commande fournisseur"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                />
              </div>

              {ajustementQuantite && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600">
                  Stock actuel: <span className="font-bold">{produits.find(p => p.id === ajustementProduitId)?.stock}</span>
                  {' → '}Nouveau: <span className="font-bold">
                    {(produits.find(p => p.id === ajustementProduitId)?.stock ?? 0) + (ajustementType === 'ENTREE' ? Math.abs(Number(ajustementQuantite)) : Number(ajustementQuantite))}
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAjustementModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium">
                  Annuler
                </button>
                <button
                  onClick={handleAjustement}
                  disabled={!ajustementQuantite || !ajustementMotif || ajustementLoading}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {ajustementLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Confirmer'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
