"use client";

import React, { useState, useEffect } from 'react';
import {
  Wallet, Package, ShoppingCart, TrendingUp, Search, ArrowLeft,
  RefreshCw, CreditCard, Eye, Clock, CheckCircle, AlertCircle,
  ShoppingBag, BarChart3, LucideIcon, Send, Plus, X, ArrowUpRight,
  ArrowDownRight, Store, Boxes
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { getStatusStyle, getStatusLabel } from '@/lib/status';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardResponse {
  success: boolean;
  data: {
    soldeGeneral: number | string;
    soldeTontine: number | string;
    soldeCredit: number | string;
    tontinesActives: number;
  };
}

interface Produit {
  id: number;
  nom: string;
  description: string | null;
  prixUnitaire: string;
  stock: number;
  alerteStock: number;
}

interface StockResponse {
  data: Produit[];
  stats: { totalProduits: number; enRupture: number; stockFaible: number; valeurTotale: number | string };
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
}

interface CreditAlimResponse {
  data: CreditAlimentaire[];
}

interface Credit {
  id: number;
  montant: string;
  montantRestant: string;
  dateDemande: string;
  statut: string;
}

interface CreditsResponse {
  data: Credit[];
  stats: { totalEmprunte: number; totalRestant: number; creditsActifs: number };
}

interface WalletTransaction {
  id: number;
  type: string;
  montant: string;
  description: string | null;
  reference: string;
  createdAt: string;
}

interface TransactionsResponse {
  data: WalletTransaction[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type TransactionType = 'DEPOT' | 'RETRAIT' | 'COTISATION' | 'TONTINE' | 'CREDIT' | 'REMBOURSEMENT_CREDIT' | 'ACHAT' | 'ANNULATION';

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

const txConfigs: Record<string, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  DEPOT: { icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50', label: 'Depot' },
  RETRAIT: { icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50', label: 'Retrait' },
  COTISATION: { icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Cotisation' },
  TONTINE: { icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Tontine' },
  CREDIT: { icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Credit' },
  REMBOURSEMENT_CREDIT: { icon: CreditCard, color: 'text-teal-600', bg: 'bg-teal-50', label: 'Remboursement' },
  ACHAT: { icon: ShoppingCart, color: 'text-pink-600', bg: 'bg-pink-50', label: 'Achat' },
  ANNULATION: { icon: AlertCircle, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Annulation' },
};

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function RevendeurPage() {
  const [activeTab, setActiveTab] = useState<'apercu' | 'produits' | 'creditStock' | 'ventes'>('apercu');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stockPage, setStockPage] = useState(1);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditMontant, setCreditMontant] = useState('');
  const [venteModalOpen, setVenteModalOpen] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
  const [venteQte, setVenteQte] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const stockParams = new URLSearchParams({ page: String(stockPage), limit: '10' });
  if (debouncedSearch && activeTab === 'produits') stockParams.set('search', debouncedSearch);

  // Fetch data
  const { data: dashResponse, loading: dashLoading } = useApi<DashboardResponse>('/api/user/dashboard');
  const { data: stockResponse, loading: stockLoading, refetch: refetchStock } = useApi<StockResponse>(`/api/admin/stock?${stockParams}`);
  const { data: creditAlimResponse } = useApi<CreditAlimResponse>('/api/user/creditsAlimentaires');
  const { data: creditsResponse, refetch: refetchCredits } = useApi<CreditsResponse>('/api/user/credits');
  const { data: txResponse } = useApi<TransactionsResponse>('/api/user/transactions?limit=10');
  const { mutate: requestCredit, loading: requesting, error: requestError } = useMutation('/api/user/credits', 'POST');

  const dashData = dashResponse?.data;
  const produits = stockResponse?.data ?? [];
  const stockStats = stockResponse?.stats;
  const stockMeta = stockResponse?.meta;
  const creditAlimentaire = (creditAlimResponse?.data ?? [])[0] ?? null;
  const credits = creditsResponse?.data ?? [];
  const creditsStats = creditsResponse?.stats;
  const transactions = txResponse?.data ?? [];

  const isLoading = dashLoading && !dashResponse;

  const handleCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await requestCredit({ montant: Number(creditMontant) });
    if (result) {
      setCreditModalOpen(false);
      setCreditMontant('');
      refetchCredits();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-rose-50/30 to-pink-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Mon Solde', value: formatCurrency(dashData?.soldeGeneral ?? 0), icon: Wallet, color: 'text-rose-500', lightBg: 'bg-rose-50' },
    { label: 'Produits Disponibles', value: String(stockStats?.totalProduits ?? 0), subtitle: `${stockStats?.enRupture ?? 0} en rupture`, icon: Package, color: 'text-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Credits en Cours', value: String(creditsStats?.creditsActifs ?? 0), subtitle: formatCurrency(creditsStats?.totalRestant ?? 0) + ' restant', icon: CreditCard, color: 'text-amber-500', lightBg: 'bg-amber-50' },
    { label: 'Credit Alimentaire', value: creditAlimentaire ? formatCurrency(creditAlimentaire.montantRestant) : '-', subtitle: creditAlimentaire ? `sur ${formatCurrency(creditAlimentaire.plafond)}` : 'Aucun actif', icon: ShoppingBag, color: 'text-purple-500', lightBg: 'bg-purple-50' },
  ];

  const tabs = [
    { key: 'apercu' as const, label: 'Apercu', icon: BarChart3 },
    { key: 'produits' as const, label: 'Produits Dispo', icon: Package },
    { key: 'creditStock' as const, label: 'Demander Stock', icon: CreditCard },
    { key: 'ventes' as const, label: 'Mes Ventes', icon: ShoppingCart },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-rose-50/30 to-pink-50/20 font-['DM_Sans',sans-serif]">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
                <Store size={22} className="text-rose-600" />
                Espace Revendeur
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/user/notifications" className="text-slate-600 hover:text-slate-800 px-2">
                <span role="img" aria-label="notifications">&#x1F514;</span>
              </Link>
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">R</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      {/* Modals */}
      {creditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
            <button onClick={() => setCreditModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-amber-50 p-3 rounded-xl"><CreditCard className="text-amber-600 w-6 h-6" /></div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Demander un stock a credit</h2>
                <p className="text-sm text-slate-500">Votre demande sera examinee par un administrateur</p>
              </div>
            </div>
            {requestError && <p className="text-red-500 mb-3 text-sm bg-red-50 p-3 rounded-lg">{requestError}</p>}
            <form onSubmit={handleCreditSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Montant souhaite (EUR)</label>
                <input
                  type="number" placeholder="Ex: 500" required min="1" step="0.01"
                  value={creditMontant}
                  onChange={e => setCreditMontant(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
                />
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
                <p className="font-medium mb-1">Comment ca fonctionne :</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Votre demande est envoyee a l&apos;administrateur</li>
                  <li>Apres approbation, le stock vous est attribue a credit</li>
                  <li>Vous remboursez au fur et a mesure de vos ventes</li>
                </ul>
              </div>
              <button type="submit" disabled={requesting} className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all font-semibold">
                {requesting ? "Envoi en cours..." : "Soumettre la demande"}
              </button>
            </form>
          </div>
        </div>
      )}

      {venteModalOpen && selectedProduit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
            <button onClick={() => { setVenteModalOpen(false); setSelectedProduit(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-rose-50 p-3 rounded-xl"><Send className="text-rose-600 w-6 h-6" /></div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Signaler une vente</h2>
                <p className="text-sm text-slate-500">{selectedProduit.nom}</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Prix unitaire</span>
                <span className="font-bold">{formatCurrency(selectedProduit.prixUnitaire)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Stock disponible</span>
                <span className="font-bold">{selectedProduit.stock} unites</span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Quantite vendue</label>
                <input
                  type="number" placeholder="Ex: 5" min="1" max={selectedProduit.stock} required
                  value={venteQte}
                  onChange={e => setVenteQte(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50"
                />
              </div>
              {venteQte && Number(venteQte) > 0 && (
                <div className="bg-rose-50 rounded-xl p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-rose-700">Montant total</span>
                    <span className="font-bold text-rose-800">{formatCurrency(Number(selectedProduit.prixUnitaire) * Number(venteQte))}</span>
                  </div>
                </div>
              )}
              <button
                onClick={() => { setVenteModalOpen(false); setSelectedProduit(null); setVenteQte(''); }}
                className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl hover:from-rose-700 hover:to-pink-700 transition-all font-medium flex items-center justify-center gap-2"
              >
                <Send size={18} />
                Signaler la vente
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Espace Revendeur</h2>
            <p className="text-slate-500">Consultez votre solde, vos produits et gerez vos ventes</p>
          </div>
          <button onClick={refetchStock} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
            <RefreshCw size={18} />
            Actualiser
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((stat, i) => <StatCard key={i} {...stat} />)}
        </div>

        {/* Solde & Credit Alimentaire Banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-6 text-white shadow-lg shadow-rose-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Wallet size={24} />
              </div>
              <div>
                <p className="text-rose-100 text-sm">Mon Solde General</p>
                <p className="text-3xl font-bold">{formatCurrency(dashData?.soldeGeneral ?? 0)}</p>
              </div>
            </div>
            <div className="flex gap-4 text-sm text-rose-100">
              <span>Tontine: {formatCurrency(dashData?.soldeTontine ?? 0)}</span>
              <span>Credit: {formatCurrency(dashData?.soldeCredit ?? 0)}</span>
            </div>
          </div>

          {creditAlimentaire ? (
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <p className="text-purple-100 text-sm">Credit Alimentaire Disponible</p>
                  <p className="text-3xl font-bold">{formatCurrency(creditAlimentaire.montantRestant)}</p>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-purple-100 mb-1">
                  <span>Utilise: {formatCurrency(creditAlimentaire.montantUtilise)}</span>
                  <span>Plafond: {formatCurrency(creditAlimentaire.plafond)}</span>
                </div>
                <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/60 rounded-full transition-all"
                    style={{ width: `${Number(creditAlimentaire.plafond) > 0 ? Math.round((Number(creditAlimentaire.montantUtilise) / Number(creditAlimentaire.plafond)) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-slate-400 to-slate-500 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <p className="text-slate-200 text-sm">Credit Alimentaire</p>
                  <p className="text-xl font-bold">Aucun credit actif</p>
                </div>
              </div>
            </div>
          )}
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
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB: Apercu */}
        {activeTab === 'apercu' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Credits en cours */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-800">Mes Credits en Cours</h3>
                <button onClick={() => setCreditModalOpen(true)} className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
                  <Plus size={16} />
                  Demander un credit
                </button>
              </div>
              {credits.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {credits.slice(0, 4).map(credit => {
                    const montant = Number(credit.montant);
                    const restant = Number(credit.montantRestant);
                    const pct = montant > 0 ? Math.round(((montant - restant) / montant) * 100) : 0;
                    const statutConfig: Record<string, { color: string; icon: LucideIcon; label: string }> = {
                      EN_ATTENTE: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'En attente' },
                      APPROUVE: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Approuve' },
                      REMBOURSE_PARTIEL: { color: 'bg-indigo-100 text-indigo-800', icon: TrendingUp, label: 'En cours' },
                      REMBOURSE_TOTAL: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Rembourse' },
                    };
                    const config = statutConfig[credit.statut] || { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: credit.statut };
                    const StatusIcon = config.icon;

                    return (
                      <div key={credit.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                        <div className="flex justify-between mb-3">
                          <span className="text-sm text-slate-500">Credit #{credit.id}</span>
                          <span className={`${config.color} text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1`}>
                            <StatusIcon size={12} />{config.label}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Montant</span>
                            <span className="font-bold text-slate-800">{formatCurrency(montant)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Reste</span>
                            <span className="font-bold text-red-600">{formatCurrency(restant)}</span>
                          </div>
                          {credit.statut !== 'EN_ATTENTE' && (
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">Remboursement</span>
                                <span className="font-bold">{pct}%</span>
                              </div>
                              <div className="h-2 bg-slate-200 rounded-full">
                                <div className="h-2 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-slate-100">
                  <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Aucun credit en cours</p>
                </div>
              )}
            </div>

            {/* Transactions recentes */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Transactions Recentes</h3>
                <div className="space-y-1">
                  {transactions.map(tx => {
                    const conf = txConfigs[tx.type] || { icon: Wallet, color: 'text-gray-600', bg: 'bg-gray-50', label: tx.type };
                    const TxIcon = conf.icon;
                    const isPositive = ['DEPOT', 'CREDIT', 'ANNULATION'].includes(tx.type);
                    return (
                      <div key={tx.id} className="flex items-center py-3 border-b border-slate-100 last:border-0">
                        <div className={`${conf.bg} rounded-lg p-2 mr-3 flex-shrink-0`}>
                          <TxIcon className={`${conf.color} w-4 h-4`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{tx.description || conf.label}</p>
                          <p className="text-xs text-slate-500">{formatDateTime(tx.createdAt)}</p>
                        </div>
                        <span className={`font-bold text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : '-'}{formatCurrency(tx.montant)}
                        </span>
                      </div>
                    );
                  })}
                  {transactions.length === 0 && <p className="text-slate-500 text-center py-4 text-sm">Aucune transaction</p>}
                </div>
                <Link href="/dashboard/user/transactions" className="mt-4 w-full bg-slate-50 hover:bg-slate-100 text-slate-600 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center transition-colors">
                  Voir toutes les transactions
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Produits */}
        {activeTab === 'produits' && (
          <div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher un produit disponible..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setStockPage(1); }}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {produits.filter(p => p.stock > 0).map(produit => (
                <div key={produit.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                        <Boxes size={22} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{produit.nom}</p>
                        {produit.description && <p className="text-xs text-slate-500">{produit.description}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Prix unitaire</span>
                      <span className="font-bold text-slate-800">{formatCurrency(produit.prixUnitaire)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Stock disponible</span>
                      <span className={`font-bold ${produit.stock <= produit.alerteStock ? 'text-amber-600' : 'text-emerald-600'}`}>{produit.stock} unites</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedProduit(produit); setVenteModalOpen(true); }}
                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Send size={16} />
                    Signaler une vente
                  </button>
                </div>
              ))}
              {produits.filter(p => p.stock > 0).length === 0 && (
                <div className="col-span-full bg-white rounded-xl p-12 text-center shadow-sm border border-slate-100">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Aucun produit disponible</p>
                </div>
              )}
            </div>

            {stockMeta && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-slate-600">Page {stockMeta.page} sur {stockMeta.totalPages}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setStockPage(p => Math.max(1, p - 1))} disabled={stockPage <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                  <span className="px-4 py-2 bg-rose-600 text-white rounded-lg font-medium">{stockPage}</span>
                  <button onClick={() => setStockPage(p => Math.min(stockMeta.totalPages, p + 1))} disabled={stockPage >= stockMeta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Demander Stock a Credit */}
        {activeTab === 'creditStock' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Demande de credit */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-amber-50 p-3 rounded-xl"><CreditCard className="text-amber-500 w-6 h-6" /></div>
                  <h3 className="font-bold text-slate-800">Demander un Stock a Credit</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">Faites une demande de credit pour obtenir du stock supplementaire. Remboursez au fur et a mesure de vos ventes.</p>
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Credits actifs</span>
                    <span className="font-bold text-slate-800">{creditsStats?.creditsActifs ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Total emprunte</span>
                    <span className="font-bold text-slate-800">{formatCurrency(creditsStats?.totalEmprunte ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Reste a rembourser</span>
                    <span className="font-bold text-red-600">{formatCurrency(creditsStats?.totalRestant ?? 0)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setCreditModalOpen(true)}
                  className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all font-semibold flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Nouvelle demande de credit
                </button>
              </div>

              {/* Historique des credits */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <h3 className="font-bold text-slate-800 mb-4">Historique de mes Credits</h3>
                <div className="space-y-3">
                  {credits.map(credit => {
                    const statutConfig: Record<string, { color: string; label: string }> = {
                      EN_ATTENTE: { color: 'bg-yellow-100 text-yellow-800', label: 'En attente' },
                      APPROUVE: { color: 'bg-blue-100 text-blue-800', label: 'Approuve' },
                      REJETE: { color: 'bg-red-100 text-red-800', label: 'Rejete' },
                      REMBOURSE_PARTIEL: { color: 'bg-indigo-100 text-indigo-800', label: 'En cours' },
                      REMBOURSE_TOTAL: { color: 'bg-green-100 text-green-800', label: 'Rembourse' },
                    };
                    const config = statutConfig[credit.statut] || { color: 'bg-gray-100 text-gray-800', label: credit.statut };
                    return (
                      <div key={credit.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{formatCurrency(credit.montant)}</p>
                          <p className="text-xs text-slate-500">{formatDate(credit.dateDemande)}</p>
                        </div>
                        <span className={`${config.color} text-xs font-semibold px-3 py-1 rounded-full`}>{config.label}</span>
                      </div>
                    );
                  })}
                  {credits.length === 0 && <p className="text-slate-500 text-center py-4 text-sm">Aucun credit demande</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Mes Ventes */}
        {activeTab === 'ventes' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-rose-50 p-3 rounded-xl"><ShoppingCart className="text-rose-500 w-6 h-6" /></div>
                <div>
                  <h3 className="font-bold text-slate-800">Signaler vos Ventes</h3>
                  <p className="text-sm text-slate-500">Signalez vos ventes pour ajuster la rotation de stock et faciliter le reapprovisionnement</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {produits.filter(p => p.stock > 0).slice(0, 6).map(produit => (
                  <div key={produit.id} className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{produit.nom}</p>
                      <p className="text-xs text-slate-500">{formatCurrency(produit.prixUnitaire)} - {produit.stock} en stock</p>
                    </div>
                    <button
                      onClick={() => { setSelectedProduit(produit); setVenteModalOpen(true); }}
                      className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-lg transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Transactions de type ACHAT */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <ShoppingCart size={20} className="text-rose-600" />
                <h3 className="font-bold text-slate-800">Mes Transactions Recentes</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {transactions.map(tx => {
                  const conf = txConfigs[tx.type] || { icon: Wallet, color: 'text-gray-600', bg: 'bg-gray-50', label: tx.type };
                  const TxIcon = conf.icon;
                  const isPositive = ['DEPOT', 'CREDIT', 'ANNULATION'].includes(tx.type);
                  return (
                    <div key={tx.id} className="flex items-center px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className={`${conf.bg} rounded-lg p-2.5 mr-4 flex-shrink-0`}>
                        <TxIcon className={`${conf.color} w-5 h-5`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{tx.description || conf.label}</p>
                        <p className="text-xs text-slate-500">{tx.reference} - {formatDateTime(tx.createdAt)}</p>
                      </div>
                      <span className={`font-bold text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : '-'}{formatCurrency(tx.montant)}
                      </span>
                    </div>
                  );
                })}
                {transactions.length === 0 && (
                  <div className="px-6 py-12 text-center text-slate-500">Aucune transaction enregistree</div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
