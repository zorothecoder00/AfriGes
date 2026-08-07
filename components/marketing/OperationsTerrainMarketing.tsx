"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { MapPin, Plus, Loader2, X, ChevronDown, ChevronUp, Save } from "lucide-react";
import { TYPE_OPERATION_TERRAIN_LABEL } from "@/lib/operationTerrain";

/** Opérations marketing terrain (CDC §41). */

interface Operation {
  id: number; type: string; zone: string; dateDebut: string; dateFin: string;
  budget: number; statut: string; objectifsText: string | null;
  prospectsGeneres: number; clientsConvertis: number; ventesGenereesCA: number; resultatsNotes: string | null;
  campagne: { id: number; code: string; nom: string };
  pointDeVente: { id: number; nom: string } | null;
  equipe: { agent: { id: number; nom: string; prenom: string } }[];
}
interface Campagne { id: number; code: string; nom: string }
interface Agent { id: number; nom: string; prenom: string }

const STATUT_LABEL: Record<string, string> = { PLANIFIEE: "Planifiée", EN_COURS: "En cours", TERMINEE: "Terminée", ANNULEE: "Annulée" };
const STATUT_STYLE: Record<string, string> = {
  PLANIFIEE: "bg-blue-100 text-blue-700", EN_COURS: "bg-emerald-100 text-emerald-700",
  TERMINEE: "bg-slate-100 text-slate-500", ANNULEE: "bg-rose-100 text-rose-600",
};

function NouvelleOperationModal({ campagnes, agents, onClose, onCreated }: { campagnes: Campagne[]; agents: Agent[]; onClose: () => void; onCreated: () => void }) {
  const [campagneId, setCampagneId] = useState("");
  const [type, setType] = useState("STREET_MARKETING");
  const [zone, setZone] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [budget, setBudget] = useState("");
  const [objectifsText, setObjectifsText] = useState("");
  const [equipeIds, setEquipeIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleAgent = (id: number) => setEquipeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const submit = async () => {
    if (!campagneId || !zone.trim() || !dateDebut || !dateFin) { toast.error("Campagne, zone et période sont requis"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/operations-terrain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campagneId: Number(campagneId), type, zone: zone.trim(), dateDebut, dateFin, budget: Number(budget) || 0, objectifsText: objectifsText.trim() || null, equipeIds }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Opération créée ✓"); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><MapPin className="w-5 h-5 text-fuchsia-600" /> Nouvelle opération terrain</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Campagne *</span>
            <select value={campagneId} onChange={(e) => setCampagneId(e.target.value)} className={field}>
              <option value="">— choisir —</option>
              {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.code})</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Type *</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
                {Object.entries(TYPE_OPERATION_TERRAIN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block"><span className={lbl}>Zone *</span>
              <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Marché de Kara" className={field} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Début *</span>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={field} />
            </label>
            <label className="block"><span className={lbl}>Fin *</span>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={field} />
            </label>
          </div>
          <label className="block"><span className={lbl}>Budget (FCFA)</span>
            <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className={field} />
          </label>
          <label className="block"><span className={lbl}>Objectifs</span>
            <textarea value={objectifsText} onChange={(e) => setObjectifsText(e.target.value)} rows={2} className={field} />
          </label>
          <div>
            <span className={lbl}>Équipe</span>
            <div className="mt-1 max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
              {agents.map((a) => (
                <label key={a.id} className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-slate-50 rounded-lg">
                  <input type="checkbox" checked={equipeIds.includes(a.id)} onChange={() => toggleAgent(a.id)} className="w-4 h-4 rounded" />
                  {a.prenom} {a.nom}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultatsForm({ operation, onSaved }: { operation: Operation; onSaved: () => void }) {
  const [prospects, setProspects] = useState(String(operation.prospectsGeneres));
  const [clients, setClients] = useState(String(operation.clientsConvertis));
  const [ca, setCa] = useState(String(operation.ventesGenereesCA));
  const [notes, setNotes] = useState(operation.resultatsNotes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/marketing/operations-terrain/${operation.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectsGeneres: Number(prospects) || 0, clientsConvertis: Number(clients) || 0, ventesGenereesCA: Number(ca) || 0, resultatsNotes: notes.trim() || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Résultats enregistrés ✓"); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white w-full";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
      <label className="text-xs text-slate-500">Prospects
        <input type="number" min={0} value={prospects} onChange={(e) => setProspects(e.target.value)} className={field} />
      </label>
      <label className="text-xs text-slate-500">Clients convertis
        <input type="number" min={0} value={clients} onChange={(e) => setClients(e.target.value)} className={field} />
      </label>
      <label className="text-xs text-slate-500">CA généré
        <input type="number" min={0} value={ca} onChange={(e) => setCa(e.target.value)} className={field} />
      </label>
      <button onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Enregistrer
      </button>
      <label className="col-span-2 md:col-span-4 text-xs text-slate-500">Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={field} />
      </label>
    </div>
  );
}

export default function OperationsTerrainMarketing() {
  const [rows, setRows] = useState<Operation[]>([]);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/marketing/operations-terrain");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/marketing/campagnes").then((r) => r.json()).then((j) => setCampagnes(j.data ?? [])).catch(() => {});
    fetch("/api/admin/gestionnaires?role=AGENT_TERRAIN&actif=true&limit=200").then((r) => r.json()).then((j) => setAgents(j.data ?? [])).catch(() => {});
  }, []);

  const changerStatut = async (o: Operation, statut: string) => {
    const r = await fetch(`/api/admin/marketing/operations-terrain/${o.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut }),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Erreur"); return; }
    toast.success("Statut mis à jour"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><MapPin className="w-5 h-5 text-fuchsia-600" /> Opérations terrain</h2>
          <p className="text-sm text-slate-400">{rows.length} opération(s) — street marketing, flyers, animations…</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouvelle opération
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucune opération pour l&apos;instant</p>
        ) : rows.map((o) => (
          <div key={o.id}>
            <button onClick={() => setOuvert(ouvert === o.id ? null : o.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left">
              <div>
                <p className="font-medium text-slate-800">{TYPE_OPERATION_TERRAIN_LABEL[o.type as keyof typeof TYPE_OPERATION_TERRAIN_LABEL] ?? o.type} — {o.zone}</p>
                <p className="text-xs text-slate-400">{o.campagne.nom} · équipe {o.equipe.length} · {o.prospectsGeneres} prospect(s) · {o.clientsConvertis} client(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[o.statut]}`}>{STATUT_LABEL[o.statut]}</span>
                {ouvert === o.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>
            {ouvert === o.id && (
              <div className="px-4 pb-4 bg-slate-50/50 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {["PLANIFIEE", "EN_COURS", "TERMINEE", "ANNULEE"].filter((s) => s !== o.statut).map((s) => (
                    <button key={s} onClick={() => changerStatut(o, s)} className="px-3 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-100">
                      → {STATUT_LABEL[s]}
                    </button>
                  ))}
                </div>
                <ResultatsForm operation={o} onSaved={load} />
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && <NouvelleOperationModal campagnes={campagnes} agents={agents} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
