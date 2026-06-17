"use client";

import { useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { commissionLabel } from "@/lib/commissionsRIA";
import { toast } from "sonner";
import { MessageSquare, Plus, Pin } from "lucide-react";

interface Observation {
  id: number;
  typeCommission: string;
  type: string;
  contenu: string;
  epingle: boolean;
  createdAt: string;
  auteur: { id: number; nom: string; prenom: string };
}
interface ObsData { observations: Observation[] }

interface MaCommission { typeCommission: string; role: string }
interface MaData { commissions: MaCommission[] }

const TYPES = ["COMMENTAIRE", "PLANIFICATION", "DOCUMENT", "DISCUSSION", "ALERTE"];

const TYPE_COLORS: Record<string, string> = {
  ALERTE:        "bg-rose-100 text-rose-700",
  PLANIFICATION: "bg-blue-100 text-blue-700",
  DOCUMENT:      "bg-violet-100 text-violet-700",
  DISCUSSION:    "bg-amber-100 text-amber-700",
  COMMENTAIRE:   "bg-slate-100 text-slate-600",
};

function AddModal({ commissions, onClose, onDone }: {
  commissions: MaCommission[]; onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState({
    typeCommission: commissions[0]?.typeCommission ?? "",
    type: "COMMENTAIRE", contenu: "", epingle: false,
  });
  const { mutate, loading } = useMutation("/api/membreCommission/observations", "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate(form) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success("Observation publiée"); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Nouvelle observation
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Commission *</label>
              <select value={form.typeCommission} onChange={e => setForm(f => ({ ...f, typeCommission: e.target.value }))}
                required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                {commissions.map(c => <option key={c.typeCommission} value={c.typeCommission}>{commissionLabel(c.typeCommission)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contenu *</label>
            <textarea value={form.contenu} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))}
              required rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
              placeholder="Commentaire, alerte, planification..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.epingle} onChange={e => setForm(f => ({ ...f, epingle: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <span className="text-xs text-slate-600">Épingler</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading || !form.typeCommission}
              className="px-5 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50">
              {loading ? "Publication..." : "Publier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CollaborationPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const { data: ma } = useApi<MaData>("/api/membreCommission/ma-commission");
  const { data, loading } = useApi<ObsData>(`/api/membreCommission/observations?_r=${refresh}`);

  const observations = data?.observations ?? [];
  const commissions = ma?.commissions ?? [];

  function done() { setShowAdd(false); setRefresh(r => r + 1); }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-slate-600" /> Collaboration
          </h1>
          <p className="text-sm text-slate-500">Observations, planifications et alertes de mes commissions</p>
        </div>
        {commissions.length > 0 && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800">
            <Plus className="w-4 h-4" /> Nouvelle
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-slate-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : observations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucune observation</p>
        </div>
      ) : (
        <div className="space-y-2">
          {observations.map(o => (
            <div key={o.id} className={`p-4 rounded-xl border ${o.epingle ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"}`}>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {o.epingle && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[o.type] || "bg-slate-100 text-slate-600"}`}>{o.type}</span>
                <span className="text-xs text-slate-400">{commissionLabel(o.typeCommission)}</span>
                <span className="text-xs text-slate-400">· {o.auteur.prenom} {o.auteur.nom}</span>
                <span className="text-xs text-slate-300 ml-auto">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-line">{o.contenu}</p>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddModal commissions={commissions} onClose={() => setShowAdd(false)} onDone={done} />}
    </div>
  );
}
