'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDateTime } from '@/lib/format';
import {
  User,
  Phone,
  MapPin,
  Calendar,   
  Activity,
  ArrowLeft,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';

interface SouscriptionPack {
  id: number;
  packId: number;
  pack: {
    id: number;
    nom: string;
  };
  clientId?: number;
  client?: {
    id: number;
    nom: string;
    prenom: string;
  };
  statut: string;
  dateDebut: string;
  dateFin?: string;
  montantTotal: number;
  montantVerse: number;
  montantRestant: number;
  numeroCycle: number;
  bonusObtenu: boolean;
  createdAt: string;
  updatedAt: string;
  // éventuellement versements, echeances, receptions si tu veux les afficher
}
interface ClientDetailsProps {
  clientId: string;
}

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  etat: string;
  createdAt: string;    
  updatedAt: string;
  pointDeVente?: { id: number; nom: string; code: string } | null;
  pointsDeVente?: { pointDeVente: { id: number; nom: string; code: string } }[];
  souscriptionsPacks?: SouscriptionPack[];
}

interface ClientResponse {
  data: Client;
}

export default function ClientDetails({ clientId }: ClientDetailsProps) {
  const router = useRouter();
  const { data: response, loading, error, refetch } = useApi<ClientResponse>(`/api/admin/clients/${clientId}`);
  const { mutate: deleteClient, loading: deleting } = useMutation(`/api/admin/clients/${clientId}`, 'DELETE', { successMessage: 'Client supprimé avec succès' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const client = response?.data;

  const getStatusStyle = (etat: string) => {
    switch (etat) {
      case 'ACTIF':
        return 'bg-green-100 text-green-700';
      case 'INACTIF':
        return 'bg-gray-100 text-gray-700';
      case 'SUSPENDU':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (etat: string) => {
    switch (etat) {
      case 'ACTIF':
        return 'Actif';
      case 'INACTIF':
        return 'Inactif';
      case 'SUSPENDU':
        return 'Suspendu';
      default:
        return etat;
    }
  };

  const getStatusIcon = (etat: string) => {
    switch (etat) {
      case 'ACTIF':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'INACTIF':
        return <XCircle className="w-4 h-4 text-gray-600" />;
      case 'SUSPENDU':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    const result = await deleteClient({});
    if (result) {
      router.push('/dashboard/admin/clients');
    } else {
      setDeleteError("Impossible de supprimer ce client. Il a peut-etre des activites associees.");
    }
  };

  if (loading && !client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
          <p className="text-slate-500 font-medium">Chargement du client...</p>
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  if (!client) return null;

  const totalActivites = client.souscriptionsPacks?.length || 0;
  const pdvList = [
    ...(client.pointsDeVente ?? []).map((r) => r.pointDeVente),
    ...(client.pointDeVente ? [client.pointDeVente] : []),
  ].filter((pdv, idx, arr) => arr.findIndex((x) => x.id === pdv.id) === idx);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* En-tete */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/admin/clients"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Details du client</h1>
              <p className="text-sm text-gray-500 mt-1">
                Informations completes et activites
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
            <Link
              href={`/dashboard/admin/clients/${clientId}/edit`}
              className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Modifier
            </Link>
          </div>
        </div>

        {/* Modal de confirmation de suppression */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Confirmer la suppression</h3>
                  <p className="text-sm text-gray-500">Cette action est irreversible</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4">
                Voulez-vous vraiment supprimer le client <strong>{client.prenom} {client.nom}</strong> ?
              </p>
              {deleteError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{deleteError}</p>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Carte principale */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Profil */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">
                    {client.prenom[0]}{client.nom[0]}
                  </span>
                </div>
                <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-4 border-white flex items-center justify-center ${
                  client.etat === 'ACTIF' ? 'bg-green-500' : client.etat === 'SUSPENDU' ? 'bg-red-500' : 'bg-gray-400'
                }`}>
                  {getStatusIcon(client.etat)}
                </div>
              </div>

              {/* Informations principales */}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {client.prenom} {client.nom}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Client #{client.id}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusStyle(client.etat)}`}>
                    {getStatusLabel(client.etat)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Coordonnees */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-amber-600" />
              Coordonnees
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-1">Telephone</p>
                  <p className="text-sm font-medium text-gray-900">
                    {client.telephone}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-1">Adresse</p>
                  <p className="text-sm font-medium text-gray-900">
                    {client.adresse || 'Non renseignee'}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Points de vente assignés</p>
              {pdvList.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun PDV assigné</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pdvList.map((pdv) => (
                    <span key={pdv.id} className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                      {pdv.nom} ({pdv.code})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activites */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-600" />
              Souscriptions ({totalActivites})
            </h3>
            {client.souscriptionsPacks?.map((sp) => (
              <div key={sp.id} className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-600">{sp.pack.nom}</p>
                <p className="text-xs text-gray-500">{formatDateTime(sp.dateDebut)}</p>
              </div>
            ))}
          </div>

          {/* Dates */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              Historique
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-gray-500">Cree le</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(client.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-gray-500">Derniere modification</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(client.updatedAt)}
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
