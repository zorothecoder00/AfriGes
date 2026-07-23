"use client";

import { useState } from "react";
import {
  RefreshCw, CheckCircle, Clock, XCircle, GraduationCap,
  X, Save, Plus, Ban, Info,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SessionDispo { id: number; titre: string; dateDebut: string; lieu: string | null }

interface Demande {
  id:               number;
  intituleSouhaite: string;
  motif:            string | null;
  statut:           string;
  commentaireRefus: string | null;
  createdAt:        string;
  formation:        { id: number; titre: string; dateDebut: string } | null;
}

interface FormationsResponse {
  profilRH:            { id: number; matricule: string } | null;
  demandes:            Demande[];
  sessionsDisponibles: SessionDispo[];
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode; etape: string }> = {
  EN_ATTENTE:     { label: "En attente",     badge: "bg-yellow-100 text-yellow-700",   icon: <Clock       className="w-3.5 h-3.5" />, etape: "En attente du manager" },
  VALIDE_MANAGER: { label: "Validé manager", badge: "bg-blue-100 text-blue-700",       icon: <CheckCircle className="w-3.5 h-3.5" />, etape: "En attente du RH" },
  VALIDE_RH:      { label: "Validé RH",      badge: "bg-indigo-100 text-indigo-700",   icon: <CheckCircle className="w-3.5 h-3.5" />, etape: "En attente de validation finale" },
  APPROUVE:       { label: "Approuvée",      badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3.5 h-3.5" />, etape: "Formation accordée" },
  REJETE:         { label: "Rejetée",        badge: "bg-red-100 text-red-700",         icon: <XCircle     className="w-3.5 h-3.5" />, etape: "Demande refusée" },
  ANNULE:         { label: "Annulée",        badge: "bg-slate-100 text-slate-500",     icon: <Ban         className="w-3.5 h-3.5" />, etape: "Annulée" },
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FormationsCollaborateurPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, loading, refetch } = useApi<FormationsResponse>("/api/collaborateur/formations");

  const profilRH = data?.profilRH ?? null;
  const demandes = data?.demandes ?? [];
  const sessions = data?.sessionsDisponibles ?? [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  if (data && profilRH === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
          <Info className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-slate-900">Aucun dossier RH</h1>
          <p className="text-sm text-slate-500 mt-2">
            Votre compte n&apos;est pas rattaché à un dossier RH. Contactez le Responsable RH
            pour pouvoir soumettre des demandes de formation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Formations</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Soumettez et suivez vos demandes {profilRH && <span className="font-mono text-slate-400">· {profilRH.matricule}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> Nouvelle demande
            </button>
          </div>
        </div>

        {/* ── Circuit de validation ── */}
        <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex-wrap">
          <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span className="font-medium">Circuit :</span>
          <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-100">Vous</span>→
          <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-100">Manager</span>→
          <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-100">RH</span>→
          <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-100">Validation finale</span>
        </div>

        {/* ── Liste des demandes ── */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Mes demandes</h2>
          {demandes.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
              <GraduationCap className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Aucune demande pour le moment</p>
              <button onClick={() => setShowCreate(true)} className="mt-3 text-xs font-medium text-emerald-600 hover:underline">
                Créer ma première demande
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {demandes.map((d) => (
                <DemandeRow key={d.id} demande={d} onRefetch={refetch} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateDemandeModal
          sessions={sessions}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }}
        />
      )}
    </div>
  );
}

// ── Ligne demande ───────────────────────────────────────────────────────────────

function DemandeRow({ demande, onRefetch }: { demande: Demande; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/collaborateur/formations/${demande.id}`, "PATCH");
  const cfg = STATUT_CONFIG[demande.statut] ?? STATUT_CONFIG.EN_ATTENTE;
  const annulable = ["EN_ATTENTE", "VALIDE_MANAGER", "VALIDE_RH"].includes(demande.statut);

  const handleAnnuler = async () => {
    if (!confirm("Annuler cette demande de formation ?")) return;
    const result = await mutate({ action: "ANNULER" });
    if (result) { toast.success("Demande annulée"); onRefetch(); }
  };

  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50">
      <span className="p-2 rounded-lg flex-shrink-0 text-blue-600 bg-blue-50">
        <GraduationCap className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-800">{demande.intituleSouhaite}</span>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
              {demande.formation && <span>Session : {demande.formation.titre} ({formatDate(demande.formation.dateDebut)})</span>}
              <span className="text-slate-400 italic">{cfg.etape}</span>
            </div>
            {demande.motif && <p className="mt-1 text-xs text-slate-500 italic">« {demande.motif} »</p>}
            {demande.commentaireRefus && (
              <p className="mt-1.5 text-xs text-red-600 italic">Motif du refus : {demande.commentaireRefus}</p>
            )}
          </div>

          {annulable && (
            <button
              onClick={handleAnnuler}
              disabled={loading}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            >
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal création ──────────────────────────────────────────────────────────────

function CreateDemandeModal({ sessions, onClose, onCreated }: {
  sessions: SessionDispo[]; onClose: () => void; onCreated: () => void;
}) {
  const { mutate, loading } = useMutation("/api/collaborateur/formations", "POST");
  const [form, setForm] = useState({ intituleSouhaite: "", formationId: "", motif: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.intituleSouhaite.trim()) { toast.error("Intitulé requis"); return; }
    const result = await mutate({
      intituleSouhaite: form.intituleSouhaite.trim(),
      formationId:      form.formationId || undefined,
      motif:            form.motif || null,
    });
    if (result) { toast.success("Demande soumise ✓"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle demande de formation</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Intitulé souhaité *">
            <input value={form.intituleSouhaite} onChange={(e) => set("intituleSouhaite", e.target.value)}
              placeholder="Ex : Excel avancé, management d'équipe…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </Field>

          {sessions.length > 0 && (
            <Field label="Session déjà planifiée (facultatif)">
              <select value={form.formationId} onChange={(e) => set("formationId", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">— Aucune / à définir —</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.titre} — {formatDate(s.dateDebut)}{s.lieu ? ` (${s.lieu})` : ""}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Motif">
            <textarea value={form.motif} onChange={(e) => set("motif", e.target.value)}
              rows={2} placeholder="Optionnel — précisez si nécessaire"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Soumettre
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers UI ──────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
