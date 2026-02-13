'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi, useMutation } from '@/hooks/useApi';
import {
  ArrowLeft,
  Save,
  Plus,
  X,
  Calendar,
  Euro,
  Users,
  Clock,
  AlertCircle,
  Search
} from 'lucide-react';

interface TontineForm {
  nom: string;
  description: string;
  montantCycle: string;
  frequence: 'HEBDOMADAIRE' | 'MENSUEL';
  statut: 'ACTIVE' | 'TERMINEE' | 'SUSPENDUE';
  dateDebut: string;
  dateFin: string;
}

interface ClientOption {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
}

interface TontineMembre {
  id: number;
  ordreTirage: number | null;
  client: ClientOption | null;
}

interface Tontine {
  id: number;
  nom: string;
  description: string | null;
  montantCycle: string;
  frequence: string;
  statut: string;
  dateDebut: string;
  dateFin: string | null;
  membres: TontineMembre[];
}

interface TontineResponse {
  data: Tontine;
}

interface ClientsResponse {
  data: Array<{
    id: number;
    nom: string;
    prenom: string;
    telephone: string;
  }>;
}

export default function TontineEdit({ tontineId }: { tontineId: string }) {
  const router = useRouter();
  const { data: response, loading } = useApi<TontineResponse>(`/api/admin/tontines/${tontineId}`);
  const { mutate, loading: saving, error: saveError } = useMutation(`/api/admin/tontines/${tontineId}`, 'PUT');
  const { data: clientsResponse } = useApi<ClientsResponse>('/api/admin/clients?limit=100');

  const [formData, setFormData] = useState<TontineForm>({
    nom: '',
    description: '',
    montantCycle: '',  
    frequence: 'MENSUEL',
    statut: 'ACTIVE',
    dateDebut: '',
    dateFin: ''
  });

  const [membresSelectionnes, setMembresSelectionnes] = useState<Array<{
    clientId: number;
    ordreTirage: number | null;
    client: ClientOption;
  }>>([]);

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [searchMembre, setSearchMembre] = useState('');

  useEffect(() => {
    if (!response?.data) return;

    const timeout = setTimeout(() => {
      const t = response.data;
      setFormData({
        nom: t.nom,
        description: t.description || '',
        montantCycle: String(t.montantCycle),
        frequence: t.frequence as TontineForm['frequence'],
        statut: t.statut as TontineForm['statut'],
        dateDebut: t.dateDebut ? t.dateDebut.split('T')[0] : '',
        dateFin: t.dateFin ? t.dateFin.split('T')[0] : '',
      });
      setMembresSelectionnes(
        t.membres
          .filter(m => m.client !== null)
          .map(m => ({
            clientId: m.client!.id,
            ordreTirage: m.ordreTirage,
            client: m.client!,
          }))
      );
    }, 0);

    return () => clearTimeout(timeout);
  }, [response]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const ajouterClient = (client: ClientOption) => {
    if (membresSelectionnes.some(m => m.clientId === client.id)) return;
    const prochainOrdre = membresSelectionnes.length > 0
      ? Math.max(...membresSelectionnes.map(m => m.ordreTirage || 0)) + 1
      : 1;
    setMembresSelectionnes(prev => [...prev, {
      clientId: client.id,
      ordreTirage: prochainOrdre,
      client
    }]);
    setShowMemberModal(false);
    setSearchMembre('');
  };

  const retirerMembre = (clientId: number) => {
    setMembresSelectionnes(prev => prev.filter(m => m.clientId !== clientId));
  };

  const updateOrdreTirage = (clientId: number, ordre: number) => {
    setMembresSelectionnes(prev =>
      prev.map(m => m.clientId === clientId ? { ...m, ordreTirage: ordre } : m)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await mutate({
      ...formData,
      montantCycle: parseFloat(formData.montantCycle),
      dateDebut: formData.dateDebut,
      dateFin: formData.dateFin || null,
      membres: membresSelectionnes,
    });
    if (result) {
      router.push(`/dashboard/admin/tontines/${tontineId}`);
    }
  };

  const getCategoryColor = (nom: string) => {
    if (nom.toLowerCase().includes('solidarit')) return 'bg-emerald-500';
    if (nom.toLowerCase().includes('entrepren')) return 'bg-orange-500';
    if (nom.toLowerCase().includes('educ')) return 'bg-blue-500';
    return 'bg-purple-500';
  };

  const clientsDisponibles = (clientsResponse?.data || []).filter((c: ClientOption) =>
    !membresSelectionnes.some(ms => ms.clientId === c.id) &&
    (searchMembre === '' ||
      c.nom.toLowerCase().includes(searchMembre.toLowerCase()) ||
      c.prenom.toLowerCase().includes(searchMembre.toLowerCase()) ||
      c.telephone.toLowerCase().includes(searchMembre.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/dashboard/admin/tontines/${tontineId}`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gerer la tontine</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Modifiez les informations et gerez les membres
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                form="tontine-form"
                disabled={saving}
                className={`${getCategoryColor(formData.nom)} text-white px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50`}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {saveError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{saveError}</div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form id="tontine-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulaire principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Informations de base */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Informations de base</h3>

                <div className="space-y-5">
                  <div>
                    <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">
                      Nom de la tontine *
                    </label>
                    <input
                      type="text"
                      id="nom"
                      name="nom"
                      value={formData.nom}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="montantCycle" className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Euro className="w-4 h-4" />
                          Montant par cycle *
                        </div>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">XOF</span>
                        <input
                          type="number"
                          id="montantCycle"
                          name="montantCycle"
                          value={formData.montantCycle}
                          onChange={handleInputChange}
                          required
                          min="0"
                          step="0.01"
                          className="w-full pl-14 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="frequence" className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Frequence *
                        </div>
                      </label>
                      <select
                        id="frequence"
                        name="frequence"
                        value={formData.frequence}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none bg-white"
                      >
                        <option value="MENSUEL">Mensuelle</option>
                        <option value="HEBDOMADAIRE">Hebdomadaire</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="dateDebut" className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Date de debut *
                        </div>
                      </label>
                      <input
                        type="date"
                        id="dateDebut"
                        name="dateDebut"
                        value={formData.dateDebut}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="dateFin" className="block text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Date de fin
                        </div>
                      </label>
                      <input
                        type="date"
                        id="dateFin"
                        name="dateFin"
                        value={formData.dateFin}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="statut" className="block text-sm font-medium text-gray-700 mb-2">
                      Statut *
                    </label>
                    <select
                      id="statut"
                      name="statut"
                      value={formData.statut}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none bg-white"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDUE">Suspendue</option>
                      <option value="TERMINEE">Terminee</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Gestion des membres */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">
                    Membres ({membresSelectionnes.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowMemberModal(true)}
                    className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter un client
                  </button>
                </div>

                {membresSelectionnes.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">Aucun membre ajoute</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {membresSelectionnes.map((membre) => (
                      <div
                        key={membre.clientId}
                        className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {membre.client.prenom[0]}{membre.client.nom[0]}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {membre.client.prenom} {membre.client.nom}
                          </p>
                          <p className="text-sm text-gray-500">{membre.client.telephone}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Ordre de tirage</label>
                            <input
                              type="number"
                              value={membre.ordreTirage || ''}
                              onChange={(e) => updateOrdreTirage(membre.clientId, parseInt(e.target.value) || 0)}
                              min="1"
                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                              placeholder="#"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => retirerMembre(membre.clientId)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Apercu */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Apercu</h3>

                <div className={`${getCategoryColor(formData.nom)} rounded-xl p-6 text-white mb-6`}>
                  <div className="text-white/80 text-xs font-medium mb-1">
                    {formData.nom.split(' ')[0]}
                  </div>
                  <h4 className="text-xl font-bold mb-4">{formData.nom || 'Sans nom'}</h4>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-sm">Membres</span>
                      <span className="font-bold">{membresSelectionnes.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-sm">Total</span>
                      <span className="font-bold">
                        {(parseFloat(formData.montantCycle || '0') * membresSelectionnes.length).toLocaleString()} XOF
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Contribution</p>
                    <p className="text-2xl font-bold text-gray-900">{formData.montantCycle || '0'} XOF</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Frequence</p>
                    <p className="font-medium text-gray-900">
                      {formData.frequence === 'MENSUEL' ? 'Mensuelle' : 'Hebdomadaire'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Statut</p>
                    <p className="font-medium text-gray-900">{formData.statut}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                      Les modifications seront appliquees immediatement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Modal d'ajout de membre */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Ajouter un client</h3>
                <button
                  onClick={() => setShowMemberModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchMembre}
                  onChange={(e) => setSearchMembre(e.target.value)}
                  placeholder="Rechercher un client..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
              {clientsDisponibles.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">Aucun client disponible</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clientsDisponibles.map((client: ClientOption) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => ajouterClient(client)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-xl transition-colors border border-gray-200 text-left"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {client.prenom[0]}{client.nom[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {client.prenom} {client.nom}
                        </p>
                        <p className="text-sm text-gray-500">{client.telephone}</p>
                      </div>
                      <Plus className="w-5 h-5 text-emerald-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
