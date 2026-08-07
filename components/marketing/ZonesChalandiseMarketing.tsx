"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { MapPinned, Plus, Loader2, Trash2 } from "lucide-react";

/** Zones de chalandise par agence (CDC §50). */

interface Zone { id: number; type: string; nom: string; notes: string | null; pointDeVente: { id: number; nom: string; code: string } }
interface Pdv { id: number; nom: string; code: string }

const TYPE_LABEL: Record<string, string> = {
  VILLE: "Ville", COMMUNE: "Commune", QUARTIER: "Quartier", MARCHE: "Marché",
  ENTREPRISE: "Entreprise", ECOLE: "École", INSTITUTION: "Institution",
};

export default function ZonesChalandiseMarketing() {
  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  const [pdvId, setPdvId] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("VILLE");
  const [nom, setNom] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch("/api/admin/pdv?actif=true&limit=200").then((r) => r.json()).then((j) => setPdvs(j.data ?? [])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    if (!pdvId) { setZones([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/marketing/zones-chalandise?pointDeVenteId=${pdvId}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setZones(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }, [pdvId]);

  useEffect(() => { load(); }, [load]);

  const ajouter = async () => {
    if (!pdvId || !nom.trim()) { toast.error("Agence et nom requis"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/zones-chalandise", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointDeVenteId: Number(pdvId), type, nom: nom.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setNom(""); toast.success("Zone ajoutée"); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const retirer = async (z: Zone) => {
    const r = await fetch(`/api/admin/marketing/zones-chalandise/${z.id}`, { method: "DELETE" });
    if (!r.ok) { toast.error("Erreur"); return; }
    toast.success("Zone retirée"); load();
  };

  const field = "px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><MapPinned className="w-5 h-5 text-fuchsia-600" /> Zones de chalandise</h2>
      <p className="text-sm text-slate-400">Villes, communes, quartiers, marchés, entreprises, écoles, institutions ciblés par chaque agence.</p>

      <select value={pdvId} onChange={(e) => setPdvId(e.target.value)} className={`${field} w-full max-w-xs`}>
        <option value="">— choisir une agence —</option>
        {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
      </select>

      {pdvId && (
        <>
          <div className="flex gap-2 flex-wrap">
            <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom (ex: Marché central)" className={`${field} flex-1 min-w-[180px]`} />
            <button onClick={ajouter} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Ajouter
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : zones.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-sm">Aucune zone pour cette agence</p>
            ) : zones.map((z) => (
              <div key={z.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700 font-medium mr-2">{TYPE_LABEL[z.type]}</span>
                  <span className="text-sm text-slate-700">{z.nom}</span>
                </div>
                <button onClick={() => retirer(z)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
