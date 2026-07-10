"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus, Search, Trash2, Boxes, Repeat, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface SubstitutProduit {
  id: number; nom: string; codeProduit: string | null; prixUnitaire: number; statut: string; imagePrincipaleUrl: string | null;
}
interface Configure {
  id: number; priorite: number; bidirectionnel: boolean; note: string | null;
  substitut: SubstitutProduit; stock: number; disponible: boolean;
}
interface Data { stockProduit: number; configures: Configure[]; }
interface Suggestion { id: number; nom: string; codeProduit: string | null }

export default function SubstitutsProduit({ produitId }: { produitId: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [q, setQ] = useState("");
  const [sugg, setSugg] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [choisi, setChoisi] = useState<Suggestion | null>(null);
  const [priorite, setPriorite] = useState("0");
  const [bidir, setBidir] = useState(true);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/substituts`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setData(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }, [produitId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open || q.trim().length < 1) { setSugg([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/catalogue/produits?search=${encodeURIComponent(q.trim())}&limit=8`);
        const j = await r.json();
        setSugg((j.data ?? []).filter((p: Suggestion) => p.id !== produitId));
      } catch { setSugg([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, open, produitId]);

  const ajouter = async () => {
    if (!choisi) { toast.error("Choisissez un produit"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/substituts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ substitutId: choisi.id, priorite: Number(priorite) || 0, bidirectionnel: bidir, note: note || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success("Substitut ajouté");
      setChoisi(null); setQ(""); setPriorite("0"); setBidir(true); setNote(""); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  };

  const supprimer = async (c: Configure) => {
    if (!confirm(`Retirer « ${c.substitut.nom} » des substituts ?`)) return;
    const r = await fetch(`/api/admin/catalogue/substituts/${c.id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) { toast.error(j.message ?? "Erreur"); return; }
    toast.success("Substitut retiré"); load();
  };

  const field = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const enRupture = data != null && data.stockProduit <= 0;
  const dispoCount = data?.configures.filter((c) => c.disponible).length ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Repeat className="w-4 h-4 text-blue-500" /> Produits de substitution</h3>
        {data && <span className="text-xs text-gray-400">{data.configures.length} équivalent(s) · {dispoCount} disponible(s)</span>}
      </div>

      {/* Bandeau rupture → équivalents dispo */}
      {enRupture && (
        <div className={`px-5 py-3 text-sm flex items-center gap-2 ${dispoCount > 0 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {dispoCount > 0
            ? <span>Ce produit est en rupture — <b>{dispoCount} équivalent(s) disponible(s)</b> à proposer au client.</span>
            : <span>Ce produit est en rupture et aucun substitut n&apos;est disponible en stock.</span>}
        </div>
      )}

      {/* Formulaire d'ajout */}
      <div className="p-5 border-b border-gray-100 bg-slate-50/50">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <span className="text-xs font-semibold text-slate-500">Produit équivalent</span>
            {choisi ? (
              <div className="mt-1 flex items-center justify-between gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm">
                <span className="truncate">{choisi.nom} <span className="text-[11px] text-gray-400 font-mono">{choisi.codeProduit ?? ""}</span></span>
                <button onClick={() => setChoisi(null)} className="text-gray-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                  placeholder="Rechercher un produit…" className={`${field} w-full pl-9`} />
                {open && q.trim() && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {sugg.length === 0 ? <div className="px-3 py-2 text-xs text-gray-400">Aucun résultat</div>
                      : sugg.map((s) => (
                        <button key={s.id} onClick={() => { setChoisi(s); setOpen(false); setQ(""); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-700">{s.nom} <span className="text-[11px] text-gray-400 font-mono">{s.codeProduit ?? ""}</span></button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <label className="text-xs text-slate-500">Priorité<input type="number" value={priorite} onChange={(e) => setPriorite(e.target.value)} className={`${field} w-20 block mt-1`} /></label>
          <label className="flex items-center gap-2 text-sm text-gray-600 pb-2"><input type="checkbox" checked={bidir} onChange={(e) => setBidir(e.target.checked)} className="w-4 h-4" /> Bidirectionnel</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optionnel)" className={`${field} flex-1 min-w-[160px]`} />
          <button onClick={ajouter} disabled={busy || !choisi} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Ajouter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : !data || data.configures.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400"><Repeat className="w-8 h-8 mx-auto mb-2 opacity-40" /> Aucun produit de substitution configuré.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Produit équivalent</th>
                <th className="text-right px-4 py-2.5 font-semibold">Prix</th>
                <th className="text-right px-4 py-2.5 font-semibold">Stock</th>
                <th className="text-center px-4 py-2.5 font-semibold">Dispo.</th>
                <th className="text-center px-4 py-2.5 font-semibold">Priorité</th>
                <th className="text-center px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.configures.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                        {c.substitut.imagePrincipaleUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={c.substitut.imagePrincipaleUrl} alt="" className="w-full h-full object-cover" />
                          : <Boxes className="w-4 h-4 text-slate-300" />}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/dashboard/admin/catalogue/produits/${c.substitut.id}`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">{c.substitut.nom}</Link>
                        <p className="text-[11px] text-gray-400 font-mono">{c.substitut.codeProduit ?? "—"}{c.bidirectionnel ? " · ↔" : ""}{c.note ? ` · ${c.note}` : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(c.substitut.prixUnitaire)}</td>
                  <td className="px-4 py-2.5 text-right">{c.stock}</td>
                  <td className="px-4 py-2.5 text-center">
                    {c.disponible
                      ? <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Dispo</span>
                      : <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">Indispo</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{c.priorite}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => supprimer(c)} title="Retirer" className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
