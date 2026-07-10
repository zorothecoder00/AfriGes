"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Eye, Save, RotateCcw, Users, Boxes, Lock } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  CHAMPS_CATALOGUE, GROUPES_CHAMPS, MODES_STOCK, estSensible, projeterProduit,
  type ProduitSource, type ModeStock,
} from "@/lib/vuesCatalogue";

interface VueItem {
  cle: string; nom: string; description: string | null;
  champsVisibles: string[]; modeStock: ModeStock; personnalise: boolean;
}

const CHAMP_LABEL: Record<string, string> = Object.fromEntries(CHAMPS_CATALOGUE.map((c) => [c.key, c.label]));
const PRIX_KEYS = new Set(["prixDetail", "prixCredit", "prixCommunaute", "prixGros", "prixAchat", "marge"]);

export default function VuesCataloguePage() {
  const [vues, setVues] = useState<VueItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [champs, setChamps] = useState<Set<string>>(new Set());
  const [modeStock, setModeStock] = useState<ModeStock>("EXACT");
  const [sources, setSources] = useState<ProduitSource[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingVue, setLoadingVue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const r = await fetch("/api/admin/catalogue/vues");
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setVues(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const selectRole = useCallback(async (cle: string) => {
    setSelected(cle); setLoadingVue(true); setDirty(false);
    try {
      const [rV, rA] = await Promise.all([
        fetch(`/api/admin/catalogue/vues/${cle}`),
        fetch(`/api/admin/catalogue/vues/${cle}/apercu`),
      ]);
      const jV = await rV.json();
      if (!rV.ok) throw new Error(jV.message ?? "Erreur");
      setChamps(new Set(jV.data.champsVisibles));
      setModeStock(jV.data.modeStock);
      const jA = await rA.json();
      setSources(jA.data?.sources ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoadingVue(false); }
  }, []);

  // Sélectionne automatiquement le premier rôle une fois la liste chargée.
  useEffect(() => {
    if (!selected && vues.length) selectRole(vues[0].cle);
  }, [vues, selected, selectRole]);

  const toggle = (key: string) => {
    setChamps((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
    setDirty(true);
  };

  const enregistrer = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/catalogue/vues/${selected}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ champsVisibles: [...champs], modeStock }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success("Vue enregistrée"); setDirty(false); loadList();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const reinitialiser = async () => {
    if (!selected || !confirm("Réinitialiser cette vue aux valeurs par défaut ?")) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/catalogue/vues/${selected}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setChamps(new Set(j.data.champsVisibles)); setModeStock(j.data.modeStock);
      toast.success("Vue réinitialisée"); setDirty(false); loadList();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const selectedVue = vues.find((v) => v.cle === selected);

  // Aperçu live : projection client via le même moteur que les surfaces (synchro).
  const projections = useMemo(
    () => sources.map((s) => projeterProduit([...champs], modeStock, s)),
    [sources, champs, modeStock],
  );

  const renderValeur = (key: string, val: unknown) => {
    if (val == null || val === "") return <span className="text-gray-300">—</span>;
    if (key === "photo") return typeof val === "string"
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={val} alt="" className="w-10 h-10 rounded object-cover" /> : null;
    if (PRIX_KEYS.has(key) && typeof val === "number") return formatCurrency(val);
    if (key === "promo") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600">{String(val)}</span>;
    return String(val);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <Link href="/dashboard/admin/catalogue/produits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour au catalogue
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users className="w-6 h-6 text-blue-600" /> Vues personnalisées</h2>
          <p className="text-sm text-gray-400">Configurez, par rôle, quels champs du catalogue sont visibles et comment le stock est affiché. (Distinct des permissions d&apos;action.)</p>
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
            {/* Liste des rôles */}
            <div className="space-y-1.5">
              {vues.map((v) => (
                <button key={v.cle} onClick={() => selectRole(v.cle)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm ${selected === v.cle ? "border-blue-300 bg-blue-50 text-blue-800" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>
                  <span className="font-medium">{v.nom}</span>
                  {v.personnalise && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">perso</span>}
                  <span className="block text-[11px] text-gray-400">{v.champsVisibles.length} champ(s) · {MODES_STOCK.find((m) => m.cle === v.modeStock)?.label}</span>
                </button>
              ))}
            </div>

            {/* Éditeur + aperçu */}
            <div className="space-y-5">
              {loadingVue ? (
                <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
              ) : selectedVue ? (
                <>
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                      <div>
                        <h3 className="font-bold text-gray-800">{selectedVue.nom}</h3>
                        <p className="text-xs text-gray-400">{selectedVue.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={reinitialiser} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"><RotateCcw className="w-4 h-4" /> Réinitialiser</button>
                        <button onClick={enregistrer} disabled={saving || !dirty} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                        </button>
                      </div>
                    </div>

                    {/* Mode stock */}
                    <div className="mb-4">
                      <span className="text-xs font-semibold text-slate-500">Affichage du stock</span>
                      <div className="flex gap-2 mt-1">
                        {MODES_STOCK.map((m) => (
                          <button key={m.cle} onClick={() => { setModeStock(m.cle); setDirty(true); }}
                            className={`px-3 py-1.5 rounded-lg text-sm border ${modeStock === m.cle ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{m.label}</button>
                        ))}
                      </div>
                    </div>

                    {/* Champs par groupe */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {GROUPES_CHAMPS.map((g) => {
                        const items = CHAMPS_CATALOGUE.filter((c) => c.groupe === g);
                        if (items.length === 0) return null;
                        return (
                          <div key={g}>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{g}</p>
                            <div className="space-y-1">
                              {items.map((c) => (
                                <label key={c.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                  <input type="checkbox" checked={champs.has(c.key)} onChange={() => toggle(c.key)} className="w-4 h-4 rounded" />
                                  {c.label}
                                  {estSensible(c.key) && <Lock className="w-3 h-3 text-amber-500" aria-label="confidentiel" />}
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Aperçu live */}
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-blue-500" />
                      <h3 className="font-semibold text-gray-800">Aperçu — ce que voit « {selectedVue.nom} »</h3>
                    </div>
                    {projections.length === 0 ? (
                      <div className="py-12 text-center text-sm text-gray-400">Aucun produit actif pour l&apos;aperçu.</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                        {projections.map((p, i) => (
                          <div key={i} className="border border-gray-100 rounded-xl p-3 bg-slate-50/40">
                            {CHAMPS_CATALOGUE.filter((c) => c.key in p).map((c) => (
                              <div key={c.key} className="flex items-start justify-between gap-2 py-0.5 text-xs">
                                <span className="text-gray-400 shrink-0">{CHAMP_LABEL[c.key]}</span>
                                <span className="text-gray-800 text-right break-words">{renderValeur(c.key, p[c.key])}</span>
                              </div>
                            ))}
                            {Object.keys(p).length <= 1 && <p className="text-xs text-gray-300 italic flex items-center gap-1"><Boxes className="w-3.5 h-3.5" /> Aucun champ visible</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
