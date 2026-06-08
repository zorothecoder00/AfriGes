"use client";

import React, { useState, useCallback } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Plus, Search, CheckCircle2, Clock,
  Shield, FileWarning, Ban,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */
type TypeSanction = "AVERTISSEMENT" | "BLAME" | "MISE_A_PIED" | "RETROGRADATION" | "LICENCIEMENT" | "AUTRE";
type StatutProcedure = "OUVERTE" | "EN_INSTRUCTION" | "CLOTUREE" | "ANNULEE";

interface ProfilRH {
  id: number;
  matricule: string;
  gestionnaire: {
    member: { nom: string; prenom: string };
  } | null;
}

interface ProcedureDisciplinaire {
  id: number;
  type: TypeSanction;
  motif: string;
  faitsReproches: string | null;
  dateIncident: string;
  dateConvocation: string | null;
  reponseCollab: string | null;
  decision: string | null;
  dateDecision: string | null;
  dureeSuspension: number | null;
  notes: string | null;
  statut: StatutProcedure;
  dateProcedure: string;
  profilRH: ProfilRH;
}

interface ProcsResponse {
  data: ProcedureDisciplinaire[];
  meta: { total: number; page: number; totalPages: number };
  stats: Partial<Record<StatutProcedure, number>>;
}

interface CollabOption { id: number; matricule: string; nom: string; prenom: string }

/* ─── Helpers ────────────────────────────────────────────── */
const TYPE_LABELS: Record<TypeSanction, string> = {
  AVERTISSEMENT: "Avertissement",
  BLAME: "Blâme",
  MISE_A_PIED: "Mise à pied",
  RETROGRADATION: "Rétrogradation",
  LICENCIEMENT: "Licenciement",
  AUTRE: "Autre",
};
const TYPE_COLORS: Record<TypeSanction, string> = {
  AVERTISSEMENT: "bg-yellow-100 text-yellow-700",
  BLAME: "bg-orange-100 text-orange-700",
  MISE_A_PIED: "bg-red-100 text-red-700",
  RETROGRADATION: "bg-purple-100 text-purple-700",
  LICENCIEMENT: "bg-red-200 text-red-800 font-semibold",
  AUTRE: "bg-gray-100 text-gray-700",
};
const STATUT_LABELS: Record<StatutProcedure, string> = {
  OUVERTE: "Ouverte",
  EN_INSTRUCTION: "En instruction",
  CLOTUREE: "Clôturée",
  ANNULEE: "Annulée",
};
const STATUT_COLORS: Record<StatutProcedure, string> = {
  OUVERTE: "bg-blue-100 text-blue-700",
  EN_INSTRUCTION: "bg-yellow-100 text-yellow-700",
  CLOTUREE: "bg-green-100 text-green-700",
  ANNULEE: "bg-gray-100 text-gray-500",
};

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

/* ─── ProcDetailModal ────────────────────────────────────── */
function ProcDetailModal({ proc, onClose, onRefresh }: {
  proc: ProcedureDisciplinaire;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    faitsReproches: proc.faitsReproches ?? "",
    dateConvocation: proc.dateConvocation ? proc.dateConvocation.slice(0, 10) : "",
    reponseCollab: proc.reponseCollab ?? "",
    decision: proc.decision ?? "",
    dureeSuspension: proc.dureeSuspension?.toString() ?? "",
    notes: proc.notes ?? "",
  });
  const [clotureDecision, setClotureDecision] = useState("");
  const { mutate: trigger, loading } = useMutation(`/api/admin/rh/disciplinaire/${proc.id}`, "PATCH");

  async function handleAction(action: string) {
    const body: Record<string, unknown> = { action };
    if (action === "CLOTURER" && clotureDecision) body.decision = clotureDecision;
    const res = await trigger(body);
    if (res) { toast.success("Procédure mise à jour"); onRefresh(); onClose(); }
    else toast.error("Erreur");
  }

  async function handleSave() {
    const res = await trigger({
      ...form,
      dureeSuspension: form.dureeSuspension ? Number(form.dureeSuspension) : null,
      dateConvocation: form.dateConvocation || null,
    });
    if (res) { toast.success("Modifications enregistrées"); onRefresh(); setEditMode(false); }
    else toast.error("Erreur");
  }

  const collaborateur = proc.profilRH.gestionnaire?.member
    ? `${proc.profilRH.gestionnaire.member.prenom} ${proc.profilRH.gestionnaire.member.nom}`
    : `Matricule ${proc.profilRH.matricule}`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[proc.type]}`}>{TYPE_LABELS[proc.type]}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUT_COLORS[proc.statut]}`}>{STATUT_LABELS[proc.statut]}</span>
            </div>
            <h3 className="font-semibold text-gray-800 mt-1">{collaborateur}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Matricule {proc.profilRH.matricule} · Procédure du {fmt(proc.dateProcedure)}</p>
          </div>
          <div className="flex items-center gap-2">
            {proc.statut !== "CLOTUREE" && proc.statut !== "ANNULEE" && (
              <button onClick={() => setEditMode(!editMode)} className={`px-3 py-1.5 text-xs rounded-lg border ${editMode ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {editMode ? "Mode lecture" : "Modifier"}
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
          </div>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-xs text-gray-500 block">Motif</span>
            <span className="text-gray-800 font-medium">{proc.motif}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block">Date incident</span>
            <span className="text-gray-800">{fmt(proc.dateIncident)}</span>
          </div>
        </div>

        {editMode ? (
          <div className="space-y-3 border-t pt-4">
            <div>
              <label className="text-xs text-gray-500">Faits reprochés</label>
              <textarea value={form.faitsReproches} onChange={(e) => setForm((p) => ({ ...p, faitsReproches: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Date de convocation</label>
                <input type="date" value={form.dateConvocation} onChange={(e) => setForm((p) => ({ ...p, dateConvocation: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              {proc.type === "MISE_A_PIED" && (
                <div>
                  <label className="text-xs text-gray-500">Durée suspension (jours)</label>
                  <input type="number" value={form.dureeSuspension} onChange={(e) => setForm((p) => ({ ...p, dureeSuspension: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500">Réponse du collaborateur</label>
              <textarea value={form.reponseCollab} onChange={(e) => setForm((p) => ({ ...p, reponseCollab: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Décision</label>
              <textarea value={form.decision} onChange={(e) => setForm((p) => ({ ...p, decision: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Notes internes</label>
              <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="flex justify-end">
              <button onClick={handleSave} disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 border-t pt-4 text-sm">
            {proc.faitsReproches && (
              <div><span className="text-xs text-gray-500 block">Faits reprochés</span><p className="text-gray-800 mt-0.5">{proc.faitsReproches}</p></div>
            )}
            {proc.dateConvocation && (
              <div><span className="text-xs text-gray-500 block">Convocation</span><p className="text-gray-800">{fmt(proc.dateConvocation)}</p></div>
            )}
            {proc.reponseCollab && (
              <div><span className="text-xs text-gray-500 block">Réponse collaborateur</span><p className="text-gray-800 mt-0.5">{proc.reponseCollab}</p></div>
            )}
            {proc.decision && (
              <div><span className="text-xs text-gray-500 block">Décision</span><p className="text-gray-800 font-medium mt-0.5">{proc.decision}</p></div>
            )}
            {proc.dureeSuspension && (
              <div><span className="text-xs text-gray-500 block">Durée suspension</span><p className="text-gray-800">{proc.dureeSuspension} jour(s)</p></div>
            )}
            {proc.notes && (
              <div><span className="text-xs text-gray-500 block">Notes</span><p className="text-gray-600 italic mt-0.5">{proc.notes}</p></div>
            )}
          </div>
        )}

        {/* Workflow */}
        {(proc.statut === "OUVERTE" || proc.statut === "EN_INSTRUCTION") && (
          <div className="border-t pt-4 mt-4 space-y-3">
            {proc.statut === "OUVERTE" && (
              <button onClick={() => handleAction("INSTRUIRE")} disabled={loading} className="w-full py-2 rounded-xl bg-yellow-100 text-yellow-700 font-medium text-sm hover:bg-yellow-200">
                Mettre en instruction
              </button>
            )}
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Décision de clôture</label>
              <textarea value={clotureDecision} onChange={(e) => setClotureDecision(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Saisir la décision finale..." />
              <button onClick={() => handleAction("CLOTURER")} disabled={loading} className="w-full py-2 rounded-xl bg-green-100 text-green-700 font-medium text-sm hover:bg-green-200">
                Clôturer la procédure
              </button>
            </div>
            <button onClick={() => handleAction("ANNULER")} disabled={loading} className="w-full py-2 rounded-xl bg-red-50 text-red-600 text-sm hover:bg-red-100">
              Annuler la procédure
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CreateProcModal ────────────────────────────────────── */
function CreateProcModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    profilRHId: "",
    type: "AVERTISSEMENT" as TypeSanction,
    motif: "",
    faitsReproches: "",
    dateIncident: new Date().toISOString().slice(0, 10),
    dateConvocation: "",
    dureeSuspension: "",
    notes: "",
  });
  const [collabSearch, setCollabSearch] = useState("");
  const [collabOptions, setCollabOptions] = useState<CollabOption[]>([]);
  const [selectedCollab, setSelectedCollab] = useState<CollabOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: collabData } = useApi<{ data: CollabOption[] }>(
    collabSearch.length >= 2
      ? `/api/admin/rh/collaborateurs?search=${encodeURIComponent(collabSearch)}&limit=10`
      : null
  );

  React.useEffect(() => {
    if (collabData?.data) setCollabOptions(collabData.data.map((c: CollabOption & { gestionnaire?: { member?: { nom?: string; prenom?: string } } }) => ({
      id: c.id,
      matricule: c.matricule,
      nom: c.gestionnaire?.member?.nom ?? "",
      prenom: c.gestionnaire?.member?.prenom ?? "",
    })));
  }, [collabData]);

  const { mutate: trigger, loading } = useMutation("/api/admin/rh/disciplinaire");

  async function handleSubmit() {
    if (!form.profilRHId || !form.type || !form.motif || !form.dateIncident) {
      toast.error("profilRHId, type, motif et dateIncident sont obligatoires");
      return;
    }
    const res = await trigger({
      ...form,
      profilRHId: Number(form.profilRHId),
      dureeSuspension: form.dureeSuspension ? Number(form.dureeSuspension) : null,
      dateConvocation: form.dateConvocation || null,
    });
    if (res) { toast.success("Procédure ouverte"); onCreated(); onClose(); }
    else toast.error("Erreur lors de la création");
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-800 mb-5">Ouvrir une procédure disciplinaire</h2>
        <div className="space-y-3">
          {/* Collaborateur */}
          <div>
            <label className="text-xs text-gray-500">Collaborateur *</label>
            <div className="relative mt-1">
              <input
                value={selectedCollab ? `${selectedCollab.prenom} ${selectedCollab.nom} (${selectedCollab.matricule})` : collabSearch}
                onChange={(e) => { setCollabSearch(e.target.value); setSelectedCollab(null); setForm((p) => ({ ...p, profilRHId: "" })); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Rechercher un collaborateur..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              {showDropdown && collabOptions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {collabOptions.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => { setSelectedCollab(c); setForm((p) => ({ ...p, profilRHId: String(c.id) })); setShowDropdown(false); }}
                    >
                      {c.prenom} {c.nom} <span className="text-gray-400 text-xs">({c.matricule})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs text-gray-500">Type de sanction *</label>
            <select value={form.type} onChange={set("type")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Motif */}
          <div>
            <label className="text-xs text-gray-500">Motif *</label>
            <input value={form.motif} onChange={set("motif")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" placeholder="Motif succinct" />
          </div>

          {/* Faits */}
          <div>
            <label className="text-xs text-gray-500">Faits reprochés</label>
            <textarea value={form.faitsReproches} onChange={set("faitsReproches")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={3} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Date incident *</label>
              <input type="date" value={form.dateIncident} onChange={set("dateIncident")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Date convocation</label>
              <input type="date" value={form.dateConvocation} onChange={set("dateConvocation")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {form.type === "MISE_A_PIED" && (
            <div>
              <label className="text-xs text-gray-500">Durée suspension (jours)</label>
              <input type="number" value={form.dureeSuspension} onChange={set("dureeSuspension")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" min={1} />
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500">Notes internes</label>
            <textarea value={form.notes} onChange={set("notes")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {loading ? "Ouverture…" : "Ouvrir la procédure"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── ProcRow ─────────────────────────────────────────────── */
function ProcRow({ proc, onSelect, onRefresh }: {
  proc: ProcedureDisciplinaire;
  onSelect: (p: ProcedureDisciplinaire) => void;
  onRefresh: () => void;
}) {
  const { mutate: trigger, loading } = useMutation(`/api/admin/rh/disciplinaire/${proc.id}`, "PATCH");
  const collaborateur = proc.profilRH.gestionnaire?.member
    ? `${proc.profilRH.gestionnaire.member.prenom} ${proc.profilRH.gestionnaire.member.nom}`
    : `Matricule ${proc.profilRH.matricule}`;

  async function quickAction(action: string) {
    const res = await trigger({ action });
    if (res) { toast.success("Statut mis à jour"); onRefresh(); }
    else toast.error("Erreur");
  }

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-800 text-sm">{collaborateur}</div>
        <div className="text-xs text-gray-400">{proc.profilRH.matricule}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[proc.type]}`}>
          {TYPE_LABELS[proc.type]}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
        <p className="truncate">{proc.motif}</p>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{fmt(proc.dateIncident)}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_COLORS[proc.statut]}`}>
          {STATUT_LABELS[proc.statut]}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {proc.statut === "OUVERTE" && (
            <button onClick={() => quickAction("INSTRUIRE")} disabled={loading} title="Instruire" className="px-2.5 py-1 text-xs rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200">
              Instruire
            </button>
          )}
          <button onClick={() => onSelect(proc)} className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
            Voir
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function DisciplinairePage() {
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<StatutProcedure | "">("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<ProcedureDisciplinaire | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  if (statut) params.set("statut", statut);

  const { data, loading, refetch } = useApi<ProcsResponse>(`/api/admin/rh/disciplinaire?${params}`);
  const handleRefresh = useCallback(() => refetch(), [refetch]);

  const STATS: { key: StatutProcedure; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "OUVERTE",        label: "Ouvertes",       icon: <FileWarning size={18} />, color: "text-blue-600 bg-blue-50" },
    { key: "EN_INSTRUCTION", label: "En instruction", icon: <Clock size={18} />,      color: "text-yellow-600 bg-yellow-50" },
    { key: "CLOTUREE",       label: "Clôturées",      icon: <CheckCircle2 size={18} />, color: "text-green-600 bg-green-50" },
    { key: "ANNULEE",        label: "Annulées",       icon: <Ban size={18} />,         color: "text-gray-500 bg-gray-50" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Procédures disciplinaires</h1>
            <p className="text-sm text-gray-500 mt-1">Suivi et gestion des procédures disciplinaires</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 shadow-sm"
          >
            <Plus size={16} /> Nouvelle procédure
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map(({ key, label, icon, color }) => (
            <button
              key={key}
              onClick={() => setStatut(statut === key ? "" : key)}
              className={`bg-white rounded-2xl p-4 shadow-sm border text-left transition-all ${statut === key ? "border-red-300 ring-2 ring-red-100" : "border-gray-100 hover:border-gray-200"}`}
            >
              <div className={`p-2 rounded-lg w-fit ${color}`}>{icon}</div>
              <div className="mt-2 text-2xl font-bold text-gray-800">{data?.stats?.[key] ?? 0}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher par motif, nom..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Chargement…</div>
          ) : !data?.data?.length ? (
            <div className="text-center py-12 text-gray-400">
              <Shield size={40} className="mx-auto mb-3 opacity-30" />
              <p>Aucune procédure trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Collaborateur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Motif</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date incident</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((proc) => (
                    <ProcRow key={proc.id} proc={proc} onSelect={setSelected} onRefresh={handleRefresh} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Précédent</button>
            <span className="text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
            <button disabled={page === data.meta.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Suivant</button>
          </div>
        )}
      </div>

      {showCreate && <CreateProcModal onClose={() => setShowCreate(false)} onCreated={handleRefresh} />}
      {selected && <ProcDetailModal proc={selected} onClose={() => setSelected(null)} onRefresh={handleRefresh} />}
    </div>
  );
}
