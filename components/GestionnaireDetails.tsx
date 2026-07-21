'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import {
  User, Mail, Phone, MapPin, Calendar, Shield, Activity,
  CheckCircle, XCircle, ArrowLeft, Edit,
  Users, TrendingUp, ShoppingBag, Layers, Search, Store, ExternalLink, AlertTriangle,
  UserPlus, UserMinus, X,
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

interface AgentClient {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  etat: string;
  createdAt: string;
  pointDeVente: { id: number; nom: string; code: string } | null;
  _count: { souscriptionsPacks: number; ventesDirectes: number };
  caPacks: number;
  caVentes: number;
  caTotal: number;
}

interface AgentClientsResponse {
  success: boolean;
  clients: AgentClient[];
  agentPdvIds: number[];
  meta: { total: number; caGlobal: number };
}

interface AvailableClient {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  etat: string;
  pointDeVente: { id: number; nom: string; code: string } | null;
}

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'SUPER_ADMIN': return 'bg-red-100 text-red-700';
    case 'ADMIN': return 'bg-purple-100 text-purple-700';
    case 'RESPONSABLE_POINT_DE_VENTE':
    case 'RESPONSABLE_COMMUNAUTE':
    case 'RESPONSABLE_VENTE_CREDIT':
    case 'RESPONSABLE_ECONOMIQUE':
    case 'RESPONSABLE_MARKETING': return 'bg-blue-100 text-blue-700';
    case 'CAISSIER':
    case 'COMPTABLE': return 'bg-amber-100 text-amber-700';
    case 'COMMERCIAL':
    case 'REVENDEUR': return 'bg-emerald-100 text-emerald-700';
    case 'AGENT_LOGISTIQUE_APPROVISIONNEMENT':
    case 'MAGAZINIER': return 'bg-orange-100 text-orange-700';
    case 'CONTROLEUR_TERRAIN':
    case 'AGENT_TERRAIN': return 'bg-teal-100 text-teal-700';
    case 'AUDITEUR_INTERNE': return 'bg-indigo-100 text-indigo-700';
    case 'ACTIONNAIRE': return 'bg-pink-100 text-pink-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const getInitials = (nom: string, prenom: string) =>
  `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();

export default function GestionnaireDetails({ gestionnaireId }: GestionnaireDetailsProps) {
  const [search, setSearch] = useState('');

  // ── Bulk assignment modal state ──────────────────────────────────────────
  const [showBulkModal, setShowBulkModal]   = useState(false);
  const [modalSearch, setModalSearch]       = useState('');
  const [modalClients, setModalClients]     = useState<AvailableClient[]>([]);
  const [modalLoading, setModalLoading]     = useState(false);
  const [selectedIds, setSelectedIds]       = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading]       = useState(false);
  const [bulkError, setBulkError]           = useState<string | null>(null);
  const [unassignLoading, setUnassignLoading] = useState<Set<number>>(new Set());

  // Ref stable pour les IDs déjà assignés (évite les dépendances cycliques)
  const assignedIdsRef = useRef<Set<number>>(new Set());

  const { data: response, loading, error, refetch } =
    useApi<GestionnaireResponse>(`/api/admin/gestionnaires/${gestionnaireId}`);
  const gestionnaire = response?.data;

  const isAgentTerrain = gestionnaire?.role === 'AGENT_TERRAIN';

  const { data: clientsData, refetch: refetchClients } = useApi<AgentClientsResponse>(
    isAgentTerrain ? `/api/admin/gestionnaires/${gestionnaireId}/clients` : null
  );

  const clients = clientsData?.clients ?? [];
  const clientsMeta = clientsData?.meta;
  const agentPdvIds = clientsData?.agentPdvIds ?? [];

  // Mise à jour du ref quand la liste des clients change
  useEffect(() => {
    assignedIdsRef.current = new Set(clients.map(c => c.id));
  }, [clients]);

  // Fetch des clients disponibles pour le modal (avec debounce)
  useEffect(() => {
    if (!showBulkModal) return;
    setModalLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ limit: '100' });
      if (modalSearch.trim()) params.set('search', modalSearch.trim());
      fetch(`/api/admin/clients?${params}`)
        .then(r => r.json())
        .then(data => {
          const all: AvailableClient[] = data.data ?? [];
          setModalClients(all.filter(c => !assignedIdsRef.current.has(c.id)));
        })
        .catch(() => setModalClients([]))
        .finally(() => setModalLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [showBulkModal, modalSearch]);

  const openBulkModal = () => {
    setModalSearch('');
    setSelectedIds(new Set());
    setBulkError(null);
    setShowBulkModal(true);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkAssign = async () => {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    setBulkError(null);
    try {
      const res = await fetch(`/api/admin/gestionnaires/${gestionnaireId}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur');
      setShowBulkModal(false);
      refetchClients?.();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Erreur serveur');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUnassign = async (clientId: number) => {
    setUnassignLoading(prev => new Set(prev).add(clientId));
    try {
      await fetch(`/api/admin/gestionnaires/${gestionnaireId}/clients`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: [clientId] }),
      });
      refetchClients?.();
    } finally {
      setUnassignLoading(prev => { const next = new Set(prev); next.delete(clientId); return next; });
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.nom.toLowerCase().includes(q) ||
      c.prenom.toLowerCase().includes(q) ||
      c.telephone.includes(q)
    );
  }, [clients, search]);

  if (loading && !gestionnaire) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
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
          <button onClick={refetch} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!gestionnaire) return null;

  return (
    <>
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin/gestionnaires"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Détails du gestionnaire</h1>
              <p className="text-sm text-gray-500 mt-1">Informations complètes et activité</p>
            </div>
          </div>
          <Link href={`/dashboard/admin/gestionnaires/${gestionnaireId}/edit`}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <Edit className="w-4 h-4" /> Modifier
          </Link>
        </div>

        {/* Carte principale */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">

          {/* Profil */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start gap-6">
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
                  {gestionnaire.actif
                    ? <CheckCircle className="w-4 h-4 text-white" />
                    : <XCircle className="w-4 h-4 text-white" />}
                </div>
              </div>

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
                      gestionnaire.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {gestionnaire.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
                {gestionnaire.member.role && (
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span className="text-gray-600">Rôle système :</span>
                    <span className="font-medium text-gray-900">{gestionnaire.member.role}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coordonnées */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" /> Coordonnées
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{gestionnaire.member.email}</p>
                </div>
              </div>
              {gestionnaire.member.telephone && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Téléphone</p>
                    <p className="text-sm font-medium text-gray-900">{gestionnaire.member.telephone}</p>
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
                    <p className="text-sm font-medium text-gray-900">{gestionnaire.member.adresse}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Informations de gestion */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" /> Informations de gestion
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

          {/* Historique */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" /> Historique
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <div>
                  <p className="text-xs text-gray-500">Créé le</p>
                  <p className="text-sm font-medium text-gray-900">{formatDateTime(gestionnaire.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <div>
                  <p className="text-xs text-gray-500">Dernière modification</p>
                  <p className="text-sm font-medium text-gray-900">{formatDateTime(gestionnaire.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section clients — uniquement pour AGENT_TERRAIN ─────────────── */}
        {isAgentTerrain && (
          <>
            {/* Stats CA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-50 p-2.5 rounded-xl">
                    <Users size={18} className="text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Clients assignés</span>
                </div>
                <p className="text-3xl font-bold text-slate-800">{clientsMeta?.total ?? 0}</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-emerald-50 p-2.5 rounded-xl">
                    <TrendingUp size={18} className="text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">CA global</span>
                </div>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(clientsMeta?.caGlobal ?? 0)}
                </p>
                <p className="text-xs text-slate-400 mt-1">packs + ventes directes</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-purple-50 p-2.5 rounded-xl">
                    <Layers size={18} className="text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">CA packs</span>
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  {formatCurrency(clients.reduce((s, c) => s + c.caPacks, 0))}
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-amber-50 p-2.5 rounded-xl">
                    <ShoppingBag size={18} className="text-amber-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">CA ventes directes</span>
                </div>
                <p className="text-2xl font-bold text-amber-700">
                  {formatCurrency(clients.reduce((s, c) => s + c.caVentes, 0))}
                </p>
              </div>
            </div>

            {/* Tableau clients */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-slate-800">
                  Clients assignés
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    ({clientsMeta?.total ?? 0})
                  </span>
                </h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Rechercher…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm w-56"
                    />
                  </div>
                  <button
                    onClick={openBulkModal}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors"
                  >
                    <UserPlus size={15} /> Affecter des clients
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">PDV rattaché</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-purple-600 uppercase tracking-wider">CA packs</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-amber-600 uppercase tracking-wider">CA ventes</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wider">CA total</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(client => (
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                              {getInitials(client.nom, client.prenom)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{client.prenom} {client.nom}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                client.etat === 'ACTIF' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                              }`}>
                                {client.etat}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <Phone size={12} className="text-slate-400" /> {client.telephone}
                          </div>
                          {client.adresse && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                              <MapPin size={11} /> {client.adresse}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {client.pointDeVente ? (() => {
                            const pdvDifferent =
                              agentPdvIds.length > 0 &&
                              !agentPdvIds.includes(client.pointDeVente.id);
                            return (
                              <div className="flex items-center gap-2">
                                <div className={`w-5 h-5 rounded flex items-center justify-center ${pdvDifferent ? 'bg-amber-100' : 'bg-blue-100'}`}>
                                  <Store size={10} className={pdvDifferent ? 'text-amber-600' : 'text-blue-600'} />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-700">{client.pointDeVente.nom}</p>
                                  <p className="text-xs font-mono text-slate-400">{client.pointDeVente.code}</p>
                                </div>
                                {pdvDifferent && (
                                  <div className="relative group">
                                    <AlertTriangle size={14} className="text-amber-500 cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-52 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed">
                                      PDV différent de celui de l&apos;agent. Ce client est dans une zone non couverte par cet agent terrain.
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })() : (
                            <span className="text-xs text-slate-400 italic">Non rattaché</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-sm font-semibold ${client.caPacks > 0 ? 'text-purple-700' : 'text-slate-300'}`}>
                            {client.caPacks > 0 ? formatCurrency(client.caPacks) : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-sm font-semibold ${client.caVentes > 0 ? 'text-amber-700' : 'text-slate-300'}`}>
                            {client.caVentes > 0 ? formatCurrency(client.caVentes) : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-sm font-bold ${client.caTotal > 0 ? 'text-emerald-700' : 'text-slate-300'}`}>
                            {client.caTotal > 0 ? formatCurrency(client.caTotal) : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-500">{formatDate(client.createdAt)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/dashboard/admin/clients/${client.id}`}
                              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors inline-flex"
                              title="Voir la fiche client"
                            >
                              <ExternalLink size={14} />
                            </Link>
                            <button
                              onClick={() => handleUnassign(client.id)}
                              disabled={unassignLoading.has(client.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex disabled:opacity-40"
                              title="Désaffecter ce client"
                            >
                              {unassignLoading.has(client.id)
                                ? <span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                : <UserMinus size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm">
                          {search
                            ? 'Aucun client ne correspond à la recherche.'
                            : 'Aucun client assigné à cet agent terrain.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filtered.length > 0 && (
                    <tfoot>
                      <tr className="bg-emerald-50/60 border-t-2 border-emerald-100">
                        <td colSpan={3} className="px-6 py-3 text-sm font-bold text-slate-700">
                          Total — {filtered.length} client{filtered.length > 1 ? 's' : ''}
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-bold text-purple-700">
                          {formatCurrency(filtered.reduce((s, c) => s + c.caPacks, 0))}
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-bold text-amber-700">
                          {formatCurrency(filtered.reduce((s, c) => s + c.caVentes, 0))}
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-bold text-emerald-700">
                          {formatCurrency(filtered.reduce((s, c) => s + c.caTotal, 0))}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </div>

    {/* ── Modal bulk assignment ─────────────────────────────────────────── */}
    {showBulkModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Affecter des clients</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                à {gestionnaire?.member.prenom} {gestionnaire?.member.nom}
              </p>
            </div>
            <button
              onClick={() => setShowBulkModal(false)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Rechercher un client…"
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 text-sm"
              />
            </div>
          </div>

          {/* Liste clients */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {modalLoading ? (
              <div className="flex items-center justify-center py-10">
                <span className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : modalClients.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">
                {modalSearch ? 'Aucun résultat.' : 'Tous les clients sont déjà assignés ou aucun client disponible.'}
              </p>
            ) : (
              <ul className="space-y-1">
                {modalClients.map(c => {
                  const pdvDifferent =
                    agentPdvIds.length > 0 &&
                    (!c.pointDeVente || !agentPdvIds.includes(c.pointDeVente.id));
                  const checked = selectedIds.has(c.id);
                  return (
                    <li key={c.id}>
                      <label className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                        checked ? 'bg-teal-50 border border-teal-200' : 'hover:bg-slate-50 border border-transparent'
                      }`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(c.id)}
                          className="w-4 h-4 accent-teal-600 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">
                              {c.prenom} {c.nom}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              c.etat === 'ACTIF' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                            }`}>
                              {c.etat}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Phone size={10} /> {c.telephone}
                            </span>
                            {c.pointDeVente && (
                              <span className={`text-xs flex items-center gap-1 ${pdvDifferent ? 'text-amber-600' : 'text-slate-400'}`}>
                                <Store size={10} /> {c.pointDeVente.nom}
                                {pdvDifferent && (
                                  <AlertTriangle size={10} className="text-amber-500" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Avertissement géographique global */}
          {selectedIds.size > 0 && agentPdvIds.length > 0 && (() => {
            const nbDiff = modalClients.filter(c =>
              selectedIds.has(c.id) &&
              (!c.pointDeVente || !agentPdvIds.includes(c.pointDeVente.id))
            ).length;
            return nbDiff > 0 ? (
              <div className="mx-6 mb-2 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl px-4 py-3">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>{nbDiff} client{nbDiff > 1 ? 's' : ''}</strong> sélectionné{nbDiff > 1 ? 's' : ''} n&apos;est pas dans la zone de cet agent (PDV différent).
                </span>
              </div>
            ) : null;
          })()}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
            {bulkError && (
              <p className="text-xs text-red-600 flex-1">{bulkError}</p>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-xs text-slate-400">
                {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleBulkAssign}
                disabled={!selectedIds.size || bulkLoading}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {bulkLoading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <UserPlus size={15} />}
                Affecter ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
