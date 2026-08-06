"use client";

import { useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { Plus, Loader2, ToggleLeft, ToggleRight, Tag as TagIcon, Radio } from "lucide-react";

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

export default function MarketingParametresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Paramètres Marketing</h2>
        <p className="text-slate-500 text-sm mt-0.5">Référentiels modifiables sans code (CDC §81) — types de campagne et canaux.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Referentiel titre="Types de campagne" sousTitre="Catégories proposées à la création d'une campagne" apiBase="/api/admin/marketing/types-campagne" icon={TagIcon} />
        <Referentiel titre="Canaux marketing" sousTitre="Canaux disponibles pour une campagne (communication à venir en Phase 2)" apiBase="/api/admin/marketing/canaux" icon={Radio} />
      </div>
    </div>
  );
}
