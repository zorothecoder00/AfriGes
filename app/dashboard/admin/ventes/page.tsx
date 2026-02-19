"use client";

import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Download, ShoppingCart, TrendingUp, DollarSign,
  Users, Calendar, Eye, MoreVertical, Package, ArrowLeft,
  CheckCircle, XCircle, ChevronRight, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDateTime } from '@/lib/format';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface ClientOption {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
}

interface ClientsListResponse {
  data: ClientOption[];
}

interface ActiveCreditOption {
  id: number;
  plafond: string;
  montantRestant: string;
  montantUtilise: string;
  statut: string;
  source: string; // "COTISATION" | "TONTINE"
  dateExpiration: string | null;
}

interface EligibiliteResponse {
  eligible: boolean;
  credits: ActiveCreditOption[];
  client: ClientOption;
  hasCotisationPayee: boolean;
  hasActiveTontine: boolean;
  raisons: string[];
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function VentesPage() {
  // Pagination / search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({ creditAlimentaireId: '', produitId: '', quantite: '1' });

  // Step 1 – client search
  const [clientSearch, setClientSearch] = useState('');
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [eligibilite, setEligibilite] = useState<EligibiliteResponse | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibiliteError, setEligibiliteError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedClientSearch(clientSearch), 400);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data: response, loading, error, refetch } = useApi<VentesResponse>(`/api/admin/ventes?${params}`);
  const ventes = response?.data ?? [];
  const stats = response?.stats;
  const meta = response?.meta;

  // Client search (step 1)
  const { data: clientsResponse } = useApi<ClientsListResponse>(
    modalOpen && step === 1 && debouncedClientSearch.length >= 2
      ? `/api/admin/clients?search=${encodeURIComponent(debouncedClientSearch)}&limit=6`
      : null
  );
  const clientsOptions = clientsResponse?.data ?? [];

  // Products (step 2)
  const { data: produitsResponse } = useApi<ProduitsListResponse>(
    modalOpen ? '/api/admin/stock?limit=200' : null
  );
  const produits = (produitsResponse?.data ?? []).filter(p => p.stock > 0);

  const { mutate: addVente, loading: adding, error: addError } = useMutation(
    '/api/admin/ventes', 'POST',
    { successMessage: 'Vente enregistrée avec succès' }
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const closeModal = () => {
    setModalOpen(false);
    setStep(1);
    setClientSearch('');
    setSelectedClient(null);
    setEligibilite(null);
    setEligibiliteError(null);
    setFormData({ creditAlimentaireId: '', produitId: '', quantite: '1' });
  };

  const checkEligibility = async (client: ClientOption) => {
    setSelectedClient(client);
    setCheckingEligibility(true);
    setEligibilite(null);
    setEligibiliteError(null);

    try {
      const res = await fetch(`/api/admin/clients/${client.id}/eligibilite`);
      const data: EligibiliteResponse = await res.json();

      if (!res.ok) {
        setEligibiliteError((data as unknown as { error: string }).error || 'Erreur lors de la vérification');
        return;
      }

      setEligibilite(data);

      if (data.eligible) {
        setStep(2);
        // Auto-sélectionner le crédit s'il n'y en a qu'un seul
        if (data.credits.length === 1) {
          setFormData(f => ({ ...f, creditAlimentaireId: String(data.credits[0].id) }));
        }
      }
    } catch {
      setEligibiliteError('Erreur réseau lors de la vérification');
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addVente({
      creditAlimentaireId: Number(formData.creditAlimentaireId),
      produitId: Number(formData.produitId),
      quantite: Number(formData.quantite),
    });
    if (result) {
      closeModal();
      refetch();
    }
  };

  const getInitials = (nom: string, prenom: string) =>
    `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();

  const sourceLabel = (source: string) =>
    source === 'COTISATION' ? 'Cotisation' : 'Tontine';

  const panierMoyen =
    stats && stats.totalVentes > 0
      ? Number(stats.montantTotal) / stats.totalVentes
      : 0;

  // ── Loading / Error screens ────────────────────────────────────────────────

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
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">
            Reessayer
          </button>
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

  // ── Render ─────────────────────────────────────────────────────────────────

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
            <button
              onClick={() => setModalOpen(true)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium"
            >
              <Plus size={20} />
              Nouvelle vente
            </button>
          </div>
        </div>

        {/* ── Modal Nouvelle Vente ──────────────────────────────────────────── */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl relative">

              {/* Close */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-bold text-lg"
              >
                ×
              </button>

              <h2 className="text-xl font-bold text-slate-800 mb-1">Nouvelle vente</h2>
              <p className="text-sm text-slate-500 mb-5">
                {step === 1 ? 'Sélectionnez un client éligible' : 'Choisissez le produit à vendre'}
              </p>

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6">
                <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {step > 1 ? <CheckCircle className="w-3.5 h-3.5" /> : '1'}
                  </div>
                  <span className="text-sm font-medium">Client</span>
                </div>
                <ChevronRight className="text-slate-300 w-4 h-4" />
                <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    2
                  </div>
                  <span className="text-sm font-medium">Produit</span>
                </div>
              </div>

              {addError && (
                <p className="text-red-500 mb-3 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{addError}</p>
              )}

              {/* ── ÉTAPE 1 : Recherche client ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Rechercher un client
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Nom, prénom ou téléphone..."
                        value={clientSearch}
                        onChange={e => {
                          setClientSearch(e.target.value);
                          setSelectedClient(null);
                          setEligibilite(null);
                          setEligibiliteError(null);
                        }}
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Vérification en cours */}
                  {checkingEligibility && (
                    <div className="flex items-center gap-3 py-3 text-slate-500 text-sm">
                      <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin shrink-0"></div>
                      Vérification de l&apos;éligibilité...
                    </div>
                  )}

                  {/* Liste des clients */}
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
                          <ChevronRight className="text-slate-300 group-hover:text-emerald-500 w-4 h-4 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Aucun résultat */}
                  {!checkingEligibility && debouncedClientSearch.length >= 2 && clientsOptions.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-4">Aucun client trouvé</p>
                  )}

                  {/* Erreur réseau */}
                  {eligibiliteError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                      <XCircle className="text-red-500 w-4 h-4 mt-0.5 shrink-0" />
                      <p className="text-red-700 text-sm">{eligibiliteError}</p>
                    </div>
                  )}

                  {/* Client non éligible */}
                  {!checkingEligibility && selectedClient && eligibilite && !eligibilite.eligible && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="text-orange-500 w-4 h-4 shrink-0" />
                        <p className="font-semibold text-orange-800 text-sm">
                          {selectedClient.prenom} {selectedClient.nom} — non éligible
                        </p>
                      </div>
                      <ul className="space-y-1">
                        {eligibilite.raisons.map((r, i) => (
                          <li key={i} className="text-xs text-orange-700 leading-relaxed">• {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Aide */}
                  {debouncedClientSearch.length < 2 && (
                    <p className="text-center text-slate-400 text-xs py-1">
                      Saisissez au moins 2 caractères pour rechercher
                    </p>
                  )}
                </div>
              )}

              {/* ── ÉTAPE 2 : Crédit + Produit + Quantité ── */}
              {step === 2 && selectedClient && eligibilite && (
                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* Client sélectionné */}
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-emerald-500 w-4 h-4 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">
                          {selectedClient.prenom} {selectedClient.nom}
                        </p>
                        <p className="text-xs text-slate-500">{selectedClient.telephone}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setEligibilite(null);
                        setSelectedClient(null);
                        setFormData({ creditAlimentaireId: '', produitId: '', quantite: '1' });
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-medium underline underline-offset-2"
                    >
                      Changer
                    </button>
                  </div>

                  {/* Crédit alimentaire */}
                  {eligibilite.credits.length === 1 ? (
                    // Un seul crédit → afficher l'info (déjà auto-sélectionné)
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                      <p className="text-xs font-medium text-slate-500 mb-0.5">Crédit alimentaire disponible</p>
                      <p className="text-xl font-bold text-slate-800">{formatCurrency(eligibilite.credits[0].montantRestant)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Source : {sourceLabel(eligibilite.credits[0].source)}
                        {eligibilite.credits[0].dateExpiration && (
                          <> · Expire le {new Date(eligibilite.credits[0].dateExpiration).toLocaleDateString('fr-FR')}</>
                        )}
                      </p>
                    </div>
                  ) : (
                    // Plusieurs crédits → dropdown
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Crédit alimentaire à utiliser
                      </label>
                      <select
                        required
                        value={formData.creditAlimentaireId}
                        onChange={e => setFormData({ ...formData, creditAlimentaireId: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Sélectionner un crédit</option>
                        {eligibilite.credits.map(c => (
                          <option key={c.id} value={c.id}>
                            {sourceLabel(c.source)} – Solde : {formatCurrency(c.montantRestant)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Produit */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Produit</label>
                    <select
                      required
                      value={formData.produitId}
                      onChange={e => setFormData({ ...formData, produitId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Sélectionner un produit</option>
                      {produits.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nom} – {formatCurrency(p.prixUnitaire)} (Stock : {p.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantité */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantité</label>
                    <input
                      type="number"
                      placeholder="Ex : 3"
                      required
                      min="1"
                      value={formData.quantite}
                      onChange={e => setFormData({ ...formData, quantite: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Boutons */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-medium text-sm"
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      disabled={adding}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium text-sm disabled:opacity-60"
                    >
                      {adding ? 'Enregistrement...' : 'Enregistrer la vente'}
                    </button>
                  </div>
                </form>
              )}
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
                            <span className="font-semibold text-slate-800">
                              {vente.creditAlimentaire.member.prenom} {vente.creditAlimentaire.member.nom}
                            </span>
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
                          <Link
                            href={`/dashboard/admin/ventes/${vente.id}`}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
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
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      Aucune vente trouvee
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{meta.page}</span> sur{' '}
                <span className="font-semibold">{meta.totalPages}</span> ({meta.total} ventes)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Precedent
                </button>
                <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">{page}</span>
                <button
                  onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
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
