"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Package, Tag, ChevronLeft, ChevronRight, Store } from "lucide-react";

/**
 * Vitrine / borne publique du catalogue (Catalogue §21-24).
 * Consomme `/api/catalogue/public`, qui projette le catalogue via la vue VISITEUR
 * (ou CLIENT en mode borne) : seuls les champs autorisés arrivent ici, la
 * disponibilité est un palier (jamais la quantité exacte). Aucune authentification.
 */

type Produit = {
  id: number;
  photo?: string | null;
  nom?: string | null;
  description?: string | null;
  prixDetail?: number | null;
  promo?: string | null;
  stock?: string | number | null;
};

type Reponse = {
  vue: { cle: string; nom: string; modeStock: string; champsVisibles: string[] };
  data: Produit[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

type Ref = { id: number; nom: string };

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

function badgeDispo(stock: Produit["stock"]): { label: string; cls: string } | null {
  if (stock == null) return null;
  const s = String(stock);
  const rupture = /rupture|commande/i.test(s);
  const limite = /limit/i.test(s);
  return {
    label: s,
    cls: rupture
      ? "bg-red-50 text-red-600 border-red-200"
      : limite
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

export default function CataloguePublicPage() {
  const [search, setSearch]       = useState("");
  const [debounced, setDebounced] = useState("");
  const [familleId, setFamilleId] = useState("");
  const [marqueId, setMarqueId]   = useState("");
  const [page, setPage]           = useState(1);

  const [res, setRes]         = useState<Reponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refs, setRefs]       = useState<{ familles: Ref[]; marques: Ref[] }>({ familles: [], marques: [] });

  // Debounce recherche
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetch("/api/catalogue/public/referentiels")
      .then((r) => r.ok ? r.json() : null)
      .then((j) => j && setRefs({ familles: j.familles ?? [], marques: j.marques ?? [] }))
      .catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: "24" });
      if (debounced)  p.set("search", debounced);
      if (familleId)  p.set("familleId", familleId);
      if (marqueId)   p.set("marqueId", marqueId);
      const r = await fetch(`/api/catalogue/public?${p.toString()}`);
      if (r.ok) setRes(await r.json());
    } finally {
      setLoading(false);
    }
  }, [page, debounced, familleId, marqueId]);

  useEffect(() => { charger(); }, [charger]);

  const produits = res?.data ?? [];
  const meta = res?.meta;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* En-tête */}
      <header className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-emerald-100 text-sm font-medium">
            <Store size={16} /> AfriSime
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Catalogue produits</h1>
          <p className="mt-1 text-emerald-50/90">Découvrez nos produits, prix et disponibilités.</p>
        </div>
      </header>

      {/* Barre de filtres */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit…"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select value={familleId} onChange={(e) => { setFamilleId(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Toutes les familles</option>
            {refs.familles.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
          <select value={marqueId} onChange={(e) => { setMarqueId(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Toutes les marques</option>
            {refs.marques.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </div>
      </div>

      {/* Grille */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
                <div className="aspect-square bg-slate-100" />
                <div className="p-3 space-y-2"><div className="h-3 bg-slate-100 rounded w-3/4" /><div className="h-3 bg-slate-100 rounded w-1/2" /></div>
              </div>
            ))}
          </div>
        ) : produits.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Package size={40} className="mx-auto mb-3 text-slate-300" />
            Aucun produit ne correspond à votre recherche.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {produits.map((p) => {
                const dispo = badgeDispo(p.stock);
                return (
                  <article key={p.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    <div className="aspect-square bg-slate-100 relative">
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo} alt={p.nom ?? ""} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={36} /></div>
                      )}
                      {p.promo && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-red-500 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full shadow">
                          <Tag size={11} /> {p.promo}
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-1.5 flex-1">
                      <h3 className="text-sm font-semibold text-slate-800 line-clamp-2">{p.nom}</h3>
                      {p.description && <p className="text-xs text-slate-500 line-clamp-2">{p.description}</p>}
                      <div className="mt-auto flex items-end justify-between pt-1.5">
                        {p.prixDetail != null && (
                          <span className="text-base font-bold text-emerald-700">{fmt(Number(p.prixDetail))} <span className="text-xs font-medium text-slate-400">FCFA</span></span>
                        )}
                      </div>
                      {dispo && (
                        <span className={`inline-block self-start text-[11px] font-medium px-2 py-0.5 rounded-full border ${dispo.cls}`}>{dispo.label}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"><ChevronLeft size={16} /></button>
                <span className="text-sm text-slate-600">Page {meta.page} / {meta.totalPages} · {meta.total} produits</span>
                <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}
                  className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"><ChevronRight size={16} /></button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
