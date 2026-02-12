'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApi, useMutation } from '@/hooks/useApi';
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface GestionnaireEditProps {
  gestionnaireId: string;
}

interface Gestionnaire {
  id: number;
  memberId: number;
  role: string;
  actif: boolean;
  member: {
    id: number;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    adresse?: string;
    role?: string;
  };
}

interface GestionnaireResponse {
  data: Gestionnaire;
}

interface FormData {
  role: 'AGENT' | 'SUPERVISEUR' | 'CAISSIER';
  actif: boolean;
}

export default function GestionnaireEdit({ gestionnaireId }: GestionnaireEditProps) {
  const router = useRouter();
  const { data: response, loading } = useApi<GestionnaireResponse>(`/api/admin/gestionnaires/${gestionnaireId}`);
  const { mutate, loading: saving, error: saveError } = useMutation(`/api/admin/gestionnaires/${gestionnaireId}`, 'PATCH');

  const [formData, setFormData] = useState<FormData>({
    role: 'AGENT',
    actif: true,
  });

  useEffect(() => {
    if (!response?.data) return;

    // setState dans un micro-task pour éviter le warning
    const timeout = setTimeout(() => {
      setFormData({
        role: response.data.role as FormData['role'],
        actif: response.data.actif,
      });
    }, 0);

    return () => clearTimeout(timeout);
  }, [response]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await mutate(formData);
    if (result) {
      router.push(`/dashboard/admin/gestionnaires/${gestionnaireId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const gestionnaire = response?.data;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* En-tete */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modifier le gestionnaire</h1>
            <p className="text-sm text-gray-500 mt-1">
              Mettez a jour les informations du gestionnaire
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
          {/* Informations du membre (lecture seule) */}
          {gestionnaire && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-purple-600" />
                Informations du membre
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prenom</label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{gestionnaire.member.prenom}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{gestionnaire.member.nom}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{gestionnaire.member.email}</span>
                  </div>
                </div>
                {gestionnaire.member.telephone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Telephone</label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{gestionnaire.member.telephone}</span>
                    </div>
                  </div>
                )}
                {gestionnaire.member.adresse && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{gestionnaire.member.adresse}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Roles et permissions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Roles et permissions
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Role gestionnaire */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Role gestionnaire <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as FormData['role'] }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all appearance-none bg-white"
                >
                  <option value="AGENT">Agent</option>
                  <option value="SUPERVISEUR">Superviseur</option>
                  <option value="CAISSIER">Caissier</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Definit les responsabilites du gestionnaire
                </p>
              </div>

              {/* Statut */}
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.actif}
                      onChange={(e) => setFormData(prev => ({ ...prev, actif: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      Gestionnaire actif
                    </span>
                    <p className="text-xs text-gray-500">
                      Le gestionnaire peut acceder au systeme et effectuer ses taches
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
