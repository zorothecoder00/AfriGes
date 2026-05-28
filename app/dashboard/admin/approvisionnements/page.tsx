"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Package, CheckCircle, XCircle, Clock, AlertTriangle, Plus, RefreshCw,
  ChevronDown, ChevronUp, Store, Truck, Search, Filter, ChevronLeft, ChevronRight, ArrowLeft,
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

  const queryParams = new URLSearchParams({ limit: "20", page: String(page) });
  if (statutFilter) queryParams.set("statut", statutFilter);

  const { data, loading, refetch } = useApi<ApprosResponse>(
    `/api/admin/approvisionnements?${queryParams}`
  );

  const activeIdRef = useRef<number>(0);
  const { mutate: patchReception, loading: patching } = useMutation<Reception, object>(
    () => `/api/admin/approvisionnements/${activeIdRef.current}`,
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
    const result = await patchReception({ action: "APPROUVER", lignesPrix: lp });
    if (result) {
      toast.success(`Commande ${approModal.reference} approuvée — le responsable appro peut procéder à la réception`);
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

  // ─ Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-2 transition-colors">
            <ArrowLeft size={15} />Tableau de bord
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Approvisionnements</h1>
          <p className="text-sm text-slate-500 mt-1">
            Approuvez les commandes d&apos;achat du responsable approvisionnement · vérifiez les prix et fournisseurs
          </p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <RefreshCw size={15} />Actualiser
        </button>
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
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
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
                            <span className="text-xs text-blue-600 font-medium">En attente de réception physique</span>
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
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
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
    </div>
  );
}
