"use client";

import React, { useState } from 'react';
import { ShoppingBag, Calendar, TrendingDown, Package, Eye, CreditCard } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';

interface VenteCredit {
  id: number;
  quantite: number;
  prixUnitaire: string;
  createdAt: string;
  produit: {
    id: number;
    nom: string;
    prixUnitaire: string;
  };
}

interface CreditAlimentaire {
  id: number;
  plafond: string;
  montantUtilise: string;
  montantRestant: string;
  dateAttribution: string;
  dateExpiration: string | null;
  statut: string;
  ventes: VenteCredit[];
}

interface CreditsAlimResponse {
  data: CreditAlimentaire[];
}

export default function CreditAlimentairePage() {
  const { data: response, loading, error, refetch } = useApi<CreditsAlimResponse>('/api/user/creditsAlimentaires');
  const credits = response?.data ?? [];
  const creditAlimentaire = credits[0] ?? null;

  const [showTransactions, setShowTransactions] = useState(false);

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'ACTIF': return 'bg-emerald-100 text-emerald-700';
      case 'EPUISE': return 'bg-red-100 text-red-700';
      case 'EXPIRE': return 'bg-gray-100 text-gray-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement du credit alimentaire...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  if (!creditAlimentaire) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-200 text-center max-w-md">
          <ShoppingBag className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">Aucun credit alimentaire</h3>
          <p className="text-slate-500">Vous n&apos;avez pas de credit alimentaire actif.</p>
        </div>
      </div>
    );
  }

  const plafond = Number(creditAlimentaire.plafond);
  const montantUtilise = Number(creditAlimentaire.montantUtilise);
  const montantRestant = Number(creditAlimentaire.montantRestant);
  const pourcentageUtilisation = plafond > 0 ? (montantUtilise / plafond) * 100 : 0;

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
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Credit Alimentaire</h1>
            {creditAlimentaire.dateExpiration && (
              <p className="text-slate-600 mt-1 text-lg">Expire le {formatDate(creditAlimentaire.dateExpiration)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Carte principale */}
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden mb-8">
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
                <p className="text-6xl font-bold mb-2 tracking-tight">{formatCurrency(plafond)}</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-white/70 text-sm mb-1 font-medium">Utilise</p>
                  <p className="text-3xl font-bold text-rose-200">{formatCurrency(montantUtilise)}</p>
                </div>
                <div>
                  <p className="text-white/70 text-sm mb-1 font-medium">Disponible</p>
                  <p className="text-3xl font-bold text-emerald-200">{formatCurrency(montantRestant)}</p>
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
              <div className={`h-full bg-gradient-to-r ${getProgressColor()} rounded-full transition-all duration-1000 ease-out shadow-lg`} style={{ width: `${pourcentageUtilisation}%` }}></div>
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
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(plafond)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="bg-rose-100 p-3 rounded-xl">
                <TrendingDown className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Montant utilise</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(montantUtilise)}</p>
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
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(montantRestant)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Historique des achats */}
        {creditAlimentaire.ventes.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 text-white" />
                <h2 className="text-2xl font-bold text-white">Historique des achats</h2>
              </div>
              <button onClick={() => setShowTransactions(!showTransactions)} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2">
                <Eye className="w-5 h-5" />
                {showTransactions ? 'Masquer' : 'Afficher'}
              </button>
            </div>

            {showTransactions && (
              <div className="p-6">
                <div className="space-y-4">
                  {creditAlimentaire.ventes.map((vente) => (
                    <div key={vente.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-rose-100">
                          <ShoppingBag className="w-5 h-5 text-rose-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{vente.produit.nom}</p>
                          <p className="text-sm text-slate-600">{formatDate(vente.createdAt)} - Qty: {vente.quantite}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-rose-600">-{formatCurrency(Number(vente.prixUnitaire) * vente.quantite)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
