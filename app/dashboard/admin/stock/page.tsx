"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Download, Package, TrendingUp, AlertTriangle, Archive,
  Eye, Edit, Trash2, RefreshCw, X, ArrowLeft, Store, Building2, Layers, ChevronDown, ChevronRight,
  ArrowRightLeft, Trash, PackagePlus, Calendar, History,
  ShieldAlert, TrendingDown, Flame, Boxes, CheckCircle, XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportToCsv } from '@/lib/exportCsv';
import { useT } from '@/contexts/AppSettingsContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PDVOption { id: number; nom: string; code: string; type: string; }

interface ApproHistorique {
  prixUnitaire: string | null;
  quantiteRecue: number | null;
  dateReception: string | null;
  datePrevisionnelle: string;
  statut: string;
  reference: string;
  fournisseurNom: string | null;
}

// Mode par-PDV (StockSite)
interface StockItem {
  id: number; produitId: number; pointDeVenteId: number;
  quantite: number; quantiteReservee: number; quantiteEnTransit: number; quantiteEndommagee: number;
  stockTheorique: number; alerteStock: number | null;
  produit: { id: number; nom: string; reference?: string; categorie?: string; unite?: string; prixUnitaire: string; prixAchat?: string | null; alerteStock: number };
  pointDeVente: { id: number; nom: string; code: string; type: string };
  appros: ApproHistorique[];
}

// Mode grand stock (agrégé par produit)
interface GrandStockItem {
  id: number; nom: string; reference?: string; categorie?: string; unite?: string;
  prixUnitaire: string; prixAchat?: string | null; alerteStock: number;
  totalStock: number; totalReserve: number; totalTransit: number; totalEndommage: number; stockTheorique: number;
  valeurStock?: number;
  stocks: {
    quantite: number; quantiteReservee: number; quantiteEnTransit: number; quantiteEndommagee: number;
    stockTheorique: number; alerteStock: number | null;
    pointDeVente: { id: number; nom: string; code: string; type: string };
  }[];
}

interface StockResponse {
  data: StockItem[] | GrandStockItem[];
  pdvs: PDVOption[];
  stats: {
    totalProduits: number;
    enRuptureCount: number;
    faibleCount: number;
    surstockCount: number;
    perteEleveeCount: number;
    totalEndommage: number;
    pctEndommage: number;
    valeurTotale: number;
  };
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
  const t = useT();
  const [vue, setVue]                       = useState<Vue>('grand');
  const [searchQuery, setSearchQuery]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]                     = useState(1);
  const [filterPdvId, setFilterPdvId]       = useState('');
  const [expandedRows, setExpandedRows]     = useState<Set<number>>(new Set());
  const [expandedPdvRows, setExpandedPdvRows] = useState<Set<number>>(new Set());

  // Modal ajout produit
  const [modalOpen, setModalOpen]           = useState(false);
  const [formData, setFormData]             = useState({ nom: '', description: '', reference: '', categorie: '', unite: '', prixUnitaire: '', prixAchat: '', alerteStock: '' });

  // Modal transfert de stock
  const [transferModal, setTransferModal]   = useState(false);
  type StockLigne = { produitId: string; quantite: string };
  const [transferForm, setTransferForm]     = useState<{
    origineId: string; destinationId: string; lignes: StockLigne[]; notes: string;
  }>({ origineId: '', destinationId: '', lignes: [{ produitId: '', quantite: '' }], notes: '' });

  // Modal approvisionnement direct
  const [approModal, setApproModal]         = useState(false);
  const [approForm, setApproForm]           = useState<{
    pointDeVenteId: string; fournisseurNom: string; lignes: StockLigne[]; notes: string;
  }>({ pointDeVenteId: '', fournisseurNom: '', lignes: [{ produitId: '', quantite: '' }], notes: '' });

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
  const grandStockItems = React.useMemo(
    () => vue === 'grand'
      ? ((response?.data ?? []) as GrandStockItem[]).filter(item => Array.isArray(item.stocks))
      : [],
    [vue, response]
  );
  const stockItems = React.useMemo(
    () => vue === 'pdv'
      ? ((response?.data ?? []) as StockItem[]).filter(item => !!item.produit && !!item.pointDeVente)
      : [],
    [vue, response]
  );

  // Chargement indépendant de TOUS les produits pour les modaux (approvisionnement + transfert)
  // Déclenché dès qu'un des deux modaux est ouvert
  const modalOuvert = approModal || transferModal;
  const { data: tousProduitsResp } = useApi<{ data: GrandStockItem[] }>(
    modalOuvert ? '/api/admin/stock?aggregate=true&limit=500' : null
  );
  const produitsOptions: { id: number; nom: string }[] = React.useMemo(() => {
    if (tousProduitsResp?.data) {
      return tousProduitsResp.data.map(p => ({ id: p.id, nom: p.nom }));
    }
    // Fallback sur les données déjà chargées tant que la requête n'est pas revenue
    if (grandStockItems.length > 0) return grandStockItems.map(p => ({ id: p.id, nom: p.nom }));
    const seen = new Set<number>();
    const result: { id: number; nom: string }[] = [];
    for (const item of stockItems) {  
      if (!seen.has(item.produitId)) {
        seen.add(item.produitId);
        result.push({ id: item.produitId, nom: item.produit.nom });
      }
    }  
    return result;
  }, [tousProduitsResp, grandStockItems, stockItems]);

  // Mutations
  const { mutate: addProduit, loading: adding, error: addError } =
    useMutation('/api/admin/stock', 'POST', { successMessage: 'Produit ajouté avec succès' });

  const { mutate: creerTransfert, loading: transferring, error: transferError } =
    useMutation('/api/admin/transferts', 'POST', { successMessage: 'Transfert initié avec succès' });

  const { mutate: creerAppro, loading: approvisionning, error: approError } =
    useMutation('/api/admin/approvisionnements', 'POST', { successMessage: 'Approvisionnement enregistré avec succès' });

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
      prixAchat:    formData.prixAchat ? Number(formData.prixAchat) : undefined,
      alerteStock:  Number(formData.alerteStock) || 0,
    });
    if (result) {
      setModalOpen(false);
      setFormData({ nom: '', description: '', reference: '', categorie: '', unite: '', prixUnitaire: '', prixAchat: '', alerteStock: '' });
      refetch();
    }
  };

  const resetTransferForm = () =>
    setTransferForm({ origineId: '', destinationId: '', lignes: [{ produitId: '', quantite: '' }], notes: '' });

  const handleTransfert = async (e: React.FormEvent) => {
    e.preventDefault();
    const lignesValides = transferForm.lignes.filter(l => l.produitId && l.quantite);
    const result = await creerTransfert({
      origineId:     Number(transferForm.origineId),
      destinationId: Number(transferForm.destinationId),
      lignes:        lignesValides.map(l => ({ produitId: Number(l.produitId), quantite: Number(l.quantite) })),
      notes:         transferForm.notes || undefined,
    });
    if (result) {
      setTransferModal(false);
      resetTransferForm();
      refetch();
    }
  };

  const addLigne = () =>
    setTransferForm(f => ({ ...f, lignes: [...f.lignes, { produitId: '', quantite: '' }] }));
  const removeLigne = (idx: number) =>
    setTransferForm(f => ({ ...f, lignes: f.lignes.filter((_, i) => i !== idx) }));
  const updateLigne = (idx: number, field: 'produitId' | 'quantite', value: string) =>
    setTransferForm(f => {
      const lignes = [...f.lignes];
      lignes[idx] = { ...lignes[idx], [field]: value };
      return { ...f, lignes };
    });

  const resetApproForm = () =>
    setApproForm({ pointDeVenteId: '', fournisseurNom: '', lignes: [{ produitId: '', quantite: '' }], notes: '' });

  const handleAppro = async (e: React.FormEvent) => {
    e.preventDefault();
    const lignesValides = approForm.lignes.filter(l => l.produitId && l.quantite);
    const result = await creerAppro({
      pointDeVenteId: Number(approForm.pointDeVenteId),
      type:           'FOURNISSEUR',
      fournisseurNom: approForm.fournisseurNom || undefined,
      lignes:         lignesValides.map(l => ({ produitId: Number(l.produitId), quantite: Number(l.quantite) })),
      notes:          approForm.notes || undefined,
    });
    if (result) { setApproModal(false); resetApproForm(); refetch(); }
  };

  const addApproLigne = () =>
    setApproForm(f => ({ ...f, lignes: [...f.lignes, { produitId: '', quantite: '' }] }));
  const removeApproLigne = (idx: number) =>
    setApproForm(f => ({ ...f, lignes: f.lignes.filter((_, i) => i !== idx) }));
  const updateApproLigne = (idx: number, field: 'produitId' | 'quantite', value: string) =>
    setApproForm(f => {
      const lignes = [...f.lignes];
      lignes[idx] = { ...lignes[idx], [field]: value };
      return { ...f, lignes };
    });

  const handleDelete = async () => {
    if (!deleteId) return;
    deleteIdRef.current = deleteId;
    const result = await deleteProduit({});
    if (result) { setDeleteId(null); refetch(); }
  };

  // ── Anomalies — approbation niveau 2 ────────────────────────────────────────
  interface AnomalieAdmin {
    id: number; reference: string; type: string; quantite: number;
    description: string; statut: string; commentaire: string | null; createdAt: string;
    produit: { id: number; nom: string; prixAchat?: string | null; prixUnitaire: string };
    pointDeVente: { id: number; nom: string; code: string } | null;
    magasinier: { id: number; nom: string; prenom: string };
    traiteur: { id: number; nom: string; prenom: string } | null;
  }
  interface AnomaliesAdminResponse {
    data: AnomalieAdmin[];
    stats: { pendingCount: number };
    meta: { total: number; page: number; limit: number; totalPages: number };
  }

  const [anomaliesAdminPage, setAnomaliesAdminPage]           = useState(1);
  const [anomaliesAdminFilter, setAnomaliesAdminFilter]       = useState("TRANSMISE");
  const [anomalieAdminModal, setAnomalieAdminModal]           = useState<{ id: number; action: "APPROUVER" | "REJETER"; nomProduit: string; quantite: number } | null>(null);
  const [anomalieAdminMotif, setAnomalieAdminMotif]           = useState("");
  const anomalieAdminIdRef                                    = useRef<number | null>(null);

  const anomaliesAdminQP = new URLSearchParams({ page: String(anomaliesAdminPage), limit: "15" });
  if (anomaliesAdminFilter) anomaliesAdminQP.set("statut", anomaliesAdminFilter);

  const { data: anomaliesAdminRes, refetch: refetchAnomaliesAdmin } =
    useApi<AnomaliesAdminResponse>(`/api/admin/anomalies?${anomaliesAdminQP}`);
  const anomaliesAdminPending = anomaliesAdminRes?.stats?.pendingCount ?? 0;

  const { mutate: doAdminAnomalie, loading: adminAnomalieLoading } =
    useMutation<unknown, { action: string; motif?: string }>(
      () => anomalieAdminIdRef.current ? `/api/admin/anomalies/${anomalieAdminIdRef.current}` : "",
      "PATCH",
      { successMessage: "Décision enregistrée — stock mis à jour" }
    );

  const confirmAdminAnomalie = async () => {
    if (!anomalieAdminModal) return;
    anomalieAdminIdRef.current = anomalieAdminModal.id;
    const result = await doAdminAnomalie({
      action: anomalieAdminModal.action,
      ...(anomalieAdminMotif.trim() && { motif: anomalieAdminMotif.trim() }),
    });
    if (result) {
      setAnomalieAdminModal(null);
      setAnomalieAdminMotif("");
      refetchAnomaliesAdmin();
      refetch(); // rafraîchir le stock
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePdvExpand = (id: number) => {
    setExpandedPdvRows(prev => {
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
          valeur: s.quantite * Number(s.produit.prixAchat ?? s.produit.prixUnitaire),
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
          <p className="text-slate-500 font-medium">{t('stock_loading')}</p>
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
              <h1 className="text-4xl font-bold text-slate-800 mb-2">{t('stock_title')}</h1>
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
            <button onClick={() => setApproModal(true)} className="px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
              <PackagePlus size={18} /> Approvisionner
            </button>
            <button onClick={() => setTransferModal(true)} className="px-5 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 flex items-center gap-2 font-medium">
              <ArrowRightLeft size={18} /> Transférer du stock
            </button>
            <button onClick={() => setModalOpen(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 font-medium">
              <Plus size={20} /> {t('stock_new_product')}
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
            <Layers size={15} /> {t('stock_grand_stock')}
          </button>
          <button onClick={() => {
            setVue('pdv');
            setPage(1);
          }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${vue === 'pdv' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Store size={15} /> {t('stock_par_pdv')}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: t('stock_valeur'), value: formatCurrency(stats?.valeurTotale ?? 0), icon: TrendingUp, color: 'bg-emerald-500', lightBg: 'bg-emerald-50', sub: null },
            { label: t('stock_total_produits'), value: String(stats?.totalProduits ?? 0), icon: Package, color: 'bg-blue-500', lightBg: 'bg-blue-50', sub: null },
            { label: t('stock_faible'), value: String(stats?.faibleCount ?? 0), icon: AlertTriangle, color: 'bg-amber-500', lightBg: 'bg-amber-50', sub: 'Seuil d\'alerte atteint' },
            { label: 'Ruptures', value: String(stats?.enRuptureCount ?? 0), icon: Archive, color: 'bg-red-500', lightBg: 'bg-red-50', sub: 'Stock à 0' },
            {
              label: 'Stock endommagé',
              value: String(stats?.totalEndommage ?? 0) + ' unités',
              icon: ShieldAlert,
              color: 'bg-rose-500',
              lightBg: 'bg-rose-50',
              sub: stats?.pctEndommage ? `${stats.pctEndommage}% du stock brut` : null,
            },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
                <div className={`${stat.lightBg} p-3 rounded-xl inline-block mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className={`${stat.color.replace('bg-', 'text-')} w-5 h-5`} />
                </div>
                <h3 className="text-slate-600 text-xs font-medium mb-1">{stat.label}</h3>
                <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                {stat.sub && <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>}
              </div>
            );
          })}
        </div>

        {/* Vue alertes */}
        {((stats?.enRuptureCount ?? 0) > 0 || (stats?.faibleCount ?? 0) > 0 || (stats?.surstockCount ?? 0) > 0 || (stats?.perteEleveeCount ?? 0) > 0) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Flame size={16} className="text-red-500" />
              Vue alertes
            </h3>
            <div className="grid grid-cols-4 gap-4">
              {/* Ruptures */}
              <div className={`p-4 rounded-xl border ${(stats?.enRuptureCount ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200 opacity-40'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Rupture de stock</span>
                  <Archive size={14} className="text-red-500" />
                </div>
                <p className="text-3xl font-bold text-red-700">{stats?.enRuptureCount ?? 0}</p>
                <p className="text-xs text-red-500 mt-1">produit(s) à 0</p>
              </div>

              {/* Rupture imminente */}
              <div className={`p-4 rounded-xl border ${(stats?.faibleCount ?? 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-40'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Rupture imminente</span>
                  <AlertTriangle size={14} className="text-amber-500" />
                </div>
                <p className="text-3xl font-bold text-amber-700">{stats?.faibleCount ?? 0}</p>
                <p className="text-xs text-amber-500 mt-1">stock ≤ seuil d&apos;alerte</p>
              </div>

              {/* Surstock */}
              <div className={`p-4 rounded-xl border ${(stats?.surstockCount ?? 0) > 0 ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-200 opacity-40'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Surstock</span>
                  <Boxes size={14} className="text-sky-500" />
                </div>
                <p className="text-3xl font-bold text-sky-700">{stats?.surstockCount ?? 0}</p>
                <p className="text-xs text-sky-500 mt-1">stock &gt; 5× le seuil</p>
              </div>

              {/* Perte élevée */}
              <div className={`p-4 rounded-xl border ${(stats?.perteEleveeCount ?? 0) > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200 opacity-40'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Perte élevée</span>
                  <TrendingDown size={14} className="text-rose-500" />
                </div>
                <p className="text-3xl font-bold text-rose-700">{stats?.perteEleveeCount ?? 0}</p>
                <p className="text-xs text-rose-500 mt-1">≥ 10% du stock endommagé</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input type="text" placeholder={t('stock_search_ph')}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
            </div>
            {vue === 'pdv' && (
              <select value={filterPdvId} onChange={e => { setFilterPdvId(e.target.value); setPage(1)}}
                className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 min-w-[220px]">
                <option value="">{t('stock_all_pdv')}</option>
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130]">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold mb-1">Ajouter un produit</h2>
              <p className="text-sm text-slate-500 mb-4">Le produit sera créé sans stock initial. Utilisez &ldquo;Approvisionner&rdquo; pour ajouter du stock sur un PDV.</p>
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
                  <input type="number" placeholder="Prix de vente * (FCFA)" required min="0.01" step="0.01" value={formData.prixUnitaire}
                    onChange={e => setFormData({ ...formData, prixUnitaire: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                </div>
                <input type="number" placeholder="Prix d'achat (FCFA) — optionnel" min="0" step="0.01" value={formData.prixAchat}
                  onChange={e => setFormData({ ...formData, prixAchat: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
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

        {/* ══ MODAL — Approvisionnement direct ════════════════════════════ */}
        {approModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => { setApproModal(false); resetApproForm(); }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <PackagePlus size={18} className="text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Approvisionner un PDV</h2>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                Ajoutez du stock directement sur un PDV ou le dépôt central (réception fournisseur, entrée directe). Le stock est crédité immédiatement.
              </p>
              {approError && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{approError}</p>
              )}
              <form onSubmit={handleAppro} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PDV / Dépôt destination *</label>
                  <select required value={approForm.pointDeVenteId}
                    onChange={e => setApproForm(f => ({ ...f, pointDeVenteId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                    <option value="">Choisir un PDV…</option>
                    {pdvs.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.type === 'DEPOT_CENTRAL' ? '[Dépôt central] ' : '[PDV] '}{p.nom} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fournisseur (optionnel)</label>
                  <input type="text" placeholder="Nom du fournisseur ou de la source…"
                    value={approForm.fournisseurNom}
                    onChange={e => setApproForm(f => ({ ...f, fournisseurNom: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Produits à approvisionner *</label>
                  <div className="space-y-2">
                    {approForm.lignes.map((ligne, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select required value={ligne.produitId}
                          onChange={e => updateApproLigne(idx, 'produitId', e.target.value)}
                          className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                          <option value="">Choisir un produit…</option>
                          {produitsOptions.map(p => (
                            <option key={p.id} value={p.id}>{p.nom}</option>
                          ))}
                        </select>
                        <input type="number" required min="1" placeholder="Qté"
                          value={ligne.quantite}
                          onChange={e => updateApproLigne(idx, 'quantite', e.target.value)}
                          className="w-24 px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                        {approForm.lignes.length > 1 && (
                          <button type="button" onClick={() => removeApproLigne(idx)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {produitsOptions.length === 0 && (
                    <p className="text-xs text-slate-400 mt-1">Passez en vue &ldquo;Grand stock&rdquo; pour voir tous les produits.</p>
                  )}
                  <button type="button" onClick={addApproLigne}
                    className="mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                    <Plus size={14} /> Ajouter un produit
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optionnel)</label>
                  <input type="text" placeholder="Ex: Livraison hebdomadaire, lot n°12…"
                    value={approForm.notes}
                    onChange={e => setApproForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                </div>

                <button type="submit" disabled={approvisionning}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 font-medium transition-colors flex items-center justify-center gap-2">
                  {approvisionning
                    ? 'Enregistrement…'
                    : <><PackagePlus size={16} /> Enregistrer l&apos;approvisionnement</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══ MODAL — Transfert de stock ══════════════════════════════════ */}
        {transferModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => { setTransferModal(false); resetTransferForm(); }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <ArrowRightLeft size={18} className="text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Transférer du stock</h2>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                Le stock est immédiatement retiré du PDV source. Le personnel du PDV destination recevra une notification pour confirmer la réception.
              </p>
              {transferError && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{transferError}</p>
              )}
              <form onSubmit={handleTransfert} className="space-y-4">
                {/* Source / Destination */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source *</label>
                    <select required value={transferForm.origineId}
                      onChange={e => setTransferForm(f => ({ ...f, origineId: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm">
                      <option value="">PDV source…</option>
                      {pdvs.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.type === 'DEPOT_CENTRAL' ? '[Dépôt] ' : ''}{p.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Destination *</label>
                    <select required value={transferForm.destinationId}
                      onChange={e => setTransferForm(f => ({ ...f, destinationId: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm">
                      <option value="">PDV destination…</option>
                      {pdvs.filter(p => String(p.id) !== transferForm.origineId).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.type === 'DEPOT_CENTRAL' ? '[Dépôt] ' : ''}{p.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lignes produits */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Produits à transférer *</label>
                  <div className="space-y-2">
                    {transferForm.lignes.map((ligne, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select required value={ligne.produitId}
                          onChange={e => updateLigne(idx, 'produitId', e.target.value)}
                          className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm">
                          <option value="">Choisir un produit…</option>
                          {produitsOptions.map(p => (
                            <option key={p.id} value={p.id}>{p.nom}</option>
                          ))}
                        </select>
                        <input type="number" required min="1" placeholder="Qté" value={ligne.quantite}
                          onChange={e => updateLigne(idx, 'quantite', e.target.value)}
                          className="w-24 px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
                        {transferForm.lignes.length > 1 && (
                          <button type="button" onClick={() => removeLigne(idx)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {produitsOptions.length === 0 && (
                    <p className="text-xs text-slate-400 mt-1">Passez en vue &ldquo;Grand stock&rdquo; pour voir tous les produits.</p>
                  )}
                  <button type="button" onClick={addLigne}
                    className="mt-2 text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                    <Plus size={14} /> Ajouter un produit
                  </button>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optionnel)</label>
                  <input type="text" placeholder="Ex: Réapprovisionnement urgent PDV Nord…"
                    value={transferForm.notes}
                    onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
                </div>

                <button type="submit" disabled={transferring}
                  className="w-full py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-60 font-medium transition-colors flex items-center justify-center gap-2">
                  {transferring
                    ? 'Transfert en cours…'
                    : <><ArrowRightLeft size={16} /> Initier le transfert</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══ MODAL — Suppression ══════════════════════════════════════════ */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130]">
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
                <Layers size={16} className="text-blue-500" /> {t('stock_grand_stock')} — total tous PDV
              </h3>
              {meta && <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{meta.total} produit{meta.total > 1 ? 's' : ''}</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['ID', t('stock_col_product'), t('stock_col_total_stock'), 'Répartition PDV', t('stock_col_prix_achat'), t('stock_col_prix_vente'), 'Marge de réf.', 'Valeur stock', t('col_status'), t('col_actions')].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grandStockItems.map(p => {
                    const statut = getStatut(p.totalStock, p.alerteStock);
                    const s = STATUT_STYLES[statut];
                    const prixVente = Number(p.prixUnitaire);
                    const prixAchat = p.prixAchat ? Number(p.prixAchat) : null;
                    const margeUnit = prixAchat !== null ? prixVente - prixAchat : null;
                    const margePct  = prixAchat !== null && prixAchat > 0 ? (margeUnit! / prixAchat) * 100 : null;
                    // Section 5 : valorisation = quantité × prix d'achat (fallback prix vente)
                    const valeur = p.valeurStock ?? (p.totalStock * (prixAchat ?? prixVente));
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
                            {prixAchat !== null
                              ? <span className="text-sm font-semibold text-slate-600">{formatCurrency(prixAchat)}</span>
                              : <span className="text-xs text-slate-300 italic">—</span>}
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-semibold text-slate-800">{formatCurrency(prixVente)}</span>
                          </td>
                          <td className="px-5 py-4">
                            {margeUnit !== null ? (
                              <div>
                                <span className={`text-sm font-bold ${margeUnit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {margeUnit >= 0 ? '+' : ''}{formatCurrency(margeUnit)}
                                </span>
                                {margePct !== null && (
                                  <p className={`text-xs ${margeUnit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {margePct >= 0 ? '+' : ''}{margePct.toFixed(1)}%
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 italic">—</span>
                            )}
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
                              <div className="space-y-0.5">
                                <p className="text-base font-bold text-emerald-700">{s2.quantite} <span className="text-xs font-normal text-slate-400">dispo</span></p>
                                {s2.quantiteReservee > 0 && <p className="text-xs text-amber-600 font-medium">{s2.quantiteReservee} réservé</p>}
                                {s2.quantiteEnTransit > 0 && <p className="text-xs text-sky-600 font-medium">{s2.quantiteEnTransit} en transit</p>}
                                {s2.quantiteEndommagee > 0 && <p className="text-xs text-red-500 font-medium">{s2.quantiteEndommagee} endommagé</p>}
                                <p className="text-xs text-slate-500">Théorique : {s2.stockTheorique}</p>
                              </div>
                            </td>
                            <td colSpan={4} />
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {grandStockItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500">{t('stock_none_found')}</td>
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
                    {[t('stock_col_product'), t('stock_col_pdv'), t('label_quantite'), 'Niveau', t('stock_col_prix_vente'), t('stock_col_prix_achat'), 'Valeur stock', t('stock_col_appros'), t('col_status'), t('col_actions')].map(h => (
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
                    const prixAchat = item.produit.prixAchat ? Number(item.produit.prixAchat) : null;
                    const dernierAppro = item.appros[0] ?? null;
                    const pdvExpanded = expandedPdvRows.has(item.id);
                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
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
                            <p className="text-2xl font-bold text-emerald-700">{item.quantite}</p>
                            {item.produit.unite && <p className="text-xs text-slate-400">{item.produit.unite}</p>}
                            <div className="mt-1 space-y-0.5">
                              {item.quantiteReservee > 0 && <p className="text-xs text-amber-600 font-medium">+{item.quantiteReservee} réservé</p>}
                              {item.quantiteEnTransit > 0 && <p className="text-xs text-sky-600 font-medium">+{item.quantiteEnTransit} en transit</p>}
                              {item.quantiteEndommagee > 0 && <p className="text-xs text-red-500 font-medium">{item.quantiteEndommagee} endommagé</p>}
                              <p className="text-xs text-slate-400">Théo. : {item.stockTheorique ?? item.quantite}</p>
                            </div>
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
                          {/* Prix achat */}
                          <td className="px-5 py-4">
                            {prixAchat !== null
                              ? <span className="text-sm font-semibold text-emerald-700">{formatCurrency(prixAchat)}</span>
                              : dernierAppro?.prixUnitaire
                                ? <span className="text-sm font-semibold text-emerald-600">{formatCurrency(Number(dernierAppro.prixUnitaire))}</span>
                                : <span className="text-xs text-slate-300 italic">—</span>}
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-base font-bold text-slate-800">
                              {formatCurrency(item.quantite * (prixAchat ?? Number(item.produit.prixUnitaire)))}
                            </span>
                          </td>
                          {/* Appros récents */}
                          <td className="px-5 py-4">
                            {item.appros.length > 0 ? (
                              <button onClick={() => togglePdvExpand(item.id)}
                                className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium group">
                                {pdvExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                <History size={13} />
                                {item.appros.length} appro{item.appros.length > 1 ? 's' : ''}
                                <span className="text-slate-400 group-hover:text-slate-600 ml-1">
                                  · {formatDate(dernierAppro!.dateReception ?? dernierAppro!.datePrevisionnelle)}
                                </span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-300 italic">Aucun</span>
                            )}
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
                                onClick={() => {
                                  setTransferForm(f => ({ ...f, origineId: String(item.pointDeVenteId), lignes: [{ produitId: String(item.produit.id), quantite: '' }] }));
                                  setTransferModal(true);
                                }}
                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Transférer ce stock">
                                <ArrowRightLeft size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Lignes dépliables — historique des approvisionnements */}
                        {pdvExpanded && (
                          <tr className="bg-violet-50/60">
                            <td colSpan={10} className="px-8 py-3">
                              <div className="flex items-center gap-2 mb-2">
                                <History size={13} className="text-violet-500" />
                                <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                                  Historique approvisionnements — {item.produit.nom} @ {item.pointDeVente.nom}
                                </span>
                              </div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-500">
                                    <th className="text-left pb-1 pr-6 font-medium">Référence</th>
                                    <th className="text-left pb-1 pr-6 font-medium">Date réception</th>
                                    <th className="text-left pb-1 pr-6 font-medium">Qté reçue</th>
                                    <th className="text-left pb-1 pr-6 font-medium">Prix achat unitaire</th>
                                    <th className="text-left pb-1 pr-6 font-medium">Fournisseur</th>
                                    <th className="text-left pb-1 font-medium">Statut</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-violet-100">
                                  {item.appros.map((a, idx) => (
                                    <tr key={idx} className="hover:bg-violet-100/40">
                                      <td className="py-1.5 pr-6 font-mono text-slate-500">{a.reference}</td>
                                      <td className="py-1.5 pr-6 flex items-center gap-1 text-slate-700">
                                        <Calendar size={11} className="text-violet-400 shrink-0" />
                                        {a.dateReception
                                          ? formatDate(a.dateReception)
                                          : <span className="text-slate-400 italic">Prév. {formatDate(a.datePrevisionnelle)}</span>}
                                      </td>
                                      <td className="py-1.5 pr-6 font-semibold text-slate-800">
                                        {a.quantiteRecue !== null ? a.quantiteRecue : <span className="text-slate-400">—</span>}
                                      </td>
                                      <td className="py-1.5 pr-6 font-semibold text-emerald-700">
                                        {a.prixUnitaire ? formatCurrency(Number(a.prixUnitaire)) : <span className="text-slate-400 italic">—</span>}
                                      </td>
                                      <td className="py-1.5 pr-6 text-slate-600">
                                        {a.fournisseurNom ?? <span className="text-slate-400 italic">—</span>}
                                      </td>
                                      <td className="py-1.5">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          a.statut === 'VALIDE' ? 'bg-emerald-100 text-emerald-700' :
                                          a.statut === 'RECU'   ? 'bg-blue-100 text-blue-700' :
                                          'bg-slate-100 text-slate-600'
                                        }`}>{a.statut}</span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {stockItems.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                        {filterPdvId ? t('stock_none_found') : t('stock_none_found')}
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

        {/* ── Validation Anomalies (niveau 2) ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="text-orange-600" size={22} />
              <div>
                <h2 className="text-xl font-bold text-slate-800">Anomalies Stock — Approbation Admin</h2>
                <p className="text-sm text-slate-500">Approuvez ou rejetez les déclarations validées par le Resp. Approvisionnement</p>
              </div>
              {anomaliesAdminPending > 0 && (
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-xl text-sm font-semibold border border-red-200">
                  {anomaliesAdminPending} à approuver
                </span>
              )}
            </div>
          </div>

          {/* Filtres */}
          <div className="flex gap-2 flex-wrap">
            {(["TRANSMISE", "TRAITEE", "EN_ATTENTE", ""] as const).map(s => (
              <button
                key={s}
                onClick={() => { setAnomaliesAdminFilter(s); setAnomaliesAdminPage(1); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  anomaliesAdminFilter === s
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {s === "" ? "Toutes" : s === "TRANSMISE" ? "À approuver" : s === "TRAITEE" ? "Traitées" : "En attente Resp."}
              </button>
            ))}
          </div>

          {(anomaliesAdminRes?.data.length ?? 0) === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
              <ShieldAlert size={36} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500">Aucune anomalie dans ce filtre</p>
            </div>
          ) : (
            <div className="space-y-3">
              {anomaliesAdminRes!.data.map(anomalie => {
                const typeLabels: Record<string, string> = {
                  PERTE: "Perte", CASSE: "Casse", VOL: "Vol",
                  DEFECTUEUX: "Défectueux", MANQUANT: "Manquant", SURPLUS: "Surplus",
                };
                const typeColors: Record<string, string> = {
                  PERTE: "bg-red-100 text-red-700", CASSE: "bg-orange-100 text-orange-700",
                  VOL: "bg-rose-100 text-rose-700", DEFECTUEUX: "bg-amber-100 text-amber-700",
                  MANQUANT: "bg-slate-100 text-slate-700", SURPLUS: "bg-blue-100 text-blue-700",
                };
                const prixAchat = Number(anomalie.produit.prixAchat ?? anomalie.produit.prixUnitaire);
                const impactFinancier = prixAchat * anomalie.quantite;
                return (
                  <div key={anomalie.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${typeColors[anomalie.type] ?? "bg-slate-100 text-slate-700"}`}>
                            {typeLabels[anomalie.type] ?? anomalie.type}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${anomalie.statut === "TRANSMISE" ? "bg-purple-100 text-purple-700" : anomalie.statut === "TRAITEE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {anomalie.statut}
                          </span>
                          <span className="text-xs font-mono text-slate-400">{anomalie.reference}</span>
                        </div>
                        <p className="font-semibold text-slate-800">{anomalie.produit.nom}</p>
                        <p className="text-sm text-slate-600 mt-0.5">{anomalie.description}</p>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                          <span>{anomalie.quantite} unité(s)</span>
                          <span className="font-semibold text-red-600">Impact financier : {impactFinancier.toLocaleString("fr-FR")} FCFA</span>
                          <span>PDV : {anomalie.pointDeVente?.nom ?? "—"}</span>
                          <span>Déclaré par {anomalie.magasinier.prenom} {anomalie.magasinier.nom}</span>
                          {anomalie.traiteur && <span>Resp. Appro : {anomalie.traiteur.prenom} {anomalie.traiteur.nom}</span>}
                        </div>
                        {anomalie.commentaire && (
                          <p className="text-xs mt-1.5 px-2 py-1 rounded-lg bg-slate-50 text-slate-500 italic">{anomalie.commentaire}</p>
                        )}
                      </div>
                      {anomalie.statut === "TRANSMISE" && (
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => setAnomalieAdminModal({ id: anomalie.id, action: "APPROUVER", nomProduit: anomalie.produit.nom, quantite: anomalie.quantite })}
                            className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors font-medium flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <CheckCircle size={13} /> Approuver
                          </button>
                          <button
                            onClick={() => setAnomalieAdminModal({ id: anomalie.id, action: "REJETER", nomProduit: anomalie.produit.nom, quantite: anomalie.quantite })}
                            className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <XCircle size={13} /> Rejeter
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(anomaliesAdminRes?.meta.totalPages ?? 0) > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setAnomaliesAdminPage(p => Math.max(1, p - 1))} disabled={anomaliesAdminPage === 1} className="px-4 py-2 border border-slate-200 rounded-xl text-sm disabled:opacity-40">Précédent</button>
              <span className="px-4 py-2 text-sm text-slate-600">{anomaliesAdminPage} / {anomaliesAdminRes!.meta.totalPages}</span>
              <button onClick={() => setAnomaliesAdminPage(p => p + 1)} disabled={anomaliesAdminPage >= (anomaliesAdminRes?.meta.totalPages ?? 1)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm disabled:opacity-40">Suivant</button>
            </div>
          )}
        </div>

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

      {/* ── Modal approbation anomalie ── */}
      {anomalieAdminModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${anomalieAdminModal.action === "APPROUVER" ? "bg-emerald-50" : "bg-red-50"}`}>
                  {anomalieAdminModal.action === "APPROUVER"
                    ? <CheckCircle className="text-emerald-600" size={20} />
                    : <XCircle className="text-red-600" size={20} />
                  }
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    {anomalieAdminModal.action === "APPROUVER" ? "Approuver la déclaration" : "Rejeter la déclaration"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {anomalieAdminModal.action === "APPROUVER"
                      ? `Stock sera décrémenté de ${anomalieAdminModal.quantite} unité(s) de "${anomalieAdminModal.nomProduit}"`
                      : "Renvoyée au Resp. Approvisionnement"}
                  </p>
                </div>
              </div>
              <button onClick={() => setAnomalieAdminModal(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Commentaire</label>
                <textarea
                  rows={3}
                  value={anomalieAdminMotif}
                  onChange={e => setAnomalieAdminMotif(e.target.value)}
                  placeholder={anomalieAdminModal.action === "APPROUVER" ? "Commentaire optionnel..." : "Raison du rejet..."}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setAnomalieAdminModal(null)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmAdminAnomalie}
                  disabled={adminAnomalieLoading}
                  className={`flex-1 py-2.5 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${
                    anomalieAdminModal.action === "APPROUVER" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {adminAnomalieLoading
                    ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : anomalieAdminModal.action === "APPROUVER"
                      ? <><CheckCircle size={15} /> Approuver — décrémenter stock</>
                      : <><XCircle size={15} /> Rejeter</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
