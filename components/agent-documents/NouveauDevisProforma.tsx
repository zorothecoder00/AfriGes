"use client";

import { useState } from "react";
import IdentiteAgent from "./IdentiteAgent";
import ChoixClientAgent, { type ClientRef } from "./ChoixClientAgent";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { X, Plus, Send, Trash2 } from "lucide-react";

interface ProduitRef { id: number; nom: string; reference: string | null; prixUnitaire: number | string }
type LigneForm = { produitId: number | null; produitNom: string; quantite: string; remisePourcent: string; libre: boolean; prix: string };
const LIGNE_VIDE: LigneForm = { produitId: null, produitNom: "", quantite: "", remisePourcent: "0", libre: false, prix: "" };
const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function NouveauDevisProforma({ typeInitial = "DEVIS", onClose, onCreated }: { typeInitial?: "DEVIS" | "PROFORMA"; onClose: () => void; onCreated: (id: number) => void }) {
  const [type, setType] = useState<"DEVIS" | "PROFORMA">(typeInitial);
  const [client, setClient] = useState<ClientRef | null>(null);
  const [dateValidite, setDateValidite] = useState("");
  const [conditions, setConditions] = useState("");
  const [lignes, setLignes] = useState<LigneForm[]>([{ ...LIGNE_VIDE }]);
  const [produitSearch, setProduitSearch] = useState("");
  const [ligneEnRecherche, setLigneEnRecherche] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: produitsData } = useApi<{ data: ProduitRef[] }>(produitSearch.length >= 2 ? `/api/agentTerrain/produits?search=${encodeURIComponent(produitSearch)}&limit=10` : null);
  const produits = produitsData?.data ?? [];

  const updateLigne = (idx: number, patch: Partial<(typeof lignes)[number]>) => setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLigne = () => setLignes((prev) => [...prev, { ...LIGNE_VIDE }]);
  const removeLigne = (idx: number) => setLignes((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!client) { toast.error("Sélectionnez un client"); return; }
    // Un nom tapé sans choisir dans la liste devient une ligne hors catalogue (au lieu d'être ignoré).
    const lignesSaisies = lignes.map((l) => (!l.produitId && !l.libre && l.produitNom.trim() ? { ...l, libre: true } : l));
    if (lignesSaisies.some((l) => (l.produitId || l.libre) && !(Number(l.quantite) > 0))) { toast.error("Indiquez la quantité de chaque produit"); return; }
    const lignesValides = lignesSaisies.filter((l) => Number(l.quantite) > 0 && (l.libre ? l.produitNom.trim() : l.produitId));
    if (lignesValides.length === 0) { toast.error("Ajoutez au moins un produit avec sa quantité"); return; }
    setLignes(lignesSaisies);

    setSaving(true);
    try {
      const r = await fetch("/api/ventes/devis-proforma", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, clientId: client.id, dateValidite: dateValidite || undefined, conditions: conditions || undefined,
          lignes: lignesValides.map((l) => l.libre
            ? { designation: l.produitNom.trim(), prixUnitaire: Number(l.prix) || undefined, quantite: Number(l.quantite), remisePourcent: Number(l.remisePourcent) || 0 }
            : { produitId: l.produitId, quantite: Number(l.quantite), remisePourcent: Number(l.remisePourcent) || 0 }),
          notes: notes || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success(`${type === "PROFORMA" ? "Proforma" : "Devis"} créé`); onCreated(j.data.id); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau devis / proforma</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <IdentiteAgent />
          <div className="flex gap-2">
            <button onClick={() => setType("DEVIS")} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${type === "DEVIS" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}>Devis</button>
            <button onClick={() => setType("PROFORMA")} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${type === "PROFORMA" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}>Facture proforma</button>
          </div>

          <div>
            <label className="text-xs text-slate-500">Client</label>
            <ChoixClientAgent client={client} onChange={setClient} accent="indigo" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500">Validité jusqu&apos;au</label><input type="date" value={dateValidite} onChange={(e) => setDateValidite(e.target.value)} className={inputCls} /></div>
            <div>
              <label className="text-xs text-slate-500">Conditions de vente (optionnel)</label>
              <input list="conditions-suggestions" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Ex. : Paiement à la livraison" className={inputCls} />
              <datalist id="conditions-suggestions">
                <option value="Paiement comptant à la commande" />
                <option value="Paiement à la livraison" />
                <option value="50% à la commande, solde à la livraison" />
                <option value="Livraison sous 7 jours après paiement" />
              </datalist>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500">Produits</label>
              <button onClick={addLigne} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
            </div>
            <div className="flex gap-2 text-[11px] text-slate-400 px-1 mb-1">
              <span className="flex-1">Produit (prix appliqué automatiquement)</span>
              <span className="w-20">Quantité</span>
              <span className="w-24">Remise (%)</span>
              {lignes.length > 1 && <span className="w-9" />}
            </div>
            <div className="space-y-2">
              {lignes.map((l, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 relative">
                    {l.libre ? (
                      <input value={l.produitNom} onChange={(e) => updateLigne(i, { produitNom: e.target.value })} placeholder="Désignation du produit (hors catalogue)" className={inputCls + " border-amber-300 bg-amber-50/40"} />
                    ) : (
                      <input
                        value={ligneEnRecherche === i ? produitSearch : l.produitNom}
                        onChange={(e) => { setProduitSearch(e.target.value); updateLigne(i, { produitNom: e.target.value, produitId: null }); setLigneEnRecherche(i); }}
                        onFocus={() => setLigneEnRecherche(i)}
                        placeholder="Rechercher un produit…" className={inputCls}
                      />
                    )}
                    {!l.libre && ligneEnRecherche === i && !l.produitId && produitSearch.length >= 2 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {produits.map((p) => (
                          <button key={p.id} onClick={() => { updateLigne(i, { produitId: p.id, produitNom: p.nom }); setLigneEnRecherche(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex justify-between">
                            <span>{p.nom}</span><span className="text-slate-400">{Number(p.prixUnitaire).toLocaleString("fr-FR")}</span>
                          </button>
                        ))}
                        <button onClick={() => { updateLigne(i, { libre: true, produitId: null, produitNom: produitSearch }); setLigneEnRecherche(null); }} className="w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 border-t border-slate-100">
                          + Produit hors catalogue : « {produitSearch} »
                        </button>
                      </div>
                    )}
                    {!l.libre && !l.produitId && l.produitNom.trim() && (
                      <p className="text-[11px] text-amber-700 mt-0.5">Non choisi dans la liste : sera enregistré hors catalogue</p>
                    )}
                    {l.libre && (
                      <button onClick={() => updateLigne(i, { libre: false, prix: "", produitNom: "" })} className="text-[11px] text-slate-400 hover:text-slate-600 mt-0.5">← Choisir dans le catalogue</button>
                    )}
                  </div>
                  {l.libre && <input type="number" min="0" value={l.prix} onChange={(e) => updateLigne(i, { prix: e.target.value })} placeholder="Prix ?" className="w-24 px-3 py-2 border border-amber-300 bg-amber-50/40 rounded-lg text-sm" title="Prix unitaire indicatif (FCFA) — facultatif, l'administration le fixera" />}
                  <input type="number" step="0.25" min="0.25" value={l.quantite} onChange={(e) => updateLigne(i, { quantite: e.target.value })} placeholder="Qté" className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  <input type="number" min="0" max="100" value={l.remisePourcent} onChange={(e) => updateLigne(i, { remisePourcent: e.target.value })} placeholder="0" className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  {lignes.length > 1 && <button onClick={() => removeLigne(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
          </div>

          {lignes.some((l) => l.libre || (!l.produitId && l.produitNom.trim())) && (
            <p className="text-[11px] text-amber-700 -mt-2">Les produits hors catalogue (prix facultatif) seront associés au catalogue et chiffrés par l&apos;administration avant l&apos;envoi au client.</p>
          )}
          <div><label className="text-xs text-slate-500">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} /></div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Send className="w-4 h-4" /> Créer</button>
        </div>
      </div>
    </div>
  );
}
