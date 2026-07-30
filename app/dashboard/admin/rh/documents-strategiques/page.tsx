"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import DashboardBackButton from "@/components/DashboardBackButton";
import { formatDate } from "@/lib/format";
import {
  BookOpen, Plus, X, ExternalLink, Eye,
  CheckCircle, Archive, Trash2, RefreshCw, Copy,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

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
  PLAN_EVACUATION: "Plan d'évacuation",
  AUTRE: "Autre",
};
const TYPE_ORDER = Object.keys(TYPE_LABEL);

const STATUT_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  BROUILLON:  { label: "Brouillon",  variant: "neutral" },
  EN_VIGUEUR: { label: "En vigueur", variant: "success" },
  ARCHIVE:    { label: "Archivé",    variant: "neutral" },
};

const EMPTY = { type: "", titre: "", reference: "", description: "", contenu: "", fichierUrl: "", dateEffet: "" };
const selectCls = "w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500";

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
        <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"><BookOpen className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Documents stratégiques RH</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manuel RH, politiques, règlement intérieur, codes — versionnés par type</p>
        </div>
        <Button
          onClick={() => { setForm(EMPTY); setShowForm((v) => !v); }}
          icon={showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        >
          {showForm ? "Fermer" : "Nouveau document"}
        </Button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <Card className="mt-5">
          <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nouveau document / nouvelle version</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Type <span className="text-red-500">*</span></span>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className={selectCls}>
                <option value="">— Sélectionner —</option>
                {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <Input label="Titre" value={form.titre} onChange={(e) => set("titre", e.target.value)} placeholder="Ex : Règlement intérieur 2026" />
            <Input label="Référence" value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Ex : POL-RH-2026-001" />
            <Input type="date" label="Date d'effet" value={form.dateEffet} onChange={(e) => set("dateEffet", e.target.value)} />
            <div className="sm:col-span-2">
              <Input label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Objet / portée du document" />
            </div>
            <div className="sm:col-span-2">
              <Input label="URL du fichier (PDF, DOC…)" value={form.fichierUrl} onChange={(e) => set("fichierUrl", e.target.value)} placeholder="https://… (après upload)" />
            </div>
            <label className="block sm:col-span-2">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Contenu (texte, optionnel)</span>
              <textarea rows={4} value={form.contenu} onChange={(e) => set("contenu", e.target.value)} placeholder="Corps du document (si non fourni en fichier)" className={`${selectCls} resize-y`} />
            </label>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="secondary" onClick={() => create(false)} disabled={saving} className="w-full sm:w-auto justify-center">
              Enregistrer en brouillon
            </Button>
            <Button onClick={() => create(true)} disabled={saving} loading={saving} icon={<CheckCircle className="w-4 h-4" />} className="w-full sm:w-auto justify-center">
              Publier
            </Button>
          </div>
          </div>
        </Card>
      )}

      {/* Liste groupée par type */}
      <div className="mt-6 space-y-5">
        {loading && docs.length === 0 ? (
          <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-10">Chargement…</p>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center text-slate-400 dark:text-slate-500 py-16">
            <BookOpen className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucun document stratégique enregistré.</p>
          </div>
        ) : grouped.map((g) => (
          <div key={g.type} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{TYPE_LABEL[g.type]}</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {g.items.map((d) => {
                const badge = STATUT_BADGE[d.statut];
                return (
                  <div key={d.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{d.titre}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">v{d.version}</span>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        {d.reference && <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{d.reference}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
                        <span>Créé le {formatDate(d.createdAt)}</span>
                        {d.dateEffet && <span>· Effet : {formatDate(d.dateEffet)}</span>}
                        {d.description && <span className="truncate">· {d.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                      {d.contenu && (
                        <button onClick={() => setPreview(d)} title="Aperçu" className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Eye className="w-4 h-4" /></button>
                      )}
                      {d.fichierUrl && (
                        <a href={d.fichierUrl} target="_blank" rel="noreferrer" title="Ouvrir le fichier" className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><ExternalLink className="w-4 h-4" /></a>
                      )}
                      <button onClick={() => newVersion(d)} title="Nouvelle version" className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Copy className="w-4 h-4" /></button>
                      {d.statut === "BROUILLON" && (
                        <button onClick={() => patch(d.id, { statut: "EN_VIGUEUR" }, "Document publié")} title="Publier"
                          className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg"><CheckCircle className="w-4 h-4" /></button>
                      )}
                      {d.statut === "EN_VIGUEUR" && (
                        <button onClick={() => patch(d.id, { statut: "ARCHIVE" }, "Document archivé")} title="Archiver"
                          className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg"><Archive className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => remove(d.id)} title="Supprimer" className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Aperçu du contenu */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview ? `${preview.titre} — ${TYPE_LABEL[preview.type]} · v${preview.version}` : undefined}
        size="lg"
      >
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl -m-1 p-1">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: preview?.contenu ?? "" }} />
        </div>
      </Modal>
    </div>
  );
}
