"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard, Search, RefreshCw, Loader2, Plus, X, Eye,
  CheckCircle2, AlertCircle, TrendingDown, Calendar, Banknote,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, User,
  PackageCheck, ArrowLeftRight, XCircle, Receipt,
} from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import DashboardBackButton from "@/components/DashboardBackButton";
import FactureModal from "@/components/FactureModal";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LigneCreditDetail {
  id: number;
  produitNom: string;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  montantLigne: number;
  statut: string;
  estNouveauProduit: boolean;
  produitNomSaisi: string | null;
  notes: string | null;
  dateTraitement: string | null;
  produit: { id: number; nom: string } | null;
  produitSubstitut: { id: number; nom: string } | null;
  traitePar: { id: number; nom: string; prenom: string } | null;
}

interface CreditClient {
  id: number;
  reference: string;
  statut: string;
  montantTotal: number;
  montantRembourse: number;
  soldeRestant: number;
  dureeJours: number;
  dateDebut: string;
  dateEcheanceFin: string;
  montantJournalier: number;
  createdAt: string;
  client: { id: number; nom: string; prenom: string; codeClient: string | null; telephone: string };
  creePar: { id: number; nom: string; prenom: string };
  _count: { lignes: number; remboursements: number };
}

interface CreditDetail extends CreditClient {
  validePar: { id: number; nom: string; prenom: string } | null;
  dateValidation: string | null;
  tauxPenalite: number;
  garantie: string | null;
  observations: string | null;
  lignes: LigneCreditDetail[];
  echeances: { id: number; numeroEcheance: number; dateEcheance: string; montantDu: number; montantPaye: number; statut: string }[];
  remboursements: { id: number; montant: number; dateRemboursement: string; modePaiement: string; enregistrePar: { id: number; nom: string; prenom: string } }[];
}

interface CreditsResponse {
  data: CreditClient[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUT_STYLE: Record<string, string> = {
  ACTIF:     "bg-emerald-100 text-emerald-700",
  EN_RETARD: "bg-red-100 text-red-700",
  SOLDE:     "bg-gray-100 text-gray-600",
  ANNULE:    "bg-gray-50 text-gray-400",
};
const STATUT_LABEL: Record<string, string> = {
  ACTIF:     "Actif",
  EN_RETARD: "En retard",
  SOLDE:     "Soldé",
  ANNULE:    "Annulé",
};

const LIGNE_STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE:   "bg-amber-100 text-amber-700",
  LIVRE:        "bg-emerald-100 text-emerald-700",
  INDISPONIBLE: "bg-orange-100 text-orange-700",
  SUBSTITUE:    "bg-blue-100 text-blue-700",
  ANNULE:       "bg-gray-100 text-gray-500",
};
const LIGNE_STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE:   "En attente",
  LIVRE:        "Livré",
  INDISPONIBLE: "Indisponible",
  SUBSTITUE:    "Substitué",
  ANNULE:       "Annulé",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RVCCreditsPage() {
  const [search,      setSearch]      = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statut,      setStatut]      = useState("");
  const [page,        setPage]        = useState(1);
  const LIMIT = 20;

  const [detailCredit,  setDetailCredit]  = useState<CreditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showEcheances, setShowEcheances] = useState(false);
  const [factureId,     setFactureId]     = useState<number | null>(null);

  // Ligne action states
  const [ligneActionOpen,        setLigneActionOpen]        = useState(false);
  const [ligneActionCreditId,    setLigneActionCreditId]    = useState<number | null>(null);
  const [ligneActionLigneId,     setLigneActionLigneId]     = useState<number | null>(null);
  const [ligneActionStatut,      setLigneActionStatut]      = useState("");
  const [ligneActionNotes,       setLigneActionNotes]       = useState("");
  const [ligneActionProduitId,   setLigneActionProduitId]   = useState("");
  const [ligneActionProdSearch,  setLigneActionProdSearch]  = useState("");
  const [ligneActionProdResults, setLigneActionProdResults] = useState<{ id: number; nom: string; reference: string | null }[]>([]);
  const [ligneActionProdLoading, setLigneActionProdLoading] = useState(false);
  const [ligneActionLoading,     setLigneActionLoading]     = useState(false);
  const [ligneActionError,       setLigneActionError]       = useState("");

  const query = new URLSearchParams({
    page: String(page), limit: String(LIMIT),
    ...(search && { search }),
    ...(statut && { statut }),
  }).toString();

  const { data: res, loading, refetch } = useApi<CreditsResponse>(`/api/rvc/credits?${query}`);
  const credits = res?.data ?? [];
  const meta    = res?.meta;

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailCredit(null);
    setShowEcheances(false);
    try {
      const r = await fetch(`/api/rvc/credits/${id}`);
      const j = await r.json();
      if (r.ok) setDetailCredit(j.data);
      else toast.error(j.error ?? "Erreur");
    } catch { toast.error("Erreur réseau"); }
    finally { setDetailLoading(false); }
  };

  const openLigneAction = (creditId: number, ligneId: number, statut: string) => {
    setLigneActionCreditId(creditId);
    setLigneActionLigneId(ligneId);
    setLigneActionStatut(statut);
    setLigneActionNotes("");
    setLigneActionProduitId("");
    setLigneActionProdSearch("");
    setLigneActionProdResults([]);
    setLigneActionError("");
    setLigneActionOpen(true);
  };

  const handleLigneAction = async () => {
    if (!ligneActionCreditId || !ligneActionLigneId) return;
    if (ligneActionStatut === "SUBSTITUE" && !ligneActionProduitId) {
      setLigneActionError("Sélectionnez un produit substitut"); return;
    }
    setLigneActionLoading(true);
    setLigneActionError("");
    try {
      const r = await fetch(`/api/rvc/credits/${ligneActionCreditId}/lignes/${ligneActionLigneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statut: ligneActionStatut,
          notes: ligneActionNotes || undefined,
          ...(ligneActionStatut === "SUBSTITUE" && { produitSubstitutId: Number(ligneActionProduitId) }),
        }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(`Ligne : ${LIGNE_STATUT_LABEL[ligneActionStatut] ?? ligneActionStatut}`);
        setLigneActionOpen(false);
        if (detailCredit) await openDetail(detailCredit.id);
      } else {
        setLigneActionError(j.error ?? "Erreur");
      }
    } catch { setLigneActionError("Erreur réseau"); }
    finally { setLigneActionLoading(false); }
  };

  // Recherche produit substitut
  useEffect(() => {
    if (ligneActionStatut !== "SUBSTITUE" || ligneActionProdSearch.trim().length < 2) {
      setLigneActionProdResults([]); return;
    }
    setLigneActionProdLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/rvc/produits?search=${encodeURIComponent(ligneActionProdSearch)}&limit=8`);
        const j = await r.json();
        setLigneActionProdResults(j.data ?? []);
      } catch { /* ignore */ }
      finally { setLigneActionProdLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [ligneActionProdSearch, ligneActionStatut]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <DashboardBackButton />
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <CreditCard size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">Crédits clients</h1>
                <p className="text-xs text-gray-500">Suivi des lignes de crédit</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MessagesLink />
              <NotificationBell href="/dashboard/user/notifications" />
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
                placeholder="Référence, client, téléphone…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
            <button onClick={() => { setSearch(searchInput); setPage(1); }}
              className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Chercher
            </button>
            {search && (
              <button onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Tous les statuts</option>
              <option value="ACTIF">Actif</option>
              <option value="EN_RETARD">En retard</option>
              <option value="SOLDE">Soldé</option>
              <option value="ANNULE">Annulé</option>
            </select>
            <Link href="/dashboard/user/responsablesVenteCredit/ventes-credit"
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <Plus size={14} /> Nouveau crédit
            </Link>
            <button onClick={refetch} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading && !res ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…
            </div>
          ) : !credits.length ? (
            <div className="text-center py-20">
              <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Aucun crédit</p>
              <p className="text-gray-300 text-sm mt-1">Créez un premier crédit depuis la page Ventes à Crédit</p>
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
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Solde restant</th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Fin</th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {credits.map((credit) => {
                      const pct = Number(credit.montantTotal) > 0
                        ? Math.min(100, Math.round((Number(credit.montantRembourse) / Number(credit.montantTotal)) * 100))
                        : 0;
                      return (
                        <tr key={credit.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-mono text-xs font-semibold text-gray-700">{credit.reference}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatDate(credit.createdAt)}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-800">{credit.client.prenom} {credit.client.nom}</p>
                            <p className="text-xs text-gray-400">{credit.client.telephone}</p>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <p className="font-semibold text-gray-800">{formatCurrency(Number(credit.montantTotal))}</p>
                            <p className="text-xs text-gray-400">{credit._count.lignes} produit(s)</p>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <p className={`font-bold ${Number(credit.soldeRestant) > 0 && credit.statut !== "SOLDE" ? "text-red-600" : "text-gray-500"}`}>
                              {formatCurrency(Number(credit.soldeRestant))}
                            </p>
                            <div className="w-16 ml-auto mt-1">
                              <div className="w-full bg-gray-100 rounded-full h-1">
                                <div className={`h-1 rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-400"}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-xs text-gray-400 text-right mt-0.5">{pct}%</p>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <p className="text-xs font-medium text-gray-700">{credit.dureeJours}j</p>
                            <p className="text-xs text-gray-400">{formatDate(credit.dateEcheanceFin)}</p>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUT_STYLE[credit.statut] ?? "bg-gray-100 text-gray-600"}`}>
                              {STATUT_LABEL[credit.statut] ?? credit.statut}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openDetail(credit.id)}
                                className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="Voir le détail">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button onClick={() => setFactureId(credit.id)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Facture crédit">
                                <Receipt className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

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

      {/* ── Drawer détail ─────────────────────────────────────────────────────── */}
      {(detailCredit || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailCredit(null)} />
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-gray-900">{detailCredit?.reference ?? "…"}</h3>
                  {detailCredit && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUT_STYLE[detailCredit.statut] ?? ""}`}>
                      {STATUT_LABEL[detailCredit.statut] ?? detailCredit.statut}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {detailCredit && (
                  <button onClick={() => setFactureId(detailCredit.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg">
                    <Receipt className="w-3.5 h-3.5" /> Facture
                  </button>
                )}
                <button onClick={() => setDetailCredit(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…
              </div>
            ) : detailCredit ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* Infos générales */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Montant total",  value: formatCurrency(Number(detailCredit.montantTotal)),     icon: <CreditCard className="w-3.5 h-3.5" /> },
                    { label: "Solde restant",   value: formatCurrency(Number(detailCredit.soldeRestant)),     icon: <TrendingDown className="w-3.5 h-3.5" /> },
                    { label: "Remboursé",       value: formatCurrency(Number(detailCredit.montantRembourse)), icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                    { label: "Montant/jour",    value: formatCurrency(Number(detailCredit.montantJournalier)),icon: <Banknote className="w-3.5 h-3.5" /> },
                    { label: "Début",           value: formatDate(detailCredit.dateDebut),                   icon: <Calendar className="w-3.5 h-3.5" /> },
                    { label: "Fin d'échéance",  value: formatDate(detailCredit.dateEcheanceFin),              icon: <Calendar className="w-3.5 h-3.5" /> },
                  ].map((f) => (
                    <div key={f.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                      <p className="text-xs text-gray-400 flex items-center gap-1">{f.icon}{f.label}</p>
                      <p className="text-sm font-semibold text-gray-800 mt-0.5">{f.value}</p>
                    </div>
                  ))}
                </div>

                {/* Client */}
                <div className="border border-gray-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />Client
                  </p>
                  <p className="text-sm font-semibold text-gray-800">{detailCredit.client.prenom} {detailCredit.client.nom}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{detailCredit.client.telephone}</p>
                  {detailCredit.client.codeClient && <p className="text-xs text-gray-400 font-mono">{detailCredit.client.codeClient}</p>}
                </div>

                {/* Lignes produits */}
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
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${LIGNE_STATUT_STYLE[l.statut] ?? "bg-gray-100 text-gray-500"}`}>
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
                          {l.notes && <div className="mt-1 text-xs text-gray-500 italic">{l.notes}</div>}

                          {l.statut === "EN_ATTENTE" && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <button onClick={() => openLigneAction(detailCredit.id, l.id, "LIVRE")}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg font-medium">
                                <PackageCheck className="w-3 h-3" /> Livré
                              </button>
                              <button onClick={() => openLigneAction(detailCredit.id, l.id, "INDISPONIBLE")}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg font-medium">
                                <AlertCircle className="w-3 h-3" /> Indisponible
                              </button>
                              <button onClick={() => openLigneAction(detailCredit.id, l.id, "SUBSTITUE")}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-medium">
                                <ArrowLeftRight className="w-3 h-3" /> Substituer
                              </button>
                              <button onClick={() => openLigneAction(detailCredit.id, l.id, "ANNULE")}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-medium">
                                <XCircle className="w-3 h-3" /> Annuler
                              </button>
                            </div>
                          )}
                          {(l.statut === "INDISPONIBLE" || l.statut === "SUBSTITUE") && (
                            <div className="mt-2">
                              <button onClick={() => openLigneAction(detailCredit.id, l.id, "ANNULE")}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-medium">
                                <XCircle className="w-3 h-3" /> Annuler
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {detailCredit.echeances.map((e) => {
                          const retard = e.statut !== "PAYE" && new Date(e.dateEcheance) < new Date();
                          return (
                            <div key={e.id} className={`flex items-center gap-3 text-xs rounded-lg px-3 py-2 ${retard ? "bg-red-50" : "bg-gray-50"}`}>
                              <span className="text-gray-400 w-8 text-right font-mono">#{e.numeroEcheance}</span>
                              <span className={`flex-1 ${retard ? "text-red-600" : "text-gray-600"}`}>{formatDate(e.dateEcheance)}</span>
                              <span className="font-medium text-gray-700">{formatCurrency(Number(e.montantDu))}</span>
                              <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
                                e.statut === "PAYE"       ? "bg-emerald-50 text-emerald-600" :
                                e.statut === "PARTIEL"    ? "bg-blue-50 text-blue-600"       :
                                retard                    ? "bg-red-50 text-red-500"          :
                                                            "bg-amber-50 text-amber-600"
                              }`}>
                                {e.statut === "PAYE" ? "Payé" : e.statut === "PARTIEL" ? "Part." : retard ? "Retard" : "Att."}
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
                          <span className="text-gray-400">{r.modePaiement.replace("_", " ")}</span>
                          <span className="font-bold text-emerald-700">{formatCurrency(Number(r.montant))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Modal ligne action ─────────────────────────────────────────────────── */}
      {ligneActionOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {ligneActionStatut === "LIVRE"        && <PackageCheck  className="w-5 h-5 text-emerald-600" />}
                {ligneActionStatut === "INDISPONIBLE" && <AlertCircle   className="w-5 h-5 text-orange-500" />}
                {ligneActionStatut === "SUBSTITUE"    && <ArrowLeftRight className="w-5 h-5 text-blue-600" />}
                {ligneActionStatut === "ANNULE"       && <XCircle       className="w-5 h-5 text-red-500" />}
                <h3 className="text-base font-bold text-gray-900">
                  {ligneActionStatut === "LIVRE"        && "Marquer comme livré"}
                  {ligneActionStatut === "INDISPONIBLE" && "Marquer comme indisponible"}
                  {ligneActionStatut === "SUBSTITUE"    && "Substituer le produit"}
                  {ligneActionStatut === "ANNULE"       && "Annuler cette ligne"}
                </h3>
              </div>
              <button onClick={() => setLigneActionOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3">
              {ligneActionError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{ligneActionError}
                </div>
              )}

              {ligneActionStatut === "SUBSTITUE" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Produit de remplacement <span className="text-red-500">*</span>
                  </label>
                  {ligneActionProduitId ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <span className="text-sm font-medium text-blue-800">
                        {ligneActionProdResults.find(p => String(p.id) === ligneActionProduitId)?.nom ?? `Produit #${ligneActionProduitId}`}
                      </span>
                      <button onClick={() => { setLigneActionProduitId(""); setLigneActionProdSearch(""); setLigneActionProdResults([]); }}
                        className="text-blue-400 hover:text-blue-600 ml-2"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={ligneActionProdSearch}
                        onChange={(e) => setLigneActionProdSearch(e.target.value)}
                        placeholder="Rechercher un produit…"
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
                disabled={ligneActionLoading || (ligneActionStatut === "SUBSTITUE" && !ligneActionProduitId)}
                className={`flex items-center gap-2 px-5 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 ${
                  ligneActionStatut === "LIVRE"        ? "bg-emerald-600 hover:bg-emerald-700" :
                  ligneActionStatut === "INDISPONIBLE" ? "bg-orange-500 hover:bg-orange-600"  :
                  ligneActionStatut === "SUBSTITUE"    ? "bg-blue-600   hover:bg-blue-700"    :
                                                         "bg-red-500    hover:bg-red-600"
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
        <FactureModal creditClientId={factureId} onClose={() => setFactureId(null)} />
      )}
    </div>
  );
}
