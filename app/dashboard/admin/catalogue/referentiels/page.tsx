"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Layers, Tag, Boxes, Ruler, Plus, Trash2, Pencil, Check, X, ChevronRight, ChevronDown, ArrowLeft, Loader2, Landmark,
} from "lucide-react";
import SideTabs from "@/components/ui/SideTabs";

type TabKey = "familles" | "categories" | "marques" | "unites";

// Comptabilisation par famille/catégorie (CDC §52/§53) — niveau intermédiaire
// de la cascade Produit > Catégorie > Famille > Configuration générale.
interface ComptesRef {
  compteAchat: string | null; compteVente: string | null; compteStock: string | null;
  compteVariationStock: string | null; compteTvaAchat: string | null; compteTvaVente: string | null;
}
const COMPTES_VIDES: ComptesRef = { compteAchat: null, compteVente: null, compteStock: null, compteVariationStock: null, compteTvaAchat: null, compteTvaVente: null };

interface SousItem { id: number; nom: string; actif: boolean; _count: { produits: number } }
interface Famille extends ComptesRef { id: number; nom: string; description: string | null; actif: boolean; sousFamilles: SousItem[]; _count: { produits: number } }
interface Categorie extends ComptesRef { id: number; nom: string; description: string | null; actif: boolean; sousCategories: SousItem[]; _count: { produits: number } }
interface Marque { id: number; nom: string; logoUrl: string | null; actif: boolean; _count: { produits: number } }
interface Unite { id: number; nom: string; symbole: string | null; actif: boolean; _count: { produitsVente: number; produitsAchat: number } }
interface Referentiels { familles: Famille[]; categories: Categorie[]; marques: Marque[]; unites: Unite[] }

const TABS: { key: TabKey; label: string; icon: typeof Layers }[] = [
  { key: "familles", label: "Familles", icon: Layers },
  { key: "categories", label: "Catégories", icon: Tag },
  { key: "marques", label: "Marques", icon: Boxes },
  { key: "unites", label: "Unités", icon: Ruler },
];

export default function ReferentielsCataloguePage() {
  const [data, setData] = useState<Referentiels | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("familles");

  const reload = async () => {
    try {
      const r = await fetch("/api/admin/catalogue/referentiels");
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setData(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  // ── mutations génériques ────────────────────────────────────────────────
  const create = async (type: string, payload: Record<string, unknown>) => {
    const r = await fetch(`/api/admin/catalogue/referentiels/${type}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.message ?? "Erreur"); return false; }
    toast.success("Ajouté ✓"); await reload(); return true;
  };
  const patch = async (type: string, id: number, payload: Record<string, unknown>) => {
    const r = await fetch(`/api/admin/catalogue/referentiels/${type}/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.message ?? "Erreur"); return false; }
    await reload(); return true;
  };
  const remove = async (type: string, id: number) => {
    const r = await fetch(`/api/admin/catalogue/referentiels/${type}/${id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) { toast.error(j.message ?? "Erreur"); return; }
    toast.success("Supprimé ✓"); await reload();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Catalogue · Référentiels</h2>
          <p className="text-sm text-slate-400">Familles, catégories, marques et unités qui structurent le catalogue produits.</p>
        </div>

        {loading || !data ? (
          <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            <SideTabs
              accent="blue"
              items={TABS.map((t) => {
                const Icon = t.icon;
                return {
                  key: t.key,
                  label: t.label,
                  icon: <Icon className="w-4 h-4" />,
                  active: tab === t.key,
                  onClick: () => setTab(t.key),
                };
              })}
            />
            <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              {tab === "familles" && (
                <HierarchieSection
                  type="familles" childType="sous-familles" parentKey="familleId"
                  items={data.familles.map((f) => ({
                    id: f.id, nom: f.nom, actif: f.actif, count: f._count.produits,
                    enfants: f.sousFamilles.map((s) => ({ id: s.id, nom: s.nom, actif: s.actif, count: s._count.produits })),
                    comptes: { compteAchat: f.compteAchat, compteVente: f.compteVente, compteStock: f.compteStock, compteVariationStock: f.compteVariationStock, compteTvaAchat: f.compteTvaAchat, compteTvaVente: f.compteTvaVente },
                  }))}
                  onCreate={create} onPatch={patch} onRemove={remove}
                />
              )}
              {tab === "categories" && (
                <HierarchieSection
                  type="categories" childType="sous-categories" parentKey="categorieId"
                  items={data.categories.map((c) => ({
                    id: c.id, nom: c.nom, actif: c.actif, count: c._count.produits,
                    enfants: c.sousCategories.map((s) => ({ id: s.id, nom: s.nom, actif: s.actif, count: s._count.produits })),
                    comptes: { compteAchat: c.compteAchat, compteVente: c.compteVente, compteStock: c.compteStock, compteVariationStock: c.compteVariationStock, compteTvaAchat: c.compteTvaAchat, compteTvaVente: c.compteTvaVente },
                  }))}
                  onCreate={create} onPatch={patch} onRemove={remove}
                />
              )}
              {tab === "marques" && (
                <FlatSection type="marques"
                  items={data.marques.map((m) => ({ id: m.id, nom: m.nom, actif: m.actif, count: m._count.produits }))}
                  onCreate={create} onPatch={patch} onRemove={remove}
                />
              )}
              {tab === "unites" && (
                <FlatSection type="unites" extraLabel="Symbole" extraKey="symbole"
                  items={data.unites.map((u) => ({ id: u.id, nom: u.nom, actif: u.actif, count: u._count.produitsVente + u._count.produitsAchat, extra: u.symbole }))}
                  onCreate={create} onPatch={patch} onRemove={remove}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Mut = (type: string, payload: Record<string, unknown>) => Promise<boolean>;
type MutId = (type: string, id: number, payload: Record<string, unknown>) => Promise<boolean>;
type Del = (type: string, id: number) => Promise<void>;

interface FlatItem { id: number; nom: string; actif: boolean; count: number; extra?: string | null; comptes?: ComptesRef }

// Familles / Catégories (avec enfants)
function HierarchieSection({ type, childType, parentKey, items, onCreate, onPatch, onRemove }:
  { type: string; childType: string; parentKey: string; items: (FlatItem & { enfants: FlatItem[]; comptes: ComptesRef })[]; onCreate: Mut; onPatch: MutId; onRemove: Del }) {
  const [nouveau, setNouveau] = useState("");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [ajoutEnfant, setAjoutEnfant] = useState<Record<number, string>>({});
  const toggleOpen = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={nouveau} onChange={(e) => setNouveau(e.target.value)}
          placeholder={`Nouvelle ${type === "familles" ? "famille" : "catégorie"}…`}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={async () => { if (nouveau.trim() && await onCreate(type, { nom: nouveau.trim() })) setNouveau(""); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {items.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Aucun élément.</p> : (
        <ul className="divide-y divide-slate-50">
          {items.map((it) => (
            <li key={it.id} className="py-1.5">
              <div className="flex items-center gap-2">
                <button onClick={() => toggleOpen(it.id)} className="text-slate-400 hover:text-slate-600">
                  {open.has(it.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <RefRow item={it} type={type} onPatch={onPatch} onRemove={onRemove} childLabel={`${it.enfants.length} sous-élément(s)`} comptable={it.comptes} />
              </div>
              {open.has(it.id) && (
                <div className="ml-8 mt-1.5 space-y-1.5 border-l border-slate-100 pl-3">
                  {it.enfants.map((ch) => (
                    <RefRow key={ch.id} item={ch} type={childType} onPatch={onPatch} onRemove={onRemove} small />
                  ))}
                  <div className="flex gap-2">
                    <input value={ajoutEnfant[it.id] ?? ""} onChange={(e) => setAjoutEnfant((a) => ({ ...a, [it.id]: e.target.value }))}
                      placeholder="Ajouter un sous-élément…"
                      className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={async () => { const v = (ajoutEnfant[it.id] ?? "").trim(); if (v && await onCreate(childType, { nom: v, [parentKey]: it.id })) setAjoutEnfant((a) => ({ ...a, [it.id]: "" })); }}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Marques / Unités (plat)
function FlatSection({ type, items, extraLabel, extraKey, onCreate, onPatch, onRemove }:
  { type: string; items: FlatItem[]; extraLabel?: string; extraKey?: string; onCreate: Mut; onPatch: MutId; onRemove: Del }) {
  const [nom, setNom] = useState("");
  const [extra, setExtra] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={`Nouvelle ${type === "marques" ? "marque" : "unité"}…`}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {extraKey && (
          <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={extraLabel}
            className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        )}
        <button onClick={async () => { if (nom.trim() && await onCreate(type, { nom: nom.trim(), ...(extraKey ? { [extraKey]: extra.trim() || undefined } : {}) })) { setNom(""); setExtra(""); } }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>
      {items.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Aucun élément.</p> : (
        <ul className="divide-y divide-slate-50">
          {items.map((it) => (
            <li key={it.id} className="py-1.5"><RefRow item={it} type={type} onPatch={onPatch} onRemove={onRemove} showExtra={!!extraKey} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Ligne éditable (rename inline + toggle actif + delete)
function RefRow({ item, type, onPatch, onRemove, small, childLabel, showExtra, comptable }:
  { item: FlatItem; type: string; onPatch: MutId; onRemove: Del; small?: boolean; childLabel?: string; showExtra?: boolean; comptable?: ComptesRef }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(item.nom);
  const [busy, setBusy] = useState(false);
  const [comptaOpen, setComptaOpen] = useState(false);

  const save = async () => {
    if (!val.trim() || val.trim() === item.nom) { setEdit(false); return; }
    setBusy(true); const ok = await onPatch(type, item.id, { nom: val.trim() }); setBusy(false);
    if (ok) setEdit(false);
  };

  return (
    <div className={comptable ? "flex-1" : ""}>
      <div className="flex items-center gap-2 flex-1">
        {edit ? (
          <>
            <input value={val} autoFocus onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()}
              className={`flex-1 px-2 py-1 border border-blue-300 rounded-lg ${small ? "text-xs" : "text-sm"} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
            <button onClick={save} disabled={busy} className="text-emerald-600 hover:text-emerald-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</button>
            <button onClick={() => { setEdit(false); setVal(item.nom); }} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </>
        ) : (
          <>
            <span className={`flex-1 ${small ? "text-xs" : "text-sm"} font-medium ${item.actif ? "text-slate-800" : "text-slate-400 line-through"}`}>
              {item.nom}
              {showExtra && item.extra ? <span className="text-slate-400 font-normal ml-1">({item.extra})</span> : null}
            </span>
            <span className="text-[10px] text-slate-400">{childLabel ?? `${item.count} produit(s)`}</span>
            {/* actif toggle */}
            <button onClick={() => onPatch(type, item.id, { actif: !item.actif })}
              title={item.actif ? "Désactiver" : "Activer"}
              className={`relative w-8 h-4.5 rounded-full transition-colors ${item.actif ? "bg-emerald-500" : "bg-slate-300"}`} style={{ height: 18, width: 32 }}>
              <span className="absolute top-0.5 bg-white rounded-full transition-transform" style={{ height: 14, width: 14, left: item.actif ? 15 : 2 }} />
            </button>
            {comptable && (
              <button onClick={() => setComptaOpen((v) => !v)} title="Comptabilisation (CDC §52/§53)"
                className={`hover:text-blue-600 ${comptaOpen ? "text-blue-600" : "text-slate-400"}`}>
                <Landmark className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => setEdit(true)} className="text-slate-400 hover:text-blue-600" title="Renommer"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => onRemove(type, item.id)} className="text-slate-400 hover:text-rose-500" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
          </>
        )}
      </div>
      {comptable && comptaOpen && (
        <ComptesEditor comptes={comptable} onSave={(payload) => onPatch(type, item.id, payload)} onClose={() => setComptaOpen(false)} />
      )}
    </div>
  );
}

const CHAMPS_COMPTABLES: { key: keyof ComptesRef; label: string; placeholder: string }[] = [
  { key: "compteAchat", label: "Compte achat", placeholder: "601" },
  { key: "compteVente", label: "Compte vente", placeholder: "701" },
  { key: "compteStock", label: "Compte stock", placeholder: "311" },
  { key: "compteVariationStock", label: "Compte variation stock", placeholder: "6031" },
  { key: "compteTvaAchat", label: "Compte TVA achat", placeholder: "4452" },
  { key: "compteTvaVente", label: "Compte TVA vente", placeholder: "4431" },
];

/**
 * Éditeur inline des 6 comptes CDC §52 sur une famille/catégorie (niveau
 * intermédiaire de la cascade §53 — un champ laissé vide hérite du niveau
 * supérieur, résolu par lib/comptabilite/comptesProduit.ts).
 */
function ComptesEditor({ comptes, onSave, onClose }: { comptes: ComptesRef; onSave: (payload: Record<string, unknown>) => Promise<boolean>; onClose: () => void }) {
  const [vals, setVals] = useState<ComptesRef>({ ...COMPTES_VIDES, ...comptes });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const ok = await onSave(Object.fromEntries(CHAMPS_COMPTABLES.map((c) => [c.key, vals[c.key] ?? ""])));
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <div className="mt-1.5 mb-1 ml-8 p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg grid grid-cols-2 sm:grid-cols-3 gap-2">
      {CHAMPS_COMPTABLES.map((c) => (
        <label key={c.key} className="block">
          <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">{c.label}</span>
          <input value={vals[c.key] ?? ""} placeholder={c.placeholder}
            onChange={(e) => setVals((v) => ({ ...v, [c.key]: e.target.value }))}
            className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
      ))}
      <div className="col-span-2 sm:col-span-3 flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700">Annuler</button>
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-medium">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Enregistrer
        </button>
      </div>
    </div>
  );
}
