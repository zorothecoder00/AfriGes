"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Store, Building2, ArrowLeft, Edit, Power, PowerOff,
  CheckCircle, XCircle, Users, ShoppingCart, ChevronRight, X,
  MapPin, Phone, FileText, User, UserCheck, Network, ExternalLink, Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { useT } from '@/contexts/AppSettingsContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PDVUser { id: number; nom: string; prenom: string; }
interface PDVParent { id: number; nom: string; code: string; }
type TypeSite = 'POINT_DE_VENTE' | 'DEPOT_CENTRAL' | 'PLATEFORME_REGIONALE';
interface PDV {
  id: number; code: string; nom: string; type: TypeSite;
  adresse: string | null; telephone: string | null; notes: string | null;
  actif: boolean; createdAt: string;
  latitude: number | null; longitude: number | null;
  capaciteStockage: number | null; capaciteUnite: string | null;
  seuilSecuriteGlobal: number | null;
  niveauSecurite: 'STANDARD' | 'RENFORCE' | 'MAXIMALE';
  plateformeRegionale: PDVParent | null;
  rpv: PDVUser | null;
  chefAgence: PDVUser | null;
  responsable: PDVUser | null;
  _count: { stocks: number; ventesDirectes: number; affectations: number; sitesRattaches: number };
}
interface PDVResponse {
  data: PDV[];
  stats: { totalPDV: number; totalDepot: number; totalPlateformes: number; totalActifs: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}
interface GestionnaireOption {
  id: number; role: string;
  member: { id: number; nom: string; prenom: string; };
}

const TYPE_BADGE: Record<string, string> = {
  POINT_DE_VENTE: 'bg-blue-100 text-blue-700',
  DEPOT_CENTRAL: 'bg-purple-100 text-purple-700',
  PLATEFORME_REGIONALE: 'bg-amber-100 text-amber-700',
};
const TYPE_LABEL: Record<string, string> = {
  POINT_DE_VENTE: 'Point de vente',
  DEPOT_CENTRAL: 'Dépôt central',
  PLATEFORME_REGIONALE: 'Plateforme régionale',
};

function initials(nom: string, prenom: string) {
  return `${(prenom?.[0] ?? '').toUpperCase()}${(nom?.[0] ?? '').toUpperCase()}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PDVPage() {
  const t = useT();
  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]             = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterActif, setFilterActif] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Modal création ──────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: '', nom: '', type: 'POINT_DE_VENTE', adresse: '', telephone: '', notes: '',
    rpvId: '', chefAgenceId: '', responsableId: '',
    latitude: '', longitude: '', capaciteStockage: '', capaciteUnite: 'm3', seuilSecuriteGlobal: '',
    niveauSecurite: 'STANDARD',
    plateformeRegionaleId: '',
  });

  // ── Modal édition ───────────────────────────────────────────────────────────
  const [editPdv, setEditPdv]       = useState<PDV | null>(null);
  const [editForm, setEditForm]     = useState({
    nom: '', adresse: '', telephone: '', notes: '', rpvId: '', chefAgenceId: '', responsableId: '', actif: true,
    latitude: '', longitude: '', capaciteStockage: '', capaciteUnite: 'm3', seuilSecuriteGlobal: '',
    niveauSecurite: 'STANDARD',
    plateformeRegionaleId: '',
  });

  // ── Modal toggle actif ──────────────────────────────────────────────────────
  const [togglePdv, setTogglePdv]   = useState<PDV | null>(null);

  // ── API liste PDV ───────────────────────────────────────────────────────────
  const params = new URLSearchParams({ page: String(page), limit: '15' });
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (filterType)      params.set('type', filterType);
  if (filterActif)     params.set('actif', filterActif);

  const { data: response, loading, refetch } = useApi<PDVResponse>(`/api/admin/pdv?${params}`);
  const pdvs  = response?.data ?? [];
  const stats = response?.stats;
  const meta  = response?.meta;

  // ── Gestionnaires RPV (pour sélecteur) ─────────────────────────────────────
  const { data: rpvResponse } = useApi<{ data: GestionnaireOption[] }>(
    (createOpen || !!editPdv) ? '/api/admin/gestionnaires?role=RESPONSABLE_POINT_DE_VENTE&limit=200&actif=true' : null
  );
  const rpvOptions = rpvResponse?.data ?? [];

  // ── Gestionnaires Chef d'agence (pour sélecteur) ───────────────────────────
  const { data: chefResponse } = useApi<{ data: GestionnaireOption[] }>(
    (createOpen || !!editPdv) ? '/api/admin/gestionnaires?role=CHEF_AGENCE&limit=200&actif=true' : null
  );
  const chefOptions = chefResponse?.data ?? [];

  // ── Gestionnaires Logistique/Appro (pour le responsable de dépôt) ─────────
  const { data: responsableResponse } = useApi<{ data: GestionnaireOption[] }>(
    (createOpen || !!editPdv) ? '/api/admin/gestionnaires?role=AGENT_LOGISTIQUE_APPROVISIONNEMENT&limit=200&actif=true' : null
  );
  const responsableOptions = responsableResponse?.data ?? [];

  // ── Sites parents possibles (dépôt central / plateforme régionale) ────────
  const { data: parentsResponse } = useApi<{ data: PDV[] }>(
    (createOpen || !!editPdv) ? '/api/admin/pdv?limit=100&actif=true' : null
  );
  const parentOptions = (parentsResponse?.data ?? []).filter(
    p => p.type !== 'POINT_DE_VENTE' && p.id !== editPdv?.id
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const { mutate: createPdv, loading: creating, error: createError } =
    useMutation('/api/admin/pdv', 'POST', { successMessage: 'Point de vente créé !' });

  const editIdRef = useRef<number | null>(null);
  const { mutate: updatePdv, loading: updating, error: updateError } =
    useMutation(() => `/api/admin/pdv/${editIdRef.current}`, 'PATCH', { successMessage: 'PDV mis à jour !' });

  const toggleIdRef = useRef<number | null>(null);
  const { mutate: toggleActif, loading: toggling } =
    useMutation(() => `/api/admin/pdv/${toggleIdRef.current}`, 'PATCH');

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createPdv({
      code:          createForm.code,
      nom:           createForm.nom,
      type:          createForm.type,
      adresse:       createForm.adresse || null,
      telephone:     createForm.telephone || null,
      notes:         createForm.notes || null,
      rpvId:         createForm.rpvId ? Number(createForm.rpvId) : null,
      chefAgenceId:  createForm.chefAgenceId ? Number(createForm.chefAgenceId) : null,
      responsableId: createForm.responsableId ? Number(createForm.responsableId) : null,
      latitude:            createForm.latitude !== '' ? Number(createForm.latitude) : null,
      longitude:           createForm.longitude !== '' ? Number(createForm.longitude) : null,
      capaciteStockage:    createForm.capaciteStockage !== '' ? Number(createForm.capaciteStockage) : null,
      capaciteUnite:       createForm.capaciteUnite || null,
      seuilSecuriteGlobal: createForm.seuilSecuriteGlobal !== '' ? Number(createForm.seuilSecuriteGlobal) : null,
      niveauSecurite:      createForm.niveauSecurite,
      plateformeRegionaleId: createForm.plateformeRegionaleId ? Number(createForm.plateformeRegionaleId) : null,
    });
    if (res) {
      setCreateOpen(false);
      setCreateForm({
        code: '', nom: '', type: 'POINT_DE_VENTE', adresse: '', telephone: '', notes: '', rpvId: '', chefAgenceId: '', responsableId: '',
        latitude: '', longitude: '', capaciteStockage: '', capaciteUnite: 'm3', seuilSecuriteGlobal: '', niveauSecurite: 'STANDARD', plateformeRegionaleId: '',
      });
      refetch();
    }
  };

  const openEdit = (pdv: PDV) => {
    setEditPdv(pdv);
    setEditForm({
      nom:          pdv.nom,
      adresse:      pdv.adresse ?? '',
      telephone:    pdv.telephone ?? '',
      notes:        pdv.notes ?? '',
      rpvId:        pdv.rpv ? String(pdv.rpv.id) : '',
      chefAgenceId: pdv.chefAgence ? String(pdv.chefAgence.id) : '',
      responsableId: pdv.responsable ? String(pdv.responsable.id) : '',
      actif:        pdv.actif,
      latitude:            pdv.latitude != null ? String(pdv.latitude) : '',
      longitude:           pdv.longitude != null ? String(pdv.longitude) : '',
      capaciteStockage:    pdv.capaciteStockage != null ? String(pdv.capaciteStockage) : '',
      capaciteUnite:       pdv.capaciteUnite ?? 'm3',
      seuilSecuriteGlobal: pdv.seuilSecuriteGlobal != null ? String(pdv.seuilSecuriteGlobal) : '',
      niveauSecurite:      pdv.niveauSecurite ?? 'STANDARD',
      plateformeRegionaleId: pdv.plateformeRegionale ? String(pdv.plateformeRegionale.id) : '',
    });
    editIdRef.current = pdv.id;
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await updatePdv({
      nom:          editForm.nom,
      adresse:      editForm.adresse || null,
      telephone:    editForm.telephone || null,
      notes:        editForm.notes || null,
      rpvId:        editForm.rpvId ? Number(editForm.rpvId) : null,
      chefAgenceId: editForm.chefAgenceId ? Number(editForm.chefAgenceId) : null,
      responsableId: editForm.responsableId ? Number(editForm.responsableId) : null,
      latitude:            editForm.latitude !== '' ? Number(editForm.latitude) : null,
      longitude:           editForm.longitude !== '' ? Number(editForm.longitude) : null,
      capaciteStockage:    editForm.capaciteStockage !== '' ? Number(editForm.capaciteStockage) : null,
      capaciteUnite:       editForm.capaciteUnite || null,
      seuilSecuriteGlobal: editForm.seuilSecuriteGlobal !== '' ? Number(editForm.seuilSecuriteGlobal) : null,
      niveauSecurite:      editForm.niveauSecurite,
      plateformeRegionaleId: editForm.plateformeRegionaleId ? Number(editForm.plateformeRegionaleId) : null,
    });
    if (res) { setEditPdv(null); refetch(); }
  };

  const handleToggleActif = async () => {
    if (!togglePdv) return;
    toggleIdRef.current = togglePdv.id;
    const res = await toggleActif({ actif: !togglePdv.actif });
    if (res) { setTogglePdv(null); refetch(); }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative isolate min-h-screen bg-gradient-to-br from-cream-100 via-primary-50/40 to-brand-50/50 p-8 overflow-hidden">
      {/* Aurora décorative — halos flous, aux couleurs du logo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-40 -left-24 w-[34rem] h-[34rem] bg-primary-300/30 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-28 w-[30rem] h-[30rem] bg-brand-400/30 rounded-full blur-3xl" />
      </div>

      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-100 shrink-0">
              <Store className="w-6 h-6 text-brand-700" />
            </span>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">{t('pdv_page_title')}</h1>
              <p className="text-slate-500">{t('pdv_page_subtitle')}</p>
            </div>
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 font-medium">
            <Plus size={20} /> {t('pdv_new_btn')}
          </button>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-5">
          {[
            { label: t('pdv_type_pdv'),   value: String(stats?.totalPDV ?? 0),    icon: Store,      color: 'bg-blue-500',   lightBg: 'bg-blue-50' },
            { label: t('pdv_type_depot'), value: String(stats?.totalDepot ?? 0),  icon: Building2, color: 'bg-purple-500', lightBg: 'bg-purple-50' },
            { label: t('pdv_type_plateforme'), value: String(stats?.totalPlateformes ?? 0), icon: Network, color: 'bg-amber-500', lightBg: 'bg-amber-50' },
            { label: t('pdv_actifs_count'), value: String(stats?.totalActifs ?? 0), icon: CheckCircle, color: 'bg-emerald-500', lightBg: 'bg-emerald-50' },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
                <div className={`${s.lightBg} p-3 rounded-xl inline-block mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`${s.color.replace('bg-', 'text-')} w-6 h-6`} />
                </div>
                <h3 className="text-slate-600 text-sm font-medium mb-1">{s.label}</h3>
                <p className="text-3xl font-bold text-slate-800">{s.value}</p>
              </div>
            );
          })}
        </div>

        {/* ── Filtres ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder={t('pdv_search_ph')} value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm" />
            </div>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
              className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="">{t('pdv_all_types')}</option>
              <option value="POINT_DE_VENTE">{t('pdv_type_pdv')}</option>
              <option value="DEPOT_CENTRAL">{t('pdv_type_depot')}</option>
              <option value="PLATEFORME_REGIONALE">{t('pdv_type_plateforme')}</option>
            </select>
            <select value={filterActif} onChange={e => { setFilterActif(e.target.value); setPage(1); }}
              className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="">{t('pdv_all_statuts')}</option>
              <option value="true">{t('text_actifs')}</option>
              <option value="false">{t('text_inactifs')}</option>
            </select>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MODAL — Créer PDV
        ══════════════════════════════════════════════════════════════════ */}
        {createOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setCreateOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 mb-1">{t('pdv_create_title')}</h2>
              <p className="text-sm text-slate-500 mb-5">{t('pdv_create_subtitle')}</p>
              {createError && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{createError}</p>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_code')} *</label>
                    <input type="text" required placeholder="Ex: PDV-DAKAR-01" value={createForm.code}
                      onChange={e => setCreateForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_type')}</label>
                    <select value={createForm.type}
                      onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="POINT_DE_VENTE">{t('pdv_type_pdv')}</option>
                      <option value="DEPOT_CENTRAL">{t('pdv_type_depot')}</option>
                      <option value="PLATEFORME_REGIONALE">{t('pdv_type_plateforme')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_nom')} *</label>
                  <input type="text" required placeholder={t('label_nom')} value={createForm.nom}
                    onChange={e => setCreateForm(f => ({ ...f, nom: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <MapPin size={13} className="inline mr-1 text-slate-400" />{t('label_adresse')}
                    </label>
                    <input type="text" placeholder={t('label_adresse')} value={createForm.adresse}
                      onChange={e => setCreateForm(f => ({ ...f, adresse: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <Phone size={13} className="inline mr-1 text-slate-400" />{t('label_telephone')}
                    </label>
                    <input type="text" placeholder={t('label_telephone')} value={createForm.telephone}
                      onChange={e => setCreateForm(f => ({ ...f, telephone: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
                {createForm.type === 'POINT_DE_VENTE' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <UserCheck size={13} className="inline mr-1 text-slate-400" />{t('label_pdv_responsable')}
                    </label>
                    <select value={createForm.rpvId}
                      onChange={e => setCreateForm(f => ({ ...f, rpvId: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="">{t('text_none_assign_later')}</option>
                      {rpvOptions.map(g => (
                        <option key={g.id} value={g.member.id}>
                          {g.member.prenom} {g.member.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <User size={13} className="inline mr-1 text-slate-400" />{t('label_chef_agence')}
                  </label>
                  <select value={createForm.chefAgenceId}
                    onChange={e => setCreateForm(f => ({ ...f, chefAgenceId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="">{t('text_none_assign_later')}</option>
                    {chefOptions.map(g => (
                      <option key={g.id} value={g.member.id}>
                        {g.member.prenom} {g.member.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <User size={13} className="inline mr-1 text-slate-400" />{t('label_responsable_site')}
                  </label>
                  <select value={createForm.responsableId}
                    onChange={e => setCreateForm(f => ({ ...f, responsableId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="">{t('text_none_assign_later')}</option>
                    {responsableOptions.map(g => (
                      <option key={g.id} value={g.member.id}>
                        {g.member.prenom} {g.member.nom}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hiérarchie entrepôts (CDC §3/§4) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Network size={13} className="inline mr-1 text-slate-400" />{t('label_site_parent')}
                  </label>
                  <select value={createForm.plateformeRegionaleId}
                    onChange={e => setCreateForm(f => ({ ...f, plateformeRegionaleId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="">{t('label_none')}</option>
                    {parentOptions.map(p => (
                      <option key={p.id} value={p.id}>{p.nom} ({TYPE_LABEL[p.type]})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_niveau_securite')}</label>
                  <select value={createForm.niveauSecurite}
                    onChange={e => setCreateForm(f => ({ ...f, niveauSecurite: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="STANDARD">Standard</option>
                    <option value="RENFORCE">Renforcé</option>
                    <option value="MAXIMALE">Maximale</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_latitude')}</label>
                    <input type="number" step="any" placeholder="6.1319" value={createForm.latitude}
                      onChange={e => setCreateForm(f => ({ ...f, latitude: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_longitude')}</label>
                    <input type="number" step="any" placeholder="1.2228" value={createForm.longitude}
                      onChange={e => setCreateForm(f => ({ ...f, longitude: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_capacite_stockage')}</label>
                    <input type="number" step="any" min="0" value={createForm.capaciteStockage}
                      onChange={e => setCreateForm(f => ({ ...f, capaciteStockage: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_capacite_unite')}</label>
                    <input type="text" placeholder="m3" value={createForm.capaciteUnite}
                      onChange={e => setCreateForm(f => ({ ...f, capaciteUnite: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_seuil_securite_site')}</label>
                  <input type="number" step="any" min="0" value={createForm.seuilSecuriteGlobal}
                    onChange={e => setCreateForm(f => ({ ...f, seuilSecuriteGlobal: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <FileText size={13} className="inline mr-1 text-slate-400" />{t('label_notes')}
                  </label>
                  <textarea rows={2} placeholder="Notes internes…" value={createForm.notes}
                    onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
                </div>
                <button type="submit" disabled={creating}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 font-medium transition-colors">
                  {creating ? t('btn_creating') : t('pdv_create_btn')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL — Éditer PDV
        ══════════════════════════════════════════════════════════════════ */}
        {editPdv && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setEditPdv(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 mb-1">{t('pdv_edit_title')} — {editPdv.nom}</h2>
              <p className="text-sm text-slate-500 mb-5">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${TYPE_BADGE[editPdv.type]}`}>
                  {TYPE_LABEL[editPdv.type]}
                </span>
                Code : <span className="font-mono font-semibold">{editPdv.code}</span>
              </p>
              {updateError && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{updateError}</p>
              )}
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_nom')} *</label>
                  <input type="text" required value={editForm.nom}
                    onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_adresse')}</label>
                    <input type="text" value={editForm.adresse}
                      onChange={e => setEditForm(f => ({ ...f, adresse: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_telephone')}</label>
                    <input type="text" value={editForm.telephone}
                      onChange={e => setEditForm(f => ({ ...f, telephone: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
                {editPdv.type === 'POINT_DE_VENTE' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <UserCheck size={13} className="inline mr-1 text-slate-400" />{t('label_pdv_responsable')}
                    </label>
                    <select value={editForm.rpvId}
                      onChange={e => setEditForm(f => ({ ...f, rpvId: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="">{t('label_none')}</option>
                      {rpvOptions.map(g => (
                        <option key={g.id} value={g.member.id}>
                          {g.member.prenom} {g.member.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <User size={13} className="inline mr-1 text-slate-400" />{t('label_chef_agence')}
                  </label>
                  <select value={editForm.chefAgenceId}
                    onChange={e => setEditForm(f => ({ ...f, chefAgenceId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="">{t('label_none')}</option>
                    {chefOptions.map(g => (
                      <option key={g.id} value={g.member.id}>
                        {g.member.prenom} {g.member.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <User size={13} className="inline mr-1 text-slate-400" />{t('label_responsable_site')}
                  </label>
                  <select value={editForm.responsableId}
                    onChange={e => setEditForm(f => ({ ...f, responsableId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="">{t('label_none')}</option>
                    {responsableOptions.map(g => (
                      <option key={g.id} value={g.member.id}>
                        {g.member.prenom} {g.member.nom}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hiérarchie entrepôts (CDC §3/§4) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Network size={13} className="inline mr-1 text-slate-400" />{t('label_site_parent')}
                  </label>
                  <select value={editForm.plateformeRegionaleId}
                    onChange={e => setEditForm(f => ({ ...f, plateformeRegionaleId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="">{t('label_none')}</option>
                    {parentOptions.map(p => (
                      <option key={p.id} value={p.id}>{p.nom} ({TYPE_LABEL[p.type]})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_niveau_securite')}</label>
                  <select value={editForm.niveauSecurite}
                    onChange={e => setEditForm(f => ({ ...f, niveauSecurite: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="STANDARD">Standard</option>
                    <option value="RENFORCE">Renforcé</option>
                    <option value="MAXIMALE">Maximale</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_latitude')}</label>
                    <input type="number" step="any" value={editForm.latitude}
                      onChange={e => setEditForm(f => ({ ...f, latitude: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_longitude')}</label>
                    <input type="number" step="any" value={editForm.longitude}
                      onChange={e => setEditForm(f => ({ ...f, longitude: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_capacite_stockage')}</label>
                    <input type="number" step="any" min="0" value={editForm.capaciteStockage}
                      onChange={e => setEditForm(f => ({ ...f, capaciteStockage: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_capacite_unite')}</label>
                    <input type="text" value={editForm.capaciteUnite}
                      onChange={e => setEditForm(f => ({ ...f, capaciteUnite: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_seuil_securite_site')}</label>
                  <input type="number" step="any" min="0" value={editForm.seuilSecuriteGlobal}
                    onChange={e => setEditForm(f => ({ ...f, seuilSecuriteGlobal: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('label_notes')}</label>
                  <textarea rows={2} value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
                </div>
                <button type="submit" disabled={updating}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 font-medium transition-colors">
                  {updating ? t('btn_saving') : t('pdv_save_btn')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL — Toggle actif
        ══════════════════════════════════════════════════════════════════ */}
        {togglePdv && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl text-center">
              <div className={`w-14 h-14 ${togglePdv.actif ? 'bg-red-100' : 'bg-emerald-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                {togglePdv.actif
                  ? <PowerOff className="text-red-600 w-7 h-7" />
                  : <Power className="text-emerald-600 w-7 h-7" />}
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">
                {togglePdv.actif ? t('btn_deactivate') : t('btn_activate')} ce PDV ?
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                <strong>{togglePdv.nom}</strong>{' '}
                {togglePdv.actif ? t('pdv_deactivate_msg') : t('pdv_reactivate_msg')}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setTogglePdv(null)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium">
                  {t('btn_cancel')}
                </button>
                <button onClick={handleToggleActif} disabled={toggling}
                  className={`flex-1 py-2.5 ${togglePdv.actif ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'} text-white rounded-xl font-medium disabled:opacity-60 transition-colors`}>
                  {toggling ? '…' : togglePdv.actif ? t('btn_deactivate') : t('btn_activate')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Table PDV ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">{t('pdv_sites_count')}</h3>
            {meta && (
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                {meta.total} site{meta.total > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading && !response ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {[t('pdv_col_site'), t('label_type'), t('pdv_col_parent'), t('pdv_col_rpv'), t('label_chef_agence'), t('pdv_col_equipe'), t('pdv_col_ventes'), t('col_status'), t('col_actions')].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pdvs.map(pdv => (
                    <tr key={pdv.id} className={`hover:bg-slate-50 transition-colors ${!pdv.actif ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${pdv.type === 'DEPOT_CENTRAL' ? 'bg-gradient-to-br from-purple-400 to-purple-600' : pdv.type === 'PLATEFORME_REGIONALE' ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'} rounded-xl flex items-center justify-center text-white shadow-sm`}>
                            {pdv.type === 'DEPOT_CENTRAL' ? <Building2 size={18} /> : pdv.type === 'PLATEFORME_REGIONALE' ? <Warehouse size={18} /> : <Store size={18} />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{pdv.nom}</p>
                            <p className="text-xs font-mono text-slate-400">{pdv.code}</p>
                            {pdv.adresse && <p className="text-xs text-slate-400 flex items-center gap-0.5"><MapPin size={10} /> {pdv.adresse}</p>}
                            {pdv.latitude != null && pdv.longitude != null && (
                              <a href={`https://www.google.com/maps?q=${pdv.latitude},${pdv.longitude}`} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5">
                                <ExternalLink size={10} /> {t('pdv_voir_carte')}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_BADGE[pdv.type]}`}>
                          {TYPE_LABEL[pdv.type]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {pdv.plateformeRegionale ? (
                          <span className="text-sm text-slate-700">{pdv.plateformeRegionale.nom}</span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {pdv.rpv ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-primary-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {initials(pdv.rpv.nom, pdv.rpv.prenom)}
                            </div>
                            <span className="text-sm text-slate-700">{pdv.rpv.prenom} {pdv.rpv.nom}</span>
                          </div>
                        ) : pdv.responsable ? (
                          <div className="flex items-center gap-2" title={t('label_responsable_site')}>
                            <div className="w-7 h-7 bg-gradient-to-br from-slate-400 to-slate-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {initials(pdv.responsable.nom, pdv.responsable.prenom)}
                            </div>
                            <span className="text-sm text-slate-700">{pdv.responsable.prenom} {pdv.responsable.nom}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">{t('text_no_assign')}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {pdv.chefAgence ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {initials(pdv.chefAgence.nom, pdv.chefAgence.prenom)}
                            </div>
                            <span className="text-sm text-slate-700">{pdv.chefAgence.prenom} {pdv.chefAgence.nom}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">{t('text_no_assign')}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Users size={14} className="text-slate-400" />
                          {pdv._count.affectations} gestionnaire{pdv._count.affectations > 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <ShoppingCart size={14} className="text-slate-400" />
                          {pdv._count.ventesDirectes}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {pdv.actif ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                            <CheckCircle size={10} /> {t('status_actif')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                            <XCircle size={10} /> {t('status_inactif')}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <Link href={`/dashboard/admin/pdv/${pdv.id}`}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Voir détail">
                            <ChevronRight size={15} />
                          </Link>
                          <button onClick={() => openEdit(pdv)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier">
                            <Edit size={15} />
                          </button>
                          <button onClick={() => setTogglePdv(pdv)}
                            className={`p-2 ${pdv.actif ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'} rounded-lg transition-colors`}
                            title={pdv.actif ? 'Désactiver' : 'Réactiver'}>
                            {pdv.actif ? <PowerOff size={15} /> : <Power size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>  
                  ))}
                  {pdvs.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <Store className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-500">{t('pdv_none_registered')}</p>
                        <p className="text-slate-400 text-sm mt-1">Cliquez sur &ldquo;Nouveau PDV&rdquo;pour commencer.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{meta.page}</span> sur <span className="font-semibold">{meta.totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors text-sm">
                  {t('btn_prev')}
                </button>
                <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm">{page}</span>
                <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors text-sm">
                  {t('btn_next')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Note info ─────────────────────────────────────────────────── */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
          <Store className="text-blue-500 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-blue-800">
            <strong>Affectation des équipes :</strong> Pour affecter des gestionnaires (caissiers, magasiniers, agents…)
            à un PDV, rendez-vous sur la page{' '}
            <Link href="/dashboard/admin/gestionnaires" className="underline font-medium hover:text-blue-600">
              Gestionnaires
            </Link>
            . La date de création du PDV est affichée au survol.
          </div>
        </div>

      </div>
    </div>
  );
}
