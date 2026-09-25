"use client";

import { useState } from "react";
import IdentiteAgent from "./IdentiteAgent";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { X, Plus, Send, Trash2 } from "lucide-react";

interface ProduitRef { id: number; nom: string; reference: string | null; prixUnitaire: number | string }
const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export const TYPES_SORTIE_AGENT = [
  { value: "DON", label: "Don / échantillon", aide: "Produits offerts (échantillons, dons promotionnels)" },
  { value: "CONSOMMATION_INTERNE", label: "Usage terrain", aide: "Marchandise utilisée pour l'activité (démonstration, animation)" },
  { value: "PERTE", label: "Perte", aide: "Marchandise perdue ou périmée constatée" },
  { value: "CASSE", label: "Casse", aide: "Marchandise endommagée constatée" },
] as const;

/**
 * Bon de sortie de marchandises rempli par l'agent terrain (demandeur) — soumis au magasinier
 * du PDV qui l'exécute. Aucun stock ne bouge tant que le magasinier ne l'a pas validé.
 */
export default function NouveauBonSortie({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [typeSortie, setTypeSortie] = useState<(typeof TYPES_SORTIE_AGENT)[number]["value"]>("DON");
  const [motif, setMotif] = useState("");
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState<{ produitId: number | null; produitNom: string; prix: number; quantite: string }[]>([{ produitId: null, produitNom: "", prix: 0, quantite: "" }]);
  const [produitSearch, setProduitSearch] = useState("");
  const [ligneEnRecherche, setLigneEnRecherche] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: produitsData } = useApi<{ data: ProduitRef[] }>(produitSearch.length >= 2 ? `/api/agentTerrain/produits?search=${encodeURIComponent(produitSearch)}&limit=10` : null);
  const produits = produitsData?.data ?? [];

  const updateLigne = (idx: number, patch: Partial<(typeof lignes)[number]>) => setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLigne = () => setLignes((prev) => [...prev, { produitId: null, produitNom: "", prix: 0, quantite: "" }]);
  const removeLigne = (idx: number) => setLignes((prev) => prev.filter((_, i) => i !== idx));

  const lignesValides = lignes.filter((l) => l.produitId && Number(l.quantite) > 0);
  const total = lignesValides.reduce((s, l) => s + l.prix * Number(l.quantite), 0);
  const aide = TYPES_SORTIE_AGENT.find((t) => t.value === typeSortie)?.aide;

  const handleSubmit = async () => {
    if (!motif.trim()) { toast.error("Indiquez le motif de la sortie"); return; }
    if (lignesValides.length === 0) { toast.error("Ajoutez au moins un produit avec sa quantité"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/agentTerrain/bons-sortie", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeSortie, motif: motif.trim(), notes: notes.trim() || undefined,
          lignes: lignesValides.map((l) => ({ produitId: l.produitId, quantite: Number(l.quantite) })),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Bon de sortie soumis au magasinier"); onCreated(j.data.id); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau bon de sortie</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <IdentiteAgent />

          <div>
            <label className="text-xs text-slate-500">Nature de la sortie</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {TYPES_SORTIE_AGENT.map((t) => (
                <button key={t.value} onClick={() => setTypeSortie(t.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${typeSortie === t.value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {aide && <p className="text-xs text-slate-400 mt-1">{aide}</p>}
          </div>

          <div>
            <label className="text-xs text-slate-500">Motif</label>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : échantillons pour la dégustation du marché de Bè" className={inputCls} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500">Produits</label>
              <button onClick={addLigne} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
            </div>
            <div className="space-y-2">
              {lignes.map((l, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 relative">
                    <input
                      value={ligneEnRecherche === i ? produitSearch : l.produitNom}
                      onChange={(e) => { setProduitSearch(e.target.value); updateLigne(i, { produitNom: e.target.value, produitId: null }); setLigneEnRecherche(i); }}
                      onFocus={() => setLigneEnRecherche(i)}
                      placeholder="Rechercher un produit…" className={inputCls}
                    />
                    {ligneEnRecherche === i && produits.length > 0 && !l.produitId && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {produits.map((p) => (
                          <button key={p.id} onClick={() => { updateLigne(i, { produitId: p.id, produitNom: p.nom, prix: Number(p.prixUnitaire) }); setLigneEnRecherche(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex justify-between">
                            <span>{p.nom}</span><span className="text-slate-400">{Number(p.prixUnitaire).toLocaleString("fr-FR")}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="number" min="1" step="1" value={l.quantite} onChange={(e) => updateLigne(i, { quantite: e.target.value })} placeholder="Qté" className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  {lignes.length > 1 && <button onClick={() => removeLigne(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            {total > 0 && <p className="text-xs text-slate-500 mt-2 text-right">Valorisation estimée : <span className="font-semibold text-slate-700">{total.toLocaleString("fr-FR")} FCFA</span></p>}
          </div>

          <div><label className="text-xs text-slate-500">Notes (optionnel)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} /></div>

          <p className="text-xs text-slate-400">Le bon est transmis au magasinier de votre point de vente : la marchandise ne sort du stock qu&apos;après son exécution (et un visa si le montant dépasse le seuil).</p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Send className="w-4 h-4" /> Soumettre</button>
        </div>
      </div>
    </div>
  );
}
