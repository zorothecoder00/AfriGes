"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Download, ShoppingCart, TrendingUp, DollarSign, AlertCircle, CheckCircle, Clock, Eye, MoreVertical, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStatusStyle, getStatusLabel } from '@/lib/status';

interface CreditAlimentaire {
  id: number;
  plafond: string;
  montantUtilise: string;
  montantRestant: string;
  statut: string;
  source: string;
  dateExpiration: string | null;
  createdAt: string;
  client: {
    id: number;
    nom: string;
    prenom: string;
    telephone: string;
  } | null;
}

interface CreditsAlimentairesResponse {
  data: CreditAlimentaire[];
  stats: {
    totalActifs: number;
    totalEpuises: number;
    totalExpires: number;
    montantTotalPlafond: number | string;
    montantTotalUtilise: number | string;
    montantTotalRestant: number | string;
  };
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ClientOption {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
}

interface ClientsListResponse {
  data: ClientOption[];
}

export default function CreditsAlimentairesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statutFilter, setStatutFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ clientId: '', plafond: '', source: 'COTISATION', sourceId: '1', dateExpiration: '' });
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (statutFilter) params.set('statut', statutFilter);

  const { data: response, loading, error, refetch } = useApi<CreditsAlimentairesResponse>(`/api/admin/creditsAlimentaires?${params}`);
  const credits = response?.data ?? [];
  const stats = response?.stats;
  const meta = response?.meta;

  const { data: clientsResponse } = useApi<ClientsListResponse>(modalOpen ? '/api/admin/clients?limit=200' : null);
  // Charger tous les credits actifs pour exclure les clients qui en ont deja un
  const { data: creditsActifsResponse } = useApi<CreditsAlimentairesResponse>(modalOpen ? '/api/admin/creditsAlimentaires?statut=ACTIF&limit=1000' : null);
  const clientsAvecCreditActif = new Set((creditsActifsResponse?.data ?? []).map(c => c.client?.id).filter(Boolean));
  const clients = (clientsResponse?.data ?? []).filter(c => !clientsAvecCreditActif.has(c.id));

  // Charger cotisations ou tontines selon la source selectionnee
  const { data: cotisationsSource } = useApi<{ data: { id: number; montant: string; periode: string; client: { nom: string; prenom: string } | null }[] }>(
    modalOpen && formData.source === 'COTISATION' ? '/api/admin/cotisations?limit=200&statut=PAYEE' : null
  );
  const { data: tontinesSource } = useApi<{ data: { id: number; nom: string }[] }>(
    modalOpen && formData.source === 'TONTINE' ? '/api/admin/tontines' : null
  );

  const { mutate: addCredit, loading: adding, error: addError } = useMutation('/api/admin/creditsAlimentaires', 'POST', { successMessage: 'Crédit alimentaire ajouté avec succès' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addCredit({
      clientId: Number(formData.clientId),
      plafond: Number(formData.plafond),
      source: formData.source,
      sourceId: Number(formData.sourceId),
      dateExpiration: formData.dateExpiration || undefined,
    });
    if (result) {
      setModalOpen(false);
      setFormData({ clientId: '', plafond: '', source: 'COTISATION', sourceId: '1', dateExpiration: '' });
      refetch();
    }
  };

  const getInitials = (nom: string, prenom: string) => `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();

  const getProgression = (utilise: string, plafond: string) => {
    const u = parseFloat(utilise) || 0;
    const p = parseFloat(plafond) || 1;
    return Math.round((u / p) * 100);
  };

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement des credits alimentaires...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Credits Actifs', value: stats?.totalActifs?.toString() ?? '—', subValue: formatCurrency(stats?.montantTotalPlafond ?? 0), icon: TrendingUp, color: 'bg-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Montant Utilise', value: formatCurrency(stats?.montantTotalUtilise ?? 0), subValue: '', icon: ShoppingCart, color: 'bg-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Montant Disponible', value: formatCurrency(stats?.montantTotalRestant ?? 0), subValue: '', icon: DollarSign, color: 'bg-purple-500', lightBg: 'bg-purple-50' },
    { label: 'Credits Epuises', value: stats?.totalEpuises?.toString() ?? '—', subValue: `${stats?.totalExpires ?? 0} expires`, icon: AlertCircle, color: 'bg-amber-500', lightBg: 'bg-amber-50' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-emerald-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Credits Alimentaires</h1>
              <p className="text-slate-500">Gerez les credits alimentaires de vos clients</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Rapport
            </button>
            <button onClick={() => setModalOpen(true)} className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
              <Plus size={20} />
              Nouveau credit alimentaire
            </button>
          </div>
        </div>

        {/* Modal Nouveau Credit */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold">X</button>
              <h2 className="text-xl font-bold mb-4">Nouveau credit alimentaire</h2>
              {addError && <p className="text-red-500 mb-2 text-sm">{addError}</p>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Beneficiaire</label>
                  <select
                    required
                    value={formData.clientId}
                    onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">Selectionner un client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.prenom} {c.nom} ({c.telephone})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Plafond du credit alimentaire (FCFA)</label>
                  <input
                    type="number" placeholder="Ex: 100 000" required min="1" step="0.01"
                    value={formData.plafond}
                    onChange={e => setFormData({ ...formData, plafond: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Source du credit</label>
                  <select
                    value={formData.source}
                    onChange={e => setFormData({ ...formData, source: e.target.value, sourceId: '' })}
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="COTISATION">Cotisation</option>
                    <option value="TONTINE">Tontine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {formData.source === 'COTISATION' ? 'Cotisation associee' : 'Tontine associee'}
                  </label>
                  <select
                    required
                    value={formData.sourceId}
                    onChange={e => setFormData({ ...formData, sourceId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">
                      {formData.source === 'COTISATION' ? 'Selectionner une cotisation' : 'Selectionner une tontine'}
                    </option>
                    {formData.source === 'COTISATION'
                      ? (cotisationsSource?.data ?? []).map(c => (
                          <option key={c.id} value={c.id}>
                            #{c.id} - {c.client?.prenom} {c.client?.nom} - {formatCurrency(c.montant)} ({getStatusLabel(c.periode)})
                          </option>
                        ))
                      : (tontinesSource?.data ?? []).map(t => (
                          <option key={t.id} value={t.id}>
                            {t.nom}
                          </option>
                        ))
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date d&apos;expiration (optionnel)</label>
                  <input
                    type="date"
                    value={formData.dateExpiration}
                    onChange={e => setFormData({ ...formData, dateExpiration: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </div>
                <button type="submit" disabled={adding} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium">
                  {adding ? "Creation en cours..." : "Creer le credit"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-5">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className={`${stat.lightBg} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                    <Icon className={`${stat.color.replace('bg-', 'text-')} w-6 h-6`} />
                  </div>
                </div>
                <h3 className="text-slate-600 text-sm font-medium mb-1">{stat.label}</h3>
                <p className="text-3xl font-bold text-slate-800 mb-1">{stat.value}</p>
                {stat.subValue && <p className="text-xs text-slate-500">{stat.subValue}</p>}
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un beneficiaire..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
            <select
              value={statutFilter}
              onChange={(e) => {
                setStatutFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            >
              <option value="">Tous les statuts</option>
              <option value="ACTIF">Actifs</option>
              <option value="EPUISE">Epuises</option>
              <option value="EXPIRE">Expires</option>
            </select>
          </div>
        </div>

        {/* Credits Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Beneficiaire</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Plafond</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Utilise</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Disponible</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Progression</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Echeance</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {credits.map((credit) => {
                  const progression = getProgression(credit.montantUtilise, credit.plafond);
                  return (
                    <tr key={credit.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                            {getInitials(credit.client?.nom ?? '', credit.client?.prenom ?? '')}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800">{credit.client?.prenom} {credit.client?.nom}</span>
                            <p className="text-xs text-slate-500">{credit.client?.telephone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-slate-800">{formatCurrency(credit.plafond)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-blue-600">{formatCurrency(credit.montantUtilise)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-emerald-600">{formatCurrency(credit.montantRestant)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className="text-xs text-slate-600">{progression}%</span>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-24">
                            <div
                              className={`h-full rounded-full transition-all ${progression < 50 ? 'bg-emerald-500' : progression < 90 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${progression}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{credit.dateExpiration ? formatDate(credit.dateExpiration) : '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusStyle(credit.statut)}`}>
                          {getStatusLabel(credit.statut)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/admin/creditsAlimentaires/${credit.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Eye size={16} />
                          </Link>
                          <Link href={`/dashboard/admin/creditsAlimentaires/${credit.id}/edit`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <MoreVertical size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {credits.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">Aucun credit alimentaire trouve</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{meta.page}</span> sur <span className="font-semibold">{meta.totalPages}</span> ({meta.total} credits)
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
