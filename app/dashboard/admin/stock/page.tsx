"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Download, Package, TrendingUp, AlertTriangle, Archive,
  Eye, Edit, Trash2, RefreshCw, X, ArrowLeft, Store, Building2, Layers, ChevronDown, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportToCsv } from '@/lib/exportCsv';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PDVOption { id: number; nom: string; code: string; type: string; }

// Mode par-PDV (StockSite)
interface StockItem {
  id: number; produitId: number; pointDeVenteId: number; quantite: number; alerteStock: number | null;
  produit: { id: number; nom: string; reference?: string; categorie?: string; unite?: string; prixUnitaire: string; alerteStock: number };
  pointDeVente: { id: number; nom: string; code: string; type: string };
}

// Mode grand stock (agrégé par produit)
interface GrandStockItem {
  id: number; nom: string; reference?: string; categorie?: string; unite?: string;
  prixUnitaire: string; alerteStock: number;
  totalStock: number;
  stocks: { quantite: number; alerteStock: number | null; pointDeVente: { id: number; nom: string; code: string; type: string } }[];
}

interface StockResponse {
  data: StockItem[] | GrandStockItem[];
  pdvs: PDVOption[];
  stats: { totalProduits: number; enRuptureCount: number; faibleCount: number; valeurTotale: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type Vue = 'grand' | 'pdv';

type StatutStock = 'EN_STOCK' | 'STOCK_FAIBLE' | 'RUPTURE';

const getStatut = (qte: number, seuil: number): StatutStock => {
  if (qte === 0) return 'RUPTURE';
  if (qte <= seuil) return 'STOCK_FAIBLE';
  return 'EN_STOCK';
};

const STATUT_STYLES: Record<StatutStock, { bg: string; text: string; border: string; dot: string; label: string }> = {
  EN_STOCK:    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'En stock' },
  STOCK_FAIBLE:{ bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500',   label: 'Stock faible' },
  RUPTURE:     { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',     label: 'Rupture' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GestionStockPage() {
  const [vue, setVue]                       = useState<Vue>('grand');
  const [searchQuery, setSearchQuery]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]                     = useState(1);
  const [filterPdvId, setFilterPdvId]       = useState('');
  const [expandedRows, setExpandedRows]     = useState<Set<number>>(new Set());

  // Modal ajout produit
  const [modalOpen, setModalOpen]           = useState(false);
  const [formData, setFormData]             = useState({ nom: '', description: '', reference: '', categorie: '', unite: '', prixUnitaire: '', alerteStock: '' });

  // Modal ajustement stock sur PDV
  const [adjustModal, setAdjustModal]       = useState(false);
  const [adjustForm, setAdjustForm]         = useState({ produitId: '', pointDeVenteId: '', quantite: '', motif: '' });

  // Modal suppression
  const [deleteId, setDeleteId]             = useState<number | null>(null);

  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);   

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (vue === 'grand') {
    params.set('aggregate', 'true');
  } else {
    if (filterPdvId) params.set('pdvId', filterPdvId);
  }

  const { data: response, loading, error, refetch } = useApi<StockResponse>(`/api/admin/stock?${params}`);
  const stats   = response?.stats;
  const meta    = response?.meta;
  const pdvs    = response?.pdvs ?? [];

  // Typed per vue
  const grandStockItems = vue === 'grand'
    ? ((response?.data ?? []) as GrandStockItem[]).filter(item => Array.isArray(item.stocks))
    : [];
  const stockItems = vue === 'pdv'
    ? ((response?.data ?? []) as StockItem[]).filter(item => !!item.produit && !!item.pointDeVente)
    : [];

  // Mutations
  const { mutate: addProduit, loading: adding, error: addError } =
    useMutation('/api/admin/stock', 'POST', { successMessage: 'Produit ajouté avec succès' });

  const { mutate: adjustStock, loading: adjusting, error: adjustError } =
    useMutation('/api/admin/stock', 'PATCH', { successMessage: 'Stock ajusté avec succès' });

  const deleteIdRef = useRef<number | null>(null);
  const { mutate: deleteProduit, loading: deleting } =
    useMutation(() => `/api/admin/stock/${deleteIdRef.current}`, 'DELETE', { successMessage: 'Produit supprimé avec succès' });

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addProduit({
      nom: formData.nom,
      description:  formData.description  || undefined,
      reference:    formData.reference    || undefined,
      categorie:    formData.categorie    || undefined,
      unite:        formData.unite        || undefined,
      prixUnitaire: Number(formData.prixUnitaire),
      alerteStock:  Number(formData.alerteStock) || 0,
    });
    if (result) {
      setModalOpen(false);
      setFormData({ nom: '', description: '', reference: '', categorie: '', unite: '', prixUnitaire: '', alerteStock: '' });
      refetch();
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await adjustStock({
      produitId:      Number(adjustForm.produitId),
      pointDeVenteId: Number(adjustForm.pointDeVenteId),
      quantite:       Number(adjustForm.quantite),
      motif:          adjustForm.motif,
    });
    if (result) {
      setAdjustModal(false);
      setAdjustForm({ produitId: '', pointDeVenteId: '', quantite: '', motif: '' });
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    deleteIdRef.current = deleteId;
    const result = await deleteProduit({});
    if (result) { setDeleteId(null); refetch(); }
  };

  const toggleExpand = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    if (vue === 'grand') {
      exportToCsv(
        grandStockItems.map(p => ({
          id: p.id, nom: p.nom, ref: p.reference ?? '', cat: p.categorie ?? '',
          prix: p.prixUnitaire, totalStock: p.totalStock, alerte: p.alerteStock,
        })),
        [
          { label: 'ID', key: 'id' },
          { label: 'Nom', key: 'nom' },
          { label: 'Référence', key: 'ref' },
          { label: 'Catégorie', key: 'cat' },
          { label: 'Prix unitaire', key: 'prix', format: v => formatCurrency(Number(v)) },
          { label: 'Stock total', key: 'totalStock' },
          { label: 'Seuil alerte', key: 'alerte' },
        ],
        'grand-stock.csv'
      );
    } else {
      exportToCsv(
        stockItems.map(s => ({
          produit: s.produit.nom, ref: s.produit.reference ?? '', pdv: s.pointDeVente.nom,
          code: s.pointDeVente.code, quantite: s.quantite, prix: s.produit.prixUnitaire,
          valeur: s.quantite * Number(s.produit.prixUnitaire),
        })),
        [
          { label: 'Produit', key: 'produit' },
          { label: 'Référence', key: 'ref' },
          { label: 'PDV', key: 'pdv' },
          { label: 'Code PDV', key: 'code' },
          { label: 'Quantité', key: 'quantite' },
          { label: 'Prix', key: 'prix', format: v => formatCurrency(Number(v)) },
          { label: 'Valeur', key: 'valeur', format: v => formatCurrency(Number(v)) },
        ],
        'stock-par-pdv.csv'
      );
    }
  };

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement du stock...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Gestion du Stock</h1>
              <p className="text-slate-500">
                {vue === 'grand' ? 'Vue globale — total tous PDV confondus' : 'Vue par point de vente'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={refetch} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <RefreshCw size={18} /> Actualiser
            </button>
            <button onClick={handleExport} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} /> Exporter
            </button>
            <button onClick={() => setAdjustModal(true)} className="px-5 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 flex items-center gap-2 font-medium">
              <Store size={18} /> Affecter / Ajuster stock PDV
            </button>
            <button onClick={() => setModalOpen(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 font-medium">
              <Plus size={20} /> Nouveau produit
            </button>
          </div>
        </div>

        {/* Vue tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          <button onClick={() => {
            setVue('grand');
            setPage(1);
          }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${vue === 'grand' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Layers size={15} /> Grand stock
          </button>
          <button onClick={() => {
            setVue('pdv');
            setPage(1);
          }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${vue === 'pdv' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Store size={15} /> Par PDV
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-5">
          {[
            { label: 'Valeur Totale', value: formatCurrency(stats?.valeurTotale ?? 0), icon: TrendingUp, color: 'bg-emerald-500', lightBg: 'bg-emerald-50' },
            { label: 'Produits actifs', value: String(stats?.totalProduits ?? 0), icon: Package, color: 'bg-blue-500', lightBg: 'bg-blue-50' },
            { label: 'Stock faible', value: String(stats?.faibleCount ?? 0), icon: AlertTriangle, color: 'bg-amber-500', lightBg: 'bg-amber-50' },
            { label: 'Ruptures', value: String(stats?.enRuptureCount ?? 0), icon: Archive, color: 'bg-red-500', lightBg: 'bg-red-50' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
                <div className={`${stat.lightBg} p-3 rounded-xl inline-block mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`${stat.color.replace('bg-', 'text-')} w-6 h-6`} />
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
              <input type="text" placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
            </div>
            {vue === 'pdv' && (
              <select value={filterPdvId} onChange={e => { setFilterPdvId(e.target.value); setPage(1)}}
                className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 min-w-[220px]">
                <option value="">Tous les PDV</option>
                {pdvs.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.type === 'DEPOT_CENTRAL' ? '🏭 ' : '🏪 '}{p.nom} ({p.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ══ MODAL — Ajout produit ════════════════════════════════════════ */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold mb-1">Ajouter un produit</h2>
              <p className="text-sm text-slate-500 mb-4">Le produit sera créé sans stock initial. Utilisez &ldquo;Affecter / Ajuster stock&rdquo; pour l&quot;approvisionner.</p>
              {addError && <p className="text-red-500 mb-2 text-sm">{addError}</p>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input type="text" placeholder="Nom du produit *" required value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Référence" value={formData.reference}
                    onChange={e => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                  <input type="text" placeholder="Catégorie" value={formData.categorie}
                    onChange={e => setFormData({ ...formData, categorie: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Unité (ex: kg, L, pcs)" value={formData.unite}
                    onChange={e => setFormData({ ...formData, unite: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                  <input type="number" placeholder="Prix unitaire *" required min="0.01" step="0.01" value={formData.prixUnitaire}
                    onChange={e => setFormData({ ...formData, prixUnitaire: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                </div>
                <input type="text" placeholder="Description (optionnel)" value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                <input type="number" placeholder="Seuil d'alerte stock" min="0" value={formData.alerteStock}
                  onChange={e => setFormData({ ...formData, alerteStock: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                <button type="submit" disabled={adding}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium">
                  {adding ? 'Ajout en cours...' : 'Ajouter le produit'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══ MODAL — Ajustement / Affectation stock PDV ══════════════════ */}
        {adjustModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl relative">
              <button onClick={() => setAdjustModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Affecter / Ajuster stock sur un PDV</h2>
              <p className="text-sm text-slate-500 mb-5">
                Définissez la quantité d&apos;un produit sur un PDV spécifique. Un ajustement sera enregistré.
              </p>
              {adjustError && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{adjustError}</p>}
              <form onSubmit={handleAdjust} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Point de vente *</label>
                  <select required value={adjustForm.pointDeVenteId}
                    onChange={e => setAdjustForm(f => ({ ...f, pointDeVenteId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm">
                    <option value="">Sélectionner un PDV…</option>
                    {pdvs.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.type === 'DEPOT_CENTRAL' ? '🏭 ' : '🏪 '}{p.nom} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Produit (ID) *</label>
                  <input type="number" required placeholder="ID du produit" min="1" value={adjustForm.produitId}
                    onChange={e => setAdjustForm(f => ({ ...f, produitId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
                  <p className="text-xs text-slate-400 mt-1">Visible dans la colonne ID du tableau ci-dessous.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nouvelle quantité *</label>
                  <input type="number" required min="0" placeholder="Quantité" value={adjustForm.quantite}
                    onChange={e => setAdjustForm(f => ({ ...f, quantite: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Motif *</label>
                  <input type="text" required placeholder="Ex: Approvisionnement initial, Correction inventaire…" value={adjustForm.motif}
                    onChange={e => setAdjustForm(f => ({ ...f, motif: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
                </div>
                <button type="submit" disabled={adjusting}
                  className="w-full py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-60 font-medium transition-colors">
                  {adjusting ? 'Enregistrement…' : 'Appliquer l\'ajustement'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══ MODAL — Suppression ══════════════════════════════════════════ */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-lg text-center">
              <h2 className="text-lg font-bold text-slate-800 mb-2">Supprimer ce produit ?</h2>
              <p className="text-slate-500 text-sm mb-6">Il ne doit pas avoir de ventes associées.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium">
                  Annuler
                </button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">
                  {deleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Table Grand stock ──────────────────────────────────────────── */}
        {vue === 'grand' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Layers size={16} className="text-blue-500" /> Grand stock — total tous PDV
              </h3>
              {meta && <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{meta.total} produit{meta.total > 1 ? 's' : ''}</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['ID', 'Produit', 'Stock total', 'Répartition PDV', 'Prix unitaire', 'Valeur totale', 'Statut', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grandStockItems.map(p => {
                    const statut = getStatut(p.totalStock, p.alerteStock);
                    const s = STATUT_STYLES[statut];
                    const valeur = p.totalStock * Number(p.prixUnitaire);
                    const expanded = expandedRows.has(p.id);
                    return (
                      <React.Fragment key={p.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4">
                            <span className="text-xs font-mono text-slate-400">#{p.id}</span>
                          </td>
                          <td className="px-5 py-4">
                            <div>
                              <p className="font-semibold text-slate-800">{p.nom}</p>
                              {p.reference && <p className="text-xs text-slate-400 font-mono">{p.reference}</p>}
                              {p.categorie && <p className="text-xs text-slate-400">{p.categorie}</p>}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-2xl font-bold text-slate-800">{p.totalStock}</p>
                            {p.unite && <p className="text-xs text-slate-400">{p.unite}</p>}
                          </td>
                          <td className="px-5 py-4">
                            {p.stocks.length > 0 ? (
                              <button onClick={() => toggleExpand(p.id)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                {p.stocks.length} PDV{p.stocks.length > 1 ? 's' : ''}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-semibold text-slate-800">{formatCurrency(p.prixUnitaire)}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-base font-bold text-slate-800">{formatCurrency(valeur)}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1">
                              <Link href={`/dashboard/admin/stock/${p.id}`}
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                <Eye size={15} />
                              </Link>
                              <Link href={`/dashboard/admin/stock/${p.id}/edit`}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Edit size={15} />
                              </Link>
                              <button onClick={() => setDeleteId(p.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded && p.stocks.map((s2, i) => (
                          <tr key={i} className="bg-blue-50/50 border-l-4 border-l-blue-200">
                            <td className="px-5 py-2" />
                            <td className="px-5 py-2 pl-8" colSpan={2}>
                              <div className="flex items-center gap-2 text-sm">
                                <div className={`w-5 h-5 ${s2.pointDeVente.type === 'DEPOT_CENTRAL' ? 'bg-purple-100' : 'bg-blue-100'} rounded flex items-center justify-center`}>
                                  {s2.pointDeVente.type === 'DEPOT_CENTRAL'
                                    ? <Building2 size={10} className="text-purple-600" />
                                    : <Store size={10} className="text-blue-600" />}
                                </div>
                                <span className="text-slate-700 font-medium">{s2.pointDeVente.nom}</span>
                                <span className="text-slate-400 font-mono text-xs">{s2.pointDeVente.code}</span>
                              </div>
                            </td>
                            <td className="px-5 py-2">
                              <span className="text-base font-bold text-slate-800">{s2.quantite}</span>
                            </td>
                            <td colSpan={4} />
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {grandStockItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500">Aucun produit trouvé</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {meta && meta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">Page {meta.page} / {meta.totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm">Précédent</button>
                  <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm">{page}</span>
                  <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm">Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Table par PDV ─────────────────────────────────────────────── */}
        {vue === 'pdv' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Store size={16} className="text-blue-500" />
                {filterPdvId
                  ? `Stock — ${pdvs.find(p => String(p.id) === filterPdvId)?.nom ?? ''}`
                  : 'Stock — tous PDV'}
              </h3>
              {meta && <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{meta.total} entrée{meta.total > 1 ? 's' : ''}</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Produit', 'PDV', 'Quantité', 'Niveau', 'Prix', 'Valeur stock', 'Statut', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockItems.map(item => {
                    const seuil = item.alerteStock ?? item.produit.alerteStock;
                    const statut = getStatut(item.quantite, seuil);
                    const s = STATUT_STYLES[statut];
                    const pct = seuil > 0 ? Math.min(100, (item.quantite / seuil) * 100) : (item.quantite > 0 ? 100 : 0);
                    const barColor = item.quantite === 0 ? 'bg-red-500' : item.quantite <= seuil ? 'bg-amber-500' : 'bg-emerald-500';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-semibold text-slate-800">{item.produit.nom}</p>
                            {item.produit.reference && <p className="text-xs text-slate-400 font-mono">{item.produit.reference}</p>}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 ${item.pointDeVente.type === 'DEPOT_CENTRAL' ? 'bg-purple-100' : 'bg-blue-100'} rounded flex items-center justify-center`}>
                              {item.pointDeVente.type === 'DEPOT_CENTRAL'
                                ? <Building2 size={12} className="text-purple-600" />
                                : <Store size={12} className="text-blue-600" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{item.pointDeVente.nom}</p>
                              <p className="text-xs text-slate-400 font-mono">{item.pointDeVente.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-2xl font-bold text-slate-800">{item.quantite}</p>
                          {item.produit.unite && <p className="text-xs text-slate-400">{item.produit.unite}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="w-28 space-y-1">
                            <p className="text-xs text-slate-400">Seuil : {seuil}</p>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-semibold text-slate-800">{formatCurrency(item.produit.prixUnitaire)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-base font-bold text-slate-800">{formatCurrency(item.quantite * Number(item.produit.prixUnitaire))}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <Link href={`/dashboard/admin/stock/${item.produit.id}`}
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                              <Eye size={15} />
                            </Link>
                            <Link href={`/dashboard/admin/stock/${item.produit.id}/edit`}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Edit size={15} />
                            </Link>
                            <button
                              onClick={() => { setAdjustForm(f => ({ ...f, produitId: String(item.produit.id), pointDeVenteId: String(item.pointDeVenteId) })); setAdjustModal(true); }}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Ajuster stock">
                              <RefreshCw size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {stockItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                        {filterPdvId ? 'Aucun produit en stock sur ce PDV' : 'Aucune entrée de stock'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {meta && meta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600">Page {meta.page} / {meta.totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm">Précédent</button>
                  <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm">{page}</span>
                  <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm">Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Alertes */}
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg shadow-red-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><Archive size={24} /></div>
              <div>
                <p className="text-red-100 text-sm">Ruptures de stock</p>
                <p className="text-3xl font-bold">{stats?.enRuptureCount ?? 0} entrées</p>
              </div>
            </div>
            <p className="text-red-100 text-sm">Action immédiate requise</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg shadow-amber-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><AlertTriangle size={24} /></div>
              <div>
                <p className="text-amber-100 text-sm">Stock faible</p>
                <p className="text-3xl font-bold">{stats?.faibleCount ?? 0} entrées</p>
              </div>
            </div>
            <p className="text-amber-100 text-sm">Réapprovisionnement bientôt</p>
          </div>
        </div>

      </div>
    </div>
  );
}
