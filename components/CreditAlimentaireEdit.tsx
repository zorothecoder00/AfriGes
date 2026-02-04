'use client'

import { useState, useEffect } from 'react';

interface CreditAlimentaire {
  plafond: number;
  montantUtilise: number;
  montantRestant: number;
  source: SourceCreditAlim;
  sourceId: number;
  dateExpiration?: string | null;
  statut: StatutCreditAlim;
}  

interface User {
  id: number;
  prenom: string;
  nom: string;
}

type SourceCreditAlim = 'COTISATION' | 'TONTINE';
type StatutCreditAlim = 'ACTIF' | 'EPUISE' | 'EXPIRE';

interface CreditAlimentaireWithMember extends CreditAlimentaire {
  member: User;
}  
  
interface CreditAlimentaireEditProps {
  credit?: CreditAlimentaireWithMember;
  onClose: () => void;
  onSave: (data: UpdateCreditAlimentaireData) => Promise<void>;
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

export default function CreditAlimentaireEdit({ credit, onClose, onSave }: CreditAlimentaireEditProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    plafond: 0,
    source: 'COTISATION' as SourceCreditAlim,
    sourceId: 0,
    dateExpiration: '',
    statut: 'ACTIF' as StatutCreditAlim,
    ajustementMontant: 0,
    raisonAjustement: ''
  });

  const [showAjustement, setShowAjustement] = useState(false);

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
      raisonAjustement: ''
    });
  }, [credit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'plafond' || name === 'sourceId' || name === 'ajustementMontant'
        ? Number(value)
        : value
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
        statut: formData.statut
      };

      if (showAjustement && formData.ajustementMontant !== 0) {
        updateData.ajustementMontant = formData.ajustementMontant;
        updateData.raisonAjustement = formData.raisonAjustement;
      }

      await onSave(updateData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(Number(amount));
  };

  if (!credit || !formData) {
    return <div>Chargement...</div>;
  }

  const nouveauMontantUtilise =
    Number(credit.montantUtilise) + formData.ajustementMontant;

  const nouveauMontantRestant =
    formData.plafond - nouveauMontantUtilise;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Modifier le crédit alimentaire</h2>
            <p className="text-sm text-gray-500 mt-1">
              {credit.member.prenom} {credit.member.nom}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">État actuel du crédit</p>
              <div className="mt-1 text-sm text-blue-700 space-y-1">
                <p>Plafond: {formatCurrency(credit.plafond)} | Utilisé: {formatCurrency(credit.montantUtilise)} | Disponible: {formatCurrency(credit.montantRestant)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Informations de base */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Informations de base</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="plafond" className="block text-sm font-medium text-gray-700 mb-1">
                    Plafond *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">€</span>
                    <input
                      type="number"
                      id="plafond"
                      name="plafond"
                      value={formData.plafond}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      required
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="statut" className="block text-sm font-medium text-gray-700 mb-1">
                    Statut *
                  </label>
                  <select
                    id="statut"
                    name="statut"
                    value={formData.statut}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="ACTIF">Actif</option>
                    <option value="EPUISE">Épuisé</option>
                    <option value="EXPIRE">Expiré</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
                    Source *
                  </label>
                  <select
                    id="source"
                    name="source"
                    value={formData.source}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="COTISATION">Cotisation</option>
                    <option value="TONTINE">Tontine</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="sourceId" className="block text-sm font-medium text-gray-700 mb-1">
                    ID Source *
                  </label>
                  <input
                    type="number"
                    id="sourceId"
                    name="sourceId"
                    value={formData.sourceId}
                    onChange={handleChange}
                    min="1"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label htmlFor="dateExpiration" className="block text-sm font-medium text-gray-700 mb-1">
                    Date d&apos;expiration
                  </label>
                  <input
                    type="date"
                    id="dateExpiration"
                    name="dateExpiration"
                    value={formData.dateExpiration}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Ajustement manuel */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Ajustement manuel du montant</h3>
                <button
                  type="button"
                  onClick={() => setShowAjustement(!showAjustement)}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                    showAjustement
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {showAjustement ? 'Masquer' : 'Afficher'}
                </button>
              </div>

              {showAjustement && (
                <div className="space-y-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-yellow-700">
                      Attention: Cette opération créera une transaction d&apos;ajustement dans l&apos;historique.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="ajustementMontant" className="block text-sm font-medium text-gray-700 mb-1">
                      Montant de l&apos;ajustement
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">€</span>
                      <input
                        type="number"
                        id="ajustementMontant"
                        name="ajustementMontant"
                        value={formData.ajustementMontant}
                        onChange={handleChange}
                        step="0.01"
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Montant positif ou négatif"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Valeur positive pour augmenter, négative pour diminuer le montant utilisé
                    </p>
                  </div>

                  <div>
                    <label htmlFor="raisonAjustement" className="block text-sm font-medium text-gray-700 mb-1">
                      Raison de l&apos;ajustement *
                    </label>
                    <textarea
                      id="raisonAjustement"
                      name="raisonAjustement"
                      value={formData.raisonAjustement}
                      onChange={handleChange}
                      rows={3}
                      required={formData.ajustementMontant !== 0}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      placeholder="Expliquez la raison de cet ajustement..."
                    />
                  </div>

                  {formData.ajustementMontant !== 0 && (
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Aperçu après ajustement:</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Montant utilisé actuel:</span>
                          <span className="font-medium">{formatCurrency(credit.montantUtilise)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Ajustement:</span>
                          <span className={`font-medium ${formData.ajustementMontant > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {formData.ajustementMontant > 0 ? '+' : ''}{formatCurrency(formData.ajustementMontant)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-900 font-medium">Nouveau montant utilisé:</span>
                          <span className="font-semibold">{formatCurrency(nouveauMontantUtilise)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-900 font-medium">Nouveau montant restant:</span>
                          <span className={`font-semibold ${nouveauMontantRestant < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(nouveauMontantRestant)}
                          </span>
                        </div>
                      </div>
                      {nouveauMontantRestant < 0 && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                          ⚠️ Le montant restant sera négatif après cet ajustement
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Annuler
          </button>  
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Enregistrement...
              </>
            ) : (
              'Enregistrer les modifications'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}