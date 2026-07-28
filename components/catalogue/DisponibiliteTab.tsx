"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Check, X, Pencil, PackagePlus, ArrowRightLeft, SlidersHorizontal, Lock } from "lucide-react";
import ApprovisionnerProduitModal from "@/components/catalogue/ApprovisionnerProduitModal";
import TransfererProduitModal from "@/components/catalogue/TransfererProduitModal";
import AjustementStockModal from "@/components/catalogue/AjustementStockModal";
import BlocageStockModal from "@/components/catalogue/BlocageStockModal";

interface Etat { niveau: string; couleur: "rouge" | "orange" | "vert"; label: string }
interface AgenceRow {
  pointDeVenteId: number; agence: string; type: string; disponible: boolean;
  quantite: number; reserve: number; enTransit: number; endommage: number;
  bloque: number; consigne: number;
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

export default function DisponibiliteTab({ produitId, produitNom, onStockChanged }: { produitId: number; produitNom: string; onStockChanged?: () => void }) {
  const [rows, setRows] = useState<AgenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<AgenceRow>>({});
  const [saving, setSaving] = useState(false);

  const [approOpen, setApproOpen] = useState<{ pdvId?: number } | null>(null);
  const [transfertOpen, setTransfertOpen] = useState<{ pdvId?: number } | null>(null);
  const [ajustementOpen, setAjustementOpen] = useState<{ pdvId?: number; stockActuel?: number } | null>(null);
  const [blocageOpen, setBlocageOpen] = useState<AgenceRow | null>(null);

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

  const handleActionDone = (closeFn: () => void) => {
    closeFn();
    load();
    onStockChanged?.();
  };

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

  const hasBloqueOuConsigne = rows.some((r) => r.bloque > 0 || r.consigne > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-400">Disponibilité, stock et emplacement du produit dans chaque agence. Le compte est mis à jour en temps réel avec le stock.</p>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setApproOpen({})}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium">
            <PackagePlus className="w-3.5 h-3.5" /> Approvisionner
          </button>
          <button onClick={() => setTransfertOpen({})}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium">
            <ArrowRightLeft className="w-3.5 h-3.5" /> Transférer
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs border-b border-gray-100">
            <tr>
              <th className="text-left py-2">Agence</th>
              <th className="text-center py-2">État</th>
              <th className="text-right py-2">Dispo.</th>
              <th className="text-right py-2">Réservé</th>
              {hasBloqueOuConsigne && <th className="text-right py-2">Bloqué</th>}
              {hasBloqueOuConsigne && <th className="text-right py-2">Consigné</th>}
              <th className="text-left py-2 pl-3">Seuils (min/max/crit.)</th>
              <th className="text-left py-2">Emplacement</th>
              <th className="text-right py-2">Actions</th>
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
                  {hasBloqueOuConsigne && <td className="py-2 text-right text-orange-600">{r.bloque || "—"}</td>}
                  {hasBloqueOuConsigne && <td className="py-2 text-right text-purple-600">{r.consigne || "—"}</td>}
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
                      <td className="py-2 text-right whitespace-nowrap" colSpan={2}>
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
                      <td className="py-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-0.5">
                          <button onClick={() => setApproOpen({ pdvId: r.pointDeVenteId })} title="Approvisionner" className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><PackagePlus className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setTransfertOpen({ pdvId: r.pointDeVenteId })} title="Transférer" className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><ArrowRightLeft className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setAjustementOpen({ pdvId: r.pointDeVenteId, stockActuel: r.quantite })} title="Ajuster" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><SlidersHorizontal className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setBlocageOpen(r)} title="Bloquer / Consigner" className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Lock className="w-3.5 h-3.5" /></button>
                        </div>
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

      {approOpen && (
        <ApprovisionnerProduitModal
          produitId={produitId} produitNom={produitNom} pointDeVenteIdParDefaut={approOpen.pdvId}
          onClose={() => setApproOpen(null)}
          onDone={() => handleActionDone(() => setApproOpen(null))}
        />
      )}
      {transfertOpen && (
        <TransfererProduitModal
          produitId={produitId} produitNom={produitNom} origineParDefaut={transfertOpen.pdvId}
          onClose={() => setTransfertOpen(null)}
          onDone={() => handleActionDone(() => setTransfertOpen(null))}
        />
      )}
      {ajustementOpen && (
        <AjustementStockModal
          produitId={produitId} produitNom={produitNom}
          stockActuel={ajustementOpen.stockActuel} pointDeVenteIdParDefaut={ajustementOpen.pdvId}
          onClose={() => setAjustementOpen(null)}
          onDone={() => handleActionDone(() => setAjustementOpen(null))}
        />
      )}
      {blocageOpen && (
        <BlocageStockModal
          stock={{
            produitId, produitNom, pointDeVenteId: blocageOpen.pointDeVenteId, pointDeVenteNom: blocageOpen.agence,
            quantite: blocageOpen.quantite, quantiteBloquee: blocageOpen.bloque, quantiteConsignee: blocageOpen.consigne,
          }}
          onClose={() => setBlocageOpen(null)}
          onDone={() => handleActionDone(() => setBlocageOpen(null))}
        />
      )}
    </div>
  );
}
