"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  AlertTriangle, Plus, Search, RefreshCw, CheckCircle2, Circle,
  XCircle, Shield, Clock, Zap,
} from "lucide-react";

interface Anomalie {
  id: number;
  titre: string;
  description: string | null;
  typeCommission: string;
  niveau: string;
  categorie: string;
  resolue: boolean;
  dateResolution: string | null;
  createdAt: string;
  signalee: boolean;
  signaledPar: { nom: string; prenom: string } | null;
  resolueParId: number | null;
}

interface AnomaliesStats {
  total: number; actives: number; critique: number; majeure: number; mineure: number;
}

interface Data { anomalies: Anomalie[]; stats: AnomaliesStats }

const NIVEAUX: Record<string, { label: string; color: string; bg: string }> = {
  MINEURE:  { label: "Mineure",  color: "text-amber-700",  bg: "bg-amber-100" },
  MAJEURE:  { label: "Majeure",  color: "text-orange-700", bg: "bg-orange-100" },
  CRITIQUE: { label: "Critique", color: "text-rose-700",   bg: "bg-rose-100" },
};

const BORDER_COLORS: Record<string, string> = {
  MINEURE:  "border-l-amber-400",
  MAJEURE:  "border-l-orange-500",
  CRITIQUE: "border-l-rose-600",
};

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    titre: "", description: "", typeCommission: "FINANCE",
    niveau: "MINEURE", categorie: "PROCESSUS",
  });
  const { mutate, loading } = useMutation("/api/admin/ria/commissions/gouvernance/anomalies", "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate(form) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success("Anomalie signalée"); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" /> Signaler une anomalie
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              placeholder="Nature de l'anomalie" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
              placeholder="Contexte, impact, éléments observés..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Commission</label>
              <select value={form.typeCommission} onChange={e => setForm(f => ({ ...f, typeCommission: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400">
                <option value="FINANCE">Finance</option>
                <option value="OPERATIONS_TERRAIN">Opérations</option>
                <option value="AUDIT">Audit</option>
                <option value="OPTIMISATION">Optimisation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Niveau</label>
              <select value={form.niveau} onChange={e => setForm(f => ({ ...f, niveau: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400">
                <option value="MINEURE">Mineure</option>
                <option value="MAJEURE">Majeure</option>
                <option value="CRITIQUE">Critique</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Catégorie</label>
              <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400">
                <option value="PROCESSUS">Processus</option>
                <option value="CONFORMITE">Conformité</option>
                <option value="FINANCIERE">Financière</option>
                <option value="OPERATIONNELLE">Opérationnelle</option>
                <option value="GOUVERNANCE">Gouvernance</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50">
              {loading ? "Signalement..." : "Signaler"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AnomaliesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterNiveau, setFilterNiveau] = useState("");
  const [filterComm, setFilterComm] = useState("");
  const [showResolues, setShowResolues] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const params = new URLSearchParams();
  if (filterNiveau) params.set("niveau", filterNiveau);
  if (filterComm) params.set("typeCommission", filterComm);
  if (!showResolues) params.set("resolue", "false");
  if (refresh > 0) params.set("_r", String(refresh));
  const { data, loading } = useApi<Data>(
    `/api/admin/ria/commissions/gouvernance/anomalies?${params.toString()}`
  );

  const items = (data?.anomalies || []).filter(a =>
    !search || a.titre.toLowerCase().includes(search.toLowerCase())
  );

  async function handleResoudre(id: number) {
    const commentaire = window.prompt("Commentaire de résolution (optionnel) :");
    if (commentaire === null) return;
    const res = await fetch(`/api/admin/ria/commissions/gouvernance/anomalies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resoudre: true, commentaire }),
    });
    const json = await res.json();
    if (json?.id) { toast.success("Anomalie résolue"); setRefresh(r => r + 1); }
    else toast.error(json?.error || "Erreur");
  }

  function done() { setShowCreate(false); setRefresh(r => r + 1); }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" /> Anomalies de gouvernance
          </h1>
          <p className="text-sm text-slate-500">Suivi des anomalies détectées et leur résolution</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700">
          <Plus className="w-4 h-4" /> Signaler une anomalie
        </button>
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{data.stats.total}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className={`rounded-xl p-4 text-center border ${data.stats.actives > 0 ? "border-rose-200 bg-rose-50" : "bg-white border-slate-200"}`}>
            <p className={`text-2xl font-bold ${data.stats.actives > 0 ? "text-rose-700" : "text-slate-800"}`}>{data.stats.actives}</p>
            <p className="text-xs text-slate-500">Actives</p>
          </div>
          <div className={`rounded-xl p-4 text-center border cursor-pointer transition-all ${filterNiveau === "CRITIQUE" ? "border-rose-400 bg-rose-50" : "bg-white border-slate-200 hover:border-rose-300"}`}
            onClick={() => setFilterNiveau(filterNiveau === "CRITIQUE" ? "" : "CRITIQUE")}>
            <p className={`text-2xl font-bold ${data.stats.critique > 0 ? "text-rose-700" : "text-slate-400"}`}>{data.stats.critique}</p>
            <p className="text-xs text-slate-500">Critiques</p>
          </div>
          <div className={`rounded-xl p-4 text-center border cursor-pointer transition-all ${filterNiveau === "MAJEURE" ? "border-orange-400 bg-orange-50" : "bg-white border-slate-200 hover:border-orange-300"}`}
            onClick={() => setFilterNiveau(filterNiveau === "MAJEURE" ? "" : "MAJEURE")}>
            <p className="text-2xl font-bold text-orange-600">{data.stats.majeure}</p>
            <p className="text-xs text-slate-500">Majeures</p>
          </div>
          <div className={`rounded-xl p-4 text-center border cursor-pointer transition-all ${filterNiveau === "MINEURE" ? "border-amber-400 bg-amber-50" : "bg-white border-slate-200 hover:border-amber-300"}`}
            onClick={() => setFilterNiveau(filterNiveau === "MINEURE" ? "" : "MINEURE")}>
            <p className="text-2xl font-bold text-amber-600">{data.stats.mineure}</p>
            <p className="text-xs text-slate-500">Mineures</p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une anomalie..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" />
        </div>
        <select value={filterComm} onChange={e => setFilterComm(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300">
          <option value="">Toutes commissions</option>
          <option value="FINANCE">Finance</option>
          <option value="OPERATIONS_TERRAIN">Opérations</option>
          <option value="AUDIT">Audit</option>
          <option value="OPTIMISATION">Optimisation</option>
        </select>
        <button onClick={() => setShowResolues(!showResolues)}
          className={`px-3 py-2 text-sm rounded-lg border transition-all ${showResolues ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          {showResolues ? "Masquer résolues" : "Voir aussi résolues"}
        </button>
        <button onClick={() => setRefresh(r => r + 1)}
          className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-rose-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm text-slate-400">Aucune anomalie active</p>
            </div>
          ) : items.map(a => (
            <div key={a.id} className={`bg-white rounded-xl border border-l-4 p-5 ${a.resolue ? "border-slate-200 border-l-emerald-400 opacity-70" : `border-slate-200 ${BORDER_COLORS[a.niveau] || "border-l-slate-300"}`}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    {a.resolue ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /> Résolue
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${NIVEAUX[a.niveau]?.bg || "bg-slate-100"} ${NIVEAUX[a.niveau]?.color || "text-slate-600"}`}>
                        <Zap className="w-3 h-3" /> {NIVEAUX[a.niveau]?.label || a.niveau}
                      </span>
                    )}
                    <span className="text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded">{a.categorie}</span>
                    <span className="text-xs text-slate-400">
                      {a.typeCommission === "OPERATIONS_TERRAIN" ? "Opérations" : a.typeCommission.charAt(0) + a.typeCommission.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{a.titre}</h3>
                  {a.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    {a.signaledPar && <span>Signalé par {a.signaledPar.prenom} {a.signaledPar.nom}</span>}
                    <span>{new Date(a.createdAt).toLocaleDateString("fr-FR")}</span>
                    {a.dateResolution && <span>Résolu le {new Date(a.dateResolution).toLocaleDateString("fr-FR")}</span>}
                  </div>
                </div>
                {!a.resolue && (
                  <button onClick={() => handleResoudre(a.id)}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-600 border border-emerald-200 hover:bg-emerald-50 rounded-lg transition-colors">
                    <Shield className="w-3.5 h-3.5" /> Résoudre
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={done} />}
    </div>
  );
}
