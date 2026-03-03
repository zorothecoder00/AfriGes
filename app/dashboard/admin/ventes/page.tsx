"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Download, ShoppingCart, TrendingUp, DollarSign,
  Users, Calendar, CheckCircle, XCircle, ChevronRight, AlertCircle,
  Layers, Truck, ArrowLeft, Package,
} from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { exportToCsv } from '@/lib/exportCsv';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LigneReception {
  id: number;
  quantite: number;
  prixUnitaire: string;
  produit: { nom: string };
}

interface Reception {
  id: number;
  statut: 'PLANIFIEE' | 'LIVREE' | 'ANNULEE';
  dateLivraison?: string;
  datePrevisionnelle?: string;
  livreurNom?: string;
  createdAt: string;
  souscription: {
    id: number;
    pack: { nom: string; type: string };
    client?: { nom: string; prenom: string; telephone: string };
    user?:   { nom: string; prenom: string };
  };
  lignes: LigneReception[];
}

interface ReceptionsResponse {
  receptions: Reception[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  stats: { totalLivraisons: number; totalPlanifiees: number; montantTotal: number; clientsActifs: number; ceMois: number };
}

interface ClientOption { id: number; nom: string; prenom: string; telephone: string; }

interface SouscriptionActive {
  id: number;
  pack: { nom: string; type: string };
  statut: string;
  montantTotal: number; montantVerse: number; montantRestant: number;
  formuleRevendeur?: string;
}

interface EligibilitePackResponse {
  eligible: boolean;
  souscriptions: SouscriptionActive[];
  client: ClientOption;
  raisons: string[];
}

interface ProduitOption { id: number; nom: string; prixUnitaire: string; stock: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PACK_LABELS: Record<string, string> = {
  ALIMENTAIRE: 'Alimentaire', REVENDEUR: 'Revendeur', FAMILIAL: 'Familial',
  URGENCE: 'Urgence', EPARGNE_PRODUIT: 'Épargne-Produit', FIDELITE: 'Fidélité',
};

const PACK_BADGE: Record<string, string> = {
  ALIMENTAIRE: 'bg-green-100 text-green-800', REVENDEUR: 'bg-blue-100 text-blue-800',
  FAMILIAL: 'bg-purple-100 text-purple-800', URGENCE: 'bg-red-100 text-red-800',
  EPARGNE_PRODUIT: 'bg-amber-100 text-amber-800', FIDELITE: 'bg-pink-100 text-pink-800',
};

function clientNom(r: Reception) {
  const c = r.souscription.client;
  const u = r.souscription.user;
  return c ? `${c.prenom} ${c.nom}` : u ? `${u.prenom} ${u.nom}` : '—';
}
function clientTel(r: Reception) {
  return r.souscription.client?.telephone ?? '—';
}
function initials(nom: string, prenom: string) {
  return `${(prenom?.[0] ?? '').toUpperCase()}${(nom?.[0] ?? '').toUpperCase()}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VentesPage() {
  const [searchQuery, setSearchQuery]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Modal
  const [modalOpen, setModalOpen]   = useState(false);
  const [step, setStep]             = useState<1 | 2>(1);

  // Step 1 – recherche client
  const [clientSearch, setClientSearch]           = useState('');
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('');
  const [selectedClient, setSelectedClient]       = useState<ClientOption | null>(null);
  const [eligibilitePack, setEligibilitePack]     = useState<EligibilitePackResponse | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibiliteError, setEligibiliteError]   = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientSearch(clientSearch), 400);
    return () => clearTimeout(t);
  }, [clientSearch]);

  // Step 2 – formulaire
  const [formPack, setFormPack] = useState({ souscriptionId: '', produitId: '', quantite: '1' });

  // Confirmation livraison (PLANIFIEE → LIVREE)
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  // Annulation livraison (PLANIFIEE → ANNULEE)
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data: response, loading, error, refetch } = useApi<ReceptionsResponse>(
    `/api/admin/packs/receptions?${params}`
  );
  const receptions = response?.receptions ?? [];
  const stats      = response?.stats;
  const meta       = response?.meta;

  const handleExport = () => {
    const rows = receptions.map((r) => ({
      id:       r.id,
      pack:     r.souscription.pack.nom,
      type:     PACK_LABELS[r.souscription.pack.type] ?? r.souscription.pack.type,
      client:   r.souscription.client
        ? `${r.souscription.client.prenom} ${r.souscription.client.nom}`
        : r.souscription.user
          ? `${r.souscription.user.prenom} ${r.souscription.user.nom}`
          : "—",
      statut:   r.statut,
      montant:  r.lignes.reduce((s, l) => s + l.quantite * Number(l.prixUnitaire), 0),
      date:     r.dateLivraison ?? r.datePrevisionnelle ?? r.createdAt,
      livreur:  r.livreurNom ?? "—",
    }));
    exportToCsv(
      rows,
      [
        { label: "ID",       key: "id" },
        { label: "Pack",     key: "pack" },
        { label: "Type",     key: "type" },
        { label: "Client",   key: "client" },
        { label: "Statut",   key: "statut" },
        { label: "Montant",  key: "montant", format: (v) => formatCurrency(Number(v)) },
        { label: "Date",     key: "date",    format: (v) => formatDateTime(String(v)) },
        { label: "Livreur",  key: "livreur" },
      ],
      "livraisons.csv"
    );
  };

  const { data: clientsResponse } = useApi<{ data: ClientOption[] }>(
    modalOpen && step === 1 && debouncedClientSearch.length >= 2
      ? `/api/admin/clients?search=${encodeURIComponent(debouncedClientSearch)}&limit=6`
      : null
  );
  const clientsOptions = clientsResponse?.data ?? [];

  const { data: produitsResponse } = useApi<{ data: ProduitOption[] }>(
    modalOpen && step === 2 ? '/api/admin/stock?limit=200' : null
  );
  const produits = (produitsResponse?.data ?? []).filter(p => p.stock > 0);

  // Mutation planification livraison
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

  // ── Handlers ────────────────────────────────────────────────────────────────

  const closeModal = () => {
    setModalOpen(false);
    setStep(1);
    setClientSearch('');
    setSelectedClient(null);
    setEligibilitePack(null);
    setEligibiliteError(null);
    setFormPack({ souscriptionId: '', produitId: '', quantite: '1' });
  };

  const checkEligibility = async (client: ClientOption) => {
    setSelectedClient(client);
    setCheckingEligibility(true);
    setEligibilitePack(null);
    setEligibiliteError(null);
    try {
      const res  = await fetch(`/api/admin/clients/${client.id}/eligibilite-pack`);
      const data: EligibilitePackResponse = await res.json();
      if (!res.ok) { setEligibiliteError((data as unknown as { error: string }).error || 'Erreur'); return; }
      setEligibilitePack(data);
      if (data.eligible) {
        setStep(2);
        if (data.souscriptions.length === 1) {
          setFormPack(f => ({ ...f, souscriptionId: String(data.souscriptions[0].id) }));
        }
      }
    } catch { setEligibiliteError('Erreur réseau'); }
    finally { setCheckingEligibility(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPack.souscriptionId || !formPack.produitId) return;
    const produit = produits.find(p => p.id === parseInt(formPack.produitId));
    if (!produit) return;
    const qte = parseInt(formPack.quantite);
    if (qte > produit.stock) return; // sécurité frontend

    const res = await addVente({
      action: 'planifier',
      lignes: [{
        produitId:    parseInt(formPack.produitId),
        quantite:     qte,
        prixUnitaire: parseFloat(produit.prixUnitaire),
      }],
      notes: `Livraison planifiée — ${produit.nom} × ${formPack.quantite}`,
    });
    if (res) { closeModal(); refetch(); }
  };

  const handleConfirmerLivraison = async (reception: Reception) => {
    if (confirmingId) return;
    confirmingSouscriptionIdRef.current = reception.souscription.id;
    setConfirmingId(reception.id);
    const res = await doConfirmer({ action: 'livrer', receptionId: reception.id });
    if (res) { refetch(); }
    setConfirmingId(null);
  };

  const handleAnnulerLivraison = async (receptionId: number) => {
    if (cancellingId) return;
    cancellingIdRef.current = receptionId;
    setCancellingId(receptionId);
    const res = await doAnnuler({});
    if (res) { refetch(); }
    setCancellingId(null);
  };

  // ── Loading / Error ──────────────────────────────────────────────────────────

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement des ventes…</p>
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
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">Réessayer</button>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Livrées',          value: String(stats?.totalLivraisons ?? 0), icon: CheckCircle, color: 'bg-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'En attente',       value: String(stats?.totalPlanifiees  ?? 0), icon: Truck,       color: 'bg-orange-500',  lightBg: 'bg-orange-50'  },
    { label: 'Montant total',    value: formatCurrency(stats?.montantTotal ?? 0), icon: TrendingUp, color: 'bg-blue-500',    lightBg: 'bg-blue-50'    },
    { label: 'Clients servis',   value: String(stats?.clientsActifs ?? 0),    icon: Users,       color: 'bg-amber-500',   lightBg: 'bg-amber-50'   },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

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
              <p className="text-slate-500">Livraisons de produits aux clients via pack</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleExport} className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} /> Exporter
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium"
            >
              <Plus size={20} /> Planifier une livraison
            </button>
          </div>
        </div>

        {/* ── Modal Nouvelle Vente ──────────────────────────────────────────── */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl relative">
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg font-bold text-lg"
              >×</button>

              <h2 className="text-xl font-bold text-slate-800 mb-1">Planifier une livraison</h2>
              <p className="text-sm text-slate-500 mb-5">
                {step === 1 ? 'Recherchez un client éligible' : 'Choisissez le produit à planifier'}
              </p>

              {/* Steps */}
              <div className="flex items-center gap-2 mb-5">
                {[{ n: 1, label: 'Client' }, { n: 2, label: 'Produit' }].map(({ n, label }) => (
                  <React.Fragment key={n}>
                    <div className={`flex items-center gap-1.5 ${step >= n ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > n ? 'bg-emerald-600 text-white' : step === n ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {step > n ? <CheckCircle className="w-3.5 h-3.5" /> : n}
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

              {/* ── Étape 1 : Recherche client ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Nom, prénom ou téléphone…"
                      value={clientSearch}
                      onChange={e => {
                        setClientSearch(e.target.value);
                        setSelectedClient(null);
                        setEligibilitePack(null);
                        setEligibiliteError(null);
                      }}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    />
                  </div>

                  {checkingEligibility && (
                    <div className="flex items-center gap-3 py-3 text-slate-500 text-sm">
                      <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin shrink-0" />
                      Vérification en cours…
                    </div>
                  )}

                  {!checkingEligibility && clientsOptions.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      {clientsOptions.map((client, idx) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => checkEligibility(client)}
                          className={`w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors flex items-center justify-between group ${idx < clientsOptions.length - 1 ? 'border-b border-slate-100' : ''}`}
                        >
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{client.prenom} {client.nom}</p>
                            <p className="text-xs text-slate-500">{client.telephone}</p>
                          </div>
                          <ChevronRight className="text-slate-300 group-hover:text-emerald-500 w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  )}

                  {!checkingEligibility && debouncedClientSearch.length >= 2 && clientsOptions.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-4">Aucun client trouvé</p>
                  )}

                  {eligibiliteError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                      <XCircle className="text-red-500 w-4 h-4 mt-0.5 shrink-0" />
                      <p className="text-red-700 text-sm">{eligibiliteError}</p>
                    </div>
                  )}

                  {/* Client sans souscription active */}
                  {!checkingEligibility && selectedClient && eligibilitePack && !eligibilitePack.eligible && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="text-orange-500 w-4 h-4 shrink-0" />
                        <p className="font-semibold text-orange-800 text-sm">
                          {selectedClient.prenom} {selectedClient.nom} — aucun pack actif
                        </p>
                      </div>
                      {eligibilitePack.raisons.map((r, i) => (
                        <p key={i} className="text-xs text-orange-700 leading-relaxed">• {r}</p>
                      ))}
                      <Link href="/dashboard/admin/packs" className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors">
                        <Layers size={12} /> Gérer les packs
                      </Link>
                    </div>
                  )}

                  {debouncedClientSearch.length < 2 && (
                    <p className="text-center text-slate-400 text-xs py-1">Saisissez au moins 2 caractères</p>
                  )}
                </div>
              )}

              {/* ── Étape 2 : Produit ── */}
              {step === 2 && selectedClient && eligibilitePack && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Client */}
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-emerald-500 w-4 h-4 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{selectedClient.prenom} {selectedClient.nom}</p>
                        <p className="text-xs text-slate-500">{selectedClient.telephone}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setStep(1); setEligibilitePack(null); setSelectedClient(null); setFormPack({ souscriptionId: '', produitId: '', quantite: '1' }); }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-medium underline underline-offset-2"
                    >Changer</button>
                  </div>

                  {/* Pack / Souscription */}
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
                      <select
                        required
                        value={formPack.souscriptionId}
                        onChange={e => setFormPack(f => ({ ...f, souscriptionId: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Sélectionner un pack</option>
                        {eligibilitePack.souscriptions.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.pack.nom} — {PACK_LABELS[s.pack.type] ?? s.pack.type} ({s.statut})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Produit */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Produit *</label>
                    <select
                      required
                      value={formPack.produitId}
                      onChange={e => setFormPack(f => ({ ...f, produitId: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Sélectionner un produit</option>
                      {produits.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nom} — {formatCurrency(p.prixUnitaire)} (Stock : {p.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantité */}
                  {(() => {
                    const selectedProduit = produits.find(p => p.id === parseInt(formPack.produitId));
                    const qte = parseInt(formPack.quantite) || 0;
                    const stockDispo = selectedProduit?.stock ?? Infinity;
                    const stockDepasse = qte > stockDispo;
                    return (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantité</label>
                        <input
                          type="number" min="1"
                          max={selectedProduit ? selectedProduit.stock : undefined}
                          required
                          value={formPack.quantite}
                          onChange={e => setFormPack(f => ({ ...f, quantite: e.target.value }))}
                          className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 ${stockDepasse ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                        />
                        {selectedProduit && (
                          <p className="text-xs mt-1 text-slate-400">
                            Stock disponible : <span className="font-semibold text-slate-600">{selectedProduit.stock}</span>
                          </p>
                        )}
                        {stockDepasse && (
                          <p className="text-xs text-red-600 mt-0.5 font-medium">
                            Quantité supérieure au stock disponible ({stockDispo})
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm transition-colors">
                      Retour
                    </button>
                    <button
                      type="submit"
                      disabled={adding || (() => {
                        const p = produits.find(x => x.id === parseInt(formPack.produitId));
                        return !!p && parseInt(formPack.quantite) > p.stock;
                      })()}
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

        {/* Stats */}
        <div className="grid grid-cols-4 gap-5">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
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

        {/* Lien vers packs */}
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <Layers className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">
            Pour créer des packs, gérer les souscriptions et suivre les cycles de paiement, rendez-vous sur la page <strong>Packs clients</strong>.
          </p>
          <Link href="/dashboard/admin/packs" className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
            <Layers size={14} /> Gérer les packs
          </Link>
        </div>

        {/* Recherche */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher par client…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Tableau des ventes */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Livraisons planifiées &amp; effectuées</h3>
            {meta && (
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                {meta.total} livraison{meta.total > 1 ? 's' : ''}
              </span>
            )}
          </div>
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
                  const montant = r.lignes.reduce((acc, l) => acc + Number(l.prixUnitaire) * l.quantite, 0);
                  const cNom = clientNom(r);
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
                            <p className="text-xs text-slate-500">{clientTel(r)}</p>
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
                        {/* Statut + action */}
                        {isPlanifiee ? (
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold w-fit">
                              <Truck size={10} /> Planifiée
                            </span>
                            <button
                              onClick={() => handleConfirmerLivraison(r)}
                              disabled={confirmingId === r.id || cancellingId === r.id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              <CheckCircle size={11} />
                              {confirmingId === r.id ? 'En cours…' : 'Confirmer livraison'}
                            </button>
                            <button
                              onClick={() => handleAnnulerLivraison(r.id)}
                              disabled={cancellingId === r.id || confirmingId === r.id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                            >
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

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{meta.page}</span> sur <span className="font-semibold">{meta.totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                  Précédent
                </button>
                <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">{page}</span>
                <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
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
