"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Shield, Users, Eye, Edit, CheckCircle, Clock,
  Mail, Phone, Trash2, X, ArrowLeft, Store, Building2, Link2, Link2Off, UserCheck, MapPin,
  LayoutDashboard,
} from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDate } from '@/lib/format';
import { getStatusLabel, getStatusStyle } from '@/lib/status';
import { useT } from '@/contexts/AppSettingsContext';
import { useViewAs } from '@/contexts/ViewAsContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PDVOption { id: number; nom: string; code: string; type: string; }

interface Gestionnaire {
  id: number;
  role: string;
  actif: boolean;
  createdAt: string;
  member: {
    id: number; 
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    affectationsPDV: {
      id: number;
      pointDeVente: { id: number; nom: string; code: string; type: string };
    }[];
  };
}

interface GestionnairesResponse {
  data: Gestionnaire[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  stats: { totalActifs: number; totalInactifs: number; totalRoles: number };
}

interface MemberOption {
  id: number; nom: string; prenom: string; email: string; role: string | null;
}

// Mapping rôle → chemin dashboard gestionnaire (pour le bouton "Voir dashboard")
const ROLE_DASHBOARD_MAP: Record<string, string> = {
  RESPONSABLE_POINT_DE_VENTE:           '/dashboard/user/responsablesPointDeVente',
  CHEF_AGENCE:                          '/dashboard/user/chefAgence',
  RESPONSABLE_COMMUNAUTE:               '/dashboard/user/chefAgence',
  AGENT_LOGISTIQUE_APPROVISIONNEMENT:   '/dashboard/user/logistiquesApprovisionnements',
  MAGAZINIER:                           '/dashboard/user/magasiniers',
  CAISSIER:                             '/dashboard/user/caissiers',
  COMPTABLE:                            '/dashboard/user/comptables',
  // CDC comptabilité §43 : CHEF_COMPTABLE a le même dashboard que COMPTABLE
  // (lib/authComptable.ts::getComptableSession) ; DIRECTEUR_GENERAL a le
  // module comptable pour port d'attache (consultation globale) ;
  // RESPONSABLE_ACHATS réutilise le dashboard appro/logistique existant —
  // mêmes destinations que proxy.ts::gestionnaireDashboardMap.
  CHEF_COMPTABLE:                       '/dashboard/user/comptables',
  DIRECTEUR_GENERAL:                    '/dashboard/user/comptables',
  RESPONSABLE_ACHATS:                   '/dashboard/user/logistiquesApprovisionnements',
  AGENT_TERRAIN:                        '/dashboard/user/agentsTerrain',
  AUDITEUR_INTERNE:                     '/dashboard/user/auditeursInterne',
  ACTIONNAIRE:                          '/dashboard/user/actionnaires',
  REVENDEUR:                            '/dashboard/user/revendeurs',
  RESPONSABLE_RH:                       '/dashboard/user/responsablesRH',
  INVESTISSEUR_RIA:                     '/dashboard/user/investisseurs',
  RESPONSABLE_RIA:                      '/dashboard/user/responsablesRIA',
};

// Rôles qui gèrent une ZONE multi-PDV (chef d'agence)
const ROLES_CHEF_AGENCE = new Set(['CHEF_AGENCE', 'RESPONSABLE_COMMUNAUTE']);

// Tous les rôles opérationnels qui exercent dans un PDV/dépôt précis
const ROLES_AVEC_PDV = new Set([
  'RESPONSABLE_POINT_DE_VENTE',
  'CHEF_AGENCE',
  'RESPONSABLE_COMMUNAUTE',
  'CAISSIER',
  'MAGAZINIER',
  'AGENT_LOGISTIQUE_APPROVISIONNEMENT',
  'AGENT_TERRAIN',
  'COMMERCIAL',
  'CONTROLEUR_TERRAIN',
  'RESPONSABLE_VENTE_CREDIT',
  'COMPTABLE',
  'CHEF_COMPTABLE',
  'RESPONSABLE_ACHATS',
  'AUDITEUR_INTERNE',
  'RESPONSABLE_ECONOMIQUE',
  'REVENDEUR',
  'RESPONSABLE_RH',
]);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GestionnairesPage() {
  const t = useT();
  const { enterViewAs } = useViewAs();
  const [searchQuery, setSearchQuery]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]                   = useState(1);
  const [roleFilter, setRoleFilter]       = useState('');
  const [modalOpen, setModalOpen]         = useState(false);
  const [formData, setFormData]           = useState({ memberId: '', role: 'RESPONSABLE_POINT_DE_VENTE' });
  const [deleteId, setDeleteId]           = useState<number | null>(null);

  // ── Modal affectation PDV ───────────────────────────────────────────────────
  const [affectModal, setAffectModal]     = useState<Gestionnaire | null>(null);
  const [selectedPdvId, setSelectedPdvId] = useState('');
  const [affectLoading, setAffectLoading] = useState(false);
  const [affectError, setAffectError]     = useState('');

  // ── Zone multi-PDV (chef d'agence) ─────────────────────────────────────────
  const [localZonePdvs, setLocalZonePdvs] = useState<{ id: number; nom: string; code: string }[]>([]);
  const [zoneLoading, setZoneLoading]     = useState(false);
  const [zoneError, setZoneError]         = useState('');

  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (roleFilter) params.set('role', roleFilter);

  const { data: response, loading, error, refetch } =
    useApi<GestionnairesResponse>(`/api/admin/gestionnaires?${params}`);
  const allGestionnaires = response?.data ?? [];
  const meta = response?.meta;

  // Pour le modal d'ajout
  const { data: membersResponse } =
    useApi<{ data: MemberOption[] }>(modalOpen ? '/api/admin/membres?limit=100' : null);
  const { data: allGestionnairesResponse } =
    useApi<GestionnairesResponse>(modalOpen ? '/api/admin/gestionnaires?limit=1000' : null);
  const gestionnairesMemberIds = new Set((allGestionnairesResponse?.data ?? []).map(g => g.member.id));
  const allMembers = (membersResponse?.data ?? []).filter(m => m.role === 'USER' && !gestionnairesMemberIds.has(m.id));

  // PDV disponibles pour le modal d'affectation
  const { data: pdvResponse } =
    useApi<{ data: PDVOption[] }>(affectModal ? '/api/admin/pdv?limit=200&actif=true' : null);
  const pdvOptions = pdvResponse?.data ?? [];

  // Mutations gestionnaires
  const { mutate: addGestionnaire, loading: adding, error: addError } =
    useMutation('/api/admin/gestionnaires', 'POST', { successMessage: t('gest_ajout_succes') });

  const deleteIdRef = useRef<number | null>(null);
  const { mutate: deleteGestionnaire, loading: deleting } =
    useMutation(() => `/api/admin/gestionnaires/${deleteIdRef.current}`, 'DELETE', { successMessage: t('gest_suppr_succes') });

  // Mutation affectation PDV
  const affectPdvIdRef = useRef<number | null>(null);
  const { mutate: affectPdv } =
    useMutation(() => `/api/admin/pdv/${affectPdvIdRef.current}/affectations`, 'POST');
  const { mutate: desaffectPdv } =
    useMutation(() => `/api/admin/pdv/${affectPdvIdRef.current}/affectations`, 'DELETE');

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addGestionnaire({ memberId: Number(formData.memberId), role: formData.role });
    if (result) {
      setModalOpen(false);
      setFormData({ memberId: '', role: 'RESPONSABLE_POINT_DE_VENTE' });
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    deleteIdRef.current = deleteId;
    const result = await deleteGestionnaire({});
    if (result) { setDeleteId(null); refetch(); }
  };

  const openAffectModal = (g: Gestionnaire) => {
    setAffectModal(g);
    setAffectError('');
    setZoneError('');
    setSelectedPdvId('');
    if (ROLES_CHEF_AGENCE.has(g.role)) {
      // Initialiser la zone depuis les affectations existantes
      setLocalZonePdvs(g.member.affectationsPDV.map(a => ({
        id: a.pointDeVente.id, nom: a.pointDeVente.nom, code: a.pointDeVente.code,
      })));
    } else {
      const current = g.member.affectationsPDV[0];
      setSelectedPdvId(current ? String(current.pointDeVente.id) : '');
    }
  };

  const handleAddToZone = async () => {
    if (!affectModal || !selectedPdvId) return;
    const pdvId = Number(selectedPdvId);
    setZoneLoading(true);
    setZoneError('');
    try {
      const res = await fetch(`/api/admin/pdv/${pdvId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chefAgenceId: affectModal.member.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('gest_err_ajout'));
      }
      const pdv = pdvOptions.find(p => p.id === pdvId);
      if (pdv) {
        setLocalZonePdvs(prev => [...prev, { id: pdv.id, nom: pdv.nom, code: pdv.code }]);
      }
      setSelectedPdvId('');
      refetch();
    } catch (e) {
      setZoneError(e instanceof Error ? e.message : t('md_erreur'));
    } finally {
      setZoneLoading(false);
    }
  };

  const handleRemoveFromZone = async (pdvId: number) => {
    if (!affectModal) return;
    setZoneLoading(true);
    setZoneError('');
    try {
      const res = await fetch(`/api/admin/pdv/${pdvId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chefAgenceId: null }),
      });
      if (!res.ok) throw new Error(t('gest_err_retrait'));
      setLocalZonePdvs(prev => prev.filter(p => p.id !== pdvId));
      refetch();
    } catch (e) {
      setZoneError(e instanceof Error ? e.message : t('md_erreur'));
    } finally {
      setZoneLoading(false);
    }
  };

  const handleAffecter = async () => {
    if (!affectModal || !selectedPdvId) return;
    setAffectLoading(true);
    setAffectError('');
    affectPdvIdRef.current = Number(selectedPdvId);
    const res = await affectPdv({ userId: affectModal.member.id });
    setAffectLoading(false);
    if (res) { setAffectModal(null); refetch(); }
    else setAffectError(t('gest_err_affectation'));
  };

  const handleDesaffecter = async () => {
    if (!affectModal) return;
    const current = affectModal.member.affectationsPDV[0];
    if (!current) return;
    setAffectLoading(true);
    setAffectError('');
    affectPdvIdRef.current = current.pointDeVente.id;
    const res = await desaffectPdv({ userId: affectModal.member.id });
    setAffectLoading(false);
    if (res) { setAffectModal(null); refetch(); }
    else setAffectError(t('gest_err_desaffectation'));
  };

  // Client-side search
  const gestionnaires = allGestionnaires.filter(g => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase().trim();
    const nom    = g.member.nom.toLowerCase();
    const prenom = g.member.prenom.toLowerCase();
    const email  = g.member.email.toLowerCase();
    if (nom.includes(q) || prenom.includes(q) || email.includes(q)) return true;
    // Multi-mots : "prenom nom" ou "nom prenom"
    const parts = q.split(/\s+/);
    if (parts.length >= 2) {
      const full1 = `${prenom} ${nom}`;
      const full2 = `${nom} ${prenom}`;
      if (full1.includes(q) || full2.includes(q)) return true;
    }
    return false;
  });

  const apiStats = response?.stats;
  const stats = [
    { label: t('gest_total'), value: String(meta?.total ?? 0), icon: Users, color: 'bg-blue-500', lightBg: 'bg-blue-100', from: 'from-blue-50', border: 'border-blue-100', text: 'text-blue-700', hoverShadow: 'hover:shadow-blue-200/60', hoverBorder: 'hover:border-blue-300' },
    { label: t('text_actifs'), value: String(apiStats?.totalActifs ?? 0), icon: CheckCircle, color: 'bg-emerald-500', lightBg: 'bg-emerald-100', from: 'from-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', hoverShadow: 'hover:shadow-emerald-200/60', hoverBorder: 'hover:border-emerald-300' },
    { label: t('text_inactifs'), value: String(apiStats?.totalInactifs ?? 0), icon: Clock, color: 'bg-amber-500', lightBg: 'bg-amber-100', from: 'from-amber-50', border: 'border-amber-100', text: 'text-amber-700', hoverShadow: 'hover:shadow-amber-200/60', hoverBorder: 'hover:border-amber-300' },
    { label: t('gest_roles_distincts'), value: String(apiStats?.totalRoles ?? 0), icon: Shield, color: 'bg-purple-500', lightBg: 'bg-purple-100', from: 'from-purple-50', border: 'border-purple-100', text: 'text-purple-700', hoverShadow: 'hover:shadow-purple-200/60', hoverBorder: 'hover:border-purple-300' },
  ];

  const getInitials = (nom: string, prenom: string) => `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">{t('gest_loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">{t('text_error_loading')}</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium">{t('btn_retry')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/20 p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">{t('gest_title')}</h1>
              <p className="text-slate-500">{t('gest_subtitle')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/admin/pdv"
              className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Store size={18} /> {t('gest_manage_pdv')}
            </Link>
            <button onClick={() => setModalOpen(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 flex items-center gap-2 font-medium">
              <Plus size={20} /> {t('gest_add_btn')}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-5">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className={`group relative overflow-hidden bg-gradient-to-br ${stat.from} to-white rounded-2xl p-6 shadow-sm border ${stat.border} transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl ${stat.hoverShadow} ${stat.hoverBorder}`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stat.color}`} />
                <div className={`${stat.lightBg} p-3 rounded-xl inline-block mb-4 transition-transform duration-300 ease-out group-hover:scale-110`}>
                  <Icon className={`${stat.color.replace('bg-', 'text-')} w-6 h-6`} />
                </div>
                <h3 className={`${stat.text}/80 text-sm font-semibold mb-1`}>{stat.label}</h3>
                <p className={`text-3xl font-bold ${stat.text} transition-transform duration-300 group-hover:scale-105 origin-left`}>{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input type="text" placeholder={t('gest_search_ph')}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50" />
            </div>
            <select value={roleFilter}
              onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
              className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50">
              <option value="">{t('text_all_roles')}</option>
              <option value="RESPONSABLE_POINT_DE_VENTE">{t('role_responsable_pdv')}</option>
              <option value="CHEF_AGENCE">{t('role_chef_agence')}</option>
              <option value="RESPONSABLE_COMMUNAUTE">{t('role_responsable_communaute')}</option>
              <option value="REVENDEUR">{t('role_revendeur')}</option>
              <option value="AGENT_LOGISTIQUE_APPROVISIONNEMENT">{t('role_agent_logistique')}</option>
              <option value="MAGAZINIER">{t('role_magasinier')}</option>
              <option value="CAISSIER">{t('role_caissier')}</option>
              <option value="COMMERCIAL">{t('role_commercial')}</option>
              <option value="DIRECTEUR_COMMERCIAL">{t('role_directeur_commercial')}</option>
              <option value="COMPTABLE">{t('role_comptable')}</option>
              <option value="CHEF_COMPTABLE">{t('role_chef_comptable')}</option>
              <option value="DIRECTEUR_GENERAL">{t('role_directeur_general')}</option>
              <option value="RESPONSABLE_ACHATS">{t('role_responsable_achats')}</option>
              <option value="AUDITEUR_INTERNE">{t('role_auditeur_interne')}</option>
              <option value="RESPONSABLE_VENTE_CREDIT">{t('role_responsable_vente_credit')}</option>
              <option value="CONTROLEUR_TERRAIN">{t('role_controleur_terrain')}</option>
              <option value="AGENT_TERRAIN">{t('role_agent_terrain')}</option>
              <option value="RESPONSABLE_ECONOMIQUE">{t('role_responsable_economique')}</option>
              <option value="RESPONSABLE_MARKETING">{t('role_responsable_marketing')}</option>
              <option value="COMMUNITY_MANAGER">{t('role_community_manager')}</option>
              <option value="ACTIONNAIRE">{t('role_actionnaire')}</option>
              <option value="RESPONSABLE_RH">{t('role_responsable_rh')}</option>
              <option value="INVESTISSEUR_RIA">{t('role_investisseur_ria')}</option>
              <option value="RESPONSABLE_RIA">{t('role_responsable_ria')}</option>
            </select>
          </div>
        </div>

        {/* ══ MODAL — Ajout gestionnaire ═══════════════════════════════════ */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130]">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold mb-4">{t('gest_add_title')}</h2>
              {addError && <p className="text-red-500 mb-2 text-sm">{addError}</p>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_membre')}</label>
                  <select required value={formData.memberId}
                    onChange={e => setFormData({ ...formData, memberId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50">
                    <option value="">{t('text_select_member')}</option>
                    {allMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.prenom} {m.nom} ({m.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_role')}</label>
                  <select value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50">
                    <option value="RESPONSABLE_POINT_DE_VENTE">{t('role_responsable_pdv')}</option>
                    <option value="CHEF_AGENCE">{t('role_chef_agence')}</option>
                    <option value="RESPONSABLE_COMMUNAUTE">{t('role_responsable_communaute')}</option>
                    <option value="REVENDEUR">{t('role_revendeur')}</option>
                    <option value="AGENT_LOGISTIQUE_APPROVISIONNEMENT">{t('role_agent_logistique')}</option>
                    <option value="MAGAZINIER">{t('role_magasinier')}</option>
                    <option value="CAISSIER">{t('role_caissier')}</option>
                    <option value="COMMERCIAL">{t('role_commercial')}</option>
              <option value="DIRECTEUR_COMMERCIAL">{t('role_directeur_commercial')}</option>
                    <option value="COMPTABLE">{t('role_comptable')}</option>
                    <option value="CHEF_COMPTABLE">{t('role_chef_comptable')}</option>
                    <option value="DIRECTEUR_GENERAL">{t('role_directeur_general')}</option>
                    <option value="RESPONSABLE_ACHATS">{t('role_responsable_achats')}</option>
                    <option value="AUDITEUR_INTERNE">{t('role_auditeur_interne')}</option>
                    <option value="RESPONSABLE_VENTE_CREDIT">{t('role_responsable_vente_credit')}</option>
                    <option value="CONTROLEUR_TERRAIN">{t('role_controleur_terrain')}</option>
                    <option value="AGENT_TERRAIN">{t('role_agent_terrain')}</option>
                    <option value="RESPONSABLE_ECONOMIQUE">{t('role_responsable_economique')}</option>
                    <option value="RESPONSABLE_MARKETING">{t('role_responsable_marketing')}</option>
              <option value="COMMUNITY_MANAGER">{t('role_community_manager')}</option>
                    <option value="ACTIONNAIRE">{t('role_actionnaire')}</option>
                    <option value="RESPONSABLE_RH">{t('role_responsable_rh')}</option>
                    <option value="INVESTISSEUR_RIA">{t('role_investisseur_ria')}</option>
                    <option value="RESPONSABLE_RIA">{t('role_responsable_ria')}</option>
                  </select>
                </div>
                <button type="submit" disabled={adding}
                  className="w-full py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all font-medium">
                  {adding ? t('btn_adding') : t('gest_add_submit')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══ MODAL — Affectation PDV ═══════════════════════════════════════ */}
        {affectModal && (() => {
          const isChefAgence = ROLES_CHEF_AGENCE.has(affectModal.role);
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
              <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl relative">
                <button onClick={() => setAffectModal(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-slate-800 mb-1">
                  {isChefAgence ? t('gest_zone_modal_title') : t('gest_assign_modal_title')}
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                  {affectModal.member.prenom} {affectModal.member.nom} —{' '}
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                    {getStatusLabel(affectModal.role)}
                  </span>
                </p>

                {/* ── CAS CHEF D'AGENCE : zone multi-PDV ── */}
                {isChefAgence ? (
                  <div className="space-y-5">
                    <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5 text-xs text-indigo-800">
                      <MapPin size={13} className="mt-0.5 shrink-0" />
                      <span>
                        {t('gest_zone_hint')}
                      </span>
                    </div>

                    {zoneError && (
                      <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{zoneError}</p>
                    )}

                    {/* PDVs actuels dans la zone */}
                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                        <Store size={14} className="text-blue-500" />
                        {t('gest_zone_pdvs')}
                        <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full ml-1">
                          {localZonePdvs.length}
                        </span>
                      </p>
                      {localZonePdvs.length === 0 && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          {t('gest_zone_none')}
                        </p>
                      )}
                      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                        {localZonePdvs.map(p => (
                          <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Store size={13} className="text-blue-400 shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-slate-800">{p.nom}</p>
                                <p className="text-xs font-mono text-slate-400">{p.code}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveFromZone(p.id)}
                              disabled={zoneLoading}
                              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 border border-red-200 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Link2Off size={11} /> {t('gest_remove_btn')}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ajouter un PDV à la zone */}
                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-2">{t('gest_zone_add_pdv')}</p>
                      <div className="flex gap-2">
                        <select
                          value={selectedPdvId}
                          onChange={e => setSelectedPdvId(e.target.value)}
                          className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">{t('text_select_pdv')}</option>
                          {pdvOptions
                            .filter(p => !localZonePdvs.some(z => z.id === p.id))
                            .map(p => (
                              <option key={p.id} value={p.id}>
                                {p.type === 'DEPOT_CENTRAL' ? '🏭 ' : '🏪 '}{p.nom} ({p.code})
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={handleAddToZone}
                          disabled={zoneLoading || !selectedPdvId}
                          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5 text-sm font-medium transition-colors"
                        >
                          {zoneLoading ? '…' : <><Plus size={14} /> {t('btn_add')}</>}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => setAffectModal(null)}
                      className="w-full py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium text-sm"
                    >
                      {t('btn_close')}
                    </button>
                  </div>

                ) : (
                  /* ── CAS STANDARD : 1 PDV ── */
                  <>
                    {affectModal.member.affectationsPDV[0] && (
                      <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                        <Store size={15} className="text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {affectModal.member.affectationsPDV[0].pointDeVente.nom}
                          </p>
                          <p className="text-xs text-slate-500">
                            {affectModal.member.affectationsPDV[0].pointDeVente.code} — {t('gest_pdv_actuel')}
                          </p>
                        </div>
                        <button onClick={handleDesaffecter} disabled={affectLoading}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium border border-red-200 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
                          <Link2Off size={12} /> {t('gest_unassign_btn')}
                        </button>
                      </div>
                    )}

                    <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-800">
                      <UserCheck size={13} className="mt-0.5 shrink-0" />
                      <span>
                        {t('gest_son_role')} <span className="font-semibold">{getStatusLabel(affectModal.role)}</span> {t('gest_role_auto_reconnu')}
                        {affectModal.role === 'RESPONSABLE_POINT_DE_VENTE' && ` ${t('gest_resp_officiel_pdv')}`}
                      </span>
                    </div>

                    {affectError && (
                      <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{affectError}</p>
                    )}

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-700">
                        {affectModal.member.affectationsPDV[0] ? t('gest_reassign') : t('gest_choose_pdv')}
                      </label>
                      <select value={selectedPdvId} onChange={e => setSelectedPdvId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                        <option value="">{t('text_select_pdv')}</option>
                        {pdvOptions.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.type === 'DEPOT_CENTRAL' ? '🏭 ' : '🏪 '}{p.nom} ({p.code})
                          </option>
                        ))}
                      </select>
                      <button onClick={handleAffecter} disabled={affectLoading || !selectedPdvId}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 font-medium flex items-center justify-center gap-2 transition-colors">
                        <Link2 size={15} />
                        {affectLoading ? t('text_in_progress') : affectModal.member.affectationsPDV[0] ? t('btn_reassign') : t('btn_assign')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* ══ MODAL — Suppression ══════════════════════════════════════════ */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130]">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-lg text-center">
              <h2 className="text-lg font-bold text-slate-800 mb-2">{t('text_confirm_delete')}</h2>
              <p className="text-slate-500 text-sm mb-6">{t('text_irreversible')}</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium">
                  {t('btn_cancel')}
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">
                  {deleting ? t('btn_deleting') : t('btn_delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table Gestionnaires */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('gest_title')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('col_contact')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('col_role')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('gest_col_pdv_affecte')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('col_status')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('label_date')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gestionnaires.map(g => {
                  const pdvAffecte = g.member.affectationsPDV[0]?.pointDeVente ?? null;
                  const peutAvoirPdv = ROLES_AVEC_PDV.has(g.role);
                  return (
                    <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md text-lg">
                            {getInitials(g.member.nom, g.member.prenom)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{g.member.prenom} {g.member.nom}</p>
                            <p className="text-xs text-slate-500">{t('gest_depuis')} {formatDate(g.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail size={14} className="text-slate-400" /> {g.member.email}
                          </div>
                          {g.member.telephone && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone size={14} className="text-slate-400" /> {g.member.telephone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(g.role)}`}>
                          <Shield size={12} /> {getStatusLabel(g.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {ROLES_CHEF_AGENCE.has(g.role) ? (
                          // Chef d'agence : afficher la zone multi-PDV
                          g.member.affectationsPDV.length > 0 ? (
                            <div>
                              <div className="flex items-center gap-1 text-sm font-medium text-slate-700">
                                <MapPin size={13} className="text-indigo-500" />
                                <span>{g.member.affectationsPDV.length} PDV{g.member.affectationsPDV.length > 1 ? 's' : ''} {t('gest_pdvs_dans_zone')}</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {g.member.affectationsPDV.slice(0, 3).map(a => (
                                  <span key={a.id} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-mono">
                                    {a.pointDeVente.code}
                                  </span>
                                ))}
                                {g.member.affectationsPDV.length > 3 && (
                                  <span className="text-xs text-slate-400">+{g.member.affectationsPDV.length - 3}</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                              {t('gest_zone_vide')}
                            </span>
                          )
                        ) : pdvAffecte ? (
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 ${pdvAffecte.type === 'DEPOT_CENTRAL' ? 'bg-purple-100' : 'bg-blue-100'} rounded-lg flex items-center justify-center`}>
                              {pdvAffecte.type === 'DEPOT_CENTRAL'
                                ? <Building2 size={12} className="text-purple-600" />
                                : <Store size={12} className="text-blue-600" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{pdvAffecte.nom}</p>
                              <p className="text-xs text-slate-400 font-mono">{pdvAffecte.code}</p>
                            </div>
                          </div>
                        ) : peutAvoirPdv ? (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                            {t('gest_non_affecte')}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusStyle(g.actif ? 'ACTIF' : 'INACTIF')}`}>
                          {g.actif ? <CheckCircle size={14} /> : <Clock size={14} />}
                          {getStatusLabel(g.actif ? 'ACTIF' : 'INACTIF')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{formatDate(g.createdAt)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Link href={`/dashboard/admin/gestionnaires/${g.id}`}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title={t('action_view')}>
                            <Eye size={16} />
                          </Link>
                          <Link href={`/dashboard/admin/gestionnaires/${g.id}/edit`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={t('action_edit')}>
                            <Edit size={16} />
                          </Link>
                          {peutAvoirPdv && (
                            <button onClick={() => openAffectModal(g)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title={t('gest_affecter_pdv_title')}>
                              {pdvAffecte ? <Link2 size={16} /> : <Link2 size={16} />}
                            </button>
                          )}
                          {/* Bouton "Voir dashboard" — accès lecture au dashboard du gestionnaire */}
                          {ROLE_DASHBOARD_MAP[g.role] && (
                            <button
                              onClick={() => enterViewAs({
                                userId:           g.member.id,
                                gestionnaireRole: g.role,
                                nom:              g.member.nom,
                                prenom:           g.member.prenom,
                                dashboardPath:    ROLE_DASHBOARD_MAP[g.role],
                              })}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title={t('gest_voir_dashboard_lecture')}
                            >
                              <LayoutDashboard size={16} />
                            </button>
                          )}
                          <button onClick={() => setDeleteId(g.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('action_delete')}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {gestionnaires.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">{t('gest_none_found')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {meta && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {t('page')} <span className="font-semibold">{meta.page}</span> / <span className="font-semibold">{meta.totalPages}</span> ({meta.total} {t('gest_title').toLowerCase()})
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  {t('btn_prev')}
                </button>
                <span className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium">{page}</span>
                <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  {t('btn_next')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
