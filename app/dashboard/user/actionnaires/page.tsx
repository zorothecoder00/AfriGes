"use client";

import React, { useState, useEffect } from 'react';
import {
  Briefcase, TrendingUp, Search, ArrowLeft, RefreshCw, DollarSign,
  PieChart, Users, Calendar, Building2, Clock, Package, CreditCard as CreditCardIcon,
  BarChart3, LucideIcon, ChevronRight, FileText, Star, Target
} from 'lucide-react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';

// ============================================================================
// TYPES
// ============================================================================

interface VentesResponse {
  data: unknown[];
  stats: { totalVentes: number; montantTotal: number | string; clientsActifs: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface StockResponse {
  data: unknown[];
  stats: { totalProduits: number; enRupture: number; stockFaible: number; valeurTotale: number | string };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface CreditsResponse {
  data: unknown[];
  stats: {
    totalActifs: number; totalEpuises: number; totalExpires: number;
    montantTotalPlafond: number | string; montantTotalUtilise: number | string; montantTotalRestant: number | string;
  };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface CotisationsResponse {
  data: unknown[];
  stats: { totalCotisations: number; montantTotal: number | string; enAttente: number; payees: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Tontine {
  id: number;
  nom: string;
  description: string | null;
  montantCycle: string;
  frequence: string;
  dateDebut: string;
  dateFin: string | null;
  membres: { id: number; client: { id: number; nom: string; prenom: string } }[];
}

interface TontinesResponse {
  data: Tontine[];
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
  
// Placeholder dividendes
const dividendesHistorique = [
  { id: 1, periode: 'T4 2025', montant: 250000, statut: 'Verse', date: '2026-01-15' },
  { id: 2, periode: 'T3 2025', montant: 220000, statut: 'Verse', date: '2025-10-15' },
  { id: 3, periode: 'T2 2025', montant: 195000, statut: 'Verse', date: '2025-07-15' },
  { id: 4, periode: 'T1 2025', montant: 180000, statut: 'Verse', date: '2025-04-15' },
];

// Placeholder assemblees
const prochainesAssemblees = [
  { id: 1, titre: 'Assemblee Generale Ordinaire', date: '2026-03-15', lieu: 'Siege Social', type: 'AGO' },
  { id: 2, titre: 'Comite Strategique', date: '2026-04-10', lieu: 'Salle de Conference', type: 'CS' },
  { id: 3, titre: 'Assemblee Generale Extraordinaire', date: '2026-06-20', lieu: 'Siege Social', type: 'AGE' },
];

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ActionnairePage() {
  const [activeTab, setActiveTab] = useState<'rapports' | 'dividendes' | 'assemblees' | 'projets'>('rapports');

  // Fetch data from existing APIs
  const { data: ventesResponse, loading: ventesLoading } = useApi<VentesResponse>('/api/admin/ventes?limit=1');
  const { data: stockResponse } = useApi<StockResponse>('/api/admin/stock?limit=1');
  const { data: creditsResponse } = useApi<CreditsResponse>('/api/admin/creditsAlimentaires?limit=1');
  const { data: cotisationsResponse } = useApi<CotisationsResponse>('/api/admin/cotisations?limit=1');
  const { data: tontinesResponse, refetch: refetchTontines } = useApi<TontinesResponse>('/api/admin/tontines');

  const ventesStats = ventesResponse?.stats;
  const stockStats = stockResponse?.stats;
  const creditsStats = creditsResponse?.stats;
  const cotisationsStats = cotisationsResponse?.stats;
  const tontines = tontinesResponse?.data ?? [];
  const tontinesActives = tontines.filter(t => !t.dateFin || new Date(t.dateFin) > new Date());

  // Valeur portefeuille = valeur stock + cotisations + credits plafond
  const valeurPortefeuille =
    Number(stockStats?.valeurTotale ?? 0) +
    Number(cotisationsStats?.montantTotal ?? 0) +
    Number(creditsStats?.montantTotalPlafond ?? 0);

  const isLoading = ventesLoading && !ventesResponse;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Valeur Portefeuille', value: formatCurrency(valeurPortefeuille), icon: Briefcase, color: 'text-indigo-500', lightBg: 'bg-indigo-50' },
    { label: 'Revenus Cotisations', value: formatCurrency(cotisationsStats?.montantTotal ?? 0), subtitle: `${cotisationsStats?.totalCotisations ?? 0} cotisations`, icon: DollarSign, color: 'text-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Credits Actifs', value: String(creditsStats?.totalActifs ?? 0), subtitle: formatCurrency(creditsStats?.montantTotalPlafond ?? 0), icon: CreditCardIcon, color: 'text-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Tontines Actives', value: String(tontinesActives.length), subtitle: `${tontines.length} au total`, icon: Users, color: 'text-purple-500', lightBg: 'bg-purple-50' },
  ];

  const tabs = [
    { key: 'rapports' as const, label: 'Rapports Financiers', icon: BarChart3 },
    { key: 'dividendes' as const, label: 'Dividendes', icon: DollarSign },
    { key: 'assemblees' as const, label: 'Assemblees', icon: Calendar },
    { key: 'projets' as const, label: 'Projets', icon: Target },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/20 font-['DM_Sans',sans-serif]">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/user" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                Espace Actionnaire
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">A</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Tableau de Bord - Actionnaire</h2>
            <p className="text-slate-500">Vue d&apos;ensemble de vos investissements et performances</p>
          </div>
          <button onClick={refetchTontines} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
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

        {/* TAB: Rapports Financiers */}
        {activeTab === 'rapports' && (
          <div className="space-y-6">
            {/* Banner KPI */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-8 text-white shadow-lg shadow-indigo-200">
              <h3 className="text-lg font-semibold text-indigo-100 mb-6">Indicateurs Cles de Performance</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-indigo-200 text-sm">Revenus Cotisations</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(cotisationsStats?.montantTotal ?? 0)}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Montant Credits</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(creditsStats?.montantTotalPlafond ?? 0)}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Valeur Stock</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(stockStats?.valeurTotale ?? 0)}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Chiffre Ventes</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(ventesStats?.montantTotal ?? 0)}</p>
                </div>
              </div>
            </div>

            {/* Detail cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <PieChart size={20} className="text-indigo-600" />
                  Repartition Financiere
                </h3>
                <div className="space-y-4">
                  {[
                    { label: 'Cotisations', value: Number(cotisationsStats?.montantTotal ?? 0), color: 'bg-emerald-500' },
                    { label: 'Credits Alimentaires', value: Number(creditsStats?.montantTotalPlafond ?? 0), color: 'bg-blue-500' },
                    { label: 'Stock', value: Number(stockStats?.valeurTotale ?? 0), color: 'bg-indigo-500' },
                    { label: 'Ventes', value: Number(ventesStats?.montantTotal ?? 0), color: 'bg-purple-500' },
                  ].map((item, i) => {
                    const total = valeurPortefeuille + Number(ventesStats?.montantTotal ?? 0);
                    const pct = total > 0 ? (item.value / total) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-600">{item.label}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(item.value)}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-emerald-600" />
                  Statistiques Cles
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="text-slate-600 text-sm">Total Ventes</span>
                    <span className="font-bold text-slate-800">{ventesStats?.totalVentes ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="text-slate-600 text-sm">Produits en Stock</span>
                    <span className="font-bold text-slate-800">{stockStats?.totalProduits ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="text-slate-600 text-sm">Cotisations Payees</span>
                    <span className="font-bold text-slate-800">{cotisationsStats?.payees ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="text-slate-600 text-sm">Credits Actifs</span>
                    <span className="font-bold text-slate-800">{creditsStats?.totalActifs ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-slate-600 text-sm">Tontines Actives</span>
                    <span className="font-bold text-slate-800">{tontinesActives.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Dividendes */}
        {activeTab === 'dividendes' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-emerald-100 text-sm">Total Dividendes Verses</p>
                  <p className="text-3xl font-bold">
                    {formatCurrency(dividendesHistorique.reduce((sum, d) => sum + d.montant, 0))}
                  </p>
                </div>
              </div>
              <p className="text-emerald-100 text-sm">{dividendesHistorique.length} versements effectues</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText size={20} className="text-indigo-600" />
                  Historique des Dividendes
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Periode</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Montant</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date de Versement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dividendesHistorique.map(div => (
                      <tr key={div.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-800">{div.periode}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-emerald-600">{formatCurrency(div.montant)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                            {div.statut}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(div.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <Star className="text-indigo-600 w-6 h-6 mt-0.5" />
                <div>
                  <h4 className="font-bold text-indigo-800">Information</h4>
                  <p className="text-sm text-indigo-700 mt-1">
                    Les dividendes sont calcules trimestriellement et verses le 15 du mois suivant la cloture du trimestre.
                    Les montants affiches sont des estimations basees sur les performances passees.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Assemblees */}
        {activeTab === 'assemblees' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Calendar size={20} className="text-indigo-600" />
                Prochaines Assemblees
              </h3>
              <div className="space-y-4">
                {prochainesAssemblees.map(assemblee => (
                  <div key={assemblee.id} className="bg-slate-50 rounded-xl p-5 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="bg-indigo-100 rounded-xl p-3">
                          <Building2 className="text-indigo-600 w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">{assemblee.titre}</h4>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="flex items-center gap-1 text-sm text-slate-600">
                              <Calendar size={14} />
                              {formatDate(assemblee.date)}
                            </span>
                            <span className="flex items-center gap-1 text-sm text-slate-600">
                              <Building2 size={14} />
                              {assemblee.lieu}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                        {assemblee.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <Clock className="text-indigo-600 w-6 h-6 mt-0.5" />
                <div>
                  <h4 className="font-bold text-indigo-800">Rappel</h4>
                  <p className="text-sm text-indigo-700 mt-1">
                    Les convocations sont envoyees 15 jours avant chaque assemblee.
                    Assurez-vous que vos coordonnees sont a jour pour recevoir les notifications.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Projets (Tontines) */}
        {activeTab === 'projets' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Target size={24} />
                </div>
                <div>
                  <p className="text-purple-100 text-sm">Tontines Actives</p>
                  <p className="text-3xl font-bold">{tontinesActives.length}</p>
                </div>
              </div>
              <p className="text-purple-100 text-sm">{tontines.length} tontines au total — {tontines.reduce((sum, t) => sum + t.membres.length, 0)} membres</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {tontines.map(tontine => {
                const isActive = !tontine.dateFin || new Date(tontine.dateFin) > new Date();
                return (
                  <div key={tontine.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`${isActive ? 'bg-purple-100' : 'bg-slate-100'} rounded-xl p-3`}>
                          <Users className={`${isActive ? 'text-purple-600' : 'text-slate-400'} w-6 h-6`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">{tontine.nom}</h4>
                          {tontine.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{tontine.description}</p>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {isActive ? 'Active' : 'Terminee'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Montant/cycle</span>
                        <span className="font-semibold text-slate-800">{formatCurrency(tontine.montantCycle)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Frequence</span>
                        <span className="font-semibold text-slate-800">{tontine.frequence}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Membres</span>
                        <span className="font-semibold text-slate-800">{tontine.membres.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Debut</span>
                        <span className="font-semibold text-slate-800">{formatDate(tontine.dateDebut)}</span>
                      </div>
                      {tontine.dateFin && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Fin</span>
                          <span className="font-semibold text-slate-800">{formatDate(tontine.dateFin)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {tontines.length === 0 && (
                <div className="col-span-full bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
                  <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Aucune tontine enregistree</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
