'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi, useMutation } from '@/hooks/useApi';
import {
  ArrowLeft,
  Save,
  User,
  Phone,
  MapPin,
  Shield,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface ClientEditProps {
  clientId: string;
}

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  etat: string;
}

interface ClientResponse {
  data: Client;
}

interface FormData {
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string;
  etat: string;
}

export default function ClientEdit({ clientId }: ClientEditProps) {
  const router = useRouter();
  const { data: response, loading } = useApi<ClientResponse>(`/api/admin/clients/${clientId}`);
  const { mutate, loading: saving, error: saveError } = useMutation(`/api/admin/clients/${clientId}`, 'PATCH');

  const [formData, setFormData] = useState<FormData>({
    nom: '',
    prenom: '',
    telephone: '',
    adresse: '',
    etat: 'ACTIF',
  });

  useEffect(() => {
    if (!response?.data) return;

    const timeout = setTimeout(() => {
      setFormData({
        nom: response.data.nom,
        prenom: response.data.prenom,
        telephone: response.data.telephone,
        adresse: response.data.adresse || '',
        etat: response.data.etat,
      });
    }, 0);

    return () => clearTimeout(timeout);
  }, [response]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await mutate(formData);
    if (result) {
      router.push(`/dashboard/admin/clients/${clientId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const client = response?.data;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* En-tete */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href={`/dashboard/admin/clients/${clientId}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modifier le client</h1>
            <p className="text-sm text-gray-500 mt-1">
              {client ? `${client.prenom} ${client.nom}` : 'Chargement...'}
            </p>
          </div>
        </div>

        {/* Messages d'alerte */}
        {saveError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Erreur</p>
              <p className="text-sm text-red-600 mt-1">{saveError}</p>
            </div>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-amber-600" />
              Informations personnelles
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-2">
                  Prenom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="prenom"
                  required
                  value={formData.prenom}
                  onChange={(e) => setFormData(prev => ({ ...prev, prenom: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                  placeholder="Prenom du client"
                />
              </div>
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nom"
                  required
                  value={formData.nom}
                  onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                  placeholder="Nom du client"
                />
              </div>
              <div>
                <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4 text-gray-400" />
                    Telephone <span className="text-red-500">*</span>
                  </div>
                </label>
                <input
                  type="text"
                  id="telephone"
                  required
                  value={formData.telephone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                  placeholder="Numero de telephone"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Le numero de telephone doit etre unique
                </p>
              </div>
              <div>
                <label htmlFor="adresse" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    Adresse
                  </div>
                </label>
                <input
                  type="text"
                  id="adresse"
                  value={formData.adresse}
                  onChange={(e) => setFormData(prev => ({ ...prev, adresse: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                  placeholder="Adresse du client (optionnel)"
                />
              </div>
            </div>
          </div>

          {/* Statut */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600" />
              Statut du client
            </h2>

            <div>
              <label htmlFor="etat" className="block text-sm font-medium text-gray-700 mb-2">
                Etat <span className="text-red-500">*</span>
              </label>
              <select
                id="etat"
                value={formData.etat}
                onChange={(e) => setFormData(prev => ({ ...prev, etat: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all appearance-none bg-white"
              >
                <option value="ACTIF">Actif</option>
                <option value="INACTIF">Inactif</option>
                <option value="SUSPENDU">Suspendu</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Un client inactif ou suspendu ne pourra pas beneficier de nouveaux services
              </p>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
            <Link
              href={`/dashboard/admin/clients/${clientId}`}
              className={`px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${saving ? 'pointer-events-none opacity-50' : ''}`}
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer les modifications
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
