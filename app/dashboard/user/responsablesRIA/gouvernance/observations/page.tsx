"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  MessageSquare, Plus, RefreshCw, Pin, AlertTriangle,
  FileText, Calendar, BookOpen, MessageCircle, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface Observation {
  id: number;
  typeCommission: string;
  type: string;
  contenu: string;
  epingle: boolean;
  pieceJointeUrl: string | null;
  createdAt: string;
  auteur: { id: number; nom: string; prenom: string; photo?: string | null };
}

interface Data { observations: Observation[] }

const TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  COMMENTAIRE: { label: "Commentaire", color: "bg-slate-100 text-slate-600",   icon: <MessageCircle className="w-3.5 h-3.5" /> },
  PLANIFICATION:{ label: "Planification", color: "bg-blue-100 text-blue-700",  icon: <Calendar className="w-3.5 h-3.5" /> },
  DOCUMENT:    { label: "Document",    color: "bg-violet-100 text-violet-700", icon: <FileText className="w-3.5 h-3.5" /> },
  DISCUSSION:  { label: "Discussion",  color: "bg-teal-100 text-teal-700",     icon: <BookOpen className="w-3.5 h-3.5" /> },
  ALERTE:      { label: "Alerte",      color: "bg-rose-100 text-rose-700",     icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

const COMM_LABELS: Record<string, string> = {
  FINANCE:           "Finance",
  OPERATIONS_TERRAIN:"Opérations",
  AUDIT:             "Audit",
  OPTIMISATION:      "Optimisation",
};

function AddForm({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ typeCommission: "FINANCE", type: "COMMENTAIRE", contenu: "", epingle: false });
  const { mutate, loading } = useMutation("/api/admin/ria/commissions/gouvernance/observations", "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate(form) as { id?: number; error?: string } | null;
    if (res?.id) {
      toast.success("Observation ajoutée");
      setForm({ typeCommission: "FINANCE", type: "COMMENTAIRE", contenu: "", epingle: false });
      setOpen(false);
      onDone();
    } else toast.error(res?.error || "Erreur");
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
        <Plus className="w-4 h-4" /> Ajouter une observation
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-emerald-200 p-5 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Commission *</label>
          <select value={form.typeCommission} onChange={e => setForm(f => ({ ...f, typeCommission: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
            <option value="FINANCE">Finance</option>
            <option value="OPERATIONS_TERRAIN">Opérations Terrain</option>
            <option value="AUDIT">Audit</option>
            <option value="OPTIMISATION">Optimisation</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
            {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Contenu *</label>
        <textarea value={form.contenu} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))}
          required rows={3}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
          placeholder="Votre observation, commentaire ou alerte..." />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={form.epingle} onChange={e => setForm(f => ({ ...f, epingle: e.target.checked }))}
            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-300" />
          <Pin className="w-3.5 h-3.5 text-slate-400" /> Épingler
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button type="submit" disabled={loading || !form.contenu.trim()}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? "Envoi..." : "Publier"}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function ObservationsPage() {
  const [filterComm, setFilterComm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [epingle, setEpingle] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const params = new URLSearchParams();
  if (filterComm) params.set("typeCommission", filterComm);
  if (filterType) params.set("type", filterType);
  if (epingle)    params.set("epingle", "true");
  if (refresh > 0) params.set("_r", String(refresh));
  const { data, loading } = useApi<Data>(
    `/api/admin/ria/commissions/gouvernance/observations?${params.toString()}`
  );

  const observations = data?.observations || [];
  const nbEpingles = (data?.observations || []).filter(o => o.epingle).length;

  function done() { setRefresh(r => r + 1); }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/user/responsablesRIA/gouvernance"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Gouvernance
          </Link>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-teal-600" /> Espace Collaboration
          </h1>
          <p className="text-sm text-slate-500">Observations, discussions et alertes des commissions</p>
        </div>
      </div>

      {/* Formulaire d'ajout */}
      <AddForm onDone={done} />

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterComm} onChange={e => setFilterComm(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Toutes commissions</option>
          <option value="FINANCE">Finance</option>
          <option value="OPERATIONS_TERRAIN">Opérations</option>
          <option value="AUDIT">Audit</option>
          <option value="OPTIMISATION">Optimisation</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setEpingle(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-all ${epingle ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          <Pin className="w-3.5 h-3.5" /> Épinglés ({nbEpingles})
        </button>
        <button onClick={() => setRefresh(r => r + 1)}
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : observations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucune observation pour le moment</p>
        </div>
      ) : (
        <div className="space-y-3">
          {observations.map(o => {
            const meta = TYPE_META[o.type];
            return (
              <div key={o.id} className={`bg-white rounded-xl border p-4 transition-colors ${o.epingle ? "border-amber-200 bg-amber-50/30" : "border-slate-200"}`}>
                <div className="flex items-start gap-3">
                  {/* Avatar initiales */}
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-xs font-bold text-emerald-700">
                    {o.auteur.prenom[0]}{o.auteur.nom[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium text-slate-700">
                        {o.auteur.prenom} {o.auteur.nom}
                      </span>
                      {meta && (
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                          {meta.icon} {meta.label}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{COMM_LABELS[o.typeCommission] || o.typeCommission}</span>
                      {o.epingle && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                          <Pin className="w-3 h-3" /> Épinglé
                        </span>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">
                        {new Date(o.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{o.contenu}</p>
                    {o.pieceJointeUrl && (
                      <a href={o.pieceJointeUrl} target="_blank" rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <FileText className="w-3.5 h-3.5" /> Pièce jointe
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
