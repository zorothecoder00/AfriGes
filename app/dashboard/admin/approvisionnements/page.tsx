"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Package, CheckCircle, XCircle, Clock, RefreshCw,
  ChevronDown, ChevronUp, Truck, Search, ChevronLeft, ChevronRight, ArrowLeft, ClipboardList, TrendingUp,
  BarChart3, Plus, X, Loader2, PackageCheck,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LigneReception {
  id: number;
  produitId: number;
  quantiteAttendue: number;
  quantiteRecue: number | null;
  prixUnitaire: string | null;
  produit: { id: number; nom: string; unite: string | null; prixUnitaire: string; prixAchat: string | null };
}

interface Reception {
  id: number;
  reference: string;
  type: "FOURNISSEUR" | "INTERNE";
  statut: "BROUILLON" | "EN_COURS" | "RECU" | "VALIDE" | "ANNULE";
  pointDeVente: { id: number; nom: string; code: string; type: string };
  fournisseur: { id: number; nom: string } | null;
  fournisseurNom: string | null;
  receptionnePar: { id: number; nom: string; prenom: string };
  validePar: { id: number; nom: string; prenom: string } | null;
  datePrevisionnelle: string;
  dateReception: string | null;
  notes: string | null;
  notesQualite: string | null;
  lignes: LigneReception[];
  createdAt: string;
}

interface ApprosResponse {
  data: Reception[];
  stats: { pendingApproval: number; totalValide?: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface PDV { id: number; nom: string; code: string }
interface FournisseurOption { id: number; nom: string; code: string }
interface ProduitOption { id: number; nom: string; codeProduit: string | null }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUT_LABELS: Record<Reception["statut"], string> = {
  BROUILLON: "En attente d'approbation",
  EN_COURS:  "Approuvée / En réception",
  RECU:      "Reçue",
  VALIDE:    "Validée",
  ANNULE:    "Annulée / Rejetée",
};

const STATUT_STYLES: Record<Reception["statut"], { bg: string; text: string; border: string }> = {
  BROUILLON: { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200" },
  EN_COURS:  { bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200" },
  RECU:      { bg: "bg-cyan-50",    text: "text-cyan-700",   border: "border-cyan-200" },
  VALIDE:    { bg: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-200" },
  ANNULE:    { bg: "bg-red-50",     text: "text-red-700",    border: "border-red-200" },
};

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdminApprovisionnementsPage() {
  const [statutFilter, setStatutFilter] = useState("");
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [expandedId, setExpandedId]     = useState<number | null>(null);

  // Modal approbation
  const [approModal, setApproModal]   = useState<Reception | null>(null);
  const [lignesPrix, setLignesPrix]   = useState<Record<number, string>>({});

  // Modal rejet
  const [rejetModal, setRejetModal]   = useState<Reception | null>(null);
  const [motifRejet, setMotifRejet]   = useState("");

  // Modal validation (réception physique)
  const [validerModal, setValiderModal] = useState<Reception | null>(null);
  const [lignesRecues, setLignesRecues] = useState<Record<number, { quantiteRecue: string; quantiteRefusee: string; quantiteEndommagee: string }>>({});
  const [notesQualite, setNotesQualite] = useState("");

  // Modal création (réception directe, créée et validée en une fois)
  const [showCreate, setShowCreate] = useState(false);

  const queryParams = new URLSearchParams({ limit: "20", page: String(page) });
  if (statutFilter) queryParams.set("statut", statutFilter);

  const { data, loading, refetch } = useApi<ApprosResponse>(
    `/api/admin/approvisionnements?${queryParams}`
  );

  const activeIdRef = useRef<number>(0);
  const { mutate: patchReception, loading: patching } = useMutation<Reception, object>(
    () => `/api/logistique/receptions/${activeIdRef.current}`,
    "PATCH"
  );

  const receptions     = data?.data ?? [];
  const pendingApproval = data?.stats?.pendingApproval ?? 0;
  const totalPages      = data?.meta?.totalPages ?? 1;
  const totalReceptions = data?.meta?.total ?? 0;

  // Filtre client par recherche
  const filtered = useMemo(() => {
    if (!search.trim()) return receptions;
    const q = search.toLowerCase();
    return receptions.filter(r =>
      r.reference.toLowerCase().includes(q) ||
      r.pointDeVente.nom.toLowerCase().includes(q) ||
      (r.fournisseur?.nom ?? r.fournisseurNom ?? "").toLowerCase().includes(q) ||
      `${r.receptionnePar.prenom} ${r.receptionnePar.nom}`.toLowerCase().includes(q)
    );
  }, [receptions, search]);

  // ─ Ouvrir modal approbation ──────────────────────────────────────────────
  function openApproModal(r: Reception) {
    setApproModal(r);
    const init: Record<number, string> = {};
    r.lignes.forEach(l => { init[l.id] = l.prixUnitaire ?? ""; });
    setLignesPrix(init);
  }

  // ─ Approuver ─────────────────────────────────────────────────────────────
  async function handleApprouver() {
    if (!approModal) return;
    const lp = Object.entries(lignesPrix)
      .map(([ligneId, prixUnitaire]) => ({ ligneId: Number(ligneId), prixUnitaire: prixUnitaire || null }));

    activeIdRef.current = approModal.id;
    const result = await patchReception({ action: "DEMARRER", lignesPrix: lp });
    if (result) {
      toast.success(`Commande ${approModal.reference} approuvée — prête pour la réception physique`);
      setApproModal(null);
      refetch();
    }
  }

  // ─ Rejeter ───────────────────────────────────────────────────────────────
  async function handleRejeter() {
    if (!rejetModal) return;
    activeIdRef.current = rejetModal.id;
    const result = await patchReception({ action: "REJETER", motif: motifRejet });
    if (result) {
      toast.success(`Commande ${rejetModal.reference} rejetée`);
      setRejetModal(null);
      setMotifRejet("");
      refetch();
    }
  }

  // ─ Ouvrir modal validation (réception physique) ───────────────────────────
  function openValiderModal(r: Reception) {
    setValiderModal(r);
    const init: Record<number, { quantiteRecue: string; quantiteRefusee: string; quantiteEndommagee: string }> = {};
    r.lignes.forEach(l => { init[l.id] = { quantiteRecue: String(l.quantiteAttendue), quantiteRefusee: "0", quantiteEndommagee: "0" }; });
    setLignesRecues(init);
    setNotesQualite("");
  }

  // ─ Valider (réception physique + mise en stock) ───────────────────────────
  async function handleValider() {
    if (!validerModal) return;
    const lr = Object.entries(lignesRecues).map(([ligneId, v]) => ({
      ligneId: Number(ligneId),
      quantiteRecue: Number(v.quantiteRecue || 0),
      quantiteRefusee: Number(v.quantiteRefusee || 0),
      quantiteEndommagee: Number(v.quantiteEndommagee || 0),
    }));
    activeIdRef.current = validerModal.id;
    const result = await patchReception({ action: "VALIDER", lignesRecues: lr, notesQualite: notesQualite || undefined });
    if (result) {
      toast.success(`Réception ${validerModal.reference} validée — stock mis à jour`);
      setValiderModal(null);
      refetch();
    }
  }

  // ─ Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative isolate min-h-screen bg-gradient-to-br from-cream-100 via-primary-50/40 to-brand-50/50 p-6 space-y-6 overflow-hidden">
      {/* Aurora décorative — halos flous, aux couleurs du logo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-40 -left-24 w-[34rem] h-[34rem] bg-primary-300/30 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-28 w-[30rem] h-[30rem] bg-brand-400/30 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-2 transition-colors">
            <ArrowLeft size={15} />Tableau de bord
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand-100 shrink-0">
              <Truck className="w-5 h-5 text-brand-700" />
            </span>
            Approvisionnements
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-12">
            Approuvez les commandes d&apos;achat du responsable approvisionnement · vérifiez les prix et fournisseurs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/user/logistiquesApprovisionnements/fournisseurs" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Truck size={15} />Fournisseurs
          </Link>
          <Link href="/dashboard/user/logistiquesApprovisionnements/mrp" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <TrendingUp size={15} />MRP
          </Link>
          <Link href="/dashboard/admin/demandes-achat" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <ClipboardList size={15} />Demandes d&apos;achat
          </Link>
          <Link href="/dashboard/admin/rfq" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Search size={15} />RFQ
          </Link>
          <Link href="/dashboard/admin/bons-commande-fournisseur" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <ClipboardList size={15} />Bons de commande
          </Link>
          <Link href="/dashboard/user/logistiquesApprovisionnements/dashboard" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <BarChart3 size={15} />Tableau de bord
          </Link>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors">
            <Plus size={15} />Nouvelle réception
          </button>
          <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <RefreshCw size={15} />Actualiser
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-2xl border p-5 ${pendingApproval > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pendingApproval > 0 ? "bg-amber-100" : "bg-slate-100"}`}>
              <Clock size={20} className={pendingApproval > 0 ? "text-amber-600" : "text-slate-500"} />
            </div>
            <div>
              <p className="text-xs text-slate-500">En attente d&apos;approbation</p>
              <p className={`text-2xl font-bold ${pendingApproval > 0 ? "text-amber-700" : "text-slate-700"}`}>{pendingApproval}</p>
            </div>
          </div>
          {pendingApproval > 0 && (
            <p className="text-xs text-amber-600 mt-2 font-medium">Action requise — cliquez sur &quot;Approuver&quot;</p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Truck size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total réceptions</p>
              <p className="text-2xl font-bold text-slate-700">{data?.meta?.total ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Validées</p>
              <p className="text-2xl font-bold text-slate-700">
                {data?.stats?.totalValide ?? receptions.filter(r => r.statut === "VALIDE").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-3 items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par référence, PDV, fournisseur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statutFilter}
          onChange={e => { setStatutFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les statuts</option>
          <option value="BROUILLON">En attente d&apos;approbation</option>
          <option value="EN_COURS">Approuvées / En cours</option>
          <option value="VALIDE">Validées</option>
          <option value="ANNULE">Annulées</option>
        </select>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">Aucune réception trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Référence", "PDV / Fournisseur", "Lignes / Produits", "Date prév.", "Soumis par", "Statut", "Actions"].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => {
                  const st = STATUT_STYLES[r.statut];
                  const isExpanded = expandedId === r.id;
                  const fournisseurNom = r.fournisseur?.nom ?? r.fournisseurNom ?? "—";
                  return (
                    <React.Fragment key={r.id}>
                      <tr className={`hover:bg-slate-50 transition-colors ${r.statut === "BROUILLON" ? "bg-amber-50/30" : ""}`}>
                        <td className="px-5 py-4">
                          <p className="font-mono font-semibold text-slate-800 text-sm">{r.reference}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{r.type}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-800 text-sm">{r.pointDeVente.nom}</p>
                          {r.type === "FOURNISSEUR" && (
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                              <Truck size={11} />{fournisseurNom}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-700">{r.lignes.length} produit(s)</p>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            className="text-xs text-blue-500 flex items-center gap-1 mt-0.5 hover:underline"
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {isExpanded ? "Masquer" : "Voir lignes"}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{formatDate(r.datePrevisionnelle)}</td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-700">{r.receptionnePar.prenom} {r.receptionnePar.nom}</p>
                          <p className="text-xs text-slate-400">{formatDate(r.createdAt)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}>
                            {STATUT_LABELS[r.statut]}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {r.statut === "BROUILLON" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => openApproModal(r)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold transition-colors"
                              >
                                <CheckCircle size={13} />Approuver
                              </button>
                              <button
                                onClick={() => { setRejetModal(r); setMotifRejet(""); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <XCircle size={13} />Rejeter
                              </button>
                            </div>
                          )}
                          {r.statut === "EN_COURS" && (
                            <button
                              onClick={() => openValiderModal(r)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                            >
                              <PackageCheck size={13} />Valider la réception
                            </button>
                          )}
                          {r.statut === "VALIDE" && (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle size={13} />Stock mis à jour
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Lignes détail */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50 px-8 py-4 border-b border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Lignes de commande</p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-slate-500 border-b border-slate-200">
                                  <th className="pb-1.5 text-left font-semibold">Produit</th>
                                  <th className="pb-1.5 text-right font-semibold">Qté attendue</th>
                                  <th className="pb-1.5 text-right font-semibold">Qté reçue</th>
                                  <th className="pb-1.5 text-right font-semibold">Prix achat commandé</th>
                                  <th className="pb-1.5 text-right font-semibold">Prix achat référence</th>
                                  <th className="pb-1.5 text-right font-semibold">Valeur commandée</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.lignes.map(l => {
                                  const prixCommande = l.prixUnitaire ? Number(l.prixUnitaire) : null;
                                  const prixRef = l.produit.prixAchat ? Number(l.produit.prixAchat) : null;
                                  const prixEcart = prixCommande !== null && prixRef !== null && prixRef > 0
                                    ? ((prixCommande - prixRef) / prixRef) * 100
                                    : null;
                                  return (
                                    <tr key={l.id} className="border-b border-slate-100 last:border-0">
                                      <td className="py-2 font-medium text-slate-800">{l.produit.nom}
                                        {l.produit.unite && <span className="text-slate-400 text-xs ml-1">({l.produit.unite})</span>}
                                      </td>
                                      <td className="py-2 text-right font-semibold text-slate-700">{l.quantiteAttendue}</td>
                                      <td className="py-2 text-right text-slate-600">{l.quantiteRecue ?? "—"}</td>
                                      <td className="py-2 text-right">
                                        {prixCommande !== null
                                          ? <span className="font-semibold text-slate-800">{formatCurrency(prixCommande)}</span>
                                          : <span className="text-slate-400 italic text-xs">Non renseigné</span>}
                                        {prixEcart !== null && (
                                          <span className={`block text-xs ${Math.abs(prixEcart) > 10 ? "text-amber-600 font-semibold" : "text-slate-400"}`}>
                                            {prixEcart > 0 ? "+" : ""}{prixEcart.toFixed(1)}% vs réf.
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2 text-right text-slate-500">
                                        {prixRef !== null ? formatCurrency(prixRef) : <span className="italic text-xs">—</span>}
                                      </td>
                                      <td className="py-2 text-right font-bold text-slate-800">
                                        {prixCommande !== null
                                          ? formatCurrency(l.quantiteAttendue * prixCommande)
                                          : "—"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-5 py-3">
          <p className="text-sm text-slate-500">
            Page <strong>{page}</strong> sur <strong>{totalPages}</strong> · {totalReceptions} réception(s) au total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              return p <= totalPages ? (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ) : null;
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Approbation ──────────────────────────────────────────── */}
      {approModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle size={20} className="text-emerald-600" />
                Approuver la commande
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Vérifiez les prix d&apos;achat et le fournisseur avant d&apos;approuver.
                Vous pouvez corriger les prix ici — ils seront enregistrés comme prix d&apos;achat de référence.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Infos commande */}
              <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
                <p><span className="text-slate-500">Référence :</span> <strong>{approModal.reference}</strong></p>
                <p><span className="text-slate-500">PDV :</span> {approModal.pointDeVente.nom}</p>
                {approModal.type === "FOURNISSEUR" && (
                  <p><span className="text-slate-500">Fournisseur :</span> {approModal.fournisseur?.nom ?? approModal.fournisseurNom ?? "Non renseigné"}</p>
                )}
                <p><span className="text-slate-500">Soumis par :</span> {approModal.receptionnePar.prenom} {approModal.receptionnePar.nom}</p>
              </div>

              {/* Lignes avec prix éditables */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  Prix d&apos;achat par produit <span className="text-slate-400 font-normal">(modifiez si nécessaire)</span>
                </p>
                <div className="space-y-3">
                  {approModal.lignes.map(l => (
                    <div key={l.id} className="flex items-center gap-4 p-3 border border-slate-200 rounded-xl">
                      <div className="flex-1">
                        <p className="font-medium text-slate-800 text-sm">{l.produit.nom}</p>
                        <p className="text-xs text-slate-500">Qté : {l.quantiteAttendue} {l.produit.unite ?? ""}</p>
                        {l.produit.prixAchat && (
                          <p className="text-xs text-slate-400">Dernier prix achat : {formatCurrency(Number(l.produit.prixAchat))}</p>
                        )}
                      </div>
                      <div className="w-44">
                        <label className="block text-xs text-slate-500 mb-1">Prix achat (FCFA)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={lignesPrix[l.id] ?? ""}
                          onChange={e => setLignesPrix(prev => ({ ...prev, [l.id]: e.target.value }))}
                          placeholder="Ex: 25000"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="w-28 text-right">
                        <p className="text-xs text-slate-500">Valeur commande</p>
                        <p className="font-bold text-slate-800 text-sm">
                          {lignesPrix[l.id]
                            ? formatCurrency(l.quantiteAttendue * Number(lignesPrix[l.id]))
                            : "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total commande */}
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                  <span className="text-sm font-semibold text-emerald-800">Valeur totale commande</span>
                  <span className="text-lg font-bold text-emerald-700">
                    {formatCurrency(
                      approModal.lignes.reduce((acc, l) => {
                        const px = Number(lignesPrix[l.id] ?? 0);
                        return acc + l.quantiteAttendue * px;
                      }, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => setApproModal(null)}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleApprouver}
                disabled={patching}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle size={16} />
                {patching ? "Approbation…" : "Approuver la commande"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Rejet ────────────────────────────────────────────────── */}
      {rejetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <XCircle size={20} className="text-red-600" />
                Rejeter la commande
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                La commande <strong>{rejetModal.reference}</strong> sera annulée et le transit libéré.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Motif du rejet <span className="text-slate-400">(optionnel)</span></label>
                <textarea
                  rows={3}
                  value={motifRejet}
                  onChange={e => setMotifRejet(e.target.value)}
                  placeholder="Prix trop élevé, fournisseur non homologué, erreur dans la commande…"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => setRejetModal(null)}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleRejeter}
                disabled={patching}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                <XCircle size={16} />
                {patching ? "Rejet…" : "Confirmer le rejet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Validation (réception physique + mise en stock) ────────── */}
      {validerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <PackageCheck size={20} className="text-blue-600" />
                Valider la réception — {validerModal.reference}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Saisissez les quantités effectivement reçues (contrôle qualité/quantité). Le stock sera mis à jour à la validation.
              </p>
            </div>
            <div className="p-6 space-y-3">
              {validerModal.lignes.map((l) => {
                const v = lignesRecues[l.id] ?? { quantiteRecue: "", quantiteRefusee: "0", quantiteEndommagee: "0" };
                return (
                  <div key={l.id} className="p-3 border border-slate-200 rounded-xl">
                    <p className="font-medium text-slate-800 text-sm mb-2">{l.produit.nom} <span className="text-slate-400 font-normal">(attendu : {l.quantiteAttendue} {l.produit.unite ?? ""})</span></p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Qté reçue (bon état)</label>
                        <input type="number" min={0} value={v.quantiteRecue}
                          onChange={(e) => setLignesRecues((prev) => ({ ...prev, [l.id]: { ...v, quantiteRecue: e.target.value } }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Qté refusée</label>
                        <input type="number" min={0} value={v.quantiteRefusee}
                          onChange={(e) => setLignesRecues((prev) => ({ ...prev, [l.id]: { ...v, quantiteRefusee: e.target.value } }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Qté endommagée</label>
                        <input type="number" min={0} value={v.quantiteEndommagee}
                          onChange={(e) => setLignesRecues((prev) => ({ ...prev, [l.id]: { ...v, quantiteEndommagee: e.target.value } }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes qualité (optionnel)</label>
                <textarea rows={2} value={notesQualite} onChange={(e) => setNotesQualite(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setValiderModal(null)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={handleValider} disabled={patching}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                <PackageCheck size={16} />
                {patching ? "Validation…" : "Valider et mettre à jour le stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Création (réception directe créée + validée en une fois) ── */}
      {showCreate && (
        <FormCreerReception onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />
      )}
    </div>
  );
}

function FormCreerReception({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";
  const { data: pdvData } = useApi<{ data: PDV[] }>("/api/admin/pdv?actif=true&limit=100");
  const pdvs = pdvData?.data ?? [];

  const [type, setType] = useState<"FOURNISSEUR" | "INTERNE">("FOURNISSEUR");
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [fournisseurQuery, setFournisseurQuery] = useState("");
  const [fournisseurOptions, setFournisseurOptions] = useState<FournisseurOption[]>([]);
  const [fournisseur, setFournisseur] = useState<FournisseurOption | null>(null);
  const [produitQuery, setProduitQuery] = useState("");
  const [produitOptions, setProduitOptions] = useState<ProduitOption[]>([]);
  const [lignes, setLignes] = useState<{ produit: ProduitOption; quantite: string; prixUnitaire: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function rechercherFournisseur(q: string) {
    setFournisseurQuery(q);
    if (q.trim().length < 2) { setFournisseurOptions([]); return; }
    const r = await fetch(`/api/logistique/fournisseurs?search=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setFournisseurOptions(j.data);
  }

  async function rechercherProduit(q: string) {
    setProduitQuery(q);
    if (q.trim().length < 2) { setProduitOptions([]); return; }
    const r = await fetch(`/api/admin/reclamations/produits-recherche?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setProduitOptions(j.data);
  }

  async function submit() {
    if (!pointDeVenteId) { toast.error("Sélectionnez le point de vente"); return; }
    if (type === "FOURNISSEUR" && !fournisseur) { toast.error("Sélectionnez un fournisseur"); return; }
    if (lignes.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/approvisionnements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, pointDeVenteId: Number(pointDeVenteId), fournisseurId: fournisseur?.id, notes: notes || undefined,
          lignes: lignes.map((l) => ({ produitId: l.produit.id, quantite: Number(l.quantite), prixUnitaire: l.prixUnitaire || undefined })),
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Réception ${j.data.reference} créée et validée — stock mis à jour`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800">Nouvelle réception directe</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
            Cette réception est créée <strong>et validée immédiatement</strong> (statut VALIDE, stock mis à jour tout de suite) —
            à réserver aux cas où la marchandise est déjà physiquement là. Pour un circuit d&apos;approbation en plusieurs
            étapes, utilisez plutôt le Bon de commande fournisseur.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value as "FOURNISSEUR" | "INTERNE")} className={inputCls}>
                <option value="FOURNISSEUR">Fournisseur</option>
                <option value="INTERNE">Interne</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Point de vente / dépôt *</label>
              <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={inputCls}>
                <option value="">Choisir…</option>
                {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
              </select>
            </div>
          </div>
          {type === "FOURNISSEUR" && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Fournisseur *</label>
              {fournisseur ? (
                <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                  <span>{fournisseur.nom} ({fournisseur.code})</span>
                  <button onClick={() => setFournisseur(null)}><X size={14} className="text-slate-400" /></button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={fournisseurQuery} onChange={(e) => rechercherFournisseur(e.target.value)} placeholder="Nom ou code…" className={`${inputCls} pl-8`} />
                  {fournisseurOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {fournisseurOptions.map((f) => <button key={f.id} onClick={() => { setFournisseur(f); setFournisseurOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{f.nom} ({f.code})</button>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Ajouter un produit</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={produitQuery} onChange={(e) => rechercherProduit(e.target.value)} placeholder="Rechercher un produit…" className={`${inputCls} pl-8`} />
              {produitOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {produitOptions.map((p) => (
                    <button key={p.id} onClick={() => { if (!lignes.some((l) => l.produit.id === p.id)) setLignes((prev) => [...prev, { produit: p, quantite: "1", prixUnitaire: "" }]); setProduitOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{p.nom}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {lignes.map((l) => (
            <div key={l.produit.id} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg">
              <span className="text-sm flex-1">{l.produit.nom}</span>
              <input type="number" min={1} value={l.quantite} onChange={(e) => setLignes((prev) => prev.map((x) => x.produit.id === l.produit.id ? { ...x, quantite: e.target.value } : x))} className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" placeholder="Qté" />
              <input type="number" min={0} value={l.prixUnitaire} onChange={(e) => setLignes((prev) => prev.map((x) => x.produit.id === l.produit.id ? { ...x, prixUnitaire: e.target.value } : x))} className="w-28 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" placeholder="Prix achat" />
              <button onClick={() => setLignes((prev) => prev.filter((x) => x.produit.id !== l.produit.id))}><X size={14} className="text-slate-400" /></button>
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}
