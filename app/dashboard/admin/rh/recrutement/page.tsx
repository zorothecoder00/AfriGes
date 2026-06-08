"use client";

import React, { useState, useCallback } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Briefcase, Plus, Search, Users, CheckCircle2, XCircle,
  Clock, ChevronDown, ChevronUp, UserPlus, Eye, Calendar,
  FileText, Star, Phone, Mail, ArrowRight
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */
type StatutPoste = "BROUILLON" | "OUVERT" | "POURVU" | "ANNULE";
type StatutCandidature = "RECU" | "SHORTLISTE" | "ENTRETIEN" | "OFFRE" | "ACCEPTE" | "REJETE";

interface Candidature {
  id: number;
  nomCandidat: string;
  prenomCandidat: string;
  emailCandidat: string | null;
  telephoneCandidat: string | null;
  statut: StatutCandidature;
  noteEntretien: number | null;
  dateEntretien: string | null;
  commentaire: string | null;
  cvUrl: string | null;
  lettreUrl: string | null;
  notes: string | null;
  dateCandidature: string;
}

interface PosteOuvert {
  id: number;
  reference: string;
  titre: string;
  departement: string | null;
  lieu: string | null;
  typeContrat: string | null;
  statut: StatutPoste;
  dateOuverture: string;
  dateLimite: string | null;
  salaireMini: number | null;
  salaireMaxi: number | null;
  description: string | null;
  exigences: string | null;
  nbPostes: number;
  candidatures: Candidature[];
  _count: { candidatures: number };
}

interface PostesResponse {
  data: PosteOuvert[];
  meta: { total: number; totalPages: number };
  stats: Partial<Record<StatutPoste, number>>;
}

/* ─── Helpers ────────────────────────────────────────────── */
const STATUT_POSTE_LABELS: Record<StatutPoste, string> = {
  BROUILLON: "Brouillon", OUVERT: "Ouvert", POURVU: "Pourvu", ANNULE: "Annulé",
};
const STATUT_POSTE_COLORS: Record<StatutPoste, string> = {
  BROUILLON: "bg-gray-100 text-gray-700",
  OUVERT: "bg-green-100 text-green-700",
  POURVU: "bg-blue-100 text-blue-700",
  ANNULE: "bg-red-100 text-red-700",
};

const STATUT_CAND_LABELS: Record<StatutCandidature, string> = {
  RECU: "Reçu", SHORTLISTE: "Shortlisté", ENTRETIEN: "Entretien",
  OFFRE: "Offre", ACCEPTE: "Accepté", REJETE: "Rejeté",
};
const STATUT_CAND_COLORS: Record<StatutCandidature, string> = {
  RECU: "bg-gray-100 text-gray-600",
  SHORTLISTE: "bg-yellow-100 text-yellow-700",
  ENTRETIEN: "bg-blue-100 text-blue-700",
  OFFRE: "bg-purple-100 text-purple-700",
  ACCEPTE: "bg-green-100 text-green-700",
  REJETE: "bg-red-100 text-red-700",
};

const TYPE_CONTRAT_OPTS = ["CDI", "CDD", "STAGE", "ALTERNANCE", "FREELANCE", "INTERIM"];

/* ─── StarRating ─────────────────────────────────────────── */
function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          className={`${s <= value ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} ${onChange ? "cursor-pointer" : ""}`}
          onClick={() => onChange?.(s)}
        />
      ))}
    </div>
  );
}

/* ─── CandidaturePipeline ────────────────────────────────── */
function CandidaturePipeline({ candidatures, posteId, onRefresh }: {
  candidatures: Candidature[];
  posteId: number;
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState<Candidature | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const { mutate: patchCand, loading } = useMutation(`/api/admin/rh/recrutement/candidatures/${selected?.id}`, "PATCH");
  const { mutate: addCand, loading: addLoading } = useMutation(`/api/admin/rh/recrutement/postes/${posteId}/candidatures`);

  const [addForm, setAddForm] = useState({ nomCandidat: "", prenomCandidat: "", emailCandidat: "", telephoneCandidat: "", cvUrl: "", notes: "" });
  const [editForm, setEditForm] = useState<Partial<Candidature>>({});

  async function handleAction(action: string) {
    if (!selected) return;
    const body: Record<string, unknown> = { action };
    if (action === "PLANIFIER_ENTRETIEN" && editForm.dateEntretien) body.dateEntretien = editForm.dateEntretien;
    const res = await patchCand(body);
    if (res) { toast.success("Statut mis à jour"); onRefresh(); setSelected(null); }
    else toast.error("Erreur");
  }

  async function handleSaveEdit() {
    if (!selected) return;
    const res = await patchCand(editForm);
    if (res) { toast.success("Candidature mise à jour"); onRefresh(); setSelected(null); }
    else toast.error("Erreur");
  }

  async function handleAdd() {
    if (!addForm.nomCandidat || !addForm.prenomCandidat) { toast.error("Nom et prénom requis"); return; }
    const res = await addCand(addForm);
    if (res) { toast.success("Candidature ajoutée"); onRefresh(); setShowAdd(false); setAddForm({ nomCandidat: "", prenomCandidat: "", emailCandidat: "", telephoneCandidat: "", cvUrl: "", notes: "" }); }
    else toast.error("Erreur");
  }

  const PIPELINE: StatutCandidature[] = ["RECU", "SHORTLISTE", "ENTRETIEN", "OFFRE", "ACCEPTE"];
  const rejected = candidatures.filter((c) => c.statut === "REJETE");

  return (
    <div className="mt-3 space-y-3">
      {/* Pipeline columns */}
      <div className="grid grid-cols-5 gap-2 text-xs">
        {PIPELINE.map((st) => {
          const group = candidatures.filter((c) => c.statut === st);
          return (
            <div key={st} className="bg-gray-50 rounded-lg p-2 min-h-[80px]">
              <div className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mb-2 ${STATUT_CAND_COLORS[st]}`}>
                {STATUT_CAND_LABELS[st]} ({group.length})
              </div>
              <div className="space-y-1">
                {group.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelected(c); setEditForm({ noteEntretien: c.noteEntretien ?? undefined, dateEntretien: c.dateEntretien ? c.dateEntretien.slice(0, 10) : undefined, commentaire: c.commentaire ?? undefined }); }}
                    className="w-full text-left bg-white rounded p-1.5 shadow-sm hover:shadow-md border border-gray-100 transition-shadow"
                  >
                    <div className="font-medium truncate">{c.prenomCandidat} {c.nomCandidat}</div>
                    {c.noteEntretien && <StarRating value={c.noteEntretien} />}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {rejected.length > 0 && (
        <div className="text-xs text-gray-400">{rejected.length} candidat(s) rejeté(s)</div>
      )}

      <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
        <UserPlus size={13} /> Ajouter candidature
      </button>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-4">Nouvelle candidature</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Prénom *</label>
                  <input value={addForm.prenomCandidat} onChange={(e) => setAddForm((p) => ({ ...p, prenomCandidat: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Nom *</label>
                  <input value={addForm.nomCandidat} onChange={(e) => setAddForm((p) => ({ ...p, nomCandidat: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Email</label>
                <input type="email" value={addForm.emailCandidat} onChange={(e) => setAddForm((p) => ({ ...p, emailCandidat: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Téléphone</label>
                <input value={addForm.telephoneCandidat} onChange={(e) => setAddForm((p) => ({ ...p, telephoneCandidat: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">URL CV</label>
                <input value={addForm.cvUrl} onChange={(e) => setAddForm((p) => ({ ...p, cvUrl: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs text-gray-500">Notes</label>
                <textarea value={addForm.notes} onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" rows={2} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border text-sm">Annuler</button>
              <button onClick={handleAdd} disabled={addLoading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">
                {addLoading ? "..." : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidature detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-800">{selected.prenomCandidat} {selected.nomCandidat}</h3>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${STATUT_CAND_COLORS[selected.statut]}`}>
                  {STATUT_CAND_LABELS[selected.statut]}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-2 text-sm mb-4">
              {selected.emailCandidat && <div className="flex items-center gap-2 text-gray-600"><Mail size={13} />{selected.emailCandidat}</div>}
              {selected.telephoneCandidat && <div className="flex items-center gap-2 text-gray-600"><Phone size={13} />{selected.telephoneCandidat}</div>}
              {selected.cvUrl && (
                <a href={selected.cvUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline text-xs">
                  <FileText size={12} /> Voir CV
                </a>
              )}
            </div>

            <div className="space-y-3 border-t pt-3">
              <div>
                <label className="text-xs text-gray-500">Note entretien (/5)</label>
                <div className="mt-1">
                  <StarRating value={editForm.noteEntretien ?? 0} onChange={(v) => setEditForm((p) => ({ ...p, noteEntretien: v }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Date entretien</label>
                <input type="date" value={editForm.dateEntretien ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, dateEntretien: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Commentaire</label>
                <textarea value={editForm.commentaire ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, commentaire: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" rows={2} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 border-t pt-3">
              {selected.statut === "RECU" && (
                <button onClick={() => handleAction("SHORTLISTER")} disabled={loading} className="px-3 py-1.5 text-xs rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200">
                  Shortlister
                </button>
              )}
              {(selected.statut === "RECU" || selected.statut === "SHORTLISTE") && (
                <button onClick={() => handleAction("PLANIFIER_ENTRETIEN")} disabled={loading} className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200">
                  Planifier entretien
                </button>
              )}
              {(selected.statut === "ENTRETIEN" || selected.statut === "SHORTLISTE") && (
                <button onClick={() => handleAction("FAIRE_OFFRE")} disabled={loading} className="px-3 py-1.5 text-xs rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200">
                  Faire offre
                </button>
              )}
              {selected.statut === "OFFRE" && (
                <button onClick={() => handleAction("ACCEPTER")} disabled={loading} className="px-3 py-1.5 text-xs rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
                  Accepter
                </button>
              )}
              {!["ACCEPTE", "REJETE"].includes(selected.statut) && (
                <button onClick={() => handleAction("REJETER")} disabled={loading} className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200">
                  Rejeter
                </button>
              )}
              <button onClick={handleSaveEdit} disabled={loading} className="ml-auto px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── PosteCard ──────────────────────────────────────────── */
function PosteCard({ poste, onRefresh }: { poste: PosteOuvert; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { mutate: trigger, loading } = useMutation(`/api/admin/rh/recrutement/postes/${poste.id}`, "PATCH");

  async function handleAction(action: string) {
    const res = await trigger({ action });
    if (res) { toast.success("Poste mis à jour"); onRefresh(); }
    else toast.error("Erreur");
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-400">{poste.reference}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_POSTE_COLORS[poste.statut]}`}>
                {STATUT_POSTE_LABELS[poste.statut]}
              </span>
            </div>
            <h3 className="font-semibold text-gray-800 mt-1">{poste.titre}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              {poste.departement && <span>{poste.departement}</span>}
              {poste.lieu && <span>{poste.lieu}</span>}
              {poste.typeContrat && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{poste.typeContrat}</span>}
              {poste.nbPostes > 1 && <span className="text-indigo-600">{poste.nbPostes} postes</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Users size={14} />
              <span className="font-semibold">{poste._count.candidatures}</span>
            </div>
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-gray-100">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Workflow buttons */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {poste.statut === "BROUILLON" && (
            <button onClick={() => handleAction("DEMARRER")} disabled={loading} className="px-3 py-1.5 text-xs rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
              Ouvrir poste
            </button>
          )}
          {poste.statut === "OUVERT" && (
            <button onClick={() => handleAction("MARQUER_POURVU")} disabled={loading} className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200">
              Marquer pourvu
            </button>
          )}
          {["BROUILLON", "OUVERT"].includes(poste.statut) && (
            <button onClick={() => handleAction("ANNULER")} disabled={loading} className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
              Annuler
            </button>
          )}
          {["POURVU", "ANNULE"].includes(poste.statut) && (
            <button onClick={() => handleAction("ROUVRIR")} disabled={loading} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
              Rouvrir
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4">
          {poste.description && (
            <p className="text-xs text-gray-600 mt-3 mb-2">{poste.description}</p>
          )}
          <CandidaturePipeline
            candidatures={poste.candidatures}
            posteId={poste.id}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  );
}

/* ─── CreatePosteModal ───────────────────────────────────── */
function CreatePosteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    titre: "", departement: "", lieu: "", typeContrat: "CDI",
    nbPostes: 1, dateLimite: "", salaireMini: "", salaireMaxi: "",
    description: "", exigences: "",
  });
  const { mutate: trigger, loading } = useMutation("/api/admin/rh/recrutement/postes");

  async function handleSubmit() {
    if (!form.titre) { toast.error("Titre obligatoire"); return; }
    const payload = {
      ...form,
      nbPostes: Number(form.nbPostes),
      salaireMini: form.salaireMini ? Number(form.salaireMini) : null,
      salaireMaxi: form.salaireMaxi ? Number(form.salaireMaxi) : null,
      dateLimite: form.dateLimite || null,
    };
    const res = await trigger(payload);
    if (res) { toast.success("Poste créé"); onCreated(); onClose(); }
    else toast.error("Erreur lors de la création");
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-800 mb-5">Nouveau poste</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Titre du poste *</label>
            <input value={form.titre} onChange={set("titre")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex: Développeur Backend" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Département</label>
              <input value={form.departement} onChange={set("departement")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Lieu</label>
              <input value={form.lieu} onChange={set("lieu")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Type contrat</label>
              <select value={form.typeContrat} onChange={set("typeContrat")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                {TYPE_CONTRAT_OPTS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Nb postes</label>
              <input type="number" min={1} value={form.nbPostes} onChange={set("nbPostes")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Salaire mini (FCFA)</label>
              <input type="number" value={form.salaireMini} onChange={set("salaireMini")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Salaire maxi (FCFA)</label>
              <input type="number" value={form.salaireMaxi} onChange={set("salaireMaxi")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Date limite candidature</label>
            <input type="date" value={form.dateLimite} onChange={set("dateLimite")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Description</label>
            <textarea value={form.description} onChange={set("description")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={3} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Exigences / Profil requis</label>
            <textarea value={form.exigences} onChange={set("exigences")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Création…" : "Créer le poste"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function RecrutementPage() {
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<StatutPoste | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "10" });
  if (search) params.set("search", search);
  if (statut) params.set("statut", statut);

  const { data, loading, refetch } = useApi<PostesResponse>(`/api/admin/rh/recrutement/postes?${params}`);

  const handleRefresh = useCallback(() => refetch(), [refetch]);

  const STATS: { key: StatutPoste; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "BROUILLON", label: "Brouillons", icon: <FileText size={18} />, color: "text-gray-600 bg-gray-50" },
    { key: "OUVERT",    label: "Ouverts",    icon: <Briefcase size={18} />, color: "text-green-600 bg-green-50" },
    { key: "POURVU",    label: "Pourvus",    icon: <CheckCircle2 size={18} />, color: "text-blue-600 bg-blue-50" },
    { key: "ANNULE",    label: "Annulés",    icon: <XCircle size={18} />, color: "text-red-600 bg-red-50" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recrutement</h1>
            <p className="text-sm text-gray-500 mt-1">Gestion des postes ouverts et candidatures</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm"
          >
            <Plus size={16} /> Nouveau poste
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map(({ key, label, icon, color }) => (
            <button
              key={key}
              onClick={() => setStatut(statut === key ? "" : key)}
              className={`bg-white rounded-2xl p-4 shadow-sm border transition-all text-left ${statut === key ? "border-indigo-300 ring-2 ring-indigo-100" : "border-gray-100 hover:border-gray-200"}`}
            >
              <div className={`p-2 rounded-lg w-fit ${color}`}>{icon}</div>
              <div className="mt-2 text-2xl font-bold text-gray-800">{data?.stats?.[key] ?? 0}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher un poste..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white"
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement…</div>
        ) : !data?.data?.length ? (
          <div className="text-center py-12 text-gray-400">
            <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
            <p>Aucun poste trouvé</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.data.map((poste) => (
              <PosteCard key={poste.id} poste={poste} onRefresh={handleRefresh} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Précédent</button>
            <span className="text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
            <button disabled={page === data.meta.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Suivant</button>
          </div>
        )}
      </div>

      {showCreate && <CreatePosteModal onClose={() => setShowCreate(false)} onCreated={handleRefresh} />}
    </div>
  );
}
