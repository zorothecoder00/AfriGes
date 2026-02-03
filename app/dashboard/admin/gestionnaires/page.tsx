"use client";

import React, { useState } from 'react';
import { Plus, Search, Filter, Shield, Users, Key, Eye, Edit, MoreVertical, CheckCircle, Clock, Mail, Phone } from 'lucide-react';
import Link from 'next/link'
  
type CouleurRole = 'purple' | 'emerald' | 'blue' | 'amber' | 'rose' | 'slate';
type StatutGestionnaire = 'Actif' | 'Inactif';

type Role = {
  nom: string;
  nombre: number;
  couleur: CouleurRole;
};

type Gestionnaire = {
  id: number;
  nom: string;
  avatar: string;
  email: string;
  telephone: string;
  role: string;
  departement: string;
  statut: StatutGestionnaire;
  derniereConnexion: string;
  dateCreation: string;
  permissions: string[];
  actionsRecentes: number;
  couleurRole: CouleurRole;
};

export default function GestionnairesPage() {
  type CouleurRole = 'purple' | 'emerald' | 'blue' | 'amber' | 'rose' | 'slate';
  type StatutGestionnaire = 'Actif' | 'Inactif';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('tous');

  // Données de simulation
  const gestionnaires: Gestionnaire[] = [
    {
      id: 1,
      nom: 'Koné Aminata',
      avatar: 'KA',
      email: 'a.kone@afriges.com',
      telephone: '+225 07 XX XX XX XX',
      role: 'Super Admin',
      departement: 'Direction',
      statut: 'Actif',
      derniereConnexion: '29 Déc 2024 14:32',
      dateCreation: '01 Jan 2024',
      permissions: ['Tous les droits'],
      actionsRecentes: 156,
      couleurRole: 'purple'
    },
    {
      id: 2,
      nom: 'Diop Mamadou',
      avatar: 'DM',
      email: 'm.diop@afriges.com',
      telephone: '+221 77 XXX XX XX',
      role: 'Gestionnaire Tontines',
      departement: 'Communauté',
      statut: 'Actif',
      derniereConnexion: '29 Déc 2024 12:15',
      dateCreation: '15 Jan 2024',
      permissions: ['Tontines', 'Cotisations', 'Crédits'],
      actionsRecentes: 89,
      couleurRole: 'emerald'
    },
    {
      id: 3,
      nom: 'Mensah Grace',
      avatar: 'MG',
      email: 'g.mensah@afriges.com',
      telephone: '+228 90 XX XX XX XX',
      role: 'Gestionnaire Commerce',
      departement: 'Commerce',
      statut: 'Actif',
      derniereConnexion: '29 Déc 2024 10:45',
      dateCreation: '20 Jan 2024',
      permissions: ['Ventes', 'Stock', 'Produits'],
      actionsRecentes: 124,
      couleurRole: 'blue'
    },
    {
      id: 4,
      nom: 'Traoré Seydou',
      avatar: 'TS',
      email: 's.traore@afriges.com',
      telephone: '+223 76 XX XX XX',
      role: 'Gestionnaire Membres',
      departement: 'Administration',
      statut: 'Actif',
      derniereConnexion: '28 Déc 2024 16:20',
      dateCreation: '05 Fév 2024',
      permissions: ['Membres', 'Rapports'],
      actionsRecentes: 67,
      couleurRole: 'amber'
    },
    {
      id: 5,
      nom: 'Okafor Chioma',
      avatar: 'OC',
      email: 'c.okafor@afriges.com',
      telephone: '+234 80 XXX XXXX',
      role: 'Gestionnaire Finances',
      departement: 'Finances',
      statut: 'Actif',
      derniereConnexion: '29 Déc 2024 09:30',
      dateCreation: '10 Fév 2024',
      permissions: ['Cotisations', 'Crédits', 'Rapports'],
      actionsRecentes: 98,
      couleurRole: 'rose'
    },
    {
      id: 6,
      nom: 'Ndiaye Fatou',
      avatar: 'NF',
      email: 'f.ndiaye@afriges.com',
      telephone: '+221 78 XXX XX XX',
      role: 'Support Client',
      departement: 'Support',
      statut: 'Inactif',
      derniereConnexion: '15 Déc 2024 18:45',
      dateCreation: '25 Fév 2024',
      permissions: ['Membres', 'Messages'],
      actionsRecentes: 34,
      couleurRole: 'slate'
    },
  ];

  const stats = [
    { 
      label: 'Total Gestionnaires', 
      value: '24', 
      icon: Users, 
      color: 'bg-blue-500',
      lightBg: 'bg-blue-50' 
    },
    { 
      label: 'Actifs', 
      value: '21', 
      icon: CheckCircle, 
      color: 'bg-emerald-500',
      lightBg: 'bg-emerald-50' 
    },
    { 
      label: 'Rôles Définis', 
      value: '8', 
      icon: Shield, 
      color: 'bg-purple-500',
      lightBg: 'bg-purple-50' 
    },
    { 
      label: 'Actions ce mois', 
      value: '1,547', 
      icon: Key, 
      color: 'bg-amber-500',
      lightBg: 'bg-amber-50' 
    },
  ];

  const roles: Role[] = [
    { nom: 'Super Admin', nombre: 2, couleur: 'purple' },
    { nom: 'Gestionnaire Tontines', nombre: 5, couleur: 'emerald' },   
    { nom: 'Gestionnaire Commerce', nombre: 4, couleur: 'blue' },
    { nom: 'Gestionnaire Membres', nombre: 3, couleur: 'amber' },
    { nom: 'Gestionnaire Finances', nombre: 6, couleur: 'rose' },
    { nom: 'Support Client', nombre: 4, couleur: 'slate' },
  ];

  const getCouleurClasses = (couleur: CouleurRole): string => {
    const couleurs = {
      purple: 'bg-purple-100 text-purple-700 border-purple-200',
      emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      blue: 'bg-blue-100 text-blue-700 border-blue-200',
      amber: 'bg-amber-100 text-amber-700 border-amber-200',
      rose: 'bg-rose-100 text-rose-700 border-rose-200',
      slate: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    return couleurs[couleur] || couleurs.slate;
  };

  const getStatutColor = (statut: StatutGestionnaire): string => {
    return statut === 'Actif'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Gestionnaires</h1>
            <p className="text-slate-500">Gérez les administrateurs et leurs permissions</p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Shield size={18} />
              Gérer les rôles
            </button>
            <button className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 flex items-center gap-2 font-medium">
              <Plus size={20} />
              Ajouter un gestionnaire
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

        {/* Roles Overview */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Distribution des rôles</h3>
          <div className="grid grid-cols-6 gap-4">
            {roles.map((role, index) => (
              <div key={index} className={`p-4 rounded-xl border-2 ${getCouleurClasses(role.couleur)} hover:scale-105 transition-transform cursor-pointer`}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={18} />
                  <span className="font-semibold text-sm">{role.nombre}</span>
                </div>
                <p className="text-xs font-medium">{role.nom}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un gestionnaire..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50"
              />
            </div>
            <select 
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50"
            >
              <option value="tous">Tous les rôles</option>
              <option value="admin">Super Admin</option>
              <option value="tontines">Gestionnaire Tontines</option>
              <option value="commerce">Gestionnaire Commerce</option>
              <option value="membres">Gestionnaire Membres</option>
              <option value="finances">Gestionnaire Finances</option>
              <option value="support">Support Client</option>
            </select>
            <select className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50">
              <option>Tous les statuts</option>
              <option>Actifs</option>
              <option>Inactifs</option>
            </select>
            <button className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2 font-medium">
              <Filter size={18} />
            </button>
          </div>
        </div>

        {/* Gestionnaires Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Gestionnaire
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Rôle & Département
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Permissions
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
                {gestionnaires.map((gestionnaire) => (
                  <tr key={gestionnaire.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md text-lg">
                          {gestionnaire.avatar}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{gestionnaire.nom}</p>
                          <p className="text-xs text-slate-500">Membre depuis {gestionnaire.dateCreation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail size={14} className="text-slate-400" />
                          {gestionnaire.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone size={14} className="text-slate-400" />
                          {gestionnaire.telephone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getCouleurClasses(gestionnaire.couleurRole)}`}>
                          <Shield size={12} />
                          {gestionnaire.role}
                        </span>
                        <p className="text-xs text-slate-500">{gestionnaire.departement}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {gestionnaire.permissions.slice(0, 3).map((permission, idx) => (
                          <span key={idx} className="inline-block px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-100">
                            {permission}
                          </span>
                        ))}
                        {gestionnaire.permissions.length > 3 && (
                          <span className="inline-block px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-200">
                            +{gestionnaire.permissions.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="text-xs text-slate-600">{gestionnaire.derniereConnexion}</span>
                        </div>
                        <p className="text-xs text-slate-500">{gestionnaire.actionsRecentes} actions ce mois</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatutColor(gestionnaire.statut)}`}>
                        {gestionnaire.statut === 'Actif' ? (
                          <CheckCircle size={14} className="text-emerald-600" />
                        ) : (
                          <Clock size={14} className="text-slate-600" />
                        )}
                        {gestionnaire.statut}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link href="/dashboard/admin/gestionnaires/id" className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <Eye size={16} />
                        </Link>
                        <Link href="/dashboard/admin/gestionnaires/id/edit" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit size={16} />
                        </Link>
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
              Affichage de <span className="font-semibold">1-6</span> sur <span className="font-semibold">24</span> gestionnaires
            </p>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                Précédent
              </button>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium">1</button>
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