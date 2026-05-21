'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import {
  Phone, MapPin, Calendar, Activity, ArrowLeft, Edit, Trash2,
  AlertTriangle, Hash, Briefcase, Store,
  CreditCard, TrendingDown, BarChart2, UserCheck,
  FileText, Navigation,
} from 'lucide-react';
import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SouscriptionPack {
  id: number;
  statut: string;
  montantTotal: string | number;
  montantVerse: string | number;
  montantRestant: string | number;
  dateDebut: string;
  pack: { id: number; nom: string; type: string };
}

interface Client {
  id: number;
  // Legacy
  nom: string; prenom: string; telephone: string; adresse: string | null; etat: string;
  createdAt: string; updatedAt: string;
  // Nouveaux champs
  codeClient: string | null;
  sexe: string | null;
  dateNaissance: string | null;
  telephoneSecondaire: string | null;
  quartier: string | null; ville: string | null;
  photoUrl: string | null; pieceIdentiteUrl: string | null; numeroCNI: string | null;
  activite: string | null; nomCommerce: string | null;
  latitude: number | null; longitude: number | null;
  typeClient: string | null; limiteCredit: string | number | null;
  soldeActuel: string | number | null;
  niveauRisque: string | null; scoreSolvabilite: number | null;
  // Relations
  pointDeVente?: { id: number; nom: string; code: string } | null;
  pointsDeVente?: { pointDeVente: { id: number; nom: string; code: string } }[];
  agentTerrain?: { id: number; nom: string; prenom: string } | null;
  souscriptionsPacks?: SouscriptionPack[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ETAT_STYLE: Record<string, string> = {
  ACTIF:    'bg-emerald-100 text-emerald-700',
  INACTIF:  'bg-gray-100 text-gray-600',
  SUSPENDU: 'bg-amber-100 text-amber-700',
  BLOQUE:   'bg-red-100 text-red-700',
};
const ETAT_LABEL: Record<string, string> = {
  ACTIF: 'Actif', INACTIF: 'Inactif', SUSPENDU: 'Suspendu', BLOQUE: 'Bloqué',
};
const RISQUE_STYLE: Record<string, string> = {
  FAIBLE:   'bg-emerald-100 text-emerald-700',
  MOYEN:    'bg-amber-100 text-amber-700',
  ELEVE:    'bg-orange-100 text-orange-700',
  CRITIQUE: 'bg-red-100 text-red-700',
};
const SOUS_STATUT_STYLE: Record<string, string> = {
  ACTIF:     'bg-emerald-100 text-emerald-700',
  EN_ATTENTE:'bg-amber-100 text-amber-700',
  COMPLETE:  'bg-blue-100 text-blue-700',
  ANNULE:    'bg-red-100 text-red-700',
};
const SEXE_LABEL: Record<string, string> = { MASCULIN: 'Masculin', FEMININ: 'Féminin', AUTRE: 'Autre' };
const TYPE_CLIENT_LABEL: Record<string, string> = { COMPTANT: 'Comptant', CREDIT: 'Crédit' };

function Field({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 flex items-center gap-1">{icon}{label}</span>
      <span className="text-sm font-medium text-gray-800">{value ?? <span className="text-gray-400 italic">Non renseigné</span>}</span>
    </div>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ClientDetails({ clientId }: { clientId: string }) {
  const router = useRouter();
  const { data: response, loading, error, refetch } = useApi<{ data: Client }>(`/api/admin/clients/${clientId}`);
  const { mutate: deleteClient, loading: deleting } = useMutation(`/api/admin/clients/${clientId}`, 'DELETE', { successMessage: 'Client supprimé avec succès' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const client = response?.data;

  const handleDelete = async () => {
    setDeleteError(null);
    const result = await deleteClient({});
    if (result) router.push('/dashboard/admin/clients');
    else setDeleteError("Impossible de supprimer ce client. Il a peut-être des activités associées.");
  };

  if (loading && !client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
          <p className="text-gray-500 font-medium">Chargement du client…</p>
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Erreur</h3>
          <p className="text-gray-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">Réessayer</button>
        </div>
      </div>
    );
  }

  if (!client) return null;

  const pdvList = [
    ...(client.pointsDeVente ?? []).map((r) => r.pointDeVente),
    ...(client.pointDeVente ? [client.pointDeVente] : []),
  ].filter((pdv, idx, arr) => arr.findIndex((x) => x.id === pdv.id) === idx);

  const creances = (client.souscriptionsPacks ?? []).filter((s) => Number(s.montantRestant) > 0 && s.statut !== 'ANNULE' && s.statut !== 'COMPLETE');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin/clients" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Fiche client</h1>
              {client.codeClient && <p className="text-sm text-gray-400 font-mono mt-0.5">{client.codeClient}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 text-sm">
              <Trash2 className="w-4 h-4" /> Supprimer
            </button>
            <Link href={`/dashboard/admin/clients/${clientId}/edit`}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm">
              <Edit className="w-4 h-4" /> Modifier
            </Link>
          </div>
        </div>

        {/* Modal suppression */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Confirmer la suppression</h3>
                  <p className="text-sm text-gray-500">Cette action est irréversible</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4">
                Voulez-vous vraiment supprimer <strong>{client.prenom} {client.nom}</strong> ?
              </p>
              {deleteError && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-sm text-red-600">{deleteError}</p></div>}
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {deleting ? "Suppression…" : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profil + statuts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-6">
            {/* Avatar / photo */}
            <div className="relative flex-shrink-0">
              {client.photoUrl ? (
                <img src={client.photoUrl} alt="photo" className="w-24 h-24 rounded-full object-cover border-2 border-gray-200" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{client.prenom[0]}{client.nom[0]}</span>
                </div>
              )}
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                client.etat === 'ACTIF' ? 'bg-emerald-500' : client.etat === 'BLOQUE' ? 'bg-red-500' : 'bg-amber-400'
              }`} />
            </div>

            {/* Infos principales */}
            <div className="flex-1">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{client.prenom} {client.nom}</h2>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {client.codeClient && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 font-mono"><Hash className="w-3 h-3" />{client.codeClient}</span>
                    )}
                    {client.sexe && <span className="text-xs text-gray-500">{SEXE_LABEL[client.sexe] ?? client.sexe}</span>}
                    {client.dateNaissance && (
                      <span className="flex items-center gap-1 text-xs text-gray-500"><Calendar className="w-3 h-3" />{formatDate(client.dateNaissance)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ETAT_STYLE[client.etat] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ETAT_LABEL[client.etat] ?? client.etat}
                  </span>
                  {client.typeClient && (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${client.typeClient === 'CREDIT' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {TYPE_CLIENT_LABEL[client.typeClient]}
                    </span>
                  )}
                  {client.niveauRisque && (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${RISQUE_STYLE[client.niveauRisque] ?? 'bg-gray-100 text-gray-600'}`}>
                      Risque {client.niveauRisque}
                    </span>
                  )}
                </div>
              </div>

              {/* Métriques financières */}
              {(client.typeClient === 'CREDIT' || client.soldeActuel != null) && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1"><CreditCard className="w-3 h-3" />Limite crédit</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{client.limiteCredit != null ? formatCurrency(Number(client.limiteCredit)) : '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1"><TrendingDown className="w-3 h-3" />Solde actuel</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{client.soldeActuel != null ? formatCurrency(Number(client.soldeActuel)) : '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1"><BarChart2 className="w-3 h-3" />Score solvabilité</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{client.scoreSolvabilite != null ? `${client.scoreSolvabilite}/100` : '—'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coordonnées */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wide">
              <Phone className="w-4 h-4 text-emerald-600" /> Coordonnées
            </h3>
            <Field label="Tél. principal"   value={client.telephone}           icon={<Phone className="w-3 h-3" />} />
            <Field label="Tél. secondaire"  value={client.telephoneSecondaire} icon={<Phone className="w-3 h-3" />} />
            <Field label="N° CNI"           value={client.numeroCNI}           icon={<FileText className="w-3 h-3" />} />
            {client.pieceIdentiteUrl && (
              <div>
                <span className="text-xs text-gray-400 flex items-center gap-1 mb-1"><FileText className="w-3 h-3" />Pièce d&apos;identité</span>
                <a href={client.pieceIdentiteUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline">Voir le document</a>
              </div>
            )}
          </div>

          {/* Localisation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wide">
              <MapPin className="w-4 h-4 text-emerald-600" /> Localisation
            </h3>
            <Field label="Adresse"  value={client.adresse}  icon={<MapPin className="w-3 h-3" />} />
            <Field label="Quartier" value={client.quartier} icon={<MapPin className="w-3 h-3" />} />
            <Field label="Ville"    value={client.ville}    icon={<MapPin className="w-3 h-3" />} />
            {(client.latitude != null && client.longitude != null) && (
              <div>
                <span className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Navigation className="w-3 h-3" />GPS</span>
                <a href={`https://www.google.com/maps?q=${client.latitude},${client.longitude}`} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline">
                  {client.latitude}, {client.longitude}
                </a>
              </div>
            )}
          </div>

          {/* Activité & commerce */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wide">
              <Briefcase className="w-4 h-4 text-emerald-600" /> Activité & commerce
            </h3>
            <Field label="Activité / Métier" value={client.activite}   icon={<Briefcase className="w-3 h-3" />} />
            <Field label="Nom du commerce"   value={client.nomCommerce} icon={<Store className="w-3 h-3" />} />
            <div>
              <span className="text-xs text-gray-400 mb-1 block">Date d&apos;inscription</span>
              <span className="text-sm font-medium text-gray-800">{formatDate(client.createdAt)}</span>
            </div>
          </div>

          {/* Affectation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wide">
              <UserCheck className="w-4 h-4 text-emerald-600" /> Affectation
            </h3>
            <div>
              <span className="text-xs text-gray-400 mb-1 block">Agent terrain</span>
              {client.agentTerrain ? (
                <span className="text-sm font-medium text-gray-800">{client.agentTerrain.prenom} {client.agentTerrain.nom}</span>
              ) : <span className="text-sm text-gray-400 italic">Non affecté</span>}
            </div>
            <div>
              <span className="text-xs text-gray-400 mb-2 block">Points de vente</span>
              {pdvList.length === 0
                ? <span className="text-sm text-gray-400 italic">Aucun PDV assigné</span>
                : <div className="flex flex-wrap gap-2">
                    {pdvList.map((pdv) => (
                      <span key={pdv.id} className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        {pdv.nom} ({pdv.code})
                      </span>
                    ))}
                  </div>
              }
            </div>
          </div>
        </div>

        {/* Souscriptions packs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wide mb-4">
            <Activity className="w-4 h-4 text-emerald-600" />
            Souscriptions packs ({client.souscriptionsPacks?.length ?? 0})
            {creances.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                {creances.length} créance(s)
              </span>
            )}
          </h3>
          {!client.souscriptionsPacks?.length ? (
            <p className="text-sm text-gray-400 italic">Aucune souscription</p>
          ) : (
            <div className="space-y-3">
              {client.souscriptionsPacks.map((sp) => {
                const pct = Number(sp.montantTotal) > 0
                  ? Math.min(100, Math.round((Number(sp.montantVerse) / Number(sp.montantTotal)) * 100))
                  : 0;
                return (
                  <div key={sp.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-800 text-sm">{sp.pack.nom}</span>
                        <span className="ml-2 text-xs text-gray-400">{sp.pack.type}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOUS_STATUT_STYLE[sp.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                        {sp.statut}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Versé : {formatCurrency(Number(sp.montantVerse))}</span>
                      <span>{pct}%</span>
                      <span>Restant : <strong className={Number(sp.montantRestant) > 0 ? 'text-red-600' : 'text-emerald-600'}>{formatCurrency(Number(sp.montantRestant))}</strong></span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Depuis le {formatDate(sp.dateDebut)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Métadonnées */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wide mb-4">
            <Calendar className="w-4 h-4 text-emerald-600" /> Historique
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <div><p className="text-xs text-gray-400">Inscrit le</p><p className="text-sm font-medium text-gray-800">{formatDateTime(client.createdAt)}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              <div><p className="text-xs text-gray-400">Dernière modification</p><p className="text-sm font-medium text-gray-800">{formatDateTime(client.updatedAt)}</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
