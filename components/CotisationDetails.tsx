'use client'

import React from 'react';
import { X, User, Calendar, CheckCircle, Clock, XCircle, AlertCircle, Phone, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';

interface CotisationDetailsProps {
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
    createdAt: string;
    updatedAt: string;
  };
  onClose: () => void;
}

const statutConfig = {
  PAYEE:      { label: 'Payée',      Icon: CheckCircle,  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  EN_ATTENTE: { label: 'En attente', Icon: Clock,         bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400'  },
  EXPIREE:    { label: 'Expirée',    Icon: XCircle,       bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'    },
};

const CotisationDetails: React.FC<CotisationDetailsProps> = ({ cotisation, onClose }) => {
  const sc = statutConfig[cotisation.statut] ?? {
    label: cotisation.statut, Icon: AlertCircle,
    bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400',
  };
  const { Icon } = sc;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 rounded-t-2xl flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <DollarSign size={19} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Détails de la cotisation</h2>
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

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Statut */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${sc.bg} ${sc.border}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
            <Icon size={16} className={sc.text} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Statut</p>
              <p className={`text-sm font-bold ${sc.text}`}>{sc.label}</p>
            </div>
          </div>

          {/* Client */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <User size={11} /> Client
            </p>
            {cotisation.client ? (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                  {cotisation.client.prenom?.[0]}{cotisation.client.nom?.[0]}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{cotisation.client.prenom} {cotisation.client.nom}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone size={10} /> {cotisation.client.telephone}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic px-4">Client introuvable</p>
            )}
          </div>

          {/* Montant + Période */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-4 text-center">
              <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider mb-1">Montant</p>
              <p className="text-2xl font-extrabold text-emerald-700">{formatCurrency(cotisation.montant)}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 text-center">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Période</p>
              <p className="text-lg font-bold text-slate-800">
                {cotisation.periode === 'MENSUEL' ? 'Mensuelle' : 'Annuelle'}
              </p>
            </div>
          </div>

          {/* Dates */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Calendar size={11} /> Dates importantes
            </p>
            <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
              {cotisation.datePaiement && (
                <div className="flex justify-between items-center px-4 py-3 bg-white">
                  <span className="text-sm text-slate-500">Date de paiement</span>
                  <span className="text-sm font-semibold text-slate-800">{formatDate(cotisation.datePaiement)}</span>
                </div>
              )}
              <div className="flex justify-between items-center px-4 py-3 bg-white">
                <span className="text-sm text-slate-500">Date d&apos;expiration</span>
                <span className="text-sm font-semibold text-slate-800">{formatDate(cotisation.dateExpiration)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-slate-50/60">
                <span className="text-sm text-slate-400">Créée le</span>
                <span className="text-xs text-slate-500">{formatDateTime(cotisation.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-slate-50/60">
                <span className="text-sm text-slate-400">Dernière modification</span>
                <span className="text-xs text-slate-500">{formatDateTime(cotisation.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default CotisationDetails;
