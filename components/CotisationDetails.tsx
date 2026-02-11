'use client'

import React from 'react';
import { X, User, Calendar, Euro, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface CotisationDetailsProps {
  cotisation: {
    id: number;
    membre: {
      nom: string;
      prenom: string;
      email: string;
      telephone?: string;  
      photo?: string;
    };
    montant: number;
    periode: 'MENSUEL' | 'ANNUEL';
    datePaiement?: string | null;
    dateExpiration: string;
    statut: 'EN_ATTENTE' | 'PAYEE' | 'EXPIREE';
    createdAt: string;
    updatedAt: string;
  };
  onClose: () => void;
}

const CotisationDetails: React.FC<CotisationDetailsProps> = ({ cotisation, onClose }) => {
  const getStatutStyle = (statut: string) => {
    switch (statut) {
      case 'PAYEE':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'EN_ATTENTE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'EXPIREE':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatutIcon = (statut: string) => {
    switch (statut) {
      case 'PAYEE':
        return <CheckCircle className="w-5 h-5" />;
      case 'EN_ATTENTE':
        return <Clock className="w-5 h-5" />;
      case 'EXPIREE':
        return <XCircle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Détails de la cotisation</h2>
            <p className="text-sm text-gray-500 mt-1">Référence #{cotisation.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Statut Card */}
          <div className={`p-4 rounded-xl border-2 ${getStatutStyle(cotisation.statut)} flex items-center gap-3`}>
            {getStatutIcon(cotisation.statut)}
            <div>
              <p className="text-sm font-medium">Statut de la cotisation</p>
              <p className="text-lg font-bold">
                {cotisation.statut === 'PAYEE' && 'Payée'}
                {cotisation.statut === 'EN_ATTENTE' && 'En attente'}
                {cotisation.statut === 'EXPIREE' && 'Expirée'}
              </p>
            </div>
          </div>

          {/* Informations du membre */}
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Informations du membre</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {cotisation.membre.photo ? (
                  <img 
                    src={cotisation.membre.photo} 
                    alt={`${cotisation.membre.prenom} ${cotisation.membre.nom}`}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                    {cotisation.membre.prenom[0]}{cotisation.membre.nom[0]}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">
                    {cotisation.membre.prenom} {cotisation.membre.nom}
                  </p>
                  <p className="text-sm text-gray-500">{cotisation.membre.email}</p>
                </div>
              </div>
              {cotisation.membre.telephone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">Téléphone:</span>
                  <span>{cotisation.membre.telephone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Informations financières */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Euro className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Informations financières</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Montant</p>
                <p className="text-2xl font-bold text-gray-900">€{cotisation.montant.toLocaleString('fr-FR')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Période</p>
                <p className="text-lg font-semibold text-gray-900">
                  {cotisation.periode === 'MENSUEL' ? 'Mensuel' : 'Annuel'}
                </p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Dates importantes</h3>
            </div>
            
            <div className="space-y-3">
              {cotisation.datePaiement && (
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Date de paiement</span>
                  <span className="text-sm font-semibold text-gray-900">{formatDate(cotisation.datePaiement)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Date d&apos;expiration</span>
                <span className="text-sm font-semibold text-gray-900">{formatDate(cotisation.dateExpiration)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Créée le</span>
                <span className="text-sm text-gray-700">{formatDateTime(cotisation.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-gray-600">Dernière modification</span>
                <span className="text-sm text-gray-700">{formatDateTime(cotisation.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default CotisationDetails;