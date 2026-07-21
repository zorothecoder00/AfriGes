"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Search, Package, Tag, ChevronLeft, ChevronRight, Boxes } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import DashboardBackButton from "@/components/DashboardBackButton";

/**
 * Catalogue produits en lecture seule, accessible à tous les gestionnaires (tous
 * rôles). Consomme /api/catalogue/interne : prix de vente réels + disponibilité
 * en stock, sans aucune action de modification (consultation uniquement).
 */

interface ProduitInterne {
  id: number;
  codeProduit: string;
  reference: string;
  nom: string;
  unite: string | null;
  prixUnitaire: number;
  marque: string | null;
  categorie: string | null;
  famille: string | null;
  image: string | null;
  stockTotal: number;
  parPdv: { pdvId: number; pdvNom: string; pdvCode: string; quantite: number }[];
  dispo: "DISPONIBLE" | "LIMITE" | "RUPTURE";
}
interface Reponse {
  data: ProduitInterne[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
interface Ref { id: number; nom: string }

const DISPO_BADGE: Record<ProduitInterne["dispo"], { label: string; cls: string }> = {
  DISPONIBLE: { label: "En stock", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  LIMITE:     { label: "Stock limité", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  RUPTURE:    { label: "Rupture", cls: "bg-red-50 text-red-600 border-red-200" },
};

export default function CatalogueInternePage() {
  const [search, setSearch]       = useState("");
  const [debounced, setDebounced] = useState("");
  const [familleId, setFamilleId] = useState("");
  const [marqueId, setMarqueId]   = useState("");
  const [pdvId, setPdvId]         = useState("");
  const [page, setPage]           = useState(1);

  // Debounce recherche
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const query = new URLSearchParams({
    page: String(page), limit: "24",
    ...(debounced && { search: debounced }),
    ...(familleId && { familleId }),
    ...(marqueId && { marqueId }),
    ...(pdvId && { pointDeVenteId: pdvId }),
  }).toString();

  const { data: res, loading } = useApi<Reponse>(`/api/catalogue/interne?${query}`);
  const { data: refs } = useApi<{ familles: Ref[]; marques: Ref[] }>("/api/catalogue/public/referentiels");
  const { data: pdvRes } = useApi<{ data: Ref[] }>("/api/catalogue/interne/pdv");
  const pdvs = pdvRes?.data ?? [];

  const produits = res?.data ?? [];
  const meta = res?.meta;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center gap-3 mb-1">
        <DashboardBackButton exitViewAsOnBack={false} />
        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><Package className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Catalogue des produits</h1>
          <p className="text-xs text-slate-500">Consultation — prix et disponibilité (lecture seule)</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit, une référence, un code…"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <select value={familleId} onChange={(e) => { setFamilleId(e.target.value); setPage(1); }}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">Toutes les familles</option>
          {(refs?.familles ?? []).map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select>
        <select value={marqueId} onChange={(e) => { setMarqueId(e.target.value); setPage(1); }}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">Toutes les marques</option>
          {(refs?.marques ?? []).map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        {pdvs.length > 1 && (
          <select value={pdvId} onChange={(e) => { setPdvId(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Tous les points de vente</option>
            {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        )}
      </div>

      {/* Grille produits */}
      {loading && produits.length === 0 ? (
        <div className="mt-10 text-center text-sm text-slate-400">Chargement du catalogue…</div>
      ) : produits.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-slate-400">
          <Boxes className="w-10 h-10 mb-2" />
          <p className="text-sm">Aucun produit trouvé.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {produits.map((p) => {
            const badge = DISPO_BADGE[p.dispo];
            return (
              <div key={p.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-32 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {p.image
                    ? <img src={p.image} alt={p.nom} className="h-full w-full object-cover" />
                    : <Package className="w-10 h-10 text-slate-300" />}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-slate-800 leading-snug line-clamp-2">{p.nom}</h3>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 font-mono">{p.codeProduit}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.famille && <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500"><Tag className="w-2.5 h-2.5" />{p.famille}</span>}
                    {p.marque && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{p.marque}</span>}
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400">Prix de vente</p>
                      <p className="text-base font-bold text-emerald-700">{formatCurrency(p.prixUnitaire)}{p.unite ? <span className="text-[11px] font-normal text-slate-400"> /{p.unite}</span> : null}</p>
                    </div>
                    <p className="text-[11px] text-slate-500">{pdvId ? "Stock PDV" : "Stock total"} : <span className="font-semibold text-slate-700">{p.stockTotal}</span></p>
                  </div>

                  {/* Ventilation par point de vente — seulement en périmètre multi-PDV
                      (chef d'agence, compte transverse) ; superflu pour un mono-PDV. */}
                  {pdvs.length > 1 && p.parPdv.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 mb-1">Disponibilité par PDV</p>
                      <div className="flex flex-wrap gap-1">
                        {p.parPdv.map((s) => (
                          <span key={s.pdvId} title={s.pdvCode}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {s.pdvNom} <span className="font-semibold text-slate-800">{s.quantite}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" /> Précédent
          </button>
          <span className="text-sm text-slate-500">Page {meta.page} / {meta.totalPages} · {meta.total} produits</span>
          <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50">
            Suivant <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
