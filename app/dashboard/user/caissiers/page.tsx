"use client";

import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Receipt, CreditCard, TrendingUp, Search, ArrowLeft,
  RefreshCw, Download, Eye, Plus, X, CheckCircle, Clock, Package,
  Banknote, Printer, LucideIcon, BarChart3, Users, ShoppingBag,
  ArrowUpRight, ArrowDownRight, Hash
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi, useMutation } from '@/hooks/useApi';
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
}

interface StockResponse {
  data: Produit[];
  stats: { totalProduits: number; enRupture: number; stockFaible: number; valeurTotale: number | string };
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
    client?: { id: number; nom: string; prenom: string; telephone: string } | null;
  } | null;
}

interface VentesResponse {
  data: Vente[];
  stats: { totalVentes: number; montantTotal: number | string; clientsActifs: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface CreditAlimentaire {
  id: number;
  plafond: string;
  montantUtilise: string;
  montantRestant: string;
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

interface ProduitOption {
  id: number;
  nom: string;
  prixUnitaire: string;
  stock: number;
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

export default function CaissierPage() {
  const [activeTab, setActiveTab] = useState<'encaissement' | 'historique' | 'recus'>('encaissement');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ventesPage, setVentesPage] = useState(1);

  // Nouvelle vente
  const [venteModal, setVenteModal] = useState(false);
  const [selectedCreditAlim, setSelectedCreditAlim] = useState('');
  const [selectedProduit, setSelectedProduit] = useState('');
  const [venteQte, setVenteQte] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const ventesParams = new URLSearchParams({ page: String(ventesPage), limit: '15' });
  if (debouncedSearch && activeTab === 'historique') ventesParams.set('search', debouncedSearch);

  // Fetch data
  const { data: stockResponse, refetch: refetchStock } = useApi<StockResponse>('/api/admin/stock?limit=100');
  const { data: ventesResponse, loading: ventesLoading, refetch: refetchVentes } = useApi<VentesResponse>(`/api/admin/ventes?${ventesParams}`);
  const { data: creditsAlimResponse } = useApi<CreditsAlimResponse>('/api/admin/creditsAlimentaires?statut=ACTIF&limit=100');

  const { mutate: enregistrerVente, loading: enregistrant, error: erreurVente } = useMutation('/api/admin/ventes', 'POST');

  const produits = stockResponse?.data ?? [];
  const ventes = ventesResponse?.data ?? [];
  const ventesStats = ventesResponse?.stats;
  const ventesMeta = ventesResponse?.meta;
  const creditsAlim = creditsAlimResponse?.data ?? [];
  const creditsStats = creditsAlimResponse?.stats;

  // Produits disponibles (stock > 0)
  const produitsDisponibles = produits.filter(p => p.stock > 0);

  // Produit selectionne pour calcul montant
  const produitChoisi = produits.find(p => String(p.id) === selectedProduit);
  const montantVente = produitChoisi && venteQte ? Number(produitChoisi.prixUnitaire) * Number(venteQte) : 0;

  const handleEnregistrerVente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreditAlim || !selectedProduit || !venteQte) return;
    const result = await enregistrerVente({
      creditAlimentaireId: Number(selectedCreditAlim),
      produitId: Number(selectedProduit),
      quantite: Number(venteQte),
    });
    if (result) {
      setVenteModal(false);
      setSelectedCreditAlim('');
      setSelectedProduit('');
      setVenteQte('');
      refetchVentes();
      refetchStock();
    }
  };

  const isLoading = ventesLoading && !ventesResponse;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement de la caisse...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Ventes du Jour', value: String(ventesStats?.totalVentes ?? 0), icon: ShoppingCart, color: 'text-sky-500', lightBg: 'bg-sky-50' },
    { label: 'Chiffre d\'Affaires', value: formatCurrency(ventesStats?.montantTotal ?? 0), icon: TrendingUp, color: 'text-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Clients Servis', value: String(ventesStats?.clientsActifs ?? 0), icon: Users, color: 'text-purple-500', lightBg: 'bg-purple-50' },
    { label: 'Produits Disponibles', value: String(produitsDisponibles.length), subtitle: `${stockResponse?.stats?.enRupture ?? 0} en rupture`, icon: Package, color: 'text-amber-500', lightBg: 'bg-amber-50' },
  ];

  const tabs = [
    { key: 'encaissement' as const, label: 'Encaissement', icon: Banknote },
    { key: 'historique' as const, label: 'Historique Ventes', icon: Receipt },
    { key: 'recus' as const, label: 'Recus', icon: Printer },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/20 font-['DM_Sans',sans-serif]">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
                Caisse
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/user/notifications" className="text-slate-600 hover:text-slate-800 px-2">
                <span role="img" aria-label="notifications">&#x1F514;</span>
              </Link>
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">C</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      {/* Modal Nouvelle Vente */}
      {venteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-lg relative">
            <button onClick={() => setVenteModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-sky-50 p-3 rounded-xl"><ShoppingCart className="text-sky-600 w-6 h-6" /></div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Enregistrer une vente</h2>
                <p className="text-sm text-slate-500">Vente via credit alimentaire</p>
              </div>
            </div>
            {erreurVente && <p className="text-red-500 mb-3 text-sm bg-red-50 p-3 rounded-lg">{erreurVente}</p>}
            <form onSubmit={handleEnregistrerVente} className="space-y-4">
              <div>
                <label className="text-sm text-slate-600 mb-1.5 block font-medium">Beneficiaire (Credit Alimentaire)</label>
                <select
                  value={selectedCreditAlim}
                  onChange={e => setSelectedCreditAlim(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                >
                  <option value="">Selectionner un beneficiaire...</option>
                  {creditsAlim.filter(c => c.statut === 'ACTIF').map(c => (
                    <option key={c.id} value={c.id}>
                      {c.client ? `${c.client.prenom} ${c.client.nom}` : `Credit #${c.id}`} — Reste: {formatCurrency(c.montantRestant)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600 mb-1.5 block font-medium">Produit</label>
                <select
                  value={selectedProduit}
                  onChange={e => setSelectedProduit(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                >
                  <option value="">Selectionner un produit...</option>
                  {produitsDisponibles.map(p => (
                    <option key={p.id} value={p.id}>{p.nom} — {formatCurrency(p.prixUnitaire)} ({p.stock} en stock)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600 mb-1.5 block font-medium">Quantite</label>
                <input
                  type="number" placeholder="Ex: 3" min="1"
                  max={produitChoisi?.stock ?? 999} required
                  value={venteQte}
                  onChange={e => setVenteQte(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                />
              </div>
              {montantVente > 0 && (
                <div className="bg-sky-50 rounded-xl p-4 border border-sky-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-sky-700 font-medium">Montant total</span>
                    <span className="text-2xl font-bold text-sky-800">{formatCurrency(montantVente)}</span>
                  </div>
                  {produitChoisi && (
                    <p className="text-xs text-sky-600 mt-1">{venteQte} x {formatCurrency(produitChoisi.prixUnitaire)}</p>
                  )}
                </div>
              )}
              <button type="submit" disabled={enregistrant} className="w-full py-3 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl hover:from-sky-700 hover:to-indigo-700 transition-all font-semibold flex items-center justify-center gap-2">
                {enregistrant ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Valider l&apos;encaissement
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Tableau de Bord - Caissier</h2>
            <p className="text-slate-500">Enregistrez les ventes, encaissez et gerez les recus</p>
          </div>
          <div className="flex gap-3">
            <button onClick={refetchVentes} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <RefreshCw size={18} />
              Actualiser
            </button>
            <button
              onClick={() => setVenteModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl hover:from-sky-700 hover:to-indigo-700 transition-all shadow-lg shadow-sky-200 flex items-center gap-2 font-semibold"
            >
              <Plus size={20} />
              Nouvelle Vente
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((stat, i) => <StatCard key={i} {...stat} />)}
        </div>

        {/* Banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl p-6 text-white shadow-lg shadow-sky-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Banknote size={24} />
              </div>
              <div>
                <p className="text-sky-100 text-sm">Total Encaisse</p>
                <p className="text-3xl font-bold">{formatCurrency(ventesStats?.montantTotal ?? 0)}</p>
              </div>
            </div>
            <p className="text-sky-100 text-sm">{ventesStats?.totalVentes ?? 0} transactions effectuees</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <CreditCard size={24} />
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Credits Alim. Actifs</p>
                <p className="text-3xl font-bold">{creditsStats?.totalActifs ?? 0}</p>
              </div>
            </div>
            <p className="text-emerald-100 text-sm">{formatCurrency(creditsStats?.montantTotalRestant ?? 0)} de solde disponible total</p>
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
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB: Encaissement */}
        {activeTab === 'encaissement' && (
          <div className="space-y-6">
            {/* Acces rapide produits */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ShoppingBag size={20} className="text-sky-600" />
                Encaissement Rapide — Produits Disponibles
              </h3>
              <div className="mb-4 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {produitsDisponibles.filter(p => {
                  if (!debouncedSearch) return true;
                  return p.nom.toLowerCase().includes(debouncedSearch.toLowerCase());
                }).slice(0, 15).map(produit => (
                  <button
                    key={produit.id}
                    onClick={() => {
                      setSelectedProduit(String(produit.id));
                      setVenteModal(true);
                    }}
                    className="bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-xl p-4 text-left transition-all group"
                  >
                    <div className="w-10 h-10 bg-sky-100 group-hover:bg-sky-200 rounded-lg flex items-center justify-center mb-2 transition-colors">
                      <Package size={20} className="text-sky-600" />
                    </div>
                    <p className="font-semibold text-slate-800 text-sm truncate">{produit.nom}</p>
                    <p className="text-sky-600 font-bold text-sm mt-1">{formatCurrency(produit.prixUnitaire)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{produit.stock} en stock</p>
                  </button>
                ))}
              </div>
              {produitsDisponibles.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p>Aucun produit disponible</p>
                </div>
              )}
            </div>

            {/* Dernieres ventes */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={20} className="text-sky-600" />
                Dernieres Ventes Enregistrees
              </h3>
              <div className="space-y-3">
                {ventes.slice(0, 5).map(vente => {
                  const person = vente.creditAlimentaire?.client ?? vente.creditAlimentaire?.member;
                  const montant = Number(vente.prixUnitaire) * vente.quantite;
                  return (
                    <div key={vente.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-sky-50 rounded-lg p-2.5">
                          <ShoppingCart className="text-sky-600 w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{vente.produit?.nom} x{vente.quantite}</p>
                          <p className="text-xs text-slate-500">{person ? `${person.prenom} ${person.nom}` : '-'} - {formatDateTime(vente.createdAt)}</p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-600">{formatCurrency(montant)}</span>
                    </div>
                  );
                })}
                {ventes.length === 0 && <p className="text-slate-500 text-center py-4 text-sm">Aucune vente aujourd&apos;hui</p>}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Historique */}
        {activeTab === 'historique' && (
          <div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher par produit ou client..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setVentesPage(1); }}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">N° Vente</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Qte</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Prix Unit.</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Montant</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date / Heure</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ventes.map((vente) => {
                      const person = vente.creditAlimentaire?.client ?? vente.creditAlimentaire?.member;
                      const montant = Number(vente.prixUnitaire) * vente.quantite;
                      return (
                        <tr key={vente.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 text-sm font-mono text-slate-600">
                              <Hash size={14} />
                              {vente.id}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-800">{vente.produit?.nom ?? '-'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-700">{person ? `${person.prenom} ${person.nom}` : '-'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full text-xs font-bold">{vente.quantite}</span>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-800">{formatCurrency(vente.prixUnitaire)}</td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-emerald-600">{formatCurrency(montant)}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{formatDateTime(vente.createdAt)}</td>
                          <td className="px-6 py-4">
                            <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Imprimer recu">
                              <Printer size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {ventes.length === 0 && (
                      <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500">Aucune vente trouvee</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {ventesMeta && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Page <span className="font-semibold">{ventesMeta.page}</span> sur <span className="font-semibold">{ventesMeta.totalPages}</span> ({ventesMeta.total} ventes)
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setVentesPage(p => Math.max(1, p - 1))} disabled={ventesPage <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Precedent</button>
                    <span className="px-4 py-2 bg-sky-600 text-white rounded-lg font-medium">{ventesPage}</span>
                    <button onClick={() => setVentesPage(p => Math.min(ventesMeta.totalPages, p + 1))} disabled={ventesPage >= ventesMeta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Recus */}
        {activeTab === 'recus' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Printer size={20} className="text-sky-600" />
                Gestion des Recus
              </h3>
              <p className="text-slate-500 text-sm mb-6">Consultez et reimprimez les recus des ventes effectuees.</p>
              <div className="mb-4 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher un recu par numero ou client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ventes.filter(v => {
                if (!debouncedSearch) return true;
                const q = debouncedSearch.toLowerCase();
                const person = v.creditAlimentaire?.client ?? v.creditAlimentaire?.member;
                const name = person ? `${person.prenom} ${person.nom}`.toLowerCase() : '';
                return name.includes(q) || v.produit?.nom.toLowerCase().includes(q) || String(v.id).includes(q);
              }).map(vente => {
                const person = vente.creditAlimentaire?.client ?? vente.creditAlimentaire?.member;
                const montant = Number(vente.prixUnitaire) * vente.quantite;
                return (
                  <div key={vente.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold">
                        <Receipt size={12} />
                        Recu #{vente.id}
                      </span>
                      <span className="text-xs text-slate-500">{formatDateTime(vente.createdAt)}</span>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Client</span>
                        <span className="font-semibold text-slate-800">{person ? `${person.prenom} ${person.nom}` : '-'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Produit</span>
                        <span className="font-semibold text-slate-800">{vente.produit?.nom}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Quantite</span>
                        <span className="font-semibold text-slate-800">{vente.quantite}</span>
                      </div>
                      <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between">
                        <span className="text-slate-600 font-medium">Total</span>
                        <span className="text-lg font-bold text-emerald-600">{formatCurrency(montant)}</span>
                      </div>
                    </div>
                    <button className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
                      <Printer size={16} />
                      Imprimer le recu
                    </button>
                  </div>
                );
              })}
              {ventes.length === 0 && (
                <div className="col-span-full bg-white rounded-xl p-12 text-center shadow-sm border border-slate-200">
                  <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Aucun recu a afficher</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
