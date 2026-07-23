"use client";

import React, { useState, useCallback } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Briefcase, Plus, Search, Users, CheckCircle2, XCircle,
  Clock, ChevronDown, ChevronUp, UserPlus, FileText, Star,
  Phone, Mail, ArrowLeft, Filter, Database, Banknote,
  Award, RefreshCw, X, KeyRound, AlertCircle, ExternalLink,
  Copy, Check, Printer, Eye, Save,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format";

/* ─── Types ──────────────────────────────────────────────── */
type StatutPoste = "BROUILLON" | "OUVERT" | "EN_COURS" | "POURVU" | "ANNULE";
type StatutCandidature =
  | "RECU" | "PRE_QUALIFICATION" | "SHORTLISTE" | "ENTRETIEN"
  | "TEST" | "VALIDATION" | "OFFRE" | "INTEGRATION" | "ACCEPTE" | "REJETE";

interface Candidature {
  id: number;
  nomCandidat: string;
  prenomCandidat: string;
  email: string | null;
  telephone: string | null;
  statut: StatutCandidature;
  scoreCandidat: number | null;
  noteEntretien: number | null;
  noteTest: number | null;
  dateEntretien: string | null;
  dateTest: string | null;
  commentaire: string | null;
  cvUrl: string | null;
  lettreUrl: string | null;
  notes: string | null;
  competences: string | null;
  formation: string | null;
  experienceAnnees: number | null;
  sourceCandidat: string | null;
  dateCandidature: string;
}

interface PosteOuvert {
  id: number;
  reference: string;
  titre: string;
  departement: string | null;
  service: string | null;
  lieu: string | null;
  typeContrat: string | null;
  statut: StatutPoste;
  dateOuverture: string;
  dateLimite: string | null;
  salaireMini: number | null;
  salaireMaxi: number | null;
  budgetPoste: number | null;
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

interface ATSResponse {
  data: (Candidature & { poste: { id: number; reference: string; titre: string; departement: string | null; statut: string } })[];
  meta: { total: number; totalPages: number };
  ats: { totalCandidats: number; moyenneScore: number; parStatut: Partial<Record<StatutCandidature, number>> };
}

/* ─── Documents de recrutement ───────────────────────────── */
interface DocFieldSpec {
  name: string;
  label: string;
  type: "text" | "date" | "number" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}
interface DocTypeMeta { type: string; label: string; scope: "poste" | "candidature"; fields: DocFieldSpec[]; }
interface RecrutDoc { id: number; type: string; titre: string; version: number; contenu: string | null; notes: string | null; archive: boolean; createdAt: string; }

/* ─── Constantes ─────────────────────────────────────────── */
const STATUT_POSTE_LABELS: Record<StatutPoste, string> = {
  BROUILLON: "Brouillon", OUVERT: "Ouvert", EN_COURS: "En cours", POURVU: "Pourvu", ANNULE: "Annulé",
};
const STATUT_POSTE_COLORS: Record<StatutPoste, string> = {
  BROUILLON: "bg-gray-100 text-gray-700",
  OUVERT:    "bg-green-100 text-green-700",
  EN_COURS:  "bg-blue-100 text-blue-700",
  POURVU:    "bg-purple-100 text-purple-700",
  ANNULE:    "bg-red-100 text-red-700",
};

// Pipeline ATS — 6 étapes actives (hors ACCEPTE/REJETE)
const PIPELINE: StatutCandidature[] = [
  "RECU", "PRE_QUALIFICATION", "SHORTLISTE", "ENTRETIEN", "TEST", "VALIDATION", "OFFRE", "INTEGRATION",
];

const STATUT_CAND_LABELS: Record<StatutCandidature, string> = {
  RECU:             "Reçu",
  PRE_QUALIFICATION:"Pré-qualification",
  SHORTLISTE:       "Shortlisté",
  ENTRETIEN:        "Entretien",
  TEST:             "Test",
  VALIDATION:       "Validation",
  OFFRE:            "Offre",
  INTEGRATION:      "Intégration",
  ACCEPTE:          "Accepté",
  REJETE:           "Rejeté",
};
const STATUT_CAND_COLORS: Record<StatutCandidature, string> = {
  RECU:             "bg-gray-100 text-gray-600",
  PRE_QUALIFICATION:"bg-slate-100 text-slate-600",
  SHORTLISTE:       "bg-yellow-100 text-yellow-700",
  ENTRETIEN:        "bg-blue-100 text-blue-700",
  TEST:             "bg-indigo-100 text-indigo-700",
  VALIDATION:       "bg-orange-100 text-orange-700",
  OFFRE:            "bg-purple-100 text-purple-700",
  INTEGRATION:      "bg-teal-100 text-teal-700",
  ACCEPTE:          "bg-green-100 text-green-700",
  REJETE:           "bg-red-100 text-red-700",
};

// Transitions workflow candidature
const CAND_ACTIONS: Record<StatutCandidature, { label: string; action: string; color: string }[]> = {
  RECU:             [{ label: "Pré-qualifier", action: "PRE_QUALIFIER", color: "bg-slate-100 text-slate-700" }],
  PRE_QUALIFICATION:[{ label: "Shortlister",   action: "SHORTLISTER",  color: "bg-yellow-100 text-yellow-700" }],
  SHORTLISTE:       [{ label: "Entretien",     action: "PLANIFIER_ENTRETIEN", color: "bg-blue-100 text-blue-700" }],
  ENTRETIEN:        [{ label: "Test",          action: "ENVOYER_TEST", color: "bg-indigo-100 text-indigo-700" }],
  TEST:             [{ label: "Valider",       action: "VALIDER_CANDIDATURE", color: "bg-orange-100 text-orange-700" }],
  VALIDATION:       [{ label: "Faire offre",   action: "FAIRE_OFFRE", color: "bg-purple-100 text-purple-700" }],
  OFFRE:            [{ label: "Intégration",   action: "DEMARRER_INTEGRATION", color: "bg-teal-100 text-teal-700" }],
  INTEGRATION:      [{ label: "Accepter",      action: "ACCEPTER", color: "bg-green-100 text-green-700" }],
  ACCEPTE:          [],
  REJETE:           [],
};

const SOURCES = ["LinkedIn", "Site web", "Recommandation", "Jobboard", "Candidature spontanée", "École/Université", "Autre"];

/* ─── Helpers ─────────────────────────────────────────────── */
function fmt(n: number) { return new Intl.NumberFormat("fr-FR").format(n); }

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = score >= 75 ? "bg-green-100 text-green-700" : score >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${color}`}>{score}/100</span>;
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={13}
          className={`${s <= value ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} ${onChange ? "cursor-pointer" : ""}`}
          onClick={() => onChange?.(s)}
        />
      ))}
    </div>
  );
}

/* ─── Modal mot de passe temporaire ─────────────────────── */
function TempPasswordModal({
  tempPassword, profilRHId, onClose,
}: { tempPassword: string; profilRHId: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto bg-green-50 rounded-2xl flex items-center justify-center">
            <KeyRound size={28} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Collaborateur créé !</h2>
            <p className="text-sm text-gray-500 mt-1">Communiquer ce mot de passe temporaire au nouvel employé :</p>
          </div>
          <div className="bg-gray-900 text-green-400 font-mono text-lg px-5 py-3 rounded-xl tracking-wider select-all">
            {tempPassword}
          </div>
          <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-left">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>Ce mot de passe ne sera plus affiché. Notez-le maintenant.</span>
          </div>
          <div className="flex gap-3">
            <button onClick={copy}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border ${
                copied ? "border-green-400 text-green-700 bg-green-50" : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}>
              {copied ? <CheckCircle2 size={14} /> : null} {copied ? "Copié !" : "Copier"}
            </button>
            <a href={`/dashboard/admin/rh/collaborateurs/${profilRHId}`}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
              <ExternalLink size={14} /> Voir dossier
            </a>
          </div>
          <button onClick={onClose} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1">Fermer</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal Candidature ──────────────────────────────────── */
function CandidatureModal({
  cand, posteId: _posteId, onClose, onRefresh,
}: { cand: Candidature; posteId: number; onClose: () => void; onRefresh: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/recrutement/candidatures/${cand.id}`, "PATCH");
  const [tempPassData, setTempPassData] = useState<{ tempPassword: string; profilRHId: number } | null>(null);
  const [form, setForm] = useState({
    noteEntretien:   cand.noteEntretien   ?? 0,
    noteTest:        cand.noteTest        ?? 0,
    scoreCandidat:   cand.scoreCandidat   ?? "",
    dateEntretien:   cand.dateEntretien   ? cand.dateEntretien.slice(0, 10) : "",
    dateTest:        cand.dateTest        ? cand.dateTest.slice(0, 10)       : "",
    commentaire:     cand.commentaire     ?? "",
    competences:     cand.competences     ?? "",
    formation:       cand.formation       ?? "",
    experienceAnnees:cand.experienceAnnees ?? "",
    sourceCandidat:  cand.sourceCandidat  ?? "",
  });
  const [showDocs, setShowDocs] = useState(false);

  async function handleAction(action: string) {
    if (action === "ACCEPTER") {
      // Fetch direct pour récupérer tempPassword hors du wrapper useMutation
      try {
        const r = await fetch(`/api/admin/rh/recrutement/candidatures/${cand.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, dateEntretien: form.dateEntretien || null }),
        });
        const json = await r.json();
        if (!r.ok) { toast.error(json.error ?? "Erreur"); return; }
        toast.success(json.message ?? "Candidature acceptée");
        onRefresh();
        if (json.collaborateurCree && json.tempPassword) {
          setTempPassData({ tempPassword: json.tempPassword, profilRHId: json.profilRHId });
        } else {
          onClose();
        }
      } catch { toast.error("Erreur réseau"); }
      return;
    }
    const res = await mutate({ action, dateEntretien: form.dateEntretien || null, dateTest: form.dateTest || null });
    if (res) { toast.success("Statut mis à jour"); onRefresh(); onClose(); }
    else toast.error("Erreur");
  }

  async function handleSave() {
    const res = await mutate({
      noteEntretien:    form.noteEntretien    || null,
      noteTest:         form.noteTest         || null,
      scoreCandidat:    form.scoreCandidat !== "" ? Number(form.scoreCandidat) : null,
      dateEntretien:    form.dateEntretien    || null,
      dateTest:         form.dateTest         || null,
      commentaire:      form.commentaire      || null,
      competences:      form.competences      || null,
      formation:        form.formation        || null,
      experienceAnnees: form.experienceAnnees !== "" ? Number(form.experienceAnnees) : null,
      sourceCandidat:   form.sourceCandidat   || null,
    });
    if (res) { toast.success("Candidature mise à jour"); onRefresh(); onClose(); }
    else toast.error("Erreur");
  }

  const actions = CAND_ACTIONS[cand.statut] ?? [];

  if (tempPassData) {
    return (
      <TempPasswordModal
        tempPassword={tempPassData.tempPassword}
        profilRHId={tempPassData.profilRHId}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">{cand.prenomCandidat} {cand.nomCandidat}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUT_CAND_COLORS[cand.statut]}`}>
                {STATUT_CAND_LABELS[cand.statut]}
              </span>
              <ScoreBadge score={cand.scoreCandidat} />
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Contacts */}
        <div className="space-y-1 text-sm mb-4">
          {cand.email     && <div className="flex items-center gap-2 text-gray-600"><Mail size={13}/>{cand.email}</div>}
          {cand.telephone && <div className="flex items-center gap-2 text-gray-600"><Phone size={13}/>{cand.telephone}</div>}
          {cand.cvUrl     && <a href={cand.cvUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline text-xs"><FileText size={12}/> Voir CV</a>}
        </div>

        {/* Formulaire */}
        <div className="space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Score global (/100)</label>
              <input type="number" min={0} max={100} value={form.scoreCandidat}
                onChange={(e) => setForm((p) => ({ ...p, scoreCandidat: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Source</label>
              <select value={form.sourceCandidat} onChange={(e) => setForm((p) => ({ ...p, sourceCandidat: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm">
                <option value="">—</option>
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Note entretien (/5)</label>
              <div className="mt-1.5"><StarRating value={Number(form.noteEntretien)} onChange={(v) => setForm((p) => ({ ...p, noteEntretien: v }))} /></div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Note test (/20)</label>
              <input type="number" min={0} max={20} value={form.noteTest}
                onChange={(e) => setForm((p) => ({ ...p, noteTest: Number(e.target.value) }))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Date entretien</label>
              <input type="date" value={form.dateEntretien} onChange={(e) => setForm((p) => ({ ...p, dateEntretien: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Date test</label>
              <input type="date" value={form.dateTest} onChange={(e) => setForm((p) => ({ ...p, dateTest: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Formation</label>
            <input value={form.formation} onChange={(e) => setForm((p) => ({ ...p, formation: e.target.value }))}
              placeholder="Ex: Bac+5 Informatique" className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Compétences (tags)</label>
              <input value={form.competences} onChange={(e) => setForm((p) => ({ ...p, competences: e.target.value }))}
                placeholder="React, TypeScript, SQL…" className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Expérience (années)</label>
              <input type="number" min={0} value={form.experienceAnnees}
                onChange={(e) => setForm((p) => ({ ...p, experienceAnnees: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Commentaire</label>
            <textarea value={form.commentaire} onChange={(e) => setForm((p) => ({ ...p, commentaire: e.target.value }))}
              className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" rows={2} />
          </div>
        </div>

        {/* Actions workflow */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 border-t pt-3">
            {actions.map((a) => (
              <button key={a.action} onClick={() => handleAction(a.action)} disabled={loading}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-50 ${a.color}`}>
                {a.label}
              </button>
            ))}
            {!["ACCEPTE","REJETE"].includes(cand.statut) && (
              <button onClick={() => handleAction("REJETER")} disabled={loading}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600">
                Rejeter
              </button>
            )}
          </div>
        )}

        {/* Documents de recrutement (convocation, offre, refus, promesse) */}
        <div className="mt-3 border-t pt-3">
          <button onClick={() => setShowDocs(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 text-indigo-600 text-sm hover:bg-indigo-50">
            <FileText size={14} /> Documents
          </button>
        </div>
        {showDocs && (
          <DocGenModal scope="candidature" targetId={cand.id}
            label={`${cand.prenomCandidat} ${cand.nomCandidat}`} onClose={() => setShowDocs(false)} />
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-gray-600">Annuler</button>
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">
            {loading ? <RefreshCw size={14} className="animate-spin inline" /> : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Pipeline candidatures ──────────────────────────────── */
function CandidaturePipeline({ candidatures, posteId, onRefresh }: {
  candidatures: Candidature[]; posteId: number; onRefresh: () => void;
}) {
  const [selected, setSelected]   = useState<Candidature | null>(null);
  const [showAdd,  setShowAdd]    = useState(false);
  const { mutate: addCand, loading: addLoading } = useMutation(`/api/admin/rh/recrutement/postes/${posteId}/candidatures`);
  const [addForm, setAddForm] = useState({
    nomCandidat: "", prenomCandidat: "", email: "", telephone: "",
    cvUrl: "", formation: "", competences: "", experienceAnnees: "", sourceCandidat: "", notes: "",
  });

  async function handleAdd() {
    if (!addForm.nomCandidat || !addForm.prenomCandidat) { toast.error("Nom et prénom requis"); return; }
    const res = await addCand({
      ...addForm,
      experienceAnnees: addForm.experienceAnnees ? Number(addForm.experienceAnnees) : null,
    });
    if (res) {
      toast.success("Candidature ajoutée"); onRefresh(); setShowAdd(false);
      setAddForm({ nomCandidat: "", prenomCandidat: "", email: "", telephone: "", cvUrl: "", formation: "", competences: "", experienceAnnees: "", sourceCandidat: "", notes: "" });
    } else toast.error("Erreur");
  }

  const rejected = candidatures.filter((c) => c.statut === "REJETE");
  const accepted = candidatures.filter((c) => c.statut === "ACCEPTE");

  return (
    <div className="mt-3 space-y-3">
      {/* Pipeline kanban */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max text-xs pb-2">
          {PIPELINE.map((st) => {
            const group = candidatures.filter((c) => c.statut === st);
            return (
              <div key={st} className="bg-gray-50 rounded-lg p-2 w-32 min-h-[80px] flex-shrink-0">
                <div className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mb-2 ${STATUT_CAND_COLORS[st]}`}>
                  {STATUT_CAND_LABELS[st]} ({group.length})
                </div>
                <div className="space-y-1">
                  {group.map((c) => (
                    <button key={c.id} onClick={() => setSelected(c)}
                      className="w-full text-left bg-white rounded p-1.5 shadow-sm hover:shadow-md border border-gray-100 transition-shadow">
                      <div className="font-medium truncate">{c.prenomCandidat} {c.nomCandidat}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {c.scoreCandidat !== null && <ScoreBadge score={c.scoreCandidat} />}
                        {c.noteEntretien !== null && <StarRating value={Number(c.noteEntretien)} />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Résumé acceptés/rejetés */}
      <div className="flex gap-4 text-xs text-gray-500">
        {accepted.length > 0 && <span className="text-green-600 font-medium">{accepted.length} accepté(s)</span>}
        {rejected.length > 0 && <span className="text-red-500">{rejected.length} rejeté(s)</span>}
      </div>

      <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
        <UserPlus size={13} /> Ajouter candidature
      </button>

      {/* Modal ajout */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Email</label>
                  <input type="email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Téléphone</label>
                  <input value={addForm.telephone} onChange={(e) => setAddForm((p) => ({ ...p, telephone: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Formation</label>
                <input value={addForm.formation} onChange={(e) => setAddForm((p) => ({ ...p, formation: e.target.value }))} placeholder="Ex: Bac+5 Informatique" className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Compétences</label>
                  <input value={addForm.competences} onChange={(e) => setAddForm((p) => ({ ...p, competences: e.target.value }))} placeholder="React, SQL…" className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Expérience (ans)</label>
                  <input type="number" min={0} value={addForm.experienceAnnees} onChange={(e) => setAddForm((p) => ({ ...p, experienceAnnees: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Source</label>
                  <select value={addForm.sourceCandidat} onChange={(e) => setAddForm((p) => ({ ...p, sourceCandidat: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm">
                    <option value="">—</option>
                    {SOURCES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">URL CV</label>
                  <input value={addForm.cvUrl} onChange={(e) => setAddForm((p) => ({ ...p, cvUrl: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="https://…" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Notes</label>
                <textarea value={addForm.notes} onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" rows={2} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border text-sm">Annuler</button>
              <button onClick={handleAdd} disabled={addLoading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">
                {addLoading ? "…" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <CandidatureModal cand={selected} posteId={posteId} onClose={() => setSelected(null)} onRefresh={onRefresh} />
      )}
    </div>
  );
}

/* ─── Bouton copie lien public ───────────────────────────── */
function CopyLinkButton({ posteId }: { posteId: number }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const url = `${window.location.origin}/postes/${posteId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} title="Copier le lien de candidature"
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
        copied
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Lien copié !" : "Lien candidature"}
    </button>
  );
}

/* ─── DocGenModal : génération de documents de recrutement ─── */
function DocGenModal({
  scope, targetId, label, onClose,
}: { scope: "poste" | "candidature"; targetId: number; label: string; onClose: () => void }) {
  const key = scope === "poste" ? "posteId" : "candidatureId";
  const { data: typesRes } = useApi<{ data: DocTypeMeta[] }>("/api/admin/rh/recrutement/documents/types");
  const { data: docsRes, refetch } = useApi<{ data: RecrutDoc[] }>(`/api/admin/rh/recrutement/documents?${key}=${targetId}`);
  const { mutate, loading } = useMutation("/api/admin/rh/recrutement/documents/generer", "POST");

  const types = (typesRes?.data ?? []).filter((t) => t.scope === scope);
  const docs  = docsRes?.data ?? [];

  const [docType, setDocType]         = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [notes, setNotes]             = useState("");
  const [preview, setPreview]         = useState<RecrutDoc | null>(null);

  const currentFields = types.find((t) => t.type === docType)?.fields ?? [];
  const selectType = (t: string) => { setDocType(t); setFieldValues({}); };
  const setField   = (n: string, v: string) => setFieldValues((f) => ({ ...f, [n]: v }));

  async function generate() {
    if (!docType) { toast.error("Choisissez un type de document"); return; }
    const missing = currentFields.find((f) => f.required && !(fieldValues[f.name] ?? "").trim());
    if (missing) { toast.error(`Champ requis : ${missing.label}`); return; }
    const payload = Object.fromEntries(Object.entries(fieldValues).filter(([, v]) => v.trim() !== ""));
    const res = await mutate({ type: docType, notes: notes || null, [key]: targetId, ...payload });
    if (res) { toast.success("Document généré"); setDocType(""); setFieldValues({}); setNotes(""); refetch(); }
  }

  function printDoc(d: RecrutDoc) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${d.titre}</title><style>@media print{body{margin:0}}</style></head><body>${d.contenu ?? ""}</body></html>`);
    win.document.close(); win.print();
  }

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-800 truncate">Documents — {label}</h3>
              <p className="text-xs text-slate-400">{scope === "poste" ? "Poste" : "Candidature"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Génération */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Générer un document</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {types.map((t) => (
                <button key={t.type} onClick={() => selectType(t.type)}
                  className={`px-3 py-2 rounded-lg border text-left text-sm transition-all ${docType === t.type ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300" : "border-slate-200 hover:border-slate-300 bg-slate-50"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {docType && (
              <div className="space-y-3 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                {currentFields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentFields.map((f) => (
                      <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{f.required ? `${f.label} *` : f.label}</label>
                        {f.type === "textarea" ? (
                          <textarea rows={2} value={fieldValues[f.name] ?? ""} onChange={(e) => setField(f.name, e.target.value)} placeholder={f.placeholder} className={`${inputCls} resize-none`} />
                        ) : f.type === "select" ? (
                          <select value={fieldValues[f.name] ?? ""} onChange={(e) => setField(f.name, e.target.value)} className={`${inputCls} bg-white`}>
                            <option value="">—</option>
                            {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"} value={fieldValues[f.name] ?? ""} onChange={(e) => setField(f.name, e.target.value)} placeholder={f.placeholder} className={inputCls} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes internes (optionnel)</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
                </div>
                <button onClick={generate} disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {loading ? <><RefreshCw size={14} className="animate-spin" /> Génération…</> : <>Générer le document</>}
                </button>
              </div>
            )}
          </div>

          {/* Documents existants */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Documents générés ({docs.length})</p>
            {docs.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Aucun document pour le moment.</p>
            ) : docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 border border-slate-100 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{d.titre}</p>
                  <p className="text-xs text-slate-400">v{d.version} · {formatDate(d.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setPreview(d)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg" title="Aperçu"><Eye size={14} /></button>
                  <button onClick={() => printDoc(d)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg" title="Imprimer"><Printer size={14} /></button>
                  <a href={`/api/admin/rh/recrutement/documents/${d.id}/pdf`} target="_blank" rel="noreferrer" className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="PDF"><ExternalLink size={14} /></a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Aperçu */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-semibold text-slate-700 truncate">{preview.titre}</h3>
              <div className="flex items-center gap-2">
                <a href={`/api/admin/rh/recrutement/documents/${preview.id}/pdf`} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">PDF</a>
                <button onClick={() => setPreview(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-500" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" dangerouslySetInnerHTML={{ __html: preview.contenu ?? "" }} />
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
  const [showDocs, setShowDocs] = useState(false);
  const { mutate, loading } = useMutation(`/api/admin/rh/recrutement/postes/${poste.id}`, "PATCH");

  async function handleAction(action: string) {
    const res = await mutate({ action });
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
              {poste.nbPostes > 1 && <span className="text-xs text-indigo-600">{poste.nbPostes} postes</span>}
            </div>
            <h3 className="font-semibold text-gray-800 mt-1">{poste.titre}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              {poste.departement && <span>{poste.departement}</span>}
              {poste.lieu        && <span>{poste.lieu}</span>}
              {poste.typeContrat && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{poste.typeContrat}</span>}
              {poste.dateLimite  && <span className="text-amber-600">Limite : {formatDate(poste.dateLimite)}</span>}
            </div>
            {/* Fourchette salariale + budget */}
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
              {(poste.salaireMini || poste.salaireMaxi) && (
                <span className="flex items-center gap-1">
                  <Banknote size={11} />
                  {poste.salaireMini ? `${fmt(poste.salaireMini)}` : "?"} — {poste.salaireMaxi ? `${fmt(poste.salaireMaxi)} FCFA` : "?"}
                </span>
              )}
              {poste.budgetPoste && (
                <span className="text-emerald-600 font-medium">Budget : {fmt(poste.budgetPoste)} FCFA</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Users size={14} />
              <span className="font-semibold">{poste._count.candidatures}</span>
            </div>
            {["OUVERT", "EN_COURS"].includes(poste.statut) && (
              <CopyLinkButton posteId={poste.id} />
            )}
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-gray-100">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Actions workflow poste */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => setShowDocs(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1">
            <FileText size={12} /> Documents
          </button>
          {poste.statut === "BROUILLON" && (
            <button onClick={() => handleAction("VALIDER_INTERNE")} disabled={loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200">
              Valider &amp; Publier
            </button>
          )}
          {poste.statut === "OUVERT" && (
            <button onClick={() => handleAction("DEMARRER")} disabled={loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
              Démarrer recrutement
            </button>
          )}
          {poste.statut === "EN_COURS" && (
            <button onClick={() => handleAction("MARQUER_POURVU")} disabled={loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
              Marquer pourvu
            </button>
          )}
          {["BROUILLON","OUVERT","EN_COURS"].includes(poste.statut) && (
            <button onClick={() => handleAction("ANNULER")} disabled={loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
              Annuler
            </button>
          )}
          {["POURVU","ANNULE"].includes(poste.statut) && (
            <button onClick={() => handleAction("ROUVRIR")} disabled={loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
              Rouvrir
            </button>
          )}
        </div>

        {showDocs && (
          <DocGenModal scope="poste" targetId={poste.id} label={poste.titre} onClose={() => setShowDocs(false)} />
        )}
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4">
          {poste.description && <p className="text-xs text-gray-600 mt-3 mb-1">{poste.description}</p>}
          {poste.exigences   && <p className="text-xs text-gray-500 italic mb-2">Exigences : {poste.exigences}</p>}
          <CandidaturePipeline candidatures={poste.candidatures} posteId={poste.id} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  );
}

/* ─── Onglet Base CV (ATS) ───────────────────────────────── */
function BaseCVTab() {
  const [search, setSearch]   = useState("");
  const [statut, setStatut]   = useState<StatutCandidature | "">("");
  const [source, setSource]   = useState("");
  const [scoreMin, setScoreMin] = useState("");

  const params = new URLSearchParams({ limit: "20" });
  if (search)   params.set("search",  search);
  if (statut)   params.set("statut",  statut);
  if (source)   params.set("sourceCandidat", source);
  if (scoreMin) params.set("scoreMin", scoreMin);

  const { data, loading } = useApi<ATSResponse>(`/api/admin/rh/recrutement/candidatures?${params}`);

  return (
    <div className="space-y-4">
      {/* Stats ATS */}
      {data?.ats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{data.ats.totalCandidats}</div>
            <div className="text-xs text-gray-500">Total candidats</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{Math.round(Number(data.ats.moyenneScore))}/100</div>
            <div className="text-xs text-gray-500">Score moyen</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{data.ats.parStatut?.ACCEPTE ?? 0}</div>
            <div className="text-xs text-gray-500">Recrutés</div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, compétences, formation…"
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm" />
        </div>
        <select value={statut} onChange={(e) => setStatut(e.target.value as StatutCandidature | "")}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
          <option value="">Tous statuts</option>
          {(Object.keys(STATUT_CAND_LABELS) as StatutCandidature[]).map((s) => (
            <option key={s} value={s}>{STATUT_CAND_LABELS[s]}</option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
          <option value="">Toutes sources</option>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="relative">
          <Award size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="number" min={0} max={100} value={scoreMin} onChange={(e) => setScoreMin(e.target.value)}
            placeholder="Score min" className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-32" />
        </div>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : !data?.data?.length ? (
        <div className="text-center py-12 text-gray-400">
          <Database size={36} className="mx-auto mb-2 opacity-30" />
          <p>Aucun candidat trouvé</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-gray-500">
                <th className="text-left px-4 py-3">Candidat</th>
                <th className="text-left px-4 py-3">Poste</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Score</th>
                <th className="text-left px-4 py-3">Compétences</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-left px-4 py-3">Candidature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.data.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{c.prenomCandidat} {c.nomCandidat}</div>
                    {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                    {c.formation && <div className="text-xs text-indigo-500">{c.formation}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-mono text-gray-400">{c.poste.reference}</div>
                    <div className="text-xs text-gray-700">{c.poste.titre}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUT_CAND_COLORS[c.statut]}`}>
                      {STATUT_CAND_LABELS[c.statut]}
                    </span>
                  </td>
                  <td className="px-4 py-3"><ScoreBadge score={c.scoreCandidat} /></td>
                  <td className="px-4 py-3">
                    {c.competences ? (
                      <div className="flex flex-wrap gap-1">
                        {c.competences.split(",").slice(0, 3).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs">{t.trim()}</span>
                        ))}
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.sourceCandidat ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(c.dateCandidature)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Modal création poste ───────────────────────────────── */
function CreatePosteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    titre: "", departement: "", service: "", lieu: "", typeContrat: "CDI",
    nbPostes: "1", dateLimite: "", salaireMini: "", salaireMaxi: "", budgetPoste: "",
    description: "", exigences: "", experienceMin: "", planRecrutementId: "",
  });
  const { mutate, loading } = useMutation("/api/admin/rh/recrutement/postes");
  const { data: plansRes } = useApi<{ data: PlanRecrutement[] }>("/api/admin/rh/recrutement/plans");
  const plans = plansRes?.data ?? [];

  async function handleSubmit() {
    if (!form.titre) { toast.error("Titre obligatoire"); return; }
    const res = await mutate({
      ...form,
      nbPostes:     Number(form.nbPostes)   || 1,
      salaireMini:  form.salaireMini  ? Number(form.salaireMini)  : null,
      salaireMaxi:  form.salaireMaxi  ? Number(form.salaireMaxi)  : null,
      budgetPoste:  form.budgetPoste  ? Number(form.budgetPoste)  : null,
      experienceMin:form.experienceMin? Number(form.experienceMin): null,
      dateLimite:   form.dateLimite   || null,
      typeContrat:  form.typeContrat  || null,
    });
    if (res) { toast.success("Poste créé (Brouillon)"); onCreated(); onClose(); }
    else toast.error("Erreur lors de la création");
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-800 mb-5">Nouveau poste <span className="text-xs text-gray-400 font-normal ml-2">(créé en brouillon)</span></h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Titre du poste *</label>
            <input value={form.titre} onChange={set("titre")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex: Développeur Backend" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Département</label><input value={form.departement} onChange={set("departement")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500">Service</label><input value={form.service} onChange={set("service")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Lieu</label><input value={form.lieu} onChange={set("lieu")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div>
              <label className="text-xs text-gray-500">Type contrat</label>
              <select value={form.typeContrat} onChange={set("typeContrat")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                {["CDI","CDD","STAGE","ALTERNANCE","FREELANCE","INTERIM","PRESTATAIRE"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Nb postes</label><input type="number" min={1} value={form.nbPostes} onChange={set("nbPostes")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500">Expérience min (ans)</label><input type="number" min={0} value={form.experienceMin} onChange={set("experienceMin")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500">Date limite</label><input type="date" value={form.dateLimite} onChange={set("dateLimite")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Salaire mini (FCFA)</label><input type="number" value={form.salaireMini} onChange={set("salaireMini")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500">Salaire maxi (FCFA)</label><input type="number" value={form.salaireMaxi} onChange={set("salaireMaxi")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500">Budget recrutement</label><input type="number" value={form.budgetPoste} onChange={set("budgetPoste")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          {plans.length > 0 && (
            <div>
              <label className="text-xs text-gray-500">Plan de recrutement annuel (facultatif)</label>
              <select value={form.planRecrutementId} onChange={set("planRecrutementId")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">— Aucun —</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.annee}</option>)}
              </select>
            </div>
          )}
          <div><label className="text-xs text-gray-500">Description</label><textarea value={form.description} onChange={set("description")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={3} /></div>
          <div><label className="text-xs text-gray-500">Profil requis / Exigences</label><textarea value={form.exigences} onChange={set("exigences")} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-gray-600">Annuler</button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">
            {loading ? "Création…" : "Créer le poste"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────── */
export default function RecrutementPage() {
  const [activeTab, setActiveTab] = useState<"postes" | "ats" | "plan">("postes");
  const [search, setSearch]       = useState("");
  const [statut, setStatut]       = useState<StatutPoste | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage]           = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "10" });
  if (search) params.set("search", search);
  if (statut) params.set("statut", statut);

  const { data, loading, refetch } = useApi<PostesResponse>(`/api/admin/rh/recrutement/postes?${params}`);
  const handleRefresh = useCallback(() => refetch(), [refetch]);

  const STATS: { key: StatutPoste; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "BROUILLON", label: "Brouillons", icon: <FileText size={18} />,     color: "text-gray-600 bg-gray-50" },
    { key: "OUVERT",    label: "Ouverts",    icon: <Briefcase size={18} />,    color: "text-green-600 bg-green-50" },
    { key: "EN_COURS",  label: "En cours",   icon: <Clock size={18} />,        color: "text-blue-600 bg-blue-50" },
    { key: "POURVU",    label: "Pourvus",    icon: <CheckCircle2 size={18} />, color: "text-purple-600 bg-purple-50" },
    { key: "ANNULE",    label: "Annulés",    icon: <XCircle size={18} />,      color: "text-red-600 bg-red-50" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Recrutement</h1>
            <p className="text-sm text-gray-500 mt-1">Gestion des postes et ATS</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm">
            <Plus size={16} /> Nouveau poste
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {STATS.map(({ key, label, icon, color }) => (
            <button key={key} onClick={() => { setStatut(statut === key ? "" : key); setActiveTab("postes"); }}
              className={`bg-white rounded-2xl p-3 shadow-sm border text-left transition-all ${statut === key ? "border-indigo-300 ring-2 ring-indigo-100" : "border-gray-100 hover:border-gray-200"}`}>
              <div className={`p-2 rounded-lg w-fit ${color}`}>{icon}</div>
              <div className="mt-2 text-xl font-bold text-gray-800">{data?.stats?.[key] ?? 0}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </button>
          ))}
        </div>

        {/* Onglets */}
        <div className="flex gap-1 border-b border-gray-200">
          {([["postes","Postes & Pipeline",<Briefcase key="b" size={14} />],["ats","Base CV / ATS",<Database key="d" size={14} />],["plan","Plan annuel",<FileText key="p" size={14} />]] as const).map(([id, label, icon]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {activeTab === "postes" ? (
          <>
            {/* Filtres */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Rechercher un poste…"
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white" />
              </div>
              <button onClick={() => { setSearch(""); setStatut(""); }}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                <Filter size={14} /> Réinitialiser
              </button>
            </div>

            {/* Liste postes */}
            {loading ? (
              <div className="text-center py-12 text-gray-400 flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin" /> Chargement…
              </div>
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
                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40">Précédent</button>
                <span className="text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
                <button disabled={page === data.meta.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40">Suivant</button>
              </div>
            )}
          </>
        ) : activeTab === "ats" ? (
          <BaseCVTab />
        ) : (
          <PlanRecrutementTab />
        )}
      </div>

      {showCreate && <CreatePosteModal onClose={() => setShowCreate(false)} onCreated={handleRefresh} />}
    </div>
  );
}

/* ─── Onglet Plan de recrutement annuel ──────────────────── */
interface PlanRecrutement {
  id:            number;
  annee:         number;
  budgetTotal:   number | null;
  effectifCible: number | null;
  notes:         string | null;
  statut:        string;
  budgetEngage:  number;
  effectifPrevu: number;
  postes:        { id: number; titre: string; budgetPoste: number | null; nbPostes: number; statut: string }[];
}

function PlanRecrutementTab() {
  const { data, loading, refetch } = useApi<{ data: PlanRecrutement[] }>("/api/admin/rh/recrutement/plans");
  const [showNew, setShowNew] = useState(false);
  const plans = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
          <Plus size={16} /> Nouveau plan annuel
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 flex items-center justify-center gap-2">
          <RefreshCw size={16} className="animate-spin" /> Chargement…
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucun plan de recrutement annuel</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((p) => {
            const pct = p.budgetTotal ? Math.min(100, Math.round((p.budgetEngage / Number(p.budgetTotal)) * 100)) : null;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">{p.annee}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.statut === "CLOTURE" ? "bg-gray-100 text-gray-500" : p.statut === "VALIDE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}>{p.statut === "BROUILLON" ? "Brouillon" : p.statut === "VALIDE" ? "Validé" : "Clôturé"}</span>
                </div>
                {p.effectifCible != null && (
                  <p className="text-xs text-gray-500">Effectif prévu : <strong className="text-gray-700">{p.effectifPrevu}</strong> / {p.effectifCible} poste(s)</p>
                )}
                {p.budgetTotal != null && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Budget engagé</span>
                      <span>{new Intl.NumberFormat("fr-FR").format(p.budgetEngage)} / {new Intl.NumberFormat("fr-FR").format(Number(p.budgetTotal))} FCFA</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct != null && pct > 100 ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400">{p.postes.length} poste{p.postes.length > 1 ? "s" : ""} rattaché{p.postes.length > 1 ? "s" : ""}</p>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewPlanRecrutementModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); refetch(); }} />}
    </div>
  );
}

function NewPlanRecrutementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/recrutement/plans", "POST");
  const [form, setForm] = useState({ annee: String(new Date().getFullYear() + 1), budgetTotal: "", effectifCible: "", notes: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.annee) { toast.error("Année requise"); return; }
    const result = await mutate({
      annee:         Number(form.annee),
      budgetTotal:   form.budgetTotal   || undefined,
      effectifCible: form.effectifCible || undefined,
      notes:         form.notes         || undefined,
    });
    if (result) { toast.success("Plan de recrutement créé"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Nouveau plan de recrutement annuel</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Année *</label>
            <input type="number" value={form.annee} onChange={(e) => set("annee", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Budget total (FCFA)</label>
            <input type="number" value={form.budgetTotal} onChange={(e) => set("budgetTotal", e.target.value)}
              placeholder="ex : 10000000"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Effectif cible</label>
            <input type="number" value={form.effectifCible} onChange={(e) => set("effectifCible", e.target.value)}
              placeholder="ex : 15"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}
