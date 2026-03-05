"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Phone, MapPin, Eye, Edit, Trash2, ArrowLeft, Store, Building2, Link2, Link2Off, X } from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDate } from '@/lib/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PDVOption { id: number; nom: string; code: string; type: string; }

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  etat: string;
  createdAt: string;
  pointDeVente: { id: number; nom: string; code: string } | null;
  _count: { souscriptionsPacks: number };
}

interface ClientsResponse {
  data: Client[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [searchQuery, setSearchQuery]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]                   = useState(1);
  const [filterPdvId, setFilterPdvId]     = useState('');
  const [modalOpen, setModalOpen]         = useState(false);
  const [formData, setFormData]           = useState({ nom: '', prenom: '', telephone: '', adresse: '', pointDeVenteId: '' });

  // ── Modal affectation PDV ───────────────────────────────────────────────────
  const [affectClient, setAffectClient]   = useState<Client | null>(null);
  const [affectPdvId, setAffectPdvId]     = useState('');
  const [affectLoading, setAffectLoading] = useState(false);
  const [affectError, setAffectError]     = useState('');

  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (filterPdvId)     params.set('pdvId', filterPdvId);

  const { data: response, loading, error, refetch } =
    useApi<ClientsResponse>(`/api/admin/clients?${params}`);
  const clients = response?.data ?? [];
  const meta    = response?.meta;

  // PDV pour filtres et sélecteurs
  const { data: pdvResponse } = useApi<{ data: PDVOption[] }>('/api/admin/pdv?limit=200&actif=true');
  const pdvOptions = pdvResponse?.data ?? [];

  // Mutations
  const { mutate: addClient, loading: adding, error: addError } =
    useMutation('/api/admin/clients', 'POST', { successMessage: 'Client ajouté avec succès' });

  const affectClientIdRef = useRef<number | null>(null);
  const { mutate: patchClient } =
    useMutation(() => `/api/admin/clients/${affectClientIdRef.current}`, 'PATCH', { successMessage: 'Affectation mise à jour !' });

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addClient({
      nom: formData.nom,
      prenom: formData.prenom,
      telephone: formData.telephone,
      adresse: formData.adresse || null,
      pointDeVenteId: formData.pointDeVenteId ? Number(formData.pointDeVenteId) : null,
    });
    if (result) {
      setModalOpen(false);
      setFormData({ nom: '', prenom: '', telephone: '', adresse: '', pointDeVenteId: '' });
      refetch();
    }
  };

  const openAffectModal = (client: Client) => {
    setAffectClient(client);
    setAffectPdvId(client.pointDeVente ? String(client.pointDeVente.id) : '');
    setAffectError('');
  };

  const handleAffecter = async () => {
    if (!affectClient) return;
    setAffectLoading(true);
    setAffectError('');
    affectClientIdRef.current = affectClient.id;
    const res = await patchClient({ pointDeVenteId: affectPdvId ? Number(affectPdvId) : null });
    setAffectLoading(false);
    if (res) { setAffectClient(null); refetch(); }
    else setAffectError('Erreur lors de l\'affectation');
  };

  const handleDesaffecter = async () => {
    if (!affectClient) return;
    setAffectLoading(true);
    setAffectError('');
    affectClientIdRef.current = affectClient.id;
    const res = await patchClient({ pointDeVenteId: null });
    setAffectLoading(false);
    if (res) { setAffectClient(null); refetch(); }
    else setAffectError('Erreur lors de la désaffectation');
  };

  const getInitials = (nom: string, prenom: string) => `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement des clients...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Clients</h1>
              <p className="text-slate-500">Gérez les clients et leur affectation aux points de vente</p>
            </div>
          </div>
          <button onClick={() => setModalOpen(true)}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
            <Plus size={20} /> Ajouter un client
          </button>
        </div>

        {/* ══ MODAL — Ajout client ══════════════════════════════════════════ */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
              <button onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold mb-4">Ajouter un nouveau client</h2>
              {addError && <p className="text-red-500 mb-2">{addError}</p>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input type="text" placeholder="Nom" required value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
                <input type="text" placeholder="Prénom" required value={formData.prenom}
                  onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
                <input type="text" placeholder="Téléphone" required value={formData.telephone}
                  onChange={e => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
                <input type="text" placeholder="Adresse (optionnel)" value={formData.adresse}
                  onChange={e => setFormData({ ...formData, adresse: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Store size={13} className="inline mr-1 text-slate-400" />Point de vente de rattachement (optionnel)
                  </label>
                  <select value={formData.pointDeVenteId}
                    onChange={e => setFormData({ ...formData, pointDeVenteId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                    <option value="">Aucun PDV</option>
                    {pdvOptions.map(p => (
                      <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>
                    ))}
                  </select>
                </div>
                <button type="submit" disabled={adding}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium">
                  {adding ? 'Ajout en cours...' : 'Ajouter le client'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══ MODAL — Affectation PDV client ════════════════════════════════ */}
        {affectClient && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl relative">
              <button onClick={() => setAffectClient(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Affecter à un PDV</h2>
              <p className="text-sm text-slate-500 mb-5">
                {affectClient.prenom} {affectClient.nom} — {affectClient.telephone}
              </p>

              {affectClient.pointDeVente && (
                <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <Store size={15} className="text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{affectClient.pointDeVente.nom}</p>
                    <p className="text-xs text-slate-500">{affectClient.pointDeVente.code} — PDV actuel</p>
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
                  {affectClient.pointDeVente ? 'Réaffecter à un autre PDV' : 'Choisir un PDV'}
                </label>
                <select value={affectPdvId} onChange={e => setAffectPdvId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                  <option value="">Sélectionner un PDV…</option>
                  {pdvOptions.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.type === 'DEPOT_CENTRAL' ? '🏭 ' : '🏪 '}{p.nom} ({p.code})
                    </option>
                  ))}
                </select>
                <button onClick={handleAffecter} disabled={affectLoading || !affectPdvId}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 font-medium flex items-center justify-center gap-2 transition-colors">
                  <Link2 size={15} />
                  {affectLoading ? 'En cours…' : affectClient.pointDeVente ? 'Réaffecter' : 'Affecter au PDV'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-5">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">Total Clients</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">{meta?.total ?? '—'}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">Avec PDV</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">
              {clients.filter(c => c.pointDeVente).length}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">Sans PDV</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">
              {clients.filter(c => !c.pointDeVente).length}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">Page</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">{meta?.page ?? '—'} / {meta?.totalPages ?? '—'}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input type="text" placeholder="Rechercher par nom, prénom, téléphone..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
            </div>
            <select value={filterPdvId} onChange={e => { setFilterPdvId(e.target.value); setPage(1); }}
              className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 min-w-[200px]">
              <option value="">Tous les PDV</option>
              {pdvOptions.map(p => (
                <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Téléphone</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Adresse</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">PDV rattaché</th>
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
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                          {getInitials(client.nom, client.prenom)}
                        </div>
                        <div>
                          <Link href={`/dashboard/admin/clients/${client.id}`}
                            className="font-semibold text-slate-800 hover:text-amber-600 transition-colors">
                            {client.prenom} {client.nom}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone size={14} className="text-slate-400" /> {client.telephone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={14} className="text-slate-400" /> {client.adresse || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {client.pointDeVente ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Store size={12} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{client.pointDeVente.nom}</p>
                            <p className="text-xs text-slate-400 font-mono">{client.pointDeVente.code}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Non affecté</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {client._count.souscriptionsPacks > 0 ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">
                          {client._count.souscriptionsPacks} souscription{client._count.souscriptionsPacks > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Aucune</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{formatDate(client.createdAt)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/admin/clients/${client.id}`}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Voir">
                          <Eye size={16} />
                        </Link>
                        <Link href={`/dashboard/admin/clients/${client.id}/edit`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier">
                          <Edit size={16} />
                        </Link>
                        <button onClick={() => openAffectModal(client)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title={client.pointDeVente ? 'Réaffecter PDV' : 'Affecter à un PDV'}>
                          {client.pointDeVente ? <Building2 size={16} /> : <Store size={16} />}
                        </button>
                        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">Aucun client trouvé</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {meta && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{meta.page}</span> sur <span className="font-semibold">{meta.totalPages}</span> ({meta.total} clients)
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Précédent
                </button>
                <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">{page}</span>
                <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
