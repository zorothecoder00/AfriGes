"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, Save, Image as ImageIcon } from "lucide-react";

// ── Types des référentiels (chargés par la page parente) ────────────────────
interface RefItem { id: number; nom: string; actif: boolean }
interface FamilleRef extends RefItem { sousFamilles: RefItem[] }
interface CategorieRef extends RefItem { sousCategories: RefItem[] }
export interface Referentiels {
  familles: FamilleRef[];
  categories: CategorieRef[];
  marques: RefItem[];
  unites: (RefItem & { symbole: string | null })[];
}
interface FournisseurRef { id: number; nom: string }

const STATUTS = [
  { v: "ACTIF", l: "Actif" }, { v: "EN_ATTENTE", l: "En attente" }, { v: "SUSPENDU", l: "Suspendu" },
  { v: "MASQUE", l: "Masqué" }, { v: "ARCHIVE", l: "Archivé" },
];

// État du formulaire : toutes les valeurs en string pour des inputs contrôlés simples.
type FormState = Record<string, string>;
const EMPTY: FormState = {
  nom: "", nomCommercial: "", description: "", reference: "", codeBarre: "", qrCode: "", statut: "ACTIF",
  prixUnitaire: "", prixAchat: "", alerteStock: "0",
  familleId: "", sousFamilleId: "", categorieId: "", sousCategorieId: "", marqueId: "", fournisseurPrincipalId: "", paysOrigine: "",
  poids: "", volume: "", dimensions: "", couleur: "", saveur: "", conditionnement: "", uniteVenteId: "", uniteAchatId: "",
  imagePrincipaleUrl: "", ficheTechniqueUrl: "", videoUrl: "", motifPrix: "",
};

export default function ProduitFormModal({ produitId, refs, onClose, onSaved }:
  { produitId: number | null; refs: Referentiels | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(!!produitId);
  const [saving, setSaving] = useState(false);
  const [fournisseurs, setFournisseurs] = useState<FournisseurRef[]>([]);
  const isEdit = produitId != null;

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Charger la fiche existante (édition)
  useEffect(() => {
    if (!produitId) return;
    (async () => {
      try {
        const r = await fetch(`/api/admin/catalogue/produits/${produitId}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? "Erreur");
        const p = j.data;
        const s = (v: unknown) => (v == null ? "" : String(v));
        setForm({
          nom: s(p.nom), nomCommercial: s(p.nomCommercial), description: s(p.description), reference: s(p.reference),
          codeBarre: s(p.codeBarre), qrCode: s(p.qrCode), statut: s(p.statut) || "ACTIF",
          prixUnitaire: s(p.prixUnitaire), prixAchat: s(p.prixAchat), alerteStock: s(p.alerteStock),
          familleId: s(p.familleId), sousFamilleId: s(p.sousFamilleId), categorieId: s(p.categorieId), sousCategorieId: s(p.sousCategorieId),
          marqueId: s(p.marqueId), fournisseurPrincipalId: s(p.fournisseurPrincipalId), paysOrigine: s(p.paysOrigine),
          poids: s(p.poids), volume: s(p.volume), dimensions: s(p.dimensions), couleur: s(p.couleur), saveur: s(p.saveur),
          conditionnement: s(p.conditionnement), uniteVenteId: s(p.uniteVenteId), uniteAchatId: s(p.uniteAchatId),
          imagePrincipaleUrl: s(p.imagePrincipaleUrl), ficheTechniqueUrl: s(p.ficheTechniqueUrl), videoUrl: s(p.videoUrl), motifPrix: "",
        });
      } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
      finally { setLoading(false); }
    })();
  }, [produitId]);

  useEffect(() => {
    fetch("/api/admin/catalogue/fournisseurs").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j?.data) setFournisseurs(j.data);
    }).catch(() => {});
  }, []);

  // Image principale → data-URI (embarquée, comme les photos clients)
  const onImage = (file: File | null) => {
    if (!file) return;
    if (file.size > 1_500_000) { toast.error("Image trop lourde (max 1,5 Mo)"); return; }
    const reader = new FileReader();
    reader.onload = () => set("imagePrincipaleUrl", String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!form.nom.trim()) { toast.error("Le nom est requis"); return; }
    if (!isEdit && (!form.prixUnitaire || Number(form.prixUnitaire) <= 0)) { toast.error("Prix de vente requis (> 0)"); return; }
    setSaving(true);
    try {
      // On envoie tout ; le serveur nettoie (vides → null). IDs "" → non envoyés.
      const payload: Record<string, unknown> = { ...form };
      for (const k of Object.keys(payload)) if (payload[k] === "") delete payload[k];
      const url = isEdit ? `/api/admin/catalogue/produits/${produitId}` : "/api/admin/catalogue/produits";
      const r = await fetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success(isEdit ? "Produit modifié ✓" : "Produit créé ✓");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const sousFamilles = refs?.familles.find((f) => String(f.id) === form.familleId)?.sousFamilles ?? [];
  const sousCategories = refs?.categories.find((c) => String(c.id) === form.categorieId)?.sousCategories ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-gray-800 text-lg">{isEdit ? "Modifier le produit" : "Nouveau produit"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Identification */}
            <Section title="Identification">
              <Field label="Désignation *" span2><input value={form.nom} onChange={(e) => set("nom", e.target.value)} className={inputCls} /></Field>
              <Field label="Nom commercial"><input value={form.nomCommercial} onChange={(e) => set("nomCommercial", e.target.value)} className={inputCls} /></Field>
              <Field label="Référence interne"><input value={form.reference} onChange={(e) => set("reference", e.target.value)} className={inputCls} /></Field>
              <Field label="Code-barres"><input value={form.codeBarre} onChange={(e) => set("codeBarre", e.target.value)} className={inputCls} /></Field>
              <Field label="QR Code (contenu)"><input value={form.qrCode} onChange={(e) => set("qrCode", e.target.value)} className={inputCls} /></Field>
              <Field label="Statut">
                <select value={form.statut} onChange={(e) => set("statut", e.target.value)} className={inputCls}>
                  {STATUTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </Field>
              <Field label="Description" span2><textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className={inputCls} /></Field>
            </Section>

            {/* Prix */}
            <Section title="Prix">
              <Field label="Prix de vente (FCFA) *"><input type="number" min={0} value={form.prixUnitaire} onChange={(e) => set("prixUnitaire", e.target.value)} className={inputCls} /></Field>
              <Field label="Prix d'achat (FCFA)"><input type="number" min={0} value={form.prixAchat} onChange={(e) => set("prixAchat", e.target.value)} className={inputCls} /></Field>
              <Field label="Seuil d'alerte stock"><input type="number" min={0} value={form.alerteStock} onChange={(e) => set("alerteStock", e.target.value)} className={inputCls} /></Field>
              {isEdit && <Field label="Motif (si changement de prix)" span2><input value={form.motifPrix} onChange={(e) => set("motifPrix", e.target.value)} placeholder="Ex. hausse fournisseur" className={inputCls} /></Field>}
              <p className="col-span-2 text-[11px] text-gray-400">Les prix multiples (crédit, VIP, communauté…) seront gérés dans l&apos;onglet Tarification (Phase 2).</p>
            </Section>

            {/* Classification */}
            <Section title="Classification">
              <Field label="Famille">
                <select value={form.familleId} onChange={(e) => { set("familleId", e.target.value); set("sousFamilleId", ""); }} className={inputCls}>
                  <option value="">—</option>
                  {refs?.familles.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              </Field>
              <Field label="Sous-famille">
                <select value={form.sousFamilleId} onChange={(e) => set("sousFamilleId", e.target.value)} disabled={!form.familleId} className={inputCls}>
                  <option value="">—</option>
                  {sousFamilles.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </Field>
              <Field label="Catégorie">
                <select value={form.categorieId} onChange={(e) => { set("categorieId", e.target.value); set("sousCategorieId", ""); }} className={inputCls}>
                  <option value="">—</option>
                  {refs?.categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </Field>
              <Field label="Sous-catégorie">
                <select value={form.sousCategorieId} onChange={(e) => set("sousCategorieId", e.target.value)} disabled={!form.categorieId} className={inputCls}>
                  <option value="">—</option>
                  {sousCategories.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </Field>
              <Field label="Marque">
                <select value={form.marqueId} onChange={(e) => set("marqueId", e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {refs?.marques.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </Field>
              <Field label="Fournisseur principal">
                <select value={form.fournisseurPrincipalId} onChange={(e) => set("fournisseurPrincipalId", e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              </Field>
              <Field label="Pays d'origine"><input value={form.paysOrigine} onChange={(e) => set("paysOrigine", e.target.value)} className={inputCls} /></Field>
            </Section>

            {/* Caractéristiques */}
            <Section title="Caractéristiques">
              <Field label="Poids (kg)"><input type="number" min={0} step="0.001" value={form.poids} onChange={(e) => set("poids", e.target.value)} className={inputCls} /></Field>
              <Field label="Volume (L)"><input type="number" min={0} step="0.001" value={form.volume} onChange={(e) => set("volume", e.target.value)} className={inputCls} /></Field>
              <Field label="Dimensions"><input value={form.dimensions} onChange={(e) => set("dimensions", e.target.value)} placeholder="30x20x10 cm" className={inputCls} /></Field>
              <Field label="Couleur"><input value={form.couleur} onChange={(e) => set("couleur", e.target.value)} className={inputCls} /></Field>
              <Field label="Saveur"><input value={form.saveur} onChange={(e) => set("saveur", e.target.value)} className={inputCls} /></Field>
              <Field label="Conditionnement"><input value={form.conditionnement} onChange={(e) => set("conditionnement", e.target.value)} placeholder="Carton de 12" className={inputCls} /></Field>
              <Field label="Unité de vente">
                <select value={form.uniteVenteId} onChange={(e) => set("uniteVenteId", e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {refs?.unites.map((u) => <option key={u.id} value={u.id}>{u.nom}{u.symbole ? ` (${u.symbole})` : ""}</option>)}
                </select>
              </Field>
              <Field label="Unité d'achat">
                <select value={form.uniteAchatId} onChange={(e) => set("uniteAchatId", e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {refs?.unites.map((u) => <option key={u.id} value={u.id}>{u.nom}{u.symbole ? ` (${u.symbole})` : ""}</option>)}
                </select>
              </Field>
            </Section>

            {/* Images */}
            <Section title="Images & documents">
              <Field label="Image principale" span2>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {form.imagePrincipaleUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={form.imagePrincipaleUrl} alt="" className="w-full h-full object-cover" />
                      : <ImageIcon className="w-6 h-6 text-slate-300" />}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <input type="file" accept="image/*" onChange={(e) => onImage(e.target.files?.[0] ?? null)} className="text-xs" />
                    {form.imagePrincipaleUrl && <button onClick={() => set("imagePrincipaleUrl", "")} className="text-[11px] text-rose-500 text-left">Retirer</button>}
                  </div>
                </div>
              </Field>
              <Field label="Fiche technique (URL PDF)"><input value={form.ficheTechniqueUrl} onChange={(e) => set("ficheTechniqueUrl", e.target.value)} className={inputCls} /></Field>
              <Field label="Vidéo (URL)"><input value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} className={inputCls} /></Field>
            </Section>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">Annuler</button>
              <button onClick={submit} disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {isEdit ? "Enregistrer" : "Créer le produit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
function Field({ label, span2, children }: { label: string; span2?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${span2 ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-slate-500 block mb-1">{label}</span>
      {children}
    </label>
  );
}
