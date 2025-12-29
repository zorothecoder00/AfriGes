"use client";

import React, { useState } from 'react';
import { Plus, Search, Filter, Download, ShoppingCart, TrendingUp, DollarSign, Calendar, Users, CheckCircle, Clock, AlertCircle, Eye, MoreVertical, Package } from 'lucide-react';
import { StatutCreditAlim } from '@prisma/client'  
    
export default function CreditsAlimentairesPage() {  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('tous');

  // Données de simulation
  const credits = [
    {
      id: 1,
      membre: 'Kouassi Adjoua',
      avatar: 'KA',
      montantCredit: '€500',
      montantUtilise: '€350',
      montantRestant: '€150',
      dateOctroi: '01 Jan 2025',
      dateEcheance: '31 Mar 2025',
      statut: StatutCreditAlim.ACTIF,
      progression: 70,
      derniereUtilisation: '15 Jan 2025',
      nombreAchats: 12
    },
    {
      id: 2,
      membre: 'Mensah Kofi',
      avatar: 'MK',
      montantCredit: '€800',
      montantUtilise: '€800',
      montantRestant: '€0',
      dateOctroi: '15 Déc 2024',
      dateEcheance: '15 Mar 2025',
      statut: StatutCreditAlim.EPUISE,
      progression: 100,
      derniereUtilisation: '10 Jan 2025',
      nombreAchats: 28
    },
    {
      id: 3,
      membre: 'Diallo Fatoumata',
      avatar: 'DF',
      montantCredit: '€600',
      montantUtilise: '€180',
      montantRestant: '€420',
      dateOctroi: '20 Déc 2024',
      dateEcheance: '20 Mar 2025',
      statut: StatutCreditAlim.ACTIF,
      progression: 30,
      derniereUtilisation: '18 Jan 2025',
      nombreAchats: 8
    },
    {
      id: 4,
      membre: 'Nkrumah Akosua',
      avatar: 'NA',
      montantCredit: '€1,000',
      montantUtilise: '€450',
      montantRestant: '€550',
      dateOctroi: '05 Jan 2025',
      dateEcheance: '05 Avr 2025',
      statut: StatutCreditAlim.ACTIF,
      progression: 45,
      derniereUtilisation: '22 Jan 2025',
      nombreAchats: 15
    },
    {
      id: 5,
      membre: 'Traoré Ibrahim',
      avatar: 'TI',
      montantCredit: '€400',
      montantUtilise: '€400',
      montantRestant: '€0',
      dateOctroi: '10 Déc 2024',
      dateEcheance: '10 Jan 2025',
      statut: StatutCreditAlim.EXPIRE,
      progression: 100,
      derniereUtilisation: '08 Jan 2025',
      nombreAchats: 18
    },
    {
      id: 6,
      membre: 'Bamba Marie',
      avatar: 'BM',
      montantCredit: '€700',
      montantUtilise: '€520',
      montantRestant: '€180',
      dateOctroi: '01 Jan 2025',
      dateEcheance: '31 Mar 2025',
      statut: StatutCreditAlim.ACTIF,
      progression: 74,
      derniereUtilisation: '20 Jan 2025',
      nombreAchats: 22
    },
    {
      id: 7,
      membre: 'Sow Amadou',
      avatar: 'SA',
      montantCredit: '€300',
      montantUtilise: '€75',
      montantRestant: '€225',
      dateOctroi: '15 Jan 2025',
      dateEcheance: '15 Avr 2025',
      statut: StatutCreditAlim.ACTIF,
      progression: 25,
      derniereUtilisation: '19 Jan 2025',
      nombreAchats: 4
    },
    {
      id: 8,
      membre: 'Osei Kwame',
      avatar: 'OK',
      montantCredit: '€900',
      montantUtilise: '€630',
      montantRestant: '€270',
      dateOctroi: '28 Déc 2024',
      dateEcheance: '28 Mar 2025',
      statut: StatutCreditAlim.ACTIF,
      progression: 70,
      derniereUtilisation: '21 Jan 2025',
      nombreAchats: 25
    },
  ];

  const stats = [
    { 
      label: 'Crédits Actifs', 
      value: '€45,280',
      subValue: '156 crédits',
      icon: TrendingUp, 
      color: 'bg-emerald-500',
      lightBg: 'bg-emerald-50' 
    },
    { 
      label: 'Montant Utilisé', 
      value: '€31,850',
      subValue: '70% du total',
      icon: ShoppingCart, 
      color: 'bg-blue-500',
      lightBg: 'bg-blue-50' 
    },
    { 
      label: 'Montant Disponible', 
      value: '€13,430',
      subValue: '30% du total',
      icon: DollarSign, 
      color: 'bg-purple-500',
      lightBg: 'bg-purple-50'   
    },
    { 
      label: 'Crédits Épuisés', 
      value: '28',
      subValue: 'Ce mois',
      icon: AlertCircle, 
      color: 'bg-amber-500',
      lightBg: 'bg-amber-50' 
    },
  ];

  const getStatutInfo = (statut: StatutCreditAlim) => {
    switch (statut) {
      case StatutCreditAlim.ACTIF:
        return {
          bg: 'bg-emerald-100',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          icon: CheckCircle,
          iconColor: 'text-emerald-600'
        };
      case StatutCreditAlim.EPUISE:
        return {
          bg: 'bg-amber-100',
          text: 'text-amber-700',
          border: 'border-amber-200',
          icon: AlertCircle,
          iconColor: 'text-amber-600'
        };
      case StatutCreditAlim.EXPIRE:
        return {
          bg: 'bg-red-100',
          text: 'text-red-700',
          border: 'border-red-200',
          icon: Clock,
          iconColor: 'text-red-600'
        };
      default:
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200',
          icon: CheckCircle,
          iconColor: 'text-slate-600'
        };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-emerald-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Crédits Alimentaires</h1>
            <p className="text-slate-500">Gérez les crédits alimentaires de vos membres</p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Rapport
            </button>
            <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
              <Plus size={20} />
              Nouveau crédit
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
                <p className="text-3xl font-bold text-slate-800 mb-1">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.subValue}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-5">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Users size={24} />
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Bénéficiaires actifs</p>
                <p className="text-3xl font-bold">156</p>
              </div>
            </div>
            <p className="text-emerald-100 text-sm">+12 ce mois</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Package size={24} />
              </div>
              <div>
                <p className="text-blue-100 text-sm">Achats ce mois</p>
                <p className="text-3xl font-bold">1,847</p>
              </div>
            </div>
            <p className="text-blue-100 text-sm">Moyenne: 11.8 par membre</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg shadow-amber-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <ShoppingCart size={24} />
              </div>
              <div>
                <p className="text-amber-100 text-sm">Panier moyen</p>
                <p className="text-3xl font-bold">€17.25</p>
              </div>
            </div>
            <p className="text-amber-100 text-sm">+5% vs mois dernier</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un bénéficiaire..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
            <select 
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            >
              <option value="tous">Tous les statuts</option>
              <option value="actif">Actifs</option>
              <option value="epuise">Épuisés</option>
              <option value="expire">Expirés</option>
            </select>
            <select className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
              <option>Tous les montants</option>
              <option>€0 - €500</option>
              <option>€501 - €1000</option>
              <option>Plus de €1000</option>
            </select>
            <button className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2 font-medium">
              <Filter size={18} />
              Filtres
            </button>
          </div>
        </div>

        {/* Credits Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Bénéficiaire
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Crédit Total
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Utilisé
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Disponible
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Progression
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Activité
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {credits.map((credit) => {
                  const statutInfo = getStatutInfo(credit.statut);
                  const StatutIcon = statutInfo.icon;
                  
                  return (
                    <tr key={credit.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                            {credit.avatar}
                          </div>
                          <span className="font-semibold text-slate-800">{credit.membre}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-slate-800">{credit.montantCredit}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-blue-600">{credit.montantUtilise}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-emerald-600">{credit.montantRestant}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-slate-600">
                            <span>{credit.progression}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-24">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                credit.progression < 50 
                                  ? 'bg-emerald-500' 
                                  : credit.progression < 90 
                                    ? 'bg-amber-500' 
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${credit.progression}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs space-y-1">
                          <div className="text-slate-600">Octroi: {credit.dateOctroi}</div>
                          <div className="text-slate-600">Échéance: {credit.dateEcheance}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs space-y-1">
                          <div className="text-slate-600">{credit.nombreAchats} achats</div>
                          <div className="text-slate-500">Dernier: {credit.derniereUtilisation}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statutInfo.bg} ${statutInfo.text} ${statutInfo.border}`}>
                          <StatutIcon size={14} className={statutInfo.iconColor} />
                          {credit.statut}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Eye size={16} />
                          </button>
                          <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Affichage de <span className="font-semibold">1-8</span> sur <span className="font-semibold">156</span> crédits
            </p>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                Précédent
              </button>
              <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">1</button>
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">2</button>
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">3</button>
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">Suivant</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}