"use client";

import { useState } from "react";
import IdentiteAgent from "./IdentiteAgent";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { X, Plus, Send, Trash2, MapPin, Loader2 } from "lucide-react";

export interface ClientRef { id: number; nom: string; prenom: string; telephone: string; adresse: string | null }
interface ProduitRef { id: number; nom: string; reference: string | null; prixUnitaire: number | string }
type LigneForm = { produitId: number | null; produitNom: string; quantite: string; remisePourcent: string; libre: boolean; prix: string };
const LIGNE_VIDE: LigneForm = { produitId: null, produitNom: "", quantite: "", remisePourcent: "0", libre: false, prix: "" };
const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

export default function NouvelleCommandeClient({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [clientSearch, setClientSearch] = useState("");
  const [client, setClient] = useState<ClientRef | null>(null);
  const [typeClientCommande, setTypeClientCommande] = useState<"PARTICULIER" | "REVENDEUR">("PARTICULIER");
  const [modeReglement, setModeReglement] = useState<"COMPTANT" | "MOBILE_MONEY" | "CREDIT">("COMPTANT");
  const [dateLivraisonSouhaitee, setDateLivraisonSouhaitee] = useState("");
  const [lieuLivraison, setLieuLivraison] = useState("");
  const [lignes, setLignes] = useState<LigneForm[]>([{ ...LIGNE_VIDE }]);
  const [gps, setGps] = useState<{ latitude: number; longitude: number; precision: number } | null>(null);
  const [gpsEnCours, setGpsEnCours] = useState(false);
  const [produitSearch, setProduitSearch] = useState("");
  const [ligneEnRecherche, setLigneEnRecherche] = useState<number | null>(null);
  const [signatureClientNom, setSignatureClientNom] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clientsData } = useApi<{ data: ClientRef[] }>(clientSearch.length >= 2 ? `/api/agentTerrain/clients?search=${encodeURIComponent(clientSearch)}&limit=8` : null);
  const { data: produitsData } = useApi<{ data: ProduitRef[] }>(produitSearch.length >= 2 ? `/api/agentTerrain/produits?search=${encodeURIComponent(produitSearch)}&limit=10` : null);
  const clients = clientsData?.data ?? [];
  const produits = produitsData?.data ?? [];

  const updateLigne = (idx: number, patch: Partial<(typeof lignes)[number]>) => setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLigne = () => setLignes((prev) => [...prev, { ...LIGNE_VIDE }]);

  // Position GPS de la prise de commande (facultative) : relevée par l'appareil de l'agent.
  const capturerPosition = () => {
    if (!navigator.geolocation) { toast.error("La géolocalisation n'est pas disponible sur cet appareil"); return; }
    setGpsEnCours(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setGps({ latitude: p.coords.latitude, longitude: p.coords.longitude, precision: p.coords.accuracy }); setGpsEnCours(false); },
      (e) => { setGpsEnCours(false); toast.error(e.code === 1 ? "Autorisez la localisation dans votre navigateur" : "Position introuvable, réessayez"); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  const removeLigne = (idx: number) => setLignes((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!client) { toast.error("Sélectionnez un client"); return; }
    if (!signatureClientNom.trim()) { toast.error("Signature électronique du client obligatoire"); return; }
    const lignesValides = lignes.filter((l) => Number(l.quantite) > 0 && (l.libre ? l.produitNom.trim() && Number(l.prix) > 0 : l.produitId));
    if (lignesValides.length === 0) { toast.error("Ajoutez au moins une ligne valide"); return; }

    setSaving(true);
    try {
      const r = await fetch("/api/ventes/commandes-client", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id, typeClientCommande, modeReglement,
          dateLivraisonSouhaitee: dateLivraisonSouhaitee || undefined, lieuLivraison: lieuLivraison || undefined,
          lignes: lignesValides.map((l) => l.libre
            ? { designation: l.produitNom.trim(), prixUnitaire: Number(l.prix), quantite: Number(l.quantite), remisePourcent: Number(l.remisePourcent) || 0 }
            : { produitId: l.produitId, quantite: Number(l.quantite), remisePourcent: Number(l.remisePourcent) || 0 }),
          ...(gps ? { latitude: gps.latitude, longitude: gps.longitude, precisionGps: gps.precision } : {}),
          signatureClientNom, notes: notes || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Commande soumise"); onCreated(j.data.id); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle commande client</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <IdentiteAgent />
          <div>
            <label className="text-xs text-slate-500">Client (recherche par téléphone ou nom)</label>
            {client ? (
              <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                <span>{client.prenom} {client.nom} — {client.telephone}</span>
                <button onClick={() => { setClient(null); setClientSearch(""); }} className="text-emerald-700 hover:text-emerald-900"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Téléphone ou nom…" className={inputCls} />
                {clients.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {clients.map((c) => (
                      <button key={c.id} onClick={() => setClient(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{c.prenom} {c.nom} — {c.telephone}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Type de client</label>
              <select value={typeClientCommande} onChange={(e) => setTypeClientCommande(e.target.value as typeof typeClientCommande)} className={inputCls}>
                <option value="PARTICULIER">Particulier</option>
                <option value="REVENDEUR">Revendeur</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Mode de règlement</label>
              <select value={modeReglement} onChange={(e) => setModeReglement(e.target.value as typeof modeReglement)} className={inputCls}>
                <option value="COMPTANT">Comptant</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="CREDIT">À crédit</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Date de livraison souhaitée</label>
              <input type="date" value={dateLivraisonSouhaitee} onChange={(e) => setDateLivraisonSouhaitee(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Lieu de livraison</label>
              <input value={lieuLivraison} onChange={(e) => setLieuLivraison(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500">Produits</label>
            <div className="space-y-2 mt-1">
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
                    {l.libre && (
                      <button onClick={() => updateLigne(i, { libre: false, prix: "", produitNom: "" })} className="text-[11px] text-slate-400 hover:text-slate-600 mt-0.5">← Choisir dans le catalogue</button>
                    )}
                  </div>
                  {l.libre && <input type="number" min="1" value={l.prix} onChange={(e) => updateLigne(i, { prix: e.target.value })} placeholder="Prix unit." className="w-24 px-3 py-2 border border-amber-300 bg-amber-50/40 rounded-lg text-sm" title="Prix unitaire indicatif (FCFA)" />}
                  <input type="number" min="1" value={l.quantite} onChange={(e) => updateLigne(i, { quantite: e.target.value })} placeholder="Qté" className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  <input type="number" min="0" max="100" value={l.remisePourcent} onChange={(e) => updateLigne(i, { remisePourcent: e.target.value })} placeholder="Remise %" className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  {lignes.length > 1 && <button onClick={() => removeLigne(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            <button onClick={addLigne} className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Ajouter un produit</button>
            {lignes.some((l) => l.libre) && (
              <p className="text-[11px] text-amber-700 mt-1.5">Les produits hors catalogue devront être associés à un produit du catalogue par l&apos;administration avant validation de la commande.</p>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-500">Position GPS <span className="text-slate-400">(facultatif)</span></label>
            {gps ? (
              <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-emerald-600" /> {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)} <span className="text-slate-400">(±{Math.round(gps.precision)} m)</span></span>
                <button onClick={() => setGps(null)} className="text-emerald-700 hover:text-emerald-900"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={capturerPosition} disabled={gpsEnCours} className="w-full flex items-center justify-center gap-1.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium disabled:opacity-60">
                {gpsEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} {gpsEnCours ? "Localisation en cours…" : "Enregistrer ma position actuelle"}
              </button>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-500">Signature électronique du client (vaut engagement d&apos;achat)</label>
            <input value={signatureClientNom} onChange={(e) => setSignatureClientNom(e.target.value)} placeholder="Nom et prénom du client" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            <Send className="w-4 h-4" /> Soumettre
          </button>
        </div>
      </div>
    </div>
  );
}
