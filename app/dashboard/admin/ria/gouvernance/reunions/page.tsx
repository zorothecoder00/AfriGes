"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Calendar, Plus, Search, Filter, ChevronDown, Users, FileText,
  CheckCircle2, XCircle, Clock, PlayCircle, Eye, Pen, Send,
  MapPin, RefreshCw,
} from "lucide-react";

interface Reunion {
  id: number;
  titre: string;
  typeCommission: string;
  dateHeure: string;
  lieu: string | null;
  statut: string;
  convocationEnvoyee: boolean;
  organisateur: { nom: string; prenom: string };
  compteRenduStr: { id: number; dateValidation: string | null } | null;
  presences: { id: number; present: boolean; procuration: boolean }[];
  resolutions: { id: number; statut: string }[];
}

interface ReunionsData { reunions: Reunion[] }

const STATUTS: Record<string, { label: string; color: string }> = {
  PLANIFIEE:  { label: "Planifiée",   color: "bg-blue-100 text-blue-700" },
  EN_COURS:   { label: "En cours",    color: "bg-emerald-100 text-emerald-700" },
  TENUE:      { label: "Tenue",       color: "bg-slate-100 text-slate-600" },
  ANNULEE:    { label: "Annulée",     color: "bg-rose-100 text-rose-700" },
  REPORTEE:   { label: "Reportée",    color: "bg-amber-100 text-amber-700" },
};

const COMMISSIONS = [
  { value: "", label: "Toutes commissions" },
  { value: "FINANCE", label: "Finance" },
  { value: "OPERATIONS_TERRAIN", label: "Opérations Terrain" },
  { value: "AUDIT", label: "Audit & Contrôle" },
  { value: "OPTIMISATION", label: "Optimisation" },
];

function StatutBadge({ statut }: { statut: string }) {
  const s = STATUTS[statut] || { label: statut, color: "bg-slate-100 text-slate-600" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    titre: "", typeCommission: "FINANCE", dateHeure: "", lieu: "", ordreJour: "", type: "ORDINAIRE",
  });
  const { mutate, loading } = useMutation("/api/admin/ria/commissions/gouvernance/reunions", "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate(form) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success("Réunion créée"); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" /> Planifier une réunion
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ex. Réunion mensuelle Commission Finance" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Commission *</label>
              <select value={form.typeCommission} onChange={e => setForm(f => ({ ...f, typeCommission: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="FINANCE">Finance</option>
                <option value="OPERATIONS_TERRAIN">Opérations Terrain</option>
                <option value="AUDIT">Audit & Contrôle</option>
                <option value="OPTIMISATION">Optimisation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="ORDINAIRE">Ordinaire</option>
                <option value="EXTRAORDINAIRE">Extraordinaire</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date & heure *</label>
              <input type="datetime-local" value={form.dateHeure} onChange={e => setForm(f => ({ ...f, dateHeure: e.target.value }))}
                required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Lieu</label>
              <input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Salle de réunion" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ordre du jour</label>
            <textarea value={form.ordreJour} onChange={e => setForm(f => ({ ...f, ordreJour: e.target.value }))}
              rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              placeholder="Points à traiter..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Création..." : "Créer la réunion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReunionsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [filterComm, setFilterComm] = useState("");
  const [refresh, setRefresh] = useState(0);

  const params = new URLSearchParams();
  if (filterStatut) params.set("statut", filterStatut);
  if (filterComm) params.set("typeCommission", filterComm);
  if (refresh > 0) params.set("_r", String(refresh));
  const { data, loading } = useApi<ReunionsData>(
    `/api/admin/ria/commissions/gouvernance/reunions?${params.toString()}`
  );

  const reunions = (data?.reunions || []).filter(r =>
    !search || r.titre.toLowerCase().includes(search.toLowerCase())
  );

  function done() { setShowCreate(false); setRefresh(r => r + 1); }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" /> Réunions de Gouvernance
          </h1>
          <p className="text-sm text-slate-500">Planification, convocations, comptes rendus et signatures</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Planifier une réunion
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une réunion..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <select value={filterComm} onChange={e => setFilterComm(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          {COMMISSIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
        <button onClick={() => setRefresh(r => r + 1)}
          className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Réunion</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Commission</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Date & Lieu</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Présences</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Résolutions</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">CR</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Statut</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reunions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Aucune réunion trouvée</p>
                  </td>
                </tr>
              ) : reunions.map(r => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800 line-clamp-1">{r.titre}</p>
                    <p className="text-xs text-slate-400">{r.organisateur.prenom} {r.organisateur.nom}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-600">
                      {r.typeCommission === "OPERATIONS_TERRAIN" ? "Opérations" : r.typeCommission.charAt(0) + r.typeCommission.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-700">
                      {new Date(r.dateHeure).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(r.dateHeure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      {r.lieu && <><MapPin className="w-3 h-3 ml-1" />{r.lieu}</>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center gap-1 text-sm text-slate-700">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {r.presences.length}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center gap-1 text-sm text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                      {r.resolutions.length}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.compteRenduStr ? (
                      r.compteRenduStr.dateValidation
                        ? <span title="CR validé"><CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /></span>
                        : <span title="CR en cours"><Pen className="w-4 h-4 text-amber-500 mx-auto" /></span>
                    ) : (
                      <span title="Pas de CR"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatutBadge statut={r.statut} /></td>
                  <td className="px-4 py-3 text-center">
                    <a href={`/dashboard/admin/ria/gouvernance/reunions/${r.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Détail
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
