'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStatusLabel, getStatusStyle } from '@/lib/status';

interface Member {
  id: number;
  uuid: string;
  nom: string;
  prenom: string;
  email: string;
  photo?: string;
  role?: string;
  telephone?: string;
  adresse?: string;
  etat: string;
  dateAdhesion: string;
  wallet?: {
    soldeGeneral: string;
    soldeTontine: string;
    soldeCredit: string;
  };
}

interface MemberResponse {
  data: Member;
}

type TabId = 'overview' | 'tontines' | 'credits' | 'cotisations';

export default function MemberDetails({ memberId }: { memberId: string }) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { data: response, loading, error, refetch } = useApi<MemberResponse>(`/api/admin/membres/${memberId}`);
  const member = response?.data;

  if (loading && !member) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement du membre...</p>
        </div>
      </div>
    );
  }

  if (error && !member) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  if (!member) return null;

  const getInitials = (nom: string, prenom: string) => `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: "Vue d'ensemble" },
  ];

  const soldeGeneral = Number(member.wallet?.soldeGeneral ?? 0);
  const soldeTontine = Number(member.wallet?.soldeTontine ?? 0);
  const soldeCredit = Number(member.wallet?.soldeCredit ?? 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/dashboard/admin/membres" className="text-gray-500 hover:text-gray-700 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Profil du membre</h1>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                {getInitials(member.nom, member.prenom)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{member.prenom} {member.nom}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <span>{member.email}</span>
                  {member.telephone && <span>{member.telephone}</span>}
                  {member.adresse && <span>{member.adresse}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusStyle(member.etat)}`}>
                    {getStatusLabel(member.etat)}
                  </span>
                  <span className="text-sm text-gray-500">Membre depuis {formatDate(member.dateAdhesion)}</span>
                </div>
              </div>
            </div>

            <Link href={`/dashboard/admin/membres/${member.id}/edit`} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
              Modifier
            </Link>
          </div>
        </div>
      </div>

      {/* Wallet Summary */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <span className="text-sm font-medium text-gray-600">Solde General</span>
            <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(soldeGeneral)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <span className="text-sm font-medium text-gray-600">Solde Tontine</span>
            <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(soldeTontine)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <span className="text-sm font-medium text-gray-600">Solde Credit</span>
            <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(soldeCredit)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex gap-8 px-6">
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-4">Informations personnelles</h3>
                    <dl className="space-y-3">
                      <div><dt className="text-sm text-gray-500">Nom complet</dt><dd className="mt-1 text-sm font-medium text-gray-900">{member.prenom} {member.nom}</dd></div>
                      <div><dt className="text-sm text-gray-500">Email</dt><dd className="mt-1 text-sm font-medium text-gray-900">{member.email}</dd></div>
                      <div><dt className="text-sm text-gray-500">Telephone</dt><dd className="mt-1 text-sm font-medium text-gray-900">{member.telephone || 'Non renseigne'}</dd></div>
                      <div><dt className="text-sm text-gray-500">Adresse</dt><dd className="mt-1 text-sm font-medium text-gray-900">{member.adresse || 'Non renseignee'}</dd></div>
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-4">Informations du compte</h3>
                    <dl className="space-y-3">
                      <div><dt className="text-sm text-gray-500">Role</dt><dd className="mt-1 text-sm font-medium text-gray-900">{getStatusLabel(member.role || 'USER')}</dd></div>
                      <div><dt className="text-sm text-gray-500">Statut</dt><dd className="mt-1"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(member.etat)}`}>{getStatusLabel(member.etat)}</span></dd></div>
                      <div><dt className="text-sm text-gray-500">Date d&apos;adhesion</dt><dd className="mt-1 text-sm font-medium text-gray-900">{formatDate(member.dateAdhesion)}</dd></div>
                      <div><dt className="text-sm text-gray-500">UUID</dt><dd className="mt-1 text-sm font-mono text-gray-900">{member.uuid}</dd></div>
                    </dl>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Statistiques rapides</h3>
                  <div className="grid grid-cols-4 gap-4">               
                    <div className="bg-gray-50 rounded-lg p-4"><p className="text-2xl font-bold text-emerald-600">{formatCurrency(soldeGeneral + soldeTontine + soldeCredit)}</p><p className="text-sm text-gray-600 mt-1">Solde total</p>
                    </div>
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
