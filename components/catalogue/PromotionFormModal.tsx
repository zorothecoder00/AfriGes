"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, X, Tag, Search } from "lucide-react";
import { TYPE_REMISE_LABEL, CIBLE_PROMOTION_LABEL } from "@/lib/promotions";

interface Ref { id: number; nom: string }
interface RefFamille extends Ref { sousFamilles?: Ref[] }
interface Referentiels { familles: RefFamille[]; categories: Ref[]; marques: Ref[] }
interface Pdv { id: number; nom: string }
interface Suggestion { id: number; label: string }

interface Props {
  promotionId: number | null;
  refs: Referentiels | null;
  pdvs: Pdv[];
  onClose: () => void;
  onSaved: () => void;
}

const CIBLES = ["PRODUIT", "CATEGORIE", "FAMILLE", "MARQUE", "TOUS"] as const;
const TYPES = ["POURCENTAGE", "MONTANT", "LOT"] as const;

// yyyy-MM-dd pour <input type="date">
function toDateInput(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Champ de recherche typeahead (produit ou client) alimenté par une API. */
function SearchSelect({
  label, placeholder, endpoint, mapItem, value, valueLabel, onPick,
}: {
  label: string; placeholder: string; endpoint: string;
  mapItem: (x: Record<string, unknown>) => Suggestion;
  value: number | null; valueLabel: string | null;
  onPick: (id: number | null, label: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || q.trim().length < 1) { setItems([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}search=${encodeURIComponent(q.trim())}&limit=8`);
        const j = await r.json();
        setItems((j.data ?? []).map(mapItem));
      } catch { setItems([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, open, endpoint, mapItem]);

  if (value && valueLabel) {
    return (
      <label className="block">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <div className="mt-1 flex items-center justify-between gap-2 px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm">
          <span className="truncate text-gray-800">{valueLabel}</span>
          <button type="button" onClick={() => onPick(null, null)} className="text-gray-400 hover:text-rose-500 shrink-0"><X className="w-4 h-4" /></button>
        </div>
      </label>
    );
  }

  return (
    <label className="block relative">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={q} placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {open && (q.trim().length >= 1) && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Recherche…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Aucun résultat</div>
          ) : items.map((it) => (
            <button type="button" key={it.id} onClick={() => { onPick(it.id, it.label); setQ(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-700">{it.label}</button>
          ))}
        </div>
      )}
    </label>
  );
}

export default function PromotionFormModal({ promotionId, refs, pdvs, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(!!promotionId);
  const [saving, setSaving] = useState(false);

  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [cible, setCible] = useState<(typeof CIBLES)[number]>("PRODUIT");
  const [produitId, setProduitId] = useState<number | null>(null);
  const [produitLabel, setProduitLabel] = useState<string | null>(null);
  const [categorieId, setCategorieId] = useState<number | null>(null);
  const [familleId, setFamilleId] = useState<number | null>(null);
  const [marqueId, setMarqueId] = useState<number | null>(null);

  const [typeRemise, setTypeRemise] = useState<(typeof TYPES)[number]>("POURCENTAGE");
  const [valeur, setValeur] = useState("");
  const [lotAchete, setLotAchete] = useState("");
  const [lotPaye, setLotPaye] = useState("");

  const [pointDeVenteId, setPointDeVenteId] = useState<number | null>(null);
  const [segment, setSegment] = useState("");
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientLabel, setClientLabel] = useState<string | null>(null);

  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [actif, setActif] = useState(true);
  const [priorite, setPriorite] = useState("0");

  useEffect(() => {
    if (!promotionId) return;
    (async () => {
      try {
        const r = await fetch(`/api/admin/catalogue/promotions/${promotionId}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? "Erreur");
        const p = j.data;
        setNom(p.nom); setDescription(p.description ?? "");
        setCible(p.cible);
        setProduitId(p.produitId ?? null);
        setProduitLabel(p.produit ? `${p.produit.nom}${p.produit.codeProduit ? ` (${p.produit.codeProduit})` : ""}` : null);
        setCategorieId(p.categorieId ?? null); setFamilleId(p.familleId ?? null); setMarqueId(p.marqueId ?? null);
        setTypeRemise(p.typeRemise); setValeur(p.valeur ? String(p.valeur) : "");
        setLotAchete(p.lotAchete ? String(p.lotAchete) : ""); setLotPaye(p.lotPaye != null ? String(p.lotPaye) : "");
        setPointDeVenteId(p.pointDeVenteId ?? null); setSegment(p.segment ?? "");
        setClientId(p.clientId ?? null);
        setClientLabel(p.client ? `${p.client.prenom} ${p.client.nom}` : null);
        setDateDebut(toDateInput(p.dateDebut)); setDateFin(toDateInput(p.dateFin));
        setActif(p.actif); setPriorite(String(p.priorite ?? 0));
      } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
      finally { setLoading(false); }
    })();
  }, [promotionId]);

  const mapProduit = useCallback((x: Record<string, unknown>): Suggestion => ({
    id: x.id as number, label: `${x.nom as string}${x.codeProduit ? ` (${x.codeProduit as string})` : ""}`,
  }), []);
  const mapClient = useCallback((x: Record<string, unknown>): Suggestion => ({
    id: x.id as number, label: `${(x.prenom as string) ?? ""} ${(x.nom as string) ?? ""}`.trim() + (x.telephone ? ` · ${x.telephone as string}` : ""),
  }), []);

  const submit = async () => {
    if (!nom.trim()) { toast.error("Le nom est requis"); return; }
    if (!dateDebut || !dateFin) { toast.error("Renseignez la période"); return; }
    setSaving(true);
    try {
      const payload = {
        nom: nom.trim(), description: description.trim() || null, cible,
        produitId: cible === "PRODUIT" ? produitId : null,
        categorieId: cible === "CATEGORIE" ? categorieId : null,
        familleId: cible === "FAMILLE" ? familleId : null,
        marqueId: cible === "MARQUE" ? marqueId : null,
        typeRemise,
        valeur: typeRemise === "LOT" ? 0 : Number(valeur),
        lotAchete: typeRemise === "LOT" ? Number(lotAchete) : null,
        lotPaye: typeRemise === "LOT" ? Number(lotPaye) : null,
        pointDeVenteId, segment: segment || null, clientId,
        dateDebut, dateFin, actif, priorite: Number(priorite) || 0,
      };
      const url = promotionId ? `/api/admin/catalogue/promotions/${promotionId}` : "/api/admin/catalogue/promotions";
      const r = await fetch(url, {
        method: promotionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success(promotionId ? "Promotion mise à jour ✓" : "Promotion créée ✓");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Tag className="w-5 h-5 text-blue-600" /> {promotionId ? "Modifier la promotion" : "Nouvelle promotion"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Identité */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2"><span className={lbl}>Nom de la promotion *</span>
                <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Soldes de fin d'année…" className={field} />
              </label>
              <label className="block md:col-span-2"><span className={lbl}>Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={field} />
              </label>
            </div>

            {/* Périmètre produit */}
            <div className="rounded-xl border border-slate-100 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Périmètre</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block"><span className={lbl}>S&apos;applique à *</span>
                  <select value={cible} onChange={(e) => setCible(e.target.value as (typeof CIBLES)[number])} className={field}>
                    {CIBLES.map((c) => <option key={c} value={c}>{CIBLE_PROMOTION_LABEL[c]}</option>)}
                  </select>
                </label>
                {cible === "PRODUIT" && (
                  <SearchSelect label="Produit *" placeholder="Rechercher un produit…" endpoint="/api/admin/catalogue/produits"
                    mapItem={mapProduit} value={produitId} valueLabel={produitLabel}
                    onPick={(id, l) => { setProduitId(id); setProduitLabel(l); }} />
                )}
                {cible === "CATEGORIE" && (
                  <label className="block"><span className={lbl}>Catégorie *</span>
                    <select value={categorieId ?? ""} onChange={(e) => setCategorieId(e.target.value ? Number(e.target.value) : null)} className={field}>
                      <option value="">— choisir —</option>
                      {refs?.categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                  </label>
                )}
                {cible === "FAMILLE" && (
                  <label className="block"><span className={lbl}>Famille *</span>
                    <select value={familleId ?? ""} onChange={(e) => setFamilleId(e.target.value ? Number(e.target.value) : null)} className={field}>
                      <option value="">— choisir —</option>
                      {refs?.familles.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                    </select>
                  </label>
                )}
                {cible === "MARQUE" && (
                  <label className="block"><span className={lbl}>Marque *</span>
                    <select value={marqueId ?? ""} onChange={(e) => setMarqueId(e.target.value ? Number(e.target.value) : null)} className={field}>
                      <option value="">— choisir —</option>
                      {refs?.marques.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </div>

            {/* Remise */}
            <div className="rounded-xl border border-slate-100 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Remise</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block"><span className={lbl}>Type de remise *</span>
                  <select value={typeRemise} onChange={(e) => setTypeRemise(e.target.value as (typeof TYPES)[number])} className={field}>
                    {TYPES.map((t) => <option key={t} value={t}>{TYPE_REMISE_LABEL[t]}</option>)}
                  </select>
                </label>
                {typeRemise === "POURCENTAGE" && (
                  <label className="block"><span className={lbl}>Pourcentage (%) *</span>
                    <input type="number" min={0} max={100} value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="15" className={field} />
                  </label>
                )}
                {typeRemise === "MONTANT" && (
                  <label className="block"><span className={lbl}>Montant remisé (XOF) *</span>
                    <input type="number" min={0} value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="500" className={field} />
                  </label>
                )}
                {typeRemise === "LOT" && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block"><span className={lbl}>Acheté *</span>
                      <input type="number" min={2} value={lotAchete} onChange={(e) => setLotAchete(e.target.value)} placeholder="3" className={field} />
                    </label>
                    <label className="block"><span className={lbl}>Payé *</span>
                      <input type="number" min={0} value={lotPaye} onChange={(e) => setLotPaye(e.target.value)} placeholder="2" className={field} />
                    </label>
                  </div>
                )}
              </div>
              {typeRemise === "LOT" && <p className="text-[11px] text-gray-400">Ex : « acheté 3, payé 2 » → le 3ᵉ article est offert.</p>}
            </div>

            {/* Restrictions bénéficiaires */}
            <div className="rounded-xl border border-slate-100 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Restrictions <span className="font-normal normal-case text-gray-400">(optionnel — vide = tout le monde)</span></p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block"><span className={lbl}>Agence</span>
                  <select value={pointDeVenteId ?? ""} onChange={(e) => setPointDeVenteId(e.target.value ? Number(e.target.value) : null)} className={field}>
                    <option value="">Toutes les agences</option>
                    {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </label>
                <label className="block"><span className={lbl}>Communauté / segment</span>
                  <select value={segment} onChange={(e) => setSegment(e.target.value)} className={field}>
                    <option value="">Tous les segments</option>
                    <option value="ORDINAIRE">Ordinaire</option>
                    <option value="RIA">Communauté RIA</option>
                  </select>
                </label>
                <div className="md:col-span-2">
                  <SearchSelect label="Client précis" placeholder="Rechercher un client…" endpoint="/api/admin/clients"
                    mapItem={mapClient} value={clientId} valueLabel={clientLabel}
                    onPick={(id, l) => { setClientId(id); setClientLabel(l); }} />
                </div>
              </div>
            </div>

            {/* Période & activation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block"><span className={lbl}>Début *</span>
                <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={field} />
              </label>
              <label className="block"><span className={lbl}>Fin *</span>
                <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={field} />
              </label>
              <label className="block"><span className={lbl}>Priorité</span>
                <input type="number" value={priorite} onChange={(e) => setPriorite(e.target.value)} className={field} />
                <span className="text-[11px] text-gray-400">Plus élevé = prioritaire si plusieurs promos s&apos;appliquent.</span>
              </label>
              <label className="flex items-center gap-2 mt-6 cursor-pointer">
                <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-700">Promotion active</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />} {promotionId ? "Enregistrer" : "Créer la promotion"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
