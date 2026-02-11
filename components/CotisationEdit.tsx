'use client'

import React, { useState } from 'react';
import { X, Save, User, Euro, Calendar, Clock } from 'lucide-react';

export interface CotisationUpdatePayload {
  montant: number;  
  periode: 'MENSUEL' | 'ANNUEL';
  datePaiement: string | null;
  dateExpiration: string;
  statut: 'EN_ATTENTE' | 'PAYEE' | 'EXPIREE';
};


interface CotisationEditProps {
  cotisation: {
    id: number;
    membre: {
      nom: string;
      prenom: string;
      email: string;
      photo?: string;   
    };
    montant: number;
    periode: 'MENSUEL' | 'ANNUEL';
    datePaiement?: string | null;
    dateExpiration: string;
    statut: 'EN_ATTENTE' | 'PAYEE' | 'EXPIREE';
  };
  onClose: () => void;
  onSave: (updatedData: CotisationUpdatePayload) => void;
}

const CotisationEdit: React.FC<CotisationEditProps> = ({ cotisation, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    montant: cotisation.montant.toString(),
    periode: cotisation.periode,
    datePaiement: cotisation.datePaiement ? cotisation.datePaiement.split('T')[0] : '',
    dateExpiration: cotisation.dateExpiration.split('T')[0],
    statut: cotisation.statut,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.montant || parseFloat(formData.montant) <= 0) {
      newErrors.montant = 'Le montant doit être supérieur à 0';
    }

    if (!formData.dateExpiration) {
      newErrors.dateExpiration = 'La date d\'expiration est requise';
    }

    if (formData.datePaiement && new Date(formData.datePaiement) > new Date(formData.dateExpiration)) {
      newErrors.datePaiement = 'La date de paiement ne peut pas être après la date d\'expiration';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    const updatedData: CotisationUpdatePayload = {
      montant: parseFloat(formData.montant),
      periode: formData.periode,
      datePaiement: formData.datePaiement || null,
      dateExpiration: formData.dateExpiration,
      statut: formData.statut,
    };

    onSave(updatedData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Modifier la cotisation</h2>
            <p className="text-sm text-gray-500 mt-1">Référence #{cotisation.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Informations du membre (read-only) */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Membre concerné</h3>
              </div>
              
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
            </div>

            {/* Montant */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Euro className="w-4 h-4" />
                Montant
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="montant"
                  value={formData.montant}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${
                    errors.montant ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">€</span>
              </div>
              {errors.montant && (
                <p className="mt-1 text-sm text-red-600">{errors.montant}</p>
              )}
            </div>

            {/* Période */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4" />
                Période
              </label>
              <select
                name="periode"
                value={formData.periode}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              >
                <option value="MENSUEL">Mensuel</option>
                <option value="ANNUEL">Annuel</option>
              </select>
            </div>

            {/* Statut */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4" />
                Statut
              </label>
              <select
                name="statut"
                value={formData.statut}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              >
                <option value="EN_ATTENTE">En attente</option>
                <option value="PAYEE">Payée</option>
                <option value="EXPIREE">Expirée</option>
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4" />
                  Date de paiement
                </label>
                <input
                  type="date"
                  name="datePaiement"
                  value={formData.datePaiement}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${
                    errors.datePaiement ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.datePaiement && (
                  <p className="mt-1 text-sm text-red-600">{errors.datePaiement}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Laisser vide si non payée</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4" />
                  Date d&apos;expiration
                </label>   
                <input  
                  type="date"
                  name="dateExpiration"
                  value={formData.dateExpiration}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${
                    errors.dateExpiration ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.dateExpiration && (
                  <p className="mt-1 text-sm text-red-600">{errors.dateExpiration}</p>
                )}
              </div>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Information</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Les modifications seront immédiatement appliquées. Assurez-vous que toutes les informations sont correctes avant de sauvegarder.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Enregistrer les modifications
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CotisationEdit;