'use client';

import React, { useState } from 'react';
import { ShoppingBag, Calendar, TrendingDown, Package, Eye, CreditCard } from 'lucide-react';

// Types basés sur le schéma Prisma
interface CreditAlimentaire {
  id: number;
  plafond: number;
  montantUtilise: number;
  montantRestant: number;
  dateAttribution: string;
  dateExpiration?: string;
  statut: 'ACTIF' | 'EPUISE' | 'EXPIRE';
}

interface TransactionCredit {
  id: number;
  montant: number;
  type: 'UTILISATION' | 'ANNULATION' | 'AJUSTEMENT';
  description: string;
  createdAt: string;
}

const CreditAlimentairePage = () => {
  // Données d'exemple du crédit alimentaire actuel
  const [creditAlimentaire] = useState<CreditAlimentaire>({
    id: 1,
    plafond: 1000,
    montantUtilise: 350,
    montantRestant: 650,
    dateAttribution: '2024-12-01',
    dateExpiration: '2025-06-30',
    statut: 'ACTIF'
  });

  // Historique des transactions
  const [transactions] = useState<TransactionCredit[]>([
    {
      id: 1,
      montant: 50,
      type: 'UTILISATION',
      description: 'Achat de riz et huile',
      createdAt: '2025-01-05'
    },
    {
      id: 2,
      montant: 120,
      type: 'UTILISATION',
      description: 'Provisions mensuelles',
      createdAt: '2025-01-03'
    },
    {
      id: 3,
      montant: 80,
      type: 'UTILISATION',
      description: 'Achat de produits frais',
      createdAt: '2024-12-28'
    },
    {
      id: 4,
      montant: 100,
      type: 'UTILISATION',
      description: 'Courses hebdomadaires',
      createdAt: '2024-12-20'
    }
  ]);

  const [showTransactions, setShowTransactions] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'ACTIF':
        return 'bg-emerald-100 text-emerald-700';
      case 'EPUISE':
        return 'bg-red-100 text-red-700';
      case 'EXPIRE':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  const pourcentageUtilisation = (creditAlimentaire.montantUtilise / creditAlimentaire.plafond) * 100;

  const getProgressColor = () => {
    if (pourcentageUtilisation < 50) return 'from-emerald-500 to-green-400';
    if (pourcentageUtilisation < 80) return 'from-amber-500 to-orange-400';
    return 'from-rose-500 to-pink-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-3 rounded-2xl shadow-lg">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
              Crédit Alimentaire
            </h1>
            <p className="text-slate-600 mt-1 text-lg">
              Expire le {formatDate(creditAlimentaire.dateExpiration || '')}
            </p>
          </div>
        </div>
      </div>

      {/* Carte principale du crédit */}
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden mb-8">
          {/* Header de la carte avec gradient */}
          <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <span className="text-white/80 font-medium tracking-wide">PLAFOND</span>
                <span className={`px-4 py-2 rounded-full text-sm font-bold ${getStatutColor(creditAlimentaire.statut)} shadow-lg`}>
                  {creditAlimentaire.statut}
                </span>
              </div>
              
              <div className="mb-8">
                <p className="text-6xl font-bold mb-2 tracking-tight">
                  {formatCurrency(creditAlimentaire.plafond)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-white/70 text-sm mb-1 font-medium">Utilisé</p>
                  <p className="text-3xl font-bold text-rose-200">
                    {formatCurrency(creditAlimentaire.montantUtilise)}
                  </p>
                </div>
                <div>
                  <p className="text-white/70 text-sm mb-1 font-medium">Disponible</p>
                  <p className="text-3xl font-bold text-emerald-200">
                    {formatCurrency(creditAlimentaire.montantRestant)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Barre de progression */}
          <div className="p-8">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-slate-700 font-semibold text-sm">Utilisation</span>
              <span className="text-slate-900 font-bold text-lg">{pourcentageUtilisation.toFixed(0)}%</span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <div
                className={`h-full bg-gradient-to-r ${getProgressColor()} rounded-full transition-all duration-1000 ease-out shadow-lg`}
                style={{ width: `${pourcentageUtilisation}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Plafond total</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(creditAlimentaire.plafond)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="bg-rose-100 p-3 rounded-xl">
                <TrendingDown className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Montant utilisé</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(creditAlimentaire.montantUtilise)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <Package className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Disponible</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(creditAlimentaire.montantRestant)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section Historique */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-white" />
              <h2 className="text-2xl font-bold text-white">
                Historique des transactions
              </h2>
            </div>
            <button
              onClick={() => setShowTransactions(!showTransactions)}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2"
            >
              <Eye className="w-5 h-5" />
              {showTransactions ? 'Masquer' : 'Afficher'}
            </button>
          </div>

          {showTransactions && (
            <div className="p-6">
              <div className="space-y-4">
                {transactions.map((transaction, index) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors"
                    style={{
                      animation: `fadeInUp 0.3s ease-out ${index * 0.1}s both`
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${
                        transaction.type === 'UTILISATION' 
                          ? 'bg-rose-100' 
                          : transaction.type === 'AJUSTEMENT' 
                          ? 'bg-blue-100' 
                          : 'bg-emerald-100'
                      }`}>
                        <ShoppingBag className={`w-5 h-5 ${
                          transaction.type === 'UTILISATION' 
                            ? 'text-rose-600' 
                            : transaction.type === 'AJUSTEMENT' 
                            ? 'text-blue-600' 
                            : 'text-emerald-600'
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {transaction.description}
                        </p>
                        <p className="text-sm text-slate-600">
                          {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${
                        transaction.type === 'UTILISATION' 
                          ? 'text-rose-600' 
                          : 'text-emerald-600'
                      }`}>
                        {transaction.type === 'UTILISATION' ? '-' : '+'}
                        {formatCurrency(transaction.montant)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CreditAlimentairePage;