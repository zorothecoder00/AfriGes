"use client";

import React, { useState } from 'react';
import { Plus, Search, Filter, Download, ShoppingCart, TrendingUp, DollarSign, Users, Calendar, Eye, MoreVertical, Package, Receipt } from 'lucide-react';

type Vente = {
  id: string;
  client: string;
  avatar: string;
  produits: string[];
  quantite: number;
  montantTotal: string;
  methodePaiement: MethodePaiement;
  date: string;  
  statut: StatutVente;
  vendeur: string;
  reference: string;
};

type StatutVente = 'Complété' | 'En attente' | 'Annulé';

type MethodePaiement =
  | 'Mobile Money'
  | 'Crédit Alimentaire'
  | 'Espèces' 
  | 'Virement';

export default function VentesPage() {

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('mois');

  // Données de simulation
  const ventes: Vente[] = [
    {
      id: 'VTE-2025-001',
      client: 'Kouassi Adjoua',
      avatar: 'KA',
      produits: ['Riz 25kg', 'Huile 5L', 'Sucre 5kg'],
      quantite: 3,
      montantTotal: '€145.50',
      methodePaiement: 'Mobile Money',
      date: '29 Déc 2024 14:30',
      statut: 'Complété',
      vendeur: 'Marie B.',
      reference: 'MM-7834521'
    },
    {
      id: 'VTE-2025-002',
      client: 'Mensah Kofi',
      avatar: 'MK',
      produits: ['Farine 10kg', 'Tomate concentrée 12x'],
      quantite: 2,
      montantTotal: '€78.20',
      methodePaiement: 'Crédit Alimentaire',
      date: '29 Déc 2024 12:15',
      statut: 'Complété',
      vendeur: 'Amadou S.',
      reference: 'CA-A456'
    },
    {
      id: 'VTE-2025-003',
      client: 'Diallo Fatoumata',
      avatar: 'DF',
      produits: ['Lait en poudre 2.5kg', 'Café 500g', 'Thé 250g'],
      quantite: 3,
      montantTotal: '€92.80',
      methodePaiement: 'Espèces',
      date: '29 Déc 2024 10:45',
      statut: 'Complété',
      vendeur: 'Marie B.',
      reference: 'ESP-001'
    },
    {
      id: 'VTE-2025-004',
      client: 'Nkrumah Akosua',
      avatar: 'NA',
      produits: ['Poulet congelé 5kg', 'Poisson fumé 2kg'],
      quantite: 2,
      montantTotal: '€156.00',
      methodePaiement: 'Virement',
      date: '29 Déc 2024 09:20',
      statut: 'Complété',
      vendeur: 'Ibrahim T.',
      reference: 'VIR-2301'
    },
    {
      id: 'VTE-2025-005',
      client: 'Traoré Ibrahim',
      avatar: 'TI',
      produits: ['Riz 50kg', 'Huile 25L'],
      quantite: 2,
      montantTotal: '€285.00',
      methodePaiement: 'Mobile Money',
      date: '28 Déc 2024 16:30',
      statut: 'Complété',
      vendeur: 'Marie B.',
      reference: 'MM-7834420'
    },
    {
      id: 'VTE-2025-006',
      client: 'Bamba Marie',
      avatar: 'BM',
      produits: ['Savon 12x', 'Détergent 5kg', 'Eau de Javel 5L'],
      quantite: 3,
      montantTotal: '€64.50',
      methodePaiement: 'Crédit Alimentaire',
      date: '28 Déc 2024 14:10',
      statut: 'Complété',
      vendeur: 'Amadou S.',
      reference: 'CA-B723'
    },
    {
      id: 'VTE-2025-007',
      client: 'Sow Amadou',
      avatar: 'SA',
      produits: ['Pâtes 5kg', 'Sauce tomate 24x'],
      quantite: 2,
      montantTotal: '€45.30',
      methodePaiement: 'Espèces',
      date: '28 Déc 2024 11:45',
      statut: 'En attente',
      vendeur: 'Ibrahim T.',
      reference: 'ESP-002'
    },
    {
      id: 'VTE-2025-008',
      client: 'Osei Kwame',
      avatar: 'OK',
      produits: ['Riz 25kg', 'Huile 10L', 'Sucre 10kg', 'Farine 10kg'],
      quantite: 4,
      montantTotal: '€198.75',
      methodePaiement: 'Mobile Money',
      date: '28 Déc 2024 09:15',
      statut: 'Complété',
      vendeur: 'Marie B.',
      reference: 'MM-7834398'
    },
  ];

  const stats = [
    { 
      label: 'Ventes du Mois', 
      value: '€128,450',
      change: '+15%',
      icon: TrendingUp, 
      color: 'bg-emerald-500',
      lightBg: 'bg-emerald-50' 
    },
    { 
      label: 'Transactions', 
      value: '1,847',
      change: '+12%',
      icon: ShoppingCart, 
      color: 'bg-blue-500',
      lightBg: 'bg-blue-50' 
    },
    { 
      label: 'Panier Moyen', 
      value: '€69.50',
      change: '+8%',
      icon: DollarSign, 
      color: 'bg-purple-500',
      lightBg: 'bg-purple-50' 
    },
    { 
      label: 'Clients Actifs', 
      value: '542',
      change: '+23%',
      icon: Users, 
      color: 'bg-amber-500',  
      lightBg: 'bg-amber-50' 
    },
  ];

  const topProduits = [
    { nom: 'Riz 25kg', ventes: 342, montant: '€34,200', variation: '+18%' },
    { nom: 'Huile 5L', ventes: 289, montant: '€28,900', variation: '+12%' },
    { nom: 'Sucre 5kg', ventes: 256, montant: '€12,800', variation: '+8%' },
    { nom: 'Farine 10kg', ventes: 198, montant: '€15,840', variation: '+5%' },
  ];

  const getStatutColor = (statut: StatutVente): string => {
    return statut === 'Complété'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : statut === 'En attente'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-red-100 text-red-700 border-red-200';
  };

  const getMethodeIcon = (methode: MethodePaiement): string  => {
    if (methode.includes('Mobile')) return '📱';
    if (methode.includes('Crédit')) return '💳';
    if (methode.includes('Espèces')) return '💵';
    if (methode.includes('Virement')) return '🏦';
    return '💰';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Ventes</h1>
            <p className="text-slate-500">Gérez et suivez toutes vos transactions de vente</p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Exporter
            </button>
            <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
              <Plus size={20} />
              Nouvelle vente
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
                  <span className="text-emerald-600 text-sm font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg">
                    {stat.change}
                  </span>
                </div>
                <h3 className="text-slate-600 text-sm font-medium mb-1">{stat.label}</h3>
                <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Stats & Top Products */}
        <div className="grid grid-cols-2 gap-5">
          {/* Sales by Payment Method */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Ventes par méthode de paiement</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="font-semibold text-slate-800">Mobile Money</p>
                    <p className="text-xs text-slate-500">52% des ventes</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-blue-700">€66,794</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💳</span>
                  <div>
                    <p className="font-semibold text-slate-800">Crédit Alimentaire</p>
                    <p className="text-xs text-slate-500">28% des ventes</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-emerald-700">€35,966</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💵</span>
                  <div>
                    <p className="font-semibold text-slate-800">Espèces</p>
                    <p className="text-xs text-slate-500">15% des ventes</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-amber-700">€19,267</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏦</span>
                  <div>
                    <p className="font-semibold text-slate-800">Virement</p>
                    <p className="text-xs text-slate-500">5% des ventes</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-purple-700">€6,423</p>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Produits les plus vendus</h3>
            <div className="space-y-4">
              {topProduits.map((produit, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{produit.nom}</p>
                      <p className="text-xs text-slate-500">{produit.ventes} unités vendues</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-800">{produit.montant}</p>
                    <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                      {produit.variation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher par ID, client ou produit..."
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
              <option value="jour">Aujourd&apos;hui</option>
              <option value="semaine">Cette semaine</option>
              <option value="mois">Ce mois</option>
              <option value="trimestre">Ce trimestre</option>
            </select>
            <select className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
              <option>Toutes les méthodes</option>
              <option>Mobile Money</option>
              <option>Crédit Alimentaire</option>
              <option>Espèces</option>
              <option>Virement</option>
            </select>
            <select className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
              <option>Tous les statuts</option>
              <option>Complété</option>
              <option>En attente</option>
              <option>Annulé</option>
            </select>
            <button className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2 font-medium">
              <Filter size={18} />
            </button>
          </div>
        </div>

        {/* Sales Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    ID Vente
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Produits
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Paiement
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Date & Heure
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Vendeur
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
                {ventes.map((vente) => (
                  <tr key={vente.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Receipt size={16} className="text-emerald-600" />
                        <span className="font-mono text-sm font-semibold text-slate-800">{vente.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                          {vente.avatar}
                        </div>
                        <span className="font-semibold text-slate-800">{vente.client}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-slate-400" />
                        <div>
                          <p className="text-sm text-slate-800 font-medium">{vente.produits[0]}</p>
                          {vente.produits.length > 1 && (
                            <p className="text-xs text-slate-500">+{vente.produits.length - 1} autre(s)</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-lg font-bold text-slate-800">{vente.montantTotal}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getMethodeIcon(vente.methodePaiement)}</span>
                          <span className="text-sm text-slate-700 font-medium">{vente.methodePaiement}</span>
                        </div>
                        <p className="text-xs text-slate-500">{vente.reference}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-sm text-slate-600">{vente.date}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{vente.vendeur}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatutColor(vente.statut)}`}>
                        {vente.statut}
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Affichage de <span className="font-semibold">1-8</span> sur <span className="font-semibold">1,847</span> ventes
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