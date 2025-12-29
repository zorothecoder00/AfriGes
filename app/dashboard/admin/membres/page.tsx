"use client";

import React, { useState } from 'react';
import { Search, Filter, Download, Plus, MoreVertical, Mail, Phone, MapPin, Edit, Trash2, Eye, UserCheck, UserX } from 'lucide-react';
import { MemberStatus } from '@prisma/client'

export default function MembresPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('tous');

  // Données de simulation
  const membres = [
    {  
      id: 1,
      nom: 'Kouassi Adjoua',
      email: 'k.adjoua@email.com',
      telephone: '+225 07 XX XX XX XX',
      ville: 'Abidjan',
      statut: MemberStatus.ACTIF,
      tontines: 3,
      cotisations: '€450',
      dateInscription: '15 Jan 2024',
      avatar: 'KA'
    },
    {
      id: 2,
      nom: 'Mensah Kofi',
      email: 'm.kofi@email.com',
      telephone: '+228 90 XX XX XX XX',
      ville: 'Lomé',
      statut: MemberStatus.ACTIF,
      tontines: 2,
      cotisations: '€320',
      dateInscription: '22 Jan 2024',
      avatar: 'MK'
    },
    {
      id: 3,
      nom: 'Diallo Fatoumata',
      email: 'f.diallo@email.com',
      telephone: '+221 77 XXX XX XX',
      ville: 'Dakar',
      statut: MemberStatus.INACTIF,
      tontines: 1,
      cotisations: '€150',
      dateInscription: '03 Fév 2024',
      avatar: 'DF'
    },
    {
      id: 4,
      nom: 'Nkrumah Akosua',
      email: 'a.nkrumah@email.com',
      telephone: '+233 24 XXX XXXX',
      ville: 'Accra',
      statut: MemberStatus.ACTIF,
      tontines: 4,
      cotisations: '€780',
      dateInscription: '10 Fév 2024',
      avatar: 'NA'
    },
    {
      id: 5,
      nom: 'Traoré Ibrahim',
      email: 'i.traore@email.com',
      telephone: '+223 76 XX XX XX',
      ville: 'Bamako',
      statut: MemberStatus.ACTIF,
      tontines: 2,
      cotisations: '€290',
      dateInscription: '18 Fév 2024',
      avatar: 'TI'
    },
    {
      id: 6,
      nom: 'Bamba Marie',
      email: 'm.bamba@email.com',
      telephone: '+225 05 XX XX XX XX',
      ville: 'Yamoussoukro',
      statut: MemberStatus.ACTIF,
      tontines: 3,
      cotisations: '€520',
      dateInscription: '25 Fév 2024',
      avatar: 'BM'
    },
    {
      id: 7,
      nom: 'Sow Amadou',
      email: 'a.sow@email.com',
      telephone: '+221 78 XXX XX XX',
      ville: 'Dakar',
      statut: MemberStatus.SUSPENDU,
      tontines: 1,
      cotisations: '€100',
      dateInscription: '05 Mar 2024',
      avatar: 'SA'
    },
    {
      id: 8,
      nom: 'Osei Kwame',
      email: 'k.osei@email.com',
      telephone: '+233 20 XXX XXXX',
      ville: 'Kumasi',
      statut: MemberStatus.ACTIF,
      tontines: 5,
      cotisations: '€920',
      dateInscription: '12 Mar 2024',
      avatar: 'OK'
    },
  ];

  const stats = [
    { label: 'Total Membres', value: '1,847', change: '+12%', color: 'bg-blue-500' },
    { label: 'Membres Actifs', value: '1,653', change: '+8%', color: 'bg-emerald-500' },
    { label: 'Nouveaux ce mois', value: '124', change: '+23%', color: 'bg-purple-500' },
    { label: 'Taux de rétention', value: '94.5%', change: '+2%', color: 'bg-amber-500' },
  ];

  const getStatusColor = (statut: MemberStatus) => {
    switch (statut) {
      case MemberStatus.ACTIF:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case MemberStatus.INACTIF:
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case MemberStatus.SUSPENDU:
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Membres</h1>
            <p className="text-slate-500">Gérez tous les membres de votre communauté AfriSime</p>
          </div>
          <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
            <Plus size={20} />
            Ajouter un membre
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-5">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-600 text-sm font-medium">{stat.label}</span>
                <span className="text-emerald-600 text-xs font-semibold bg-emerald-50 px-2 py-1 rounded-lg">
                  {stat.change}
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un membre par nom, email ou téléphone..."
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
              <option value="inactif">Inactifs</option>
              <option value="suspendu">Suspendus</option>
            </select>
            <button className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2 font-medium">
              <Filter size={18} />
              Filtres
            </button>
            <button className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2 font-medium">
              <Download size={18} />
              Exporter
            </button>
          </div>
        </div>

        {/* Members Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Membre
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Localisation
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Tontines
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Cotisations
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Inscription
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {membres.map((membre) => (
                  <tr key={membre.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                          {membre.avatar}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{membre.nom}</p>
                          <p className="text-sm text-slate-500">{membre.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone size={14} className="text-slate-400" />
                          {membre.telephone}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail size={14} className="text-slate-400" />
                          {membre.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={14} className="text-slate-400" />
                        {membre.ville}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(membre.statut)}`}>
                        {membre.statut}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-800 font-semibold">{membre.tontines}</span>
                      <span className="text-slate-500 text-sm ml-1">actives</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-800 font-semibold">{membre.cotisations}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{membre.dateInscription}</span>
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Affichage de <span className="font-semibold">1-8</span> sur <span className="font-semibold">1,847</span> membres
            </p>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                Précédent
              </button>
              <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">
                1
              </button>
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                2
              </button>
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                3
              </button>
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                Suivant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}