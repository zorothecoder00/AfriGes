"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import RetourApprovisionnement from "@/components/RetourApprovisionnement";
import {
  Truck, Plus, X, Search, RefreshCw, Save,
  Building2, Star, FileText, Trash2, Pencil, Ban, CheckCircle,
} from "lucide-react";

interface Fournisseur {
  id: number; code: string | null; nom: string; type: string | null;
  contact: string | null; telephone: string | null; email: string | null; adresse: string | null;
  pays: string | null; region: string | null; devise: string | null;
  banque: string | null; iban: string | null; rccm: string | null; nif: string | null; numeroTva: string | null;
  notes: string | null; actif: boolean; noteGlobale: number | string | null;
  createdAt: string;
  _count?: { receptions: number; contrats: number };
}

interface Contrat {
  id: number; titre: string; reference: string | null;
  dateDebut: string | null; dateFin: string | null; fichierUrl: string | null; notes: string | null;
}

interface Evaluation {
  tauxRespectDelais: number | null; receptionsAnalysees: number;
  tauxQualite: number | null; lignesAnalysees: number;
}

const TYPE_LABEL: Record<string, string> = {
  PRODUCTEUR: "Producteur", COOPERATIVE: "Coopérative", INDUSTRIEL: "Industriel",
  IMPORTATEUR: "Importateur", TRANSPORTEUR: "Transporteur",
};

const EMPTY_FORM = {
  nom: "", type: "", contact: "", telephone: "", email: "", adresse: "",
  pays: "", region: "", devise: "", banque: "", iban: "", rccm: "", nif: "", numeroTva: "", notes: "",
};

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

export default function FournisseursPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [actifFilter, setActifFilter] = useState("true");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (typeFilter) params.set("type", typeFilter);
  if (actifFilter) params.set("actif", actifFilter);

  const { data, loading, refetch } = useApi<{ data: Fournisseur[] }>(`/api/logistique/fournisseurs?${params}`);
  const fournisseurs = data?.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <RetourApprovisionnement />
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-6 h-6 text-emerald-600" /> Fournisseurs
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Fiche fournisseur, contrats et évaluation</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouveau fournisseur
          </button>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, code, pays, téléphone…"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputCls} bg-white w-auto`}>
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={actifFilter} onChange={(e) => setActifFilter(e.target.value)} className={`${inputCls} bg-white w-auto`}>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
            <option value="">Tous</option>
          </select>
          <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : fournisseurs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <Truck className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucun fournisseur trouvé</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {fournisseurs.map((f) => (
              <div key={f.id} onClick={() => setDetailId(f.id)}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 flex-shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{f.nom}</span>
                    {f.code && <span className="text-xs font-mono text-slate-400">{f.code}</span>}
                    {f.type && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">{TYPE_LABEL[f.type] ?? f.type}</span>}
                    {!f.actif && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Inactif</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {[f.pays, f.telephone, f.email].filter(Boolean).join(" · ") || "Aucune coordonnée renseignée"}
                  </p>
                </div>
                {f.noteGlobale != null && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 flex-shrink-0">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> {f.noteGlobale}/100
                  </span>
                )}
                <span className="text-xs text-slate-400 flex-shrink-0">{f._count?.receptions ?? 0} réception(s)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <FournisseurModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); refetch(); }} />
      )}
      {detailId && (
        <FournisseurDetail id={detailId} onClose={() => setDetailId(null)} onUpdated={refetch} />
      )}
    </div>
  );
}

// ── Modal création ────────────────────────────────────────────────────────────

function FournisseurModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nom.trim()) { toast.error("Le nom est obligatoire"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/logistique/fournisseurs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: form.type || undefined }),
      });
      if (r.ok) { toast.success("Fournisseur créé"); onSaved(); }
      else { const j = await r.json().catch(() => ({})); toast.error(j.error ?? "Erreur"); }
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau fournisseur</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nom *"><input value={form.nom} onChange={(e) => set("nom", e.target.value)} className={inputCls} /></Field>
            <Field label="Type">
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">— Non précisé —</option>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Contact"><input value={form.contact} onChange={(e) => set("contact", e.target.value)} className={inputCls} /></Field>
            <Field label="Téléphone"><input value={form.telephone} onChange={(e) => set("telephone", e.target.value)} className={inputCls} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} /></Field>
            <Field label="Adresse"><input value={form.adresse} onChange={(e) => set("adresse", e.target.value)} className={inputCls} /></Field>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Identité légale & internationale</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Pays"><input value={form.pays} onChange={(e) => set("pays", e.target.value)} className={inputCls} /></Field>
              <Field label="Région"><input value={form.region} onChange={(e) => set("region", e.target.value)} className={inputCls} /></Field>
              <Field label="Devise"><input value={form.devise} onChange={(e) => set("devise", e.target.value)} placeholder="XOF, EUR…" className={inputCls} /></Field>
              <Field label="Banque"><input value={form.banque} onChange={(e) => set("banque", e.target.value)} className={inputCls} /></Field>
              <Field label="IBAN / RIB"><input value={form.iban} onChange={(e) => set("iban", e.target.value)} className={inputCls} /></Field>
              <Field label="RCCM"><input value={form.rccm} onChange={(e) => set("rccm", e.target.value)} className={inputCls} /></Field>
              <Field label="NIF"><input value={form.nif} onChange={(e) => set("nif", e.target.value)} className={inputCls} /></Field>
              <Field label="N° TVA"><input value={form.numeroTva} onChange={(e) => set("numeroTva", e.target.value)} className={inputCls} /></Field>
            </div>
          </div>

          <Field label="Notes">
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputCls} resize-y`} />
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Détail / édition ──────────────────────────────────────────────────────────

function FournisseurDetail({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, refetch } = useApi<{ data: Fournisseur & { contrats: Contrat[] }; evaluation: Evaluation }>(`/api/logistique/fournisseurs/${id}`);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM & { noteGlobale: string }>({ ...EMPTY_FORM, noteGlobale: "" });
  const [saving, setSaving] = useState(false);
  const [showContratForm, setShowContratForm] = useState(false);

  const f = data?.data;
  const evalu = data?.evaluation;

  const startEdit = () => {
    if (!f) return;
    setForm({
      nom: f.nom, type: f.type ?? "", contact: f.contact ?? "", telephone: f.telephone ?? "",
      email: f.email ?? "", adresse: f.adresse ?? "", pays: f.pays ?? "", region: f.region ?? "",
      devise: f.devise ?? "", banque: f.banque ?? "", iban: f.iban ?? "", rccm: f.rccm ?? "",
      nif: f.nif ?? "", numeroTva: f.numeroTva ?? "", notes: f.notes ?? "",
      noteGlobale: f.noteGlobale != null ? String(f.noteGlobale) : "",
    });
    setEditMode(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/logistique/fournisseurs/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: form.type || null, noteGlobale: form.noteGlobale || null }),
      });
      if (r.ok) { toast.success("Fournisseur mis à jour"); setEditMode(false); refetch(); onUpdated(); }
      else toast.error("Erreur");
    } finally { setSaving(false); }
  };

  const toggleActif = async () => {
    if (!f) return;
    const r = await fetch(`/api/logistique/fournisseurs/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !f.actif }),
    });
    if (r.ok) { toast.success(f.actif ? "Fournisseur désactivé" : "Fournisseur réactivé"); refetch(); onUpdated(); }
  };

  const removeContrat = async (contratId: number) => {
    if (!confirm("Supprimer ce contrat ?")) return;
    const r = await fetch(`/api/logistique/fournisseurs/${id}/contrats/${contratId}`, { method: "DELETE" });
    if (r.ok) { toast.success("Contrat supprimé"); refetch(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 truncate">{f?.nom ?? "Chargement…"}</h2>
            {f?.code && <p className="text-xs font-mono text-slate-400">{f.code}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!editMode && f && (
              <>
                <button onClick={startEdit} title="Modifier" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><Pencil className="w-4 h-4" /></button>
                <button onClick={toggleActif} title={f.actif ? "Désactiver" : "Réactiver"}
                  className={`p-1.5 rounded-lg ${f.actif ? "text-red-500 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"}`}>
                  {f.actif ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {loading || !f ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : editMode ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nom *"><input value={form.nom} onChange={(e) => setForm((s) => ({ ...s, nom: e.target.value }))} className={inputCls} /></Field>
                <Field label="Type">
                  <select value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))} className={`${inputCls} bg-white`}>
                    <option value="">— Non précisé —</option>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Contact"><input value={form.contact} onChange={(e) => setForm((s) => ({ ...s, contact: e.target.value }))} className={inputCls} /></Field>
                <Field label="Téléphone"><input value={form.telephone} onChange={(e) => setForm((s) => ({ ...s, telephone: e.target.value }))} className={inputCls} /></Field>
                <Field label="Email"><input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} className={inputCls} /></Field>
                <Field label="Adresse"><input value={form.adresse} onChange={(e) => setForm((s) => ({ ...s, adresse: e.target.value }))} className={inputCls} /></Field>
                <Field label="Pays"><input value={form.pays} onChange={(e) => setForm((s) => ({ ...s, pays: e.target.value }))} className={inputCls} /></Field>
                <Field label="Région"><input value={form.region} onChange={(e) => setForm((s) => ({ ...s, region: e.target.value }))} className={inputCls} /></Field>
                <Field label="Devise"><input value={form.devise} onChange={(e) => setForm((s) => ({ ...s, devise: e.target.value }))} className={inputCls} /></Field>
                <Field label="Banque"><input value={form.banque} onChange={(e) => setForm((s) => ({ ...s, banque: e.target.value }))} className={inputCls} /></Field>
                <Field label="IBAN / RIB"><input value={form.iban} onChange={(e) => setForm((s) => ({ ...s, iban: e.target.value }))} className={inputCls} /></Field>
                <Field label="RCCM"><input value={form.rccm} onChange={(e) => setForm((s) => ({ ...s, rccm: e.target.value }))} className={inputCls} /></Field>
                <Field label="NIF"><input value={form.nif} onChange={(e) => setForm((s) => ({ ...s, nif: e.target.value }))} className={inputCls} /></Field>
                <Field label="N° TVA"><input value={form.numeroTva} onChange={(e) => setForm((s) => ({ ...s, numeroTva: e.target.value }))} className={inputCls} /></Field>
                <Field label="Note globale (/100)">
                  <input type="number" min="0" max="100" value={form.noteGlobale} onChange={(e) => setForm((s) => ({ ...s, noteGlobale: e.target.value }))} className={inputCls} />
                </Field>
              </div>
              <Field label="Notes"><textarea rows={2} value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} className={`${inputCls} resize-y`} /></Field>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditMode(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Évaluation */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Note globale" value={f.noteGlobale != null ? `${f.noteGlobale}/100` : "—"} />
                <StatCard label="Respect délais" value={evalu?.tauxRespectDelais != null ? `${evalu.tauxRespectDelais}%` : "—"}
                  sub={evalu ? `${evalu.receptionsAnalysees} réception(s)` : undefined} />
                <StatCard label="Qualité produit" value={evalu?.tauxQualite != null ? `${evalu.tauxQualite}%` : "—"}
                  sub={evalu ? `${evalu.lignesAnalysees} ligne(s)` : undefined} />
                <StatCard label="Réceptions" value={String(f._count?.receptions ?? 0)} />
              </div>

              {/* Coordonnées */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <InfoLine label="Contact" value={f.contact} />
                <InfoLine label="Téléphone" value={f.telephone} />
                <InfoLine label="Email" value={f.email} />
                <InfoLine label="Adresse" value={f.adresse} />
                <InfoLine label="Pays" value={f.pays} />
                <InfoLine label="Région" value={f.region} />
                <InfoLine label="Devise" value={f.devise} />
                <InfoLine label="Banque" value={f.banque} />
                <InfoLine label="IBAN / RIB" value={f.iban} />
                <InfoLine label="RCCM" value={f.rccm} />
                <InfoLine label="NIF" value={f.nif} />
                <InfoLine label="N° TVA" value={f.numeroTva} />
              </div>
              {f.notes && <p className="text-sm text-slate-500 italic border-t border-slate-100 pt-3">{f.notes}</p>}

              {/* Contrats */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Contrats</p>
                  <button onClick={() => setShowContratForm(true)} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                    <Plus className="w-3.5 h-3.5" /> Ajouter
                  </button>
                </div>
                {(!f.contrats || f.contrats.length === 0) ? (
                  <p className="text-xs text-slate-400">Aucun contrat enregistré</p>
                ) : (
                  <div className="space-y-2">
                    {f.contrats.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{c.titre}{c.reference ? ` — ${c.reference}` : ""}</p>
                          <p className="text-xs text-slate-400">
                            {c.dateDebut ? formatDate(c.dateDebut) : "?"} → {c.dateFin ? formatDate(c.dateFin) : "indéterminé"}
                            {c.fichierUrl && <> · <a href={c.fichierUrl} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">Fichier</a></>}
                          </p>
                        </div>
                        <button onClick={() => removeContrat(c.id)} className="text-slate-300 hover:text-red-400 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showContratForm && f && (
        <ContratModal fournisseurId={f.id} onClose={() => setShowContratForm(false)} onSaved={() => { setShowContratForm(false); refetch(); }} />
      )}
    </div>
  );
}

function ContratModal({ fournisseurId, onClose, onSaved }: { fournisseurId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ titre: "", reference: "", dateDebut: "", dateFin: "", fichierUrl: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.titre.trim()) { toast.error("Le titre est obligatoire"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/logistique/fournisseurs/${fournisseurId}/contrats`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (r.ok) { toast.success("Contrat ajouté"); onSaved(); }
      else toast.error("Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau contrat</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Titre *"><input value={form.titre} onChange={(e) => set("titre", e.target.value)} className={inputCls} /></Field>
          <Field label="Référence"><input value={form.reference} onChange={(e) => set("reference", e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début"><input type="date" value={form.dateDebut} onChange={(e) => set("dateDebut", e.target.value)} className={inputCls} /></Field>
            <Field label="Fin"><input type="date" value={form.dateFin} onChange={(e) => set("dateFin", e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="URL du fichier"><input value={form.fichierUrl} onChange={(e) => set("fichierUrl", e.target.value)} className={inputCls} /></Field>
          <Field label="Notes"><textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputCls} resize-y`} /></Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Petits composants ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function InfoLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p><span className="text-slate-400">{label} :</span> <span className="text-slate-700">{value}</span></p>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
