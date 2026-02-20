'use client'

import { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, User, Phone, Wallet, TrendingDown, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

type SourceCreditAlim = 'COTISATION' | 'TONTINE';
type StatutCreditAlim = 'ACTIF' | 'EPUISE' | 'EXPIRE';

interface CreditAlimentaire {
  plafond: number;
  montantUtilise: number;
  montantRestant: number;
  source: SourceCreditAlim;
  sourceId: number;
  dateExpiration?: string | null;
  statut: StatutCreditAlim;
}

interface ClientInfo {
  id: number;
  prenom: string;
  nom: string;
  telephone: string;
}

interface CreditAlimentaireWithClient extends CreditAlimentaire {
  client: ClientInfo | null;
}

export interface UpdateCreditAlimentaireData {
  plafond?: number;
  source?: SourceCreditAlim;
  sourceId?: number;
  dateExpiration?: Date | null;
  statut?: StatutCreditAlim;
  ajustementMontant?: number;
  raisonAjustement?: string;
}

interface CreditAlimentaireEditProps {
  credit?: CreditAlimentaireWithClient;
  onClose: () => void;
  onSave: (data: UpdateCreditAlimentaireData) => Promise<void>;
}

const inputCls =
  'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white transition-all outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400';

const STATUTS: { value: StatutCreditAlim; label: string; active: string; inactive: string }[] = [
  { value: 'ACTIF',  label: 'Actif',   active: 'bg-emerald-500 text-white border-emerald-500', inactive: 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50' },
  { value: 'EPUISE', label: 'Épuisé',  active: 'bg-orange-500 text-white border-orange-500',  inactive: 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'  },
  { value: 'EXPIRE', label: 'Expiré',  active: 'bg-slate-600  text-white border-slate-600',   inactive: 'bg-white text-slate-600  border-slate-200 hover:bg-slate-50'   },
];

export default function CreditAlimentaireEdit({ credit, onClose, onSave }: CreditAlimentaireEditProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAjustement, setShowAjustement] = useState(false);

  const [formData, setFormData] = useState({
    plafond: 0,
    source: 'COTISATION' as SourceCreditAlim,
    sourceId: 0,
    dateExpiration: '',
    statut: 'ACTIF' as StatutCreditAlim,
    ajustementMontant: 0,
    raisonAjustement: '',
  });

  useEffect(() => {
    if (!credit) return;
    setFormData({
      plafond: Number(credit.plafond),
      source: credit.source,
      sourceId: credit.sourceId,
      dateExpiration: credit.dateExpiration
        ? new Date(credit.dateExpiration).toISOString().split('T')[0]
        : '',
      statut: credit.statut,
      ajustementMontant: 0,
      raisonAjustement: '',
    });
  }, [credit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['plafond', 'sourceId', 'ajustementMontant'].includes(name) ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const updateData: UpdateCreditAlimentaireData = {
        plafond: formData.plafond,
        source: formData.source,
        sourceId: formData.sourceId,
        dateExpiration: formData.dateExpiration ? new Date(formData.dateExpiration) : null,
        statut: formData.statut,
      };
      if (showAjustement && formData.ajustementMontant !== 0) {
        updateData.ajustementMontant = formData.ajustementMontant;
        updateData.raisonAjustement = formData.raisonAjustement;
      }
      await onSave(updateData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  if (!credit) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  const newUtilise = Number(credit.montantUtilise) + formData.ajustementMontant;
  const newRestant = formData.plafond - newUtilise;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 rounded-t-2xl flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Wallet size={19} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Modifier le crédit alimentaire</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {credit.client ? `${credit.client.prenom} ${credit.client.nom}` : 'Bénéficiaire inconnu'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current state banner */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Wallet size={13} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Plafond</p>
                <p className="text-sm font-bold text-slate-700">{formatCurrency(credit.plafond)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingDown size={13} className="text-orange-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Utilisé</p>
                <p className="text-sm font-bold text-orange-600">{formatCurrency(credit.montantUtilise)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign size={13} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Disponible</p>
                <p className="text-sm font-bold text-emerald-600">{formatCurrency(credit.montantRestant)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Client */}
        {credit.client && (
          <div className="px-6 pt-5 flex-shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <User size={11} /> Bénéficiaire
            </p>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {credit.client.prenom?.[0]}{credit.client.nom?.[0]}
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{credit.client.prenom} {credit.client.nom}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Phone size={10} /> {credit.client.telephone}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Plafond + Statut */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Plafond
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">FCFA</span>
                <input
                  type="number"
                  name="plafond"
                  value={formData.plafond}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  required
                  className={`${inputCls} pl-14`}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Date d&apos;expiration
              </label>
              <input
                type="date"
                name="dateExpiration"
                value={formData.dateExpiration}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
          </div>

          {/* Source + sourceId */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Source
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['COTISATION', 'TONTINE'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, source: s }))}
                    className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      formData.source === s
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {s === 'COTISATION' ? 'Cotisation' : 'Tontine'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                ID Source
              </label>
              <input
                type="number"
                name="sourceId"
                value={formData.sourceId}
                onChange={handleChange}
                min="1"
                required
                className={inputCls}
              />
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Statut
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STATUTS.map(({ value, label, active, inactive }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, statut: value }))}
                  className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    formData.statut === value ? active : inactive
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Ajustement */}
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAjustement(!showAjustement)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-semibold text-slate-700"
            >
              <span>Ajustement manuel du montant</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                showAjustement ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
              }`}>
                {showAjustement ? 'Masquer' : 'Afficher'}
              </span>
            </button>

            {showAjustement && (
              <div className="px-4 py-4 space-y-4">
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Un ajustement créera une transaction dans l&apos;historique. Valeur positive = augmente le montant utilisé, négative = le diminue.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                      Montant d&apos;ajustement
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">FCFA</span>
                      <input
                        type="number"
                        name="ajustementMontant"
                        value={formData.ajustementMontant}
                        onChange={handleChange}
                        step="0.01"
                        className={`${inputCls} pl-14`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                      Raison
                    </label>
                    <textarea
                      name="raisonAjustement"
                      value={formData.raisonAjustement}
                      onChange={handleChange}
                      rows={2}
                      required={formData.ajustementMontant !== 0}
                      className={`${inputCls} resize-none`}
                      placeholder="Raison de l'ajustement..."
                    />
                  </div>
                </div>

                {formData.ajustementMontant !== 0 && (
                  <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                    <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50">
                      <span className="text-xs text-slate-500">Montant utilisé actuel</span>
                      <span className="text-xs font-semibold text-slate-700">{formatCurrency(credit.montantUtilise)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50">
                      <span className="text-xs text-slate-500">Ajustement</span>
                      <span className={`text-xs font-semibold ${formData.ajustementMontant > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                        {formData.ajustementMontant > 0 ? '+' : ''}{formatCurrency(formData.ajustementMontant)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2.5 bg-white">
                      <span className="text-xs font-semibold text-slate-700">Nouveau montant restant</span>
                      <span className={`text-sm font-bold ${newRestant < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrency(newRestant)}
                      </span>
                    </div>
                    {newRestant < 0 && (
                      <div className="px-4 py-2 bg-red-50">
                        <p className="text-xs text-red-600">Le montant restant sera négatif après cet ajustement.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors flex items-center gap-2 shadow-sm shadow-emerald-200 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Enregistrement…
              </>
            ) : (
              <>
                <Save size={15} />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
