"use client";

import React, { useState } from "react";
import {
  ArrowLeft, Package, Store, TrendingUp, BarChart3,
  ChevronLeft, ChevronRight, Filter, RefreshCw, ShoppingCart,
  CheckCircle, X, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Produit {
  id: number;
  nom: string;
  unite?: string | null;
  prixUnitaire: string;
  reference?: string | null;
}

interface PDV {
  id: number;
  nom: string;
  code: string;
}

interface Prevision {
  produitId: number;
  produit: Produit | null;
  pointDeVenteId: number | null;
  pointDeVente: PDV | null;
  totalQuantite: number;
  totalEstime: number;
  nbSouscriptions: number;
}

interface PrevisionsResponse {
  previsions: Prevision[];
  pdvs: PDV[];
  stats: { totalProduits: number; totalQuantite: number; totalPdvs: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

// Regroupe les prévisions par PDV pour la modale
function groupByPdv(previsions: Prevision[]) {
  const map = new Map<string, { pdv: PDV | null; lignes: Prevision[] }>();
  for (const p of previsions) {
    const key = String(p.pointDeVenteId ?? "null");
    if (!map.has(key)) map.set(key, { pdv: p.pointDeVente, lignes: [] });
    map.get(key)!.lignes.push(p);
  }
  return Array.from(map.values());
}

// ─── Modal Confirmation ───────────────────────────────────────────────────────

interface ModalCommandeProps {
  previsions: Prevision[];
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function ModalCommande({ previsions, onClose, onConfirm, loading }: ModalCommandeProps) {
  const groups = groupByPdv(previsions);
  const totalProduits = previsions.length;
  const totalQte = previsions.reduce((s, p) => s + p.totalQuantite, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <ShoppingCart size={18} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Créer commande(s) interne(s)</h3>
              <p className="text-xs text-slate-500">{groups.length} PDV · {totalProduits} produit(s) · {totalQte.toLocaleString("fr-FR")} unités</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3 max-h-72 overflow-y-auto">
          <p className="text-sm text-slate-600">
            Une réception interne sera créée par point de vente (statut <span className="font-medium text-blue-600">En cours</span>). Elle apparaîtra dans <span className="font-medium">Approvisionnements</span> et les produits seront mis en transit dans le stock. La logistique / le magasinier devra confirmer la réception.
          </p>
          <div className="space-y-2">
            {groups.map((g, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Store size={14} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    {g.pdv?.nom ?? "PDV non assigné"}
                  </span>
                  {g.pdv?.code && (
                    <span className="text-xs text-slate-400 font-mono">{g.pdv.code}</span>
                  )}
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {g.lignes.length} produit{g.lignes.length > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle size={15} />
            )}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function PrevisionsPage() {
  const [filterPdvId, setFilterPdvId] = useState("");
  const [page,        setPage]        = useState(1);
  const [showModal,   setShowModal]   = useState(false);

  const queryParams = new URLSearchParams();
  if (filterPdvId) queryParams.set("pdvId", filterPdvId);

  const { data, loading, refetch } = useApi<PrevisionsResponse>(
    `/api/logistique/previsions?${queryParams}`
  );

  const { mutate: creerCommandes, loading: creating } = useMutation<
    Array<{ id: number; reference: string; pdvId: number | null; nbLignes: number }>,
    { lignes: Array<{ produitId: number; pointDeVenteId: number | null; quantite: number }> }
  >("/api/admin/commandes-internes", "POST");

  const allPrevisions = data?.previsions ?? [];
  const pdvs          = data?.pdvs       ?? [];
  const stats         = data?.stats;

  // Pagination côté client (les données sont déjà agrégées)
  const totalPages  = Math.ceil(allPrevisions.length / PAGE_SIZE);
  const previsions  = allPrevisions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleCreerCommandes() {
    const lignes = allPrevisions
      .filter(p => p.produitId)
      .map(p => ({ produitId: p.produitId, pointDeVenteId: p.pointDeVenteId, quantite: p.totalQuantite }));

    if (!lignes.length) {
      toast.error("Aucune ligne avec produit confirmé à commander");
      return;
    }

    const result = await creerCommandes({ lignes });
    if (result) {
      toast.success(`${result.length} commande(s) interne(s) créée(s) avec succès`);
      setShowModal(false);
    } else {
      toast.error("Erreur lors de la création des commandes");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-emerald-50/10 font-['DM_Sans',sans-serif] p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/packs"
            className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800">Prévisions d&apos;approvisionnement</h1>
            <p className="text-sm text-slate-500">
              Agrégat des produits confirmés dans les souscriptions — par produit et point de vente
            </p>
          </div>
          <button onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition-colors">
            <RefreshCw size={14} /> Actualiser
          </button>
          {allPrevisions.length > 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
              <ShoppingCart size={14} /> Créer commande interne
            </button>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
              <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <Package size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.totalProduits}</p>
                <p className="text-sm text-slate-500">Produits distincts</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
              <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.totalQuantite.toLocaleString("fr-FR")}</p>
                <p className="text-sm text-slate-500">Quantité totale demandée</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
              <div className="w-11 h-11 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                <Store size={20} className="text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.totalPdvs}</p>
                <p className="text-sm text-slate-500">PDVs concernés</p>
              </div>
            </div>
          </div>
        )}

        {/* Filtre PDV */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <label className="text-sm font-medium text-slate-600 shrink-0">Filtrer par PDV :</label>
          <select value={filterPdvId}
            onChange={e => { setFilterPdvId(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-slate-300 outline-none bg-white">
            <option value="">Tous les PDVs ({allPrevisions.length} lignes)</option>
            {pdvs.map(pdv => (
              <option key={pdv.id} value={String(pdv.id)}>
                {pdv.nom} ({allPrevisions.filter(p => p.pointDeVenteId === pdv.id).length} produits)
              </option>
            ))}
          </select>
          {filterPdvId && (
            <span className="ml-auto text-xs text-slate-500 flex items-center gap-1">
              <AlertCircle size={12} className="text-amber-500" />
              Le bouton &quot;Créer commande&quot; se basera sur ce filtre PDV
            </span>
          )}
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : previsions.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucune prévision disponible</p>
              <p className="text-sm mt-1">Les prévisions apparaissent dès que des lignes de souscription sont confirmées</p>
              <Link href="/dashboard/admin/souscriptions/lignes"
                className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:underline mt-3">
                Traiter les demandes en attente →
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 text-left">Produit</th>
                      <th className="px-5 py-3 text-left">Point de vente</th>
                      <th className="px-5 py-3 text-right">Qté totale demandée</th>
                      <th className="px-5 py-3 text-right">Valeur estimée</th>
                      <th className="px-5 py-3 text-right">Souscriptions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previsions.map((p, idx) => (
                      <tr key={`${p.produitId}-${p.pointDeVenteId ?? idx}`}
                        className="hover:bg-slate-50/80 transition-colors">

                        {/* Produit */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                              <Package size={13} className="text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{p.produit?.nom ?? `Produit #${p.produitId}`}</p>
                              {p.produit?.reference && (
                                <p className="text-xs text-slate-400 font-mono">{p.produit.reference}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* PDV */}
                        <td className="px-5 py-4">
                          {p.pointDeVente ? (
                            <>
                              <div className="flex items-center gap-1.5 text-sm text-slate-700">
                                <Store size={12} className="text-slate-400" /> {p.pointDeVente.nom}
                              </div>
                              <p className="text-xs text-slate-400 font-mono mt-0.5">{p.pointDeVente.code}</p>
                            </>
                          ) : (
                            <span className="text-slate-400 text-sm">PDV non assigné</span>
                          )}
                        </td>

                        {/* Qté totale */}
                        <td className="px-5 py-4 text-right">
                          <span className="font-mono font-bold text-slate-800 text-base">
                            {p.totalQuantite.toLocaleString("fr-FR")}
                          </span>
                          {p.produit?.unite && (
                            <span className="text-xs text-slate-400 ml-1">{p.produit.unite}</span>
                          )}
                        </td>

                        {/* Valeur estimée */}
                        <td className="px-5 py-4 text-right">
                          {p.totalEstime > 0 ? (
                            <span className="font-medium text-slate-700">{formatCurrency(p.totalEstime)}</span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Nb souscriptions */}
                        <td className="px-5 py-4 text-right">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-700 rounded-full font-semibold text-sm">
                            {p.nbSouscriptions}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
                  <p className="text-sm text-slate-500">
                    {allPrevisions.length} ligne{allPrevisions.length > 1 ? "s" : ""} au total
                  </p>
                  <div className="flex items-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-medium text-slate-700">{page} / {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                      className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Retour traitement */}
        <div className="text-center">
          <Link href="/dashboard/admin/souscriptions/lignes"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            ← Retour au tableau de traitement
          </Link>
        </div>

      </div>

      {/* Modal confirmation commande */}
      {showModal && (
        <ModalCommande
          previsions={allPrevisions}
          onClose={() => setShowModal(false)}
          onConfirm={handleCreerCommandes}
          loading={creating}
        />
      )}
    </div>
  );
}
