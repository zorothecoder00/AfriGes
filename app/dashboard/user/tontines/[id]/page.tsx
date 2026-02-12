'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Calendar,
  TrendingUp,
  Clock,
  CreditCard,
  CheckCircle,
  Eye,
  Download,
  Send,
  MoreVertical,
  ChevronRight
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStatusLabel } from '@/lib/status';

// ============================================================================
// TYPES
// ============================================================================

interface TontineMembre {
  id: number;
  ordreTirage: number | null;
  dateEntree: string;
  dateSortie: string | null;
  member: {
    id: number;
    nom: string;
    prenom: string;
    photo: string | null;
  };
}

interface Tontine {
  id: number;
  nom: string;
  description: string | null;
  montantCycle: string;
  frequence: string;
  statut: string;
  dateDebut: string;
  dateFin: string | null;
  membres: TontineMembre[];
}

interface TontineResponse {
  data: Tontine;
}

// ============================================================================
// MAIN
// ============================================================================

export default function TontineDetailsPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: response, loading, error, refetch } = useApi<TontineResponse>(`/api/user/tontines/${id}`);
  const tontine = response?.data;

  const [activeTab, setActiveTab] = useState<'overview' | 'members'>('overview');
  const [showMenu, setShowMenu] = useState(false);

  const getStatutBadge = (statut: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      TERMINEE: 'bg-slate-100 text-slate-700 border-slate-200',
      SUSPENDUE: 'bg-orange-50 text-orange-700 border-orange-200',
    };
    return styles[statut] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  };

  // Loading
  if (loading && !tontine) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement de la tontine...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error && !tontine) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  if (!tontine) return null;

  const montantCycle = Number(tontine.montantCycle);
  const totalMembres = tontine.membres.length;
  const montantTotal = montantCycle * totalMembres;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Navigation Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-slate-700 hover:text-indigo-600 transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Retour aux tontines</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-slate-600" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2">
                  <button className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 text-slate-700 transition-colors">
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium">Exporter les donnees</span>
                  </button>
                  <button className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 text-slate-700 transition-colors">
                    <Send className="w-4 h-4" />
                    <span className="text-sm font-medium">Envoyer un rappel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-8 md:p-10 text-white shadow-xl shadow-indigo-200/50 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl"></div>

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {tontine.nom}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatutBadge(tontine.statut)} bg-white/90`}>
                    {getStatusLabel(tontine.statut)}
                  </span>
                </div>
                {tontine.description && (
                  <p className="text-indigo-100 text-lg max-w-2xl leading-relaxed">
                    {tontine.description}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <p className="text-indigo-100 text-sm font-medium">Montant du cycle</p>
                </div>
                <p className="text-2xl md:text-3xl font-bold">
                  {formatCurrency(montantCycle)}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Clock className="w-5 h-5" />
                  </div>
                  <p className="text-indigo-100 text-sm font-medium">Frequence</p>
                </div>
                <p className="text-2xl md:text-3xl font-bold">
                  {getStatusLabel(tontine.frequence)}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                  <p className="text-indigo-100 text-sm font-medium">Membres</p>
                </div>
                <p className="text-2xl md:text-3xl font-bold">
                  {totalMembres}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <p className="text-indigo-100 text-sm font-medium">Total par cycle</p>
                </div>
                <p className="text-2xl md:text-3xl font-bold">
                  {formatCurrency(montantTotal)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6 p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Vue d&apos;ensemble
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                activeTab === 'members'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Membres ({totalMembres})
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Infos */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Informations</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Debut</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDate(tontine.dateDebut)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Duree estimee</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {totalMembres} {tontine.frequence === 'MENSUEL' ? 'mois' : 'semaines'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Fin</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {tontine.dateFin ? formatDate(tontine.dateFin) : 'Non definie'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Récapitulatif des membres rapide */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Participants
                </h3>
                <div className="space-y-3">
                  {tontine.membres.slice(0, 5).map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                        {m.member.prenom[0]}{m.member.nom[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 text-sm">{m.member.prenom} {m.member.nom}</p>
                        <p className="text-xs text-slate-500">
                          Ordre: #{m.ordreTirage ?? '-'} &bull; Depuis le {formatDate(m.dateEntree)}
                        </p>
                      </div>
                      {m.dateSortie && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Sorti</span>
                      )}
                    </div>
                  ))}
                  {totalMembres > 5 && (
                    <button
                      onClick={() => setActiveTab('members')}
                      className="w-full text-center text-indigo-600 font-medium text-sm py-2 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      Voir les {totalMembres} membres
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Statistiques */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Statistiques</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-sm text-emerald-700 mb-1">Membres actifs</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      {tontine.membres.filter(m => !m.dateSortie).length} / {totalMembres}
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-sm text-blue-700 mb-1">Montant par cycle</p>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(montantCycle)}</p>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <p className="text-sm text-purple-700 mb-1">Total collecte par cycle</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {formatCurrency(montantTotal)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions rapides */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Actions rapides</h3>
                <div className="space-y-3">
                  <button className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-between group">
                    <span className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Exporter les donnees
                    </span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-between group">
                    <span className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Voir le rapport
                    </span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Liste des membres</h3>
              <p className="text-sm text-slate-500 mt-1">{totalMembres} participants</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Membre
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Ordre de tirage
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Date d&apos;entree
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tontine.membres.map((membre) => (
                    <tr key={membre.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                            {membre.member.prenom[0]}{membre.member.nom[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {membre.member.prenom} {membre.member.nom}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                          #{membre.ordreTirage ?? '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{formatDate(membre.dateEntree)}</span>
                      </td>
                      <td className="px-6 py-4">
                        {membre.dateSortie ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                            Sorti le {formatDate(membre.dateSortie)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Actif
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
