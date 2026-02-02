'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Users, 
  Calendar, 
  Euro, 
  Clock, 
  MoreVertical,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

// Types basés sur votre schéma Prisma
interface TontineMembre {
  id: number;
  ordreTirage: number | null;
  dateEntree: string;
  dateSortie: string | null;
  member: {
    id: number;
    nom: string;
    prenom: string;
    email: string;
    photo: string | null;
    telephone: string | null;
  };
}

interface Tontine {
  id: number;
  nom: string;
  description: string | null;
  montantCycle: number;
  frequence: 'HEBDOMADAIRE' | 'MENSUEL';
  statut: 'ACTIVE' | 'TERMINEE' | 'SUSPENDUE';
  dateDebut: string;
  dateFin: string | null;
  membres: TontineMembre[];
  _count?: {
    membres: number;
  };
}

export default function TontineDetails() {
  // Données d'exemple - à remplacer par fetch réel
  const [tontine] = useState<Tontine>({
    id: 1,
    nom: "Tontine Solidarité",
    description: "Tontine de solidarité pour les membres actifs de la communauté",
    montantCycle: 12500,
    frequence: "MENSUEL",
    statut: "ACTIVE",
    dateDebut: "2024-01-15T00:00:00.000Z",
    dateFin: null,
    membres: [
      {
        id: 1,
        ordreTirage: 1,
        dateEntree: "2024-01-15T00:00:00.000Z",
        dateSortie: null,
        member: {
          id: 1,
          nom: "Kouassi",
          prenom: "Jean",
          email: "jean.kouassi@email.com",
          photo: null,
          telephone: "+228 90 12 34 56"
        }
      },
      {
        id: 2,
        ordreTirage: 2,
        dateEntree: "2024-01-15T00:00:00.000Z",
        dateSortie: null,
        member: {
          id: 2,
          nom: "Mensah",
          prenom: "Marie",
          email: "marie.mensah@email.com",
          photo: null,
          telephone: "+228 90 23 45 67"
        }
      },
      {
        id: 3,
        ordreTirage: 3,
        dateEntree: "2024-01-20T00:00:00.000Z",
        dateSortie: null,
        member: {
          id: 3,
          nom: "Agbodjan",
          prenom: "Paul",
          email: "paul.agbodjan@email.com",
          photo: null,
          telephone: "+228 90 34 56 78"
        }
      }
    ],
    _count: {
      membres: 45
    }
  });

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'TERMINEE':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'SUSPENDUE':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatutIcon = (statut: string) => {
    switch (statut) {
      case 'ACTIVE':
        return <CheckCircle className="w-4 h-4" />;
      case 'TERMINEE':
        return <XCircle className="w-4 h-4" />;
      case 'SUSPENDUE':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getCategoryColor = (nom: string) => {
    if (nom.toLowerCase().includes('solidarité') || nom.toLowerCase().includes('solidarite')) {
      return 'bg-emerald-500';
    } else if (nom.toLowerCase().includes('entrepreneuriat') || nom.toLowerCase().includes('entrepreneur')) {
      return 'bg-orange-500';
    } else if (nom.toLowerCase().includes('éducation') || nom.toLowerCase().includes('education')) {
      return 'bg-blue-500';
    }
    return 'bg-purple-500';
  };

  const totalCollecte = tontine.montantCycle * (tontine._count?.membres || 0);
  const progression = 75; // À calculer selon la logique métier

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/admin/tontines"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{tontine.nom}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Créée le {new Date(tontine.dateDebut).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${getStatutColor(tontine.statut)}`}>
                {getStatutIcon(tontine.statut)}
                {tontine.statut}
              </span>
              <Link
                href={`/dashboard/admin/tontines/${tontine.id}/edit`}
                className={`${getCategoryColor(tontine.nom)} text-white px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity`}
              >
                Gérer
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Carte principale avec progression */}
          <div className="lg:col-span-2">
            <div className={`${getCategoryColor(tontine.nom)} rounded-2xl p-8 text-white shadow-lg`}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-white/80 text-sm font-medium mb-1">
                    {tontine.nom.split(' ')[0]}
                  </div>
                  <h2 className="text-3xl font-bold">{tontine.nom}</h2>
                </div>
                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              {tontine.description && (
                <p className="text-white/90 mb-6 leading-relaxed">
                  {tontine.description}
                </p>
              )}

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/90 text-sm">Progression</span>
                  <span className="text-white font-bold text-lg">{progression}%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-white h-full rounded-full transition-all duration-500"
                    style={{ width: `${progression}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
                    <Users className="w-4 h-4" />
                    Membres
                  </div>
                  <div className="text-3xl font-bold">{tontine._count?.membres || 0}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
                    <Euro className="w-4 h-4" />
                    Total
                  </div>
                  <div className="text-3xl font-bold">€{totalCollecte.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Informations détaillées */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Informations détaillées</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Euro className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Contribution</p>
                      <p className="text-xl font-bold text-gray-900">€{tontine.montantCycle.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Fréquence</p>
                      <p className="text-xl font-bold text-gray-900">
                        {tontine.frequence === 'MENSUEL' ? 'Mensuelle' : 'Hebdomadaire'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Date de début</p>
                      <p className="text-xl font-bold text-gray-900">
                        {new Date(tontine.dateDebut).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Prochain tour</p>
                      <p className="text-xl font-bold text-gray-900">15 Jan 2025</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Liste des membres */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Membres ({tontine.membres.length})
              </h3>
              
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {tontine.membres.map((membre) => (
                  <div
                    key={membre.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {membre.member.prenom[0]}{membre.member.nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {membre.member.prenom} {membre.member.nom}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {membre.member.email}
                      </p>
                    </div>
                    {membre.ordreTirage && (
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-700">
                          #{membre.ordreTirage}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button className="w-full mt-4 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors">
                + Ajouter un membre
              </button>
            </div>

            {/* Statistiques rapides */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Statistiques</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Taux de participation</span>
                  <span className="font-bold text-gray-900">98%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Tours complétés</span>
                  <span className="font-bold text-gray-900">12/16</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Montant distribué</span>
                  <span className="font-bold text-emerald-600">€150,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}