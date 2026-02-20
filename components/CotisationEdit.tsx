'use client'

import React, { useState } from 'react';
import { X, Save, User, Calendar, Phone, DollarSign, CheckCircle, Clock, XCircle, Lock } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export interface CotisationUpdatePayload {
  montant: number;
  periode: 'MENSUEL' | 'ANNUEL';
  datePaiement: string | null;
  dateExpiration: string;
  statut: 'EN_ATTENTE' | 'PAYEE' | 'EXPIREE';
}

interface CotisationEditProps {
  cotisation: {
    id: number;
    client: {
      nom: string;
      prenom: string;
      telephone: string;
    } | null;
    montant: number;
    periode: 'MENSUEL' | 'ANNUEL';
    datePaiement?: string | null;
    dateExpiration: string;
    statut: 'EN_ATTENTE' | 'PAYEE' | 'EXPIREE';
  };
  onClose: () => void;
  onSave: (updatedData: CotisationUpdatePayload) => void;
}

// Statuts autorisés selon le statut actuel
const STATUTS_DISPONIBLES: Record<
  'EN_ATTENTE' | 'PAYEE' | 'EXPIREE',
  { value: 'EN_ATTENTE' | 'PAYEE' | 'EXPIREE'; label: string; Icon: React.ElementType; active: string; inactive: string }[]
> = {
  EN_ATTENTE: [
    { value: 'EN_ATTENTE', label: 'En attente', Icon: Clock,       active: 'bg-amber-500   text-white border-amber-500',   inactive: 'bg-white text-amber-600   border-amber-200   hover:bg-amber-50'   },
    { value: 'PAYEE',      label: 'Payée',      Icon: CheckCircle,  active: 'bg-emerald-500 text-white border-emerald-500', inactive: 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50' },
    { value: 'EXPIREE',    label: 'Expirée',    Icon: XCircle,      active: 'bg-slate-600   text-white border-slate-600',   inactive: 'bg-white text-slate-600   border-slate-200   hover:bg-slate-50'   },
  ],
  PAYEE: [
    // Depuis PAYEE, on ne peut qu'aller vers EXPIREE (pas revenir EN_ATTENTE)
    { value: 'PAYEE',   label: 'Payée',   Icon: CheckCircle, active: 'bg-emerald-500 text-white border-emerald-500', inactive: 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50' },
    { value: 'EXPIREE', label: 'Expirée', Icon: XCircle,     active: 'bg-slate-600   text-white border-slate-600',   inactive: 'bg-white text-slate-600   border-slate-200   hover:bg-slate-50'   },
  ],
  EXPIREE: [
    // Depuis EXPIREE, rien n'est modifiable — ce tableau n'est pas utilisé (mode read-only)
    { value: 'EXPIREE', label: 'Expirée', Icon: XCircle, active: 'bg-slate-600 text-white border-slate-600', inactive: '' },
  ],
};

const inputCls = (locked?: boolean, hasError?: boolean) =>
  [
    'w-full px-4 py-2.5 border rounded-xl text-sm transition-all outline-none',
    locked
      ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed select-none'
      : hasError
      ? 'bg-red-50 border-red-400 text-slate-800 focus:ring-2 focus:ring-red-500/30 focus:border-red-400'
      : 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400',
  ].join(' ');

const CotisationEdit: React.FC<CotisationEditProps> = ({ cotisation, onClose, onSave }) => {
  const isPayee   = cotisation.statut === 'PAYEE';
  const isExpiree = cotisation.statut === 'EXPIREE';
  const isLocked  = isExpiree; // tout verrouillé

  const [formData, setFormData] = useState({
    montant:        cotisation.montant.toString(),
    periode:        cotisation.periode,
    datePaiement:   cotisation.datePaiement ? cotisation.datePaiement.split('T')[0] : '',
    dateExpiration: cotisation.dateExpiration.split('T')[0],
    statut:         cotisation.statut,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Quand on passe à PAYEE depuis EN_ATTENTE : auto-remplir datePaiement
      if (name === 'statut' && value === 'PAYEE' && !prev.datePaiement) {
        updated.datePaiement = new Date().toISOString().split('T')[0];
      }
      return updated;
    });
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const setStatut = (value: 'EN_ATTENTE' | 'PAYEE' | 'EXPIREE') => {
    setFormData(prev => {
      const updated = { ...prev, statut: value };
      if (value === 'PAYEE' && !prev.datePaiement) {
        updated.datePaiement = new Date().toISOString().split('T')[0];
      }
      return updated;
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!isPayee && !isExpiree) {
      if (!formData.montant || parseFloat(formData.montant) <= 0) {
        newErrors.montant = 'Le montant doit être supérieur à 0';
      }
    }
    if (!formData.dateExpiration) {
      newErrors.dateExpiration = "La date d'expiration est requise";
    }
    if (!isPayee && formData.datePaiement && new Date(formData.datePaiement) > new Date(formData.dateExpiration)) {
      newErrors.datePaiement = "La date de paiement ne peut pas dépasser la date d'expiration";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    if (!validate()) return;
    onSave({
      montant:        parseFloat(formData.montant),
      periode:        formData.periode,
      datePaiement:   formData.datePaiement || null,
      dateExpiration: formData.dateExpiration,
      statut:         formData.statut,
    });
  };

  const statutsDisponibles = STATUTS_DISPONIBLES[cotisation.statut];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Accent bar */}
        <div className={`h-1 rounded-t-2xl flex-shrink-0 ${
          isExpiree ? 'bg-slate-300' : isPayee ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-amber-400 to-emerald-500'
        }`} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isExpiree ? 'bg-slate-100' : 'bg-emerald-100'
            }`}>
              <DollarSign size={19} className={isExpiree ? 'text-slate-400' : 'text-emerald-600'} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isExpiree ? 'Cotisation expirée' : 'Modifier la cotisation'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Référence #{cotisation.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Bannière selon statut */}
        {isExpiree && (
          <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex-shrink-0">
            <Lock size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">
              Cette cotisation est <span className="font-semibold text-slate-700">expirée</span>. Elle ne peut plus être modifiée.
            </p>
          </div>
        )}
        {isPayee && (
          <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex-shrink-0">
            <CheckCircle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700">
              Cette cotisation est <span className="font-semibold">payée</span>. Le montant, la période et la date de paiement sont verrouillés.
              Vous pouvez uniquement ajuster la <span className="font-semibold">date d&apos;expiration</span> ou passer la cotisation au statut <span className="font-semibold">Expirée</span>.
            </p>
          </div>
        )}

        {/* Form body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Client (toujours lecture seule) */}
          {cotisation.client && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <User size={11} /> Client
              </p>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {cotisation.client.prenom?.[0]}{cotisation.client.nom?.[0]}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{cotisation.client.prenom} {cotisation.client.nom}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone size={10} /> {cotisation.client.telephone}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Montant — verrouillé si PAYEE ou EXPIREE */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Montant
              {(isPayee || isExpiree) && <Lock size={10} className="text-slate-400" />}
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium ${isPayee || isExpiree ? 'text-slate-300' : 'text-slate-400'}`}>
                FCFA
              </span>
              <input
                type="number"
                name="montant"
                value={formData.montant}
                onChange={handleChange}
                step="0.01"
                min="0"
                disabled={isPayee || isExpiree}
                className={`${inputCls(isPayee || isExpiree, !!errors.montant)} pl-14`}
                placeholder="0"
              />
            </div>
            {errors.montant && <p className="mt-1 text-xs text-red-500">{errors.montant}</p>}
            {!errors.montant && !isPayee && !isExpiree && formData.montant && (
              <p className="mt-1 text-xs text-slate-400">{formatCurrency(formData.montant)}</p>
            )}
            {(isPayee || isExpiree) && (
              <p className="mt-1 text-xs text-slate-400">{formatCurrency(cotisation.montant)}</p>
            )}
          </div>

          {/* Période — verrouillée si PAYEE ou EXPIREE */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Période
              {(isPayee || isExpiree) && <Lock size={10} className="text-slate-400" />}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['MENSUEL', 'ANNUEL'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  disabled={isPayee || isExpiree}
                  onClick={() => !isPayee && !isExpiree && setFormData(prev => ({ ...prev, periode: p }))}
                  className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    isPayee || isExpiree
                      ? formData.periode === p
                        ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                        : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                      : formData.periode === p
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {p === 'MENSUEL' ? 'Mensuelle' : 'Annuelle'}
                </button>
              ))}
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Statut
            </label>
            <div className={`grid gap-2 grid-cols-${statutsDisponibles.length}`}>
              {statutsDisponibles.map(({ value, label, Icon, active, inactive }) => (
                <button
                  key={value}
                  type="button"
                  disabled={isExpiree}
                  onClick={() => !isExpiree && setStatut(value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-all ${
                    isExpiree
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                      : formData.statut === value ? active : inactive
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
            {isPayee && (
              <p className="mt-1.5 text-[10px] text-slate-400">
                Une cotisation payée ne peut pas revenir en &quot;En attente&quot;.
              </p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            {/* Date de paiement — verrouillée si PAYEE */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                <Calendar size={10} /> Date de paiement
                {(isPayee || isExpiree) && <Lock size={10} className="text-slate-400" />}
              </label>
              <input
                type="date"
                name="datePaiement"
                value={formData.datePaiement}
                onChange={handleChange}
                disabled={isPayee || isExpiree}
                className={inputCls(isPayee || isExpiree, !!errors.datePaiement)}
              />
              {errors.datePaiement
                ? <p className="mt-1 text-xs text-red-500">{errors.datePaiement}</p>
                : !isPayee && !isExpiree
                  ? <p className="mt-1 text-xs text-slate-400">Laisser vide si non payée</p>
                  : <p className="mt-1 text-xs text-slate-400">Enregistrée à la validation</p>
              }
            </div>

            {/* Date d'expiration — toujours éditable sauf EXPIREE */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                <Calendar size={10} /> Date d&apos;expiration
                {isExpiree && <Lock size={10} className="text-slate-400" />}
              </label>
              <input
                type="date"
                name="dateExpiration"
                value={formData.dateExpiration}
                onChange={handleChange}
                disabled={isExpiree}
                className={inputCls(isExpiree, !!errors.dateExpiration)}
              />
              {errors.dateExpiration && <p className="mt-1 text-xs text-red-500">{errors.dateExpiration}</p>}
              {isPayee && (
                <p className="mt-1 text-xs text-emerald-600">Ajustable même après paiement.</p>
              )}
            </div>
          </div>

          {/* Info box — uniquement pour EN_ATTENTE */}
          {!isPayee && !isExpiree && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-3">
              <div className="w-1 bg-blue-400 rounded-full flex-shrink-0" />
              <p className="text-xs text-blue-700">
                Passer au statut <span className="font-semibold">Payée</span> génèrera automatiquement un crédit alimentaire pour ce client.
              </p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            {isExpiree ? 'Fermer' : 'Annuler'}
          </button>
          {!isExpiree && (
            <button
              onClick={handleSubmit}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors flex items-center gap-2 shadow-sm shadow-emerald-200"
            >
              <Save size={15} />
              Enregistrer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CotisationEdit;
