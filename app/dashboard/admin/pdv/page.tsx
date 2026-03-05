"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Store, Building2, ArrowLeft, Edit, Power, PowerOff,
  CheckCircle, XCircle, Users, ShoppingCart, ChevronRight, X,
  MapPin, Phone, FileText, User, UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDate } from '@/lib/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PDVUser { id: number; nom: string; prenom: string; }
interface PDV {
  id: number; code: string; nom: string; type: 'POINT_DE_VENTE' | 'DEPOT_CENTRAL';
  adresse: string | null; telephone: string | null; notes: string | null;
  actif: boolean; createdAt: string;
  rpv: PDVUser | null;
  chefAgence: PDVUser | null;
  _count: { stocks: number; ventesDirectes: number; affectations: number };
}
interface PDVResponse {
  data: PDV[];
  stats: { totalPDV: number; totalDepot: number; totalActifs: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}
interface GestionnaireOption {
  id: number; role: string;
  member: { id: number; nom: string; prenom: string; };
}

const TYPE_BADGE: Record<string, string> = {
  POINT_DE_VENTE: 'bg-blue-100 text-blue-700',
  DEPOT_CENTRAL: 'bg-purple-100 text-purple-700',
};
const TYPE_LABEL: Record<string, string> = {
  POINT_DE_VENTE: 'Point de vente',
  DEPOT_CENTRAL: 'Dépôt central',
};

function initials(nom: string, prenom: string) {
  return `${(prenom?.[0] ?? '').toUpperCase()}${(nom?.[0] ?? '').toUpperCase()}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PDVPage() {
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
    rpvId: '', chefAgenceId: '',
  });

  // ── Modal édition ───────────────────────────────────────────────────────────
  const [editPdv, setEditPdv]       = useState<PDV | null>(null);
  const [editForm, setEditForm]     = useState({
    nom: '', adresse: '', telephone: '', notes: '', rpvId: '', chefAgenceId: '', actif: true,
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
    });
    if (res) {
      setCreateOpen(false);
      setCreateForm({ code: '', nom: '', type: 'POINT_DE_VENTE', adresse: '', telephone: '', notes: '', rpvId: '', chefAgenceId: '' });
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
      actif:        pdv.actif,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Points de vente</h1>
              <p className="text-slate-500">Gérez vos PDV, dépôts et leurs responsables</p>
            </div>
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 font-medium">
            <Plus size={20} /> Nouveau PDV / Dépôt
          </button>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-5">
          {[
            { label: 'Points de vente', value: String(stats?.totalPDV ?? 0),    icon: Store,     color: 'bg-blue-500',   lightBg: 'bg-blue-50' },
            { label: 'Dépôts centraux', value: String(stats?.totalDepot ?? 0),  icon: Building2, color: 'bg-purple-500', lightBg: 'bg-purple-50' },
            { label: 'Actifs',          value: String(stats?.totalActifs ?? 0), icon: CheckCircle,color:'bg-emerald-500',lightBg: 'bg-emerald-50' },
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
              <input type="text" placeholder="Rechercher par nom ou code…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm" />
            </div>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
              className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="">Tous les types</option>
              <option value="POINT_DE_VENTE">Point de vente</option>
              <option value="DEPOT_CENTRAL">Dépôt central</option>
            </select>
            <select value={filterActif} onChange={e => { setFilterActif(e.target.value); setPage(1); }}
              className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="">Tous statuts</option>
              <option value="true">Actifs</option>
              <option value="false">Inactifs</option>
            </select>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MODAL — Créer PDV
        ══════════════════════════════════════════════════════════════════ */}
        {createOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setCreateOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Nouveau point de vente</h2>
              <p className="text-sm text-slate-500 mb-5">Créer un PDV ou un dépôt central</p>
              {createError && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{createError}</p>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
                    <input type="text" required placeholder="Ex: PDV-DAKAR-01" value={createForm.code}
                      onChange={e => setCreateForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                    <select value={createForm.type}
                      onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="POINT_DE_VENTE">Point de vente</option>
                      <option value="DEPOT_CENTRAL">Dépôt central</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
                  <input type="text" required placeholder="Nom complet du PDV" value={createForm.nom}
                    onChange={e => setCreateForm(f => ({ ...f, nom: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <MapPin size={13} className="inline mr-1 text-slate-400" />Adresse
                    </label>
                    <input type="text" placeholder="Adresse" value={createForm.adresse}
                      onChange={e => setCreateForm(f => ({ ...f, adresse: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <Phone size={13} className="inline mr-1 text-slate-400" />Téléphone
                    </label>
                    <input type="text" placeholder="Téléphone" value={createForm.telephone}
                      onChange={e => setCreateForm(f => ({ ...f, telephone: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
                {createForm.type === 'POINT_DE_VENTE' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <UserCheck size={13} className="inline mr-1 text-slate-400" />Responsable PDV (RPV)
                    </label>
                    <select value={createForm.rpvId}
                      onChange={e => setCreateForm(f => ({ ...f, rpvId: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="">Aucun (assigner plus tard)</option>
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
                    <User size={13} className="inline mr-1 text-slate-400" />Chef d&apos;agence
                  </label>
                  <select value={createForm.chefAgenceId}
                    onChange={e => setCreateForm(f => ({ ...f, chefAgenceId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="">Aucun (assigner plus tard)</option>
                    {chefOptions.map(g => (
                      <option key={g.id} value={g.member.id}>
                        {g.member.prenom} {g.member.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <FileText size={13} className="inline mr-1 text-slate-400" />Notes
                  </label>
                  <textarea rows={2} placeholder="Notes internes…" value={createForm.notes}
                    onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
                </div>
                <button type="submit" disabled={creating}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 font-medium transition-colors">
                  {creating ? 'Création…' : 'Créer le point de vente'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL — Éditer PDV
        ══════════════════════════════════════════════════════════════════ */}
        {editPdv && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setEditPdv(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Modifier — {editPdv.nom}</h2>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
                  <input type="text" required value={editForm.nom}
                    onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
                    <input type="text" value={editForm.adresse}
                      onChange={e => setEditForm(f => ({ ...f, adresse: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                    <input type="text" value={editForm.telephone}
                      onChange={e => setEditForm(f => ({ ...f, telephone: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
                {editPdv.type === 'POINT_DE_VENTE' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <UserCheck size={13} className="inline mr-1 text-slate-400" />Responsable PDV (RPV)
                    </label>
                    <select value={editForm.rpvId}
                      onChange={e => setEditForm(f => ({ ...f, rpvId: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="">Aucun</option>
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
                    <User size={13} className="inline mr-1 text-slate-400" />Chef d&apos;agence
                  </label>
                  <select value={editForm.chefAgenceId}
                    onChange={e => setEditForm(f => ({ ...f, chefAgenceId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="">Aucun</option>
                    {chefOptions.map(g => (
                      <option key={g.id} value={g.member.id}>
                        {g.member.prenom} {g.member.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea rows={2} value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
                </div>
                <button type="submit" disabled={updating}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 font-medium transition-colors">
                  {updating ? 'Enregistrement…' : 'Enregistrer les modifications'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL — Toggle actif
        ══════════════════════════════════════════════════════════════════ */}
        {togglePdv && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl text-center">
              <div className={`w-14 h-14 ${togglePdv.actif ? 'bg-red-100' : 'bg-emerald-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                {togglePdv.actif
                  ? <PowerOff className="text-red-600 w-7 h-7" />
                  : <Power className="text-emerald-600 w-7 h-7" />}
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">
                {togglePdv.actif ? 'Désactiver' : 'Réactiver'} ce PDV ?
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                <strong>{togglePdv.nom}</strong>
                {togglePdv.actif
                  ? " ne sera plus accessible. Le stock et l'historique sont conservés."
                  : ' sera à nouveau opérationnel.'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setTogglePdv(null)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium">
                  Annuler
                </button>
                <button onClick={handleToggleActif} disabled={toggling}
                  className={`flex-1 py-2.5 ${togglePdv.actif ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-xl font-medium disabled:opacity-60 transition-colors`}>
                  {toggling ? '…' : togglePdv.actif ? 'Désactiver' : 'Réactiver'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Table PDV ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Points de vente et dépôts</h3>
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
                    {['Site', 'Type', 'RPV', 'Chef d\'agence', 'Équipe', 'Ventes', 'Statut', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pdvs.map(pdv => (
                    <tr key={pdv.id} className={`hover:bg-slate-50 transition-colors ${!pdv.actif ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${pdv.type === 'DEPOT_CENTRAL' ? 'bg-gradient-to-br from-purple-400 to-purple-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'} rounded-xl flex items-center justify-center text-white shadow-sm`}>
                            {pdv.type === 'DEPOT_CENTRAL' ? <Building2 size={18} /> : <Store size={18} />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{pdv.nom}</p>
                            <p className="text-xs font-mono text-slate-400">{pdv.code}</p>
                            {pdv.adresse && <p className="text-xs text-slate-400 flex items-center gap-0.5"><MapPin size={10} /> {pdv.adresse}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_BADGE[pdv.type]}`}>
                          {TYPE_LABEL[pdv.type]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {pdv.rpv ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {initials(pdv.rpv.nom, pdv.rpv.prenom)}
                            </div>
                            <span className="text-sm text-slate-700">{pdv.rpv.prenom} {pdv.rpv.nom}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Non assigné</span>
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
                          <span className="text-xs text-slate-400 italic">Non assigné</span>
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
                            <CheckCircle size={10} /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                            <XCircle size={10} /> Inactif
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
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <Store className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-500">Aucun point de vente enregistré</p>
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
                  Précédent
                </button>
                <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm">{page}</span>
                <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors text-sm">
                  Suivant
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
