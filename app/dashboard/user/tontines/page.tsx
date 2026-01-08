'use client';

import React, { useState } from 'react';
import { Eye, Calendar, Users, TrendingUp, Clock } from 'lucide-react';

// Types basés sur le schéma Prisma
interface Tontine {
  id: number;
  nom: string;
  description: string;
  montantCycle: number;
  frequence: 'HEBDOMADAIRE' | 'MENSUEL';
  statut: 'ACTIVE' | 'TERMINEE' | 'SUSPENDUE';
  dateDebut: string;
  dateFin?: string;
  ordreTirage?: number;
  nombreMembres?: number;
}

const TontinesPage = () => {
  // Données d'exemple (à remplacer par vos vraies données d'API)
  const [tontines] = useState<Tontine[]>([
    {
      id: 1,
      nom: 'Tontine Solidarité',
      description: 'Entraide communautaire',
      montantCycle: 1000,
      frequence: 'MENSUEL',
      statut: 'ACTIVE',
      dateDebut: '2024-06-01',
      ordreTirage: 5,
      nombreMembres: 12
    },
    {
      id: 2,
      nom: 'Tontine Entrepreneuriat',
      description: 'Soutien aux entrepreneurs',
      montantCycle: 2000,
      frequence: 'MENSUEL',
      statut: 'ACTIVE',
      dateDebut: '2024-08-15',
      ordreTirage: 3,
      nombreMembres: 10
    },
    {
      id: 3,
      nom: 'Tontine Éducation',
      description: 'Financement de la scolarité',
      montantCycle: 500,
      frequence: 'HEBDOMADAIRE',
      statut: 'ACTIVE',
      dateDebut: '2024-09-01',
      nombreMembres: 8
    }
  ]);

  const [selectedTontine, setSelectedTontine] = useState<Tontine | null>(null);

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

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'TERMINEE':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'SUSPENDUE':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getFrequenceLabel = (frequence: string) => {
    return frequence === 'MENSUEL' ? 'MENSUEL' : 'HEBDOMADAIRE';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6 lg:p-8">
      {/* Header avec statistiques */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
              Mes Tontines Actives
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              Gérez vos participations aux tontines
            </p>
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
            <p className="text-3xl font-bold text-slate-900">
              {formatCurrency(tontines.reduce((acc, t) => acc + t.montantCycle, 0))}
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 font-medium">Tontines actives</span>
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {tontines.filter(t => t.statut === 'ACTIVE').length}
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 font-medium">Membres totaux</span>
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {tontines.reduce((acc, t) => acc + (t.nombreMembres || 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Liste des tontines */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {tontines.map((tontine) => (
            <div
              key={tontine.id}
              className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* Header de la carte */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-2xl font-bold leading-tight">
                    {tontine.nom}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(tontine.statut)} bg-white`}>
                    {tontine.statut === 'ACTIVE' ? 'Actif' : tontine.statut}
                  </span>
                </div>
                <p className="text-indigo-100 text-sm opacity-90">
                  {tontine.description}
                </p>
              </div>

              {/* Contenu de la carte */}
              <div className="p-6 space-y-4">
                {/* Montant du cycle */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <p className="text-slate-600 text-sm mb-1 font-medium">
                    Montant du cycle
                  </p>
                  <p className="text-3xl font-bold text-slate-900">
                    {formatCurrency(tontine.montantCycle)}
                  </p>
                </div>

                {/* Informations détaillées */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600 text-sm font-medium">
                      Fréquence
                    </span>
                    <span className="text-slate-900 font-bold px-3 py-1 bg-slate-100 rounded-lg text-sm">
                      {getFrequenceLabel(tontine.frequence)}
                    </span>
                  </div>

                  {tontine.ordreTirage && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600 text-sm font-medium">
                        Ordre de tirage
                      </span>
                      <span className="text-purple-700 font-bold text-2xl">
                        #{tontine.ordreTirage}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600 text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Date de début
                    </span>
                    <span className="text-slate-900 font-semibold">
                      {formatDate(tontine.dateDebut)}
                    </span>
                  </div>
                </div>

                {/* Bouton d'action */}
                <button
                  onClick={() => setSelectedTontine(tontine)}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Eye className="w-5 h-5" />
                  Voir les détails
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de détails (optionnel) */}
      {selectedTontine && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">
                  {selectedTontine.nom}
                </h2>
                <p className="text-slate-600">{selectedTontine.description}</p>
              </div>
              <button
                onClick={() => setSelectedTontine(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-200">
                <p className="text-indigo-900 font-bold text-4xl mb-2">
                  {formatCurrency(selectedTontine.montantCycle)}
                </p>
                <p className="text-indigo-700 font-medium">Montant du cycle</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-slate-600 text-sm mb-1">Fréquence</p>
                  <p className="text-slate-900 font-bold">
                    {getFrequenceLabel(selectedTontine.frequence)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-slate-600 text-sm mb-1">Statut</p>
                  <p className="text-slate-900 font-bold">{selectedTontine.statut}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTontine(null)}
                className="w-full bg-slate-900 text-white py-3 px-4 rounded-xl font-semibold hover:bg-slate-800 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TontinesPage;