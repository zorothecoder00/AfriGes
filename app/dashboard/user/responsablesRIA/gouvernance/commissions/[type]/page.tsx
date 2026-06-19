"use client";

import { use, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Users, Calendar, Gavel, ListChecks, MessageSquare,
  Plus, RefreshCw, CheckCircle2, Clock, AlertTriangle,
  Shield, ArrowLeft, UserPlus, Eye, Pencil, Trash2, Check, X, Search, KeyRound, Copy,
} from "lucide-react";
import Link from "next/link";
import { COMMISSION_ROLES, COMMISSION_ROLE_LABELS, COMMISSION_ROLE_POWERS, roleLabel } from "@/lib/commissionsRIA";

type PageParams = { type: string };

const COMMISSION_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  finance:             { label: "Commission Finance",                              color: "text-blue-700",    bg: "bg-blue-50",    desc: "Analyse financière, investissements, contrôle de gestion" },
  "operations-terrain":{ label: "Commission Opérations Terrain & Approvisionnement", color: "text-emerald-700", bg: "bg-emerald-50", desc: "Activités terrain, approvisionnement, performance commerciale" },
  "audit-controle":    { label: "Commission Audit & Contrôle Interne",            color: "text-amber-700",   bg: "bg-amber-50",   desc: "Contrôle interne, conformité, gestion des risques" },
  optimisation:        { label: "Commission Optimisation des Processus",           color: "text-violet-700",  bg: "bg-violet-50",  desc: "Processus, innovation, amélioration continue" },
};

const TYPE_MAP: Record<string, string> = {
  finance:             "FINANCE",
  "operations-terrain":"OPERATIONS_TERRAIN",
  "audit-controle":    "AUDIT",
  optimisation:        "OPTIMISATION",
};

interface Membre {
  id: number;
  role: string;
  actif: boolean;
  user: { id: number; nom: string; prenom: string };
  dateEntree: string;
}

interface Reunion {
  id: number;
  titre: string;
  dateHeure: string;
  statut: string;
  lieu: string | null;
  ordreJour: string | null;
  _count: { presences: number; resolutions: number };
}

interface Resolution {
  id: number;
  numero: string;
  titre: string;
  statut: string;
  priorite: string;
  dateAdoption: string | null;
  description: string | null;
  dateEcheance: string | null;
  responsableId: number | null;
  reunionId: number | null;
}

interface PlanAction {
  id: number;
  titre: string;
  statut: string;
  progression: number;
  dateEcheance: string | null;
  enRetard?: boolean;
  responsable: { nom: string; prenom: string } | null;
  description: string | null;
  priorite: string;
  responsableId: number | null;
  resolutionId: number | null;
  dateDebut: string | null;
  notes: string | null;
}

interface Observation {
  id: number;
  contenu: string;
  type: string;
  epingle: boolean;
  createdAt: string;
  auteur: { nom: string; prenom: string };
}

interface CommissionData {
  membres: Membre[];
  reunions: Reunion[];
  resolutions: Resolution[];
  plansAction: PlanAction[];
  observations: Observation[];
}

const TABS = [
  { key: "membres",      label: "Membres",        icon: Users },
  { key: "reunions",     label: "Réunions",        icon: Calendar },
  { key: "resolutions",  label: "Résolutions",     icon: Gavel },
  { key: "plans",        label: "Plans d'action",  icon: ListChecks },
  { key: "observations", label: "Observations",    icon: MessageSquare },
];

const STATUTS_REUNION: Record<string, string> = {
  PLANIFIEE: "bg-blue-100 text-blue-700", EN_COURS: "bg-emerald-100 text-emerald-700",
  TENUE: "bg-slate-100 text-slate-600", ANNULEE: "bg-rose-100 text-rose-700",
  REPORTEE: "bg-amber-100 text-amber-700",
};
const STATUTS_RESOLUTION: Record<string, string> = {
  EN_ATTENTE: "bg-slate-100 text-slate-600", APPROUVEE: "bg-emerald-100 text-emerald-700",
  EN_APPLICATION: "bg-blue-100 text-blue-700", APPLIQUEE: "bg-teal-100 text-teal-700",
  REJETEE: "bg-rose-100 text-rose-700",
  // Variantes CDC (lecture seule pour rétro-compatibilité)
  EN_PREPARATION: "bg-slate-100 text-slate-600", SOUMISE: "bg-blue-100 text-blue-700",
  ADOPTEE: "bg-emerald-100 text-emerald-700", EXECUTEE: "bg-teal-100 text-teal-700",
};
const STATUTS_PLAN: Record<string, string> = {
  A_FAIRE: "bg-slate-100 text-slate-600", EN_COURS: "bg-blue-100 text-blue-700",
  TERMINE: "bg-emerald-100 text-emerald-700", ABANDONNE: "bg-rose-100 text-rose-700",
};

// Options des selects (édition)
const REUNION_STATUT_OPTS: [string, string][] = [
  ["PLANIFIEE", "Planifiée"], ["EN_COURS", "En cours"], ["TENUE", "Tenue"],
  ["ANNULEE", "Annulée"], ["REPORTEE", "Reportée"],
];
const PLAN_STATUT_OPTS: [string, string][] = [
  ["A_FAIRE", "À faire"], ["EN_COURS", "En cours"], ["TERMINE", "Terminé"], ["ABANDONNE", "Abandonné"],
];
const PRIORITE_OPTS: [string, string][] = [
  ["CRITIQUE", "Critique"], ["HAUTE", "Haute"], ["MOYENNE", "Moyenne"], ["BASSE", "Basse"],
];

// Helpers de formatage pour les inputs date / datetime-local
function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function toDateInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function MembreRow({ m, onDone }: { m: Membre; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(m.role);
  const base = `/api/admin/ria/commissions/gouvernance/membres/${m.id}`;
  const { mutate: patchMembre, loading: saving } = useMutation(base, "PATCH");
  const { mutate: deleteMembre, loading: removing } = useMutation(base, "DELETE");

  async function saveRole() {
    if (role === m.role) { setEditing(false); return; }
    const res = await patchMembre({ role }) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success("Rôle mis à jour"); setEditing(false); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  async function retirer() {
    if (!window.confirm(`Retirer ${m.user.prenom} ${m.user.nom} de la commission ?`)) return;
    const res = await deleteMembre({}) as { success?: boolean; error?: string } | null;
    if (res?.success) { toast.success("Membre retiré"); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  return (
    <div className={`flex items-center justify-between py-3 ${!m.actif ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
          {m.user.prenom[0]}{m.user.nom[0]}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800">{m.user.prenom} {m.user.nom}</p>
          <p className="text-xs text-slate-400">Depuis {new Date(m.dateEntree).toLocaleDateString("fr-FR")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {m.actif && editing ? (
          <>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400">
              {COMMISSION_ROLES.map(r => <option key={r} value={r}>{COMMISSION_ROLE_LABELS[r]}</option>)}
            </select>
            <button onClick={saveRole} disabled={saving} title="Enregistrer le rôle"
              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => { setRole(m.role); setEditing(false); }} title="Annuler"
              className="p-1 text-slate-400 hover:bg-slate-100 rounded">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === "PRESIDENT" ? "bg-amber-100 text-amber-700" : m.role.startsWith("RAPPORTEUR") ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
              {roleLabel(m.role)}
            </span>
            {m.actif ? (
              <>
                <button onClick={() => setEditing(true)} title="Changer le rôle"
                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={retirer} disabled={removing} title="Retirer le membre"
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-300">Inactif</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface UserLite { id: number; nom: string; prenom: string; email: string; role: string }

function AddMembreModal({ typeCommission, onClose, onDone }: {
  typeCommission: string; onClose: () => void; onDone: () => void;
}) {
  const [mode, setMode] = useState<"existant" | "compte">("existant");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserLite | null>(null);
  const [role, setRole] = useState<string>("RAPPORTEUR_2");
  const [compte, setCompte] = useState({ nom: "", prenom: "", email: "", telephone: "", password: "" });
  const [cred, setCred] = useState<{ email: string; motDePasse: string } | null>(null);
  const { mutate, loading } = useMutation("/api/admin/ria/commissions/gouvernance/membres", "POST");

  // Recherche d'utilisateurs par nom / prénom / email (min. 2 caractères).
  const { data: results, loading: searching } = useApi<{ data: UserLite[] }>(
    mode === "existant" && !selected && search.trim().length >= 2
      ? `/api/admin/membres?search=${encodeURIComponent(search.trim())}&limit=8`
      : null
  );

  type Res = { id?: number; error?: string; compteCree?: { email: string; motDePasseTemporaire: string | null } } | null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "existant") {
      if (!selected) { toast.error("Sélectionnez un utilisateur"); return; }
      const res = await mutate({ userId: selected.id, role, typeCommission }) as Res;
      if (res?.id) { toast.success("Membre ajouté"); onDone(); }
      else toast.error(res?.error || "Erreur");
      return;
    }
    if (!compte.nom || !compte.prenom || !compte.email) { toast.error("Nom, prénom et email requis"); return; }
    const res = await mutate({ typeCommission, role, nouveauCompte: compte }) as Res;
    if (res?.id) {
      if (res.compteCree?.motDePasseTemporaire) {
        setCred({ email: res.compteCree.email, motDePasse: res.compteCree.motDePasseTemporaire });
      } else { toast.success("Compte membre créé"); onDone(); }
    } else toast.error(res?.error || "Erreur");
  }

  // Écran de confirmation des identifiants générés
  if (cred) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-slate-800">Compte membre créé</h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">
              Transmettez ces identifiants au membre. Il devra changer son mot de passe à la première connexion.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-500">Identifiant</span>
                <span className="text-sm font-medium text-slate-800">{cred.email}</span>
              </div>
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-xs text-amber-700 flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" /> Mot de passe temporaire</span>
                <span className="flex items-center gap-2">
                  <code className="text-sm font-mono font-semibold text-amber-800">{cred.motDePasse}</code>
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(cred.motDePasse); toast.success("Copié"); }}
                    className="p-1 text-amber-600 hover:bg-amber-100 rounded" title="Copier">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={onDone} className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">Terminé</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Ajouter un membre
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {/* Bascule : utilisateur existant / nouveau compte membre */}
        <div className="px-6 pt-4">
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
            <button type="button" onClick={() => setMode("existant")}
              className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${mode === "existant" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
              Utilisateur existant
            </button>
            <button type="button" onClick={() => setMode("compte")}
              className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${mode === "compte" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
              Nouveau compte
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {mode === "existant" ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Utilisateur *</label>
              {selected ? (
                <div className="flex items-center gap-3 border border-blue-200 bg-blue-50/50 rounded-lg px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {selected.prenom[0]}{selected.nom[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{selected.prenom} {selected.nom}</p>
                    <p className="text-xs text-slate-400 truncate">{selected.email}</p>
                  </div>
                  <button type="button" onClick={() => { setSelected(null); setSearch(""); }}
                    className="text-xs text-blue-600 hover:underline shrink-0">Changer</button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Rechercher par nom, prénom ou email…" />
                  </div>
                  {search.trim().length >= 2 && (
                    <div className="mt-1 border border-slate-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-50">
                      {searching ? (
                        <p className="px-3 py-3 text-xs text-slate-400">Recherche…</p>
                      ) : (results?.data?.length ?? 0) === 0 ? (
                        <p className="px-3 py-3 text-xs text-slate-400">Aucun utilisateur trouvé</p>
                      ) : results!.data.map(u => (
                        <button type="button" key={u.id} onClick={() => setSelected(u)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                            {u.prenom[0]}{u.nom[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-800 truncate">{u.prenom} {u.nom}</p>
                            <p className="text-xs text-slate-400 truncate">{u.email}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">{u.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Prénom *</label>
                  <input value={compte.prenom} onChange={e => setCompte(c => ({ ...c, prenom: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
                  <input value={compte.nom} onChange={e => setCompte(c => ({ ...c, nom: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email (identifiant) *</label>
                <input type="email" value={compte.email} onChange={e => setCompte(c => ({ ...c, email: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="membre@exemple.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Téléphone</label>
                  <input value={compte.telephone} onChange={e => setCompte(c => ({ ...c, telephone: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe</label>
                  <input type="text" value={compte.password} onChange={e => setCompte(c => ({ ...c, password: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Auto-généré si vide" />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Un compte (rôle membre de commission) sera créé. Laisser le mot de passe vide pour en générer un automatiquement ;
                le membre devra le changer à la première connexion.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rôle</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {COMMISSION_ROLES.map(r => <option key={r} value={r}>{COMMISSION_ROLE_LABELS[r]}</option>)}
            </select>
            <ul className="mt-2 space-y-0.5">
              {COMMISSION_ROLE_POWERS[role as keyof typeof COMMISSION_ROLE_POWERS]?.map(p => (
                <li key={p} className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" /> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading || (mode === "existant" && !selected)}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Enregistrement..." : mode === "compte" ? "Créer le compte" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddObservationModal({ typeCommission, onClose, onDone }: {
  typeCommission: string; onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState({ contenu: "", type: "SUGGESTION", epingle: false });
  const { mutate, loading } = useMutation("/api/admin/ria/commissions/gouvernance/observations", "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate({ ...form, typeCommission }) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success("Observation ajoutée"); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Nouvelle observation
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contenu *</label>
            <textarea value={form.contenu} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))}
              required rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
              placeholder="Détails de l'observation, suggestion ou alerte..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="SUGGESTION">Suggestion</option>
                <option value="ALERTE">Alerte</option>
                <option value="RECOMMANDATION">Recommandation</option>
                <option value="CONSTAT">Constat</option>
                <option value="QUESTION">Question</option>
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.epingle} onChange={e => setForm(f => ({ ...f, epingle: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <span className="text-xs text-slate-600">Épingler</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50">
              {loading ? "Ajout..." : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Bouton de suppression réutilisable (DELETE + confirmation)
function DeleteButton({ url, label, onDone }: { url: string; label: string; onDone: () => void }) {
  const { mutate, loading } = useMutation(url, "DELETE");
  async function del() {
    if (!window.confirm(`Supprimer « ${label} » ? Cette action est irréversible.`)) return;
    const res = await mutate({}) as { success?: boolean; error?: string } | null;
    if (res?.success) { toast.success("Supprimé"); onDone(); }
    else toast.error(res?.error || "Erreur");
  }
  return (
    <button onClick={del} disabled={loading} title="Supprimer"
      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-50">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

// ── Modal Réunion (création / édition) ──────────────────────────────────────────
function ReunionModal({ typeEnum, initial, onClose, onDone }: {
  typeEnum: string; initial: Reunion | null; onClose: () => void; onDone: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    titre: initial?.titre ?? "",
    dateHeure: toLocalInput(initial?.dateHeure),
    lieu: initial?.lieu ?? "",
    ordreJour: initial?.ordreJour ?? "",
    statut: initial?.statut ?? "PLANIFIEE",
  });
  const base = "/api/admin/ria/commissions/gouvernance/reunions";
  const { mutate, loading } = useMutation(isEdit ? `${base}/${initial!.id}` : base, isEdit ? "PATCH" : "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = isEdit
      ? { titre: form.titre, dateHeure: form.dateHeure, lieu: form.lieu, ordreJour: form.ordreJour, statut: form.statut }
      : { typeCommission: typeEnum, titre: form.titre, dateHeure: form.dateHeure, lieu: form.lieu, ordreJour: form.ordreJour };
    const res = await mutate(payload) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success(isEdit ? "Réunion modifiée" : "Réunion créée"); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" /> {isEdit ? "Modifier la réunion" : "Planifier une réunion"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ex. Réunion mensuelle" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date & heure *</label>
              <input type="datetime-local" value={form.dateHeure} onChange={e => setForm(f => ({ ...f, dateHeure: e.target.value }))}
                required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Lieu</label>
              <input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Salle de réunion" />
            </div>
          </div>
          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Statut</label>
              <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {REUNION_STATUT_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ordre du jour</label>
            <textarea value={form.ordreJour} onChange={e => setForm(f => ({ ...f, ordreJour: e.target.value }))}
              rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              placeholder="Points à traiter..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal Résolution (création / édition) ───────────────────────────────────────
function ResolutionModal({ typeEnum, initial, membres, reunions, onClose, onDone }: {
  typeEnum: string; initial: Resolution | null; membres: Membre[]; reunions: Reunion[];
  onClose: () => void; onDone: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    titre: initial?.titre ?? "",
    description: initial?.description ?? "",
    dateEcheance: toDateInput(initial?.dateEcheance),
    responsableId: initial?.responsableId ? String(initial.responsableId) : "",
    reunionId: initial?.reunionId ? String(initial.reunionId) : "",
  });
  const base = "/api/admin/ria/commissions/gouvernance/resolutions";
  const { mutate, loading } = useMutation(isEdit ? `${base}/${initial!.id}` : base, isEdit ? "PATCH" : "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Le statut n'est plus éditable ici : il suit le workflow de vote (CDC) depuis la page détail.
    const payload = isEdit
      ? { titre: form.titre, description: form.description, dateEcheance: form.dateEcheance || null,
          responsableId: form.responsableId || null }
      : { typeCommission: typeEnum, titre: form.titre, description: form.description,
          dateEcheance: form.dateEcheance || null, responsableId: form.responsableId || null,
          reunionId: form.reunionId || null };
    const res = await mutate(payload) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success(isEdit ? "Résolution modifiée" : "Résolution créée"); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Gavel className="w-4 h-4 text-emerald-500" /> {isEdit ? "Modifier la résolution" : "Nouvelle résolution"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Intitulé de la résolution" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              placeholder="Contexte et détails..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date d&apos;échéance</label>
              <input type="date" value={form.dateEcheance} onChange={e => setForm(f => ({ ...f, dateEcheance: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Responsable</label>
              <select value={form.responsableId} onChange={e => setForm(f => ({ ...f, responsableId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">—</option>
                {membres.filter(m => m.actif).map(m => (
                  <option key={m.user.id} value={m.user.id}>{m.user.prenom} {m.user.nom}</option>
                ))}
              </select>
            </div>
          </div>
          {isEdit ? (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
              Le statut de la résolution évolue via le workflow de vote (Soumettre → Adopter/Rejeter → Exécuter)
              depuis la page détail de la résolution.
            </p>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Réunion liée (optionnel)</label>
              <select value={form.reunionId} onChange={e => setForm(f => ({ ...f, reunionId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">—</option>
                {reunions.map(r => <option key={r.id} value={r.id}>{r.titre}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {loading ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal Plan d'action (création / édition) ────────────────────────────────────
function PlanModal({ typeEnum, initial, membres, resolutions, onClose, onDone }: {
  typeEnum: string; initial: PlanAction | null; membres: Membre[]; resolutions: Resolution[];
  onClose: () => void; onDone: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    titre: initial?.titre ?? "",
    description: initial?.description ?? "",
    priorite: initial?.priorite ?? "MOYENNE",
    dateDebut: toDateInput(initial?.dateDebut),
    dateEcheance: toDateInput(initial?.dateEcheance),
    responsableId: initial?.responsableId ? String(initial.responsableId) : "",
    resolutionId: initial?.resolutionId ? String(initial.resolutionId) : "",
    statut: initial?.statut ?? "A_FAIRE",
    progression: initial?.progression ?? 0,
  });
  const base = "/api/admin/ria/commissions/gouvernance/plans-actions";
  const { mutate, loading } = useMutation(isEdit ? `${base}/${initial!.id}` : base, isEdit ? "PATCH" : "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = isEdit
      ? { titre: form.titre, description: form.description, priorite: form.priorite,
          dateDebut: form.dateDebut || null, dateEcheance: form.dateEcheance || null,
          responsableId: form.responsableId || null, statut: form.statut, progression: form.progression }
      : { typeCommission: typeEnum, titre: form.titre, description: form.description, priorite: form.priorite,
          dateDebut: form.dateDebut || null, dateEcheance: form.dateEcheance || null,
          responsableId: form.responsableId || null, resolutionId: form.resolutionId || null };
    const res = await mutate(payload) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success(isEdit ? "Plan modifié" : "Plan créé"); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-teal-500" /> {isEdit ? "Modifier le plan d'action" : "Nouveau plan d'action"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Intitulé de l'action" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              placeholder="Détails de l'action..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priorité</label>
              <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                {PRIORITE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Responsable</label>
              <select value={form.responsableId} onChange={e => setForm(f => ({ ...f, responsableId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="">—</option>
                {membres.filter(m => m.actif).map(m => (
                  <option key={m.user.id} value={m.user.id}>{m.user.prenom} {m.user.nom}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date de début</label>
              <input type="date" value={form.dateDebut} onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Échéance</label>
              <input type="date" value={form.dateEcheance} onChange={e => setForm(f => ({ ...f, dateEcheance: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>
          {isEdit ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Statut</label>
                <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                  {PLAN_STATUT_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Progression ({form.progression}%)</label>
                <input type="range" min={0} max={100} step={5} value={form.progression}
                  onChange={e => setForm(f => ({ ...f, progression: Number(e.target.value) }))}
                  className="w-full accent-teal-600 mt-2" />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Résolution liée (optionnel)</label>
              <select value={form.resolutionId} onChange={e => setForm(f => ({ ...f, resolutionId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="">—</option>
                {resolutions.map(r => <option key={r.id} value={r.id}>{r.numero} · {r.titre}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {loading ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CommissionTypePage({ params }: { params: Promise<PageParams> }) {
  const { type } = use(params);
  const [tab, setTab] = useState("membres");
  const [showAddMembre, setShowAddMembre] = useState(false);
  const [showAddObs, setShowAddObs] = useState(false);
  const [reunionModal, setReunionModal] = useState<{ open: boolean; edit: Reunion | null }>({ open: false, edit: null });
  const [resolutionModal, setResolutionModal] = useState<{ open: boolean; edit: Resolution | null }>({ open: false, edit: null });
  const [planModal, setPlanModal] = useState<{ open: boolean; edit: PlanAction | null }>({ open: false, edit: null });
  const [refresh, setRefresh] = useState(0);

  const typeEnum = TYPE_MAP[type] || type.toUpperCase();
  const meta = COMMISSION_META[type] || { label: type.toUpperCase(), color: "text-slate-700", bg: "bg-slate-50", desc: "" };

  const { data, loading } = useApi<CommissionData>(
    `/api/admin/ria/commissions/gouvernance/commissions/${typeEnum}?_r=${refresh}`
  );

  function done() {
    setShowAddMembre(false);
    setShowAddObs(false);
    setReunionModal({ open: false, edit: null });
    setResolutionModal({ open: false, edit: null });
    setPlanModal({ open: false, edit: null });
    setRefresh(r => r + 1);
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <Link href="/dashboard/user/responsablesRIA/gouvernance"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour au tableau de bord
        </Link>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${meta.bg} mb-2`}>
          <Shield className={`w-4 h-4 ${meta.color}`} />
          <h1 className={`text-lg font-bold ${meta.color}`}>{meta.label}</h1>
        </div>
        <p className="text-sm text-slate-500">{meta.desc}</p>
      </div>

      {/* Stats rapides */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Membres actifs",     v: data.membres.filter(m => m.actif).length,                                  icon: Users },
            { label: "Réunions tenues",    v: data.reunions.filter(r => r.statut === "TENUE").length,                     icon: Calendar },
            { label: "Résolutions",        v: data.resolutions.length,                                                     icon: Gavel },
            { label: "Plans en cours",     v: data.plansAction.filter(p => p.statut === "EN_COURS").length,               icon: ListChecks },
            { label: "En retard",          v: data.plansAction.filter(p => p.enRetard).length,                            icon: AlertTriangle },
          ].map(({ label, v, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xl font-bold text-slate-800">{v}</span>
              </div>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && data && (
            <>
              {/* Membres */}
              {tab === "membres" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-500">{data.membres.filter(m => m.actif).length} membres actifs</p>
                    <button onClick={() => setShowAddMembre(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <Plus className="w-3.5 h-3.5" /> Ajouter
                    </button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {data.membres.map(m => (
                      <MembreRow key={m.id} m={m} onDone={done} />
                    ))}
                    {data.membres.length === 0 && (
                      <p className="text-center py-8 text-sm text-slate-400">Aucun membre dans cette commission</p>
                    )}
                  </div>
                </div>
              )}

              {/* Réunions */}
              {tab === "reunions" && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-500">{data.reunions.length} réunion(s)</p>
                    <button onClick={() => setReunionModal({ open: true, edit: null })}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <Plus className="w-3.5 h-3.5" /> Planifier
                    </button>
                  </div>
                  {data.reunions.length === 0 ? (
                    <p className="text-center py-8 text-sm text-slate-400">Aucune réunion planifiée</p>
                  ) : data.reunions.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{r.titre}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(r.dateHeure).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {" · "}{r._count.presences} présences · {r._count.resolutions} résolutions
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full mr-1 ${STATUTS_REUNION[r.statut] || "bg-slate-100 text-slate-600"}`}>{r.statut}</span>
                        <Link href={`/dashboard/user/responsablesRIA/gouvernance/reunions/${r.id}`} title="Détail"
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => setReunionModal({ open: true, edit: r })} title="Modifier"
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <DeleteButton url={`/api/admin/ria/commissions/gouvernance/reunions/${r.id}`} label={r.titre} onDone={done} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Résolutions */}
              {tab === "resolutions" && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-500">{data.resolutions.length} résolution(s)</p>
                    <button onClick={() => setResolutionModal({ open: true, edit: null })}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                      <Plus className="w-3.5 h-3.5" /> Nouvelle résolution
                    </button>
                  </div>
                  {data.resolutions.length === 0 ? (
                    <p className="text-center py-8 text-sm text-slate-400">Aucune résolution</p>
                  ) : data.resolutions.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-slate-400">{r.numero}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${STATUTS_RESOLUTION[r.statut] || "bg-slate-100 text-slate-600"}`}>{r.statut}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800">{r.titre}</p>
                        {r.dateAdoption && <p className="text-xs text-slate-400">Adoptée le {new Date(r.dateAdoption).toLocaleDateString("fr-FR")}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs mr-1 ${r.priorite === "CRITIQUE" ? "text-rose-600 font-medium" : r.priorite === "HAUTE" ? "text-amber-600" : "text-slate-400"}`}>
                          {r.priorite}
                        </span>
                        <Link href={`/dashboard/user/responsablesRIA/gouvernance/resolutions/${r.id}`} title="Détail"
                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded">
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => setResolutionModal({ open: true, edit: r })} title="Modifier"
                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <DeleteButton url={`/api/admin/ria/commissions/gouvernance/resolutions/${r.id}`} label={r.titre} onDone={done} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Plans d'action */}
              {tab === "plans" && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-500">{data.plansAction.length} plan(s) d&apos;action</p>
                    <button onClick={() => setPlanModal({ open: true, edit: null })}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                      <Plus className="w-3.5 h-3.5" /> Nouveau plan
                    </button>
                  </div>
                  {data.plansAction.length === 0 ? (
                    <p className="text-center py-8 text-sm text-slate-400">Aucun plan d&apos;action</p>
                  ) : data.plansAction.map(p => (
                    <div key={p.id} className={`p-3 rounded-lg border ${p.enRetard ? "border-rose-200 bg-rose-50/40" : "border-slate-100"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{p.titre}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${STATUTS_PLAN[p.statut] || "bg-slate-100 text-slate-600"}`}>{p.statut}</span>
                            {p.enRetard && <span className="text-xs text-rose-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />Retard</span>}
                          </div>
                          {p.responsable && <p className="text-xs text-slate-400">{p.responsable.prenom} {p.responsable.nom}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          {p.dateEcheance && (
                            <p className={`text-xs mr-1 ${p.enRetard ? "text-rose-600 font-medium" : "text-slate-400"}`}>
                              {new Date(p.dateEcheance).toLocaleDateString("fr-FR")}
                            </p>
                          )}
                          <button onClick={() => setPlanModal({ open: true, edit: p })} title="Modifier"
                            className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <DeleteButton url={`/api/admin/ria/commissions/gouvernance/plans-actions/${p.id}`} label={p.titre} onDone={done} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${p.progression >= 100 ? "bg-emerald-500" : p.progression >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                            style={{ width: `${p.progression}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">{p.progression}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Observations */}
              {tab === "observations" && (
                <div className="space-y-2">
                  <div className="flex justify-end mb-2">
                    <button onClick={() => setShowAddObs(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 text-white rounded-lg hover:bg-slate-800">
                      <Plus className="w-3.5 h-3.5" /> Ajouter
                    </button>
                  </div>
                  {data.observations.length === 0 ? (
                    <p className="text-center py-8 text-sm text-slate-400">Aucune observation</p>
                  ) : data.observations.map(o => (
                    <div key={o.id} className={`p-3 rounded-lg border ${o.epingle ? "border-amber-200 bg-amber-50/40" : "border-slate-100"}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {o.epingle && <span className="text-amber-500 text-xs">📌</span>}
                            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{o.type}</span>
                            <span className="text-xs text-slate-400">{o.auteur.prenom} {o.auteur.nom} · {new Date(o.createdAt).toLocaleDateString("fr-FR")}</span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-line">{o.contenu}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddMembre && <AddMembreModal typeCommission={typeEnum} onClose={() => setShowAddMembre(false)} onDone={done} />}
      {showAddObs && <AddObservationModal typeCommission={typeEnum} onClose={() => setShowAddObs(false)} onDone={done} />}
      {reunionModal.open && (
        <ReunionModal typeEnum={typeEnum} initial={reunionModal.edit}
          onClose={() => setReunionModal({ open: false, edit: null })} onDone={done} />
      )}
      {resolutionModal.open && (
        <ResolutionModal typeEnum={typeEnum} initial={resolutionModal.edit}
          membres={data?.membres ?? []} reunions={data?.reunions ?? []}
          onClose={() => setResolutionModal({ open: false, edit: null })} onDone={done} />
      )}
      {planModal.open && (
        <PlanModal typeEnum={typeEnum} initial={planModal.edit}
          membres={data?.membres ?? []} resolutions={data?.resolutions ?? []}
          onClose={() => setPlanModal({ open: false, edit: null })} onDone={done} />
      )}
    </div>
  );
}
