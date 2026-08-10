"use client";

import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { useApi, useMutation } from "@/hooks/useApi";
import { Plus, Loader2, ToggleLeft, ToggleRight, Tag as TagIcon, Radio, Target, Save } from "lucide-react";

interface Ref { id: number; code: string; libelle: string; actif: boolean; ordre: number }

function Referentiel({ titre, sousTitre, apiBase, icon: Icon }: { titre: string; sousTitre: string; apiBase: string; icon: typeof TagIcon }) {
  const { data: res, loading, refetch } = useApi<{ data: Ref[] }>(apiBase);
  const [code, setCode] = useState("");
  const [libelle, setLibelle] = useState("");
  const { mutate: creer, loading: creating } = useMutation<Ref, { code: string; libelle: string }>(apiBase, "POST", { invalidate: apiBase });
  const toggleIdRef = useRef<number | null>(null);
  const { mutate: toggler } = useMutation<Ref, { actif: boolean }>(() => `${apiBase}/${toggleIdRef.current}`, "PATCH", { invalidate: apiBase });

  const ajouter = async () => {
    if (!code || !libelle) return;
    const r = await creer({ code, libelle });
    if (r) { setCode(""); setLibelle(""); refetch(); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-fuchsia-600" />
        <h3 className="font-semibold text-slate-800">{titre}</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">{sousTitre}</p>

      <div className="flex gap-2 mb-4">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (ex: RAMADAN)"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Libellé"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        <button onClick={ajouter} disabled={creating || !code || !libelle}
          className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 disabled:opacity-50">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Ajouter
        </button>
      </div>

      {loading && !res ? (
        <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="space-y-1.5">
          {(res?.data ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-700">{item.libelle}</p>
                <p className="text-xs text-slate-400">{item.code}</p>
              </div>
              <button
                onClick={async () => { toggleIdRef.current = item.id; if (await toggler({ actif: !item.actif })) refetch(); }}
                className={item.actif ? "text-emerald-500 hover:bg-emerald-50 rounded-lg p-1" : "text-slate-300 hover:bg-slate-100 rounded-lg p-1"}
                title={item.actif ? "Désactiver" : "Activer"}>
                {item.actif ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
            </div>
          ))}
          {(res?.data ?? []).length === 0 && <p className="text-center text-slate-400 text-sm py-4">Aucun élément</p>}
        </div>
      )}
    </div>
  );
}

interface ParamRFM {
  seuilPerduJours: number; seuilDormantJours: number; seuilRisqueJours: number; seuilRisqueFrequenceMin: number;
  percentileGrosAcheteur: number; seuilChampionFrequence: number; seuilChampionRecenceJours: number; seuilFideleFrequence: number;
}

function ParametrageRFMSection() {
  const [param, setParam] = useState<ParamRFM | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/marketing/parametrage-rfm").then((r) => r.json()).then((j) => setParam(j.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const enregistrer = async () => {
    if (!param) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/parametrage-rfm", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(param),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Seuils RFM enregistrés ✓");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const champ = (label: string, cle: keyof ParamRFM, suffixe = "jours") => (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <input type="number" value={param?.[cle] ?? 0} onChange={(e) => setParam((p) => p && { ...p, [cle]: Number(e.target.value) })}
        className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" />
      <span className="text-[10px] text-slate-400">{suffixe}</span>
    </label>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 text-fuchsia-600" /><h3 className="font-semibold text-slate-800">Seuils de segmentation RFM</h3></div>
      <p className="text-xs text-slate-400 mb-4">Récence/Fréquence/Montant — champions/fidèles/à risque/dormants/perdus.</p>
      {loading || !param ? (
        <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {champ("Client perdu après", "seuilPerduJours")}
            {champ("Client dormant après", "seuilDormantJours")}
            {champ("Client à risque après", "seuilRisqueJours")}
            {champ("Fréquence min. pour \"à risque\"", "seuilRisqueFrequenceMin", "achats")}
            {champ("Fréquence min. champion", "seuilChampionFrequence", "achats")}
            {champ("Récence max. champion", "seuilChampionRecenceJours")}
            {champ("Fréquence min. fidèle", "seuilFideleFrequence", "achats")}
            {champ("Percentile gros acheteur", "percentileGrosAcheteur", "0-1, ex 0.10 = top 10%")}
          </div>
          <button onClick={enregistrer} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}

export default function MarketingParametresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Paramètres Marketing</h2>
        <p className="text-slate-500 text-sm mt-0.5">Référentiels modifiables sans code — types de campagne, objectifs, canaux, segmentation RFM.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Referentiel titre="Types de campagne" sousTitre="Catégories proposées à la création d'une campagne" apiBase="/api/admin/marketing/types-campagne" icon={TagIcon} />
        <Referentiel titre="Objectifs de campagne" sousTitre="Acquisition, conversion, fidélisation…" apiBase="/api/admin/marketing/objectifs-campagne" icon={Target} />
        <Referentiel titre="Canaux marketing" sousTitre="Canaux disponibles pour une campagne (communication à venir en Phase 2)" apiBase="/api/admin/marketing/canaux" icon={Radio} />
        <ParametrageRFMSection />
      </div>
    </div>
  );
}
