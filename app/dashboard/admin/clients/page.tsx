"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Phone, MapPin, Eye, Edit, Trash2, Store, Building2, Link2, Link2Off, X,
  TrendingUp, TrendingDown, CreditCard, ShoppingBag, ChevronDown, ChevronRight, Banknote, Hash,
  AlertTriangle, Package, UserCheck, Navigation, Loader2, Tag,
  Archive, PauseCircle, Ban, CheckCircle, Filter, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { useT } from '@/contexts/AppSettingsContext';
import ClienteleTabBar from '@/components/ClienteleTabBar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PDVOption { id: number; nom: string; code: string; type: string; }
interface ClientPdv { id: number; nom: string; code: string }
interface AgentTerrainOption {
  id: number;
  member: {
    id: number;
    nom: string;
    prenom: string;
    affectationsPDV: { id: number; pointDeVente: { id: number; nom: string; code: string } }[];
  };
}

interface TagOption { id: number; nom: string; couleur: string }

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  etat: string;
  codeClient: string | null;
  quartier: string | null;
  ville: string | null;
  niveauRisque: string | null;
  typeClient: string | null;
  limiteCredit: string | number | null;
  soldeActuel: string | number | null;
  segment: string;
  createdAt: string;
  pointDeVente: ClientPdv | null;
  pointsDeVente?: { pointDeVente: ClientPdv }[];
  agentTerrain: { id: number; nom: string; prenom: string } | null;
  _count: { souscriptionsPacks: number; ventesDirectes: number };
  tags?: { tag: TagOption }[];
}

interface ClientsResponse {
  data: Client[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Types Historique ─────────────────────────────────────────────────────────

interface VersementHisto {
  id: number;
  montant: string;
  type: string;
  datePaiement: string;
  encaisseParNom: string | null;
  notes: string | null;
}

interface SouscriptionHisto {
  id: number;
  statut: string;
  montantTotal: string;
  montantVerse: string;
  montantRestant: string;
  dateDebut: string;
  dateFin: string | null;
  dateCloture: string | null;
  createdAt: string;
  pack: { id: number; nom: string; type: string };
  versements: VersementHisto[];
}

interface LigneVente {
  quantite: number;
  prixUnitaire: string;
  montant: string;
  produit: { nom: string };
}

interface VenteDirecteHisto {
  id: number;
  reference: string;
  montantTotal: string;
  montantPaye: string;
  modePaiement: string;
  statut: string;
  notes: string | null;
  createdAt: string;
  pointDeVente: { nom: string; code: string } | null;
  lignes: LigneVente[];
}

interface HistoriqueData {
  success: boolean;
  client: Client & { pointsDeVente: { pointDeVente: ClientPdv }[] };
  souscriptions: SouscriptionHisto[];
  ventesDirectes: VenteDirecteHisto[];
  totaux: {
    totalVersementsPacks: number;
    totalAchatsDirects: number;
    totalPaye: number;
    totalDu: number;
    nbSouscriptions: number;
    nbAchats: number;
  };
}

// ─── Modal tags d'un client ───────────────────────────────────────────────────

function TagsClientModal({
  client,
  allTags,
  onClose,
  onSuccess,
}: {
  client: Client;
  allTags: TagOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const currentTagIds = new Set((client.tags ?? []).map((t) => t.tag.id));
  const [loading, setLoading] = useState<number | null>(null);

  // Tags compatibles avec le segment du client (universels + spécifiques au segment)
  const compatibleTags = allTags; // le back vérifie la compatibilité

  const toggle = async (tag: TagOption) => {
    const isAttached = currentTagIds.has(tag.id);
    setLoading(tag.id);
    try {
      const r = await fetch(`/api/admin/clients/${client.id}/tags`, {
        method:  isAttached ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tagId: tag.id }),
      });
      const j = await r.json();
      if (r.ok) {
        onSuccess();
      } else {
        const { toast } = await import("sonner");
        toast.error(j.error ?? "Erreur");
      }
    } finally { setLoading(null); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-800">Tags du client</h2>
            <p className="text-xs text-slate-500 mt-0.5">{client.prenom} {client.nom}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">
          {compatibleTags.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Aucun tag disponible.{' '}
              <a href="/dashboard/admin/tags" className="text-indigo-600 underline">Créer des tags</a>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {compatibleTags.map((tag) => {
                const attached = currentTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggle(tag)}
                    disabled={loading === tag.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                      attached
                        ? 'text-white border-transparent'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    style={attached ? { backgroundColor: tag.couleur, borderColor: tag.couleur } : {}}
                  >
                    {loading === tag.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : attached
                        ? <CheckCircle size={13} />
                        : <Plus size={13} />
                    }
                    {tag.nom}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-4">Cliquez sur un tag pour l&apos;ajouter ou le retirer.</p>
        </div>
        <div className="px-6 pb-5">
          <button onClick={onClose}
            className="w-full py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const t = useT();
  const [searchQuery, setSearchQuery]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]                   = useState(1);
  const [filterPdvId, setFilterPdvId]     = useState('');
  const [modalOpen, setModalOpen]         = useState(false);
  const [formData, setFormData]           = useState({
    // Legacy
    nom: '', prenom: '', telephone: '', adresse: '', pointsDeVenteIds: [] as number[],
    // Identité
    sexe: '', dateNaissance: '', telephoneSecondaire: '',
    quartier: '', ville: '',
    photoUrl: '', pieceIdentiteUrl: '', numeroCNI: '',
    // Activité
    activite: '', nomCommerce: '',
    // GPS
    latitude: '', longitude: '',
    // Segment
    segment: 'ORDINAIRE',
    // Type & crédit
    typeClient: '', limiteCredit: '',
    // Statut & affectation
    etat: 'ACTIF', agentTerrainId: '',
  });

  // ── Drawer historique ──────────────────────────────────────────────────────
  const [histoClient,  setHistoClient]    = useState<Client | null>(null);
  const [histoData,    setHistoData]      = useState<HistoriqueData | null>(null);
  const [histoLoading, setHistoLoading]   = useState(false);
  const [expandedSouscriptions, setExpandedSouscriptions] = useState<Set<number>>(new Set());
  const [expandedVentes, setExpandedVentes] = useState<Set<number>>(new Set());

  // ── Modal affectation PDV ───────────────────────────────────────────────────
  const [affectClient, setAffectClient]   = useState<Client | null>(null);
  const [affectPdvIds, setAffectPdvIds]   = useState<number[]>([]);
  const [affectLoading, setAffectLoading] = useState(false);
  const [affectError, setAffectError]     = useState('');

  // ── Modal affectation Agent Terrain ────────────────────────────────────────
  const [affectAgentClient, setAffectAgentClient] = useState<Client | null>(null);
  const [selectedAgentId, setSelectedAgentId]     = useState('');
  const [affectAgentLoading, setAffectAgentLoading] = useState(false);
  const [affectAgentError, setAffectAgentError]   = useState('');

  // ── Filtre agent terrain ────────────────────────────────────────────────────
  const [filterAgentId, setFilterAgentId] = useState('');

  // ── Filtre statut & filtres avancés ────────────────────────────────────────
  const [filterEtat,    setFilterEtat]    = useState('');
  const [filterAvance,  setFilterAvance]  = useState('');
  const [filterSegment, setFilterSegment] = useState('');
  const [filterTagId,   setFilterTagId]   = useState('');

  // ── Modal gestion des tags d'un client ─────────────────────────────────────
  const [tagsClient,    setTagsClient]    = useState<Client | null>(null);

  // ── Quick action statut (suspendre/bloquer/archiver/activer) ───────────────
  const [quickStatusClient, setQuickStatusClient] = useState<Client | null>(null);
  const quickStatusRef = useRef<number | null>(null);
  const { mutate: patchStatus } =
    useMutation(() => `/api/admin/clients/${quickStatusRef.current}`, 'PATCH', { successMessage: 'Statut mis à jour' });

  // ── Suppression inline ──────────────────────────────────────────────────────
  const [deleteConfirmClient, setDeleteConfirmClient] = useState<Client | null>(null);
  const deleteClientRef = useRef<number | null>(null);
  const { mutate: deleteClientMutation, loading: deletingClient } =
    useMutation(() => `/api/admin/clients/${deleteClientRef.current}`, 'DELETE', { successMessage: 'Client supprimé' });

  // ── Modal plafond crédit ─────────────────────────────────────────────────────
  const [plafondClient, setPlafondClient]     = useState<Client | null>(null);
  const [plafondType, setPlafondType]         = useState('');
  const [plafondLimite, setPlafondLimite]     = useState('');
  const [plafondLoading, setPlafondLoading]   = useState(false);
  const [plafondError, setPlafondError]       = useState('');

  const openPlafondModal = (client: Client) => {
    setPlafondClient(client);
    setPlafondType(client.typeClient ?? '');
    setPlafondLimite(client.limiteCredit != null ? String(client.limiteCredit) : '');
    setPlafondError('');
  };

  const handlePlafondSubmit = async () => {
    if (!plafondClient) return;
    setPlafondLoading(true);
    setPlafondError('');
    try {
      const res = await fetch(`/api/admin/clients/${plafondClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeClient:   plafondType  || null,
          limiteCredit: plafondLimite ? Number(plafondLimite) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setPlafondError(json.message ?? 'Erreur'); setPlafondLoading(false); return; }
      setPlafondClient(null);
      refetch();
    } catch {
      setPlafondError('Erreur réseau');
    } finally {
      setPlafondLoading(false);
    }
  };

  // ── Géolocalisation (modal création) ───────────────────────────────────────
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError,   setGeoError]   = useState('');

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non supportée par ce navigateur');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude:  String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }));
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.code === 1 ? 'Permission refusée par le navigateur' : 'Impossible d\'obtenir la position');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (filterPdvId)     params.set('pdvId', filterPdvId);
  if (filterAgentId)   params.set('agentTerrainId', filterAgentId);
  if (filterEtat)      params.set('etat', filterEtat);
  if (filterAvance)    params.set('filtre', filterAvance);
  if (filterSegment)   params.set('segment', filterSegment);
  if (filterTagId)     params.set('tagId', filterTagId);

  const { data: response, loading, error, refetch } =
    useApi<ClientsResponse>(`/api/admin/clients?${params}`);
  const clients = response?.data ?? [];
  const meta    = response?.meta;
   
  // PDV pour filtres et sélecteurs
  const { data: pdvResponse } = useApi<{ data: PDVOption[] }>('/api/admin/pdv?limit=200&actif=true');
  const pdvOptions = pdvResponse?.data ?? [];

  // Tags disponibles
  const { data: tagsResponse } = useApi<{ data: TagOption[] }>('/api/admin/tags');
  const allTags = tagsResponse?.data ?? [];

  // Agents terrain pour filtres et modal d'affectation
  const { data: agentsTerrainResponse } =
    useApi<{ data: AgentTerrainOption[] }>('/api/admin/gestionnaires?role=AGENT_TERRAIN&actif=true&limit=200');
  const agentsTerrainOptions = agentsTerrainResponse?.data ?? [];

  // Mutations
  const { mutate: addClient, loading: adding, error: addError } =
    useMutation('/api/admin/clients', 'POST', { successMessage: 'Client ajouté avec succès' });

  const affectClientIdRef = useRef<number | null>(null);
  const { mutate: patchClient } =
    useMutation(() => `/api/admin/clients/${affectClientIdRef.current}`, 'PATCH', { successMessage: 'Affectation mise à jour !' });

  const affectAgentClientIdRef = useRef<number | null>(null);
  const { mutate: patchClientAgent } =
    useMutation(() => `/api/admin/clients/${affectAgentClientIdRef.current}`, 'PATCH', { successMessage: 'Agent terrain mis à jour !' });

  const getClientPdvs = (client: Client): ClientPdv[] => {
    const relationPdvs = (client.pointsDeVente ?? [])
      .map((r) => r.pointDeVente)
      .filter(Boolean);

    const combined = [...relationPdvs];
    if (client.pointDeVente && !combined.some((p) => p.id === client.pointDeVente?.id)) {
      combined.unshift(client.pointDeVente);
    }

    return combined;
  };

  const toggleId = (list: number[], id: number) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

    
  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addClient({
      nom: formData.nom, prenom: formData.prenom,
      telephone: formData.telephone,
      adresse: formData.adresse || null,
      pointsDeVenteIds: formData.pointsDeVenteIds,
      pointDeVenteId: formData.pointsDeVenteIds[0] ?? null,
      // Nouveaux champs
      sexe:                formData.sexe               || null,
      dateNaissance:       formData.dateNaissance       || null,
      telephoneSecondaire: formData.telephoneSecondaire || null,
      quartier:            formData.quartier            || null,
      ville:               formData.ville               || null,
      photoUrl:            formData.photoUrl            || null,
      pieceIdentiteUrl:    formData.pieceIdentiteUrl    || null,
      numeroCNI:           formData.numeroCNI           || null,
      activite:            formData.activite            || null,
      nomCommerce:         formData.nomCommerce         || null,
      latitude:            formData.latitude            ? Number(formData.latitude)  : null,
      longitude:           formData.longitude           ? Number(formData.longitude) : null,
      segment:             formData.segment,
      typeClient:          formData.typeClient          || null,
      limiteCredit:        formData.limiteCredit        ? Number(formData.limiteCredit) : null,
      etat:                formData.etat,
      agentTerrainId:      formData.agentTerrainId      ? Number(formData.agentTerrainId) : null,
    });
    if (result) {
      setModalOpen(false);
      setFormData({ nom: '', prenom: '', telephone: '', adresse: '', pointsDeVenteIds: [], sexe: '', dateNaissance: '', telephoneSecondaire: '', quartier: '', ville: '', photoUrl: '', pieceIdentiteUrl: '', numeroCNI: '', activite: '', nomCommerce: '', latitude: '', longitude: '', segment: 'ORDINAIRE', typeClient: '', limiteCredit: '', etat: 'ACTIF', agentTerrainId: '' });
      refetch();
    }
  };

  const openAffectModal = (client: Client) => {
    setAffectClient(client);
    setAffectPdvIds(getClientPdvs(client).map((p) => p.id));
    setAffectError('');
  };

  const openAffectAgentModal = (client: Client) => {
    setAffectAgentClient(client);
    setSelectedAgentId(client.agentTerrain ? String(client.agentTerrain.id) : '');
    setAffectAgentError('');
  };

  const handleAffecterAgent = async () => {
    if (!affectAgentClient) return;
    setAffectAgentLoading(true);
    setAffectAgentError('');
    affectAgentClientIdRef.current = affectAgentClient.id;
    const res = await patchClientAgent({ agentTerrainId: selectedAgentId ? Number(selectedAgentId) : null });
    setAffectAgentLoading(false);
    if (res) { setAffectAgentClient(null); refetch(); }
    else setAffectAgentError('Erreur lors de l\'affectation');
  };

  const handleDesaffecterAgent = async () => {
    if (!affectAgentClient) return;
    setAffectAgentLoading(true);
    setAffectAgentError('');
    affectAgentClientIdRef.current = affectAgentClient.id;
    const res = await patchClientAgent({ agentTerrainId: null });
    setAffectAgentLoading(false);
    if (res) { setAffectAgentClient(null); refetch(); }
    else setAffectAgentError('Erreur lors de la désaffectation');
  };

  const handleAffecter = async () => {
    if (!affectClient) return;
    setAffectLoading(true);
    setAffectError('');
    affectClientIdRef.current = affectClient.id;
    const res = await patchClient({
      pointsDeVenteIds: affectPdvIds,
      pointDeVenteId: affectPdvIds[0] ?? null,
    });
    setAffectLoading(false);
    if (res) { setAffectClient(null); refetch(); }
    else setAffectError('Erreur lors de l\'affectation');
  };

  const handleDesaffecter = async () => {
    if (!affectClient) return;
    setAffectLoading(true);
    setAffectError('');
    affectClientIdRef.current = affectClient.id;
    const res = await patchClient({ pointsDeVenteIds: [], pointDeVenteId: null });
    setAffectLoading(false);
    if (res) { setAffectClient(null); refetch(); }
    else setAffectError('Erreur lors de la désaffectation');
  };

  const handleQuickStatus = async (client: Client, etat: string) => {
    quickStatusRef.current = client.id;
    setQuickStatusClient(null);
    await patchStatus({ etat });
    refetch();
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirmClient) return;
    deleteClientRef.current = deleteConfirmClient.id;
    const ok = await deleteClientMutation({});
    if (ok) { setDeleteConfirmClient(null); refetch(); }
  };

  const openHistorique = useCallback(async (client: Client) => {
    setHistoClient(client);
    setHistoData(null);
    setHistoLoading(true);
    setExpandedSouscriptions(new Set());
    setExpandedVentes(new Set());
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/historique`);
      const json: HistoriqueData = await res.json();
      if (json.success) setHistoData(json);
    } catch { /* ignore */ }
    finally { setHistoLoading(false); }
  }, []);

  const toggleSouscription = (id: number) =>
    setExpandedSouscriptions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleVente = (id: number) =>
    setExpandedVentes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const getInitials = (nom: string, prenom: string) => `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">{t('clients_loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">{t('text_error_loading')}</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">{t('btn_retry')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 font-['DM_Sans',sans-serif]"
      onClick={() => setQuickStatusClient(null)}>
      <ClienteleTabBar />
      <div className="max-w-[1600px] mx-auto space-y-6 p-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{t('clients_title')}</h2>
            <p className="text-slate-500 text-sm mt-0.5">{t('clients_subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setModalOpen(true)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
              <Plus size={20} /> {t('clients_add_btn')}
            </button>
          </div>
        </div>


        {/* ══ MODAL — Plafond crédit ════════════════════════════════════════ */}
        {plafondClient && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Plafond de crédit</h2>
                    <p className="text-xs text-slate-500">{plafondClient.prenom} {plafondClient.nom}</p>
                  </div>
                </div>
                <button onClick={() => setPlafondClient(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {plafondError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{plafondError}</p>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Type client</label>
                  <select value={plafondType} onChange={e => setPlafondType(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">-- Non défini --</option>
                    <option value="COMPTANT">Comptant</option>
                    <option value="CREDIT">Crédit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Limite de crédit (FCFA)</label>
                  <input
                    type="number" min={0} value={plafondLimite}
                    onChange={e => setPlafondLimite(e.target.value)}
                    placeholder="Laisser vide = aucun plafond"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {plafondClient.soldeActuel != null
                      ? <>Solde actuel : {Number(plafondClient.soldeActuel).toLocaleString('fr-FR')} FCFA
                        {plafondLimite && Number(plafondLimite) > 0 &&
                          <> — Utilisation : {Math.round((Number(plafondClient.soldeActuel) / Number(plafondLimite)) * 100)}%</>
                        }
                      </>
                      : 'Aucun crédit en cours'
                    }
                  </p>
                </div>

                {plafondLimite && plafondClient.soldeActuel != null &&
                  Number(plafondClient.soldeActuel) >= Number(plafondLimite) && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Le solde actuel dépasse le plafond fixé — le client ne sera pas éligible à un nouveau crédit.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
                <button onClick={() => setPlafondClient(null)}
                  className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                  Annuler
                </button>
                <button onClick={handlePlafondSubmit} disabled={plafondLoading}
                  className="flex items-center gap-2 px-5 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 font-medium">
                  {plafondLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</>
                    : <><CreditCard className="w-4 h-4" /> Enregistrer</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL — Ajout client ══════════════════════════════════════════ */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[92vh]">
              {/* Header fixe */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
                <h2 className="text-lg font-bold text-slate-800">Nouveau client</h2>
                <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>

              {/* Body scrollable */}
              <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
                {addError && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>}

                {/* ─ Identité ─ */}
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Identité</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Nom <span className="text-red-500">*</span></label>
                      <input type="text" required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" placeholder="Nom" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Prénom <span className="text-red-500">*</span></label>
                      <input type="text" required value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" placeholder="Prénom" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Sexe</label>
                      <select value={formData.sexe} onChange={e => setFormData({...formData, sexe: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="">-- Sélectionner --</option>
                        <option value="MASCULIN">Masculin</option>
                        <option value="FEMININ">Féminin</option>
                        <option value="AUTRE">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Date de naissance</label>
                      <input type="date" value={formData.dateNaissance} onChange={e => setFormData({...formData, dateNaissance: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Tél. principal <span className="text-red-500">*</span></label>
                      <input type="text" required value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : 07XXXXXXXX" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Tél. secondaire</label>
                      <input type="text" value={formData.telephoneSecondaire} onChange={e => setFormData({...formData, telephoneSecondaire: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Optionnel" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">N° CNI</label>
                      <input type="text" value={formData.numeroCNI} onChange={e => setFormData({...formData, numeroCNI: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Numéro pièce d'identité" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Statut <span className="text-red-500">*</span></label>
                      <select value={formData.etat} onChange={e => setFormData({...formData, etat: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="ACTIF">Actif</option>
                        <option value="SUSPENDU">Suspendu</option>
                        <option value="BLOQUE">Bloqué</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* ─ Localisation ─ */}
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Localisation</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Adresse</label>
                      <input type="text" value={formData.adresse} onChange={e => setFormData({...formData, adresse: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Rue, numéro…" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Quartier</label>
                      <input type="text" value={formData.quartier} onChange={e => setFormData({...formData, quartier: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Quartier" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Ville</label>
                      <input type="text" value={formData.ville} onChange={e => setFormData({...formData, ville: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ville" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                        <Navigation className="w-3 h-3" /> Localisation GPS
                      </label>
                      {formData.latitude && formData.longitude ? (
                        <div className="flex items-center gap-2">
                          <span className="flex-1 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
                            <Navigation className="w-3.5 h-3.5 shrink-0" />
                            {Number(formData.latitude).toFixed(6)}, {Number(formData.longitude).toFixed(6)}
                          </span>
                          <button type="button"
                            onClick={() => { setFormData(p => ({...p, latitude: '', longitude: ''})); setGeoError(''); }}
                            className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={handleGeolocate} disabled={geoLoading}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                          {geoLoading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Localisation en cours…</>
                            : <><Navigation className="w-4 h-4" /> Obtenir ma position GPS</>}
                        </button>
                      )}
                      {geoError && <p className="text-xs text-red-500 mt-1">{geoError}</p>}
                    </div>
                  </div>
                </section>

                {/* ─ Activité & commerce ─ */}
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Activité & commerce</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Activité / Métier</label>
                      <input type="text" value={formData.activite} onChange={e => setFormData({...formData, activite: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex : Commerçant, Agriculteur…" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Nom du commerce</label>
                      <input type="text" value={formData.nomCommerce} onChange={e => setFormData({...formData, nomCommerce: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Nom de la boutique / entreprise" />
                    </div>
                  </div>
                </section>

                {/* ─ Documents ─ */}
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Documents (URLs)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Photo client (URL)</label>
                      <input type="url" value={formData.photoUrl} onChange={e => setFormData({...formData, photoUrl: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="https://…" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Pièce d&apos;identité (URL)</label>
                      <input type="url" value={formData.pieceIdentiteUrl} onChange={e => setFormData({...formData, pieceIdentiteUrl: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="https://…" />
                    </div>
                  </div>
                </section>

                {/* ─ Segment ─ */}
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Segment client</p>
                  <div className="flex gap-3">
                    {(['ORDINAIRE', 'RIA'] as const).map((s) => (
                      <label key={s} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.segment === s
                          ? s === 'RIA'
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-400 bg-slate-50 text-slate-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-500'
                      }`}>
                        <input type="radio" name="segment" value={s} checked={formData.segment === s}
                          onChange={() => setFormData({...formData, segment: s})} className="sr-only" />
                        <span className="text-sm font-semibold">{s === 'RIA' ? '★ RIA' : 'Ordinaire'}</span>
                      </label>
                    ))}
                  </div>
                </section>

                {/* ─ Type client & crédit ─ */}
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Type client & crédit</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Type client</label>
                      <select value={formData.typeClient} onChange={e => setFormData({...formData, typeClient: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="">-- Sélectionner --</option>
                        <option value="COMPTANT">Comptant</option>
                        <option value="CREDIT">Crédit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Limite de crédit (FCFA)</label>
                      <input type="number" min={0} value={formData.limiteCredit} onChange={e => setFormData({...formData, limiteCredit: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Laisser vide = aucun plafond" />
                    </div>
                  </div>
                </section>

                {/* ─ Affectation ─ */}
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Affectation</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Agent terrain</label>
                      <select value={formData.agentTerrainId} onChange={e => setFormData({...formData, agentTerrainId: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="">-- Aucun agent --</option>
                        {agentsTerrainOptions.map(a => (
                          <option key={a.id} value={a.id}>{a.member.prenom} {a.member.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-2">
                        <Store size={13} className="inline mr-1 text-slate-400" />
                        Points de vente (multi-choix)
                      </label>
                      <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                        {pdvOptions.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-sm">
                            <input type="checkbox" checked={formData.pointsDeVenteIds.includes(p.id)}
                              onChange={() => setFormData((prev) => ({ ...prev, pointsDeVenteIds: toggleId(prev.pointsDeVenteIds, p.id) }))} />
                            <span>{p.type === 'DEPOT_CENTRAL' ? '🏭' : '🏪'} {p.nom} ({p.code})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </form>

              {/* Footer fixe */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 flex-shrink-0">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                  Annuler
                </button>
                <button onClick={handleSubmit as never} disabled={adding}
                  className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium">
                  {adding ? t('btn_adding') : t('clients_add_btn')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL — Affectation PDV client ════════════════════════════════ */}
        {affectClient && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setAffectClient(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Affecter à un PDV</h2>
              <p className="text-sm text-slate-500 mb-5">
                {affectClient.prenom} {affectClient.nom} — {affectClient.telephone}
              </p>

              {getClientPdvs(affectClient).length > 0 && (
                <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <Store size={15} className="text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">PDV actuels ({getClientPdvs(affectClient).length})</p>
                    <p className="text-xs text-slate-500 truncate">
                      {getClientPdvs(affectClient).map((p) => `${p.nom} (${p.code})`).join(" • ")}
                    </p>
                  </div>
                  <button onClick={handleDesaffecter} disabled={affectLoading}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium border border-red-200 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
                    <Link2Off size={12} /> Désaffecter
                  </button>
                </div>
              )}

              {affectError && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{affectError}</p>
              )}

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  {getClientPdvs(affectClient).length > 0 ? 'Modifier les PDV du client' : 'Choisir un ou plusieurs PDV'}
                </label>
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                  {pdvOptions.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={affectPdvIds.includes(p.id)}
                        onChange={() => setAffectPdvIds((prev) => toggleId(prev, p.id))}
                      />
                      <span>{p.type === 'DEPOT_CENTRAL' ? '🏭' : '🏪'} {p.nom} ({p.code})</span>
                    </label>
                  ))}
                </div>
                <button onClick={handleAffecter} disabled={affectLoading}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 font-medium flex items-center justify-center gap-2 transition-colors">
                  <Link2 size={15} />
                  {affectLoading ? 'En cours…' : 'Enregistrer les assignations'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL — Affectation Agent Terrain ════════════════════════════ */}
        {affectAgentClient && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setAffectAgentClient(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Affecter un agent terrain</h2>
              <p className="text-sm text-slate-500 mb-5">
                {affectAgentClient.prenom} {affectAgentClient.nom} — {affectAgentClient.telephone}
              </p>

              {affectAgentClient.agentTerrain && (
                <div className="mb-4 flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                  <div className="w-7 h-7 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
                    <UserCheck size={14} className="text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {affectAgentClient.agentTerrain.prenom} {affectAgentClient.agentTerrain.nom}
                    </p>
                    <p className="text-xs text-slate-500">Agent terrain actuel</p>
                  </div>
                  <button onClick={handleDesaffecterAgent} disabled={affectAgentLoading}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium border border-red-200 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
                    <Link2Off size={12} /> Désaffecter
                  </button>
                </div>
              )}

              {affectAgentError && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">
                  {affectAgentError}
                </p>
              )}

              {(() => {
                // Calcul de l'avertissement de zone
                const selectedAgent = selectedAgentId
                  ? agentsTerrainOptions.find(a => String(a.member.id) === selectedAgentId)
                  : null;
                const agentPdvIds = selectedAgent?.member.affectationsPDV.map(a => a.pointDeVente.id) ?? [];
                const clientPdvIds = getClientPdvs(affectAgentClient).map(p => p.id);
                const pdvDifferent =
                  selectedAgent !== null &&
                  agentPdvIds.length > 0 &&
                  clientPdvIds.length > 0 &&
                  !clientPdvIds.some(id => agentPdvIds.includes(id));

                return (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">
                      {affectAgentClient.agentTerrain ? 'Changer d\'agent terrain' : 'Choisir un agent terrain'}
                    </label>
                    <select
                      value={selectedAgentId}
                      onChange={e => setSelectedAgentId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm">
                      <option value="">— Aucun agent —</option>
                      {agentsTerrainOptions.map(a => (
                        <option key={a.id} value={String(a.member.id)}>
                          {a.member.prenom} {a.member.nom}
                          {a.member.affectationsPDV[0]
                            ? ` — ${a.member.affectationsPDV[0].pointDeVente.nom}`
                            : ''}
                        </option>
                      ))}
                    </select>

                    {pdvDifferent && (
                      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-relaxed">
                          <span className="font-semibold">Zones différentes.</span> Le client est rattaché à{' '}
                          <span className="font-semibold">
                            {getClientPdvs(affectAgentClient).map(p => p.nom).join(', ')}
                          </span>{' '}
                          alors que cet agent couvre{' '}
                          <span className="font-semibold">
                            {selectedAgent!.member.affectationsPDV.map(a => a.pointDeVente.nom).join(', ')}
                          </span>.
                          L&apos;affectation reste possible.
                        </p>
                      </div>
                    )}

                    <button onClick={handleAffecterAgent} disabled={affectAgentLoading || !selectedAgentId}
                      className="w-full py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-60 font-medium flex items-center justify-center gap-2 transition-colors">
                      <Link2 size={15} />
                      {affectAgentLoading ? 'En cours…' : affectAgentClient.agentTerrain ? 'Réaffecter' : 'Affecter'}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-5">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">{t('clients_total')}</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">{meta?.total ?? '—'}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">Avec PDV</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">
              {clients.filter(c => getClientPdvs(c).length > 0).length}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">Sans PDV</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">
              {clients.filter(c => getClientPdvs(c).length === 0).length}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">Page</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">{meta?.page ?? '—'} / {meta?.totalPages ?? '—'}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 space-y-3">
          {/* Ligne 1 : recherche + selects */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text"
                placeholder="Nom, téléphone, code client, quartier…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
            </div>
            <select value={filterEtat} onChange={e => { setFilterEtat(e.target.value); setFilterAvance(''); setPage(1); }}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
              <option value="">Tous les statuts</option>
              <option value="ACTIF">Actif</option>
              <option value="SUSPENDU">Suspendu</option>
              <option value="BLOQUE">Bloqué</option>
              <option value="INACTIF">Archivé</option>
            </select>
            <select value={filterPdvId} onChange={e => { setFilterPdvId(e.target.value); setPage(1); }}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
              <option value="">{t('clients_all_pdv')}</option>
              {pdvOptions.map(p => (
                <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>
              ))}
            </select>
            <select value={filterAgentId} onChange={e => { setFilterAgentId(e.target.value); setPage(1); }}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
              <option value="">Tous les agents</option>
              {agentsTerrainOptions.map(a => (
                <option key={a.id} value={String(a.member.id)}>{a.member.prenom} {a.member.nom}</option>
              ))}
            </select>
            <select value={filterSegment} onChange={e => { setFilterSegment(e.target.value); setPage(1); }}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
              <option value="">Tous segments</option>
              <option value="ORDINAIRE">Ordinaire</option>
              <option value="RIA">★ RIA</option>
            </select>
            {allTags.length > 0 && (
              <select value={filterTagId} onChange={e => { setFilterTagId(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
                <option value="">Tous les tags</option>
                {allTags.map(t => (
                  <option key={t.id} value={String(t.id)}>{t.nom}</option>
                ))}
              </select>
            )}
            {(searchQuery || filterPdvId || filterAgentId || filterEtat || filterAvance || filterSegment || filterTagId) && (
              <button onClick={() => { setSearchQuery(''); setDebouncedSearch(''); setFilterPdvId(''); setFilterAgentId(''); setFilterEtat(''); setFilterAvance(''); setFilterSegment(''); setFilterTagId(''); setPage(1); }}
                className="flex items-center gap-1 px-3 py-2.5 text-xs text-red-500 border border-red-200 rounded-xl hover:bg-red-50">
                <X size={14} /> Réinitialiser
              </button>
            )}
          </div>

          {/* Ligne 2 : filtres avancés */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-slate-400 font-medium mr-1">
              <SlidersHorizontal size={13} /> Filtres avancés :
            </span>
            {([
              { key: 'debiteurs',     label: 'Débiteurs',      color: 'bg-red-50 text-red-700 border-red-200',         activeColor: 'bg-red-600 text-white border-red-600' },
              { key: 'en_retard',     label: 'En retard',      color: 'bg-orange-50 text-orange-700 border-orange-200', activeColor: 'bg-orange-500 text-white border-orange-500' },
              { key: 'bloques',       label: 'Bloqués',        color: 'bg-rose-50 text-rose-700 border-rose-200',       activeColor: 'bg-rose-600 text-white border-rose-600' },
              { key: 'gros_clients',  label: 'Gros clients',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200', activeColor: 'bg-emerald-600 text-white border-emerald-600' },
              { key: 'sans_activite', label: 'Sans activité',  color: 'bg-gray-100 text-gray-600 border-gray-200',     activeColor: 'bg-gray-600 text-white border-gray-600' },
              { key: 'archives',      label: 'Archivés',       color: 'bg-slate-100 text-slate-600 border-slate-200',   activeColor: 'bg-slate-600 text-white border-slate-600' },
            ] as const).map(({ key, label, color, activeColor }) => (
              <button key={key}
                onClick={() => { setFilterAvance(filterAvance === key ? '' : key); setFilterEtat(''); setPage(1); }}
                className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${filterAvance === key ? activeColor : color}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Segment / Tags</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Téléphone</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Adresse</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('clients_pdv_affecte')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Agent terrain</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Activités</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-md ${
                          client.etat === 'BLOQUE' ? 'bg-gradient-to-br from-red-500 to-red-600'
                          : client.etat === 'SUSPENDU' ? 'bg-gradient-to-br from-amber-400 to-amber-500'
                          : client.etat === 'INACTIF' ? 'bg-gradient-to-br from-gray-400 to-gray-500'
                          : 'bg-gradient-to-br from-amber-500 to-amber-600'
                        }`}>
                          {getInitials(client.nom, client.prenom)}
                        </div>
                        <div>
                          <Link href={`/dashboard/admin/clients/${client.id}`}
                            className="font-semibold text-slate-800 hover:text-amber-600 transition-colors">
                            {client.prenom} {client.nom}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {client.codeClient && (
                              <span className="text-xs text-slate-400 font-mono">{client.codeClient}</span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              client.etat === 'ACTIF'    ? 'bg-emerald-100 text-emerald-700'
                              : client.etat === 'SUSPENDU' ? 'bg-amber-100 text-amber-700'
                              : client.etat === 'BLOQUE'   ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-500'
                            }`}>
                              {client.etat === 'INACTIF' ? 'Archivé' : client.etat.charAt(0) + client.etat.slice(1).toLowerCase()}
                            </span>
                            {client.niveauRisque && client.niveauRisque !== 'FAIBLE' && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                client.niveauRisque === 'CRITIQUE' ? 'bg-red-100 text-red-700'
                                : client.niveauRisque === 'ELEVE' ? 'bg-orange-100 text-orange-700'
                                : 'bg-amber-100 text-amber-700'
                              }`}>
                                ⚠ {client.niveauRisque}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Segment + Tags */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold w-fit ${
                          client.segment === 'RIA'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {client.segment === 'RIA' ? '★ RIA' : 'Ordinaire'}
                        </span>
                        {(client.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(client.tags ?? []).slice(0, 3).map(({ tag }) => (
                              <span key={tag.id}
                                className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
                                style={{ backgroundColor: tag.couleur }}>
                                {tag.nom}
                              </span>
                            ))}
                            {(client.tags ?? []).length > 3 && (
                              <span className="text-xs text-slate-400">+{(client.tags ?? []).length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone size={14} className="text-slate-400" /> {client.telephone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600">
                        {client.quartier || client.ville ? (
                          <span className="flex items-center gap-1"><MapPin size={13} className="text-slate-400 shrink-0" />{[client.quartier, client.ville].filter(Boolean).join(', ')}</span>
                        ) : client.adresse ? (
                          <span className="flex items-center gap-1"><MapPin size={13} className="text-slate-400 shrink-0" />{client.adresse}</span>
                        ) : <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getClientPdvs(client).length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Store size={12} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{getClientPdvs(client)[0].nom}</p>
                            <p className="text-xs text-slate-400 font-mono">
                              {getClientPdvs(client)[0].code}
                              {getClientPdvs(client).length > 1 ? ` +${getClientPdvs(client).length - 1}` : ""}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">{t('text_no_assign')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {client.agentTerrain ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-teal-100 rounded-lg flex items-center justify-center">
                            <UserCheck size={12} className="text-teal-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {client.agentTerrain.prenom} {client.agentTerrain.nom}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">{t('text_no_assign')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {client._count.souscriptionsPacks > 0 ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium w-fit">
                            {client._count.souscriptionsPacks} pack{client._count.souscriptionsPacks > 1 ? 's' : ''}
                          </span>
                        ) : null}
                        {client._count.ventesDirectes > 0 ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium w-fit">
                            {client._count.ventesDirectes} vente{client._count.ventesDirectes > 1 ? 's' : ''}
                          </span>
                        ) : null}
                        {client._count.souscriptionsPacks === 0 && client._count.ventesDirectes === 0 && (
                          <span className="text-xs text-slate-400 italic">Sans activité</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{formatDate(client.createdAt)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openHistorique(client)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Historique">
                          <Eye size={16} />
                        </button>
                        <Link href={`/dashboard/admin/clients/${client.id}/edit`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier">
                          <Edit size={16} />
                        </Link>
                        <button onClick={() => openAffectModal(client)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title={getClientPdvs(client).length > 0 ? 'PDV affectés' : 'Affecter PDV'}>
                          {getClientPdvs(client).length > 0 ? <Building2 size={16} /> : <Store size={16} />}
                        </button>
                        <button onClick={() => openAffectAgentModal(client)}
                          className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title={client.agentTerrain ? 'Modifier agent' : 'Affecter agent'}>
                          <UserCheck size={16} />
                        </button>
                        <button onClick={() => openPlafondModal(client)}
                          className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          title="Fixer le plafond de crédit">
                          <CreditCard size={16} />
                        </button>
                        <button onClick={() => setTagsClient(client)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Gérer les tags">
                          <Tag size={16} />
                        </button>
                        {/* Menu statut rapide */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setQuickStatusClient(quickStatusClient?.id === client.id ? null : client)}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Changer le statut">
                            <SlidersHorizontal size={16} />
                          </button>
                          {quickStatusClient?.id === client.id && (
                            <div className="absolute right-0 top-9 z-50 bg-white border border-slate-200 rounded-xl shadow-lg w-44 py-1">
                              {client.etat !== 'ACTIF' && (
                                <button onClick={() => handleQuickStatus(client, 'ACTIF')}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
                                  <CheckCircle size={14} /> Activer
                                </button>
                              )}
                              {client.etat !== 'SUSPENDU' && (
                                <button onClick={() => handleQuickStatus(client, 'SUSPENDU')}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50">
                                  <PauseCircle size={14} /> Suspendre
                                </button>
                              )}
                              {client.etat !== 'BLOQUE' && (
                                <button onClick={() => handleQuickStatus(client, 'BLOQUE')}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                                  <Ban size={14} /> Bloquer
                                </button>
                              )}
                              {client.etat !== 'INACTIF' && (
                                <button onClick={() => handleQuickStatus(client, 'INACTIF')}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                                  <Archive size={14} /> Archiver
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setDeleteConfirmClient(client)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">{t('clients_none_found')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {meta && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {t('page')} <span className="font-semibold">{meta.page}</span> / <span className="font-semibold">{meta.totalPages}</span> ({meta.total} {t('clients_title').toLowerCase()})
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  {t('btn_prev')}
                </button>
                <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">{page}</span>
                <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  {t('btn_next')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ MODAL — Gestion des tags d'un client ══════════════════════════ */}
      {tagsClient && (
        <TagsClientModal
          client={tagsClient}
          allTags={allTags}
          onClose={() => setTagsClient(null)}
          onSuccess={() => { setTagsClient(null); refetch(); }}
        />
      )}

      {/* ══ MODAL — Confirmation suppression ════════════════════════════ */}
      {deleteConfirmClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[160] p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirmer la suppression</h3>
                <p className="text-sm text-slate-500">Cette action est irréversible</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              Supprimer <strong>{deleteConfirmClient.prenom} {deleteConfirmClient.nom}</strong> ?
              {(deleteConfirmClient._count.souscriptionsPacks > 0 || deleteConfirmClient._count.ventesDirectes > 0) && (
                <span className="block mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠ Ce client a {deleteConfirmClient._count.souscriptionsPacks} souscription(s) et {deleteConfirmClient._count.ventesDirectes} vente(s) associées.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmClient(null)}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={handleDeleteConfirmed} disabled={deletingClient}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deletingClient ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DRAWER — Historique client ════════════════════════════════════ */}
      {histoClient && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-[140]"
            onClick={() => setHistoClient(null)}
          />
          {/* Panneau latéral */}
          <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-[150] flex flex-col overflow-hidden">

            {/* Header drawer */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {getInitials(histoClient.nom, histoClient.prenom)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{histoClient.prenom} {histoClient.nom}</h2>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-sm text-slate-500 flex items-center gap-1"><Phone size={12} />{histoClient.telephone}</span>
                    {getClientPdvs(histoClient).length > 0 && (
                      <span className="text-sm text-slate-500 flex items-center gap-1"><Store size={12} />{getClientPdvs(histoClient)[0].nom}</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setHistoClient(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/60 rounded-xl transition-colors">
                <X size={22} />
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {histoLoading && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
                  <p className="text-slate-400 text-sm">Chargement de l&apos;historique…</p>
                </div>
              )}

              {!histoLoading && histoData && (
                <>
                  {/* ── Cartes résumé ── */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={16} className="text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Total payé</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700">{formatCurrency(histoData.totaux.totalPaye)}</p>
                      <p className="text-xs text-emerald-600 mt-1">
                        Packs : {formatCurrency(histoData.totaux.totalVersementsPacks)}
                        {histoData.totaux.totalAchatsDirects > 0 && ` · Achats : ${formatCurrency(histoData.totaux.totalAchatsDirects)}`}
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingDown size={16} className="text-red-600" />
                        <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Total dû</span>
                      </div>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(histoData.totaux.totalDu)}</p>
                      <p className="text-xs text-red-500 mt-1">Sur souscriptions en cours</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard size={16} className="text-blue-600" />
                        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Souscriptions</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">{histoData.totaux.nbSouscriptions}</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ShoppingBag size={16} className="text-purple-600" />
                        <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Achats directs</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-700">{histoData.totaux.nbAchats}</p>
                    </div>
                  </div>

                  {/* ── Souscriptions packs ── */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <CreditCard size={15} className="text-blue-500" />
                      Souscriptions packs ({histoData.souscriptions.length})
                    </h3>
                    {histoData.souscriptions.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-2xl">Aucune souscription</div>
                    ) : (
                      <div className="space-y-3">
                        {histoData.souscriptions.map((s) => {
                          const isExpanded = expandedSouscriptions.has(s.id);
                          const statutColor =
                            s.statut === 'COMPLETE' ? 'bg-emerald-100 text-emerald-700' :
                            s.statut === 'ACTIF'    ? 'bg-blue-100 text-blue-700' :
                            s.statut === 'ANNULE'   ? 'bg-red-100 text-red-700' :
                                                      'bg-amber-100 text-amber-700';
                          return (
                            <div key={s.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                              {/* En-tête souscription */}
                              <button
                                onClick={() => toggleSouscription(s.id)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Banknote size={14} className="text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-800 text-sm">{s.pack.nom}</p>
                                    <p className="text-xs text-slate-400">{formatDate(s.createdAt)} · {s.versements.length} versement{s.versements.length > 1 ? 's' : ''}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-emerald-600">{formatCurrency(Number(s.montantVerse))}</p>
                                    {Number(s.montantRestant) > 0 && (
                                      <p className="text-xs text-red-500">Reste : {formatCurrency(Number(s.montantRestant))}</p>
                                    )}
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statutColor}`}>{s.statut}</span>
                                  {isExpanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                                </div>
                              </button>

                              {/* Détail versements */}
                              {isExpanded && (
                                <div className="border-t border-slate-100 bg-slate-50/60 px-4 pb-3">
                                  {/* Barre progression */}
                                  <div className="pt-3 pb-2">
                                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                                      <span>Progression</span>
                                      <span>{Math.min(100, Math.round((Number(s.montantVerse) / Number(s.montantTotal)) * 100))}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (Number(s.montantVerse) / Number(s.montantTotal)) * 100)}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between text-xs mt-1">
                                      <span className="text-emerald-600 font-medium">{formatCurrency(Number(s.montantVerse))} versé</span>
                                      <span className="text-slate-500">{formatCurrency(Number(s.montantTotal))} total</span>
                                    </div>
                                  </div>

                                  {/* Liste versements */}
                                  {s.versements.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-3">Aucun versement enregistré</p>
                                  ) : (
                                    <div className="space-y-1.5 mt-1">
                                      {s.versements.map((v) => (
                                        <div key={v.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-slate-100">
                                          <div className="flex items-center gap-2">
                                            <Hash size={11} className="text-slate-300" />
                                            <div>
                                              <p className="text-xs font-medium text-slate-700">{formatCurrency(Number(v.montant))}</p>
                                              <p className="text-xs text-slate-400">{v.encaisseParNom ?? '—'}</p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-xs text-slate-500">{formatDateTime(v.datePaiement)}</p>
                                            {v.notes && <p className="text-xs text-slate-400 italic truncate max-w-[120px]">{v.notes}</p>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Ventes directes ── */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <ShoppingBag size={15} className="text-purple-500" />
                      Achats directs ({histoData.ventesDirectes.length})
                    </h3>
                    {histoData.ventesDirectes.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-2xl">Aucun achat direct</div>
                    ) : (
                      <div className="space-y-3">
                        {histoData.ventesDirectes.map((v) => {
                          const isExpanded = expandedVentes.has(v.id);
                          const statutColor =
                            v.statut === 'VALIDEE'   ? 'bg-emerald-100 text-emerald-700' :
                            v.statut === 'PARTIELLE' ? 'bg-amber-100 text-amber-700' :
                            v.statut === 'ANNULEE'   ? 'bg-red-100 text-red-700' :
                                                       'bg-slate-100 text-slate-600';
                          return (
                            <div key={v.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                              <button
                                onClick={() => toggleVente(v.id)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
                                    <Package size={14} className="text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-800 text-sm font-mono">{v.reference}</p>
                                    <p className="text-xs text-slate-400">{formatDate(v.createdAt)} · {v.lignes.length} article{v.lignes.length > 1 ? 's' : ''}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-purple-600">{formatCurrency(Number(v.montantPaye))}</p>
                                    <p className="text-xs text-slate-400">{v.modePaiement}</p>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statutColor}`}>{v.statut}</span>
                                  {isExpanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 space-y-1.5">
                                  {v.lignes.map((l, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-slate-100 text-xs">
                                      <span className="font-medium text-slate-700">{l.produit.nom}</span>
                                      <span className="text-slate-500">{l.quantite} × {formatCurrency(Number(l.prixUnitaire))} = <span className="font-semibold text-slate-700">{formatCurrency(Number(l.montant))}</span></span>
                                    </div>
                                  ))}
                                  {v.notes && (
                                    <p className="text-xs text-slate-400 italic px-1">Note : {v.notes}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-between">
              <Link
                href={`/dashboard/admin/clients/${histoClient.id}`}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5"
              >
                <Eye size={14} /> Voir la fiche complète
              </Link>
              <button onClick={() => setHistoClient(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium">
                Fermer
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
