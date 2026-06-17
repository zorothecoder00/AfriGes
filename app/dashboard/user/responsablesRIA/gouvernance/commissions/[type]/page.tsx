"use client";

import { use, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Users, Calendar, Gavel, ListChecks, MessageSquare,
  Plus, RefreshCw, CheckCircle2, Clock, AlertTriangle,
  Shield, ArrowLeft, UserPlus, Eye, Pencil, Trash2, Check, X, Search,
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
  dateDebut: string;
}

interface Reunion {
  id: number;
  titre: string;
  dateHeure: string;
  statut: string;
  _count: { presences: number; resolutions: number };
}

interface Resolution {
  id: number;
  numero: string;
  titre: string;
  statut: string;
  priorite: string;
  dateAdoption: string | null;
}

interface PlanAction {
  id: number;
  titre: string;
  statut: string;
  progression: number;
  dateEcheance: string | null;
  enRetard?: boolean;
  responsable: { nom: string; prenom: string } | null;
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
  TERMINEE: "bg-slate-100 text-slate-600", ANNULEE: "bg-rose-100 text-rose-700",
};
const STATUTS_RESOLUTION: Record<string, string> = {
  EN_PREPARATION: "bg-slate-100 text-slate-600", SOUMISE: "bg-blue-100 text-blue-700",
  ADOPTEE: "bg-emerald-100 text-emerald-700", REJETEE: "bg-rose-100 text-rose-700",
  EXECUTEE: "bg-teal-100 text-teal-700",
};

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
          <p className="text-xs text-slate-400">Depuis {new Date(m.dateDebut).toLocaleDateString("fr-FR")}</p>
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
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserLite | null>(null);
  const [role, setRole] = useState<string>("RAPPORTEUR_2");
  const { mutate, loading } = useMutation("/api/admin/ria/commissions/gouvernance/membres", "POST");

  const { data: results, loading: searching } = useApi<{ data: UserLite[] }>(
    !selected && search.trim().length >= 2
      ? `/api/admin/membres?search=${encodeURIComponent(search.trim())}&limit=8`
      : null
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) { toast.error("Sélectionnez un utilisateur"); return; }
    const res = await mutate({ userId: selected.id, role, typeCommission }) as { id?: number; error?: string } | null;
    if (res?.id) { toast.success("Membre ajouté"); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Ajouter un membre
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
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
            <button type="submit" disabled={loading || !selected}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Ajout..." : "Ajouter"}
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

export default function CommissionTypePage({ params }: { params: Promise<PageParams> }) {
  const { type } = use(params);
  const [tab, setTab] = useState("membres");
  const [showAddMembre, setShowAddMembre] = useState(false);
  const [showAddObs, setShowAddObs] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const typeEnum = TYPE_MAP[type] || type.toUpperCase();
  const meta = COMMISSION_META[type] || { label: type.toUpperCase(), color: "text-slate-700", bg: "bg-slate-50", desc: "" };

  const { data, loading } = useApi<CommissionData>(
    `/api/admin/ria/commissions/gouvernance/commissions/${typeEnum}?_r=${refresh}`
  );

  function done() {
    setShowAddMembre(false);
    setShowAddObs(false);
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
            { label: "Réunions tenues",    v: data.reunions.filter(r => r.statut === "TERMINEE").length,                  icon: Calendar },
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
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUTS_REUNION[r.statut] || "bg-slate-100 text-slate-600"}`}>{r.statut}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Résolutions */}
              {tab === "resolutions" && (
                <div className="space-y-2">
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
                      <span className={`text-xs ${r.priorite === "CRITIQUE" ? "text-rose-600 font-medium" : r.priorite === "HAUTE" ? "text-amber-600" : "text-slate-400"}`}>
                        {r.priorite}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Plans d'action */}
              {tab === "plans" && (
                <div className="space-y-2">
                  {data.plansAction.length === 0 ? (
                    <p className="text-center py-8 text-sm text-slate-400">Aucun plan d&apos;action</p>
                  ) : data.plansAction.map(p => (
                    <div key={p.id} className={`p-3 rounded-lg border ${p.enRetard ? "border-rose-200 bg-rose-50/40" : "border-slate-100"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{p.titre}</p>
                            {p.enRetard && <span className="text-xs text-rose-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />Retard</span>}
                          </div>
                          {p.responsable && <p className="text-xs text-slate-400">{p.responsable.prenom} {p.responsable.nom}</p>}
                        </div>
                        {p.dateEcheance && (
                          <p className={`text-xs ${p.enRetard ? "text-rose-600 font-medium" : "text-slate-400"}`}>
                            {new Date(p.dateEcheance).toLocaleDateString("fr-FR")}
                          </p>
                        )}
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
    </div>
  );
}
