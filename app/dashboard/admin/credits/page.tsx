"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Search, RefreshCw, CreditCard, AlertCircle, CheckCircle2, XCircle,
  Wallet, ChevronLeft, ChevronRight, X, TrendingDown, Loader2,
  Eye, Ban, BadgeCheck, Banknote, Calendar, Clock, User, ChevronDown, ChevronUp,
  Plus, Trash, Info, Receipt, PackageCheck, ArrowLeftRight,
} from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { useT } from '@/contexts/AppSettingsContext';
import ClienteleTabBar from '@/components/ClienteleTabBar';
import FactureModal from '@/components/FactureModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditClient {
  id: number;
  reference: string;
  statut: string;
  montantTotal: string | number;
  montantRembourse: string | number;
  soldeRestant: string | number;
  dureeJours: number;
  dateDebut: string;
  dateEcheanceFin: string;
  montantJournalier: string | number;
  tauxPenalite: string | number;
  garantie: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: number; nom: string; prenom: string; codeClient: string | null; telephone: string };
  creePar: { id: number; nom: string; prenom: string };
  validePar: { id: number; nom: string; prenom: string } | null;
  dateValidation: string | null;
  _count: { lignes: number; echeances: number; remboursements: number };
}

interface CreditsResponse {
  data: CreditClient[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface LigneCreditDetail {
  id: number;
  produitNom: string;
  quantite: number;
  prixUnitaire: string | number;
  remise: string | number;
  montantLigne: string | number;
  statut: string;
  estNouveauProduit: boolean;
  produitNomSaisi: string | null;
  notes: string | null;
  dateTraitement: string | null;
  produit: { id: number; nom: string } | null;
  produitSubstitut: { id: number; nom: string } | null;
  traitePar: { id: number; nom: string; prenom: string } | null;
}

interface CreditDetail extends CreditClient {
  lignes: LigneCreditDetail[];
  echeances: { id: number; numeroEcheance: number; dateEcheance: string; montantDu: string | number; montantPaye: string | number; statut: string; penalite: string | number }[];
  remboursements: { id: number; montant: string | number; dateRemboursement: string; modePaiement: string; notes: string | null; enregistrePar: { id: number; nom: string; prenom: string } }[];
}

// ─── Types création crédit ────────────────────────────────────────────────────

interface PDVOption { id: number; nom: string; code: string; type: string }

interface CreditLigne {
  produitId: number | null;
  produitNom: string;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  stockDisponible: number;
}

interface StockPdvItem {
  produitId: number;
  pointDeVenteId: number;
  quantite: number;
  produit: { id: number; nom: string; reference: string | null; prixUnitaire: string | number; unite: string | null };
  pointDeVente: { id: number; nom: string; code: string };
}

interface EligibiliteData {
  eligible: boolean;
  raisons: string[];
  alertes: string[];
  tauxUtilisation: number | null;
  creditsActifs: { id: number; reference: string; statut: string; montantTotal: string | number; soldeRestant: string | number }[];
  client: { limiteCredit: string | number | null; soldeActuel: string | number | null };
}

// ─── Helpers visuels ──────────────────────────────────────────────────────────

const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE_VALIDATION: 'bg-amber-100 text-amber-700 border border-amber-200',
  VALIDE:    'bg-blue-100 text-blue-700 border border-blue-200',
  ACTIF:     'bg-emerald-100 text-emerald-700 border border-emerald-200',
  EN_RETARD: 'bg-red-100 text-red-700 border border-red-200',
  SOLDE:     'bg-gray-100 text-gray-600 border border-gray-200',
  ANNULE:    'bg-gray-50 text-gray-400 border border-gray-200',
  REJETE:    'bg-red-50 text-red-400 border border-red-100',
};
const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE_VALIDATION: 'En attente',
  VALIDE:    'Validé',
  ACTIF:     'Actif',
  EN_RETARD: 'En retard',
  SOLDE:     'Soldé',
  ANNULE:    'Annulé',
  REJETE:    'Rejeté',
};
const ECHEANCE_STYLE: Record<string, string> = {
  EN_ATTENTE: 'bg-amber-50 text-amber-600',
  PARTIEL:    'bg-blue-50 text-blue-600',
  PAYE:       'bg-emerald-50 text-emerald-600',
  EN_RETARD:  'bg-red-50 text-red-600',
};

const LIGNE_STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE:   'bg-amber-100 text-amber-700',
  LIVRE:        'bg-emerald-100 text-emerald-700',
  INDISPONIBLE: 'bg-orange-100 text-orange-700',
  SUBSTITUE:    'bg-blue-100 text-blue-700',
  ANNULE:       'bg-gray-100 text-gray-500',
};
const LIGNE_STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE:   'En attente',
  LIVRE:        'Livré',
  INDISPONIBLE: 'Indisponible',
  SUBSTITUE:    'Substitué',
  ANNULE:       'Annulé',
};

const MODE_PAIEMENT_OPTIONS = [
  { value: 'ESPECES',      label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'VIREMENT',     label: 'Virement' },
  { value: 'CHEQUE',       label: 'Chèque' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreditsPage() {
  // ── Filtres ────────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statut,      setStatut]      = useState('');
  const [page,        setPage]        = useState(1);
  const LIMIT = 20;

  // ── État modals ────────────────────────────────────────────────────────────
  const [detailCredit,    setDetailCredit]    = useState<CreditDetail | null>(null);
  const [detailLoading,   setDetailLoading]   = useState(false);
  const [showEcheances,   setShowEcheances]   = useState(false);
  const [factureId,       setFactureId]       = useState<number | null>(null);

  const [modalRembOpen,   setModalRembOpen]   = useState(false);
  const [rembCreditId,    setRembCreditId]    = useState<number | null>(null);
  const [rembMontant,     setRembMontant]     = useState('');
  const [rembMode,        setRembMode]        = useState('ESPECES');
  const [rembNotes,       setRembNotes]       = useState('');
  const [rembLoading,     setRembLoading]     = useState(false);
  const [rembError,       setRembError]       = useState('');

  const [modalActionOpen, setModalActionOpen] = useState(false);
  const [actionType,      setActionType]      = useState<'valider' | 'annuler' | 'rejeter'>('valider');
  const [actionCreditId,  setActionCreditId]  = useState<number | null>(null);
  const [actionRef,       setActionRef]       = useState('');
  const [actionMotif,     setActionMotif]     = useState('');
  const [actionLoading,   setActionLoading]   = useState(false);

  // ── Création crédit ────────────────────────────────────────────────────────
  const [newCreditOpen,   setNewCreditOpen]   = useState(false);
  const [creditStep,      setCreditStep]      = useState(1);
  const [creditClientId,  setCreditClientId]  = useState<number | null>(null);
  const [creditClientSearch, setCreditClientSearch] = useState('');
  const [creditSelectedClient, setCreditSelectedClient] = useState<{ id: number; nom: string; prenom: string; telephone: string } | null>(null);
  const [creditClientResults, setCreditClientResults] = useState<{ id: number; nom: string; prenom: string; telephone: string }[]>([]);
  const [creditClientSearchLoading, setCreditClientSearchLoading] = useState(false);
  const [eligibilite,     setEligibilite]     = useState<EligibiliteData | null>(null);
  const [eligibiliteLoading, setEligibiliteLoading] = useState(false);
  const [creditPdvId,     setCreditPdvId]     = useState('');
  const [creditStockPdv,  setCreditStockPdv]  = useState<StockPdvItem[]>([]);
  const [creditStockLoading, setCreditStockLoading] = useState(false);
  const [creditLignes,    setCreditLignes]    = useState<CreditLigne[]>([
    { produitId: null, produitNom: '', quantite: 1, prixUnitaire: 0, remise: 0, stockDisponible: Infinity },
  ]);
  const [creditParams,    setCreditParams]    = useState({
    dureeJours: '', dateDebut: new Date().toISOString().slice(0, 10),
    tauxPenalite: '0', garantie: '', observations: '',
  });
  const [creditSubmitting, setCreditSubmitting] = useState(false);
  const [creditError,     setCreditError]     = useState('');

  const [convertLoading,  setConvertLoading]  = useState(false);

  // ── Action sur une ligne de crédit ────────────────────────────────────────
  const [ligneActionOpen,        setLigneActionOpen]        = useState(false);
  const [ligneActionCreditId,    setLigneActionCreditId]    = useState<number | null>(null);
  const [ligneActionLigneId,     setLigneActionLigneId]     = useState<number | null>(null);
  const [ligneActionStatut,      setLigneActionStatut]      = useState<string>('');
  const [ligneActionNotes,       setLigneActionNotes]       = useState('');
  const [ligneActionProduitId,   setLigneActionProduitId]   = useState('');
  const [ligneActionProdSearch,  setLigneActionProdSearch]  = useState('');
  const [ligneActionProdResults, setLigneActionProdResults] = useState<{ id: number; nom: string; reference: string | null }[]>([]);
  const [ligneActionProdLoading, setLigneActionProdLoading] = useState(false);
  const [ligneActionLoading,     setLigneActionLoading]     = useState(false);
  const [ligneActionError,       setLigneActionError]       = useState('');

  const openLigneAction = (creditId: number, ligneId: number, statut: string) => {
    setLigneActionCreditId(creditId);
    setLigneActionLigneId(ligneId);
    setLigneActionStatut(statut);
    setLigneActionNotes('');
    setLigneActionProduitId('');
    setLigneActionProdSearch('');
    setLigneActionProdResults([]);
    setLigneActionError('');
    setLigneActionOpen(true);
  };

  const handleLigneAction = async () => {
    if (!ligneActionCreditId || !ligneActionLigneId) return;
    if (ligneActionStatut === 'SUBSTITUE' && !ligneActionProduitId) {
      setLigneActionError('Sélectionnez un produit substitut'); return;
    }
    setLigneActionLoading(true);
    setLigneActionError('');
    try {
      const r = await fetch(`/api/admin/credits/${ligneActionCreditId}/lignes/${ligneActionLigneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statut: ligneActionStatut,
          notes: ligneActionNotes || undefined,
          ...(ligneActionStatut === 'SUBSTITUE' && { produitSubstitutId: Number(ligneActionProduitId) }),
        }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(`Ligne marquée : ${LIGNE_STATUT_LABEL[ligneActionStatut] ?? ligneActionStatut}`);
        setLigneActionOpen(false);
        if (detailCredit) await openDetail(detailCredit.id);
      } else {
        setLigneActionError(j.error ?? 'Erreur');
      }
    } catch { setLigneActionError('Erreur réseau'); }
    finally { setLigneActionLoading(false); }
  };

  useEffect(() => {
    if (ligneActionStatut !== 'SUBSTITUE' || ligneActionProdSearch.trim().length < 2) {
      setLigneActionProdResults([]); return;
    }
    setLigneActionProdLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/produits?search=${encodeURIComponent(ligneActionProdSearch)}&limit=8`);
        const j = await r.json();
        setLigneActionProdResults(j.data ?? []);
      } catch { /* ignore */ }
      finally { setLigneActionProdLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [ligneActionProdSearch, ligneActionStatut]);

  const { data: pdvResponse } = useApi<{ data: PDVOption[] }>('/api/admin/pdv?limit=200&actif=true');
  const pdvOptions = pdvResponse?.data ?? [];

  const loadStockPdv = async (pdvId: string) => {
    if (!pdvId) { setCreditStockPdv([]); return; }
    setCreditStockLoading(true);
    try {
      const r = await fetch(`/api/admin/stock?pdvId=${pdvId}&limit=500`);
      const j = await r.json();
      setCreditStockPdv(j.data ?? []);
    } catch { /* ignore */ }
    finally { setCreditStockLoading(false); }
  };

  const resetNewCredit = () => {
    setCreditStep(1); setCreditClientId(null); setCreditClientSearch('');
    setCreditSelectedClient(null); setEligibilite(null); setCreditError('');
    setCreditPdvId(''); setCreditStockPdv([]); setCreditClientResults([]);
    setCreditLignes([{ produitId: null, produitNom: '', quantite: 1, prixUnitaire: 0, remise: 0, stockDisponible: Infinity }]);
    setCreditParams({ dureeJours: '', dateDebut: new Date().toISOString().slice(0, 10), tauxPenalite: '0', garantie: '', observations: '' });
  };

  const checkEligibilite = async (clientId: number) => {
    setEligibiliteLoading(true); setEligibilite(null);
    try {
      const r = await fetch(`/api/admin/clients/${clientId}/eligibilite-credit`);
      setEligibilite(await r.json());
    } catch { /* ignore */ }
    finally { setEligibiliteLoading(false); }
  };

  const creditMontantTotal = creditLignes.reduce((s, l) => s + (l.prixUnitaire * l.quantite - l.remise), 0);
  const creditLignesInvalid = creditLignes.filter(l => l.produitNom.trim()).some(l =>
    l.prixUnitaire <= 0 || l.quantite < 1 ||
    (l.remise > 0 && l.remise >= l.prixUnitaire * l.quantite) ||
    (l.stockDisponible !== Infinity && l.quantite > l.stockDisponible)
  );
  const creditDateDebutInvalid = !!creditParams.dateDebut && creditParams.dateDebut < new Date().toISOString().slice(0, 10);
  const creditMontantJournalier = creditParams.dureeJours
    ? Number((creditMontantTotal / Number(creditParams.dureeJours)).toFixed(2)) : 0;
  const creditDateFin = (() => {
    if (!creditParams.dureeJours || !creditParams.dateDebut) return '';
    const d = new Date(creditParams.dateDebut);
    d.setDate(d.getDate() + Number(creditParams.dureeJours));
    return d.toISOString().slice(0, 10);
  })();

  const handleCreditSubmit = async () => {
    setCreditError('');
    if (!creditClientId || !creditLignes.some(l => l.produitNom.trim()) || !creditParams.dureeJours || !creditParams.dateDebut) {
      setCreditError('Veuillez compléter toutes les étapes'); return;
    }
    setCreditSubmitting(true);
    try {
      const r = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: creditClientId,
          pointDeVenteId: creditPdvId ? Number(creditPdvId) : undefined,
          lignes: creditLignes.filter(l => l.produitNom.trim()).map(l => ({
            produitId: l.produitId ?? undefined,
            produitNom: l.produitNom,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            remise: l.remise,
          })),
          dureeJours:   Number(creditParams.dureeJours),
          dateDebut:    creditParams.dateDebut,
          tauxPenalite: Number(creditParams.tauxPenalite),
          garantie:     creditParams.garantie || undefined,
          observations: creditParams.observations || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setCreditError(j.message ?? 'Erreur'); setCreditSubmitting(false); return; }
      setNewCreditOpen(false);
      resetNewCredit();
      refetch();
    } catch { setCreditError('Erreur réseau'); }
    finally { setCreditSubmitting(false); }
  };

  useEffect(() => {
    if (creditClientSearch.trim().length < 2 || creditSelectedClient || !newCreditOpen) {
      setCreditClientResults([]); return;
    }
    setCreditClientSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/clients?search=${encodeURIComponent(creditClientSearch)}&limit=10`);
        const j = await r.json();
        setCreditClientResults(j.data ?? []);
      } catch { /* ignore */ }
      finally { setCreditClientSearchLoading(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [creditClientSearch, creditSelectedClient, newCreditOpen]);

  // ── API principale ─────────────────────────────────────────────────────────
  const query = new URLSearchParams({
    page: String(page), limit: String(LIMIT),
    ...(search && { search }),
    ...(statut && { statut }),
  }).toString();

  const { data: res, loading, refetch } = useApi<CreditsResponse>(`/api/admin/credits?${query}`);

  // ── Stats (3 petites requêtes) ────────────────────────────────────────────
  const { data: statsActif }    = useApi<CreditsResponse>('/api/admin/credits?statut=ACTIF&limit=1');
  const { data: statsRetard }   = useApi<CreditsResponse>('/api/admin/credits?statut=EN_RETARD&limit=1');
  const { data: statsAttente }  = useApi<CreditsResponse>('/api/admin/credits?statut=EN_ATTENTE_VALIDATION&limit=1');

  const credits = res?.data ?? [];
  const meta    = res?.meta;

  // ── Ouvrir le détail ───────────────────────────────────────────────────────
  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailCredit(null);
    setShowEcheances(false);
    try {
      const r = await fetch(`/api/admin/credits/${id}`);
      const j = await r.json();
      if (r.ok) setDetailCredit(j.data);
      else toast.error(j.message ?? 'Erreur');
    } catch { toast.error('Erreur réseau'); }
    finally { setDetailLoading(false); }
  };

  // ── Valider / Annuler / Rejeter ────────────────────────────────────────────
  const openAction = (type: 'valider' | 'annuler' | 'rejeter', credit: CreditClient) => {
    setActionType(type);
    setActionCreditId(credit.id);
    setActionRef(credit.reference);
    setActionMotif('');
    setModalActionOpen(true);
  };

  const handleAction = async () => {
    if (!actionCreditId) return;
    setActionLoading(true);
    try {
      let url: string;
      let body: object;

      if (actionType === 'valider') {
        url  = `/api/admin/credits/${actionCreditId}/valider`;
        body = {};
      } else {
        url  = `/api/admin/credits/${actionCreditId}/annuler`;
        body = { action: actionType === 'rejeter' ? 'REJETE' : 'ANNULE', motif: actionMotif || undefined };
      }

      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();

      if (r.ok) {
        toast.success(
          actionType === 'valider' ? `Crédit ${actionRef} validé — échéances générées` :
          actionType === 'rejeter' ? `Crédit ${actionRef} rejeté` :
          `Crédit ${actionRef} annulé`
        );
        setModalActionOpen(false);
        refetch();
        if (detailCredit?.id === actionCreditId) await openDetail(actionCreditId);
      } else {
        toast.error(j.message ?? 'Erreur');
      }
    } catch { toast.error('Erreur réseau'); }
    finally { setActionLoading(false); }
  };

  // ── Conversion crédit rejeté → vente comptant ────────────────────────────
  const convertirEnVente = async (id: number) => {
    setConvertLoading(true);
    try {
      const r = await fetch(`/api/admin/credits/${id}/convertir-en-vente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modePaiement: 'ESPECES' }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(`Vente créée : ${j.data.vente.reference}`);
        setDetailCredit(null);
        refetch();
      } else {
        toast.error(j.message ?? 'Erreur lors de la conversion');
      }
    } catch { toast.error('Erreur réseau'); }
    finally { setConvertLoading(false); }
  };

  // ── Remboursement ─────────────────────────────────────────────────────────
  const openRemboursement = (credit: CreditClient) => {
    setRembCreditId(credit.id);
    setRembMontant('');
    setRembMode('ESPECES');
    setRembNotes('');
    setRembError('');
    setModalRembOpen(true);
  };

  const handleRemboursement = async () => {
    if (!rembCreditId || !rembMontant || Number(rembMontant) <= 0) {
      setRembError('Montant invalide'); return;
    }
    setRembLoading(true);
    setRembError('');
    try {
      const r = await fetch(`/api/admin/credits/${rembCreditId}/remboursements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ montant: Number(rembMontant), modePaiement: rembMode, notes: rembNotes || undefined }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success('Remboursement enregistré');
        setModalRembOpen(false);
        refetch();
        if (detailCredit?.id === rembCreditId) await openDetail(rembCreditId);
      } else {
        setRembError(j.message ?? 'Erreur');
      }
    } catch { setRembError('Erreur réseau'); }
    finally { setRembLoading(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* ── En-tête ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Crédits clients</h2>
            <p className="text-sm text-gray-500 mt-0.5">Ventes à crédit · validation · remboursements journaliers</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { resetNewCredit(); setNewCreditOpen(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 text-sm font-medium">
              <Plus className="w-4 h-4" /> Nouvelle vente à crédit
            </button>
            <button onClick={refetch}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'En attente validation', value: statsAttente?.meta.total ?? 0,  icon: <Clock className="w-5 h-5 text-amber-600" />,   bg: 'bg-amber-50 border-amber-200',    text: 'text-amber-700',   action: () => { setStatut('EN_ATTENTE_VALIDATION'); setPage(1); } },
            { label: 'Crédits actifs',        value: statsActif?.meta.total ?? 0,    icon: <Wallet className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', action: () => { setStatut('ACTIF'); setPage(1); } },
            { label: 'En retard',             value: statsRetard?.meta.total ?? 0,   icon: <AlertCircle className="w-5 h-5 text-red-600" />,bg: 'bg-red-50 border-red-200',         text: 'text-red-700',     action: () => { setStatut('EN_RETARD'); setPage(1); } },
            { label: 'Total (filtre actuel)', value: meta?.total ?? 0,               icon: <CreditCard className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50 border-blue-200',     text: 'text-blue-700',    action: () => { setStatut(''); setPage(1); } },
          ].map((s) => (
            <button key={s.label} onClick={s.action}
              className={`${s.bg} border rounded-2xl p-5 flex items-center gap-4 hover:opacity-90 transition text-left`}>
              <div className={`p-2.5 rounded-xl bg-white/60`}>{s.icon}</div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                <p className={`text-3xl font-bold ${s.text} mt-0.5`}>{s.value}</p>
              </div>
            </button>
          ))}
        </div>

        {/* ── Filtres ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
          {/* Recherche */}
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
                placeholder="Référence, client, téléphone…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>
            <button onClick={() => { setSearch(searchInput); setPage(1); }}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Chercher
            </button>
            {search && (
              <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
                className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtre statut */}
          <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]">
            <option value="">Tous les statuts</option>
            <option value="EN_ATTENTE_VALIDATION">En attente de validation</option>
            <option value="ACTIF">Actif</option>
            <option value="EN_RETARD">En retard</option>
            <option value="SOLDE">Soldé</option>
            <option value="ANNULE">Annulé</option>
            <option value="REJETE">Rejeté</option>
          </select>

          {(statut || search) && (
            <button onClick={() => { setStatut(''); setSearch(''); setSearchInput(''); setPage(1); }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Réinitialiser
            </button>
          )}
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading && !res ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement des crédits…
            </div>
          ) : !credits.length ? (
            <div className="text-center py-20">
              <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Aucun crédit trouvé</p>
              <p className="text-gray-300 text-sm mt-1">Modifiez les filtres ou créez un premier crédit</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Référence</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Montant</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Remboursé</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Solde restant</th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Durée / Fin</th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {credits.map((credit) => {
                      const pct = Number(credit.montantTotal) > 0
                        ? Math.min(100, Math.round((Number(credit.montantRembourse) / Number(credit.montantTotal)) * 100))
                        : 0;
                      const canValider  = credit.statut === 'EN_ATTENTE_VALIDATION';
                      const canRembourser = credit.statut === 'ACTIF' || credit.statut === 'EN_RETARD';
                      const canAnnuler  = ['EN_ATTENTE_VALIDATION', 'ACTIF', 'EN_RETARD'].includes(credit.statut);

                      return (
                        <tr key={credit.id} className="hover:bg-gray-50/60 transition-colors">
                          {/* Référence */}
                          <td className="px-5 py-4">
                            <p className="font-mono text-xs font-semibold text-gray-700">{credit.reference}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatDate(credit.createdAt)}</p>
                          </td>

                          {/* Client */}
                          <td className="px-5 py-4">
                            <Link href={`/dashboard/admin/clients/${credit.client.id}`}
                              className="font-medium text-gray-800 hover:text-blue-600 transition-colors">
                              {credit.client.prenom} {credit.client.nom}
                            </Link>
                            {credit.client.codeClient && (
                              <p className="text-xs text-gray-400 font-mono">{credit.client.codeClient}</p>
                            )}
                            <p className="text-xs text-gray-400">{credit.client.telephone}</p>
                          </td>

                          {/* Montant total */}
                          <td className="px-5 py-4 text-right">
                            <p className="font-semibold text-gray-800">{formatCurrency(Number(credit.montantTotal))}</p>
                            <p className="text-xs text-gray-400">{credit._count.lignes} produit(s)</p>
                          </td>

                          {/* Remboursé + barre */}
                          <td className="px-5 py-4 text-right">
                            <p className="font-medium text-emerald-700">{formatCurrency(Number(credit.montantRembourse))}</p>
                            <div className="w-20 ml-auto mt-1">
                              <div className="w-full bg-gray-100 rounded-full h-1">
                                <div className={`h-1 rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-xs text-gray-400 text-right mt-0.5">{pct}%</p>
                            </div>
                          </td>

                          {/* Solde restant */}
                          <td className="px-5 py-4 text-right">
                            <p className={`font-bold ${Number(credit.soldeRestant) > 0 && credit.statut !== 'SOLDE' ? 'text-red-600' : 'text-gray-500'}`}>
                              {formatCurrency(Number(credit.soldeRestant))}
                            </p>
                            <p className="text-xs text-gray-400">{formatCurrency(Number(credit.montantJournalier))}/j</p>
                          </td>

                          {/* Durée / Fin */}
                          <td className="px-5 py-4 text-center">
                            <p className="text-sm font-medium text-gray-700">{credit.dureeJours}j</p>
                            <p className="text-xs text-gray-400">{formatDate(credit.dateEcheanceFin)}</p>
                          </td>

                          {/* Statut */}
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUT_STYLE[credit.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                              {STATUT_LABEL[credit.statut] ?? credit.statut}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-1">
                              {/* Détail */}
                              <button onClick={() => openDetail(credit.id)}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Voir le détail">
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Facture crédit */}
                              <button onClick={() => setFactureId(credit.id)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Générer la facture à crédit">
                                <Receipt className="w-4 h-4" />
                              </button>

                              {/* Valider */}
                              {canValider && (
                                <button onClick={() => openAction('valider', credit)}
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Valider">
                                  <BadgeCheck className="w-4 h-4" />
                                </button>
                              )}

                              {/* Rembourser */}
                              {canRembourser && (
                                <button onClick={() => openRemboursement(credit)}
                                  className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Enregistrer un remboursement">
                                  <Banknote className="w-4 h-4" />
                                </button>
                              )}

                              {/* Rejeter (si en attente) */}
                              {credit.statut === 'EN_ATTENTE_VALIDATION' && (
                                <button onClick={() => openAction('rejeter', credit)}
                                  className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="Rejeter">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}

                              {/* Annuler (si actif/en retard) */}
                              {(credit.statut === 'ACTIF' || credit.statut === 'EN_RETARD') && (
                                <button onClick={() => openAction('annuler', credit)}
                                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="Annuler">
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 text-sm text-gray-500">
                  <span>{meta.total} crédit(s) · page {meta.page}/{meta.totalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-xs">
                      <ChevronLeft className="w-3.5 h-3.5" /> Préc.
                    </button>
                    <button disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-xs">
                      Suiv. <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PANEL DÉTAIL (drawer latéral)
      ══════════════════════════════════════════════════════════════════ */}
      {(detailCredit || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailCredit(null)} />

          {/* Drawer */}
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">

            {/* Header drawer */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-gray-900">{detailCredit?.reference ?? '…'}</h3>
                  {detailCredit && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUT_STYLE[detailCredit.statut] ?? ''}`}>
                      {STATUT_LABEL[detailCredit.statut] ?? detailCredit.statut}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setDetailCredit(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…
              </div>
            ) : detailCredit ? (
              <>
                {/* Actions rapides */}
                <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0 flex-wrap">
                  {detailCredit.statut === 'EN_ATTENTE_VALIDATION' && (
                    <>
                      <button onClick={() => openAction('valider', detailCredit)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                        <BadgeCheck className="w-3.5 h-3.5" /> Valider
                      </button>
                      <button onClick={() => openAction('rejeter', detailCredit)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600">
                        <XCircle className="w-3.5 h-3.5" /> Rejeter
                      </button>
                    </>
                  )}
                  {(detailCredit.statut === 'ACTIF' || detailCredit.statut === 'EN_RETARD') && (
                    <>
                      <button onClick={() => openRemboursement(detailCredit)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700">
                        <Banknote className="w-3.5 h-3.5" /> Rembourser
                      </button>
                      <button onClick={() => openAction('annuler', detailCredit)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600">
                        <Ban className="w-3.5 h-3.5" /> Annuler
                      </button>
                    </>
                  )}
                  {detailCredit.statut === 'REJETE' && (
                    <button onClick={() => convertirEnVente(detailCredit.id)}
                      disabled={convertLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                      <Banknote className="w-3.5 h-3.5" />
                      {convertLoading ? 'Conversion…' : 'Convertir en vente comptant'}
                    </button>
                  )}
                  {/* Facture crédit — toujours disponible */}
                  <button onClick={() => setFactureId(detailCredit.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-50 transition-colors ml-auto">
                    <Receipt className="w-3.5 h-3.5" /> Facture crédit
                  </button>
                </div>

                {/* Contenu scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                  {/* Infos générales */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Montant total',      value: formatCurrency(Number(detailCredit.montantTotal)),     icon: <CreditCard className="w-3.5 h-3.5" /> },
                      { label: 'Solde restant',       value: formatCurrency(Number(detailCredit.soldeRestant)),     icon: <TrendingDown className="w-3.5 h-3.5" /> },
                      { label: 'Remboursé',           value: formatCurrency(Number(detailCredit.montantRembourse)), icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                      { label: 'Montant/jour',        value: formatCurrency(Number(detailCredit.montantJournalier)),icon: <Calendar className="w-3.5 h-3.5" /> },
                      { label: 'Début',               value: formatDate(detailCredit.dateDebut),                   icon: <Calendar className="w-3.5 h-3.5" /> },
                      { label: 'Fin d\'échéance',     value: formatDate(detailCredit.dateEcheanceFin),              icon: <Calendar className="w-3.5 h-3.5" /> },
                    ].map((f) => (
                      <div key={f.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                        <p className="text-xs text-gray-400 flex items-center gap-1">{f.icon}{f.label}</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{f.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Barre progression */}
                  {(() => {
                    const pct = Number(detailCredit.montantTotal) > 0
                      ? Math.min(100, Math.round((Number(detailCredit.montantRembourse) / Number(detailCredit.montantTotal)) * 100)) : 0;
                    return (
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Progression du remboursement</span><span>{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Client */}
                  <div className="border border-gray-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><User className="w-3.5 h-3.5" />Client</p>
                    <Link href={`/dashboard/admin/clients/${detailCredit.client.id}`}
                      className="text-sm font-semibold text-blue-600 hover:underline">
                      {detailCredit.client.prenom} {detailCredit.client.nom}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">{detailCredit.client.telephone}</p>
                    {detailCredit.client.codeClient && <p className="text-xs text-gray-400 font-mono">{detailCredit.client.codeClient}</p>}
                    <div className="mt-2 text-xs text-gray-400">
                      Créé par {detailCredit.creePar.prenom} {detailCredit.creePar.nom}
                      {detailCredit.validePar && <span> · Validé par {detailCredit.validePar.prenom} {detailCredit.validePar.nom}</span>}
                    </div>
                  </div>

                  {/* Produits / Lignes */}
                  {detailCredit.lignes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Produits ({detailCredit.lignes.length})
                      </p>
                      <div className="space-y-2">
                        {detailCredit.lignes.map((l) => (
                          <div key={l.id} className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="text-gray-700 font-medium">{l.produitNom}</span>
                                <span className="text-gray-400 ml-1.5">× {l.quantite}</span>
                                {l.estNouveauProduit && (
                                  <span className="ml-1.5 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">nouveau</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${LIGNE_STATUT_STYLE[l.statut] ?? 'bg-gray-100 text-gray-500'}`}>
                                  {LIGNE_STATUT_LABEL[l.statut] ?? l.statut}
                                </span>
                                <span className="font-medium text-gray-800 text-xs">{formatCurrency(Number(l.montantLigne))}</span>
                              </div>
                            </div>

                            {l.produitSubstitut && (
                              <div className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                                <ArrowLeftRight className="w-3 h-3" />
                                Substitué par : <span className="font-medium ml-0.5">{l.produitSubstitut.nom}</span>
                              </div>
                            )}
                            {l.traitePar && (
                              <div className="mt-1 text-xs text-gray-400">
                                Traité par {l.traitePar.prenom} {l.traitePar.nom}
                                {l.dateTraitement && <> · {formatDate(l.dateTraitement)}</>}
                              </div>
                            )}
                            {l.notes && (
                              <div className="mt-1 text-xs text-gray-500 italic">{l.notes}</div>
                            )}

                            {/* Actions disponibles */}
                            {l.statut === 'EN_ATTENTE' && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                <button onClick={() => openLigneAction(detailCredit.id, l.id, 'LIVRE')}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg transition-colors font-medium">
                                  <PackageCheck className="w-3 h-3" /> Livré
                                </button>
                                <button onClick={() => openLigneAction(detailCredit.id, l.id, 'INDISPONIBLE')}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg transition-colors font-medium">
                                  <AlertCircle className="w-3 h-3" /> Indisponible
                                </button>
                                <button onClick={() => openLigneAction(detailCredit.id, l.id, 'SUBSTITUE')}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors font-medium">
                                  <ArrowLeftRight className="w-3 h-3" /> Substituer
                                </button>
                                <button onClick={() => openLigneAction(detailCredit.id, l.id, 'ANNULE')}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors font-medium">
                                  <XCircle className="w-3 h-3" /> Annuler
                                </button>
                              </div>
                            )}
                            {/* ANNULE reste possible depuis INDISPONIBLE ou SUBSTITUE */}
                            {(l.statut === 'INDISPONIBLE' || l.statut === 'SUBSTITUE') && (
                              <div className="mt-2">
                                <button onClick={() => openLigneAction(detailCredit.id, l.id, 'ANNULE')}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors font-medium">
                                  <XCircle className="w-3 h-3" /> Annuler
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Garantie / observations */}
                  {(detailCredit.garantie || detailCredit.observations) && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800 space-y-1">
                      {detailCredit.garantie    && <p><strong>Garantie :</strong> {detailCredit.garantie}</p>}
                      {detailCredit.observations && <p><strong>Observations :</strong> {detailCredit.observations}</p>}
                    </div>
                  )}

                  {/* Échéancier */}
                  {detailCredit.echeances.length > 0 && (
                    <div>
                      <button onClick={() => setShowEcheances((v) => !v)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 hover:text-gray-700">
                        <span>Échéancier ({detailCredit.echeances.length} jours)</span>
                        {showEcheances ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {showEcheances && (
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {detailCredit.echeances.map((e) => {
                            const now = new Date();
                            const retard = e.statut !== 'PAYE' && new Date(e.dateEcheance) < now;
                            return (
                              <div key={e.id} className={`flex items-center gap-3 text-xs rounded-lg px-3 py-2 ${retard ? 'bg-red-50' : 'bg-gray-50'}`}>
                                <span className="text-gray-400 w-8 text-right font-mono">#{e.numeroEcheance}</span>
                                <span className={`flex-1 ${retard ? 'text-red-600' : 'text-gray-600'}`}>{formatDate(e.dateEcheance)}</span>
                                <span className="font-medium text-gray-700">{formatCurrency(Number(e.montantDu))}</span>
                                {Number(e.montantPaye) > 0 && Number(e.montantPaye) < Number(e.montantDu) && (
                                  <span className="text-blue-500">(+{formatCurrency(Number(e.montantPaye))})</span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded-full font-semibold ${ECHEANCE_STYLE[e.statut] ?? 'bg-gray-100 text-gray-500'}`}>
                                  {e.statut === 'EN_ATTENTE' ? 'Att.' : e.statut === 'PAYE' ? 'Payé' : e.statut === 'PARTIEL' ? 'Part.' : 'Retard'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Remboursements */}
                  {detailCredit.remboursements.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Remboursements ({detailCredit.remboursements.length})
                      </p>
                      <div className="space-y-1">
                        {detailCredit.remboursements.map((r) => (
                          <div key={r.id} className="flex items-center gap-3 bg-emerald-50 rounded-lg px-3 py-2 text-xs">
                            <span className="text-gray-500 flex-1">{formatDate(r.dateRemboursement)}</span>
                            <span className="text-gray-400">{r.modePaiement.replace('_', ' ')}</span>
                            <span className="font-bold text-emerald-700">{formatCurrency(Number(r.montant))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL — Remboursement
      ══════════════════════════════════════════════════════════════════ */}
      {modalRembOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[160] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-gray-900">Enregistrer un remboursement</h3>
              </div>
              <button onClick={() => setModalRembOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {rembError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{rembError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Montant <span className="text-red-500">*</span></label>
                <input type="number" min="0.01" step="0.01" value={rembMontant}
                  onChange={(e) => setRembMontant(e.target.value)}
                  placeholder="ex : 5000"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mode de paiement</label>
                <select value={rembMode} onChange={(e) => setRembMode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {MODE_PAIEMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optionnel)</label>
                <textarea rows={2} value={rembNotes} onChange={(e) => setRembNotes(e.target.value)}
                  placeholder="Référence reçu, remarques…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setModalRembOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleRemboursement} disabled={rembLoading || !rembMontant}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium">
                {rembLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Enregistrement…</> : <><CheckCircle2 className="w-4 h-4" />Confirmer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL — Nouvelle vente à crédit (4 étapes)
      ══════════════════════════════════════════════════════════════════ */}
      {newCreditOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[160] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[94vh]">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">Nouvelle vente à crédit</h2>
              </div>
              <button onClick={() => { setNewCreditOpen(false); resetNewCredit(); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-0 px-6 pt-4 pb-2 flex-shrink-0">
              {['Client', 'Produits', 'Paramètres', 'Récapitulatif'].map((label, i) => {
                const step = i + 1;
                const done = creditStep > step;
                const active = creditStep === step;
                return (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-blue-600 text-white' : active ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400' : 'bg-gray-100 text-gray-400'}`}>
                        {done ? <CheckCircle2 className="w-4 h-4" /> : step}
                      </div>
                      <span className={`text-xs mt-1 font-medium ${active ? 'text-blue-700' : done ? 'text-blue-500' : 'text-gray-400'}`}>{label}</span>
                    </div>
                    {i < 3 && <div className={`flex-1 h-px mx-2 mb-4 ${creditStep > step ? 'bg-blue-400' : 'bg-gray-200'}`} />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Contenu scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {creditError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{creditError}
                </div>
              )}

              {/* ─ Étape 1 : Client + éligibilité + PDV ─ */}
              {creditStep === 1 && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sélectionner un client et un point de vente</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Client <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={creditClientSearch}
                        onChange={(e) => { setCreditClientSearch(e.target.value); if (creditSelectedClient) { setCreditSelectedClient(null); setCreditClientId(null); setEligibilite(null); } }}
                        placeholder="Nom, prénom, téléphone…"
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                      />
                    </div>
                    {creditClientSearch.trim().length >= 2 && !creditSelectedClient && (
                      <div className="mt-2 border border-slate-200 rounded-lg divide-y max-h-48 overflow-y-auto shadow-sm">
                        {creditClientSearchLoading ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Recherche…</div>
                        ) : creditClientResults.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-gray-400 italic">Aucun client trouvé</p>
                        ) : creditClientResults.map(c => (
                          <button key={c.id} type="button"
                            onClick={() => { setCreditClientId(c.id); setCreditClientSearch(`${c.prenom} ${c.nom}`); setCreditSelectedClient({ id: c.id, nom: c.nom, prenom: c.prenom, telephone: c.telephone }); checkEligibilite(c.id); }}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm transition-colors">
                            <strong>{c.prenom} {c.nom}</strong> <span className="text-gray-400 text-xs">· {c.telephone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {creditSelectedClient && (
                      <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-sm font-semibold text-blue-800">{creditSelectedClient.prenom} {creditSelectedClient.nom}</span>
                        <span className="text-xs text-blue-500 font-mono">{creditSelectedClient.telephone}</span>
                        <button type="button" className="ml-auto text-blue-400 hover:text-blue-600"
                          onClick={() => { setCreditSelectedClient(null); setCreditClientId(null); setCreditClientSearch(''); setEligibilite(null); setCreditPdvId(''); setCreditStockPdv([]); }}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {creditClientId && (
                    <div>
                      {eligibiliteLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Vérification de l&apos;éligibilité…</div>
                      ) : eligibilite ? (
                        <div className={`rounded-xl p-4 border ${eligibilite.eligible ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {eligibilite.eligible ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
                            <span className={`text-sm font-semibold ${eligibilite.eligible ? 'text-emerald-700' : 'text-red-700'}`}>
                              {eligibilite.eligible ? 'Client éligible au crédit' : 'Client non éligible — avancement bloqué'}
                            </span>
                          </div>
                          {!eligibilite.eligible && (
                            <ul className="space-y-1 ml-7">
                              {eligibilite.raisons.map((r, i) => <li key={i} className="text-xs text-red-600 flex items-start gap-1"><span>·</span>{r}</li>)}
                            </ul>
                          )}
                          {eligibilite.eligible && eligibilite.alertes?.length > 0 && (
                            <ul className="space-y-1 ml-7 mt-1">
                              {eligibilite.alertes.map((a, i) => <li key={i} className="text-xs text-amber-600 flex items-start gap-1"><span>·</span>{a}</li>)}
                            </ul>
                          )}
                          {eligibilite.tauxUtilisation != null && (
                            <div className="mt-3 ml-7">
                              <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Utilisation du crédit</span><span>{eligibilite.tauxUtilisation}%</span></div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${eligibilite.tauxUtilisation >= 100 ? 'bg-red-500' : eligibilite.tauxUtilisation >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, eligibilite.tauxUtilisation)}%` }} />
                              </div>
                              <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>Solde actuel : {formatCurrency(Number(eligibilite.client.soldeActuel ?? 0))}</span>
                                <span>Limite : {formatCurrency(Number(eligibilite.client.limiteCredit ?? 0))}</span>
                              </div>
                            </div>
                          )}
                          {eligibilite.creditsActifs.length > 0 && (
                            <div className="mt-3 ml-7">
                              <p className="text-xs font-medium text-gray-600 mb-1">Crédits en cours :</p>
                              {eligibilite.creditsActifs.slice(0, 3).map(c => (
                                <div key={c.id} className="text-xs text-gray-500 flex justify-between">
                                  <span className="font-mono">{c.reference}</span><span>{c.statut}</span>
                                  <span>{formatCurrency(Number(c.soldeRestant))} restant</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {creditClientId && eligibilite?.eligible && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Point de vente source <span className="text-red-500">*</span>
                        <span className="ml-1 text-gray-400 font-normal">(détermine le stock disponible)</span>
                      </label>
                      <select value={creditPdvId}
                        onChange={(e) => { const v = e.target.value; setCreditPdvId(v); loadStockPdv(v); setCreditLignes([{ produitId: null, produitNom: '', quantite: 1, prixUnitaire: 0, remise: 0, stockDisponible: Infinity }]); }}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Sélectionner un PDV --</option>
                        {pdvOptions.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
                      </select>
                      {creditPdvId && <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Les produits disponibles seront chargés à l&apos;étape suivante.</p>}
                    </div>
                  )}
                </div>
              )}

              {/* ─ Étape 2 : Produits ─ */}
              {creditStep === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Produits de la vente</p>
                    {creditStockLoading && <span className="flex items-center gap-1 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Chargement stock…</span>}
                  </div>
                  {!creditStockLoading && creditStockPdv.length === 0 && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-amber-700 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /> Aucun produit en stock pour ce PDV.
                    </div>
                  )}
                  <div className="space-y-3">
                    {creditLignes.map((ligne, i) => {
                      const montantLigne = ligne.prixUnitaire * ligne.quantite - ligne.remise;
                      const stockInsuffisant = ligne.stockDisponible !== Infinity && ligne.quantite > ligne.stockDisponible;
                      const remiseInvalide = ligne.produitNom.trim() !== '' && ligne.remise > 0 && ligne.remise >= ligne.prixUnitaire * ligne.quantite;
                      const prixInvalide = ligne.produitNom.trim() !== '' && ligne.prixUnitaire <= 0;
                      const hasError = stockInsuffisant || remiseInvalide || prixInvalide;
                      return (
                        <div key={i} className={`rounded-xl border p-3 space-y-2 ${hasError ? 'border-red-200 bg-red-50/40' : 'border-slate-100 bg-slate-50/40'}`}>
                          <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5">
                              {i === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Produit <span className="text-red-500">*</span></label>}
                              <select value={ligne.produitId ?? ''}
                                onChange={(e) => { const item = creditStockPdv.find(s => s.produitId === Number(e.target.value)); setCreditLignes(prev => prev.map((l, j) => j !== i ? l : { ...l, produitId: item?.produitId ?? null, produitNom: item?.produit.nom ?? '', prixUnitaire: item ? Number(item.produit.prixUnitaire) : 0, stockDisponible: item ? item.quantite : Infinity })); }}
                                className={`w-full px-2 py-2 border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasError ? 'border-red-300' : 'border-slate-200'}`}>
                                <option value="">-- Choisir --</option>
                                {creditStockPdv.map(s => <option key={s.produitId} value={s.produitId} disabled={s.quantite === 0}>{s.produit.nom}{s.quantite === 0 ? ' ⚠ rupture' : ` (dispo: ${s.quantite})`}</option>)}
                              </select>
                            </div>
                            <div className="col-span-2">
                              {i === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Qté</label>}
                              <input type="number" min={1} max={ligne.stockDisponible !== Infinity ? ligne.stockDisponible : undefined} value={ligne.quantite}
                                onChange={e => setCreditLignes(prev => prev.map((l, j) => j !== i ? l : { ...l, quantite: Math.max(1, Number(e.target.value)) }))}
                                className={`w-full px-2 py-2 border rounded-lg text-xs bg-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${stockInsuffisant ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} />
                              {ligne.stockDisponible !== Infinity && <p className="text-xs text-gray-400 text-center mt-0.5">max {ligne.stockDisponible}</p>}
                            </div>
                            <div className="col-span-2">
                              {i === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Prix unit.</label>}
                              <input type="number" min={0} value={ligne.prixUnitaire}
                                onChange={e => setCreditLignes(prev => prev.map((l, j) => j !== i ? l : { ...l, prixUnitaire: Number(e.target.value) }))}
                                className={`w-full px-2 py-2 border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${prixInvalide ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} />
                            </div>
                            <div className="col-span-2">
                              {i === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Remise</label>}
                              <input type="number" min={0} max={ligne.prixUnitaire * ligne.quantite - 1} value={ligne.remise}
                                onChange={e => setCreditLignes(prev => prev.map((l, j) => j !== i ? l : { ...l, remise: Number(e.target.value) }))}
                                className={`w-full px-2 py-2 border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${remiseInvalide ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} />
                            </div>
                            <div className="col-span-1 flex flex-col items-end gap-1">
                              {i === 0 && <div className="h-4" />}
                              <span className={`text-xs font-bold ${montantLigne <= 0 ? 'text-red-600' : 'text-slate-700'}`}>{formatCurrency(Math.max(0, montantLigne))}</span>
                              {creditLignes.length > 1 && <button type="button" onClick={() => setCreditLignes(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash className="w-3.5 h-3.5" /></button>}
                            </div>
                          </div>
                          {stockInsuffisant && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3 flex-shrink-0" />Qté demandée ({ligne.quantite}) supérieure au stock ({ligne.stockDisponible})</p>}
                          {remiseInvalide && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3 flex-shrink-0" />La remise dépasse ou égale le montant de la ligne</p>}
                          {prixInvalide && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3 flex-shrink-0" />Le prix unitaire doit être supérieur à 0</p>}
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => setCreditLignes(prev => [...prev, { produitId: null, produitNom: '', quantite: 1, prixUnitaire: 0, remise: 0, stockDisponible: Infinity }])}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                    <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                  </button>
                  <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                    <span className="text-sm text-slate-500">Total de la vente</span>
                    <span className={`text-lg font-bold ${creditMontantTotal <= 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatCurrency(creditMontantTotal)}</span>
                  </div>
                </div>
              )}

              {/* ─ Étape 3 : Paramètres ─ */}
              {creditStep === 3 && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Paramètres du crédit</p>
                  <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
                    <div><p className="text-xs text-blue-600">Montant total</p><p className="text-2xl font-bold text-blue-700">{formatCurrency(creditMontantTotal)}</p></div>
                    <Info className="w-8 h-8 text-blue-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Durée (jours) <span className="text-red-500">*</span></label>
                      <input type="number" min={1} value={creditParams.dureeJours}
                        onChange={e => setCreditParams(p => ({ ...p, dureeJours: e.target.value }))} placeholder="ex: 30"
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 ${creditParams.dureeJours && Number(creditParams.dureeJours) < 1 ? 'border-red-300' : 'border-slate-200'}`} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Date de début <span className="text-red-500">*</span></label>
                      <input type="date" value={creditParams.dateDebut}
                        onChange={e => setCreditParams(p => ({ ...p, dateDebut: e.target.value }))}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 ${creditDateDebutInvalid ? 'border-amber-300' : 'border-slate-200'}`} />
                      {creditDateDebutInvalid && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Date dans le passé</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                      <p className="text-xs text-slate-400">Montant/jour (AUTO)</p>
                      <p className="text-sm font-bold text-slate-700 mt-0.5">{creditParams.dureeJours ? formatCurrency(creditMontantJournalier) : '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                      <p className="text-xs text-slate-400">Fin d&apos;échéance (AUTO)</p>
                      <p className="text-sm font-bold text-slate-700 mt-0.5">{creditDateFin ? formatDate(creditDateFin) : '—'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Taux pénalité (% / jour)</label>
                      <input type="number" min={0} step={0.1} value={creditParams.tauxPenalite}
                        onChange={e => setCreditParams(p => ({ ...p, tauxPenalite: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Garantie</label>
                      <input type="text" value={creditParams.garantie}
                        onChange={e => setCreditParams(p => ({ ...p, garantie: e.target.value }))} placeholder="acte de propriété, caution…"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Observations</label>
                    <textarea rows={2} value={creditParams.observations}
                      onChange={e => setCreditParams(p => ({ ...p, observations: e.target.value }))} placeholder="Notes complémentaires…"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 resize-none" />
                  </div>
                </div>
              )}

              {/* ─ Étape 4 : Récapitulatif ─ */}
              {creditStep === 4 && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Récapitulatif — en attente de validation superviseur</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-4 space-y-1">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Client</p>
                      <p className="text-sm font-semibold text-slate-800">{creditSelectedClient?.prenom} {creditSelectedClient?.nom}</p>
                      <p className="font-mono text-xs text-slate-400">{creditSelectedClient?.telephone}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-1">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Point de vente</p>
                      {(() => { const pdv = pdvOptions.find(p => String(p.id) === creditPdvId); return pdv ? <><p className="text-sm font-semibold text-slate-800">{pdv.nom}</p><p className="font-mono text-xs text-slate-400">{pdv.code}</p></> : <p className="text-sm text-slate-400 italic">Non sélectionné</p>; })()}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[{ label: 'Montant total', value: formatCurrency(creditMontantTotal) }, { label: 'Durée', value: `${creditParams.dureeJours} jours` }, { label: 'Montant/jour', value: formatCurrency(creditMontantJournalier) }].map(s => (
                      <div key={s.label} className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-blue-500">{s.label}</p>
                        <p className="text-sm font-bold text-blue-700 mt-0.5">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Début remboursement</p><p className="font-semibold text-slate-700 mt-0.5">{formatDate(creditParams.dateDebut)}</p></div>
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Date fin d&apos;échéance</p><p className="font-semibold text-slate-700 mt-0.5">{creditDateFin ? formatDate(creditDateFin) : '—'}</p></div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Produits ({creditLignes.filter(l => l.produitNom).length})</p>
                    <div className="space-y-1">
                      {creditLignes.filter(l => l.produitNom.trim()).map((l, i) => (
                        <div key={i} className="flex justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                          <span className="text-slate-700">{l.produitNom} × {l.quantite}</span>
                          <span className="font-medium text-slate-800">{formatCurrency(l.prixUnitaire * l.quantite - l.remise)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {(creditParams.garantie || creditParams.observations) && (
                    <div className="text-xs text-slate-500 space-y-1">
                      {creditParams.garantie && <p><strong>Garantie :</strong> {creditParams.garantie}</p>}
                      {creditParams.observations && <p><strong>Observations :</strong> {creditParams.observations}</p>}
                    </div>
                  )}
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Ce crédit sera soumis en <strong className="mx-1">attente de validation</strong>. Les échéances seront générées après validation par un superviseur.
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 flex-shrink-0">
              <button type="button" disabled={creditStep === 1}
                onClick={() => { setCreditError(''); setCreditStep(s => s - 1); }}
                className="flex items-center gap-1 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" /> Précédent
              </button>
              {creditStep < 4 ? (
                <button type="button"
                  disabled={
                    (creditStep === 1 && (!creditClientId || !creditPdvId || eligibiliteLoading || eligibilite?.eligible === false)) ||
                    (creditStep === 2 && (creditMontantTotal <= 0 || !creditLignes.some(l => l.produitNom.trim()) || creditLignesInvalid)) ||
                    (creditStep === 3 && (!creditParams.dureeJours || Number(creditParams.dureeJours) < 1 || !creditParams.dateDebut))
                  }
                  onClick={() => { setCreditError(''); setCreditStep(s => s + 1); }}
                  className="flex items-center gap-1 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
                  Suivant <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button type="button" disabled={creditSubmitting} onClick={handleCreditSubmit}
                  className="flex items-center gap-2 px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                  {creditSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : <><CheckCircle2 className="w-4 h-4" /> Envoyer en validation</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL — Valider / Rejeter / Annuler
      ══════════════════════════════════════════════════════════════════ */}
      {modalActionOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[160] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {actionType === 'valider'  && <BadgeCheck className="w-5 h-5 text-emerald-600" />}
                {actionType === 'rejeter'  && <XCircle    className="w-5 h-5 text-orange-500" />}
                {actionType === 'annuler'  && <Ban        className="w-5 h-5 text-red-500" />}
                <h3 className="text-base font-bold text-gray-900">
                  {actionType === 'valider' ? 'Valider le crédit' : actionType === 'rejeter' ? 'Rejeter le crédit' : 'Annuler le crédit'}
                </h3>
              </div>
              <button onClick={() => setModalActionOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">
                {actionType === 'valider'
                  ? <>Confirmer la validation de <strong className="text-gray-800">{actionRef}</strong> ? Les échéances journalières seront générées et le solde client mis à jour.</>
                  : actionType === 'rejeter'
                  ? <>Rejeter <strong className="text-gray-800">{actionRef}</strong> ? Cette action est définitive.</>
                  : <>Annuler <strong className="text-gray-800">{actionRef}</strong> ? Le solde client sera corrigé en conséquence.</>
                }
              </p>
              {actionType !== 'valider' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Motif (optionnel)</label>
                  <textarea rows={2} value={actionMotif} onChange={(e) => setActionMotif(e.target.value)}
                    placeholder="Raison du rejet ou de l'annulation…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setModalActionOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleAction} disabled={actionLoading}
                className={`flex items-center gap-2 px-5 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 ${
                  actionType === 'valider' ? 'bg-emerald-600 hover:bg-emerald-700'
                  : actionType === 'rejeter' ? 'bg-orange-500 hover:bg-orange-600'
                  : 'bg-red-600 hover:bg-red-700'
                }`}>
                {actionLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Traitement…</>
                  : actionType === 'valider' ? <><BadgeCheck className="w-4 h-4" />Valider</>
                  : actionType === 'rejeter' ? <><XCircle className="w-4 h-4" />Rejeter</>
                  : <><Ban className="w-4 h-4" />Annuler</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════════════
          MODAL — Action sur une ligne de crédit
      ══════════════════════════════════════════════════════════════════ */}
      {ligneActionOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {ligneActionStatut === 'LIVRE'        && <PackageCheck className="w-5 h-5 text-emerald-600" />}
                {ligneActionStatut === 'INDISPONIBLE' && <AlertCircle  className="w-5 h-5 text-orange-500" />}
                {ligneActionStatut === 'SUBSTITUE'    && <ArrowLeftRight className="w-5 h-5 text-blue-600" />}
                {ligneActionStatut === 'ANNULE'       && <XCircle      className="w-5 h-5 text-red-500" />}
                <h3 className="text-base font-bold text-gray-900">
                  {ligneActionStatut === 'LIVRE'        && 'Marquer comme livré'}
                  {ligneActionStatut === 'INDISPONIBLE' && 'Marquer comme indisponible'}
                  {ligneActionStatut === 'SUBSTITUE'    && 'Substituer le produit'}
                  {ligneActionStatut === 'ANNULE'       && 'Annuler cette ligne'}
                </h3>
              </div>
              <button onClick={() => setLigneActionOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-4 space-y-3">
              {ligneActionError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{ligneActionError}
                </div>
              )}

              {/* Substitution : recherche produit */}
              {ligneActionStatut === 'SUBSTITUE' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Produit de remplacement <span className="text-red-500">*</span>
                  </label>
                  {ligneActionProduitId ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <span className="text-sm font-medium text-blue-800">
                        {ligneActionProdResults.find(p => String(p.id) === ligneActionProduitId)?.nom ?? `Produit #${ligneActionProduitId}`}
                      </span>
                      <button onClick={() => { setLigneActionProduitId(''); setLigneActionProdSearch(''); setLigneActionProdResults([]); }}
                        className="text-blue-400 hover:text-blue-600 ml-2"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={ligneActionProdSearch}
                        onChange={(e) => setLigneActionProdSearch(e.target.value)}
                        placeholder="Rechercher un produit catalogue…"
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      />
                      {(ligneActionProdLoading || ligneActionProdResults.length > 0) && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {ligneActionProdLoading ? (
                            <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-400">
                              <Loader2 className="w-4 h-4 animate-spin" /> Recherche…
                            </div>
                          ) : ligneActionProdResults.map(p => (
                            <button key={p.id} type="button"
                              onClick={() => { setLigneActionProduitId(String(p.id)); setLigneActionProdSearch(p.nom); setLigneActionProdResults([]); }}
                              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0">
                              <span className="font-medium text-gray-800">{p.nom}</span>
                              {p.reference && <span className="ml-2 text-xs text-gray-400 font-mono">{p.reference}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optionnel)</label>
                <textarea rows={2} value={ligneActionNotes} onChange={(e) => setLigneActionNotes(e.target.value)}
                  placeholder="Raison, remarques…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setLigneActionOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleLigneAction}
                disabled={ligneActionLoading || (ligneActionStatut === 'SUBSTITUE' && !ligneActionProduitId)}
                className={`flex items-center gap-2 px-5 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 ${
                  ligneActionStatut === 'LIVRE'        ? 'bg-emerald-600 hover:bg-emerald-700' :
                  ligneActionStatut === 'INDISPONIBLE' ? 'bg-orange-500 hover:bg-orange-600'  :
                  ligneActionStatut === 'SUBSTITUE'    ? 'bg-blue-600   hover:bg-blue-700'    :
                                                         'bg-red-500    hover:bg-red-600'
                }`}>
                {ligneActionLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Traitement…</>
                  : <>Confirmer</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {factureId !== null && (
        <FactureModal
          creditClientId={factureId}
          onClose={() => setFactureId(null)}
        />
      )}
    </div>
  );
}
