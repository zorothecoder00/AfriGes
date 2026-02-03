'use client';

import { useState } from 'react';
import Link from 'next/link';  

// Types basés sur le schéma Prisma
interface Member {
  id: number;
  uuid: string;
  nom: string;
  prenom: string;
  email: string;
  photo?: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  telephone?: string;
  adresse?: string;
  etat: 'ACTIF' | 'INACTIF' | 'SUSPENDU';
  dateAdhesion: string;
  wallet?: {
    soldeGeneral: number;
    soldeTontine: number;
    soldeCredit: number;
  };
  tontines: Array<{
    id: number;
    tontine: {
      nom: string;
      montantCycle: number;
    };
  }>;
  cotisations: Array<{
    id: number;
    montant: number;
    periode: 'MENSUEL' | 'ANNUEL';
    statut: 'EN_ATTENTE' | 'PAYEE' | 'EXPIREE';
    dateExpiration: string;
  }>;
  credits: Array<{
    id: number;
    montant: number;
    montantRestant: number;
    statut: string;
    dateDemande: string;
  }>;  
}

type TabId =
  | 'overview'
  | 'tontines'
  | 'credits'
  | 'cotisations'
  | 'transactions';

export default function MemberDetails() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Données exemple - à remplacer par des données réelles
  const member: Member = {
    id: 1,
    uuid: 'abc-123-def',
    nom: 'Kouassi',
    prenom: 'Adjoua',
    email: 'k.adjoua@email.com',
    photo: undefined,
    role: 'USER',
    telephone: '+225 07 XX XX XX XX',
    adresse: 'Abidjan, Cocody',
    etat: 'ACTIF',
    dateAdhesion: '2024-01-15',
    wallet: {
      soldeGeneral: 125000,
      soldeTontine: 45000,
      soldeCredit: 30000,
    },
    tontines: [
      {
        id: 1,
        tontine: {
          nom: 'Tontine des Commerçants',
          montantCycle: 50000,
        },
      },
      {
        id: 2,
        tontine: {
          nom: 'Solidarité Femmes',
          montantCycle: 30000,
        },
      },
    ],
    cotisations: [
      {
        id: 1,
        montant: 150,
        periode: 'MENSUEL',
        statut: 'PAYEE',
        dateExpiration: '2024-12-31',
      },
    ],
    credits: [
      {
        id: 1,
        montant: 500000,
        montantRestant: 200000,
        statut: 'REMBOURSE_PARTIEL',
        dateDemande: '2024-06-15',
      },
    ],
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: "Vue d&apos;ensemble", icon: '...' },
    { id: 'tontines', label: 'Tontines', icon: '...' },
    { id: 'credits', label: 'Crédits', icon: '...' },
    { id: 'cotisations', label: 'Cotisations', icon: '...' },
    { id: 'transactions', label: 'Transactions', icon: '...' },
  ];

  const getInitials = (nom: string, prenom: string) => {
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  };

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('fr-FR')}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatutBadgeClass = (statut: string) => {
    switch (statut) {
      case 'ACTIF':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'INACTIF':
        return 'bg-gray-50 text-gray-700 border border-gray-200';
      case 'SUSPENDU':
        return 'bg-red-50 text-red-700 border border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/membres"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Profil du membre
            </h1>
          </div>

          {/* Member Info Card */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                {getInitials(member.nom, member.prenom)}
              </div>

              {/* Info */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {member.prenom} {member.nom}
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span>{member.email}</span>
                  </div>
                  {member.telephone && (
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      <span>{member.telephone}</span>
                    </div>
                  )}
                  {member.adresse && (
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span>{member.adresse}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatutBadgeClass(
                      member.etat
                    )}`}
                  >
                    {member.etat}
                  </span>
                  <span className="text-sm text-gray-500">
                    Membre depuis {formatDate(member.dateAdhesion)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link
                href={`/membres/${member.id}/edit`}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Modifier
              </Link>
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Summary */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Solde Général
              </span>
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(member.wallet?.soldeGeneral || 0)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Solde Tontine
              </span>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(member.wallet?.soldeTontine || 0)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Solde Crédit
              </span>
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(member.wallet?.soldeCredit || 0)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex gap-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={tab.icon}
                    />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-4">
                      Informations personnelles
                    </h3>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm text-gray-500">Nom complet</dt>
                        <dd className="mt-1 text-sm font-medium text-gray-900">
                          {member.prenom} {member.nom}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Email</dt>
                        <dd className="mt-1 text-sm font-medium text-gray-900">
                          {member.email}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Téléphone</dt>
                        <dd className="mt-1 text-sm font-medium text-gray-900">
                          {member.telephone || 'Non renseigné'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Adresse</dt>
                        <dd className="mt-1 text-sm font-medium text-gray-900">
                          {member.adresse || 'Non renseignée'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-4">
                      Informations du compte
                    </h3>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm text-gray-500">Rôle</dt>
                        <dd className="mt-1 text-sm font-medium text-gray-900">
                          {member.role || 'USER'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Statut</dt>
                        <dd className="mt-1">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatutBadgeClass(
                              member.etat
                            )}`}
                          >
                            {member.etat}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Date d&apos;adhésion</dt>
                        <dd className="mt-1 text-sm font-medium text-gray-900">
                          {formatDate(member.dateAdhesion)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">UUID</dt>
                        <dd className="mt-1 text-sm font-mono text-gray-900">
                          {member.uuid}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-4">
                    Statistiques rapides
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-2xl font-bold text-gray-900">
                        {member.tontines.length}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Tontines actives
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-2xl font-bold text-gray-900">
                        {member.credits.length}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Crédits en cours
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-2xl font-bold text-gray-900">
                        {member.cotisations.filter((c) => c.statut === 'PAYEE').length}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Cotisations payées
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(
                          (member.wallet?.soldeGeneral || 0) +
                            (member.wallet?.soldeTontine || 0) +
                            (member.wallet?.soldeCredit || 0)
                        )}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Solde total</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tontines Tab */}
            {activeTab === 'tontines' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Tontines actives
                  </h3>
                  <button className="px-4 py-2 text-sm font-medium text-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors">
                    Ajouter à une tontine
                  </button>
                </div>
                <div className="space-y-3">
                  {member.tontines.map((tontine) => (
                    <div
                      key={tontine.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {tontine.tontine.nom}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Montant du cycle:{' '}
                            {formatCurrency(tontine.tontine.montantCycle)}
                          </p>
                        </div>
                        <button className="text-emerald-600 hover:text-emerald-700">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Credits Tab */}
            {activeTab === 'credits' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Historique des crédits
                  </h3>
                  <button className="px-4 py-2 text-sm font-medium text-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors">
                    Nouveau crédit
                  </button>
                </div>
                <div className="space-y-3">
                  {member.credits.map((credit) => (
                    <div
                      key={credit.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-gray-900">
                              Crédit #{credit.id}
                            </h4>
                            <span className="px-2 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full border border-orange-200">
                              {credit.statut.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Demandé le {formatDate(credit.dateDemande)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            {formatCurrency(credit.montant)}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Restant: {formatCurrency(credit.montantRestant)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 bg-gray-50 rounded-lg h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-lg transition-all"
                          style={{
                            width: `${
                              ((credit.montant - credit.montantRestant) /
                                credit.montant) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cotisations Tab */}
            {activeTab === 'cotisations' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Cotisations
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Période
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Statut
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Expiration
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {member.cotisations.map((cotisation) => (
                        <tr key={cotisation.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {cotisation.periode}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {formatCurrency(cotisation.montant)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                cotisation.statut === 'PAYEE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : cotisation.statut === 'EN_ATTENTE'
                                  ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {cotisation.statut}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(cotisation.dateExpiration)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Historique des transactions
                </h3>
                <div className="space-y-3">
                  <div className="text-center py-12">
                    <svg
                      className="w-16 h-16 text-gray-300 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <p className="text-gray-500">
                      Aucune transaction pour le moment
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 