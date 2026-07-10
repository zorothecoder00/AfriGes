"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Printer, Boxes } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";

interface ProduitRow {
  id: number; codeProduit: string | null; reference: string | null; nom: string; nomCommercial: string | null;
  prixUnitaire: number; prixAchat: number | null; imagePrincipaleUrl: string | null;
  marque: { nom: string } | null; categorieProduit: { nom: string } | null; famille: { nom: string } | null;
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  #zone-impression, #zone-impression * { visibility: visible; }
  #zone-impression { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
  @page { margin: 12mm; }
}`;

function ImpressionInner() {
  const sp = useSearchParams();
  const [rows, setRows] = useState<ProduitRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "1000" });
      for (const k of ["search", "statut", "familleId", "categorieId", "marqueId"]) {
        const v = sp.get(k); if (v) q.set(k, v);
      }
      if (!q.get("statut")) q.set("statut", "ACTIF");
      const r = await fetch(`/api/admin/catalogue/produits?${q}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, [sp]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{PRINT_CSS}</style>
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3 no-print">
          <Link href="/dashboard/admin/catalogue/produits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Retour au catalogue
          </Link>
          <button onClick={() => window.print()} disabled={loading || rows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm">
            <Printer className="w-4 h-4" /> Imprimer / PDF
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : (
          <div id="zone-impression" className="bg-white rounded-2xl border border-gray-200 p-8 print:border-0 print:p-0">
            {/* En-tête société */}
            <div className="flex items-start justify-between border-b-2 border-gray-800 pb-3 mb-4">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">{SOCIETE.nom}</h1>
                <p className="text-[11px] text-gray-500 italic">{SOCIETE.baseline}</p>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-bold text-gray-800">Catalogue produits</h2>
                <p className="text-[11px] text-gray-500">{new Date().toLocaleDateString("fr-FR")} · {rows.length} produit(s)</p>
              </div>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[11px] uppercase text-gray-500 border-b border-gray-300">
                  <th className="py-2 pr-2 font-semibold">Code</th>
                  <th className="py-2 pr-2 font-semibold">Produit</th>
                  <th className="py-2 pr-2 font-semibold">Classification</th>
                  <th className="py-2 pl-2 font-semibold text-right">Prix</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 align-top">
                    <td className="py-1.5 pr-2 font-mono text-[11px] text-gray-500 whitespace-nowrap">{p.codeProduit ?? "—"}</td>
                    <td className="py-1.5 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 print:hidden">
                          {p.imagePrincipaleUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={p.imagePrincipaleUrl} alt="" className="w-full h-full object-cover" />
                            : <Boxes className="w-3.5 h-3.5 text-slate-300" />}
                        </div>
                        <span className="font-medium text-gray-800">{p.nomCommercial || p.nom}</span>
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 text-[11px] text-gray-500">{[p.famille?.nom, p.categorieProduit?.nom, p.marque?.nom].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="py-1.5 pl-2 text-right font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(p.prixUnitaire)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-[9px] text-gray-400 text-center mt-6 pt-3 border-t border-gray-200">{SOCIETE_PIED}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CatalogueImpressionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>}>
      <ImpressionInner />
    </Suspense>
  );
}
