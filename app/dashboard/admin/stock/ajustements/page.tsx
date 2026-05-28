"use client";

import React, { useState } from "react";
import {
  CheckCircle, XCircle, Clock, ArrowLeft, ChevronLeft, ChevronRight,
  Package, Store, User, Calendar, MessageSquare, TrendingUp, TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Demande {
  id: number;
  ancienneQuantite: number;
  nouvelleQuantite: number;
  justification: string;
  statut: "EN_ATTENTE" | "PRE_VALIDEE" | "APPROUVE" | "REJETE";
  source: string;
  commentaireValidation: string | null;
  createdAt: string;
  produit:      { id: number; nom: string; reference?: string; unite?: string };
  pointDeVente: { id: number; nom: string; code: string };
  demandeur:    { id: number; nom: string; prenom: string };
  validateur:   { id: number; nom: string; prenom: string } | null;
}

interface DemandesResponse {
  data: Demande[];
  stats: { totalEnAttente: number };
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const STATUT_STYLES = {
  EN_ATTENTE:  { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200",   icon: Clock,        label: "En attente Resp.Appro" },
  PRE_VALIDEE: { bg: "bg-purple-100",  text: "text-purple-700",  border: "border-purple-200",  icon: CheckCircle,  label: "Pré-validée — à approuver" },
  APPROUVE:    { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle,  label: "Approuvé" },
  REJETE:      { bg: "bg-red-100",     text: "text-red-700",     border: "border-red-200",     icon: XCircle,      label: "Rejeté" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AjustementsStockPage() {
  const [filterStatut, setFilterStatut] = useState("PRE_VALIDEE");
  const [page, setPage]                 = useState(1);

  // Modal rejet
  const [rejectId, setRejectId]         = useState<number | null>(null);
  const [commentaire, setCommentaire]   = useState("");

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (filterStatut) params.set("statut", filterStatut);

  const { data: response, loading, refetch } = useApi<DemandesResponse>(
    `/api/admin/stock/ajustements?${params}`
  );

  const [actioning, setActioning] = useState(false);

  const demandes = response?.data ?? [];
  const meta     = response?.meta;
  const totalEnAttente = response?.stats?.totalEnAttente ?? 0;

  const handleApprouver = async (id: number) => {
    setActioning(true);
    try {
      const res = await fetch(`/api/admin/stock/ajustements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROUVE" }),
      });
      if (res.ok) refetch();
    } finally {
      setActioning(false);
    }
  };

  const handleRejeter = async () => {
    if (!rejectId) return;
    await fetch(`/api/admin/stock/ajustements/${rejectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJETE", commentaire }),
    }).then(() => { setRejectId(null); setCommentaire(""); refetch(); });
  };

  const diff = (d: Demande) => d.nouvelleQuantite - d.ancienneQuantite;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/stock" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Ajustements d&apos;inventaire</h1>
          <p className="text-sm text-slate-500">Approbation niveau 3 — pré-validées par le Resp. Approvisionnement</p>
        </div>
        {totalEnAttente > 0 && (
          <span className="flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-xl font-semibold text-sm border border-amber-200">
            <Clock size={16} />
            {totalEnAttente} en attente
          </span>
        )}
      </div>

      {/* Filtre statut */}
      <div className="flex gap-2 flex-wrap">
        {["PRE_VALIDEE", "", "EN_ATTENTE", "APPROUVE", "REJETE"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilterStatut(s); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              filterStatut === s
                ? "bg-orange-600 text-white border-orange-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {s === "" ? "Toutes" : s === "PRE_VALIDEE" ? "À approuver" : s === "EN_ATTENTE" ? "En attente Resp." : s === "APPROUVE" ? "Approuvées" : "Rejetées"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : demandes.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucune demande</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Produit</th>
                  <th className="px-5 py-3 text-left">PDV</th>
                  <th className="px-5 py-3 text-right">Ancien</th>
                  <th className="px-5 py-3 text-right">Nouveau</th>
                  <th className="px-5 py-3 text-right">Écart</th>
                  <th className="px-5 py-3 text-left">Justification</th>
                  <th className="px-5 py-3 text-left">Demandeur</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Statut</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {demandes.map((d) => {
                  const ecart  = diff(d);
                  const style  = STATUT_STYLES[d.statut];
                  const IconStatut = style.icon;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      {/* Produit */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                            <Package size={14} className="text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{d.produit.nom}</p>
                            {d.produit.reference && (
                              <p className="text-xs text-slate-400 font-mono">{d.produit.reference}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* PDV */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Store size={13} className="text-slate-400" />
                          <span className="text-slate-700">{d.pointDeVente.nom}</span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono">{d.pointDeVente.code}</p>
                      </td>

                      {/* Ancien */}
                      <td className="px-5 py-4 text-right">
                        <span className="font-mono font-medium text-slate-700">{d.ancienneQuantite}</span>
                        {d.produit.unite && <span className="text-xs text-slate-400 ml-1">{d.produit.unite}</span>}
                      </td>

                      {/* Nouveau */}
                      <td className="px-5 py-4 text-right">
                        <span className="font-mono font-semibold text-slate-800">{d.nouvelleQuantite}</span>
                        {d.produit.unite && <span className="text-xs text-slate-400 ml-1">{d.produit.unite}</span>}
                      </td>

                      {/* Écart */}
                      <td className="px-5 py-4 text-right">
                        <span className={`flex items-center justify-end gap-1 font-mono font-bold ${ecart > 0 ? "text-emerald-600" : ecart < 0 ? "text-red-600" : "text-slate-400"}`}>
                          {ecart > 0 ? <TrendingUp size={13} /> : ecart < 0 ? <TrendingDown size={13} /> : null}
                          {ecart > 0 ? "+" : ""}{ecart}
                        </span>
                      </td>

                      {/* Justification */}
                      <td className="px-5 py-4 max-w-[200px]">
                        <p className="text-slate-700 truncate" title={d.justification}>{d.justification}</p>
                        {d.commentaireValidation && (
                          <p className="text-xs text-red-500 truncate mt-0.5" title={d.commentaireValidation}>
                            <MessageSquare size={10} className="inline mr-1" />
                            {d.commentaireValidation}
                          </p>
                        )}
                      </td>

                      {/* Demandeur */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          <span className="text-slate-700">{d.demandeur.prenom} {d.demandeur.nom}</span>
                        </div>
                        <p className="text-xs text-slate-400">{d.source}</p>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Calendar size={12} />
                          <span className="text-xs">{formatDate(d.createdAt)}</span>
                        </div>
                      </td>

                      {/* Statut */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                          <IconStatut size={12} />
                          {style.label}
                        </span>
                        {d.validateur && (
                          <p className="text-xs text-slate-400 mt-0.5">par {d.validateur.prenom} {d.validateur.nom}</p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        {d.statut === "PRE_VALIDEE" ? (
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              onClick={() => handleApprouver(d.id)}
                              disabled={actioning}
                              title="Approuver — applique le stock"
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              <CheckCircle size={13} />
                              Approuver
                            </button>
                            <button
                              onClick={() => { setRejectId(d.id); setCommentaire(""); }}
                              title="Rejeter"
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors"
                            >
                              <XCircle size={13} />
                              Rejeter
                            </button>
                          </div>
                        ) : d.statut === "EN_ATTENTE" ? (
                          <span className="text-xs text-amber-600 text-center block">En attente Resp.</span>
                        ) : (
                          <span className="text-xs text-slate-400 text-center block">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {meta.total} demande{meta.total > 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-slate-700 px-2">
              Page {page} / {meta.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal rejet */}
      {rejectId !== null && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setRejectId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800">Rejeter la demande</h3>
              <p className="text-sm text-slate-500">Indiquez la raison du rejet (recommandé)</p>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Raison du rejet..."
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none bg-slate-50"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setRejectId(null)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRejeter}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <XCircle size={15} />
                  Confirmer le rejet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
