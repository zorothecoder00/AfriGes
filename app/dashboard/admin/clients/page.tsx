"use client";

import React, { useState, useEffect } from 'react';
import { Search, Plus, Phone, MapPin, Eye, Edit, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDate } from '@/lib/format';

interface Client {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string | null;
  etat: string;
  createdAt: string;
  _count: {
    credits: number;
    creditsAlim: number;
    cotisations: number;
    tontines: number;
  };
}

interface ClientsResponse {
  data: Client[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ nom: '', prenom: '', telephone: '', adresse: '' });
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data: response, loading, error, refetch } = useApi<ClientsResponse>(`/api/admin/clients?${params}`);
  const clients = response?.data ?? [];
  const meta = response?.meta;

  const { mutate: addClient, loading: adding, error: addError } = useMutation('/api/admin/clients', 'POST', { successMessage: 'Client ajouté avec succès' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addClient(formData);
    if (result) {
      setModalOpen(false);
      setFormData({ nom: '', prenom: '', telephone: '', adresse: '' });
      refetch();
    }
  };

  const getInitials = (nom: string, prenom: string) => `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
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
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">Reessayer</button>
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
              <p className="text-slate-500">Gerez les clients externes de votre communaute</p>
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium"
          >
            <Plus size={20} />
            Ajouter un client
          </button>
        </div>

        {/* Modal pour ajouter client */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold"
              >X</button>
              <h2 className="text-xl font-bold mb-4">Ajouter un nouveau client</h2>
              {addError && <p className="text-red-500 mb-2">{addError}</p>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text" placeholder="Nom" required
                  value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl"
                />
                <input
                  type="text" placeholder="Prenom" required
                  value={formData.prenom}
                  onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl"
                />
                <input
                  type="text" placeholder="Telephone" required
                  value={formData.telephone}
                  onChange={e => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl"
                />
                <input
                  type="text" placeholder="Adresse"
                  value={formData.adresse}
                  onChange={e => setFormData({ ...formData, adresse: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl"
                />
                <button
                  type="submit"
                  disabled={adding}
                  className="w-full py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all"
                >
                  {adding ? "Ajout en cours..." : "Ajouter le client"}
                </button>
              </form>
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
            <span className="text-slate-600 text-sm font-medium">Page actuelle</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">{meta?.page ?? '—'} / {meta?.totalPages ?? '—'}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">Affichage</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">{clients.length} clients</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">Recherche</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">{debouncedSearch || 'Aucune'}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un client par nom, prenom, telephone..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Telephone</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Adresse</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Activites</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                          {getInitials(client.nom, client.prenom)}
                        </div>
                        <div>
                          <Link href={`/dashboard/admin/clients/${client.id}`} className="font-semibold text-slate-800 hover:text-amber-600 transition-colors">
                            {client.prenom} {client.nom}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone size={14} className="text-slate-400" />
                        {client.telephone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={14} className="text-slate-400" />
                        {client.adresse || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 flex-wrap">
                        {client._count.credits > 0 && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{client._count.credits} credit{client._count.credits > 1 ? 's' : ''}</span>
                        )}
                        {client._count.creditsAlim > 0 && (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full font-medium">{client._count.creditsAlim} cr. alim.</span>
                        )}
                        {client._count.cotisations > 0 && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">{client._count.cotisations} cotis.</span>
                        )}
                        {client._count.tontines > 0 && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full font-medium">{client._count.tontines} tontine{client._count.tontines > 1 ? 's' : ''}</span>
                        )}
                        {client._count.credits === 0 && client._count.creditsAlim === 0 && client._count.cotisations === 0 && client._count.tontines === 0 && (
                          <span className="text-xs text-slate-400">Aucune</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{formatDate(client.createdAt)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/admin/clients/${client.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <Eye size={16} />
                        </Link>
                        <Link href={`/dashboard/admin/clients/${client.id}/edit`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit size={16} />
                        </Link>
                        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Aucun client trouve</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{meta.page}</span> sur <span className="font-semibold">{meta.totalPages}</span> ({meta.total} clients)
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Precedent
                </button>
                <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">{page}</span>
                <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
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
