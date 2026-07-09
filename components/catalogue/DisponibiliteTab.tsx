"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Check, X, Pencil } from "lucide-react";

interface Etat { niveau: string; couleur: "rouge" | "orange" | "vert"; label: string }
interface AgenceRow {
  pointDeVenteId: number; agence: string; type: string; disponible: boolean;
  quantite: number; reserve: number; enTransit: number; endommage: number;
  stockMin: number | null; stockMax: number | null; seuilCritique: number | null;
  rayon: string | null; etagere: string | null; allee: string | null;
  configure: boolean; etat: Etat;
}

const DOT: Record<string, string> = { rouge: "bg-rose-500", orange: "bg-amber-500", vert: "bg-emerald-500" };
const BADGE: Record<string, string> = {
  rouge: "bg-rose-50 text-rose-700 border-rose-200",
  orange: "bg-amber-50 text-amber-700 border-amber-200",
  vert: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function DisponibiliteTab({ produitId }: { produitId: number }) {
  const [rows, setRows] = useState<AgenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<AgenceRow>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/disponibilite`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }, [produitId]);
  useEffect(() => { load(); }, [load]);

  const openEdit = (row: AgenceRow) => {
    setEditId(row.pointDeVenteId);
    setDraft({ disponible: row.disponible, stockMin: row.stockMin, stockMax: row.stockMax, seuilCritique: row.seuilCritique, rayon: row.rayon, etagere: row.etagere, allee: row.allee });
  };

  const save = async () => {
    if (editId == null) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/disponibilite`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointDeVenteId: editId, ...draft }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success("Agence mise à jour ✓");
      setEditId(null); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const numField = (k: "stockMin" | "stockMax" | "seuilCritique", ph: string) => (
    <input type="number" min={0} value={draft[k] == null ? "" : String(draft[k])} placeholder={ph}
      onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value === "" ? null : Number(e.target.value) }))}
      className="w-16 px-2 py-1 border border-slate-200 rounded text-xs bg-white" />
  );
  const strField = (k: "rayon" | "etagere" | "allee", ph: string) => (
    <input value={draft[k] == null ? "" : String(draft[k])} placeholder={ph}
      onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
      className="w-16 px-2 py-1 border border-slate-200 rounded text-xs bg-white" />
  );

  if (loading) return <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Disponibilité, stock et emplacement du produit dans chaque agence. Le compte est mis à jour en temps réel avec le stock.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs border-b border-gray-100">
            <tr>
              <th className="text-left py-2">Agence</th>
              <th className="text-center py-2">État</th>
              <th className="text-right py-2">Dispo.</th>
              <th className="text-right py-2">Réservé</th>
              <th className="text-left py-2 pl-3">Seuils (min/max/crit.)</th>
              <th className="text-left py-2">Emplacement</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => {
              const editing = editId === r.pointDeVenteId;
              return (
                <tr key={r.pointDeVenteId} className={r.disponible ? "" : "opacity-60"}>
                  <td className="py-2 font-medium text-gray-800">
                    {r.agence}
                    {!r.disponible && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">Non commercialisé</span>}
                  </td>
                  <td className="py-2 text-center">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${BADGE[r.etat.couleur]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${DOT[r.etat.couleur]}`} /> {r.etat.label}
                    </span>
                  </td>
                  <td className="py-2 text-right font-semibold text-gray-900">{r.quantite}</td>
                  <td className="py-2 text-right text-gray-500">{r.reserve}</td>
                  {editing ? (
                    <>
                      <td className="py-2 pl-3">
                        <div className="flex gap-1">{numField("stockMin", "min")}{numField("stockMax", "max")}{numField("seuilCritique", "crit")}</div>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">{strField("rayon", "rayon")}{strField("etagere", "étag.")}{strField("allee", "allée")}</div>
                        <label className="flex items-center gap-1 mt-1 text-[11px] text-gray-500">
                          <input type="checkbox" checked={draft.disponible ?? true} onChange={(e) => setDraft((d) => ({ ...d, disponible: e.target.checked }))} /> Commercialisé
                        </label>
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button onClick={save} disabled={saving} className="text-emerald-600 hover:text-emerald-700 mr-1">{saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : <Check className="w-4 h-4 inline" />}</button>
                        <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4 inline" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pl-3 text-xs text-gray-500">{[r.stockMin, r.stockMax, r.seuilCritique].map((v) => v ?? "—").join(" / ")}</td>
                      <td className="py-2 text-xs text-gray-500">
                        {[r.rayon, r.etagere, r.allee].filter(Boolean).length > 0
                          ? <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{[r.rayon, r.etagere, r.allee].filter(Boolean).join(" · ")}</span>
                          : "—"}
                      </td>
                      <td className="py-2 text-right"><button onClick={() => openEdit(r)} className="text-gray-400 hover:text-blue-600" title="Configurer"><Pencil className="w-4 h-4" /></button></td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">Aucune agence active.</p>}
    </div>
  );
}
