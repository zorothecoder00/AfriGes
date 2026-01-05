"use client";

import React, { useState } from 'react';
import { Plus, Search, Filter, Download, Calendar, Users, DollarSign, TrendingUp, Clock, MoreVertical, Eye, Edit, Archive, AlertCircle } from 'lucide-react';
import { StatutTontine } from '@prisma/client'

type Tontine = {
  id: number;
  nom: string;
  type: string;
  membres: number;  
  montantTotal: string;
  contribution: string;
  frequence: string;
  prochainTour: string;
  statut: StatutTontine;
  progression: number;
  couleur: CouleurTontine;
};

type CouleurTontine =
  | 'emerald'
  | 'amber'
  | 'blue'
  | 'purple'
  | 'rose'
  | 'indigo';

type ColorClasses = {
  bg: string;
  lightBg: string;
  border: string;
  text: string;
  gradient: string;
};

export default function TontinesPage() {

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'

  // Données de simulation
  const tontines: Tontine[] = [
    {
      id: 1,
      nom: 'Tontine Solidarité',
      type: 'Solidarité',
      membres: 45,
      montantTotal: '€12,500',
      contribution: '€250',
      frequence: 'Mensuelle',
      prochainTour: '15 Jan 2025',
      statut: StatutTontine.ACTIVE,
      progression: 75,
      couleur: 'emerald'
    },
    {
      id: 2,
      nom: 'Entrepreneuriat Plus',
      type: 'Entrepreneuriat',
      membres: 32,
      montantTotal: '€8,900',
      contribution: '€300',
      frequence: 'Mensuelle',
      prochainTour: '22 Jan 2025',
      statut: StatutTontine.ACTIVE,
      progression: 60,
      couleur: 'amber'
    },
    {
      id: 3,
      nom: 'Éducation Avenir',
      type: 'Éducation',
      membres: 28,
      montantTotal: '€6,200',
      contribution: '€200',
      frequence: 'Bimensuelle',
      prochainTour: '30 Jan 2025',
      statut: StatutTontine.ACTIVE,
      progression: 45,
      couleur: 'blue'
    },
    {
      id: 4,
      nom: 'Commerce Communautaire',
      type: 'Commerce',
      membres: 38,
      montantTotal: '€10,400',
      contribution: '€275',
      frequence: 'Mensuelle',
      prochainTour: '08 Fév 2025',
      statut: StatutTontine.ACTIVE,
      progression: 85,
      couleur: 'purple'
    },
    {
      id: 5,
      nom: 'Santé et Bien-être',
      type: 'Santé',
      membres: 25,
      montantTotal: '€5,800',
      contribution: '€220',
      frequence: 'Mensuelle',
      prochainTour: '18 Fév 2025',
      statut: StatutTontine.ACTIVE,
      progression: 55,
      couleur: 'rose'
    },
    {
      id: 6,
      nom: 'Immobilier Collectif',
      type: 'Immobilier',
      membres: 20,
      montantTotal: '€15,000',
      contribution: '€500',
      frequence: 'Trimestrielle',
      prochainTour: '15 Mar 2025',
      statut: StatutTontine.SUSPENDUE,
      progression: 30,
      couleur: 'indigo'
    },
  ];

  const stats = [
    { label: 'Tontines Actives', value: '24', icon: TrendingUp, color: 'bg-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Total Membres', value: '1,247', icon: Users, color: 'bg-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Montant Total', value: '€58,800', icon: DollarSign, color: 'bg-amber-500', lightBg: 'bg-amber-50' },
    { label: 'Prochains Tours', value: '8', icon: Clock, color: 'bg-purple-500', lightBg: 'bg-purple-50' },
  ];

  const getColorClasses = (couleur: CouleurTontine): ColorClasses => {
    const colors = {
      emerald: {
        bg: 'bg-emerald-500',
        lightBg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        gradient: 'from-emerald-500 to-emerald-600'
      },
      amber: {
        bg: 'bg-amber-500',
        lightBg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        gradient: 'from-amber-500 to-amber-600'
      },
      blue: {
        bg: 'bg-blue-500',
        lightBg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        gradient: 'from-blue-500 to-blue-600'
      },
      purple: {
        bg: 'bg-purple-500',
        lightBg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        gradient: 'from-purple-500 to-purple-600'
      },
      rose: {
        bg: 'bg-rose-500',
        lightBg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-700',
        gradient: 'from-rose-500 to-rose-600'
      },
      indigo: {
        bg: 'bg-indigo-500',
        lightBg: 'bg-indigo-50',
        border: 'border-indigo-200',
        text: 'text-indigo-700',
        gradient: 'from-indigo-500 to-indigo-600'
      },
    };
    return colors[couleur] || colors.emerald;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-amber-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Tontines</h1>
            <p className="text-slate-500">Gérez toutes les tontines de votre communauté</p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Rapport
            </button>
            <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
              <Plus size={20} />
              Créer une tontine
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-5">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className={`${stat.lightBg} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                    <Icon className={`${stat.color.replace('bg-', 'text-')} w-6 h-6`} />
                  </div>
                </div>
                <h3 className="text-slate-600 text-sm font-medium mb-1">{stat.label}</h3>
                <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher une tontine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
            <select className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
              <option>Tous les types</option>
              <option>Solidarité</option>
              <option>Entrepreneuriat</option>
              <option>Éducation</option>
              <option>Commerce</option>
              <option>Santé</option>
              <option>Immobilier</option>
            </select>
            <select className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
              <option>Toutes les fréquences</option>
              <option>Mensuelle</option>
              <option>Bimensuelle</option>
              <option>Trimestrielle</option>
            </select>
            <button className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2 font-medium">
              <Filter size={18} />
              Plus de filtres
            </button>
          </div>
        </div>

        {/* Tontines Grid */}
        <div className="grid grid-cols-3 gap-6">
          {tontines.map((tontine) => {
            const colors = getColorClasses(tontine.couleur);
            return (
              <div key={tontine.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden hover:shadow-lg transition-all group">
                {/* Card Header */}
                <div className={`bg-gradient-to-r ${colors.gradient} p-6 text-white`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold mb-2">
                        {tontine.type}
                      </span>
                      <h3 className="text-xl font-bold mb-1">{tontine.nom}</h3>
                    </div>
                    <button className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                      <MoreVertical size={20} />
                    </button>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progression</span>
                      <span className="font-semibold">{tontine.progression}%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${tontine.progression}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`${colors.lightBg} p-4 rounded-xl`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Users size={16} className={colors.text} />
                        <span className="text-xs text-slate-600 font-medium">Membres</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-800">{tontine.membres}</p>
                    </div>
                    <div className={`${colors.lightBg} p-4 rounded-xl`}>
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign size={16} className={colors.text} />
                        <span className="text-xs text-slate-600 font-medium">Total</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-800">{tontine.montantTotal}</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Contribution</span>
                      <span className="text-sm font-semibold text-slate-800">{tontine.contribution}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Fréquence</span>
                      <span className="text-sm font-semibold text-slate-800">{tontine.frequence}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Prochain tour</span>
                      <span className={`text-sm font-semibold ${colors.text}`}>{tontine.prochainTour}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="pt-2">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                      tontine.statut === StatutTontine.ACTIVE
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                      {tontine.statut === StatutTontine.ACTIVE ? '● ' : '◐ '}
                      {tontine.statut}
                    </span>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                  <button className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-sm font-medium">
                    <Eye size={16} />
                    Détails
                  </button>
                  <button className={`flex-1 px-4 py-2 ${colors.bg} text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm font-medium`}>
                    <Edit size={16} />
                    Gérer
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State Card (optionnel - à afficher si aucune tontine) */}
        {/* <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200/60 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="text-emerald-600" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Aucune tontine trouvée</h3>
            <p className="text-slate-500 mb-6">Créez votre première tontine pour commencer à gérer les épargnes collectives.</p>
            <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium mx-auto">
              <Plus size={20} />
              Créer une tontine
            </button>
          </div>
        </div> */}
      </div>
    </div>
  );
}