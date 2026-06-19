"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Gavel, Plus, Search, RefreshCw, CheckCircle2,
  Clock, Circle, XCircle, PlayCircle, ArrowRight,
} from "lucide-react";

interface Resolution {
  id: number;
  numero: string;
  titre: string;
  description: string | null;
  typeCommission: string;
  statut: string;
  dateEcheance: string | null;
  reunion: { id: number; titre: string } | null;
  responsable: { nom: string; prenom: string } | null;
  plansAction: { id: number }[];
}

interface Data { resolutions: Resolution[] }

// CDC : En préparation → Soumise → Adoptée | Rejetée → Exécutée
const STATUTS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  EN_PREPARATION: { label: "En préparation", color: "bg-slate-100 text-slate-600",     icon: <Circle className="w-3.5 h-3.5" /> },
  SOUMISE:        { label: "Soumise au vote", color: "bg-blue-100 text-blue-700",      icon: <Clock className="w-3.5 h-3.5" /> },
  ADOPTEE:        { label: "Adoptée",        color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  REJETEE:        { label: "Rejetée",        color: "bg-rose-100 text-rose-700",       icon: <XCircle className="w-3.5 h-3.5" /> },
  EXECUTEE:       { label: "Exécutée",       color: "bg-teal-100 text-teal-700",       icon: <PlayCircle className="w-3.5 h-3.5" /> },
};

const COMMISSIONS = [
  { value: "", label: "Toutes" },
  { value: "FINANCE", label: "Finance" },
  { value: "OPERATIONS_TERRAIN", label: "Opérations" },
  { value: "AUDIT", label: "Audit & Contrôle" },
  { value: "OPTIMISATION", label: "Optimisation" },
];

function StatusBadge({ statut }: { statut: string }) {
  const s = STATUTS[statut] || { label: statut, color: "bg-slate-100 text-slate-600", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ titre: "", description: "", typeCommission: "FINANCE", dateEcheance: "" });
  const { mutate, loading } = useMutation("/api/admin/ria/commissions/gouvernance/resolutions", "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate(form);
    if ((res as { id?: number })?.id) { toast.success("Résolution créée"); onDone(); }
    else toast.error((res as { error?: string })?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Gavel className="w-4 h-4 text-emerald-500" /> Nouvelle résolution
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Intitulé de la résolution" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              placeholder="Contexte et détails de la résolution..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Commission *</label>
              <select value={form.typeCommission} onChange={e => setForm(f => ({ ...f, typeCommission: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="FINANCE">Finance</option>
                <option value="OPERATIONS_TERRAIN">Opérations Terrain</option>
                <option value="AUDIT">Audit & Contrôle</option>
                <option value="OPTIMISATION">Optimisation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date d&apos;échéance</label>
              <input type="date" value={form.dateEcheance} onChange={e => setForm(f => ({ ...f, dateEcheance: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {loading ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResolutionsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [filterComm, setFilterComm] = useState("");
  const [refresh, setRefresh] = useState(0);

  const params = new URLSearchParams();
  if (filterStatut) params.set("statut", filterStatut);
  if (filterComm) params.set("typeCommission", filterComm);
  if (refresh > 0) params.set("_r", String(refresh));
  const { data, loading } = useApi<Data>(
    `/api/admin/ria/commissions/gouvernance/resolutions?${params.toString()}`
  );

  const items = (data?.resolutions || []).filter(r =>
    !search || r.titre.toLowerCase().includes(search.toLowerCase()) || r.numero.includes(search)
  );

  const byStatut = Object.keys(STATUTS).reduce<Record<string, number>>((acc, k) => {
    acc[k] = (data?.resolutions || []).filter(r => r.statut === k).length;
    return acc;
  }, {});

  function done() { setShowCreate(false); setRefresh(r => r + 1); }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-emerald-600" /> Résolutions
          </h1>
          <p className="text-sm text-slate-500">Suivi du workflow décisionnel des commissions</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nouvelle résolution
        </button>
      </div>

      {/* Compteurs par statut */}
      {!loading && data && (
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(STATUTS).map(([k, s]) => (
            <button key={k} onClick={() => setFilterStatut(filterStatut === k ? "" : k)}
              className={`p-3 rounded-xl border text-center transition-all ${filterStatut === k ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <p className="text-xl font-bold text-slate-800">{byStatut[k] || 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par titre ou numéro..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        </div>
        <select value={filterComm} onChange={e => setFilterComm(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
          {COMMISSIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button onClick={() => setRefresh(r => r + 1)}
          className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">N°</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Résolution</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Commission</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Échéance</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Plans</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">
                  <Gavel className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Aucune résolution trouvée</p>
                </td></tr>
              ) : items.map(r => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-slate-500">{r.numero}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm font-medium text-slate-800 line-clamp-2">{r.titre}</p>
                    {r.reunion && <p className="text-xs text-slate-400 mt-0.5">Réunion: {r.reunion.titre}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-600">
                      {r.typeCommission === "OPERATIONS_TERRAIN" ? "Opérations" : r.typeCommission.charAt(0) + r.typeCommission.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.dateEcheance
                      ? <span className={`text-xs ${new Date(r.dateEcheance) < new Date() ? "text-rose-600 font-medium" : "text-slate-600"}`}>
                          {new Date(r.dateEcheance).toLocaleDateString("fr-FR")}
                        </span>
                      : <span className="text-xs text-slate-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700">{r.plansAction.length}</td>
                  <td className="px-4 py-3"><StatusBadge statut={r.statut} /></td>
                  <td className="px-4 py-3">
                    <a href={`/dashboard/admin/ria/gouvernance/resolutions/${r.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded-lg">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={done} />}
    </div>
  );
}
