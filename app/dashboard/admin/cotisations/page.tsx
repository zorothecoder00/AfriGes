"use client";

import React, { useState } from 'react';
import { Plus, Search, Filter, Download, Calendar, CreditCard, CheckCircle, Clock, TrendingUp, AlertTriangle, Eye, MoreVertical } from 'lucide-react';
import { StatutCotisation } from '@/types' 

export default function CotisationsPage() {  
  const [selectedPeriod, setSelectedPeriod] = useState('mois');
  const [searchQuery, setSearchQuery] = useState('');  
    
  // Données de simulation
  const cotisations = [  
    {
      id: 1,
      membre: 'Kouassi Adjoua',
      avatar: 'KA',
      tontine: 'Tontine Solidarité',
      montant: '€250',
      dateEcheance: '15 Jan 2025',
      datePaiement: '14 Jan 2025',
      statut: StatutCotisation.PAYEE,
      methode: 'Mobile Money',
      reference: 'TXN-2025-001',
    },
    {
      id: 2,
      membre: 'Mensah Kofi',
      avatar: 'MK',
      tontine: 'Entrepreneuriat Plus',
      montant: '€300',
      dateEcheance: '15 Jan 2025',
      datePaiement: '15 Jan 2025',
      statut: StatutCotisation.PAYEE,
      methode: 'Virement bancaire',
      reference: 'TXN-2025-002',
    },
    {
      id: 3,
      membre: 'Diallo Fatoumata',
      avatar: 'DF',
      tontine: 'Éducation Avenir',
      montant: '€200',
      dateEcheance: '15 Jan 2025',
      datePaiement: null,
      statut: StatutCotisation.EN_ATTENTE,
      methode: null,
      reference: null,
    },
    {
      id: 4,
      membre: 'Nkrumah Akosua',
      avatar: 'NA',
      tontine: 'Commerce Communautaire',
      montant: '€275',
      dateEcheance: '20 Jan 2025',
      datePaiement: null,
      statut: StatutCotisation.EN_ATTENTE,
      methode: null,
      reference: null,
    },
    {
      id: 5,
      membre: 'Traoré Ibrahim',
      avatar: 'TI',
      tontine: 'Tontine Solidarité',
      montant: '€250',
      dateEcheance: '15 Jan 2025',
      datePaiement: '15 Jan 2025',
      statut: StatutCotisation.PAYEE,
      methode: 'Espèces',
      reference: 'TXN-2025-003',
    },
    {
      id: 6,
      membre: 'Bamba Marie',
      avatar: 'BM',
      tontine: 'Santé et Bien-être',
      montant: '€220',
      dateEcheance: '22 Jan 2025',
      datePaiement: null,
      statut: StatutCotisation.EN_ATTENTE,
      methode: null,
      reference: null,
    },
    {
      id: 7,
      membre: 'Sow Amadou',
      avatar: 'SA',
      tontine: 'Entrepreneuriat Plus',
      montant: '€300',  
      dateEcheance: '10 Jan 2025',
      datePaiement: null,
      statut: StatutCotisation.EN_ATTENTE,
      methode: null,
      reference: null,
    },
    {
      id: 8,
      membre: 'Osei Kwame',
      avatar: 'OK',
      tontine: 'Commerce Communautaire',
      montant: '€275',
      dateEcheance: '15 Jan 2025',
      datePaiement: '13 Jan 2025',
      statut: StatutCotisation.PAYEE,
      methode: 'Mobile Money',
      reference: 'TXN-2025-004',
    },
  ];

  const stats = [
    { 
      label: 'Total Collecté', 
      value: '€45,280', 
      change: '+12%',
      icon: TrendingUp, 
      color: 'bg-emerald-500',
      lightBg: 'bg-emerald-50' 
    },
    { 
      label: 'Cotisations Payées', 
      value: '1,245', 
      change: '+8%',
      icon: CheckCircle, 
      color: 'bg-blue-500',
      lightBg: 'bg-blue-50' 
    },
    { 
      label: 'En Attente', 
      value: '187', 
      change: '-5%',
      icon: Clock, 
      color: 'bg-amber-500',
      lightBg: 'bg-amber-50' 
    },
    { 
      label: 'En Retard', 
      value: '23', 
      change: '-15%',
      icon: AlertTriangle, 
      color: 'bg-red-500',
      lightBg: 'bg-red-50' 
    },   
  ];

  const getStatutBadge = (statut: StatutCotisation) => {
    switch (statut) {
      case StatutCotisation.PAYEE:
        return {
          bg: 'bg-emerald-100',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          icon: CheckCircle,
          iconColor: 'text-emerald-600'
        };
      case StatutCotisation.EN_ATTENTE:
        return {
          bg: 'bg-amber-100',
          text: 'text-amber-700',
          border: 'border-amber-200',
          icon: Clock,
          iconColor: 'text-amber-600'
        };
      case StatutCotisation.EXPIREE:
        return {
          bg: 'bg-red-100',
          text: 'text-red-700',
          border: 'border-red-200',
          icon: AlertTriangle,
          iconColor: 'text-red-600'
        };
      default:
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200',
          icon: Clock,
          iconColor: 'text-slate-600'
        };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Cotisations</h1>
            <p className="text-slate-500">Suivez et gérez toutes les cotisations des membres</p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Exporter
            </button>
            <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
              <Plus size={20} />
              Enregistrer paiement
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
                  <span className={`text-sm font-semibold px-2.5 py-1 rounded-lg ${
                    stat.change.startsWith('+') 
                      ? 'text-emerald-600 bg-emerald-50' 
                      : 'text-red-600 bg-red-50'
                  }`}>
                    {stat.change}
                  </span>
                </div>
                <h3 className="text-slate-600 text-sm font-medium mb-1">{stat.label}</h3>
                <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher par membre, tontine ou référence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
            <select 
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            >
              <option value="semaine">Cette semaine</option>
              <option value="mois">Ce mois</option>
              <option value="trimestre">Ce trimestre</option>
              <option value="annee">Cette année</option>
            </select>
            <select className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
              <option>Tous les statuts</option>
              <option>Payé</option>
              <option>En attente</option>
              <option>En retard</option>
            </select>
            <select className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
              <option>Toutes les tontines</option>
              <option>Tontine Solidarité</option>
              <option>Entrepreneuriat Plus</option>
              <option>Éducation Avenir</option>
            </select>
            <button className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2 font-medium">
              <Filter size={18} />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-5">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Taux de paiement</p>
                <p className="text-3xl font-bold">87.5%</p>
              </div>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: '87.5%' }} />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-blue-100 text-sm">Moyenne mensuelle</p>
                <p className="text-3xl font-bold">€15,093</p>
              </div>
            </div>
            <p className="text-blue-100 text-sm">+12% vs mois dernier</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg shadow-amber-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <CreditCard size={24} />
              </div>
              <div>
                <p className="text-amber-100 text-sm">Méthode populaire</p>
                <p className="text-2xl font-bold">Mobile Money</p>
              </div>
            </div>
            <p className="text-amber-100 text-sm">52% des paiements</p>
          </div>
        </div>

        {/* Cotisations Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Membre
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Tontine
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Échéance
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Date de paiement
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Méthode
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cotisations.map((cotisation) => {
                  const statutInfo = getStatutBadge(cotisation.statut);
                  const StatutIcon = statutInfo.icon;
                  
                  return (
                    <tr key={cotisation.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                            {cotisation.avatar}
                          </div>
                          <span className="font-semibold text-slate-800">{cotisation.membre}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{cotisation.tontine}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-slate-800">{cotisation.montant}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="text-sm text-slate-600">{cotisation.dateEcheance}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {cotisation.datePaiement ? (
                          <span className="text-sm text-slate-600">{cotisation.datePaiement}</span>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statutInfo.bg} ${statutInfo.text} ${statutInfo.border}`}>
                          <StatutIcon size={14} className={statutInfo.iconColor} />
                          {cotisation.statut}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {cotisation.methode ? (
                          <span className="text-sm text-slate-600">{cotisation.methode}</span>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
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
              Affichage de <span className="font-semibold">1-8</span> sur <span className="font-semibold">1,455</span> cotisations
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