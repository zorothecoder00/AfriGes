"use client";

import React, { useState, useEffect } from 'react';
import {
  Shield, Search, ArrowLeft, RefreshCw, Eye, Clock, AlertTriangle,
  Activity, FileText, Package, CreditCard as CreditCardIcon, Users,
  TrendingUp, BarChart3, LucideIcon, ChevronLeft, ChevronRight, Calendar
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { getStatusStyle, getStatusLabel } from '@/lib/status';

// ============================================================================
// TYPES
// ============================================================================

interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  entite: string;
  entiteId: number | null;
  createdAt: string;
  user: { id: number; nom: string; prenom: string; email: string } | null;
}

interface AuditLogsResponse {
  data: AuditLog[];
  stats: { totalActions: number; actionsToday: number; entitesDistinctes: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Produit {
  id: number;
  nom: string;
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
}

interface CreditsResponse {
  data: CreditAlimentaire[];
  stats: {
    totalActifs: number; totalEpuises: number; totalExpires: number;
    montantTotalPlafond: number | string; montantTotalUtilise: number | string; montantTotalRestant: number | string;
  };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Cotisation {
  id: number;
  montant: string;
  statut: string;
  datePaiement: string | null;
  createdAt: string;
  member?: { id: number; nom: string; prenom: string } | null;
}

interface CotisationsResponse {
  data: Cotisation[];
  stats: { totalCotisations: number; montantTotal: number | string; enAttente: number; payees: number };
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

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AuditeurInternePage() {
  const [activeTab, setActiveTab] = useState<'journal' | 'ventes' | 'finances'>('journal');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [logsPage, setLogsPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build audit logs params
  const logsParams = new URLSearchParams({ page: String(logsPage), limit: '15' });
  if (debouncedSearch && activeTab === 'journal') logsParams.set('search', debouncedSearch);

  // Fetch data
  const { data: auditResponse, loading: auditLoading, refetch: refetchAudit } = useApi<AuditLogsResponse>(`/api/admin/auditLogs?${logsParams}`);
  const { data: stockResponse } = useApi<StockResponse>('/api/admin/stock?limit=100');
  const { data: ventesResponse } = useApi<VentesResponse>('/api/admin/ventes?limit=10');
  const { data: creditsResponse } = useApi<CreditsResponse>('/api/admin/creditsAlimentaires?limit=100');
  const { data: cotisationsResponse } = useApi<CotisationsResponse>('/api/admin/cotisations?limit=100');

  const logs = auditResponse?.data ?? [];
  const auditStats = auditResponse?.stats;
  const auditMeta = auditResponse?.meta;

  const stockStats = stockResponse?.stats;
  const produits = stockResponse?.data ?? [];
  const produitsEnRupture = produits.filter(p => p.stock <= p.alerteStock);

  const ventesStats = ventesResponse?.stats;
  const ventes = ventesResponse?.data ?? [];

  const creditsStats = creditsResponse?.stats;
  const cotisationsStats = cotisationsResponse?.stats;
  const cotisations = cotisationsResponse?.data ?? [];

  const isLoading = auditLoading && !auditResponse;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Operations Auditees', value: String(auditStats?.totalActions ?? 0), icon: Activity, color: 'text-amber-500', lightBg: 'bg-amber-50' },
    { label: 'Actions Aujourd\'hui', value: String(auditStats?.actionsToday ?? 0), icon: Clock, color: 'text-orange-500', lightBg: 'bg-orange-50' },
    { label: 'Alertes Stock', value: String(stockStats?.enRupture ?? 0), subtitle: `${stockStats?.stockFaible ?? 0} stock faible`, icon: AlertTriangle, color: 'text-red-500', lightBg: 'bg-red-50' },
    { label: 'Credits en Attente', value: String(creditsStats?.totalActifs ?? 0), subtitle: formatCurrency(creditsStats?.montantTotalRestant ?? 0), icon: CreditCardIcon, color: 'text-emerald-500', lightBg: 'bg-emerald-50' },
  ];

  const tabs = [
    { key: 'journal' as const, label: 'Journal d\'Audit', icon: FileText },
    { key: 'ventes' as const, label: 'Ventes & Stock', icon: Package },
    { key: 'finances' as const, label: 'Finances', icon: TrendingUp },
  ];

  const getActionColor = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('create') || a.includes('ajout')) return 'bg-emerald-100 text-emerald-700';
    if (a.includes('update') || a.includes('modif')) return 'bg-blue-100 text-blue-700';
    if (a.includes('delete') || a.includes('suppression')) return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/20 font-['DM_Sans',sans-serif]">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Audit Interne
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">A</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Tableau de Bord - Auditeur Interne</h2>
            <p className="text-slate-500">Supervisez les operations, analysez les flux et detectez les anomalies</p>
          </div>
          <button onClick={refetchAudit} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
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
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB: Journal d'Audit */}
        {activeTab === 'journal' && (
          <div className="space-y-6">
            {/* Search */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher par action, entite ou utilisateur..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setLogsPage(1); }}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Utilisateur</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Entite</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">ID Entite</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDateTime(log.createdAt)}</td>
                        <td className="px-6 py-4">
                          {log.user ? (
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{log.user.prenom} {log.user.nom}</p>
                              <p className="text-xs text-slate-500">{log.user.email}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">Systeme</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
                            {log.entite}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 font-mono">
                          {log.entiteId ?? '-'}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Aucun log d&apos;audit trouve</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {auditMeta && auditMeta.totalPages > 0 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Page <span className="font-semibold">{auditMeta.page}</span> sur <span className="font-semibold">{auditMeta.totalPages}</span> ({auditMeta.total} logs)
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLogsPage(p => Math.max(1, p - 1))} disabled={logsPage <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1">
                      <ChevronLeft size={16} />
                      Precedent
                    </button>
                    <span className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium">{logsPage}</span>
                    <button onClick={() => setLogsPage(p => Math.min(auditMeta.totalPages, p + 1))} disabled={logsPage >= auditMeta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1">
                      Suivant
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Ventes & Stock */}
        {activeTab === 'ventes' && (
          <div className="space-y-6">
            {/* Banners */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg shadow-amber-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <p className="text-amber-100 text-sm">Total Ventes</p>
                    <p className="text-3xl font-bold">{formatCurrency(ventesStats?.montantTotal ?? 0)}</p>
                  </div>
                </div>
                <p className="text-amber-100 text-sm">{ventesStats?.totalVentes ?? 0} transactions enregistrees</p>
              </div>
              <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Package size={24} />
                  </div>
                  <div>
                    <p className="text-slate-300 text-sm">Valeur Stock</p>
                    <p className="text-3xl font-bold">{formatCurrency(stockStats?.valeurTotale ?? 0)}</p>
                  </div>
                </div>
                <p className="text-slate-300 text-sm">{stockStats?.totalProduits ?? 0} produits en stock</p>
              </div>
            </div>

            {/* Alertes rupture */}
            {produitsEnRupture.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-red-600" />
                  Alertes Stock — {produitsEnRupture.length} produit(s) en rupture ou stock faible
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {produitsEnRupture.map(p => (
                    <div key={p.id} className="bg-white rounded-xl p-4 border border-red-200">
                      <p className="font-semibold text-slate-800 text-sm">{p.nom}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-slate-500">Stock: <span className={`font-bold ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>{p.stock}</span></span>
                        <span className="text-xs text-slate-500">Seuil: {p.alerteStock}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dernieres ventes */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={20} className="text-amber-600" />
                Dernieres Ventes
              </h3>
              <div className="space-y-3">
                {ventes.map(vente => {
                  const montant = Number(vente.prixUnitaire) * vente.quantite;
                  return (
                    <div key={vente.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-amber-50 rounded-lg p-2.5">
                          <Package className="text-amber-600 w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{vente.produit?.nom} x{vente.quantite}</p>
                          <p className="text-xs text-slate-500">{formatDateTime(vente.createdAt)}</p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-600">{formatCurrency(montant)}</span>
                    </div>
                  );
                })}
                {ventes.length === 0 && <p className="text-slate-500 text-center py-4 text-sm">Aucune vente recente</p>}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Finances */}
        {activeTab === 'finances' && (
          <div className="space-y-6">
            {/* Banners finances */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <CreditCardIcon size={24} />
                  </div>
                  <div>
                    <p className="text-emerald-100 text-sm">Credits Alimentaires</p>
                    <p className="text-3xl font-bold">{formatCurrency(creditsStats?.montantTotalPlafond ?? 0)}</p>
                  </div>
                </div>
                <p className="text-emerald-100 text-sm">{creditsStats?.totalActifs ?? 0} actifs — {formatCurrency(creditsStats?.montantTotalUtilise ?? 0)} utilises</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Users size={24} />
                  </div>
                  <div>
                    <p className="text-purple-100 text-sm">Cotisations</p>
                    <p className="text-3xl font-bold">{formatCurrency(cotisationsStats?.montantTotal ?? 0)}</p>
                  </div>
                </div>
                <p className="text-purple-100 text-sm">{cotisationsStats?.totalCotisations ?? 0} cotisations — {cotisationsStats?.enAttente ?? 0} en attente</p>
              </div>
            </div>

            {/* Resume credits */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CreditCardIcon size={20} className="text-emerald-600" />
                Repartition Credits Alimentaires
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                  <p className="text-sm text-emerald-700 font-medium">Actifs</p>
                  <p className="text-2xl font-bold text-emerald-800 mt-1">{creditsStats?.totalActifs ?? 0}</p>
                  <p className="text-xs text-emerald-600 mt-1">Solde restant: {formatCurrency(creditsStats?.montantTotalRestant ?? 0)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-700 font-medium">Epuises</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{creditsStats?.totalEpuises ?? 0}</p>
                  <p className="text-xs text-slate-600 mt-1">Entierement utilises</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <p className="text-sm text-red-700 font-medium">Expires</p>
                  <p className="text-2xl font-bold text-red-800 mt-1">{creditsStats?.totalExpires ?? 0}</p>
                  <p className="text-xs text-red-600 mt-1">Credits non utilises</p>
                </div>
              </div>
            </div>

            {/* Dernieres cotisations */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-purple-600" />
                Dernieres Cotisations
              </h3>
              <div className="space-y-3">
                {cotisations.slice(0, 10).map(cot => (
                  <div key={cot.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-50 rounded-lg p-2.5">
                        <Users className="text-purple-600 w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">
                          {cot.member ? `${cot.member.prenom} ${cot.member.nom}` : `Cotisation #${cot.id}`}
                        </p>
                        <p className="text-xs text-slate-500">{formatDateTime(cot.datePaiement || cot.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusStyle(cot.statut)}`}>
                        {getStatusLabel(cot.statut)}
                      </span>
                      <span className="font-bold text-slate-800">{formatCurrency(cot.montant)}</span>
                    </div>
                  </div>
                ))}
                {cotisations.length === 0 && <p className="text-slate-500 text-center py-4 text-sm">Aucune cotisation recente</p>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
