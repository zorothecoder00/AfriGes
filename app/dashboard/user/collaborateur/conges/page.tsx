"use client";

import { useState, useMemo } from "react";
import {
  RefreshCw, CheckCircle, Clock, XCircle, CalendarDays,
  X, Save, Plus, Ban, Info, Plane, HeartPulse, GraduationCap, Sun, Sparkles,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Solde {
  type: string; annee: number;
  totalDroit: number; pris: number; restant: number; reporte: number;
}

interface Demande {
  id:               number;
  type:             string;
  statut:           string;
  dateDebut:        string;
  dateFin:          string;
  nbJours:          number;
  motif:            string | null;
  commentaireRefus: string | null;
  createdAt:        string;
}

interface CongesResponse {
  profilRH: { id: number; matricule: string } | null;
  soldes:   Solde[];
  demandes: Demande[];
  annee:    number;
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode; etape: string }> = {
  EN_ATTENTE:     { label: "En attente",     badge: "bg-yellow-100 text-yellow-700",   icon: <Clock       className="w-3.5 h-3.5" />, etape: "En attente du manager" },
  VALIDE_MANAGER: { label: "Validé manager", badge: "bg-blue-100 text-blue-700",       icon: <CheckCircle className="w-3.5 h-3.5" />, etape: "En attente du RH" },
  VALIDE_RH:      { label: "Validé RH",      badge: "bg-indigo-100 text-indigo-700",   icon: <CheckCircle className="w-3.5 h-3.5" />, etape: "En attente de validation finale" },
  APPROUVE:       { label: "Approuvé",       badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3.5 h-3.5" />, etape: "Congé accordé" },
  REJETE:         { label: "Rejeté",         badge: "bg-red-100 text-red-700",         icon: <XCircle     className="w-3.5 h-3.5" />, etape: "Demande refusée" },
  ANNULE:         { label: "Annulé",         badge: "bg-slate-100 text-slate-500",     icon: <Ban         className="w-3.5 h-3.5" />, etape: "Annulée" },
};

const TYPE_CONGE: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ANNUEL:       { label: "Congé annuel",       icon: <Plane        className="w-4 h-4" />, color: "text-emerald-600 bg-emerald-50" },
  MALADIE:      { label: "Congé maladie",      icon: <HeartPulse   className="w-4 h-4" />, color: "text-red-600 bg-red-50" },
  EXCEPTIONNEL: { label: "Congé exceptionnel", icon: <Sparkles     className="w-4 h-4" />, color: "text-purple-600 bg-purple-50" },
  PERMISSION:   { label: "Permission",         icon: <Sun          className="w-4 h-4" />, color: "text-amber-600 bg-amber-50" },
  FORMATION:    { label: "Formation",          icon: <GraduationCap className="w-4 h-4" />, color: "text-blue-600 bg-blue-50" },
};

// Ordre d'affichage des types demandables par le collaborateur
const TYPES_DEMANDABLES = ["ANNUEL", "MALADIE", "EXCEPTIONNEL", "PERMISSION", "FORMATION"];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CongesCollaborateurPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, loading, refetch } = useApi<CongesResponse>("/api/collaborateur/conges");

  const profilRH = data?.profilRH ?? null;
  const soldes   = data?.soldes   ?? [];
  const demandes = data?.demandes ?? [];

  // Soldes limités aux types plafonnés (droit > 0)
  const soldesAffiches = useMemo(
    () => soldes.filter((s) => s.totalDroit > 0 && TYPE_CONGE[s.type]),
    [soldes],
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  // Pas de dossier RH → l'espace n'est pas applicable
  if (data && profilRH === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
          <Info className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-slate-900">Aucun dossier RH</h1>
          <p className="text-sm text-slate-500 mt-2">
            Votre compte n&apos;est pas rattaché à un dossier RH. Contactez le Responsable RH
            pour pouvoir soumettre des demandes de congé.
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
            <h1 className="text-2xl font-bold text-slate-900">Congés & Absences</h1>
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
          <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-100">Manager / Chef d&apos;agence</span>→
          <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-100">RH</span>→
          <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-100">Validation finale</span>
        </div>

        {/* ── Soldes ── */}
        {soldesAffiches.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Mes soldes {data?.annee}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {soldesAffiches.map((s) => {
                const cfg = TYPE_CONGE[s.type];
                const pct = s.totalDroit > 0 ? Math.min(100, Math.round((s.pris / s.totalDroit) * 100)) : 0;
                return (
                  <div key={s.type} className="p-3 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={`p-1 rounded-md ${cfg.color}`}>{cfg.icon}</span>
                      <span className="text-xs font-medium text-slate-600 truncate">{cfg.label}</span>
                    </div>
                    <p className="text-xl font-bold text-slate-900">{s.restant}<span className="text-sm font-normal text-slate-400"> / {s.totalDroit} j</span></p>
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{s.pris} j pris{s.reporte > 0 ? ` · ${s.reporte} reportés` : ""}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Liste des demandes ── */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Mes demandes</h2>
          {demandes.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
              <CalendarDays className="w-10 h-10 mb-2 opacity-30" />
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
          soldes={soldes}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }}
        />
      )}
    </div>
  );
}

// ── Ligne demande ───────────────────────────────────────────────────────────────

function DemandeRow({ demande, onRefetch }: { demande: Demande; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/collaborateur/conges/${demande.id}`, "PATCH");
  const cfg  = STATUT_CONFIG[demande.statut] ?? STATUT_CONFIG.EN_ATTENTE;
  const type = TYPE_CONGE[demande.type];
  const annulable = ["EN_ATTENTE", "VALIDE_MANAGER", "VALIDE_RH"].includes(demande.statut);

  const handleAnnuler = async () => {
    if (!confirm("Annuler cette demande de congé ?")) return;
    const result = await mutate({ action: "ANNULER" });
    if (result) { toast.success("Demande annulée"); onRefetch(); }
  };

  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50">
      <span className={`p-2 rounded-lg flex-shrink-0 ${type?.color ?? "text-slate-500 bg-slate-100"}`}>
        {type?.icon ?? <CalendarDays className="w-4 h-4" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-800">{type?.label ?? demande.type}</span>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
              <span>{formatDate(demande.dateDebut)} → {formatDate(demande.dateFin)}</span>
              <span className="font-medium text-slate-700">{demande.nbJours} jour{demande.nbJours > 1 ? "s" : ""}</span>
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

function CreateDemandeModal({ soldes, onClose, onCreated }: {
  soldes: Solde[]; onClose: () => void; onCreated: () => void;
}) {
  const { mutate, loading } = useMutation("/api/collaborateur/conges", "POST");
  const [form, setForm] = useState({
    type: "ANNUEL", dateDebut: "", dateFin: "", nbJours: "", motif: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Nombre de jours calendaires (inclusif) suggéré à partir des dates
  const joursSuggeres = useMemo(() => {
    if (!form.dateDebut || !form.dateFin) return null;
    const d1 = new Date(form.dateDebut), d2 = new Date(form.dateFin);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime()) || d2 < d1) return null;
    return Math.round((d2.getTime() - d1.getTime()) / 86_400_000) + 1;
  }, [form.dateDebut, form.dateFin]);

  const soldeType = soldes.find((s) => s.type === form.type);

  const handleSubmit = async () => {
    const nbJours = form.nbJours ? Number(form.nbJours) : joursSuggeres;
    if (!form.dateDebut || !form.dateFin || !nbJours) {
      toast.error("Type, dates et nombre de jours sont obligatoires");
      return;
    }
    const result = await mutate({
      type:      form.type,
      dateDebut: form.dateDebut,
      dateFin:   form.dateFin,
      nbJours,
      motif:     form.motif || null,
    });
    if (result) { toast.success("Demande soumise ✓"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle demande de congé</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Type de congé *">
            <select value={form.type} onChange={(e) => set("type", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {TYPES_DEMANDABLES.map((k) => <option key={k} value={k}>{TYPE_CONGE[k].label}</option>)}
            </select>
          </Field>

          {soldeType && soldeType.totalDroit > 0 && (
            <p className="text-xs text-slate-500 -mt-1">
              Solde restant : <strong className="text-slate-700">{soldeType.restant} jour(s)</strong> sur {soldeType.totalDroit}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date début *">
              <input type="date" value={form.dateDebut} onChange={(e) => set("dateDebut", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </Field>
            <Field label="Date fin *">
              <input type="date" value={form.dateFin} min={form.dateDebut || undefined} onChange={(e) => set("dateFin", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </Field>
          </div>

          <Field label="Nombre de jours *">
            <input type="number" min="0.5" step="0.5"
              value={form.nbJours}
              onChange={(e) => set("nbJours", e.target.value)}
              placeholder={joursSuggeres ? `${joursSuggeres} (suggéré)` : "ex. 3"}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            {joursSuggeres && !form.nbJours && (
              <button type="button" onClick={() => set("nbJours", String(joursSuggeres))}
                className="mt-1 text-[11px] text-emerald-600 hover:underline">
                Utiliser {joursSuggeres} jour(s) calendaire(s)
              </button>
            )}
          </Field>

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
