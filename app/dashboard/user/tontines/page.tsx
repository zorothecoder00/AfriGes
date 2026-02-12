"use client";

import React, { useState } from 'react';
import { Eye, Calendar, Users, TrendingUp, Clock } from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStatusLabel } from '@/lib/status';

interface Tontine {  
  id: number;
  nom: string;   
  description: string | null;
  montantCycle: string;
  frequence: string;
  statut: string;
  dateDebut: string;
  dateFin: string | null;
}

interface TontinesResponse {
  data: Tontine[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function TontinesPage() {
  const { data: response, loading, error, refetch } = useApi<TontinesResponse>('/api/user/tontines');
  const tontines = response?.data ?? [];

  const [selectedTontine, setSelectedTontine] = useState<Tontine | null>(null);

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'TERMINEE': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'SUSPENDUE': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement des tontines...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  const totalInvesti = tontines.reduce((acc, t) => acc + Number(t.montantCycle), 0);
  const tontinesActives = tontines.filter(t => t.statut === 'ACTIVE').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Mes Tontines Actives</h1>
            <p className="text-slate-600 mt-2 text-lg">Gerez vos participations aux tontines</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
            <Users className="w-5 h-5" />
            <span className="font-bold text-lg">{tontines.length} Tontines</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 font-medium">Total investi</span>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(totalInvesti)}</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 font-medium">Tontines actives</span>
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{tontinesActives}</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 font-medium">Total tontines</span>
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{tontines.length}</p>
          </div>
        </div>
      </div>

      {/* Liste des tontines */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {tontines.map((tontine) => (
            <div key={tontine.id} className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
              {/* Header de la carte */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-2xl font-bold leading-tight">{tontine.nom}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(tontine.statut)}`}>
                    {getStatusLabel(tontine.statut)}
                  </span>
                </div>
                {tontine.description && <p className="text-indigo-100 text-sm opacity-90">{tontine.description}</p>}
              </div>

              {/* Contenu */}
              <div className="p-6 space-y-4">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <p className="text-slate-600 text-sm mb-1 font-medium">Montant du cycle</p>
                  <p className="text-3xl font-bold text-slate-900">{formatCurrency(tontine.montantCycle)}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600 text-sm font-medium">Frequence</span>
                    <span className="text-slate-900 font-bold px-3 py-1 bg-slate-100 rounded-lg text-sm">{getStatusLabel(tontine.frequence)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600 text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Date de debut
                    </span>
                    <span className="text-slate-900 font-semibold">{formatDate(tontine.dateDebut)}</span>
                  </div>
                </div>

                <Link href={`/dashboard/user/tontines/${tontine.id}`} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg">
                  <Eye className="w-5 h-5" />
                  Voir les details
                </Link>
              </div>
            </div>
          ))}
        </div>

        {tontines.length === 0 && (
          <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-200 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Aucune tontine</h3>
            <p className="text-slate-500">Vous ne participez a aucune tontine pour le moment.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedTontine && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{selectedTontine.nom}</h2>
                {selectedTontine.description && <p className="text-slate-600">{selectedTontine.description}</p>}
              </div>
              <button onClick={() => setSelectedTontine(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-200">
                <p className="text-indigo-900 font-bold text-4xl mb-2">{formatCurrency(selectedTontine.montantCycle)}</p>
                <p className="text-indigo-700 font-medium">Montant du cycle</p>
              </div>
              <button onClick={() => setSelectedTontine(null)} className="w-full bg-slate-900 text-white py-3 px-4 rounded-xl font-semibold hover:bg-slate-800 transition-colors">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
