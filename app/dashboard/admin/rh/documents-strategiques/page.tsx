"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import DashboardBackButton from "@/components/DashboardBackButton";
import { formatDate } from "@/lib/format";
import {
  BookOpen, Plus, X, FileText, ExternalLink, Eye,
  CheckCircle, Archive, Trash2, RefreshCw, Copy,
} from "lucide-react";

interface DocStrat {
  id: number;
  type: string;
  titre: string;
  reference: string | null;
  version: number;
  description: string | null;
  contenu: string | null;
  fichierUrl: string | null;
  statut: "BROUILLON" | "EN_VIGUEUR" | "ARCHIVE";
  dateEffet: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  MANUEL_RH: "Manuel des Ressources Humaines",
  POLITIQUE_RH: "Politique RH",
  REGLEMENT_INTERIEUR: "Règlement intérieur",
  CODE_CONDUITE: "Code de conduite",
  CODE_ETHIQUE: "Code d'éthique",
  POLITIQUE_REMUNERATION: "Politique de rémunération",
  POLITIQUE_DISCIPLINAIRE: "Politique disciplinaire",
  POLITIQUE_RECRUTEMENT: "Politique de recrutement",
  POLITIQUE_FORMATION: "Politique de formation",
  POLITIQUE_PROMOTION: "Politique de promotion",
  POLITIQUE_DIVERSITE: "Politique de diversité et d'inclusion",
  POLITIQUE_SANTE_SECURITE: "Politique Santé, Sécurité & Bien-être",
  POLITIQUE_CONFIDENTIALITE: "Politique de confidentialité des données du personnel",
  AUTRE: "Autre",
};
const TYPE_ORDER = Object.keys(TYPE_LABEL);

const STATUT_BADGE: Record<string, { label: string; cls: string }> = {
  BROUILLON:  { label: "Brouillon",  cls: "bg-slate-100 text-slate-600" },
  EN_VIGUEUR: { label: "En vigueur", cls: "bg-emerald-100 text-emerald-700" },
  ARCHIVE:    { label: "Archivé",    cls: "bg-gray-100 text-gray-500" },
};

const EMPTY = { type: "", titre: "", reference: "", description: "", contenu: "", fichierUrl: "", dateEffet: "" };
const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

export default function DocumentsStrategiquesPage() {
  const { data, loading, refetch } = useApi<{ data: DocStrat[] }>("/api/admin/rh/documents-strategiques");
  const docs = data?.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<DocStrat | null>(null);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function create(publish: boolean) {
    if (!form.type || !form.titre.trim()) { toast.error("Type et titre sont obligatoires"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/rh/documents-strategiques", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, statut: publish ? "EN_VIGUEUR" : "BROUILLON" }),
      });
      if (r.ok) { toast.success(publish ? "Document publié" : "Brouillon enregistré"); setForm(EMPTY); setShowForm(false); refetch(); }
      else { const j = await r.json().catch(() => ({})); toast.error(j.error ?? "Erreur"); }
    } finally { setSaving(false); }
  }

  async function patch(id: number, body: Record<string, unknown>, msg: string) {
    const r = await fetch(`/api/admin/rh/documents-strategiques/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (r.ok) { toast.success(msg); refetch(); } else toast.error("Erreur");
  }

  async function remove(id: number) {
    if (!confirm("Supprimer définitivement ce document ?")) return;
    const r = await fetch(`/api/admin/rh/documents-strategiques/${id}`, { method: "DELETE" });
    if (r.ok) { toast.success("Document supprimé"); refetch(); } else toast.error("Erreur");
  }

  function newVersion(d: DocStrat) {
    setForm({ ...EMPTY, type: d.type, titre: d.titre, reference: d.reference ?? "", description: d.description ?? "" });
    setShowForm(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Regrouper par type dans l'ordre de référence
  const grouped = TYPE_ORDER
    .map((t) => ({ type: t, items: docs.filter((d) => d.type === t) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center gap-3 mb-1">
        <DashboardBackButton exitViewAsOnBack={false} />
        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><BookOpen className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800">Documents stratégiques RH</h1>
          <p className="text-xs text-slate-500">Manuel RH, politiques, règlement intérieur, codes — versionnés par type</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setShowForm((v) => !v); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Fermer" : "Nouveau document"}
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="mt-5 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Nouveau document / nouvelle version</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Type <span className="text-red-500">*</span></span>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">— Sélectionner —</option>
                {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Titre <span className="text-red-500">*</span></span>
              <input value={form.titre} onChange={(e) => set("titre", e.target.value)} placeholder="Ex : Règlement intérieur 2026" className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Référence</span>
              <input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Ex : POL-RH-2026-001" className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Date d&apos;effet</span>
              <input type="date" value={form.dateEffet} onChange={(e) => set("dateEffet", e.target.value)} className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">Description</span>
              <input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Objet / portée du document" className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">URL du fichier (PDF, DOC…)</span>
              <input value={form.fichierUrl} onChange={(e) => set("fichierUrl", e.target.value)} placeholder="https://… (après upload)" className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">Contenu (texte, optionnel)</span>
              <textarea rows={4} value={form.contenu} onChange={(e) => set("contenu", e.target.value)} placeholder="Corps du document (si non fourni en fichier)" className={`${inputCls} resize-y`} />
            </label>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button onClick={() => create(false)} disabled={saving}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
              Enregistrer en brouillon
            </button>
            <button onClick={() => create(true)} disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Publier
            </button>
          </div>
        </div>
      )}

      {/* Liste groupée par type */}
      <div className="mt-6 space-y-5">
        {loading && docs.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">Chargement…</p>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center text-slate-400 py-16">
            <BookOpen className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucun document stratégique enregistré.</p>
          </div>
        ) : grouped.map((g) => (
          <div key={g.type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">{TYPE_LABEL[g.type]}</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {g.items.map((d) => {
                const badge = STATUT_BADGE[d.statut];
                return (
                  <div key={d.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800 truncate">{d.titre}</span>
                        <span className="text-xs text-slate-400">v{d.version}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                        {d.reference && <span className="text-[10px] font-mono text-slate-400">{d.reference}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                        <span>Créé le {formatDate(d.createdAt)}</span>
                        {d.dateEffet && <span>· Effet : {formatDate(d.dateEffet)}</span>}
                        {d.description && <span className="truncate">· {d.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                      {d.contenu && (
                        <button onClick={() => setPreview(d)} title="Aperçu" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><Eye className="w-4 h-4" /></button>
                      )}
                      {d.fichierUrl && (
                        <a href={d.fichierUrl} target="_blank" rel="noreferrer" title="Ouvrir le fichier" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><ExternalLink className="w-4 h-4" /></a>
                      )}
                      <button onClick={() => newVersion(d)} title="Nouvelle version" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><Copy className="w-4 h-4" /></button>
                      {d.statut === "BROUILLON" && (
                        <button onClick={() => patch(d.id, { statut: "EN_VIGUEUR" }, "Document publié")} title="Publier"
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><CheckCircle className="w-4 h-4" /></button>
                      )}
                      {d.statut === "EN_VIGUEUR" && (
                        <button onClick={() => patch(d.id, { statut: "ARCHIVE" }, "Document archivé")} title="Archiver"
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Archive className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => remove(d.id)} title="Supprimer" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Aperçu du contenu */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800 truncate">{preview.titre}</h3>
                <p className="text-xs text-slate-400">{TYPE_LABEL[preview.type]} · v{preview.version}</p>
              </div>
              <button onClick={() => setPreview(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5 bg-slate-50">
              <div className="bg-white rounded-lg border border-slate-200 p-6 text-sm text-slate-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: preview.contenu ?? "" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
