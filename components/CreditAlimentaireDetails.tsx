'use client'

import { useState, useEffect } from 'react';   

interface CreditAlimentaire {  
  id: number;
  plafond: number;
  montantUtilise: number;
  montantRestant: number;
  statut: string;
  source: string;
  sourceId: number;
  dateAttribution: string;
  dateExpiration?: string | null;
}

interface ClientInfo {
  id: number;
  prenom: string;
  nom: string;
  telephone: string;
}

interface Produit {
  id: number;
  nom: string;
  description?: string;
}

interface CreditAlimentaireTransaction {
  id: number;
  type: string;
  montant: number;
  description?: string;
  createdAt: string;
}

interface VenteCreditAlimentaire {
  id: number;
  quantite: number;
  prixUnitaire: number;
  createdAt: string;
}
  
interface CreditAlimentaireWithRelations extends CreditAlimentaire {
  client: ClientInfo | null;
  transactions: CreditAlimentaireTransaction[];
  ventes: (VenteCreditAlimentaire & {
    produit: Produit;
  })[];
}

interface CreditAlimentaireDetailsProps {
  credit?: CreditAlimentaireWithRelations;
  onClose: () => void;
  onEdit?: () => void;
}

export default function CreditAlimentaireDetails({ credit, onClose, onEdit }: CreditAlimentaireDetailsProps) {

  const [activeTab, setActiveTab] = useState<'info' | 'transactions' | 'ventes'>('info');

  if (!credit) {
    return <div>Chargement...</div>;
  }

  const tauxUtilisation =
    (Number(credit.montantUtilise) / Number(credit.plafond)) * 100;

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(Number(amount));
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(date));
  };

  const getStatutBadge = (statut: string) => {
    const styles = {
      ACTIF: 'bg-green-100 text-green-700',
      EPUISE: 'bg-red-100 text-red-700',
      EXPIRE: 'bg-gray-100 text-gray-700'
    };
    return styles[statut as keyof typeof styles] || 'bg-gray-100 text-gray-700';
  };

  const getSourceLabel = (source: string) => {
    return source === 'COTISATION' ? 'Cotisation' : 'Tontine';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Détails du crédit alimentaire</h2>
            <p className="text-sm text-gray-500 mt-1">
              {credit.client?.prenom} {credit.client?.nom}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Modifier
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 px-6 py-4 bg-gray-50">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500">Plafond</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(credit.plafond)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500">Utilisé</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(credit.montantUtilise)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500">Disponible</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(credit.montantRestant)}</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatutBadge(credit.statut)}`}>
                {credit.statut}
              </span>
            </div>
            <p className="text-xs text-gray-500">Progression</p>
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold">{tauxUtilisation.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(tauxUtilisation, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex px-6 gap-8">
            <button
              onClick={() => setActiveTab('info')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'info'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Informations
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'transactions'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Transactions ({credit.transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('ventes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'ventes'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Achats ({credit.ventes.length})
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 400px)' }}>
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bénéficiaire</label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-green-700">
                        {credit.client?.prenom?.[0]}{credit.client?.nom?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{credit.client?.prenom} {credit.client?.nom}</p>
                      <p className="text-sm text-gray-500">{credit.client?.telephone}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <p className="text-gray-900">{getSourceLabel(credit.source)}</p>
                  <p className="text-sm text-gray-500">ID: {credit.sourceId}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date d&apos;attribution</label>
                  <p className="text-gray-900">{formatDate(credit.dateAttribution)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date d&apos;expiration</label>
                  <p className="text-gray-900">
                    {credit.dateExpiration ? formatDate(credit.dateExpiration) : 'Non définie'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-3">
              {credit.transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Aucune transaction</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {credit.transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          transaction.type === 'UTILISATION' ? 'bg-orange-100' : 
                          transaction.type === 'ANNULATION' ? 'bg-red-100' : 'bg-blue-100'
                        }`}>
                          <svg className={`w-5 h-5 ${
                            transaction.type === 'UTILISATION' ? 'text-orange-600' : 
                            transaction.type === 'ANNULATION' ? 'text-red-600' : 'text-blue-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {transaction.type === 'UTILISATION' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            )}
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{transaction.type}</p>
                          {transaction.description && (
                            <p className="text-sm text-gray-500">{transaction.description}</p>
                          )}
                          <p className="text-xs text-gray-400">{formatDate(transaction.createdAt)}</p>
                        </div>
                      </div>
                      <p className={`font-semibold ${
                        transaction.type === 'UTILISATION' ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {transaction.type === 'UTILISATION' ? '-' : '+'}{formatCurrency(transaction.montant)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'ventes' && (
            <div className="space-y-3">
              {credit.ventes.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Aucun achat</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix unitaire</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      </tr>   
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {credit.ventes.map((vente) => (
                        <tr key={vente.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{vente.produit.nom}</p>
                            {vente.produit.description && (
                              <p className="text-sm text-gray-500">{vente.produit.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-900">{vente.quantite}</td>
                          <td className="px-4 py-3 text-gray-900">{formatCurrency(vente.prixUnitaire)}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {formatCurrency(Number(vente.prixUnitaire) * vente.quantite)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(vente.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}