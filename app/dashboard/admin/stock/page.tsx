"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Download, Package, TrendingUp, AlertTriangle, Archive, Eye, Edit, Trash2, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';

interface Produit {
  id: number;
  nom: string;
  description: string | null;
  prixUnitaire: string;
  stock: number;
  alerteStock: number;
  createdAt: string;
  updatedAt: string;
}

interface StockResponse {
  data: Produit[];
  stats: {
    totalProduits: number;
    enRupture: number;
    stockFaible: number;
    valeurTotale: number | string;
  };
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

type StatutStock = 'EN_STOCK' | 'STOCK_FAIBLE' | 'RUPTURE';

const getStockStatut = (stock: number, alerte: number): StatutStock => {
  if (stock === 0) return 'RUPTURE';
  if (stock <= alerte) return 'STOCK_FAIBLE';
  return 'EN_STOCK';
};

const statutStyles: Record<StatutStock, { bg: string; text: string; border: string; dot: string; label: string }> = {
  EN_STOCK: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'En stock' },
  STOCK_FAIBLE: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Stock faible' },
  RUPTURE: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', label: 'Rupture' },
};

export default function GestionStockPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ nom: '', description: '', prixUnitaire: '', stock: '', alerteStock: '' });
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data: response, loading, error, refetch } = useApi<StockResponse>(`/api/admin/stock?${params}`);
  const produits = response?.data ?? [];
  const stats = response?.stats;
  const meta = response?.meta;

  // Mutations
  const { mutate: addProduit, loading: adding, error: addError } = useMutation('/api/admin/stock', 'POST');
  const { mutate: deleteProduit, loading: deleting } = useMutation(`/api/admin/stock/${deleteId}`, 'DELETE');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addProduit({
      nom: formData.nom,
      description: formData.description || undefined,
      prixUnitaire: Number(formData.prixUnitaire),
      stock: Number(formData.stock) || 0,
      alerteStock: Number(formData.alerteStock) || 0,
    });
    if (result) {
      setModalOpen(false);
      setFormData({ nom: '', description: '', prixUnitaire: '', stock: '', alerteStock: '' });
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteProduit({});
    if (result) {
      setDeleteId(null);
      refetch();
    }
  };

  const getProgressColor = (quantite: number, seuil: number): string => {
    const percentage = seuil > 0 ? (quantite / seuil) * 100 : 100;
    if (percentage > 100) return 'bg-emerald-500';
    if (percentage > 50) return 'bg-blue-500';
    if (percentage > 25) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getProgressPercentage = (quantite: number, seuil: number): number => {
    if (seuil === 0) return quantite > 0 ? 100 : 0;
    return Math.min((quantite / seuil) * 100, 100);
  };

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement du stock...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Valeur Totale Stock', value: formatCurrency(stats?.valeurTotale ?? 0), icon: TrendingUp, color: 'bg-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Produits en Stock', value: String(stats?.totalProduits ?? 0), icon: Package, color: 'bg-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Stock Faible', value: String(stats?.stockFaible ?? 0), icon: AlertTriangle, color: 'bg-amber-500', lightBg: 'bg-amber-50' },
    { label: 'Ruptures', value: String(stats?.enRupture ?? 0), icon: Archive, color: 'bg-red-500', lightBg: 'bg-red-50' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Gestion du Stock</h1>
            <p className="text-slate-500">Suivez et gerez votre inventaire en temps reel</p>
          </div>
          <div className="flex gap-3">
            <button onClick={refetch} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <RefreshCw size={18} />
              Actualiser
            </button>
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Exporter
            </button>
            <button onClick={() => setModalOpen(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 font-medium">
              <Plus size={20} />
              Ajouter un produit
            </button>
          </div>
        </div>

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

        {/* Alerts Section */}
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg shadow-red-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Archive size={24} />
              </div>
              <div>
                <p className="text-red-100 text-sm">Ruptures de stock</p>
                <p className="text-3xl font-bold">{stats?.enRupture ?? 0} produits</p>
              </div>
            </div>
            <p className="text-red-100 text-sm">Action immediate requise</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg shadow-amber-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-amber-100 text-sm">Stock faible</p>
                <p className="text-3xl font-bold">{stats?.stockFaible ?? 0} produits</p>
              </div>
            </div>
            <p className="text-amber-100 text-sm">Reapprovisionnement bientot</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => { 
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Modal Ajout Produit */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold mb-4">Ajouter un produit</h2>
              {addError && <p className="text-red-500 mb-2 text-sm">{addError}</p>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input type="text" placeholder="Nom du produit" required value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                <input type="text" placeholder="Description (optionnel)" value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                <input type="number" placeholder="Prix unitaire" required min="0.01" step="0.01" value={formData.prixUnitaire}
                  onChange={e => setFormData({ ...formData, prixUnitaire: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Stock initial" min="0" value={formData.stock}
                    onChange={e => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                  <input type="number" placeholder="Seuil d'alerte" min="0" value={formData.alerteStock}
                    onChange={e => setFormData({ ...formData, alerteStock: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                </div>
                <button type="submit" disabled={adding} className="w-full py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium">
                  {adding ? "Ajout en cours..." : "Ajouter le produit"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Confirmation Suppression */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-lg text-center">
              <h2 className="text-lg font-bold text-slate-800 mb-2">Confirmer la suppression</h2>
              <p className="text-slate-500 text-sm mb-6">Voulez-vous vraiment supprimer ce produit ? Il ne doit pas avoir de ventes associees.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium">
                  Annuler
                </button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">
                  {deleting ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Produit</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantite</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Niveau de stock</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Prix Unitaire</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Valeur Stock</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Mise a jour</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {produits.map((produit) => {
                  const statut = getStockStatut(produit.stock, produit.alerteStock);
                  const statutInfo = statutStyles[statut];
                  const progressColor = getProgressColor(produit.stock, produit.alerteStock);
                  const progressPercentage = getProgressPercentage(produit.stock, produit.alerteStock);
                  const valeurStock = produit.stock * Number(produit.prixUnitaire);

                  return (
                    <tr key={produit.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-800">{produit.nom}</p>
                          {produit.description && <p className="text-xs text-slate-500">{produit.description}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-lg font-bold text-slate-800">{produit.stock}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2 w-32">
                          <div className="flex items-center justify-between text-xs text-slate-600">
                            <span>Seuil: {produit.alerteStock}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${progressColor} rounded-full transition-all`}
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-800">{formatCurrency(produit.prixUnitaire)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-base font-bold text-slate-800">{formatCurrency(valeurStock)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{formatDate(produit.updatedAt)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${statutInfo.bg} ${statutInfo.text} ${statutInfo.border}`}>
                          <div className={`w-2 h-2 rounded-full ${statutInfo.dot}`}></div>
                          {statutInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/admin/stock/${produit.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Eye size={16} />
                          </Link>
                          <Link href={`/dashboard/admin/stock/${produit.id}/edit`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit size={16} />
                          </Link>
                          <button onClick={() => setDeleteId(produit.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {produits.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">Aucun produit trouve</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{meta.page}</span> sur <span className="font-semibold">{meta.totalPages}</span> ({meta.total} produits)
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Precedent
                </button>
                <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">{page}</span>
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
