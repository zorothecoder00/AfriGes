"use client";

import React from 'react';
import { TrendingUp, Calendar, AlertCircle, CheckCircle, Clock, CreditCard } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';

interface CreditTransaction {
  id: number;
  creditId: number;
  montant: string;
  type: string;
  createdAt: string;
}

interface Credit {
  id: number;
  montant: string;
  montantRestant: string;
  dateDemande: string;
  statut: string;
  scoreRisque: string | null;
  transactions: CreditTransaction[];
}

interface CreditsResponse {
  data: Credit[];
  stats: {
    totalEmprunte: number;
    totalRestant: number;
    creditsActifs: number;
  };
}

const getStatutConfig = (statut: string) => {
  switch (statut) {
    case 'EN_ATTENTE':
      return { label: 'En cours', bgColor: 'bg-blue-100', textColor: 'text-blue-700', borderColor: 'border-blue-200', icon: Clock };
    case 'APPROUVE':
      return { label: 'Approuve', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700', borderColor: 'border-emerald-200', icon: CheckCircle };
    case 'REJETE':
      return { label: 'Rejete', bgColor: 'bg-red-100', textColor: 'text-red-700', borderColor: 'border-red-200', icon: AlertCircle };
    case 'REMBOURSE_PARTIEL':
      return { label: 'Partiel', bgColor: 'bg-amber-100', textColor: 'text-amber-700', borderColor: 'border-amber-200', icon: TrendingUp };
    case 'REMBOURSE_TOTAL':
      return { label: 'Rembourse', bgColor: 'bg-slate-100', textColor: 'text-slate-700', borderColor: 'border-slate-200', icon: CheckCircle };
    default:
      return { label: statut, bgColor: 'bg-gray-100', textColor: 'text-gray-700', borderColor: 'border-gray-200', icon: AlertCircle };
  }
};

const getProgressionColor = (progression: number) => {
  if (progression >= 80) return 'from-emerald-500 to-green-400';
  if (progression >= 50) return 'from-blue-500 to-cyan-400';
  if (progression >= 20) return 'from-amber-500 to-orange-400';
  return 'from-rose-500 to-pink-500';
};

export default function CreditsPage() {
  const { data: response, loading, error, refetch } = useApi<CreditsResponse>('/api/user/credits');
  const credits = response?.data ?? [];
  const stats = response?.stats;

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement des credits...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Mes Credits en Cours</h1>
            <p className="text-slate-600 mt-2 text-lg">Suivez vos demandes et remboursements</p>
          </div>
          <button className="hidden sm:flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl font-semibold hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg shadow-emerald-200">
            <TrendingUp className="w-5 h-5" />
            Demander un credit
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
                <p className="text-slate-600 text-sm font-medium">Total emprunte</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats?.totalEmprunte ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4 mb-3">
              <div className="bg-rose-100 p-3 rounded-xl">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Reste a payer</p>
                <p className="text-2xl font-bold text-rose-600">{formatCurrency(stats?.totalRestant ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4 mb-3">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">Credits actifs</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.creditsActifs ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des credits */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {credits.map((credit) => {
            const config = getStatutConfig(credit.statut);
            const StatusIcon = config.icon;
            const montant = Number(credit.montant);
            const montantRestant = Number(credit.montantRestant);
            const progression = montant > 0 ? Math.round(((montant - montantRestant) / montant) * 100) : 0;
            const progressColor = getProgressionColor(progression);

            return (
              <div key={credit.id} className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold">Credit</h3>
                    <span className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Demande le {formatDate(credit.dateDemande)}
                  </p>
                </div>

                {/* Contenu */}
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <p className="text-slate-600 text-xs mb-1 font-medium">Montant initial</p>
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(montant)}</p>
                    </div>
                    <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200">
                      <p className="text-rose-700 text-xs mb-1 font-medium">Reste a payer</p>
                      <p className="text-2xl font-bold text-rose-600">{formatCurrency(montantRestant)}</p>
                    </div>
                  </div>

                  {credit.statut !== 'REJETE' && credit.statut !== 'EN_ATTENTE' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-700 font-semibold text-sm">Progression</span>
                        <span className="text-slate-900 font-bold text-lg">{progression}%</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div className={`h-full bg-gradient-to-r ${progressColor} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${progression}%` }}></div>
                      </div>
                    </div>
                  )}

                  {credit.scoreRisque && (
                    <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-600 text-sm font-medium">Score de risque</span>
                      <span className="text-slate-900 font-bold text-lg">{Number(credit.scoreRisque).toFixed(1)}/10</span>
                    </div>
                  )}

                  {credit.statut === 'APPROUVE' && (
                    <button className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-emerald-700 hover:to-green-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md">
                      <CreditCard className="w-5 h-5" />
                      Rembourser
                    </button>
                  )}

                  {credit.statut === 'EN_ATTENTE' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                      <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800">Votre demande est en cours de traitement. Vous serez notifie des qu&apos;une decision sera prise.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {credits.length === 0 && (
          <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-200 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Aucun credit</h3>
            <p className="text-slate-500">Vous n&apos;avez pas encore de credit en cours.</p>
          </div>
        )}

        {/* Bouton mobile */}
        <div className="mt-8 sm:hidden">
          <button className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl font-semibold hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg">
            <TrendingUp className="w-5 h-5" />
            Demander un credit
          </button>
        </div>
      </div>
    </div>
  );
}
