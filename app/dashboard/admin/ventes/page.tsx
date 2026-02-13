"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Download, ShoppingCart, TrendingUp, DollarSign, Users, Calendar, Eye, MoreVertical, Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDateTime } from '@/lib/format';

interface VenteCreditAlimentaire {
  id: number;
  quantite: number;
  prixUnitaire: string;
  createdAt: string;
  produit: {
    id: number;
    nom: string;
    prixUnitaire: string;
  };
  creditAlimentaire: {
    id: number;
    member: {
      id: number;
      nom: string;
      prenom: string;
      email: string;
    };
  };
}

interface VentesResponse {
  data: VenteCreditAlimentaire[];
  stats: {
    totalVentes: number;
    montantTotal: number | string;
    clientsActifs: number;
  };
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface CreditAlimOption {
  id: number;
  plafond: string;
  montantRestant: string;
  statut: string;
  member: { id: number; nom: string; prenom: string };
}

interface CreditsAlimListResponse {
  data: CreditAlimOption[];
}

interface ProduitOption {
  id: number;
  nom: string;
  prixUnitaire: string;
  stock: number;
}

interface ProduitsListResponse {
  data: ProduitOption[];
}

export default function VentesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ creditAlimentaireId: '', produitId: '', quantite: '1' });
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data: response, loading, error, refetch } = useApi<VentesResponse>(`/api/admin/ventes?${params}`);
  const ventes = response?.data ?? [];
  const stats = response?.stats;
  const meta = response?.meta;

  const { data: creditsAlimResponse } = useApi<CreditsAlimListResponse>(modalOpen ? '/api/admin/creditsAlimentaires?limit=200&statut=ACTIF' : null);
  const creditsAlim = (creditsAlimResponse?.data ?? []).filter(c => c.statut === 'ACTIF');

  const { data: produitsResponse } = useApi<ProduitsListResponse>(modalOpen ? '/api/admin/stock?limit=200' : null);
  const produits = (produitsResponse?.data ?? []).filter(p => p.stock > 0);

  const { mutate: addVente, loading: adding, error: addError } = useMutation('/api/admin/ventes', 'POST');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addVente({
      creditAlimentaireId: Number(formData.creditAlimentaireId),
      produitId: Number(formData.produitId),
      quantite: Number(formData.quantite),
    });
    if (result) {
      setModalOpen(false);
      setFormData({ creditAlimentaireId: '', produitId: '', quantite: '1' });
      refetch();
    }
  };

  const getInitials = (nom: string, prenom: string) => `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();

  const panierMoyen = stats && stats.totalVentes > 0
    ? Number(stats.montantTotal) / stats.totalVentes
    : 0;

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement des ventes...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Montant Total', value: formatCurrency(stats?.montantTotal ?? 0), icon: TrendingUp, color: 'bg-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Transactions', value: String(stats?.totalVentes ?? 0), icon: ShoppingCart, color: 'bg-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Panier Moyen', value: formatCurrency(panierMoyen), icon: DollarSign, color: 'bg-purple-500', lightBg: 'bg-purple-50' },
    { label: 'Clients Actifs', value: String(stats?.clientsActifs ?? 0), icon: Users, color: 'bg-amber-500', lightBg: 'bg-amber-50' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Ventes</h1>
              <p className="text-slate-500">Gerez et suivez toutes vos transactions de vente</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Exporter
            </button>
            <button onClick={() => setModalOpen(true)} className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
              <Plus size={20} />
              Nouvelle vente
            </button>
          </div>
        </div>

        {/* Modal Nouvelle Vente */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold">X</button>
              <h2 className="text-xl font-bold mb-4">Nouvelle vente</h2>
              {addError && <p className="text-red-500 mb-2 text-sm">{addError}</p>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client (credit alimentaire)</label>
                  <select
                    required
                    value={formData.creditAlimentaireId}
                    onChange={e => setFormData({ ...formData, creditAlimentaireId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">Selectionner un credit alimentaire</option>
                    {creditsAlim.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.member.prenom} {c.member.nom} - Solde: {formatCurrency(c.montantRestant)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Produit</label>
                  <select
                    required
                    value={formData.produitId}
                    onChange={e => setFormData({ ...formData, produitId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">Selectionner un produit</option>
                    {produits.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nom} - {formatCurrency(p.prixUnitaire)} (Stock: {p.stock})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantite</label>
                  <input
                    type="number" placeholder="Ex: 3" required min="1"
                    value={formData.quantite}
                    onChange={e => setFormData({ ...formData, quantite: e.target.value })}
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </div>
                <button type="submit" disabled={adding} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium">
                  {adding ? "Creation en cours..." : "Enregistrer la vente"}
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
                <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
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
                placeholder="Rechercher par client ou produit..."
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

        {/* Sales Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantite</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Prix Unitaire</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Montant Total</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ventes.map((vente) => {
                  const montantTotal = vente.quantite * Number(vente.prixUnitaire);
                  return (
                    <tr key={vente.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                            {getInitials(vente.creditAlimentaire.member.nom, vente.creditAlimentaire.member.prenom)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800">{vente.creditAlimentaire.member.prenom} {vente.creditAlimentaire.member.nom}</span>
                            <p className="text-xs text-slate-500">{vente.creditAlimentaire.member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-slate-400" />
                          <span className="text-sm font-medium text-slate-800">{vente.produit.nom}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-800">{vente.quantite}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{formatCurrency(vente.prixUnitaire)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-slate-800">{formatCurrency(montantTotal)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="text-sm text-slate-600">{formatDateTime(vente.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/admin/ventes/${vente.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Eye size={16} />
                          </Link>
                          <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {ventes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">Aucune vente trouvee</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{meta.page}</span> sur <span className="font-semibold">{meta.totalPages}</span> ({meta.total} ventes)
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
