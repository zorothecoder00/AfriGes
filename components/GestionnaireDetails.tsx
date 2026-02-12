'use client';

import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { formatDateTime } from '@/lib/format';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Activity,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Edit
} from 'lucide-react';

interface GestionnaireDetailsProps {
  gestionnaireId: string;
}

interface Gestionnaire {
  id: number;
  memberId: number;
  role: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
  member: {
    id: number;
    uuid: string;
    nom: string;
    prenom: string;
    email: string;
    photo?: string;
    role?: string;
    telephone?: string;
    adresse?: string;
    etat: string;
    dateAdhesion: string;
  };
}

interface GestionnaireResponse {
  data: Gestionnaire;
}

export default function GestionnaireDetails({ gestionnaireId }: GestionnaireDetailsProps) {
  const router = useRouter();
  const { data: response, loading, error, refetch } = useApi<GestionnaireResponse>(`/api/admin/gestionnaires/${gestionnaireId}`);
  const gestionnaire = response?.data;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'AGENT':
        return 'bg-blue-100 text-blue-700';
      case 'SUPERVISEUR':
        return 'bg-purple-100 text-purple-700';
      case 'CAISSIER':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading && !gestionnaire) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="text-slate-500 font-medium">Chargement du gestionnaire...</p>
        </div>
      </div>
    );
  }

  if (error && !gestionnaire) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  if (!gestionnaire) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* En-tete */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Details du gestionnaire</h1>
              <p className="text-sm text-gray-500 mt-1">
                Informations completes et activite
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/dashboard/admin/gestionnaires/${gestionnaireId}/edit`)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Modifier
          </button>
        </div>

        {/* Carte principale */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Profil */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="relative">
                {gestionnaire.member.photo ? (
                  <img
                    src={gestionnaire.member.photo}
                    alt={`${gestionnaire.member.prenom} ${gestionnaire.member.nom}`}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {gestionnaire.member.prenom[0]}{gestionnaire.member.nom[0]}
                    </span>
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-4 border-white flex items-center justify-center ${
                  gestionnaire.actif ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {gestionnaire.actif ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : (
                    <XCircle className="w-4 h-4 text-white" />
                  )}
                </div>
              </div>

              {/* Informations principales */}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {gestionnaire.member.prenom} {gestionnaire.member.nom}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Membre depuis {formatDateTime(gestionnaire.member.dateAdhesion)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(gestionnaire.role)}`}>
                      {gestionnaire.role}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      gestionnaire.actif
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {gestionnaire.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>

                {/* Role systeme */}
                {gestionnaire.member.role && (
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span className="text-gray-600">Role systeme:</span>
                    <span className="font-medium text-gray-900">{gestionnaire.member.role}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coordonnees */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              Coordonnees
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {gestionnaire.member.email}
                  </p>
                </div>
              </div>

              {gestionnaire.member.telephone && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Telephone</p>
                    <p className="text-sm font-medium text-gray-900">
                      {gestionnaire.member.telephone}
                    </p>
                  </div>
                </div>
              )}

              {gestionnaire.member.adresse && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Adresse</p>
                    <p className="text-sm font-medium text-gray-900">
                      {gestionnaire.member.adresse}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Informations de gestion */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              Informations de gestion
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">ID Gestionnaire</p>
                <p className="text-lg font-bold text-gray-900">#{gestionnaire.id}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">ID Membre</p>
                <p className="text-lg font-bold text-gray-900">#{gestionnaire.memberId}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">Statut membre</p>
                <p className="text-lg font-bold text-gray-900">{gestionnaire.member.etat}</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Historique
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-gray-500">Cree le</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(gestionnaire.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-gray-500">Derniere modification</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(gestionnaire.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
