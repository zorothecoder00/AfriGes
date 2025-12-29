"use client";

import React, { useState } from 'react';
import { Plus, Search, Filter, Download, Package, TrendingUp, AlertTriangle, Archive, Eye, Edit, MoreVertical, BarChart3, RefreshCw } from 'lucide-react';

type Produit = {
  id: number;
  nom: string;
  categorie: string;
  sku: string;
  quantiteStock: number;
  seuilMinimum: number;
  prixUnitaire: string;
  valeurStock: string;
  derniereMaj: string;
  fournisseur: string;
  statut: StatutStock;
  mouvements: string;
  couleur: string;
};

type StatutStock =
  | 'En stock'
  | 'Stock faible'
  | 'Rupture proche'
  | 'Rupture de stock';

type StatutInfo = {
  bg: string;
  text: string;
  border: string;
  dot: string;
};

export default function GestionStockPage() {

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  // Données de simulation
  const produits: Produit[] = [
    {
      id: 1,
      nom: 'Riz 25kg',
      categorie: 'Céréales',
      sku: 'RIZ-25KG-001',
      quantiteStock: 450,
      seuilMinimum: 100,
      prixUnitaire: '€100',
      valeurStock: '€45,000',
      derniereMaj: '29 Déc 2024',
      fournisseur: 'AgriCo Ltd',
      statut: 'En stock',
      mouvements: '+120 cette semaine',
      couleur: 'emerald'
    },
    {
      id: 2,
      nom: 'Huile 5L',
      categorie: 'Huiles & Graisses',
      sku: 'HUI-5L-002',
      quantiteStock: 85,
      seuilMinimum: 80,
      prixUnitaire: '€100',
      valeurStock: '€8,500',
      derniereMaj: '29 Déc 2024',
      fournisseur: 'OilPro SA',
      statut: 'Stock faible',
      mouvements: '-45 cette semaine',
      couleur: 'amber'
    },
    {
      id: 3,
      nom: 'Sucre 5kg',
      categorie: 'Sucres & Édulcorants',
      sku: 'SUC-5KG-003',
      quantiteStock: 320,
      seuilMinimum: 150,
      prixUnitaire: '€50',
      valeurStock: '€16,000',
      derniereMaj: '28 Déc 2024',
      fournisseur: 'SweetSupply',
      statut: 'En stock',
      mouvements: '+80 cette semaine',
      couleur: 'emerald'
    },
    {
      id: 4,
      nom: 'Farine 10kg',
      categorie: 'Farines',
      sku: 'FAR-10KG-004',
      quantiteStock: 28,
      seuilMinimum: 100,
      prixUnitaire: '€80',
      valeurStock: '€2,240',
      derniereMaj: '29 Déc 2024',
      fournisseur: 'MillCo',
      statut: 'Rupture proche',
      mouvements: '-72 cette semaine',
      couleur: 'red'
    },
    {
      id: 5,
      nom: 'Lait en poudre 2.5kg',
      categorie: 'Produits laitiers',
      sku: 'LAI-2.5KG-005',
      quantiteStock: 156,
      seuilMinimum: 80,
      prixUnitaire: '€120',
      valeurStock: '€18,720',
      derniereMaj: '28 Déc 2024',
      fournisseur: 'DairyBest',
      statut: 'En stock',
      mouvements: '+35 cette semaine',
      couleur: 'emerald'
    },
    {
      id: 6,
      nom: 'Tomate concentrée (boîte)',
      categorie: 'Conserves',
      sku: 'TOM-BOI-006',
      quantiteStock: 0,
      seuilMinimum: 200,
      prixUnitaire: '€15',
      valeurStock: '€0',
      derniereMaj: '25 Déc 2024',
      fournisseur: 'CanFood Ltd',
      statut: 'Rupture de stock',
      mouvements: '-156 cette semaine',
      couleur: 'red'
    },
    {
      id: 7,
      nom: 'Poulet congelé 5kg',
      categorie: 'Viandes',
      sku: 'POU-5KG-007',
      quantiteStock: 245,
      seuilMinimum: 100,
      prixUnitaire: '€150',
      valeurStock: '€36,750',
      derniereMaj: '29 Déc 2024',
      fournisseur: 'FrozenMeats SA',
      statut: 'En stock',
      mouvements: '+60 cette semaine',
      couleur: 'emerald'
    },
    {
      id: 8,
      nom: 'Pâtes 5kg',
      categorie: 'Pâtes',
      sku: 'PAT-5KG-008',
      quantiteStock: 92,
      seuilMinimum: 120,
      prixUnitaire: '€45',
      valeurStock: '€4,140',
      derniereMaj: '29 Déc 2024',
      fournisseur: 'PastaWorld',
      statut: 'Stock faible',
      mouvements: '-38 cette semaine',
      couleur: 'amber'
    },
  ];

  const stats = [
    { 
      label: 'Valeur Totale Stock', 
      value: '€131,350',
      change: '+8%',
      icon: TrendingUp, 
      color: 'bg-emerald-500',
      lightBg: 'bg-emerald-50' 
    },
    { 
      label: 'Produits en Stock', 
      value: '245',
      change: '+12',
      icon: Package, 
      color: 'bg-blue-500',
      lightBg: 'bg-blue-50' 
    },
    { 
      label: 'Stock Faible', 
      value: '18',
      change: '+3',
      icon: AlertTriangle, 
      color: 'bg-amber-500',
      lightBg: 'bg-amber-50' 
    },
    { 
      label: 'Ruptures', 
      value: '5',
      change: '+2',
      icon: Archive, 
      color: 'bg-red-500',
      lightBg: 'bg-red-50' 
    },
  ];

  const categories = [
    { nom: 'Céréales', produits: 45, valeur: '€62,400' },
    { nom: 'Huiles & Graisses', produits: 28, valeur: '€31,200' },
    { nom: 'Produits laitiers', produits: 32, valeur: '€28,800' },
    { nom: 'Conserves', produits: 56, valeur: '€19,600' },
    { nom: 'Viandes', produits: 38, valeur: '€54,200' },
    { nom: 'Autres', produits: 46, valeur: '€15,150' },
  ];

  const getStatutInfo = (statut: StatutStock): StatutInfo => {
    switch (statut) {
      case 'En stock':
        return {
          bg: 'bg-emerald-100',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          dot: 'bg-emerald-500'
        };
      case 'Stock faible':
        return {
          bg: 'bg-amber-100',
          text: 'text-amber-700',
          border: 'border-amber-200',
          dot: 'bg-amber-500'
        };
      case 'Rupture proche':
        return {
          bg: 'bg-orange-100',
          text: 'text-orange-700',
          border: 'border-orange-200',
          dot: 'bg-orange-500'
        };
      case 'Rupture de stock':
        return {
          bg: 'bg-red-100',
          text: 'text-red-700',
          border: 'border-red-200',
          dot: 'bg-red-500'
        };
      default:
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200',
          dot: 'bg-slate-500'
        };
    }
  };

  const getProgressColor = (quantite: number, seuil: number): string => {
    const percentage = (quantite / seuil) * 100;
    if (percentage > 100) return 'bg-emerald-500';
    if (percentage > 50) return 'bg-blue-500';
    if (percentage > 25) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getProgressPercentage = (quantite: number, seuil: number): number => {
    return Math.min((quantite / seuil) * 100, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Gestion du Stock</h1>
            <p className="text-slate-500">Suivez et gérez votre inventaire en temps réel</p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <RefreshCw size={18} />
              Actualiser
            </button>
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Exporter
            </button>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 font-medium">
              <Plus size={20} />
              Ajouter un produit
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

        {/* Categories Overview */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Vue par catégorie</h3>
          <div className="grid grid-cols-6 gap-4">
            {categories.map((cat, index) => (
              <div key={index} className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <Package size={18} className="text-blue-600" />
                  <span className="font-bold text-slate-800">{cat.produits}</span>
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">{cat.nom}</p>
                <p className="text-xs text-slate-600">{cat.valeur}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts Section */}
        <div className="grid grid-cols-3 gap-5">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg shadow-red-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Archive size={24} />
              </div>
              <div>
                <p className="text-red-100 text-sm">Ruptures de stock</p>
                <p className="text-3xl font-bold">5 produits</p>
              </div>
            </div>
            <p className="text-red-100 text-sm">Action immédiate requise</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg shadow-amber-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-amber-100 text-sm">Stock faible</p>
                <p className="text-3xl font-bold">18 produits</p>
              </div>
            </div>
            <p className="text-amber-100 text-sm">Réapprovisionnement bientôt</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <BarChart3 size={24} />
              </div>
              <div>
                <p className="text-blue-100 text-sm">Mouvement cette semaine</p>
                <p className="text-3xl font-bold">+347</p>
              </div>
            </div>
            <p className="text-blue-100 text-sm">Entrées - Sorties</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un produit, SKU ou fournisseur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>
            <select className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
              <option>Toutes les catégories</option>
              <option>Céréales</option>
              <option>Huiles & Graisses</option>
              <option>Produits laitiers</option>
              <option>Conserves</option>
              <option>Viandes</option>
            </select>
            <select className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
              <option>Tous les statuts</option>
              <option>En stock</option>
              <option>Stock faible</option>
              <option>Rupture proche</option>
              <option>Rupture de stock</option>
            </select>
            <button className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2 font-medium">
              <Filter size={18} />
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Quantité
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Niveau de stock
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Prix Unitaire
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Valeur Stock
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Fournisseur
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
                {produits.map((produit) => {
                  const statutInfo = getStatutInfo(produit.statut);
                  const progressColor = getProgressColor(produit.quantiteStock, produit.seuilMinimum);
                  const progressPercentage = getProgressPercentage(produit.quantiteStock, produit.seuilMinimum);

                  return (
                    <tr key={produit.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-800">{produit.nom}</p>
                          <p className="text-xs text-slate-500">{produit.categorie}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {produit.sku}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-lg font-bold text-slate-800">{produit.quantiteStock}</p>
                          <p className="text-xs text-slate-500">{produit.mouvements}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2 w-32">
                          <div className="flex items-center justify-between text-xs text-slate-600">
                            <span>Seuil: {produit.seuilMinimum}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${progressColor} rounded-full transition-all`}
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-800">{produit.prixUnitaire}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-base font-bold text-slate-800">{produit.valeurStock}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{produit.fournisseur}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${statutInfo.bg} ${statutInfo.text} ${statutInfo.border}`}>
                          <div className={`w-2 h-2 rounded-full ${statutInfo.dot}`}></div>
                          {produit.statut}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Eye size={16} />
                          </button>
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit size={16} />
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
              Affichage de <span className="font-semibold">1-8</span> sur <span className="font-semibold">245</span> produits
            </p>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                Précédent
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">1</button>
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