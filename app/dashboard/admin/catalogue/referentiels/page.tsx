"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Layers, Tag, Boxes, Ruler, Plus, Trash2, Pencil, Check, X, ChevronRight, ChevronDown, ArrowLeft, Loader2,
} from "lucide-react";

type TabKey = "familles" | "categories" | "marques" | "unites";

interface SousItem { id: number; nom: string; actif: boolean; _count: { produits: number } }
interface Famille { id: number; nom: string; description: string | null; actif: boolean; sousFamilles: SousItem[]; _count: { produits: number } }
interface Categorie { id: number; nom: string; description: string | null; actif: boolean; sousCategories: SousItem[]; _count: { produits: number } }
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
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Catalogue · Référentiels</h2>
          <p className="text-sm text-gray-400">Familles, catégories, marques et unités qui structurent le catalogue produits.</p>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {loading || !data ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            {tab === "familles" && (
              <HierarchieSection
                type="familles" childType="sous-familles" parentKey="familleId"
                items={data.familles.map((f) => ({ id: f.id, nom: f.nom, actif: f.actif, count: f._count.produits, enfants: f.sousFamilles.map((s) => ({ id: s.id, nom: s.nom, actif: s.actif, count: s._count.produits })) }))}
                onCreate={create} onPatch={patch} onRemove={remove}
              />
            )}
            {tab === "categories" && (
              <HierarchieSection
                type="categories" childType="sous-categories" parentKey="categorieId"
                items={data.categories.map((c) => ({ id: c.id, nom: c.nom, actif: c.actif, count: c._count.produits, enfants: c.sousCategories.map((s) => ({ id: s.id, nom: s.nom, actif: s.actif, count: s._count.produits })) }))}
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
        )}
      </div>
    </div>
  );
}

type Mut = (type: string, payload: Record<string, unknown>) => Promise<boolean>;
type MutId = (type: string, id: number, payload: Record<string, unknown>) => Promise<boolean>;
type Del = (type: string, id: number) => Promise<void>;

interface FlatItem { id: number; nom: string; actif: boolean; count: number; extra?: string | null }

// Familles / Catégories (avec enfants)
function HierarchieSection({ type, childType, parentKey, items, onCreate, onPatch, onRemove }:
  { type: string; childType: string; parentKey: string; items: (FlatItem & { enfants: FlatItem[] })[]; onCreate: Mut; onPatch: MutId; onRemove: Del }) {
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
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {items.length === 0 ? <p className="text-sm text-gray-400 py-4 text-center">Aucun élément.</p> : (
        <ul className="divide-y divide-gray-50">
          {items.map((it) => (
            <li key={it.id} className="py-1.5">
              <div className="flex items-center gap-2">
                <button onClick={() => toggleOpen(it.id)} className="text-gray-400 hover:text-gray-600">
                  {open.has(it.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <RefRow item={it} type={type} onPatch={onPatch} onRemove={onRemove} childLabel={`${it.enfants.length} sous-élément(s)`} />
              </div>
              {open.has(it.id) && (
                <div className="ml-8 mt-1.5 space-y-1.5 border-l border-gray-100 pl-3">
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
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>
      {items.length === 0 ? <p className="text-sm text-gray-400 py-4 text-center">Aucun élément.</p> : (
        <ul className="divide-y divide-gray-50">
          {items.map((it) => (
            <li key={it.id} className="py-1.5"><RefRow item={it} type={type} onPatch={onPatch} onRemove={onRemove} showExtra={!!extraKey} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Ligne éditable (rename inline + toggle actif + delete)
function RefRow({ item, type, onPatch, onRemove, small, childLabel, showExtra }:
  { item: FlatItem; type: string; onPatch: MutId; onRemove: Del; small?: boolean; childLabel?: string; showExtra?: boolean }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(item.nom);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!val.trim() || val.trim() === item.nom) { setEdit(false); return; }
    setBusy(true); const ok = await onPatch(type, item.id, { nom: val.trim() }); setBusy(false);
    if (ok) setEdit(false);
  };

  return (
    <div className="flex items-center gap-2 flex-1">
      {edit ? (
        <>
          <input value={val} autoFocus onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()}
            className={`flex-1 px-2 py-1 border border-blue-300 rounded-lg ${small ? "text-xs" : "text-sm"} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
          <button onClick={save} disabled={busy} className="text-emerald-600 hover:text-emerald-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</button>
          <button onClick={() => { setEdit(false); setVal(item.nom); }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </>
      ) : (
        <>
          <span className={`flex-1 ${small ? "text-xs" : "text-sm"} font-medium ${item.actif ? "text-gray-800" : "text-gray-400 line-through"}`}>
            {item.nom}
            {showExtra && item.extra ? <span className="text-gray-400 font-normal ml-1">({item.extra})</span> : null}
          </span>
          <span className="text-[10px] text-gray-400">{childLabel ?? `${item.count} produit(s)`}</span>
          {/* actif toggle */}
          <button onClick={() => onPatch(type, item.id, { actif: !item.actif })}
            title={item.actif ? "Désactiver" : "Activer"}
            className={`relative w-8 h-4.5 rounded-full transition-colors ${item.actif ? "bg-emerald-500" : "bg-gray-300"}`} style={{ height: 18, width: 32 }}>
            <span className="absolute top-0.5 bg-white rounded-full transition-transform" style={{ height: 14, width: 14, left: item.actif ? 15 : 2 }} />
          </button>
          <button onClick={() => setEdit(true)} className="text-gray-400 hover:text-blue-600" title="Renommer"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => onRemove(type, item.id)} className="text-gray-400 hover:text-rose-500" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
        </>
      )}
    </div>
  );
}
