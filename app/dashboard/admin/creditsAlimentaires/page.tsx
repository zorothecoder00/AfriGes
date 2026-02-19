"use client";

import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Download, ShoppingCart, TrendingUp, DollarSign, AlertCircle,
  Eye, Pencil, ArrowLeft, CheckCircle, ChevronRight, XCircle, Info,
} from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStatusStyle, getStatusLabel } from '@/lib/status';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreditAlimentaire {
  id: number;
  plafond: string;
  montantUtilise: string;
  montantRestant: string;
  statut: string;
  source: string;
  sourceId: number;
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

interface CotisationOption {
  id: number;
  montant: string;
  periode: string;
  datePaiement: string | null;
  statut: string;
  client: { id: number; nom: string; prenom: string } | null;
}

interface CotisationsListResponse {
  data: CotisationOption[];
}

interface TontineOption {
  id: number;
  nom: string;
  montantCycle: string;
  frequence: string;
  statut: string;
}

interface TontinesListResponse {
  data: TontineOption[];
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CreditsAlimentairesPage() {
  // Pagination / search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statutFilter, setStatutFilter] = useState('');
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modal – step management
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 – client search
  const [clientSearch, setClientSearch] = useState('');
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [checkingClient, setCheckingClient] = useState(false);

  // Step 2 – credit form
  const [source, setSource] = useState<'COTISATION' | 'TONTINE'>('COTISATION');
  const [sourceId, setSourceId] = useState('');
  const [plafond, setPlafond] = useState('');
  const [plafondLocked, setPlafondLocked] = useState(false); // locked when auto-filled from cotisation
  const [dateExpiration, setDateExpiration] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedClientSearch(clientSearch), 400);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (statutFilter) params.set('statut', statutFilter);

  const { data: response, loading, error, refetch } = useApi<CreditsAlimentairesResponse>(
    `/api/admin/creditsAlimentaires?${params}`
  );
  const credits = response?.data ?? [];
  const stats = response?.stats;
  const meta = response?.meta;

  // Step 1: client live search
  const { data: clientsResponse } = useApi<ClientsListResponse>(
    modalOpen && step === 1 && debouncedClientSearch.length >= 2
      ? `/api/admin/clients?search=${encodeURIComponent(debouncedClientSearch)}&limit=6`
      : null
  );
  const clientsOptions = clientsResponse?.data ?? [];

  // Step 2: client's paid cotisations (only when source = COTISATION)
  const { data: cotisationsData } = useApi<CotisationsListResponse>(
    modalOpen && step === 2 && source === 'COTISATION' && selectedClient
      ? `/api/admin/cotisations?clientId=${selectedClient.id}&statut=PAYEE&limit=50`
      : null
  );
  const cotisations = cotisationsData?.data ?? [];

  // Step 2: active tontines where client is a member (only when source = TONTINE)
  const { data: tontinesData } = useApi<TontinesListResponse>(
    modalOpen && step === 2 && source === 'TONTINE' && selectedClient
      ? `/api/admin/tontines?clientId=${selectedClient.id}`
      : null
  );
  const tontines = tontinesData?.data ?? [];

  // Step 2: client's existing active credits (for duplicate warning)
  const { data: creditsExistants } = useApi<CreditsAlimentairesResponse>(
    modalOpen && step === 2 && selectedClient
      ? `/api/admin/creditsAlimentaires?clientId=${selectedClient.id}&statut=ACTIF&limit=50`
      : null
  );
  // Build set of "source_sourceId" already covered by active credits
  const creditsActifsSet = new Set(
    (creditsExistants?.data ?? []).map(c => `${c.source}_${c.sourceId}`)
  );

  const { mutate: addCredit, loading: adding, error: addError } = useMutation(
    '/api/admin/creditsAlimentaires', 'POST',
    { successMessage: 'Crédit alimentaire créé avec succès' }
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const closeModal = () => {
    setModalOpen(false);
    setStep(1);
    setClientSearch('');
    setSelectedClient(null);
    setCheckingClient(false);
    setSource('COTISATION');
    setSourceId('');
    setPlafond('');
    setPlafondLocked(false);
    setDateExpiration('');
  };

  const handleSelectClient = (client: ClientOption) => {
    setSelectedClient(client);
    setCheckingClient(true);
    // Small delay to show loading state, then move to step 2
    setTimeout(() => {
      setCheckingClient(false);
      setStep(2);
      setSource('COTISATION');
      setSourceId('');
      setPlafond('');
      setPlafondLocked(false);
    }, 300);
  };

  // When a cotisation is selected, auto-fill the plafond
  const handleCotisationSelect = (cotisationId: string) => {
    setSourceId(cotisationId);
    if (cotisationId) {
      const cot = cotisations.find(c => String(c.id) === cotisationId);
      if (cot) {
        setPlafond(cot.montant);
        setPlafondLocked(true);
      }
    } else {
      setPlafond('');
      setPlafondLocked(false);
    }
  };

  // When source changes, reset sourceId and plafond
  const handleSourceChange = (newSource: 'COTISATION' | 'TONTINE') => {
    setSource(newSource);
    setSourceId('');
    setPlafond('');
    setPlafondLocked(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addCredit({
      clientId: selectedClient!.id,
      plafond: Number(plafond),
      source,
      sourceId: Number(sourceId),
      dateExpiration: dateExpiration || undefined,
    });
    if (result) {
      closeModal();
      refetch();
    }
  };

  const getInitials = (nom: string, prenom: string) =>
    `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();

  const getProgression = (utilise: string, plafond: string) => {
    const u = parseFloat(utilise) || 0;
    const p = parseFloat(plafond) || 1;
    return Math.round((u / p) * 100);
  };

  const periodLabel = (p: string) =>
    p === 'MENSUEL' ? 'Mensuel' : p === 'ANNUEL' ? 'Annuel' : p;

  // ── Loading / Error ────────────────────────────────────────────────────────

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
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">
            Reessayer
          </button>
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

  // ── Render ─────────────────────────────────────────────────────────────────

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
            <button
              onClick={() => setModalOpen(true)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium"
            >
              <Plus size={20} />
              Nouveau credit alimentaire
            </button>
          </div>
        </div>

        {/* ── Modal Nouveau Crédit ──────────────────────────────────────────── */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl relative max-h-[90vh] overflow-y-auto">

              {/* Close */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-bold text-lg"
              >
                ×
              </button>

              <h2 className="text-xl font-bold text-slate-800 mb-1">Nouveau crédit alimentaire</h2>
              <p className="text-sm text-slate-500 mb-5">
                {step === 1 ? 'Sélectionnez le bénéficiaire' : 'Configurez le crédit'}
              </p>

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6">
                <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {step > 1 ? <CheckCircle className="w-3.5 h-3.5" /> : '1'}
                  </div>
                  <span className="text-sm font-medium">Bénéficiaire</span>
                </div>
                <ChevronRight className="text-slate-300 w-4 h-4" />
                <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    2
                  </div>
                  <span className="text-sm font-medium">Crédit</span>
                </div>
              </div>

              {addError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <XCircle className="text-red-500 w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-red-700 text-sm">{addError}</p>
                </div>
              )}

              {/* ── ÉTAPE 1 : Recherche du bénéficiaire ── */}
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
                        }}
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Loading */}
                  {checkingClient && (
                    <div className="flex items-center gap-3 py-3 text-slate-500 text-sm">
                      <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin shrink-0"></div>
                      Chargement...
                    </div>
                  )}

                  {/* Client list */}
                  {!checkingClient && clientsOptions.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      {clientsOptions.map((client, idx) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => handleSelectClient(client)}
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

                  {/* No results */}
                  {!checkingClient && debouncedClientSearch.length >= 2 && clientsOptions.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-4">Aucun client trouvé</p>
                  )}

                  {debouncedClientSearch.length < 2 && (
                    <p className="text-center text-slate-400 text-xs py-1">
                      Saisissez au moins 2 caractères pour rechercher
                    </p>
                  )}
                </div>
              )}

              {/* ── ÉTAPE 2 : Configuration du crédit ── */}
              {step === 2 && selectedClient && (
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
                        setSelectedClient(null);
                        setSourceId('');
                        setPlafond('');
                        setPlafondLocked(false);
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-medium underline underline-offset-2"
                    >
                      Changer
                    </button>
                  </div>

                  {/* Source du crédit */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Source du crédit
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSourceChange('COTISATION')}
                        className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${source === 'COTISATION' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                      >
                        Cotisation
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSourceChange('TONTINE')}
                        className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${source === 'TONTINE' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                      >
                        Tontine
                      </button>
                    </div>
                  </div>

                  {/* COTISATION – liste des cotisations payées du client */}
                  {source === 'COTISATION' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Cotisation payée associée
                      </label>
                      {cotisations.length === 0 ? (
                        <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
                          <AlertCircle className="text-orange-500 w-4 h-4 mt-0.5 shrink-0" />
                          <p className="text-orange-700 text-sm">
                            {selectedClient.prenom} {selectedClient.nom} n&apos;a aucune cotisation payée.
                            Un crédit par cotisation ne peut être accordé qu&apos;à un client ayant effectivement cotisé.
                          </p>
                        </div>
                      ) : (
                        <select
                          required
                          value={sourceId}
                          onChange={e => handleCotisationSelect(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Sélectionner une cotisation</option>
                          {cotisations.map(c => {
                            const alreadyCovered = creditsActifsSet.has(`COTISATION_${c.id}`);
                            return (
                              <option key={c.id} value={c.id} disabled={alreadyCovered}>
                                #{c.id} – {formatCurrency(c.montant)} ({periodLabel(c.periode)})
                                {alreadyCovered ? ' ⚠ crédit actif' : ''}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                  )}

                  {/* TONTINE – liste des tontines actives où le client est membre */}
                  {source === 'TONTINE' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Tontine active associée
                      </label>
                      {tontines.length === 0 ? (
                        <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
                          <AlertCircle className="text-orange-500 w-4 h-4 mt-0.5 shrink-0" />
                          <p className="text-orange-700 text-sm">
                            {selectedClient.prenom} {selectedClient.nom} n&apos;est membre d&apos;aucune tontine active.
                            Un crédit par tontine ne peut être accordé qu&apos;à un membre actif d&apos;une tontine en cours.
                          </p>
                        </div>
                      ) : (
                        <select
                          required
                          value={sourceId}
                          onChange={e => setSourceId(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Sélectionner une tontine</option>
                          {tontines.map(t => {
                            const alreadyCovered = creditsActifsSet.has(`TONTINE_${t.id}`);
                            return (
                              <option key={t.id} value={t.id} disabled={alreadyCovered}>
                                {t.nom} – {formatCurrency(t.montantCycle)}/{t.frequence === 'MENSUEL' ? 'mois' : 'sem.'}
                                {alreadyCovered ? ' ⚠ crédit actif' : ''}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Plafond */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Plafond du crédit (FCFA)
                      {plafondLocked && (
                        <span className="ml-2 text-xs text-emerald-600 font-normal">
                          <Info className="inline w-3 h-3 mr-0.5" />
                          Auto-rempli depuis la cotisation
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      placeholder="Ex : 100 000"
                      required
                      min="1"
                      step="1"
                      value={plafond}
                      onChange={e => {
                        setPlafond(e.target.value);
                        setPlafondLocked(false);
                      }}
                      className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 ${plafondLocked ? 'bg-emerald-50 border-emerald-200' : ''}`}
                    />
                  </div>

                  {/* Date d'expiration */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Date d&apos;expiration{' '}
                      <span className="text-slate-400 font-normal">(optionnel)</span>
                    </label>
                    <input
                      type="date"
                      value={dateExpiration}
                      onChange={e => setDateExpiration(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
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
                      disabled={adding || (source === 'COTISATION' && cotisations.length === 0) || (source === 'TONTINE' && tontines.length === 0)}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium text-sm disabled:opacity-60"
                    >
                      {adding ? 'Création...' : 'Créer le crédit'}
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
                            <span className="font-semibold text-slate-800">
                              {credit.client?.prenom} {credit.client?.nom}
                            </span>
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
                        <span className="text-sm text-slate-600">
                          {credit.dateExpiration ? formatDate(credit.dateExpiration) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusStyle(credit.statut)}`}>
                          {getStatusLabel(credit.statut)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/admin/creditsAlimentaires/${credit.id}`}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Eye size={16} />
                          </Link>
                          <Link
                            href={`/dashboard/admin/creditsAlimentaires/${credit.id}/edit`}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {credits.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      Aucun credit alimentaire trouve
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
                <span className="font-semibold">{meta.totalPages}</span> ({meta.total} credits)
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
