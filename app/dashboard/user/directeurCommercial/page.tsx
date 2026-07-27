"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Package, Tag, ChevronLeft, ChevronRight, TrendingUp, History, X, BarChart3 } from "lucide-react";
import DashboardBackButton from "@/components/DashboardBackButton";
import NotificationBell from "@/components/NotificationBell";
import HistoriquePrixProduit from "@/components/HistoriquePrixProduit";
import { formatCurrency } from "@/lib/format";

/**
 * Dashboard Directeur Commercial (Catalogue §21.B) — vue commerciale complète,
 * cross-agence : catalogue complet, tous les prix de vente, prix crédit,
 * promotions, disponibilité, marges, historique. Pas de paramètres système,
 * pas de comptabilité. Consomme `/api/directeur-commercial/catalogue`, qui
 * projette via la vue DIRECTEUR_COMMERCIAL (même moteur que la vitrine
 * publique et l'aperçu admin — synchro §24).
 */

type Produit = {
  id: number;
  photo?: string | null;
  nom?: string | null;
  nomCommercial?: string | null;
  description?: string | null;
  codeProduit?: string | null;
  reference?: string | null;
  codeBarre?: string | null;
  marque?: string | null;
  famille?: string | null;
  categorie?: string | null;
  paysOrigine?: string | null;
  fournisseur?: string | null;
  prixDetail?: number | null;
  prixCredit?: number | null;
  prixGros?: number | null;
  promo?: string | null;
  prixAchat?: number | null;
  marge?: number | null;
  stock?: number | null;
};

type Reponse = {
  vue: { cle: string; nom: string; modeStock: string; champsVisibles: string[] };
  data: Produit[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

type Ref = { id: number; nom: string };

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function DirecteurCommercialPage() {
  const [search, setSearch]       = useState("");
  const [debounced, setDebounced] = useState("");
  const [familleId, setFamilleId] = useState("");
  const [marqueId, setMarqueId]   = useState("");
  const [page, setPage]           = useState(1);

  const [res, setRes]         = useState<Reponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refs, setRefs]       = useState<{ familles: Ref[]; marques: Ref[] }>({ familles: [], marques: [] });
  const [historiqueProduit, setHistoriqueProduit] = useState<{ id: number; nom: string } | null>(null);

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
      if (debounced) p.set("search", debounced);
      if (familleId) p.set("familleId", familleId);
      if (marqueId)  p.set("marqueId", marqueId);
      const r = await fetch(`/api/directeur-commercial/catalogue?${p.toString()}`);
      if (r.ok) setRes(await r.json());
    } finally {
      setLoading(false);
    }
  }, [page, debounced, familleId, marqueId]);

  useEffect(() => { charger(); }, [charger]);

  const produits = res?.data ?? [];
  const meta = res?.meta;

  const totalMarge = produits.reduce((s, p) => s + (p.marge != null ? Number(p.marge) : 0), 0);
  const enPromo    = produits.filter((p) => p.promo).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/20 font-['DM_Sans',sans-serif]">
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <DashboardBackButton />
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                Directeur Commercial
              </h1>
            </div>
            <NotificationBell href="/dashboard/user/notifications" />
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Catalogue commercial</h2>
          <p className="text-slate-500">Vue complète cross-agence : prix de vente, prix crédit, promotions, marges, historique.</p>
        </div>

        {/* Stats de la page courante */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0"><Package className="text-indigo-600 w-5 h-5" /></div>
            <div><p className="text-xs text-slate-500 font-medium">Produits (page)</p><p className="text-2xl font-bold text-slate-800">{meta?.total ?? 0}</p></div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0"><TrendingUp className="text-emerald-600 w-5 h-5" /></div>
            <div><p className="text-xs text-slate-500 font-medium">Marge cumulée (page)</p><p className="text-2xl font-bold text-slate-800">{formatCurrency(totalMarge)}</p></div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center shrink-0"><Tag className="text-rose-600 w-5 h-5" /></div>
            <div><p className="text-xs text-slate-500 font-medium">En promotion (page)</p><p className="text-2xl font-bold text-slate-800">{enPromo}</p></div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0"><BarChart3 className="text-blue-600 w-5 h-5" /></div>
            <div><p className="text-xs text-slate-500 font-medium">Page</p><p className="text-2xl font-bold text-slate-800">{meta?.page ?? 1}/{meta?.totalPages ?? 1}</p></div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit…"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select value={familleId} onChange={(e) => { setFamilleId(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Toutes les familles</option>
            {refs.familles.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
          <select value={marqueId} onChange={(e) => { setMarqueId(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Toutes les marques</option>
            {refs.marques.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </div>

        {/* Tableau catalogue */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Chargement…</div>
          ) : produits.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Package size={40} className="mx-auto mb-3 text-slate-300" />
              Aucun produit ne correspond à votre recherche.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Produit</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Marque / Famille</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs">Prix vente</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs">Prix crédit</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs">Marge</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">Promo</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">Stock</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">Historique</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {produits.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {p.photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.photo} alt="" className="w-full h-full object-cover" />
                            ) : <Package size={16} className="text-slate-300" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate">{p.nom}</p>
                            <p className="text-xs text-slate-400 font-mono">{p.codeProduit ?? p.reference ?? ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{[p.marque, p.famille].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{p.prixDetail != null ? fmt(Number(p.prixDetail)) : "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{p.prixCredit != null ? fmt(Number(p.prixCredit)) : "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">{p.marge != null ? fmt(Number(p.marge)) : "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {p.promo ? <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-medium">{p.promo}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{p.stock ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setHistoriqueProduit({ id: p.id, nom: p.nom ?? "" })}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <History size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-4 border-t border-slate-100">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"><ChevronLeft size={16} /></button>
              <span className="text-sm text-slate-600">Page {meta.page} / {meta.totalPages} · {meta.total} produits</span>
              <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      </main>

      {historiqueProduit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setHistoriqueProduit(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <History size={18} className="text-indigo-500" /> {historiqueProduit.nom}
              </h2>
              <button onClick={() => setHistoriqueProduit(null)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <HistoriquePrixProduit produitId={historiqueProduit.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
