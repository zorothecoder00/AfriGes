"use client";

import React, { useState, useCallback } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Plus, Search, CheckCircle2, Clock,
  Shield, FileWarning, Ban,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import KpiCard from "@/components/ui/KpiCard";
import Pagination from "@/components/ui/Pagination";

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
const TYPE_VARIANTS: Record<TypeSanction, BadgeVariant> = {
  AVERTISSEMENT: "warning",
  BLAME: "warning",
  MISE_A_PIED: "error",
  RETROGRADATION: "purple",
  LICENCIEMENT: "error",
  AUTRE: "neutral",
};
const STATUT_LABELS: Record<StatutProcedure, string> = {
  OUVERTE: "Ouverte",
  EN_INSTRUCTION: "En instruction",
  CLOTUREE: "Clôturée",
  ANNULEE: "Annulée",
};
const STATUT_VARIANTS: Record<StatutProcedure, BadgeVariant> = {
  OUVERTE: "info",
  EN_INSTRUCTION: "warning",
  CLOTUREE: "success",
  ANNULEE: "neutral",
};

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const inputCls = "mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500";

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
    <Modal open onClose={onClose} size="lg">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={TYPE_VARIANTS[proc.type]}>{TYPE_LABELS[proc.type]}</Badge>
              <Badge variant={STATUT_VARIANTS[proc.statut]}>{STATUT_LABELS[proc.statut]}</Badge>
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-1">{collaborateur}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Matricule {proc.profilRH.matricule} · Procédure du {fmt(proc.dateProcedure)}</p>
          </div>
          {proc.statut !== "CLOTUREE" && proc.statut !== "ANNULEE" && (
            <Button size="sm" variant={editMode ? "secondary" : "ghost"} onClick={() => setEditMode(!editMode)} className="border border-slate-200 dark:border-slate-700">
              {editMode ? "Mode lecture" : "Modifier"}
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Motif</span>
            <span className="text-slate-800 dark:text-slate-100 font-medium">{proc.motif}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Date incident</span>
            <span className="text-slate-800 dark:text-slate-100">{fmt(proc.dateIncident)}</span>
          </div>
        </div>

        {editMode ? (
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Faits reprochés</label>
              <textarea value={form.faitsReproches} onChange={(e) => setForm((p) => ({ ...p, faitsReproches: e.target.value }))} className={inputCls} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date de convocation" type="date" value={form.dateConvocation} onChange={(e) => setForm((p) => ({ ...p, dateConvocation: e.target.value }))} />
              {proc.type === "MISE_A_PIED" && (
                <Input label="Durée suspension (jours)" type="number" value={form.dureeSuspension} onChange={(e) => setForm((p) => ({ ...p, dureeSuspension: e.target.value }))} />
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Réponse du collaborateur</label>
              <textarea value={form.reponseCollab} onChange={(e) => setForm((p) => ({ ...p, reponseCollab: e.target.value }))} className={inputCls} rows={2} />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Décision</label>
              <textarea value={form.decision} onChange={(e) => setForm((p) => ({ ...p, decision: e.target.value }))} className={inputCls} rows={2} />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Notes internes</label>
              <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={inputCls} rows={2} />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={loading} loading={loading}>Enregistrer</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4 text-sm">
            {proc.faitsReproches && (
              <div><span className="text-xs text-slate-500 dark:text-slate-400 block">Faits reprochés</span><p className="text-slate-800 dark:text-slate-100 mt-0.5">{proc.faitsReproches}</p></div>
            )}
            {proc.dateConvocation && (
              <div><span className="text-xs text-slate-500 dark:text-slate-400 block">Convocation</span><p className="text-slate-800 dark:text-slate-100">{fmt(proc.dateConvocation)}</p></div>
            )}
            {proc.reponseCollab && (
              <div><span className="text-xs text-slate-500 dark:text-slate-400 block">Réponse collaborateur</span><p className="text-slate-800 dark:text-slate-100 mt-0.5">{proc.reponseCollab}</p></div>
            )}
            {proc.decision && (
              <div><span className="text-xs text-slate-500 dark:text-slate-400 block">Décision</span><p className="text-slate-800 dark:text-slate-100 font-medium mt-0.5">{proc.decision}</p></div>
            )}
            {proc.dureeSuspension && (
              <div><span className="text-xs text-slate-500 dark:text-slate-400 block">Durée suspension</span><p className="text-slate-800 dark:text-slate-100">{proc.dureeSuspension} jour(s)</p></div>
            )}
            {proc.notes && (
              <div><span className="text-xs text-slate-500 dark:text-slate-400 block">Notes</span><p className="text-slate-600 dark:text-slate-300 italic mt-0.5">{proc.notes}</p></div>
            )}
          </div>
        )}

        {/* Workflow */}
        {(proc.statut === "OUVERTE" || proc.statut === "EN_INSTRUCTION") && (
          <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-4 space-y-3">
            {proc.statut === "OUVERTE" && (
              <Button variant="secondary" onClick={() => handleAction("INSTRUIRE")} disabled={loading} className="w-full justify-center !bg-amber-100 dark:!bg-amber-900/30 !text-amber-700 dark:!text-amber-300 !border-amber-200 dark:!border-amber-800">
                Mettre en instruction
              </Button>
            )}
            <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">Décision de clôture</label>
              <textarea value={clotureDecision} onChange={(e) => setClotureDecision(e.target.value)} className={inputCls} rows={2} placeholder="Saisir la décision finale..." />
              <Button variant="success" onClick={() => handleAction("CLOTURER")} disabled={loading} className="w-full justify-center">
                Clôturer la procédure
              </Button>
            </div>
            <Button variant="danger" onClick={() => handleAction("ANNULER")} disabled={loading} className="w-full justify-center">
              Annuler la procédure
            </Button>
          </div>
        )}
    </Modal>
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
    <Modal open onClose={onClose} title="Ouvrir une procédure disciplinaire" size="md">
        <div className="space-y-3">
          {/* Collaborateur */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Collaborateur *</label>
            <div className="relative mt-1">
              <input
                value={selectedCollab ? `${selectedCollab.prenom} ${selectedCollab.nom} (${selectedCollab.matricule})` : collabSearch}
                onChange={(e) => { setCollabSearch(e.target.value); setSelectedCollab(null); setForm((p) => ({ ...p, profilRHId: "" })); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Rechercher un collaborateur..."
                className={inputCls}
              />
              {showDropdown && collabOptions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {collabOptions.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                      onClick={() => { setSelectedCollab(c); setForm((p) => ({ ...p, profilRHId: String(c.id) })); setShowDropdown(false); }}
                    >
                      {c.prenom} {c.nom} <span className="text-slate-400 dark:text-slate-500 text-xs">({c.matricule})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Type de sanction *</label>
            <select value={form.type} onChange={set("type")} className={inputCls}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <Input label="Motif *" value={form.motif} onChange={set("motif")} placeholder="Motif succinct" />

          {/* Faits */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Faits reprochés</label>
            <textarea value={form.faitsReproches} onChange={set("faitsReproches")} className={inputCls} rows={3} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date incident *" type="date" value={form.dateIncident} onChange={set("dateIncident")} />
            <Input label="Date convocation" type="date" value={form.dateConvocation} onChange={set("dateConvocation")} />
          </div>

          {form.type === "MISE_A_PIED" && (
            <Input label="Durée suspension (jours)" type="number" value={form.dureeSuspension} onChange={set("dureeSuspension")} min={1} />
          )}

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Notes internes</label>
            <textarea value={form.notes} onChange={set("notes")} className={inputCls} rows={2} />
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="danger" onClick={handleSubmit} disabled={loading} loading={loading}>
            Ouvrir la procédure
          </Button>
        </div>
    </Modal>
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
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">{collaborateur}</div>
        <div className="text-xs text-slate-400 dark:text-slate-500">{proc.profilRH.matricule}</div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={TYPE_VARIANTS[proc.type]}>{TYPE_LABELS[proc.type]}</Badge>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 max-w-xs">
        <p className="truncate">{proc.motif}</p>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{fmt(proc.dateIncident)}</td>
      <td className="px-4 py-3">
        <Badge variant={STATUT_VARIANTS[proc.statut]}>{STATUT_LABELS[proc.statut]}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {proc.statut === "OUVERTE" && (
            <Button size="sm" variant="secondary" onClick={() => quickAction("INSTRUIRE")} disabled={loading} title="Instruire" className="!bg-amber-100 dark:!bg-amber-900/30 !text-amber-700 dark:!text-amber-300 !border-amber-200 dark:!border-amber-800">
              Instruire
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onSelect(proc)} className="border border-slate-200 dark:border-slate-700">
            Voir
          </Button>
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

  const STATS: { key: StatutProcedure; label: string; icon: React.ReactNode; accent: "primary" | "warning" | "success" | "neutral" }[] = [
    { key: "OUVERTE",        label: "Ouvertes",       icon: <FileWarning size={18} />, accent: "primary" },
    { key: "EN_INSTRUCTION", label: "En instruction", icon: <Clock size={18} />,       accent: "warning" },
    { key: "CLOTUREE",       label: "Clôturées",      icon: <CheckCircle2 size={18} />, accent: "success" },
    { key: "ANNULEE",        label: "Annulées",       icon: <Ban size={18} />,          accent: "neutral" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Procédures disciplinaires</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Suivi et gestion des procédures disciplinaires</p>
          </div>
          <Button variant="danger" onClick={() => setShowCreate(true)} icon={<Plus size={16} />}>
            Nouvelle procédure
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map(({ key, label, icon, accent }) => (
            <button key={key} onClick={() => setStatut(statut === key ? "" : key)} className="text-left">
              <KpiCard
                label={label}
                value={data?.stats?.[key] ?? 0}
                icon={icon}
                accent={accent}
                className={statut === key ? "border-red-300 dark:border-red-700 ring-2 ring-red-100 dark:ring-red-900/40" : ""}
              />
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="max-w-md">
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher par motif, nom..."
            icon={<Search size={15} />}
          />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">Chargement…</div>
          ) : !data?.data?.length ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Shield size={40} className="mx-auto mb-3 opacity-30" />
              <p>Aucune procédure trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Collaborateur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Motif</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Date incident</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
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
        {data && (
          <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} itemLabel="procédure(s)" />
        )}

      {showCreate && <CreateProcModal onClose={() => setShowCreate(false)} onCreated={handleRefresh} />}
      {selected && <ProcDetailModal proc={selected} onClose={() => setSelected(null)} onRefresh={handleRefresh} />}
    </div>
  );
}
