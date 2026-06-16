"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  BarChart3, Plus, Search, RefreshCw, CheckCircle2,
  FileText, Eye, ArrowLeft, Send, Archive,
} from "lucide-react";
import Link from "next/link";

interface Rapport {
  id: number;
  titre: string;
  type: string;
  typeCommission: string;
  statut: string;
  periode: string | null;
  dateValidation: string | null;
  createdAt: string;
  redacteur: { nom: string; prenom: string } | null;
  validePar: { nom: string; prenom: string } | null;
}

interface Data { rapports: Rapport[] }

const STATUTS: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: "Brouillon", color: "bg-slate-100 text-slate-600" },
  SOUMIS:    { label: "Soumis",    color: "bg-amber-100 text-amber-700" },
  VALIDE:    { label: "Validé",    color: "bg-emerald-100 text-emerald-700" },
  ARCHIVE:   { label: "Archivé",   color: "bg-slate-100 text-slate-500" },
};

const TYPES: Record<string, string> = {
  MENSUEL:     "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  ANNUEL:      "Annuel",
  AUDIT:       "Audit",
  EXCEPTIONNEL:"Exceptionnel",
};

const COMM_LABELS: Record<string, string> = {
  FINANCE:            "Finance",
  OPERATIONS_TERRAIN: "Opérations",
  AUDIT_CONTROLE:     "Audit & Contrôle",
  OPTIMISATION:       "Optimisation",
};

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    titre: "", type: "MENSUEL", typeCommission: "FINANCE", periode: "", contenu: "",
  });
  const { mutate, loading } = useMutation("/api/admin/ria/commissions/gouvernance/rapports", "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate(form) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success("Rapport créé"); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" /> Nouveau rapport
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Titre du rapport" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Commission *</label>
              <select value={form.typeCommission} onChange={e => setForm(f => ({ ...f, typeCommission: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="FINANCE">Finance</option>
                <option value="OPERATIONS_TERRAIN">Opérations Terrain</option>
                <option value="AUDIT_CONTROLE">Audit & Contrôle</option>
                <option value="OPTIMISATION">Optimisation</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Période couverte</label>
            <input value={form.periode} onChange={e => setForm(f => ({ ...f, periode: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Ex. Juin 2026, T2-2026, 2025..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contenu</label>
            <textarea value={form.contenu} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))}
              rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              placeholder="Contenu du rapport..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
              {loading ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RapportsGouvernancePage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [filterComm, setFilterComm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [refresh, setRefresh] = useState(0);

  const params = new URLSearchParams();
  if (filterStatut) params.set("statut", filterStatut);
  if (filterComm)   params.set("typeCommission", filterComm);
  if (filterType)   params.set("type", filterType);
  if (refresh > 0)  params.set("_r", String(refresh));
  const { data, loading } = useApi<Data>(
    `/api/admin/ria/commissions/gouvernance/rapports?${params.toString()}`
  );

  const items = (data?.rapports || []).filter(r =>
    !search || r.titre.toLowerCase().includes(search.toLowerCase())
  );

  const allRapports = data?.rapports || [];

  async function handleAction(id: number, statut: string) {
    const labels: Record<string, string> = { SOUMIS: "Rapport soumis", VALIDE: "Rapport validé", ARCHIVE: "Rapport archivé" };
    const res = await fetch(`/api/admin/ria/commissions/gouvernance/rapports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    const json = await res.json();
    if (json?.id) { toast.success(labels[statut] || "Mis à jour"); setRefresh(r => r + 1); }
    else toast.error(json?.error || "Erreur");
  }

  function done() { setShowCreate(false); setRefresh(r => r + 1); }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/user/responsablesRIA/gouvernance"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Gouvernance
          </Link>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-600" /> Rapports de Gouvernance
          </h1>
          <p className="text-sm text-slate-500">Rapports périodiques et bilans des commissions</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700">
          <Plus className="w-4 h-4" /> Nouveau rapport
        </button>
      </div>

      {/* Compteurs */}
      {!loading && data && (
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(STATUTS).map(([k, s]) => (
            <button key={k} onClick={() => setFilterStatut(filterStatut === k ? "" : k)}
              className={`p-4 rounded-xl border text-center transition-all ${filterStatut === k ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <p className="text-2xl font-bold text-slate-800">
                {allRapports.filter(r => r.statut === k).length}
              </p>
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
            placeholder="Rechercher par titre..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Tous les types</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterComm} onChange={e => setFilterComm(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Toutes commissions</option>
          <option value="FINANCE">Finance</option>
          <option value="OPERATIONS_TERRAIN">Opérations</option>
          <option value="AUDIT_CONTROLE">Audit & Contrôle</option>
          <option value="OPTIMISATION">Optimisation</option>
        </select>
        <button onClick={() => setRefresh(r => r + 1)}
          className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucun rapport disponible</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-amber-200 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs text-slate-400 font-mono">#{r.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUTS[r.statut]?.color || "bg-slate-100 text-slate-600"}`}>
                      {STATUTS[r.statut]?.label || r.statut}
                    </span>
                    <span className="text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-100">
                      {TYPES[r.type] || r.type}
                    </span>
                    <span className="text-xs text-slate-400">
                      {COMM_LABELS[r.typeCommission] || r.typeCommission}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{r.titre}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    {r.periode && <span><FileText className="w-3 h-3 inline mr-0.5" />Période: {r.periode}</span>}
                    {r.redacteur && <span>Rédigé par {r.redacteur.prenom} {r.redacteur.nom}</span>}
                    <span>{new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                  {r.dateValidation && r.validePar && (
                    <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Validé le {new Date(r.dateValidation).toLocaleDateString("fr-FR")} par {r.validePar.prenom} {r.validePar.nom}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {r.statut === "BROUILLON" && (
                    <button onClick={() => handleAction(r.id, "SOUMIS")}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-amber-700 border border-amber-200 hover:bg-amber-50 rounded-lg">
                      <Send className="w-3.5 h-3.5" /> Soumettre
                    </button>
                  )}
                  {r.statut === "SOUMIS" && (
                    <button onClick={() => handleAction(r.id, "VALIDE")}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Valider
                    </button>
                  )}
                  {r.statut === "VALIDE" && (
                    <button onClick={() => handleAction(r.id, "ARCHIVE")}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg">
                      <Archive className="w-3.5 h-3.5" /> Archiver
                    </button>
                  )}
                  <a href={`/dashboard/admin/ria/gouvernance/rapports/${r.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-50 rounded-lg">
                    <Eye className="w-3.5 h-3.5" /> Voir
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={done} />}
    </div>
  );
}
