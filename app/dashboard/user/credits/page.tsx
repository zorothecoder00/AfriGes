'use client';

import React, { useState } from 'react';
import { TrendingUp, Calendar, AlertCircle, CheckCircle, Clock, CreditCard, ArrowRight } from 'lucide-react';

// Types basés sur le schéma Prisma
interface Credit {
  id: number;
  montant: number;
  montantRestant: number;
  dateDemande: string;
  statut: 'EN_ATTENTE' | 'APPROUVE' | 'REJETE' | 'REMBOURSE_PARTIEL' | 'REMBOURSE_TOTAL';
  scoreRisque?: number;
}

const CreditsPage = () => {
  // Données d'exemple des crédits
  const [credits] = useState<Credit[]>([
    {
      id: 1,
      montant: 5000,
      montantRestant: 2500,
      dateDemande: '2024-10-15',
      statut: 'APPROUVE',
      scoreRisque: 7.5
    },
    {
      id: 2,
      montant: 1500,
      montantRestant: 750,
      dateDemande: '2024-12-01',
      statut: 'APPROUVE',
      scoreRisque: 8.2
    },
    {
      id: 3,
      montant: 3000,
      montantRestant: 3000,
      dateDemande: '2025-01-05',
      statut: 'EN_ATTENTE',
      scoreRisque: 6.8
    }
  ]);

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

  const getStatutConfig = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE':
        return {
          label: 'En cours',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200',
          icon: <Clock className="w-4 h-4" />
        };
      case 'APPROUVE':
        return {
          label: 'Approuvé',
          bgColor: 'bg-emerald-100',
          textColor: 'text-emerald-700',
          borderColor: 'border-emerald-200',
          icon: <CheckCircle className="w-4 h-4" />
        };
      case 'REJETE':
        return {
          label: 'Rejeté',
          bgColor: 'bg-red-100',
          textColor: 'text-red-700',
          borderColor: 'border-red-200',
          icon: <AlertCircle className="w-4 h-4" />
        };
      case 'REMBOURSE_PARTIEL':
        return {
          label: 'Partiel',
          bgColor: 'bg-amber-100',
          textColor: 'text-amber-700',
          borderColor: 'border-amber-200',
          icon: <TrendingUp className="w-4 h-4" />
        };
      case 'REMBOURSE_TOTAL':
        return {
          label: 'Remboursé',
          bgColor: 'bg-slate-100',
          textColor: 'text-slate-700',
          borderColor: 'border-slate-200',
          icon: <CheckCircle className="w-4 h-4" />
        };
      default:
        return {
          label: statut,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200',
          icon: <AlertCircle className="w-4 h-4" />
        };
    }
  };

  const calculateProgression = (montant: number, montantRestant: number) => {
    const paye = montant - montantRestant;
    return Math.round((paye / montant) * 100);
  };

  const getProgressionColor = (progression: number) => {
    if (progression >= 80) return 'from-emerald-500 to-green-400';
    if (progression >= 50) return 'from-blue-500 to-cyan-400';
    if (progression >= 20) return 'from-amber-500 to-orange-400';
    return 'from-rose-500 to-pink-500';
  };

  const totalMontantInitial = credits.reduce((acc, c) => acc + c.montant, 0);
  const totalResteAPayer = credits.reduce((acc, c) => acc + c.montantRestant, 0);
  const creditsActifs = credits.filter(c => c.statut === 'APPROUVE' || c.statut === 'REMBOURSE_PARTIEL').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
              Mes Crédits en Cours
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              Suivez vos demandes et remboursements
            </p>
          </div>
          <button className="hidden sm:flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl font-semibold hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg shadow-emerald-200">
            <TrendingUp className="w-5 h-5" />
            Demander un crédit
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4 mb-3">
              <div className="bg-blue-100 p-3 rounded-xl">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Total emprunté</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(totalMontantInitial)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4 mb-3">
              <div className="bg-rose-100 p-3 rounded-xl">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Reste à payer</p>
                <p className="text-2xl font-bold text-rose-600">
                  {formatCurrency(totalResteAPayer)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4 mb-3">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Crédits actifs</p>
                <p className="text-2xl font-bold text-slate-900">
                  {creditsActifs}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des crédits */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {credits.map((credit, index) => {
            const statutConfig = getStatutConfig(credit.statut);
            const progression = calculateProgression(credit.montant, credit.montantRestant);
            const progressColor = getProgressionColor(progression);

            return (
              <div
                key={credit.id}
                className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                style={{
                  animation: `fadeInUp 0.4s ease-out ${index * 0.1}s both`
                }}
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold">Crédit</h3>
                    <span className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 ${statutConfig.bgColor} ${statutConfig.textColor} border ${statutConfig.borderColor}`}>
                      {statutConfig.icon}
                      {statutConfig.label}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Demandé le {formatDate(credit.dateDemande)}
                  </p>
                </div>

                {/* Contenu */}
                <div className="p-6 space-y-5">
                  {/* Montants */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <p className="text-slate-600 text-xs mb-1 font-medium">Montant initial</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(credit.montant)}
                      </p>
                    </div>
                    <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200">
                      <p className="text-rose-700 text-xs mb-1 font-medium">Reste à payer</p>
                      <p className="text-2xl font-bold text-rose-600">
                        {formatCurrency(credit.montantRestant)}
                      </p>
                    </div>
                  </div>

                  {/* Progression */}
                  {credit.statut === 'APPROUVE' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-700 font-semibold text-sm">Progression</span>
                        <span className="text-slate-900 font-bold text-lg">{progression}%</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full bg-gradient-to-r ${progressColor} rounded-full transition-all duration-1000 ease-out`}
                          style={{ width: `${progression}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Score de risque */}
                  {credit.scoreRisque && (
                    <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-600 text-sm font-medium">Score de risque</span>
                      <span className="text-slate-900 font-bold text-lg">{credit.scoreRisque}/10</span>
                    </div>
                  )}

                  {/* Bouton d'action */}
                  {credit.statut === 'APPROUVE' && (
                    <button className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-emerald-700 hover:to-green-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md">
                      <CreditCard className="w-5 h-5" />
                      Rembourser
                    </button>
                  )}

                  {credit.statut === 'EN_ATTENTE' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                      <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800">
                        Votre demande est en cours de traitement. Vous serez notifié dès qu&apos;une décision sera prise.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bouton mobile pour demander un crédit */}
        <div className="mt-8 sm:hidden">
          <button className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl font-semibold hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg">
            <TrendingUp className="w-5 h-5" />
            Demander un crédit
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
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

export default CreditsPage;