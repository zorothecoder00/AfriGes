"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  ListChecks, Plus, Search, RefreshCw, AlertTriangle,
  CheckCircle2, Circle, Clock, Flag, User, Calendar,
  ChevronRight, BarChart2,
} from "lucide-react";

interface PlanAction {
  id: number;
  titre: string;
  description: string | null;
  typeCommission: string;
  statut: string;
  priorite: string;
  progression: number;
  dateDebut: string | null;
  dateEcheance: string | null;
  enRetard?: boolean;
  responsable: { nom: string; prenom: string } | null;
  resolution: { id: number; numero: string; titre: string } | null;
}

interface Data { plans: PlanAction[] }

const STATUTS: Record<string, { label: string; color: string }> = {
  A_FAIRE:   { label: "Non démarré", color: "bg-slate-100 text-slate-600" },
  EN_COURS:  { label: "En cours",    color: "bg-blue-100 text-blue-700" },
  EN_RETARD: { label: "En retard",   color: "bg-rose-100 text-rose-700" },
  TERMINE:   { label: "Réalisé",     color: "bg-emerald-100 text-emerald-700" },
  ABANDONNE: { label: "Abandonné",   color: "bg-rose-50 text-rose-400" },
};

const PRIOS = ["BASSE", "MOYENNE", "HAUTE", "CRITIQUE"];
const PRIO_COLORS: Record<string, string> = {
  BASSE:   "bg-slate-100 text-slate-500",
  MOYENNE: "bg-blue-50 text-blue-600",
  HAUTE:   "bg-amber-50 text-amber-700",
  CRITIQUE:"bg-rose-50 text-rose-700",
};

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Progression</span><span>{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    titre: "", description: "", typeCommission: "FINANCE",
    priorite: "MOYENNE", dateDebut: "", dateEcheance: "", responsableId: "",
  });
  const { mutate, loading } = useMutation("/api/admin/ria/commissions/gouvernance/plans-actions", "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, responsableId: form.responsableId ? parseInt(form.responsableId) : undefined };
    const res = await mutate(body);
    if ((res as { id?: number })?.id) { toast.success("Plan d'action créé"); onDone(); }
    else toast.error((res as { error?: string })?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-teal-500" /> Nouveau plan d&apos;action
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Intitulé du plan d'action" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              placeholder="Détails et objectifs..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Commission *</label>
              <select value={form.typeCommission} onChange={e => setForm(f => ({ ...f, typeCommission: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="FINANCE">Finance</option>
                <option value="OPERATIONS_TERRAIN">Opérations Terrain</option>
                <option value="AUDIT_CONTROLE">Audit & Contrôle</option>
                <option value="OPTIMISATION">Optimisation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priorité</label>
              <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date de début</label>
              <input type="date" value={form.dateDebut} onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Échéance</label>
              <input type="date" value={form.dateEcheance} onChange={e => setForm(f => ({ ...f, dateEcheance: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {loading ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PlansActionsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [filterComm, setFilterComm] = useState("");
  const [showRetard, setShowRetard] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const now = new Date();
  const params = new URLSearchParams();
  if (filterStatut) params.set("statut", filterStatut);
  if (filterComm) params.set("typeCommission", filterComm);
  if (refresh > 0) params.set("_r", String(refresh));
  const { data, loading } = useApi<Data>(
    `/api/admin/ria/commissions/gouvernance/plans-actions?${params.toString()}`
  );

  const allPlans = (data?.plans || []).map(p => ({
    ...p,
    enRetard: !!p.dateEcheance && new Date(p.dateEcheance) < now
      && !["TERMINE", "ABANDONNE"].includes(p.statut),
  }));
  const items = allPlans.filter(p =>
    (!search || p.titre.toLowerCase().includes(search.toLowerCase())) &&
    (!showRetard || p.enRetard)
  );
  const nbRetard = allPlans.filter(p => p.enRetard).length;

  function done() { setShowCreate(false); setRefresh(r => r + 1); }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-teal-600" /> Plans d&apos;action
          </h1>
          <p className="text-sm text-slate-500">Suivi des plans d&apos;exécution des résolutions</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700">
          <Plus className="w-4 h-4" /> Nouveau plan
        </button>
      </div>

      {/* Stats rapides */}
      {!loading && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{allPlans.length}</p>
            <p className="text-xs text-slate-500">Total plans</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{allPlans.filter(p => p.statut === "EN_COURS").length}</p>
            <p className="text-xs text-slate-500">En cours</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{allPlans.filter(p => p.statut === "TERMINE").length}</p>
            <p className="text-xs text-slate-500">Terminés</p>
          </div>
          <button onClick={() => setShowRetard(!showRetard)}
            className={`border rounded-xl p-4 text-center transition-all ${showRetard ? "border-rose-400 bg-rose-50" : "bg-white border-slate-200 hover:border-rose-300"}`}>
            <p className={`text-2xl font-bold ${nbRetard > 0 ? "text-rose-600" : "text-slate-400"}`}>{nbRetard}</p>
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" /> En retard
            </p>
          </button>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un plan..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
        </div>
        <select value={filterComm} onChange={e => setFilterComm(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
          <option value="">Toutes commissions</option>
          <option value="FINANCE">Finance</option>
          <option value="OPERATIONS_TERRAIN">Opérations</option>
          <option value="AUDIT_CONTROLE">Audit & Contrôle</option>
          <option value="OPTIMISATION">Optimisation</option>
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
          <option value="">Tous statuts</option>
          {Object.entries(STATUTS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
        <button onClick={() => setRefresh(r => r + 1)}
          className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
              <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun plan d&apos;action trouvé</p>
            </div>
          ) : items.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border p-5 ${p.enRetard ? "border-rose-200 bg-rose-50/30" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUTS[p.statut]?.color || "bg-slate-100 text-slate-600"}`}>
                      {STATUTS[p.statut]?.label || p.statut}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PRIO_COLORS[p.priorite] || "bg-slate-100 text-slate-500"}`}>
                      <Flag className="w-3 h-3" /> {p.priorite}
                    </span>
                    {p.enRetard && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                        <AlertTriangle className="w-3 h-3" /> En retard
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {p.typeCommission === "OPERATIONS_TERRAIN" ? "Opérations" : p.typeCommission.charAt(0) + p.typeCommission.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{p.titre}</h3>
                  {p.resolution && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Résolution: {p.resolution.numero} — {p.resolution.titre}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {p.responsable && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-medium text-[10px]">
                        {p.responsable.prenom[0]}{p.responsable.nom[0]}
                      </div>
                      {p.responsable.prenom} {p.responsable.nom}
                    </div>
                  )}
                  {p.dateEcheance && (
                    <div className={`flex items-center gap-1 text-xs ${p.enRetard ? "text-rose-600 font-medium" : "text-slate-400"}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(p.dateEcheance).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar value={p.progression} />
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={done} />}
    </div>
  );
}
