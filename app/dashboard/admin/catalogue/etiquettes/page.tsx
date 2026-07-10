"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, Printer, Tag, Boxes, ArrowRight, CheckSquare, Square } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface ProduitRow {
  id: number; codeProduit: string | null; nom: string; nomCommercial: string | null;
  prixUnitaire: number; imagePrincipaleUrl: string | null; marque: { nom: string } | null;
}
interface Etiquette {
  id: number; nom: string; codeProduit: string | null; codeBarre: string;
  prixUnitaire: number; marque: string | null; barcodeSvg: string; qrSvg: string;
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  #zone-impression, #zone-impression * { visibility: visible; }
  #zone-impression { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
  @page { margin: 10mm; }
}`;

export default function EtiquettesPage() {
  const [rows, setRows] = useState<ProduitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [etiquettes, setEtiquettes] = useState<Etiquette[] | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "50", statut: "ACTIF", ...(search && { search }) });
      const r = await fetch(`/api/admin/catalogue/produits?${q}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllVisible = () => setSelected((prev) => {
    const allSel = rows.every((r) => prev.has(r.id));
    const next = new Set(prev);
    if (allSel) rows.forEach((r) => next.delete(r.id));
    else rows.forEach((r) => next.add(r.id));
    return next;
  });

  const generer = async () => {
    if (selected.size === 0) { toast.error("Sélectionnez au moins un produit"); return; }
    setGenerating(true);
    try {
      const r = await fetch(`/api/admin/catalogue/etiquettes?ids=${[...selected].join(",")}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setEtiquettes(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setGenerating(false); }
  };

  // ── Vue aperçu / impression ────────────────────────────────────────────────
  if (etiquettes) {
    return (
      <div className="min-h-screen bg-gray-50">
        <style>{PRINT_CSS}</style>
        <div className="p-6 max-w-5xl mx-auto space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3 no-print">
            <button onClick={() => setEtiquettes(null)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /> Retour à la sélection
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">{etiquettes.length} étiquette(s)</span>
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm">
                <Printer className="w-4 h-4" /> Imprimer
              </button>
            </div>
          </div>

          <div id="zone-impression">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {etiquettes.map((e) => (
                <div key={e.id} className="border border-gray-300 rounded-lg p-3 flex flex-col items-center text-center bg-white" style={{ breakInside: "avoid" }}>
                  <p className="text-sm font-bold text-gray-900 leading-tight line-clamp-2">{e.nom}</p>
                  {e.marque && <p className="text-[10px] text-gray-400 uppercase">{e.marque}</p>}
                  <p className="text-lg font-extrabold text-gray-900 my-1">{formatCurrency(e.prixUnitaire)}</p>
                  <div className="flex items-end gap-2 justify-center w-full mt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="code-barres" src={`data:image/svg+xml;utf8,${encodeURIComponent(e.barcodeSvg)}`} className="max-h-12" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="QR" src={`data:image/svg+xml;utf8,${encodeURIComponent(e.qrSvg)}`} className="w-12 h-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Vue sélection ───────────────────────────────────────────────────────────
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <Link href="/dashboard/admin/catalogue/produits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour au catalogue
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Tag className="w-6 h-6 text-blue-600" /> Étiquettes produits</h2>
            <p className="text-sm text-gray-400">Sélectionnez des produits pour générer leurs étiquettes (prix, code-barres, QR code).</p>
          </div>
          <button onClick={generer} disabled={selected.size === 0 || generating}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Générer ({selected.size})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher un produit…"
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <button onClick={toggleAllVisible} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
              {allVisibleSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
              Tout sélectionner (visible)
            </button>
            <span className="text-xs text-gray-400">{selected.size} sélectionné(s)</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-gray-400">Aucun produit.</div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
              {rows.map((p) => {
                const sel = selected.has(p.id);
                return (
                  <button key={p.id} onClick={() => toggle(p.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 ${sel ? "bg-blue-50/50" : ""}`}>
                    {sel ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-300 shrink-0" />}
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                      {p.imagePrincipaleUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.imagePrincipaleUrl} alt="" className="w-full h-full object-cover" />
                        : <Boxes className="w-4 h-4 text-slate-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.nomCommercial || p.nom}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{p.codeProduit ?? "—"}{p.marque ? ` · ${p.marque.nom}` : ""}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{formatCurrency(p.prixUnitaire)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
