"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Package, Plus, Search, ArrowLeft, Loader2, Pencil, Archive, Filter, Boxes, Layers, ShieldCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import ProduitFormModal, { type Referentiels } from "@/components/catalogue/ProduitFormModal";

interface ProduitRow {
  id: number; codeProduit: string | null; reference: string | null; nom: string; nomCommercial: string | null;
  statut: string; prixUnitaire: number; prixAchat: number | null; alerteStock: number;
  imagePrincipaleUrl: string | null; codeBarre: string | null;
  marque: { id: number; nom: string } | null;
  categorieProduit: { id: number; nom: string } | null;
  famille: { id: number; nom: string } | null;
  _count: { stocks: number };
}

const STATUT_STYLE: Record<string, string> = {
  ACTIF: "bg-emerald-100 text-emerald-700 border-emerald-200",
  EN_ATTENTE: "bg-amber-100 text-amber-700 border-amber-200",
  SUSPENDU: "bg-orange-100 text-orange-700 border-orange-200",
  MASQUE: "bg-slate-100 text-slate-500 border-slate-200",
  ARCHIVE: "bg-gray-100 text-gray-400 border-gray-200",
};
const STATUT_LABEL: Record<string, string> = {
  ACTIF: "Actif", EN_ATTENTE: "En attente", SUSPENDU: "Suspendu", MASQUE: "Masqué", ARCHIVE: "Archivé",
};

export default function CatalogueProduitsPage() {
  const [rows, setRows] = useState<ProduitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("");
  const [refs, setRefs] = useState<Referentiels | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(LIMIT), ...(search && { search }), ...(statut && { statut }) });
      const r = await fetch(`/api/admin/catalogue/produits?${q}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setRows(j.data); setTotal(j.meta.total);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, [page, search, statut]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/catalogue/referentiels").then((r) => r.json()).then((j) => setRefs(j.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const archiver = async (p: ProduitRow) => {
    if (!confirm(`Archiver le produit « ${p.nom} » ? Il ne sera plus commercialisé mais son historique est conservé.`)) return;
    const r = await fetch(`/api/admin/catalogue/produits/${p.id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) { toast.error(j.message ?? "Erreur"); return; }
    toast.success("Produit archivé"); load();
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Package className="w-6 h-6 text-blue-600" /> Catalogue produits</h2>
            <p className="text-sm text-gray-400">{total} produit(s) au catalogue.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/admin/catalogue/prix-validation"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              <ShieldCheck className="w-4 h-4" /> Validation prix
            </Link>
            <Link href="/dashboard/admin/catalogue/referentiels"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              <Layers className="w-4 h-4" /> Référentiels
            </Link>
            <button onClick={() => { setEditId(null); setModalOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> Nouveau produit
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nom, code produit, référence, code-barres…"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tous les statuts</option>
            {Object.keys(STATUT_LABEL).map((s) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center text-gray-400"><Filter className="w-8 h-8 mx-auto mb-2 opacity-40" /> Aucun produit trouvé.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Produit</th>
                    <th className="text-left px-4 py-3 font-semibold">Classification</th>
                    <th className="text-right px-4 py-3 font-semibold">Prix vente</th>
                    <th className="text-right px-4 py-3 font-semibold">Prix achat</th>
                    <th className="text-center px-4 py-3 font-semibold">Statut</th>
                    <th className="text-center px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                            {p.imagePrincipaleUrl
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={p.imagePrincipaleUrl} alt="" className="w-full h-full object-cover" />
                              : <Boxes className="w-5 h-5 text-slate-300" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">{p.nom}</p>
                            <p className="text-[11px] text-gray-400 font-mono">{p.codeProduit ?? "—"}{p.reference ? ` · ${p.reference}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {[p.famille?.nom, p.categorieProduit?.nom, p.marque?.nom].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(p.prixUnitaire)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{p.prixAchat != null ? formatCurrency(p.prixAchat) : "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUT_STYLE[p.statut] ?? ""}`}>{STATUT_LABEL[p.statut] ?? p.statut}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => { setEditId(p.id); setModalOpen(true); }} title="Modifier" className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                          {p.statut !== "ARCHIVE" && (
                            <button onClick={() => archiver(p)} title="Archiver" className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50"><Archive className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 bg-white">Précédent</button>
            <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 bg-white">Suivant</button>
          </div>
        )}
      </div>

      {modalOpen && (
        <ProduitFormModal
          produitId={editId}
          refs={refs}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}
