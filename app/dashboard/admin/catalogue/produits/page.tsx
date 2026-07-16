"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Package, Plus, Search, ArrowLeft, Loader2, Pencil, Archive, Filter, Boxes, Layers, ShieldCheck, Tag, Eye,
  FileDown, FileSpreadsheet, Printer, ChevronDown, LayoutDashboard, Upload, CalendarClock, Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { exportToXlsx } from "@/lib/exportXlsx";
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
  const [familleId, setFamilleId] = useState("");
  const [categorieId, setCategorieId] = useState("");
  const [marqueId, setMarqueId] = useState("");
  const [refs, setRefs] = useState<Referentiels | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const LIMIT = 20;

  // Query string des filtres courants (pour la page d'impression du catalogue).
  const filtresQuery = new URLSearchParams({
    ...(search && { search }), ...(statut && { statut }),
    ...(familleId && { familleId }), ...(categorieId && { categorieId }), ...(marqueId && { marqueId }),
  }).toString();

  const exporterExcel = async () => {
    setExporting(true); setDocsOpen(false);
    try {
      const q = new URLSearchParams({
        page: "1", limit: "1000",
        ...(search && { search }), ...(statut && { statut }),
        ...(familleId && { familleId }), ...(categorieId && { categorieId }), ...(marqueId && { marqueId }),
      });
      const r = await fetch(`/api/admin/catalogue/produits?${q}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      const data = j.data as ProduitRow[];
      if (data.length === 0) { toast.error("Aucun produit à exporter"); return; }
      await exportToXlsx(
        data,
        [
          { label: "Code produit", key: "codeProduit", type: "text" },
          { label: "Référence", key: "reference", type: "text" },
          { label: "Nom", key: "nom", type: "text" },
          { label: "Nom commercial", key: "nomCommercial", type: "text" },
          { label: "Famille", key: "famille", type: "text", format: (v) => (v as ProduitRow["famille"])?.nom ?? "" },
          { label: "Catégorie", key: "categorieProduit", type: "text", format: (v) => (v as ProduitRow["categorieProduit"])?.nom ?? "" },
          { label: "Marque", key: "marque", type: "text", format: (v) => (v as ProduitRow["marque"])?.nom ?? "" },
          { label: "Code-barres", key: "codeBarre", type: "text" },
          { label: "Prix vente", key: "prixUnitaire", type: "currency" },
          { label: "Prix achat", key: "prixAchat", type: "currency" },
          { label: "Statut", key: "statut", type: "text", format: (v) => STATUT_LABEL[v as string] ?? String(v) },
        ],
        `catalogue-${new Date().toISOString().slice(0, 10)}.xlsx`,
        { sheetName: "Catalogue", title: "Catalogue produits", currency: "XOF" },
      );
      toast.success(`${data.length} produit(s) exporté(s)`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Export impossible"); }
    finally { setExporting(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page), limit: String(LIMIT),
        ...(search && { search }), ...(statut && { statut }),
        ...(familleId && { familleId }), ...(categorieId && { categorieId }), ...(marqueId && { marqueId }),
      });
      const r = await fetch(`/api/admin/catalogue/produits?${q}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setRows(j.data); setTotal(j.meta.total);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, [page, search, statut, familleId, categorieId, marqueId]);

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
      <div className="px-3 py-4 sm:p-6 max-w-7xl mx-auto space-y-5">
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2"><Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" /> Catalogue produits</h2>
            <p className="text-sm text-gray-400">{total} produit(s) au catalogue.</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <div className="relative">
              <button onClick={() => setDocsOpen((o) => !o)} onBlur={() => setTimeout(() => setDocsOpen(false), 150)}
                className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Documents <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {docsOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-1 w-64 max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                  <button onClick={exporterExcel} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exporter en Excel
                  </button>   
                  <Link href={`/dashboard/admin/catalogue/impression${filtresQuery ? `?${filtresQuery}` : ""}`} onMouseDown={(e) => e.preventDefault()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Printer className="w-4 h-4 text-blue-600" /> Imprimer le catalogue
                  </Link>
                  <Link href="/dashboard/admin/catalogue/etiquettes" onMouseDown={(e) => e.preventDefault()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Tag className="w-4 h-4 text-blue-600" /> Étiquettes (codes-barres / QR)
                  </Link>
                  <div className="my-1 border-t border-gray-100" />
                  <Link href="/dashboard/admin/catalogue/import" onMouseDown={(e) => e.preventDefault()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Upload className="w-4 h-4 text-violet-600" /> Importer des produits
                  </Link>
                  <a href="/api/admin/catalogue/export?format=csv" onMouseDown={(e) => e.preventDefault()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <FileDown className="w-4 h-4 text-slate-500" /> Exporter en CSV
                  </a>
                </div>
              )}
            </div>
            <Link href="/dashboard/admin/catalogue/tableau-bord"
              className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              <LayoutDashboard className="w-4 h-4" /> Tableau de bord
            </Link>
            <Link href="/dashboard/admin/catalogue/peremptions"
              className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              <CalendarClock className="w-4 h-4" /> Péremptions
            </Link>
            <Link href="/dashboard/admin/catalogue/vues"
              className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              <Users className="w-4 h-4" /> Vues
            </Link>
            <Link href="/dashboard/admin/catalogue/promotions"
              className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              <Tag className="w-4 h-4" /> Promotions
            </Link>
            <Link href="/dashboard/admin/catalogue/prix-validation"
              className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              <ShieldCheck className="w-4 h-4" /> Validation prix
            </Link>
            <Link href="/dashboard/admin/catalogue/referentiels"
              className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              <Layers className="w-4 h-4" /> Référentiels
            </Link>
            <button onClick={() => { setEditId(null); setModalOpen(true); }}
              className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> Nouveau produit
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nom, code produit, référence, code-barres…"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tous les statuts</option>
            {Object.keys(STATUT_LABEL).map((s) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
          </select>
          <select value={familleId} onChange={(e) => { setFamilleId(e.target.value); setPage(1); }}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Toutes familles</option>
            {refs?.familles.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
          <select value={categorieId} onChange={(e) => { setCategorieId(e.target.value); setPage(1); }}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Toutes catégories</option>
            {refs?.categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select value={marqueId} onChange={(e) => { setMarqueId(e.target.value); setPage(1); }}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Toutes marques</option>
            {refs?.marques.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          {(statut || familleId || categorieId || marqueId || search) && (
            <button onClick={() => { setStatut(""); setFamilleId(""); setCategorieId(""); setMarqueId(""); setSearchInput(""); setPage(1); }}
              className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700">Réinitialiser</button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center text-gray-400"><Filter className="w-8 h-8 mx-auto mb-2 opacity-40" /> Aucun produit trouvé.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[950px] w-full text-sm">
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
                        <div className="flex items-start gap-3">
                          <div className="sm:w-12 w-10 sm:h-12 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                            {p.imagePrincipaleUrl
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={p.imagePrincipaleUrl} alt="" className="w-full h-full object-cover" />
                              : <Boxes className="w-5 h-5 text-slate-300" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link href={`/dashboard/admin/catalogue/produits/${p.id}`} className="font-medium text-gray-800 truncate hover:text-blue-600 hover:underline block">{p.nom}</Link>
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
                        <div className="flex justify-center flex-wrap gap-1.5">
                          <Link href={`/dashboard/admin/catalogue/produits/${p.id}`} title="Voir la fiche" className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Eye className="w-4 h-4" /></Link>
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
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="w-full sm:w-auto px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 bg-white">Précédent</button>
            <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="w-full sm:w-auto px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 bg-white">Suivant</button>
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
