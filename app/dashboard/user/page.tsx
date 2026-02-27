"use client";

import { useState } from 'react';
import {
  Wallet, CreditCard as CreditCardIcon, LucideIcon, Users,
  ArrowUpRight, ArrowDownRight, Download,
  ChevronRight, Menu, X, History, ShoppingBag
} from 'lucide-react';
import Link from "next/link";
import SignOutButton from '@/components/SignOutButton';
import NotificationBell from '@/components/NotificationBell';
import { useApi } from '@/hooks/useApi';
import { formatCurrency } from '@/lib/format';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardResponse {
  success: boolean;
  data: {
    soldeGeneral:        number | string;
    soldeTontine:        number | string;
    soldeCredit:         number | string;
    souscriptionsActives: number;
  };
}

interface WalletTransaction {
  id:          number;
  type:        string;
  montant:     string;
  description: string | null;
  reference:   string;
  createdAt:   string;
}

interface TransactionsResponse {
  data: WalletTransaction[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type TransactionType =
  | 'DEPOT' | 'RETRAIT' | 'COTISATION' | 'TONTINE'
  | 'CREDIT' | 'REMBOURSEMENT_CREDIT' | 'ACHAT' | 'ANNULATION';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const StatCard = ({
  title, value, icon: Icon, trend, trendValue, color, bgColor,
}: {
  title: string; value: string; icon: LucideIcon;
  trend?: 'up' | 'down'; trendValue?: string; color: string; bgColor: string;
}) => (
  <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-6">
    <div className="flex items-start justify-between mb-4">
      <div className={`${bgColor} rounded-lg p-3`}>
        <Icon className={`${color} w-6 h-6`} />
      </div>
      {trend && (
        <span className={`flex items-center text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {trend === 'up'
            ? <ArrowUpRight className="w-4 h-4 mr-1" />
            : <ArrowDownRight className="w-4 h-4 mr-1" />}
          {trendValue}
        </span>
      )}
    </div>
    <p className="text-gray-600 text-sm mb-1">{title}</p>
    <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
  </div>
);

const TransactionItem = ({
  type, description, amount, date, reference,
}: {
  type: TransactionType; description: string; amount: number; date: string; reference: string;
}) => {
  const configs: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
    DEPOT:               { icon: ArrowUpRight,   color: 'text-green-600',  bg: 'bg-green-50'  },
    RETRAIT:             { icon: ArrowDownRight, color: 'text-red-600',    bg: 'bg-red-50'    },
    COTISATION:          { icon: ShoppingBag,    color: 'text-blue-600',   bg: 'bg-blue-50'   },
    TONTINE:             { icon: Users,          color: 'text-purple-600', bg: 'bg-purple-50' },
    CREDIT:              { icon: CreditCardIcon, color: 'text-orange-600', bg: 'bg-orange-50' },
    REMBOURSEMENT_CREDIT:{ icon: CreditCardIcon, color: 'text-teal-600',   bg: 'bg-teal-50'   },
    ACHAT:               { icon: ShoppingBag,    color: 'text-pink-600',   bg: 'bg-pink-50'   },
    ANNULATION:          { icon: ArrowDownRight, color: 'text-gray-600',   bg: 'bg-gray-50'   },
  };
  const { icon: TxIcon, color, bg } =
    configs[type] ?? { icon: Wallet, color: 'text-gray-600', bg: 'bg-gray-50' };
  const isPositive = ['DEPOT', 'CREDIT'].includes(type);

  return (
    <div className="flex items-center py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors duration-150 px-4 -mx-4 rounded-lg">
      <div className={`${bg} rounded-lg p-2.5 mr-4 flex-shrink-0`}>
        <TxIcon className={`${color} w-5 h-5`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{description}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {reference} &bull;{' '}
          {new Date(date).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
      <div className={`text-right font-bold text-sm flex-shrink-0 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : '-'}{formatCurrency(amount)}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function UserDashboard() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: dashResponse, loading: dashLoading } =
    useApi<DashboardResponse>('/api/user/dashboard');
  const { data: txResponse } =
    useApi<TransactionsResponse>('/api/user/transactions?limit=5');

  const dashData     = dashResponse?.data;
  const transactions = txResponse?.data ?? [];

  if (dashLoading && !dashResponse) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAVBAR */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              AfriGes
            </h1>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center space-x-2">
              <Link href="/dashboard/user/transactions"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <History className="w-4 h-4" />
                Transactions
              </Link>
              <NotificationBell href="/dashboard/user/notifications" />
              <SignOutButton
                redirectTo="/auth/login?logout=success"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              />
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100">
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200 space-y-1">
              <Link href="/dashboard/user/transactions"
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <History className="w-4 h-4" />
                Transactions
              </Link>
              <Link href="/dashboard/user/notifications"
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Notifications
              </Link>
              <div className="pt-4 border-t border-gray-200">
                <SignOutButton
                  redirectTo="/auth/login?logout=success"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Mon Tableau de Bord</h2>
            <p className="text-gray-600 mt-1">Vue d&apos;ensemble de vos activités AfriGes</p>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-150 flex items-center justify-center shadow-sm hover:shadow">
            <Download className="w-5 h-5 mr-2" />
            Exporter
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Solde Général"
            value={formatCurrency(dashData?.soldeGeneral ?? 0)}
            icon={Wallet}
            color="text-indigo-600"
            bgColor="bg-indigo-50"
          />
          <StatCard
            title="Solde Tontine"
            value={formatCurrency(dashData?.soldeTontine ?? 0)}
            icon={Users}
            color="text-green-600"
            bgColor="bg-green-50"
          />
          <StatCard
            title="Solde Crédit"
            value={formatCurrency(dashData?.soldeCredit ?? 0)}
            icon={CreditCardIcon}
            color="text-orange-600"
            bgColor="bg-orange-50"
          />
          <StatCard
            title="Souscriptions actives"
            value={String(dashData?.souscriptionsActives ?? 0)}
            icon={ShoppingBag}
            color="text-purple-600"
            bgColor="bg-purple-50"
          />
        </div>

        {/* Transactions récentes */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Transactions Récentes</h3>
            <Link
              href="/dashboard/user/transactions"
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center">
              Voir tout
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-1">
            {transactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                type={tx.type as TransactionType}
                description={tx.description ?? tx.type}
                amount={Number(tx.montant)}
                date={tx.createdAt}
                reference={tx.reference}
              />
            ))}
            {transactions.length === 0 && (
              <p className="text-gray-500 text-center py-4">Aucune transaction récente.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
