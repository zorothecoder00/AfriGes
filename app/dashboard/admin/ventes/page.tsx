"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Search, Download, ShoppingCart, TrendingUp, DollarSign,
  Users, Calendar, CheckCircle, XCircle, ChevronRight, AlertCircle,
  Layers, Truck, ArrowLeft, Package, Store, Trash2, CreditCard, Receipt,
} from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { exportToCsv } from '@/lib/exportCsv';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PDVOption { id: number; nom: string; code: string; }
interface ClientOption { id: number; nom: string; prenom: string; telephone: string; }

// Vente directe
interface LigneVente {
  produitId: number; nom: string; quantite: number;
  prixUnitaire: number; stockDispo: number;
}
interface StockItem {
  produitId: number; quantite: number;
  produit: { id: number; nom: string; reference?: string; prixUnitaire: string; unite?: string };
}
interface VenteDirecte {
  id: number; reference: string; statut: 'BROUILLON' | 'CONFIRMEE' | 'ANNULEE';
  montantTotal: string | number; montantPaye: string | number; monnaieRendue: string | number;
  modePaiement: string; clientNom?: string; clientTelephone?: string; notes?: string;
  createdAt: string;
  pointDeVente: { id: number; nom: string; code: string };
  vendeur: { id: number; nom: string; prenom: string };
  client?: { id: number; nom: string; prenom: string; telephone: string };
  lignes: { id: number; quantite: number; prixUnitaire: string | number; montant: string | number; produit: { id: number; nom: string } }[];
}
interface VentesResponse {
  data: VenteDirecte[]; pdvs: PDVOption[];
  stats: { total: number; montantTotal: number; panierMoyen: number; nbConfirmees: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// Packs (existant)
interface LigneReception { id: number; quantite: number; prixUnitaire: string; produit: { nom: string }; }
interface Reception {
  id: number; statut: 'PLANIFIEE' | 'LIVREE' | 'ANNULEE';
  dateLivraison?: string; datePrevisionnelle?: string; livreurNom?: string; createdAt: string;
  souscription: {
    id: number; pack: { nom: string; type: string };
    client?: { nom: string; prenom: string; telephone: string };
    user?:   { nom: string; prenom: string };
  };
  lignes: LigneReception[];
}
interface ReceptionsResponse {
  receptions: Reception[]; meta: { total: number; page: number; limit: number; totalPages: number };
  stats: { totalLivraisons: number; totalPlanifiees: number; montantTotal: number; clientsActifs: number; ceMois: number };
}
interface EligibilitePackResponse {
  eligible: boolean; raisons: string[];
  souscriptions: { id: number; pack: { nom: string; type: string }; statut: string }[];
  client: ClientOption;
}
interface ProduitOption { id: number; nom: string; prixUnitaire: string; stock: number; }

// ─── Constantes ───────────────────────────────────────────────────────────────

const MODE_PAIEMENT_LABELS: Record<string, string> = {
  ESPECES: 'Espèces', VIREMENT: 'Virement', CHEQUE: 'Chèque',
  MOBILE_MONEY: 'Mobile Money', WALLET: 'Wallet', CREDIT: 'Crédit',
};
const STATUT_VENTE_BADGE: Record<string, string> = {
  CONFIRMEE: 'bg-emerald-100 text-emerald-700',
  BROUILLON: 'bg-slate-100 text-slate-600',
  ANNULEE:   'bg-red-100 text-red-700',
};
const PACK_LABELS: Record<string, string> = {
  ALIMENTAIRE: 'Alimentaire', REVENDEUR: 'Revendeur', FAMILIAL: 'Familial',
  URGENCE: 'Urgence', EPARGNE_PRODUIT: 'Épargne-Produit', FIDELITE: 'Fidélité',
};
const PACK_BADGE: Record<string, string> = {
  ALIMENTAIRE: 'bg-green-100 text-green-800', REVENDEUR: 'bg-blue-100 text-blue-800',
  FAMILIAL: 'bg-purple-100 text-purple-800', URGENCE: 'bg-red-100 text-red-800',
  EPARGNE_PRODUIT: 'bg-amber-100 text-amber-800', FIDELITE: 'bg-pink-100 text-pink-800',
};

function initials(nom: string, prenom: string) {
  return `${(prenom?.[0] ?? '').toUpperCase()}${(nom?.[0] ?? '').toUpperCase()}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VentesPage() {
  const [activeTab, setActiveTab] = useState<'ventes' | 'packs'>('ventes');
  const isVentesTab = activeTab === 'ventes';

  // ── État onglet Ventes directes ────────────────────────────────────────────
  const [searchVentes, setSearchVentes]             = useState('');
  const [debouncedSearchVentes, setDebouncedSearchVentes] = useState('');
  const [pageVentes, setPageVentes]                 = useState(1);
  const [filterPdvId, setFilterPdvId]               = useState('');
  const [filterStatut, setFilterStatut]             = useState('');
  const [filterDateDebut, setFilterDateDebut]       = useState('');
  const [filterDateFin, setFilterDateFin]           = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchVentes(searchVentes), 400);
    return () => clearTimeout(t);
  }, [searchVentes]);

  // ── État onglet Packs ──────────────────────────────────────────────────────
  const [searchPacks, setSearchPacks]               = useState('');
  const [debouncedSearchPacks, setDebouncedSearchPacks] = useState('');
  const [pagePacks, setPagePacks]                   = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchPacks(searchPacks), 400);
    return () => clearTimeout(t);
  }, [searchPacks]);

  // ── Modal Vente directe ────────────────────────────────────────────────────
  const [venteModalOpen, setVenteModalOpen]         = useState(false);
  const [venteStep, setVenteStep]                   = useState<1 | 2 | 3>(1);

  // Step 1 – PDV + client
  const [selectedPdvId, setSelectedPdvId]           = useState('');
  const [clientType, setClientType]                 = useState<'search' | 'walkin'>('search');
  const [clientSearch, setClientSearch]             = useState('');
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('');
  const [selectedClient, setSelectedClient]         = useState<ClientOption | null>(null);
  const [clientNomManuel, setClientNomManuel]       = useState('');
  const [clientTelManuel, setClientTelManuel]       = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientSearch(clientSearch), 400);
    return () => clearTimeout(t);
  }, [clientSearch]);

  // Step 2 – lignes produits
  const [stockPdv, setStockPdv]                     = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading]             = useState(false);
  const [lignes, setLignes]                         = useState<LigneVente[]>([]);
  const [produitSelectId, setProduitSelectId]       = useState('');

  // Step 3 – paiement
  const [modePaiement, setModePaiement]             = useState('ESPECES');
  const [montantPaye, setMontantPaye]               = useState('');
  const [notesVente, setNotesVente]                 = useState('');

  const montantTotal   = lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaire, 0);
  const monnaieRendue  = Math.max(0, Number(montantPaye) - montantTotal);

  // ── Modal Pack (existant) ──────────────────────────────────────────────────
  const [packModalOpen, setPackModalOpen]           = useState(false);
  const [packStep, setPackStep]                     = useState<1 | 2>(1);
  const [packClientSearch, setPackClientSearch]     = useState('');
  const [debouncedPackClientSearch, setDebouncedPackClientSearch] = useState('');
  const [packSelectedClient, setPackSelectedClient] = useState<ClientOption | null>(null);
  const [eligibilitePack, setEligibilitePack]       = useState<EligibilitePackResponse | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibiliteError, setEligibiliteError]     = useState<string | null>(null);
  const [formPack, setFormPack]                     = useState({ souscriptionId: '', produitId: '', quantite: '1' });
  const [confirmingId, setConfirmingId]             = useState<number | null>(null);
  const [cancellingId, setCancellingId]             = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPackClientSearch(packClientSearch), 400);
    return () => clearTimeout(t);
  }, [packClientSearch]);

  // ── API – Ventes directes ──────────────────────────────────────────────────
  const ventesParams = new URLSearchParams({ page: String(pageVentes), limit: '20' });
  if (debouncedSearchVentes) ventesParams.set('search', debouncedSearchVentes);
  if (filterPdvId)           ventesParams.set('pdvId',  filterPdvId);
  if (filterStatut)          ventesParams.set('statut', filterStatut);
  if (filterDateDebut)       ventesParams.set('dateDebut', filterDateDebut);
  if (filterDateFin)         ventesParams.set('dateFin',   filterDateFin);

  const { data: ventesResponse, loading: ventesLoading, refetch: refetchVentes } =
    useApi<VentesResponse>(`/api/admin/ventes?${ventesParams}`);
  const ventes      = ventesResponse?.data ?? [];
  const ventesStats = ventesResponse?.stats;
  const ventesMeta  = ventesResponse?.meta;
  const pdvOptions  = ventesResponse?.pdvs ?? [];

  // ── API – Packs réceptions ─────────────────────────────────────────────────
  const packsParams = new URLSearchParams({ page: String(pagePacks), limit: '20' });
  if (debouncedSearchPacks) packsParams.set('search', debouncedSearchPacks);

  const { data: packsResponse, loading: packsLoading, refetch: refetchPacks } =
    useApi<ReceptionsResponse>(`/api/admin/packs/receptions?${packsParams}`);
  const receptions = packsResponse?.receptions ?? [];
  const packsStats = packsResponse?.stats;
  const packsMeta  = packsResponse?.meta;

  // ── API – Recherche clients (modal vente) ──────────────────────────────────
  const { data: venteClientsResponse } = useApi<{ data: ClientOption[] }>(
    venteModalOpen && venteStep === 1 && clientType === 'search' && debouncedClientSearch.length >= 2
      ? `/api/admin/clients?search=${encodeURIComponent(debouncedClientSearch)}&limit=6`
      : null
  );
  const venteClientsOptions = venteClientsResponse?.data ?? [];

  // ── API – Recherche clients (modal pack) ──────────────────────────────────
  const { data: packClientsResponse } = useApi<{ data: ClientOption[] }>(
    packModalOpen && packStep === 1 && debouncedPackClientSearch.length >= 2
      ? `/api/admin/clients?search=${encodeURIComponent(debouncedPackClientSearch)}&limit=6`
      : null
  );
  const packClientsOptions = packClientsResponse?.data ?? [];

  // ── API – Produits stock (modal pack) ─────────────────────────────────────
  const { data: produitsResponse } = useApi<{ data: ProduitOption[] }>(
    packModalOpen && packStep === 2 ? '/api/admin/stock?limit=200' : null
  );
  const produits = (produitsResponse?.data ?? []).filter((p: ProduitOption) => p.stock > 0);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const { mutate: createVente, loading: creatingVente, error: createVenteError } =
    useMutation<unknown, object>('/api/admin/ventes', 'POST', { successMessage: 'Vente enregistrée !' });

  const souscriptionIdRef = useRef('');
  souscriptionIdRef.current = formPack.souscriptionId;
  const { mutate: addVente, loading: adding, error: addError } = useMutation(
    () => souscriptionIdRef.current ? `/api/admin/packs/souscriptions/${souscriptionIdRef.current}/livrer` : '',
    'POST',
    { successMessage: 'Livraison planifiée !' }
  );
  const confirmingSouscriptionIdRef = useRef<number | null>(null);
  const { mutate: doConfirmer } = useMutation<unknown, { action: string; receptionId: number }>(
    () => `/api/admin/packs/souscriptions/${confirmingSouscriptionIdRef.current}/livrer`,
    'POST'
  );
  const cancellingIdRef = useRef<number | null>(null);
  const { mutate: doAnnuler } = useMutation(
    () => `/api/admin/packs/receptions/${cancellingIdRef.current}`,
    'DELETE',
    { successMessage: 'Livraison annulée !' }
  );

  // ── Chargement stock du PDV sélectionné ───────────────────────────────────
  const loadStockPdv = useCallback(async (pdvId: string) => {
    setStockLoading(true);
    try {
      const res = await fetch(`/api/admin/stock?pdvId=${pdvId}&limit=200`);
      const data = await res.json();
      setStockPdv((data.data ?? []).filter((s: StockItem) => s.quantite > 0));
    } catch {
      setStockPdv([]);
    } finally {
      setStockLoading(false);
    }
  }, []);

  // ── Handlers – modal vente directe ────────────────────────────────────────
  const closeVenteModal = () => {
    setVenteModalOpen(false);
    setVenteStep(1);
    setSelectedPdvId('');
    setClientType('search');
    setClientSearch('');
    setSelectedClient(null);
    setClientNomManuel('');
    setClientTelManuel('');
    setStockPdv([]);
    setLignes([]);
    setProduitSelectId('');
    setModePaiement('ESPECES');
    setMontantPaye('');
    setNotesVente('');
  };

  const goToStep2 = async () => {
    if (!selectedPdvId) return;
    await loadStockPdv(selectedPdvId);
    setVenteStep(2);
  };

  const addLigne = () => {
    if (!produitSelectId) return;
    const stock = stockPdv.find(s => s.produitId === Number(produitSelectId));
    if (!stock || lignes.find(l => l.produitId === Number(produitSelectId))) return;
    setLignes(ls => [...ls, {
      produitId:    stock.produitId,
      nom:          stock.produit.nom,
      quantite:     1,
      prixUnitaire: Number(stock.produit.prixUnitaire),
      stockDispo:   stock.quantite,
    }]);
    setProduitSelectId('');
  };

  const updateLigneQte = (produitId: number, qte: number) => {
    setLignes(ls => ls.map(l => l.produitId === produitId
      ? { ...l, quantite: Math.max(1, Math.min(l.stockDispo, qte)) }
      : l
    ));
  };

  const removeLigne = (produitId: number) => {
    setLignes(ls => ls.filter(l => l.produitId !== produitId));
  };

  const goToStep3 = () => {
    if (lignes.length === 0) return;
    setMontantPaye(String(montantTotal));
    setVenteStep(3);
  };

  const handleSubmitVente = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createVente({
      pointDeVenteId:  Number(selectedPdvId),
      modePaiement,
      montantPaye:     Number(montantPaye),
      clientId:        selectedClient?.id ?? null,
      clientNom:       clientType === 'walkin'
        ? clientNomManuel || null
        : selectedClient ? `${selectedClient.prenom} ${selectedClient.nom}` : null,
      clientTelephone: clientType === 'walkin'
        ? clientTelManuel || null
        : selectedClient?.telephone ?? null,
      notes: notesVente || null,
      lignes: lignes.map(l => ({ produitId: l.produitId, quantite: l.quantite, prixUnitaire: l.prixUnitaire })),
    });
    if (res) { closeVenteModal(); refetchVentes(); }
  };

  // ── Handlers – modal pack ─────────────────────────────────────────────────
  const closePackModal = () => {
    setPackModalOpen(false);
    setPackStep(1);
    setPackClientSearch('');
    setPackSelectedClient(null);
    setEligibilitePack(null);
    setEligibiliteError(null);
    setFormPack({ souscriptionId: '', produitId: '', quantite: '1' });
  };

  const checkEligibility = async (client: ClientOption) => {
    setPackSelectedClient(client);
    setCheckingEligibility(true);
    setEligibilitePack(null);
    setEligibiliteError(null);
    try {
      const res  = await fetch(`/api/admin/clients/${client.id}/eligibilite-pack`);
      const data: EligibilitePackResponse = await res.json();
      if (!res.ok) { setEligibiliteError((data as unknown as { error: string }).error || 'Erreur'); return; }
      setEligibilitePack(data);
      if (data.eligible) {
        setPackStep(2);
        if (data.souscriptions.length === 1) {
          setFormPack(f => ({ ...f, souscriptionId: String(data.souscriptions[0].id) }));
        }
      }
    } catch { setEligibiliteError('Erreur réseau'); }
    finally   { setCheckingEligibility(false); }
  };

  const handlePackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPack.souscriptionId || !formPack.produitId) return;
    const produit = produits.find(p => p.id === parseInt(formPack.produitId));
    if (!produit) return;
    const qte = parseInt(formPack.quantite);
    if (qte > produit.stock) return;
    const res = await addVente({
      action: 'planifier',
      lignes: [{ produitId: parseInt(formPack.produitId), quantite: qte, prixUnitaire: parseFloat(produit.prixUnitaire) }],
      notes: `Livraison planifiée — ${produit.nom} × ${formPack.quantite}`,
    });
    if (res) { closePackModal(); refetchPacks(); }
  };

  const handleConfirmerLivraison = async (reception: Reception) => {
    if (confirmingId) return;
    confirmingSouscriptionIdRef.current = reception.souscription.id;
    setConfirmingId(reception.id);
    const res = await doConfirmer({ action: 'livrer', receptionId: reception.id });
    if (res) { refetchPacks(); }
    setConfirmingId(null);
  };

  const handleAnnulerLivraison = async (receptionId: number) => {
    if (cancellingId) return;
    cancellingIdRef.current = receptionId;
    setCancellingId(receptionId);
    const res = await doAnnuler({});
    if (res) { refetchPacks(); }
    setCancellingId(null);
  };

  // ── Export ventes ─────────────────────────────────────────────────────────
  const handleExportVentes = () => {
    exportToCsv(
      ventes.map(v => ({
        ref:     v.reference,
        pdv:     v.pointDeVente.nom,
        client:  v.client ? `${v.client.prenom} ${v.client.nom}` : (v.clientNom ?? '—'),
        tel:     v.client?.telephone ?? v.clientTelephone ?? '—',
        montant: Number(v.montantTotal),
        paye:    Number(v.montantPaye),
        mode:    MODE_PAIEMENT_LABELS[v.modePaiement] ?? v.modePaiement,
        statut:  v.statut,
        vendeur: `${v.vendeur.prenom} ${v.vendeur.nom}`,
        date:    v.createdAt,
      })),
      [
        { label: 'Référence',    key: 'ref' },
        { label: 'PDV',          key: 'pdv' },
        { label: 'Client',       key: 'client' },
        { label: 'Téléphone',    key: 'tel' },
        { label: 'Montant',      key: 'montant', format: (v) => formatCurrency(Number(v)) },
        { label: 'Payé',         key: 'paye',    format: (v) => formatCurrency(Number(v)) },
        { label: 'Mode paiement',key: 'mode' },
        { label: 'Statut',       key: 'statut' },
        { label: 'Vendeur',      key: 'vendeur' },
        { label: 'Date',         key: 'date',    format: (v) => formatDateTime(String(v)) },
      ],
      'ventes-directes.csv'
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Ventes</h1>
              <p className="text-slate-500">
                {isVentesTab ? 'Ventes directes produits — tous points de vente' : 'Livraisons de produits aux clients via pack'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {isVentesTab ? (
              <>
                <button onClick={handleExportVentes}
                  className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
                  <Download size={18} /> Exporter
                </button>
                <button onClick={() => setVenteModalOpen(true)}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
                  <Plus size={20} /> Nouvelle vente
                </button>
              </>
            ) : (
              <button onClick={() => setPackModalOpen(true)}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
                <Plus size={20} /> Planifier une livraison
              </button>
            )}
          </div>
        </div>

        {/* ─── Onglets ─────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          <button onClick={() => setActiveTab('ventes')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
              isVentesTab ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Receipt size={16} /> Ventes directes
          </button>
          <button onClick={() => setActiveTab('packs')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
              !isVentesTab ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Layers size={16} /> Livraisons packs
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MODAL — Nouvelle vente directe (3 étapes)
        ══════════════════════════════════════════════════════════════════ */}
        {venteModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={closeVenteModal}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg font-bold text-lg">
                ×
              </button>

              <h2 className="text-xl font-bold text-slate-800 mb-1">Nouvelle vente directe</h2>
              <p className="text-sm text-slate-500 mb-5">
                {venteStep === 1 ? 'Sélectionner le PDV et le client' : venteStep === 2 ? 'Ajouter les produits' : 'Mode de paiement'}
              </p>

              {/* Indicateur étapes */}
              <div className="flex items-center gap-2 mb-6">
                {[{ n: 1, label: 'PDV & Client' }, { n: 2, label: 'Produits' }, { n: 3, label: 'Paiement' }].map(({ n, label }) => (
                  <React.Fragment key={n}>
                    <div className={`flex items-center gap-1.5 ${venteStep >= n ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        venteStep > n ? 'bg-emerald-600 text-white' : venteStep === n ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {venteStep > n ? <CheckCircle className="w-3.5 h-3.5" /> : n}
                      </div>
                      <span className="text-xs font-medium hidden sm:block">{label}</span>
                    </div>
                    {n < 3 && <ChevronRight className="text-slate-300 w-4 h-4 shrink-0" />}
                  </React.Fragment>
                ))}
              </div>

              {/* ── Étape 1 : PDV + client ─────────────────────────────────── */}
              {venteStep === 1 && (
                <div className="space-y-4">
                  {/* PDV */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Point de vente *</label>
                    <select
                      value={selectedPdvId}
                      onChange={e => { setSelectedPdvId(e.target.value); setStockPdv([]); setLignes([]); }}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">Sélectionner un PDV</option>
                      {pdvOptions.map(p => (
                        <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Client */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Client (optionnel)</label>
                    <div className="flex gap-2 mb-3">
                      <button type="button"
                        onClick={() => { setClientType('search'); setClientNomManuel(''); setClientTelManuel(''); }}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          clientType === 'search' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}>
                        Client enregistré
                      </button>
                      <button type="button"
                        onClick={() => { setClientType('walkin'); setSelectedClient(null); setClientSearch(''); }}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          clientType === 'walkin' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}>
                        Anonyme / Walk-in
                      </button>
                    </div>

                    {clientType === 'search' && (
                      <div className="space-y-2">
                        {selectedClient ? (
                          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{selectedClient.prenom} {selectedClient.nom}</p>
                              <p className="text-xs text-slate-500">{selectedClient.telephone}</p>
                            </div>
                            <button type="button"
                              onClick={() => { setSelectedClient(null); setClientSearch(''); }}
                              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium underline">
                              Changer
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                              <input type="text" placeholder="Nom, prénom ou téléphone…"
                                value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm" />
                            </div>
                            {venteClientsOptions.length > 0 && (
                              <div className="border border-slate-200 rounded-xl overflow-hidden">
                                {venteClientsOptions.map((c, i) => (
                                  <button key={c.id} type="button"
                                    onClick={() => { setSelectedClient(c); setClientSearch(''); }}
                                    className={`w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors flex items-center justify-between group ${i < venteClientsOptions.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                    <div>
                                      <p className="font-medium text-slate-800 text-sm">{c.prenom} {c.nom}</p>
                                      <p className="text-xs text-slate-500">{c.telephone}</p>
                                    </div>
                                    <ChevronRight className="text-slate-300 group-hover:text-emerald-500 w-4 h-4" />
                                  </button>
                                ))}
                              </div>
                            )}
                            {debouncedClientSearch.length < 2 && (
                              <p className="text-xs text-slate-400 text-center py-1">Saisissez au moins 2 caractères</p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {clientType === 'walkin' && (
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="Nom (optionnel)" value={clientNomManuel}
                          onChange={e => setClientNomManuel(e.target.value)}
                          className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                        <input type="text" placeholder="Téléphone (optionnel)" value={clientTelManuel}
                          onChange={e => setClientTelManuel(e.target.value)}
                          className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                      </div>
                    )}
                  </div>

                  <button type="button" onClick={goToStep2}
                    disabled={!selectedPdvId || stockLoading}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 font-medium flex items-center justify-center gap-2 transition-colors">
                    {stockLoading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Chargement stock…</>
                      : <>Suivant <ChevronRight size={16} /></>}
                  </button>
                </div>
              )}

              {/* ── Étape 2 : Produits ─────────────────────────────────────── */}
              {venteStep === 2 && (
                <div className="space-y-4">
                  {/* Récap PDV */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <Store size={15} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 font-medium">
                      {pdvOptions.find(p => p.id === Number(selectedPdvId))?.nom}
                    </span>
                    <button type="button" onClick={() => setVenteStep(1)}
                      className="ml-auto text-xs text-emerald-600 hover:text-emerald-800 underline font-medium">
                      Changer
                    </button>
                  </div>

                  {/* Sélecteur produit */}
                  <div className="flex gap-2">
                    <select value={produitSelectId} onChange={e => setProduitSelectId(e.target.value)}
                      className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                      <option value="">Choisir un produit…</option>
                      {stockPdv
                        .filter(s => !lignes.find(l => l.produitId === s.produitId))
                        .map(s => (
                          <option key={s.produitId} value={s.produitId}>
                            {s.produit.nom} — {formatCurrency(s.produit.prixUnitaire)} (stock : {s.quantite})
                          </option>
                        ))}
                    </select>
                    <button type="button" onClick={addLigne} disabled={!produitSelectId}
                      className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      <Plus size={16} />
                    </button>
                  </div>

                  {stockPdv.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-4">Aucun produit en stock sur ce PDV</p>
                  )}

                  {/* Lignes */}
                  {lignes.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      {lignes.map((l, i) => (
                        <div key={l.produitId}
                          className={`flex items-center gap-3 px-4 py-3 ${i < lignes.length - 1 ? 'border-b border-slate-100' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{l.nom}</p>
                            <p className="text-xs text-slate-400">{formatCurrency(l.prixUnitaire)} / unité · Stock : {l.stockDispo}</p>
                          </div>
                          <input type="number" min="1" max={l.stockDispo} value={l.quantite}
                            onChange={e => updateLigneQte(l.produitId, Number(e.target.value))}
                            className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          <span className="text-sm font-semibold text-slate-700 w-24 text-right shrink-0">
                            {formatCurrency(l.quantite * l.prixUnitaire)}
                          </span>
                          <button type="button" onClick={() => removeLigne(l.produitId)}
                            className="text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                        <span className="text-sm font-semibold text-slate-700">Total</span>
                        <span className="text-lg font-bold text-emerald-700">{formatCurrency(montantTotal)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setVenteStep(1)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm transition-colors">
                      Retour
                    </button>
                    <button type="button" onClick={goToStep3} disabled={lignes.length === 0}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 font-medium text-sm flex items-center justify-center gap-2 transition-colors">
                      Suivant <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Étape 3 : Paiement ─────────────────────────────────────── */}
              {venteStep === 3 && (
                <form onSubmit={handleSubmitVente} className="space-y-4">
                  {/* Récap produits */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
                    {lignes.map(l => (
                      <div key={l.produitId} className="flex justify-between text-sm">
                        <span className="text-slate-600">{l.nom} × {l.quantite}</span>
                        <span className="font-medium text-slate-800">{formatCurrency(l.quantite * l.prixUnitaire)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t border-slate-200 mt-1">
                      <span className="font-bold text-slate-800">Total à payer</span>
                      <span className="font-bold text-emerald-700 text-base">{formatCurrency(montantTotal)}</span>
                    </div>
                  </div>

                  {/* Mode paiement */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mode de paiement *</label>
                    <select required value={modePaiement} onChange={e => setModePaiement(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {Object.entries(MODE_PAIEMENT_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  {/* Montant reçu */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Montant reçu *</label>
                    <input type="number" required min="0" step="1" value={montantPaye}
                      onChange={e => setMontantPaye(e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        montantPaye !== '' && Number(montantPaye) < montantTotal ? 'border-orange-400 bg-orange-50' : 'border-slate-200'
                      }`} />
                    {montantPaye !== '' && Number(montantPaye) >= montantTotal && montantTotal > 0 && (
                      <p className="text-xs text-emerald-600 mt-1">Monnaie à rendre : <span className="font-bold">{formatCurrency(monnaieRendue)}</span></p>
                    )}
                    {montantPaye !== '' && Number(montantPaye) < montantTotal && (
                      <p className="text-xs text-orange-600 mt-1 font-medium">
                        Montant insuffisant — reste {formatCurrency(montantTotal - Number(montantPaye))}
                      </p>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optionnel)</label>
                    <textarea value={notesVente} onChange={e => setNotesVente(e.target.value)} rows={2}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none" />
                  </div>

                  {createVenteError && (
                    <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createVenteError}</p>
                  )}

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setVenteStep(2)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm transition-colors">
                      Retour
                    </button>
                    <button type="submit"
                      disabled={creatingVente || !montantPaye || Number(montantPaye) < montantTotal}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 font-medium text-sm flex items-center justify-center gap-2 transition-colors">
                      <CreditCard size={15} />
                      {creatingVente ? 'Enregistrement…' : 'Confirmer la vente'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL — Planifier livraison pack (existant)
        ══════════════════════════════════════════════════════════════════ */}
        {packModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl relative">
              <button onClick={closePackModal}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg font-bold text-lg">
                ×
              </button>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Planifier une livraison</h2>
              <p className="text-sm text-slate-500 mb-5">
                {packStep === 1 ? 'Recherchez un client éligible' : 'Choisissez le produit à planifier'}
              </p>

              <div className="flex items-center gap-2 mb-5">
                {[{ n: 1, label: 'Client' }, { n: 2, label: 'Produit' }].map(({ n, label }) => (
                  <React.Fragment key={n}>
                    <div className={`flex items-center gap-1.5 ${packStep >= n ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        packStep > n ? 'bg-emerald-600 text-white' : packStep === n ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {packStep > n ? <CheckCircle className="w-3.5 h-3.5" /> : n}
                      </div>
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    {n < 2 && <ChevronRight className="text-slate-300 w-4 h-4" />}
                  </React.Fragment>
                ))}
              </div>

              {addError && (
                <p className="text-red-500 mb-3 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{addError}</p>
              )}

              {packStep === 1 && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input autoFocus type="text" placeholder="Nom, prénom ou téléphone…"
                      value={packClientSearch}
                      onChange={e => { setPackClientSearch(e.target.value); setPackSelectedClient(null); setEligibilitePack(null); setEligibiliteError(null); }}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
                  </div>
                  {checkingEligibility && (
                    <div className="flex items-center gap-3 py-3 text-slate-500 text-sm">
                      <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin shrink-0" />
                      Vérification en cours…
                    </div>
                  )}
                  {!checkingEligibility && packClientsOptions.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      {packClientsOptions.map((client, idx) => (
                        <button key={client.id} type="button" onClick={() => checkEligibility(client)}
                          className={`w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors flex items-center justify-between group ${idx < packClientsOptions.length - 1 ? 'border-b border-slate-100' : ''}`}>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{client.prenom} {client.nom}</p>
                            <p className="text-xs text-slate-500">{client.telephone}</p>
                          </div>
                          <ChevronRight className="text-slate-300 group-hover:text-emerald-500 w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  )}
                  {!checkingEligibility && debouncedPackClientSearch.length >= 2 && packClientsOptions.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-4">Aucun client trouvé</p>
                  )}
                  {eligibiliteError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                      <XCircle className="text-red-500 w-4 h-4 mt-0.5 shrink-0" />
                      <p className="text-red-700 text-sm">{eligibiliteError}</p>
                    </div>
                  )}
                  {!checkingEligibility && packSelectedClient && eligibilitePack && !eligibilitePack.eligible && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="text-orange-500 w-4 h-4 shrink-0" />
                        <p className="font-semibold text-orange-800 text-sm">
                          {packSelectedClient.prenom} {packSelectedClient.nom} — aucun pack actif
                        </p>
                      </div>
                      {eligibilitePack.raisons.map((r, i) => (
                        <p key={i} className="text-xs text-orange-700 leading-relaxed">• {r}</p>
                      ))}
                    </div>
                  )}
                  {debouncedPackClientSearch.length < 2 && (
                    <p className="text-center text-slate-400 text-xs py-1">Saisissez au moins 2 caractères</p>
                  )}
                </div>
              )}

              {packStep === 2 && packSelectedClient && eligibilitePack && (
                <form onSubmit={handlePackSubmit} className="space-y-4">
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-emerald-500 w-4 h-4 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{packSelectedClient.prenom} {packSelectedClient.nom}</p>
                        <p className="text-xs text-slate-500">{packSelectedClient.telephone}</p>
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => { setPackStep(1); setEligibilitePack(null); setPackSelectedClient(null); setFormPack({ souscriptionId: '', produitId: '', quantite: '1' }); }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-medium underline underline-offset-2">
                      Changer
                    </button>
                  </div>

                  {eligibilitePack.souscriptions.length === 1 ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                      <p className="text-xs font-medium text-slate-500 mb-0.5">Pack actif</p>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800">{eligibilitePack.souscriptions[0].pack.nom}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PACK_BADGE[eligibilitePack.souscriptions[0].pack.type] ?? 'bg-slate-100 text-slate-600'}`}>
                          {PACK_LABELS[eligibilitePack.souscriptions[0].pack.type] ?? eligibilitePack.souscriptions[0].pack.type}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Pack à utiliser *</label>
                      <select required value={formPack.souscriptionId}
                        onChange={e => setFormPack(f => ({ ...f, souscriptionId: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="">Sélectionner un pack</option>
                        {eligibilitePack.souscriptions.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.pack.nom} — {PACK_LABELS[s.pack.type] ?? s.pack.type} ({s.statut})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Produit *</label>
                    <select required value={formPack.produitId}
                      onChange={e => setFormPack(f => ({ ...f, produitId: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">Sélectionner un produit</option>
                      {produits.map(p => (
                        <option key={p.id} value={p.id}>{p.nom} — {formatCurrency(p.prixUnitaire)} (Stock : {p.stock})</option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const selectedProduit = produits.find(p => p.id === parseInt(formPack.produitId));
                    const qte = parseInt(formPack.quantite) || 0;
                    const stockDepasse = selectedProduit ? qte > selectedProduit.stock : false;
                    return (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantité</label>
                        <input type="number" min="1" max={selectedProduit ? selectedProduit.stock : undefined}
                          required value={formPack.quantite}
                          onChange={e => setFormPack(f => ({ ...f, quantite: e.target.value }))}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 ${stockDepasse ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} />
                        {selectedProduit && (
                          <p className="text-xs mt-1 text-slate-400">
                            Stock disponible : <span className="font-semibold text-slate-600">{selectedProduit.stock}</span>
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setPackStep(1)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm transition-colors">
                      Retour
                    </button>
                    <button type="submit"
                      disabled={adding || (() => { const p = produits.find(x => x.id === parseInt(formPack.produitId)); return !!p && parseInt(formPack.quantite) > p.stock; })()}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 font-medium text-sm flex items-center justify-center gap-2 transition-colors">
                      <Truck size={15} />
                      {adding ? 'Enregistrement…' : 'Planifier la livraison'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ONGLET — VENTES DIRECTES
        ══════════════════════════════════════════════════════════════════ */}
        {isVentesTab && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-5">
              {[
                { label: 'Total ventes',   value: String(ventesStats?.total ?? 0),               icon: ShoppingCart, color: 'bg-emerald-500', lightBg: 'bg-emerald-50' },
                { label: 'Confirmées',     value: String(ventesStats?.nbConfirmees ?? 0),         icon: CheckCircle,  color: 'bg-blue-500',    lightBg: 'bg-blue-50'    },
                { label: 'Montant total',  value: formatCurrency(ventesStats?.montantTotal ?? 0), icon: DollarSign,   color: 'bg-violet-500',  lightBg: 'bg-violet-50'  },
                { label: 'Panier moyen',   value: formatCurrency(ventesStats?.panierMoyen ?? 0),  icon: TrendingUp,   color: 'bg-amber-500',   lightBg: 'bg-amber-50'   },
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

            {/* Filtres */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Référence, client…" value={searchVentes}
                    onChange={e => { setSearchVentes(e.target.value); setPageVentes(1); }}
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm" />
                </div>
                <select value={filterPdvId} onChange={e => { setFilterPdvId(e.target.value); setPageVentes(1); }}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                  <option value="">Tous les PDV</option>
                  {pdvOptions.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
                <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPageVentes(1); }}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                  <option value="">Tous statuts</option>
                  <option value="CONFIRMEE">Confirmées</option>
                  <option value="BROUILLON">Brouillon</option>
                  <option value="ANNULEE">Annulées</option>
                </select>
                <div className="flex gap-2">
                  <input type="date" value={filterDateDebut} onChange={e => setFilterDateDebut(e.target.value)}
                    title="Date de début"
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs" />
                  <input type="date" value={filterDateFin} onChange={e => setFilterDateFin(e.target.value)}
                    title="Date de fin"
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs" />
                </div>
              </div>
            </div>

            {/* Table ventes */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Ventes directes</h3>
                {ventesMeta && (
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                    {ventesMeta.total} vente{ventesMeta.total > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {ventesLoading && !ventesResponse ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Référence', 'Client', 'PDV', 'Produits', 'Montant', 'Mode', 'Statut', 'Date'].map(h => (
                          <th key={h} className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ventes.map(v => {
                        const nom = v.client
                          ? `${v.client.prenom} ${v.client.nom}`
                          : (v.clientNom ?? 'Client anonyme');
                        const parts = nom.split(' ');
                        return (
                          <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-4">
                              <p className="text-sm font-mono font-medium text-slate-700">{v.reference}</p>
                              <p className="text-xs text-slate-400">par {v.vendeur.prenom} {v.vendeur.nom}</p>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                  {initials(parts[parts.length - 1] ?? '', parts[0] ?? '')}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{nom}</p>
                                  <p className="text-xs text-slate-400">{v.client?.telephone ?? v.clientTelephone ?? '—'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-sm text-slate-700">{v.pointDeVente.nom}</p>
                              <p className="text-xs text-slate-400">{v.pointDeVente.code}</p>
                            </td>
                            <td className="px-5 py-4">
                              {v.lignes.map((l, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                                  <Package size={11} className="text-slate-400 shrink-0" />
                                  {l.produit.nom} <span className="text-slate-400">× {l.quantite}</span>
                                </div>
                              ))}
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-base font-bold text-slate-800">{formatCurrency(Number(v.montantTotal))}</p>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                                {MODE_PAIEMENT_LABELS[v.modePaiement] ?? v.modePaiement}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUT_VENTE_BADGE[v.statut] ?? 'bg-slate-100 text-slate-600'}`}>
                                {v.statut === 'CONFIRMEE' && <CheckCircle size={10} />}
                                {v.statut === 'ANNULEE'   && <XCircle size={10} />}
                                {v.statut}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Calendar size={11} className="text-slate-400" />
                                {formatDateTime(v.createdAt)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {ventes.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center">
                            <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-slate-500">Aucune vente directe enregistrée</p>
                            <p className="text-slate-400 text-sm mt-1">Cliquez sur &quot;Nouvelle vente&quot; pour commencer.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {ventesMeta && ventesMeta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Page <span className="font-semibold">{ventesMeta.page}</span> sur <span className="font-semibold">{ventesMeta.totalPages}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPageVentes(p => Math.max(1, p - 1))} disabled={pageVentes <= 1}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors text-sm">
                      Précédent
                    </button>
                    <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm">{pageVentes}</span>
                    <button onClick={() => setPageVentes(p => Math.min(ventesMeta.totalPages, p + 1))} disabled={pageVentes >= ventesMeta.totalPages}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors text-sm">
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ONGLET — LIVRAISONS PACKS (existant)
        ══════════════════════════════════════════════════════════════════ */}
        {!isVentesTab && (
          <>
            {/* Stats packs */}
            <div className="grid grid-cols-4 gap-5">
              {[
                { label: 'Livrées',        value: String(packsStats?.totalLivraisons ?? 0),       icon: CheckCircle, color: 'bg-emerald-500', lightBg: 'bg-emerald-50' },
                { label: 'En attente',     value: String(packsStats?.totalPlanifiees  ?? 0),       icon: Truck,       color: 'bg-orange-500',  lightBg: 'bg-orange-50'  },
                { label: 'Montant total',  value: formatCurrency(packsStats?.montantTotal ?? 0),   icon: TrendingUp,  color: 'bg-blue-500',    lightBg: 'bg-blue-50'    },
                { label: 'Clients servis', value: String(packsStats?.clientsActifs ?? 0),          icon: Users,       color: 'bg-amber-500',   lightBg: 'bg-amber-50'   },
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

            {/* Bannière packs */}
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <Layers className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800">
                Pour créer des packs, gérer les souscriptions et suivre les cycles de paiement, rendez-vous sur la page <strong>Packs clients</strong>.
              </p>
              <Link href="/dashboard/admin/packs"
                className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
                <Layers size={14} /> Gérer les packs
              </Link>
            </div>

            {/* Recherche packs */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Rechercher par client…" value={searchPacks}
                  onChange={e => { setSearchPacks(e.target.value); setPagePacks(1); }}
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
              </div>
            </div>

            {/* Table packs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Livraisons planifiées &amp; effectuées</h3>
                {packsMeta && (
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                    {packsMeta.total} livraison{packsMeta.total > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {packsLoading && !packsResponse ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Client', 'Pack', 'Produits', 'Montant', 'Date prévue / livrée', 'Statut'].map(h => (
                          <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {receptions.map(r => {
                        const c = r.souscription.client;
                        const u = r.souscription.user;
                        const cNom = c ? `${c.prenom} ${c.nom}` : u ? `${u.prenom} ${u.nom}` : '—';
                        const cTel = c?.telephone ?? '—';
                        const montant = r.lignes.reduce((acc, l) => acc + Number(l.prixUnitaire) * l.quantite, 0);
                        const parts = cNom.split(' ');
                        const isPlanifiee = r.statut === 'PLANIFIEE';
                        return (
                          <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${isPlanifiee ? 'bg-orange-50/40' : ''}`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 bg-gradient-to-br ${isPlanifiee ? 'from-orange-400 to-orange-600' : 'from-emerald-400 to-emerald-600'} rounded-full flex items-center justify-center text-white font-semibold shadow-sm`}>
                                  {initials(parts[parts.length - 1] ?? '', parts[0] ?? '')}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800 text-sm">{cNom}</p>
                                  <p className="text-xs text-slate-500">{cTel}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PACK_BADGE[r.souscription.pack.type] ?? 'bg-slate-100 text-slate-600'}`}>
                                {PACK_LABELS[r.souscription.pack.type] ?? r.souscription.pack.type}
                              </span>
                              <p className="text-xs text-slate-500 mt-0.5">{r.souscription.pack.nom}</p>
                            </td>
                            <td className="px-6 py-4">
                              {r.lignes.map((l, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-sm">
                                  <Package size={13} className="text-slate-400 shrink-0" />
                                  <span className="text-slate-700">{l.produit.nom}</span>
                                  <span className="text-slate-400 text-xs">× {l.quantite}</span>
                                </div>
                              ))}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-lg font-bold text-slate-800">{formatCurrency(montant)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Calendar size={13} className="text-slate-400" />
                                {r.dateLivraison ? formatDateTime(r.dateLivraison) : formatDateTime(r.datePrevisionnelle ?? r.createdAt)}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {isPlanifiee ? (
                                <div className="flex flex-col gap-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold w-fit">
                                    <Truck size={10} /> Planifiée
                                  </span>
                                  <button onClick={() => handleConfirmerLivraison(r)}
                                    disabled={confirmingId === r.id || cancellingId === r.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                                    <CheckCircle size={11} />
                                    {confirmingId === r.id ? 'En cours…' : 'Confirmer livraison'}
                                  </button>
                                  <button onClick={() => handleAnnulerLivraison(r.id)}
                                    disabled={cancellingId === r.id || confirmingId === r.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors">
                                    <XCircle size={11} />
                                    {cancellingId === r.id ? 'Annulation…' : 'Annuler'}
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                                  <CheckCircle size={10} /> Livrée
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {receptions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-slate-500">Aucune livraison enregistrée</p>
                            <p className="text-slate-400 text-sm mt-1">Cliquez sur &quot;Planifier une livraison&quot; pour commencer.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {packsMeta && packsMeta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Page <span className="font-semibold">{packsMeta.page}</span> sur <span className="font-semibold">{packsMeta.totalPages}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPagePacks(p => Math.max(1, p - 1))} disabled={pagePacks <= 1}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                      Précédent
                    </button>
                    <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">{pagePacks}</span>
                    <button onClick={() => setPagePacks(p => Math.min(packsMeta.totalPages, p + 1))} disabled={pagePacks >= packsMeta.totalPages}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
