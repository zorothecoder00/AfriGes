"use client";

import React, { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Filter, TrendingUp, Wallet, CreditCard, ShoppingBag, Users, Calendar, X } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { formatCurrency } from '@/lib/format';

interface WalletTransaction {
  id: number;
  walletId: number;
  type: string;
  montant: string;
  description: string | null;
  reference: string;
  createdAt: string;
}

interface TransactionsResponse {
  data: WalletTransaction[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const getTransactionConfig = (type: string) => {
  switch (type) {
    case 'DEPOT':
      return { label: 'Depot', icon: ArrowUpCircle, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', amountColor: 'text-emerald-600', sign: '+' };
    case 'RETRAIT':
      return { label: 'Retrait', icon: ArrowDownCircle, iconBg: 'bg-rose-100', iconColor: 'text-rose-600', amountColor: 'text-rose-600', sign: '-' };
    case 'COTISATION':
      return { label: 'Cotisation', icon: Calendar, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', amountColor: 'text-rose-600', sign: '-' };
    case 'TONTINE':
      return { label: 'Tontine', icon: Users, iconBg: 'bg-purple-100', iconColor: 'text-purple-600', amountColor: 'text-rose-600', sign: '-' };
    case 'REMBOURSEMENT_CREDIT':
      return { label: 'Remboursement', icon: CreditCard, iconBg: 'bg-cyan-100', iconColor: 'text-cyan-600', amountColor: 'text-rose-600', sign: '-' };
    case 'CREDIT':
      return { label: 'Credit', icon: TrendingUp, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', amountColor: 'text-emerald-600', sign: '+' };
    case 'ACHAT':
      return { label: 'Achat', icon: ShoppingBag, iconBg: 'bg-pink-100', iconColor: 'text-pink-600', amountColor: 'text-rose-600', sign: '-' };
    case 'ANNULATION':
      return { label: 'Annulation', icon: X, iconBg: 'bg-gray-100', iconColor: 'text-gray-600', amountColor: 'text-emerald-600', sign: '+' };
    default:
      return { label: type, icon: Wallet, iconBg: 'bg-slate-100', iconColor: 'text-slate-600', amountColor: 'text-slate-600', sign: '' };
  }
};

export default function TransactionsPage() {
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filterType) params.set('type', filterType);

  const { data: response, loading, error, refetch } = useApi<TransactionsResponse>(`/api/user/transactions?${params}`);
  const transactions = response?.data ?? [];
  const meta = response?.meta;

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  // Compute stats from current page data
  const entryTypes = ['DEPOT', 'CREDIT', 'ANNULATION'];
  const totalEntrees = transactions.filter(t => entryTypes.includes(t.type)).reduce((acc, t) => acc + Number(t.montant), 0);
  const totalSorties = transactions.filter(t => !entryTypes.includes(t.type)).reduce((acc, t) => acc + Number(t.montant), 0);
  const soldeNet = totalEntrees - totalSorties;

  const filterOptions = [
    { value: '', label: 'Toutes' },
    { value: 'DEPOT', label: 'Depots' },
    { value: 'RETRAIT', label: 'Retraits' },
    { value: 'COTISATION', label: 'Cotisations' },
    { value: 'TONTINE', label: 'Tontines' },
    { value: 'REMBOURSEMENT_CREDIT', label: 'Remboursements' },
    { value: 'CREDIT', label: 'Credits' },
    { value: 'ACHAT', label: 'Achats' },
  ];

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement des transactions...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Transactions Recentes</h1>
            <p className="text-slate-600 mt-2 text-lg">Historique de toutes vos operations</p>
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-indigo-200 text-indigo-700 rounded-2xl font-semibold hover:bg-indigo-50 transition-all shadow-md">
            <Filter className="w-5 h-5" />
            Filtrer
          </button>
        </div>

        {/* Filtres */}
        {showFilters && (
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200 mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Filtrer par type</h3>
            <div className="flex flex-wrap gap-3">
              {filterOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    setFilterType(option.value);
                    setPage(1);
                  }}
                  className={`px-5 py-2.5 rounded-xl font-semibold transition-all ${filterType === option.value ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <ArrowUpCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Total entrees</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalEntrees)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="bg-rose-100 p-3 rounded-xl">
                <ArrowDownCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Total sorties</p>
                <p className="text-2xl font-bold text-rose-600">{formatCurrency(totalSorties)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-xl">
                <Wallet className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Solde net</p>
                <p className={`text-2xl font-bold ${soldeNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(soldeNet)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des transactions */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Historique complet</h2>
              <p className="text-indigo-100 mt-1">{meta?.total ?? transactions.length} transaction{(meta?.total ?? transactions.length) > 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {transactions.map((transaction) => {
              const config = getTransactionConfig(transaction.type);
              const Icon = config.icon;
              const dateTime = formatDateTime(transaction.createdAt);

              return (
                <div key={transaction.id} className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`${config.iconBg} p-3 rounded-xl ${config.iconColor} flex-shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{transaction.description || config.label}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-slate-500 font-medium">{transaction.reference}</p>
                          <span className="text-slate-300">&bull;</span>
                          <p className="text-xs text-slate-500">{dateTime.date}, {dateTime.time}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-2xl font-bold ${config.amountColor}`}>
                        {config.sign}{formatCurrency(transaction.montant)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {transactions.length === 0 && (
            <div className="p-12 text-center text-slate-500">Aucune transaction trouvee</div>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{meta.page}</span> sur <span className="font-semibold">{meta.totalPages}</span> ({meta.total} transactions)
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Precedent
                </button>
                <span className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium">{page}</span>
                <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
