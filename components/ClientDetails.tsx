'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import CreditEcheancier from '@/components/CreditEcheancier';
import BordereauRemboursement from '@/components/BordereauRemboursement';
import {
  Phone, MapPin, Calendar, Activity, ArrowLeft, Edit, Trash2,
  AlertTriangle, Hash, Briefcase, Store,
  CreditCard, TrendingDown, BarChart2, UserCheck,
  FileText, Navigation, Clock, ChevronDown, ChevronUp,
  Banknote, ShoppingBag, RefreshCw, Shield,
  Wallet, CheckCircle2, XCircle, AlertCircle, ChevronRight,
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

interface VenteDirecte {
  id: number;
  reference: string;
  statut: string;
  modePaiement: string;
  montantTotal: string | number;
  montantPaye: string | number;
  createdAt: string;
  pointDeVente: { id: number; nom: string; code: string };
  lignes: {
    id: number; quantite: number;
    prixUnitaire: string | number; montant: string | number;
    produit: { id: number; nom: string };
  }[];
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
  numeroCarteAfrisime: string | null;
  activite: string | null; nomCommerce: string | null;
  latitude: number | null; longitude: number | null;
  typeClient: string | null; limiteCredit: string | number | null;
  soldeActuel: string | number | null;
  niveauRisque: string | null; scoreSolvabilite: number | null;
  // Relations
  pointDeVente?: { id: number; nom: string; code: string } | null;
  pointsDeVente?: { pointDeVente: { id: number; nom: string; code: string } }[];
  agentTerrain?: { id: number; nom: string; prenom: string; telephone?: string | null } | null;
  souscriptionsPacks?: SouscriptionPack[];
  ventesDirectes?: VenteDirecte[];
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

const CREDIT_STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE_VALIDATION: 'bg-amber-100 text-amber-700',
  VALIDE:   'bg-blue-100 text-blue-700',
  ACTIF:    'bg-emerald-100 text-emerald-700',
  EN_RETARD:'bg-red-100 text-red-700',
  SOLDE:    'bg-gray-100 text-gray-600',
  ANNULE:   'bg-gray-100 text-gray-500',
  REJETE:   'bg-red-50 text-red-400',
};
const CREDIT_STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE_VALIDATION: 'En attente',
  VALIDE:   'Validé',
  ACTIF:    'Actif',
  EN_RETARD:'En retard',
  SOLDE:    'Soldé',
  ANNULE:   'Annulé',
  REJETE:   'Rejeté',
};
const REMB_STATUT_STYLE: Record<string, string> = {
  CONFIRME:           'bg-emerald-100 text-emerald-700',
  EN_ATTENTE_CAISSIER:'bg-amber-100 text-amber-700',
  REJETE:             'bg-red-100 text-red-700',
};
const REMB_STATUT_LABEL: Record<string, string> = {
  CONFIRME:           'Confirmé',
  EN_ATTENTE_CAISSIER:'En attente',
  REJETE:             'Rejeté',
};

function Field({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 flex items-center gap-1">{icon}{label}</span>
      <span className="text-sm font-medium text-gray-800">{value ?? <span className="text-gray-400 italic">Non renseigné</span>}</span>
    </div>
  );
}

// ─── Timeline types ───────────────────────────────────────────────────────────

interface TimelineItem {
  id:        string;
  type:      'COLLECTE' | 'VERSEMENT' | 'VENTE' | 'CREDIT' | 'AUDIT';
  date:      string;
  titre:     string;
  detail:    string;
  montant?:  number;
  statut?:   string;
  reference?: string;
}

interface HistoriqueResponse {
  data: TimelineItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Crédits types ────────────────────────────────────────────────────────────

interface EcheanceCreditItem {
  id: number;
  numeroEcheance: number;
  dateEcheance: string;
  montantDu: number | string;
  montantPaye: number | string;
  statut: string;
  penalite: number | string;
}

interface CreditLigne {
  id: number;
  produitNom: string;
  quantite: number;
  prixUnitaire: number | string;
  montantLigne: number | string;
}

interface RemboursementItem {
  id: number;
  montant: number | string;
  dateRemboursement: string;
  modePaiement: string;
  notes: string | null;
  statut: string;
  numeroJour: number | null;
  montantAttendu: number | string | null;
  enregistrePar: { id: number; nom: string; prenom: string };
  agentCollecteur: { id: number; nom: string; prenom: string } | null;
}

interface CreditItem {
  id: number;
  reference: string;
  statut: string;
  montantTotal: number | string;
  montantRembourse: number | string;
  soldeRestant: number | string;
  dureeJours: number;
  dateDebut: string;
  dateEcheanceFin: string;
  montantJournalier: number | string;
  fraisDossier: number | string;
  assurance: number | string;
  autresFrais: number | string;
  fraisLivraison: number | string;
  tauxInteret: number | string;
  montantInteret: number | string;
  tauxPenalite: number | string;
  delaiGraceJours: number;
  garantie: string | null;
  garantNom: string | null;
  garantTelephone: string | null;
  garantAdresse: string | null;
  garantTypeGarantie: string | null;
  garantValeurEstimee: number | string;
  observations: string | null;
  createdAt: string;
  lignes: CreditLigne[];
  echeances: EcheanceCreditItem[];
  remboursements: RemboursementItem[];
  creePar: { id: number; nom: string; prenom: string };
  validePar: { id: number; nom: string; prenom: string } | null;
}

interface CreditsClientResponse {
  data: CreditItem[];
  stats: {
    total: number;
    actifs: number;
    enRetard: number;
    soldes: number;
    enAttente: number;
    montantTotalEmprunte: number;
    montantTotalRembourse: number;
    soldeRestantTotal: number;
    montantEnCours: number;
    echeancesEnRetard: number;
    prochaineEcheance: string | null;
  };
}

const TIMELINE_ICON: Record<TimelineItem['type'], React.ReactNode> = {
  COLLECTE:  <Banknote  className="w-4 h-4" />,
  VERSEMENT: <TrendingDown className="w-4 h-4" />,
  VENTE:     <ShoppingBag className="w-4 h-4" />,
  CREDIT:    <CreditCard className="w-4 h-4" />,
  AUDIT:     <Shield    className="w-4 h-4" />,
};

const TIMELINE_COLOR: Record<TimelineItem['type'], string> = {
  COLLECTE:  'bg-teal-100 text-teal-700',
  VERSEMENT: 'bg-blue-100 text-blue-700',
  VENTE:     'bg-purple-100 text-purple-700',
  CREDIT:    'bg-violet-100 text-violet-700',
  AUDIT:     'bg-gray-100 text-gray-600',
};

// ─── Composant ────────────────────────────────────────────────────────────────

interface ClientDetailsProps {
  clientId: string;
  /** Préfixe des routes API (défaut : admin). Ex. /api/rvc/clients */
  apiBase?: string;
  /** Préfixe des routes dashboard pour retour/édition (défaut : admin). */
  basePath?: string;
  /** Affiche les actions Modifier / Supprimer (réservé admin). */
  canModify?: boolean;
}

export default function ClientDetails({
  clientId,
  apiBase = '/api/admin/clients',
  basePath = '/dashboard/admin/clients',
  canModify = true,
}: ClientDetailsProps) {
  const router = useRouter();
  const { data: response, loading, error, refetch } = useApi<{ data: Client }>(`${apiBase}/${clientId}`);
  const { mutate: deleteClient, loading: deleting } = useMutation(`${apiBase}/${clientId}`, 'DELETE', { successMessage: 'Client supprimé avec succès' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [timelinePage, setTimelinePage] = useState(1);
  const { data: histRes, loading: histLoading, refetch: histRefetch } =
    useApi<HistoriqueResponse>(`${apiBase}/${clientId}/historique?page=${timelinePage}&limit=20`);

  // ── Onglets bas de page ────────────────────────────────────────────────────
  type TabId = 'versements' | 'credits' | 'histo-credit' | 'bordereau' | 'ventes' | 'historique';
  const [activeTab, setActiveTab] = useState<TabId>('versements');
  const [expandedCredits, setExpandedCredits] = useState<Set<number>>(new Set());
  const [bordereauCredit, setBordereauCredit] = useState<CreditItem | null>(null);
  const { data: creditsRes, loading: creditsLoading, refetch: creditsRefetch } =
    useApi<CreditsClientResponse>(`${apiBase}/${clientId}/credits`);

  const toggleCredit = (id: number) =>
    setExpandedCredits((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const client = response?.data;

  const handleDelete = async () => {
    setDeleteError(null);
    const result = await deleteClient({});
    if (result) router.push(basePath);
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
            <Link href={basePath} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Fiche client</h1>
              {client.codeClient && <p className="text-sm text-gray-400 font-mono mt-0.5">{client.codeClient}</p>}
            </div>
          </div>
          {canModify && (
            <div className="flex items-center gap-3">
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 text-sm">
                <Trash2 className="w-4 h-4" /> Supprimer
              </button>
              <Link href={`${basePath}/${clientId}/edit`}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm">
                <Edit className="w-4 h-4" /> Modifier
              </Link>
            </div>
          )}
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
              {(client.limiteCredit != null || client.soldeActuel != null) && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        {/* ── Onglets bas de page ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {(
              [
                { id: 'versements' as TabId, label: 'Versements & Créances', icon: <Activity className="w-4 h-4" />, count: client.souscriptionsPacks?.length },
                { id: 'credits'    as TabId, label: 'Crédits',               icon: <CreditCard className="w-4 h-4" />, count: creditsRes?.data.length, alert: (creditsRes?.stats.enRetard ?? 0) > 0 },
                { id: 'histo-credit' as TabId, label: 'Historique crédit',    icon: <Banknote className="w-4 h-4" /> },
                { id: 'bordereau'  as TabId, label: 'Bordereau de remboursement', icon: <FileText className="w-4 h-4" />, count: creditsRes?.data.length },
                { id: 'ventes'     as TabId, label: 'Ventes',                 icon: <ShoppingBag className="w-4 h-4" />, count: client.ventesDirectes?.length },
                { id: 'historique' as TabId, label: 'Historique',             icon: <Clock className="w-4 h-4" />, count: histRes?.meta.total },
              ] as { id: TabId; label: string; icon: React.ReactNode; count?: number; alert?: boolean }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700 bg-blue-50/40'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                    tab.alert ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: VERSEMENTS & CRÉANCES ─────────────────────────────── */}
          {activeTab === 'versements' && (
          <div className="p-6">
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
          )}

          {/* ── Tab: CRÉDITS ───────────────────────────────────────────── */}
          {activeTab === 'credits' && (
          <div className="p-6">
            {/* Stats */}
            {creditsRes?.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'En cours',   value: creditsRes.stats.actifs,    color: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: 'En retard',  value: creditsRes.stats.enRetard,  color: 'text-red-700',     bg: 'bg-red-50' },
                  { label: 'Soldés',     value: creditsRes.stats.soldes,    color: 'text-gray-700',    bg: 'bg-gray-50' },
                  { label: 'Solde total',value: formatCurrency(creditsRes.stats.soldeRestantTotal), color: 'text-blue-700', bg: 'bg-blue-50', wide: true },
                ].map((s) => (
                  <div key={s.label} className={`${s.bg} rounded-lg p-3`}>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Liste crédits */}
            {creditsLoading && !creditsRes ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Chargement…
              </div>
            ) : !creditsRes?.data.length ? (
              <div className="text-center py-10">
                <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucun crédit pour ce client</p>
              </div>
            ) : (
              <div className="space-y-3">
                {creditsRes.data.map((credit) => {
                  const pct = Number(credit.montantTotal) > 0
                    ? Math.min(100, Math.round((Number(credit.montantRembourse) / Number(credit.montantTotal)) * 100))
                    : 0;
                  const expanded = expandedCredits.has(credit.id);
                  const now = new Date();
                  const enRetardCount = credit.echeances.filter(
                    (e) => e.statut !== 'PAYE' && new Date(e.dateEcheance) < now
                  ).length;

                  return (
                    <div key={credit.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      {/* En-tête crédit */}
                      <button
                        onClick={() => toggleCredit(credit.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0">
                            {credit.statut === 'SOLDE' ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : credit.statut === 'EN_RETARD' ? (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            ) : credit.statut === 'ANNULE' || credit.statut === 'REJETE' ? (
                              <XCircle className="w-5 h-5 text-gray-400" />
                            ) : (
                              <Wallet className="w-5 h-5 text-blue-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 font-mono">{credit.reference}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatDate(credit.dateDebut)} → {formatDate(credit.dateEcheanceFin)} · {credit.dureeJours}j</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                          {enRetardCount > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                              {enRetardCount} en retard
                            </span>
                          )}
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-800">{formatCurrency(Number(credit.montantTotal))}</p>
                            <p className="text-xs text-gray-500">Restant : <span className={Number(credit.soldeRestant) > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600'}>{formatCurrency(Number(credit.soldeRestant))}</span></p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CREDIT_STATUT_STYLE[credit.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                            {CREDIT_STATUT_LABEL[credit.statut] ?? credit.statut}
                          </span>
                          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        </div>
                      </button>

                      {/* Barre de progression */}
                      <div className="px-4 pb-2">
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>Remboursé : {formatCurrency(Number(credit.montantRembourse))} ({pct}%)</span>
                          <span>{formatCurrency(Number(credit.montantJournalier))}/jour</span>
                        </div>
                      </div>

                      {/* Détail expandable */}
                      {expanded && (
                        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/50">

                          {/* Produits achetés */}
                          {credit.lignes.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Produits achetés</p>
                              <div className="space-y-1">
                                {credit.lignes.map((l) => (
                                  <div key={l.id} className="flex items-center justify-between text-xs text-gray-700 bg-white rounded-lg px-3 py-2">
                                    <span>{l.produitNom} × {l.quantite}</span>
                                    <span className="font-medium">{formatCurrency(Number(l.montantLigne))}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Échéancier complet (tableau coloré) */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Échéancier ({credit.dureeJours} jours)
                            </p>
                            <CreditEcheancier credit={credit} defaultVisible={7} />
                          </div>

                          {/* Remboursements */}
                          {credit.remboursements.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Remboursements ({credit.remboursements.length})
                              </p>
                              <div className="space-y-1">
                                {credit.remboursements.slice(0, 10).map((r) => (
                                  <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2">
                                    <span className="text-gray-500">{formatDate(r.dateRemboursement)}</span>
                                    <span className="text-gray-500 mx-2">{r.modePaiement.replace('_', ' ')}</span>
                                    <span className="text-emerald-700 font-semibold">{formatCurrency(Number(r.montant))}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Métadonnées */}
                          <div className="flex gap-4 text-xs text-gray-400">
                            <span>Créé par {credit.creePar.prenom} {credit.creePar.nom}</span>
                            {credit.validePar && <span>· Validé par {credit.validePar.prenom} {credit.validePar.nom}</span>}
                            {credit.garantie && <span>· Garantie : {credit.garantie}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end mt-3">
              <button onClick={creditsRefetch} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Actualiser
              </button>
            </div>
          </div>
          )}

          {/* ── Tab: HISTORIQUE CRÉDIT ─────────────────────────────────── */}
          {activeTab === 'histo-credit' && (() => {
            const remboursements = (creditsRes?.data ?? [])
              .flatMap((c) => c.remboursements.map((r) => ({ ...r, creditRef: c.reference })))
              .sort((a, b) => new Date(b.dateRemboursement).getTime() - new Date(a.dateRemboursement).getTime());
            const st = creditsRes?.stats;
            return (
              <div className="p-6 space-y-6">
                {/* Informations générales */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wide mb-3">
                    <UserCheck className="w-4 h-4 text-emerald-600" /> Informations générales
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 rounded-xl p-4">
                    <Field label="Nom"               value={`${client.prenom} ${client.nom}`} icon={<Hash className="w-3 h-3" />} />
                    <Field label="Téléphone"         value={client.telephone} icon={<Phone className="w-3 h-3" />} />
                    <Field label="Adresse"           value={client.adresse} icon={<MapPin className="w-3 h-3" />} />
                    <Field label="Date d'inscription" value={formatDate(client.createdAt)} icon={<Calendar className="w-3 h-3" />} />
                    <Field label="Agent responsable"  value={client.agentTerrain ? `${client.agentTerrain.prenom} ${client.agentTerrain.nom}` : null} icon={<UserCheck className="w-3 h-3" />} />
                    <Field label="Crédits actifs"     value={st ? `${st.actifs + st.enRetard}` : '—'} icon={<CreditCard className="w-3 h-3" />} />
                    <Field label="Crédit en cours"    value={st ? formatCurrency(st.montantEnCours) : '—'} icon={<Wallet className="w-3 h-3" />} />
                    <Field label="Solde restant"      value={st ? formatCurrency(st.soldeRestantTotal) : '—'} icon={<TrendingDown className="w-3 h-3" />} />
                    <Field label="Prochaine échéance"  value={st?.prochaineEcheance ? formatDate(st.prochaineEcheance) : 'Aucune'} icon={<Clock className="w-3 h-3" />} />
                  </div>
                </div>

                {/* Historique des remboursements (complet, non modifiable) */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wide">
                      <Banknote className="w-4 h-4 text-emerald-600" /> Historique des remboursements ({remboursements.length})
                    </h3>
                    <button onClick={creditsRefetch} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                      <RefreshCw className={`w-3 h-3 ${creditsLoading ? 'animate-spin' : ''}`} /> Actualiser
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">Historique complet et non modifiable.</p>
                  {creditsLoading && !creditsRes ? (
                    <div className="flex items-center justify-center py-8 text-gray-400">
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Chargement…
                    </div>
                  ) : remboursements.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-6">Aucun remboursement enregistré</p>
                  ) : (
                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Date</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Jour</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Attendu</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Reçu</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Mode</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Agent</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Observation</th>
                            <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {remboursements.map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 text-gray-600 text-xs">{formatDate(r.dateRemboursement)}</td>
                              <td className="px-4 py-2.5 text-gray-500 text-xs">{r.numeroJour != null ? `J${r.numeroJour}` : '—'}</td>
                              <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{r.montantAttendu != null ? formatCurrency(Number(r.montantAttendu)) : '—'}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{formatCurrency(Number(r.montant))}</td>
                              <td className="px-4 py-2.5 text-gray-500 text-xs">{r.modePaiement ? r.modePaiement.replace(/_/g, ' ') : '—'}</td>
                              <td className="px-4 py-2.5 text-gray-600 text-xs">
                                {r.agentCollecteur
                                  ? `${r.agentCollecteur.prenom} ${r.agentCollecteur.nom}`
                                  : `${r.enregistrePar.prenom} ${r.enregistrePar.nom}`}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[14rem] truncate" title={r.notes ?? ''}>{r.notes || '—'}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REMB_STATUT_STYLE[r.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {REMB_STATUT_LABEL[r.statut] ?? r.statut}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Tab: BORDEREAU DE REMBOURSEMENT ────────────────────────── */}
          {activeTab === 'bordereau' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wide">
                <FileText className="w-4 h-4 text-emerald-600" /> Bordereau de remboursement
              </h3>
              <button onClick={creditsRefetch} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${creditsLoading ? 'animate-spin' : ''}`} /> Actualiser
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Sélectionnez un crédit pour générer son bordereau de remboursement (aperçu + impression couleur ou N/B).
            </p>
            {creditsLoading && !creditsRes ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Chargement…
              </div>
            ) : !creditsRes?.data.length ? (
              <div className="text-center py-10">
                <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucun crédit pour ce client</p>
              </div>
            ) : (
              <div className="space-y-2">
                {creditsRes.data.map((credit) => (
                  <div key={credit.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 font-mono">{credit.reference}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(credit.dateDebut)} → {formatDate(credit.dateEcheanceFin)} · {credit.dureeJours}j · {formatCurrency(Number(credit.montantTotal))}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CREDIT_STATUT_STYLE[credit.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                        {CREDIT_STATUT_LABEL[credit.statut] ?? credit.statut}
                      </span>
                      <button
                        onClick={() => setBordereauCredit(credit)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors">
                        <FileText className="w-3.5 h-3.5" /> Bordereau
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* ── Tab: VENTES ────────────────────────────────────────────── */}
          {activeTab === 'ventes' && (
          <div className="p-6">
            {!(client.ventesDirectes?.length) ? (
              <p className="text-sm text-gray-400 italic text-center py-8">Aucune vente directe</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 uppercase tracking-wide">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    Ventes au comptant ({client.ventesDirectes!.length})
                  </h3>
                  <span className="text-xs text-gray-400">
                    Total : {formatCurrency(client.ventesDirectes!.reduce((s, v) => s + Number(v.montantTotal), 0))}
                  </span>
                </div>
                <div className="space-y-3">
                  {client.ventesDirectes!.map((v) => (
                    <div key={v.id} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{v.reference}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(v.createdAt)} · {v.pointDeVente.nom}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-700">{formatCurrency(Number(v.montantTotal))}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            v.statut === 'LIVREE' || v.statut === 'SORTIE_VALIDEE' ? 'bg-emerald-100 text-emerald-700'
                            : v.statut === 'CONFIRMEE' ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>
                            {v.statut.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{v.modePaiement.replace('_', ' ')}</span>
                        <span>{v.lignes.length} article(s)</span>
                        <span>{v.lignes.map((l) => `${l.quantite}× ${l.produit.nom}`).join(', ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          )}

          {/* ── Tab: HISTORIQUE ────────────────────────────────────────── */}
          {activeTab === 'historique' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Inscrit le {formatDate(client.createdAt)}</span>
                <span>·</span>
                <span>Modifié le {formatDate(client.updatedAt)}</span>
              </div>
              <button onClick={histRefetch} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${histLoading ? 'animate-spin' : ''}`} /> Actualiser
              </button>
            </div>

            {histLoading && !histRes ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Chargement…
              </div>
            ) : !histRes?.data.length ? (
              <p className="text-sm text-gray-400 italic text-center py-6">Aucun événement enregistré</p>
            ) : (
              <>
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-100" />
                  <div className="space-y-0">
                    {histRes.data.map((item, i) => (
                      <div key={item.id} className={`relative flex gap-4 ${i > 0 ? 'pt-4' : ''}`}>
                        <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${TIMELINE_COLOR[item.type]}`}>
                          {TIMELINE_ICON[item.type]}
                        </div>
                        <div className="flex-1 pb-4 border-b border-gray-50 last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{item.titre}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
                              {item.reference && <p className="text-xs text-gray-400 font-mono mt-0.5">{item.reference}</p>}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {item.montant != null && <p className="text-sm font-semibold text-gray-800">{formatCurrency(item.montant)}</p>}
                              <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(item.date)}</p>
                              {item.statut && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 mt-0.5 inline-block">
                                  {item.statut.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {histRes.meta.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                    <span>Page {histRes.meta.page} / {histRes.meta.totalPages}</span>
                    <div className="flex gap-2">
                      <button disabled={timelinePage === 1} onClick={() => setTimelinePage((p) => p - 1)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-xs">Précédent</button>
                      <button disabled={timelinePage === histRes.meta.totalPages} onClick={() => setTimelinePage((p) => p + 1)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-xs">Suivant</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          )}

        </div>{/* fin onglets */}
      </div>

      {bordereauCredit && (
        <BordereauRemboursement
          credit={bordereauCredit}
          client={client}
          onClose={() => setBordereauCredit(null)}
        />
      )}
    </div>
  );
}
