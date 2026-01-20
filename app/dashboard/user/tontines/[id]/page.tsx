'use client';

import { useState } from 'react';
import { 
  ArrowLeft,    
  Users, 
  Calendar, 
  TrendingUp, 
  Clock,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Eye,
  Download,
  Send,
  MoreVertical,
  UserPlus,
  Edit,
  Trash2,
  ChevronRight
} from 'lucide-react';

// Types basés sur votre schéma Prisma
type Frequence = 'HEBDOMADAIRE' | 'MENSUEL';
type StatutTontine = 'ACTIVE' | 'TERMINEE' | 'SUSPENDUE';

interface TontineMembre {
  id: number;
  nom: string;
  prenom: string;
  photo?: string;
  ordreTirage?: number;
  dateEntree: Date;
  dateSortie?: Date;
  montantCotise: number;
  statutPaiement: 'A_JOUR' | 'EN_RETARD' | 'COMPLET';
}

interface Tontine {
  id: number;
  nom: string;
  description?: string;
  montantCycle: number;
  frequence: Frequence;
  statut: StatutTontine;
  dateDebut: Date;
  dateFin?: Date;
  membres: TontineMembre[];
  montantTotal: number;
  prochainTirage?: Date;
  dernierTirage?: {
    date: Date;
    beneficiaire: string;
    montant: number;
  };
}

// Données d'exemple (à remplacer par vos vraies données)
const tontineData: Tontine = {
  id: 1,
  nom: "Tontine Solidarité",
  description: "Entraide communautaire pour soutenir les membres dans leurs projets personnels et professionnels",
  montantCycle: 1000,
  frequence: "MENSUEL",
  statut: "ACTIVE",
  dateDebut: new Date('2024-06-01'),
  montantTotal: 12000,
  prochainTirage: new Date('2024-12-01'),
  dernierTirage: {
    date: new Date('2024-11-01'),
    beneficiaire: 'Marie Kouassi',
    montant: 1000
  },
  membres: [
    {
      id: 1,
      nom: 'Doe',
      prenom: 'John',
      photo: undefined,
      ordreTirage: 5,
      dateEntree: new Date('2024-06-01'),
      montantCotise: 800,
      statutPaiement: 'A_JOUR'
    },
    {
      id: 2,
      nom: 'Kouassi',
      prenom: 'Marie',
      photo: undefined,
      ordreTirage: 1,
      dateEntree: new Date('2024-06-01'),
      montantCotise: 1000,
      statutPaiement: 'COMPLET'
    },
    {
      id: 3,
      nom: 'Traoré',
      prenom: 'Ibrahim',
      photo: undefined,
      ordreTirage: 3,
      dateEntree: new Date('2024-06-01'),
      montantCotise: 900,
      statutPaiement: 'A_JOUR'
    },
    {
      id: 4,
      nom: 'N\'Guessan',
      prenom: 'Aya',
      photo: undefined,
      ordreTirage: 2,
      dateEntree: new Date('2024-07-01'),
      montantCotise: 650,
      statutPaiement: 'EN_RETARD'
    },
  ]
};

export default function TontineDetailsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'history'>('overview');
  const [showMenu, setShowMenu] = useState(false);

  const getStatutBadge = (statut: StatutTontine) => {
    const styles = {
      ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      TERMINEE: 'bg-slate-100 text-slate-700 border-slate-200',
      SUSPENDUE: 'bg-orange-50 text-orange-700 border-orange-200'
    };
    return styles[statut];
  };

  const getPaymentStatusBadge = (statut: string) => {
    const styles = {
      'A_JOUR': 'bg-blue-50 text-blue-700',
      'EN_RETARD': 'bg-red-50 text-red-700',
      'COMPLET': 'bg-emerald-50 text-emerald-700'
    };
    const labels = {
      'A_JOUR': 'À jour',
      'EN_RETARD': 'En retard',
      'COMPLET': 'Complet'
    };
    return { style: styles[statut as keyof typeof styles], label: labels[statut as keyof typeof labels] };
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('fr-FR')} €`;
  };

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
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 text-slate-700 transition-colors">
                    <Edit className="w-4 h-4" />
                    <span className="text-sm font-medium">Modifier la tontine</span>
                  </button>
                  <button className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 text-slate-700 transition-colors">
                    <UserPlus className="w-4 h-4" />
                    <span className="text-sm font-medium">Ajouter un membre</span>
                  </button>
                  <button className="w-full px-4 py-2.5 text-left hover:bg-red-50 flex items-center gap-3 text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Supprimer</span>
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
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {tontineData.nom}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatutBadge(tontineData.statut)} bg-white/90`}>
                    {tontineData.statut}
                  </span>
                </div>
                <p className="text-indigo-100 text-lg max-w-2xl leading-relaxed">
                  {tontineData.description}
                </p>
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
                  {formatCurrency(tontineData.montantCycle)}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Clock className="w-5 h-5" />
                  </div>
                  <p className="text-indigo-100 text-sm font-medium">Fréquence</p>
                </div>
                <p className="text-2xl md:text-3xl font-bold">
                  {tontineData.frequence}
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
                  {tontineData.membres.length}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <p className="text-indigo-100 text-sm font-medium">Total collecté</p>
                </div>
                <p className="text-2xl md:text-3xl font-bold">
                  {formatCurrency(tontineData.montantTotal)}
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
              Membres
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Historique
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Prochain Tirage */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200/60">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">Prochain tirage</h3>
                    <p className="text-sm text-slate-600">Planifié automatiquement</p>
                  </div>
                  <div className="p-3 bg-amber-100 rounded-xl">
                    <Calendar className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-slate-900">
                    {tontineData.prochainTirage ? formatDate(tontineData.prochainTirage) : 'Non défini'}
                  </span>
                  <span className="text-sm text-slate-500">dans 15 jours</span>
                </div>
                <button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                  <Send className="w-5 h-5" />
                  Effectuer le tirage maintenant
                </button>
              </div>

              {/* Dernier Tirage */}
              {tontineData.dernierTirage && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    Dernier tirage effectué
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Date</span>
                      <span className="font-semibold text-slate-900">
                        {formatDate(tontineData.dernierTirage.date)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Bénéficiaire</span>
                      <span className="font-semibold text-slate-900">
                        {tontineData.dernierTirage.beneficiaire}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Montant versé</span>
                      <span className="font-bold text-emerald-600 text-lg">
                        {formatCurrency(tontineData.dernierTirage.montant)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Progression */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Progression de la tontine</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-slate-600">Collecte actuelle</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(tontineData.montantTotal)} / {formatCurrency(tontineData.montantCycle * tontineData.membres.length)}
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${(tontineData.montantTotal / (tontineData.montantCycle * tontineData.membres.length)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Début</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDate(tontineData.dateDebut)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Durée</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {tontineData.membres.length} mois
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Fin estimée</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {tontineData.dateFin ? formatDate(tontineData.dateFin) : 'Mai 2025'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Statistiques */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Statistiques</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-sm text-emerald-700 mb-1">Membres à jour</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      {tontineData.membres.filter(m => m.statutPaiement !== 'EN_RETARD').length} / {tontineData.membres.length}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-sm text-blue-700 mb-1">Taux de participation</p>
                    <p className="text-2xl font-bold text-blue-900">95%</p>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <p className="text-sm text-purple-700 mb-1">Montant moyen cotisé</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {formatCurrency(tontineData.montantTotal / tontineData.membres.length)}
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
                      Exporter les données
                    </span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  
                  <button className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-between group">
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Envoyer un rappel
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
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Liste des membres</h3>
                <p className="text-sm text-slate-500 mt-1">{tontineData.membres.length} participants actifs</p>
              </div>
              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Ajouter un membre
              </button>
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
                      Montant cotisé
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Date d&apos;entrée
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tontineData.membres.map((membre, index) => {
                    const paymentStatus = getPaymentStatusBadge(membre.statutPaiement);
                    return (
                      <tr key={membre.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                              {membre.prenom[0]}{membre.nom[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">
                                {membre.prenom} {membre.nom}
                              </p>
                              <p className="text-xs text-slate-500">ID: {membre.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                            #{membre.ordreTirage || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">{formatCurrency(membre.montantCotise)}</p>
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                              <div 
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${(membre.montantCotise / tontineData.montantCycle) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${paymentStatus.style}`}>
                            {paymentStatus.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600">{formatDate(membre.dateEntree)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                            <MoreVertical className="w-4 h-4 text-slate-600" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Historique des tirages</h3>
              <p className="text-sm text-slate-500 mt-1">Tous les tirages effectués</p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {/* Timeline items */}
                {[
                  { date: new Date('2024-11-01'), beneficiaire: 'Marie Kouassi', montant: 1000, ordre: 1 },
                  { date: new Date('2024-10-01'), beneficiaire: 'Aya N\'Guessan', montant: 1000, ordre: 2 },
                  { date: new Date('2024-09-01'), beneficiaire: 'Ibrahim Traoré', montant: 1000, ordre: 3 },
                ].map((tirage, index) => (
                  <div key={index} className="flex gap-4 items-start relative pb-8 last:pb-0">
                    {/* Timeline line */}
                    {index !== 2 && (
                      <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-slate-200"></div>
                    )}
                    
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 relative z-10">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-slate-900">{tirage.beneficiaire}</p>
                          <p className="text-sm text-slate-600">Tirage #{tirage.ordre}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600 text-lg">
                            {formatCurrency(tirage.montant)}
                          </p>
                          <p className="text-xs text-slate-500">{formatDate(tirage.date)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}