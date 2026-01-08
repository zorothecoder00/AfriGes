'use client';

import React, { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Calendar, Filter, TrendingUp, Wallet, CreditCard, ShoppingBag, Users, X } from 'lucide-react';

// Types basés sur le schéma Prisma
interface WalletTransaction {
  id: number;
  type: 'DEPOT' | 'RETRAIT' | 'COTISATION' | 'TONTINE' | 'REMBOURSEMENT_CREDIT' | 'CREDIT' | 'ACHAT' | 'ANNULATION';
  montant: number;
  description: string;
  reference: string;
  createdAt: string;
}

const TransactionsPage = () => {
  // Données d'exemple des transactions
  const [allTransactions] = useState<WalletTransaction[]>([
    {
      id: 1,
      type: 'DEPOT',
      montant: 500,
      description: 'Dépôt sur compte général',
      reference: 'TXN-20250105-001',
      createdAt: '2025-01-05T10:30:00'
    },
    {
      id: 2,
      type: 'COTISATION',
      montant: 50,
      description: 'Cotisation mensuelle janvier',
      reference: 'TXN-20250104-045',
      createdAt: '2025-01-04T14:20:00'
    },
    {
      id: 3,
      type: 'TONTINE',
      montant: 100,
      description: 'Contribution Tontine Solidarité',
      reference: 'TXN-20250103-023',
      createdAt: '2025-01-03T09:15:00'
    },
    {
      id: 4,
      type: 'REMBOURSEMENT_CREDIT',
      montant: 150,
      description: 'Remboursement crédit #2',
      reference: 'TXN-20250102-067',
      createdAt: '2025-01-02T16:45:00'
    },
    {
      id: 5,
      type: 'RETRAIT',
      montant: 200,
      description: 'Retrait compte tontine',
      reference: 'TXN-20250101-012',
      createdAt: '2025-01-01T11:30:00'
    },
    {
      id: 6,
      type: 'ACHAT',
      montant: 75,
      description: 'Achat produits alimentaires',
      reference: 'TXN-20241230-088',
      createdAt: '2024-12-30T15:20:00'
    },
    {
      id: 7,
      type: 'CREDIT',
      montant: 1000,
      description: 'Crédit approuvé #3',
      reference: 'TXN-20241228-156',
      createdAt: '2024-12-28T10:00:00'
    },
    {
      id: 8,
      type: 'DEPOT',
      montant: 300,
      description: 'Dépôt sur compte général',
      reference: 'TXN-20241225-092',
      createdAt: '2024-12-25T08:45:00'
    }
  ]);

  const [filterType, setFilterType] = useState<string>('TOUS');
  const [showFilters, setShowFilters] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const getTransactionConfig = (type: string) => {
    switch (type) {
      case 'DEPOT':
        return {
          label: 'Dépôt',
          icon: <ArrowUpCircle className="w-5 h-5" />,
          iconBg: 'bg-emerald-100',
          iconColor: 'text-emerald-600',
          amountColor: 'text-emerald-600',
          sign: '+'
        };
      case 'RETRAIT':
        return {
          label: 'Retrait',
          icon: <ArrowDownCircle className="w-5 h-5" />,
          iconBg: 'bg-rose-100',
          iconColor: 'text-rose-600',
          amountColor: 'text-rose-600',
          sign: '-'
        };
      case 'COTISATION':
        return {
          label: 'Cotisation',
          icon: <Calendar className="w-5 h-5" />,
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          amountColor: 'text-rose-600',
          sign: '-'
        };
      case 'TONTINE':
        return {
          label: 'Tontine',
          icon: <Users className="w-5 h-5" />,
          iconBg: 'bg-purple-100',
          iconColor: 'text-purple-600',
          amountColor: 'text-rose-600',
          sign: '-'
        };
      case 'REMBOURSEMENT_CREDIT':
        return {
          label: 'Remboursement',
          icon: <CreditCard className="w-5 h-5" />,
          iconBg: 'bg-cyan-100',
          iconColor: 'text-cyan-600',
          amountColor: 'text-rose-600',
          sign: '-'
        };
      case 'CREDIT':
        return {
          label: 'Crédit',
          icon: <TrendingUp className="w-5 h-5" />,
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
          amountColor: 'text-emerald-600',
          sign: '+'
        };
      case 'ACHAT':
        return {
          label: 'Achat',
          icon: <ShoppingBag className="w-5 h-5" />,
          iconBg: 'bg-pink-100',
          iconColor: 'text-pink-600',
          amountColor: 'text-rose-600',
          sign: '-'
        };
      case 'ANNULATION':
        return {
          label: 'Annulation',
          icon: <X className="w-5 h-5" />,
          iconBg: 'bg-gray-100',
          iconColor: 'text-gray-600',
          amountColor: 'text-emerald-600',
          sign: '+'
        };
      default:
        return {
          label: type,
          icon: <Wallet className="w-5 h-5" />,
          iconBg: 'bg-slate-100',
          iconColor: 'text-slate-600',
          amountColor: 'text-slate-600',
          sign: ''
        };
    }
  };

  const filteredTransactions = filterType === 'TOUS' 
    ? allTransactions 
    : allTransactions.filter(t => t.type === filterType);

  const totalEntrees = allTransactions
    .filter(t => ['DEPOT', 'CREDIT', 'ANNULATION'].includes(t.type))
    .reduce((acc, t) => acc + t.montant, 0);

  const totalSorties = allTransactions
    .filter(t => ['RETRAIT', 'COTISATION', 'TONTINE', 'REMBOURSEMENT_CREDIT', 'ACHAT'].includes(t.type))
    .reduce((acc, t) => acc + t.montant, 0);

  const soldeNet = totalEntrees - totalSorties;

  const filterOptions = [
    { value: 'TOUS', label: 'Toutes' },
    { value: 'DEPOT', label: 'Dépôts' },
    { value: 'RETRAIT', label: 'Retraits' },
    { value: 'COTISATION', label: 'Cotisations' },
    { value: 'TONTINE', label: 'Tontines' },
    { value: 'REMBOURSEMENT_CREDIT', label: 'Remboursements' },
    { value: 'CREDIT', label: 'Crédits' },
    { value: 'ACHAT', label: 'Achats' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
              Transactions Récentes
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              Historique de toutes vos opérations
            </p>
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-indigo-200 text-indigo-700 rounded-2xl font-semibold hover:bg-indigo-50 transition-all shadow-md"
          >
            <Filter className="w-5 h-5" />
            Filtrer
          </button>
        </div>

        {/* Filtres */}
        {showFilters && (
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200 mb-6 animate-slideDown">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Filtrer par type</h3>
            <div className="flex flex-wrap gap-3">
              {filterOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setFilterType(option.value)}
                  className={`px-5 py-2.5 rounded-xl font-semibold transition-all ${
                    filterType === option.value
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
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
                <p className="text-slate-600 text-sm font-medium">Total entrées</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(totalEntrees)}
                </p>
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
                <p className="text-2xl font-bold text-rose-600">
                  {formatCurrency(totalSorties)}
                </p>
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
                <p className={`text-2xl font-bold ${soldeNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(soldeNet)}
                </p>
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
              <p className="text-indigo-100 mt-1">
                {filteredTransactions.length} transaction{filteredTransactions.length > 1 ? 's' : ''}
              </p>
            </div>
            <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl font-semibold transition-colors text-sm">
              Voir tout →
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredTransactions.map((transaction, index) => {
              const config = getTransactionConfig(transaction.type);
              const dateTime = formatDateTime(transaction.createdAt);

              return (
                <div
                  key={transaction.id}
                  className="p-5 hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{
                    animation: `fadeInLeft 0.4s ease-out ${index * 0.05}s both`
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`${config.iconBg} p-3 rounded-xl ${config.iconColor} flex-shrink-0`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {transaction.description}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-slate-500 font-medium">
                            {transaction.reference}
                          </p>
                          <span className="text-slate-300">•</span>
                          <p className="text-xs text-slate-500">
                            {dateTime.date}, {dateTime.time}
                          </p>
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
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default TransactionsPage;