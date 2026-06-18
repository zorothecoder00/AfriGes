"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  slugToEnum, commissionLabel, roleLabel,
  COMMISSION_ROLES, COMMISSION_ROLE_LABELS, COMMISSION_ROLE_POWERS,
} from "@/lib/commissionsRIA";
import {
  Shield, Users, Calendar, Gavel, ListChecks, MessageSquare,
  ArrowLeft, AlertTriangle, Pin, Plus, Pencil, Trash2, Check, X, Search, UserPlus,
  CheckCircle2, KeyRound, Copy,
} from "lucide-react";

interface Membre {
  id: number; role: string;
  user: { id: number; nom: string; prenom: string; photo: string | null };
}
interface Reunion { id: number; titre: string; dateHeure: string; statut: string; _count: { resolutions: number } }
interface Resolution { id: number; numero: string; titre: string; statut: string; dateEcheance: string | null }
interface Plan {
  id: number; titre: string; statut: string; progression: number;
  dateEcheance: string | null; priorite: string;
  responsable: { id: number; nom: string; prenom: string } | null;
}
interface Observation {
  id: number; type: string; contenu: string; epingle: boolean; createdAt: string;
  auteur: { id: number; nom: string; prenom: string };
}
interface Data {
  typeCommission: string; monRole: string | null;
  membres: Membre[]; reunions: Reunion[]; resolutions: Resolution[];
  plansAction: Plan[]; observations: Observation[];
}

const STATUT_PLAN: Record<string, string> = {
  A_FAIRE: "bg-slate-100 text-slate-600", NON_DEMARRE: "bg-slate-100 text-slate-600",
  EN_COURS: "bg-blue-100 text-blue-700", EN_RETARD: "bg-rose-100 text-rose-700",
  TERMINE: "bg-emerald-100 text-emerald-700", REALISE: "bg-emerald-100 text-emerald-700",
  ABANDONNE: "bg-slate-100 text-slate-400",
};

function roleBadge(role: string) {
  if (role === "PRESIDENT") return "bg-amber-100 text-amber-700";
  if (role.startsWith("RAPPORTEUR")) return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

// ── Ligne membre (mode président : édition du rôle + retrait) ──────────────────
function MembreRow({ m, editable, onDone }: { m: Membre; editable: boolean; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(m.role);
  const base = `/api/membreCommission/membres/${m.id}`;
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
    <div className="flex items-center gap-3 p-2 rounded-lg border border-slate-100">
      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
        {m.user.prenom[0]}{m.user.nom[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 truncate">{m.user.prenom} {m.user.nom}</p>
      </div>
      {editable && editing ? (
        <>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400">
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
          <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge(m.role)}`}>{roleLabel(m.role)}</span>
          {editable && (
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
          )}
        </>
      )}
    </div>
  );
}

interface UserLite { id: number; nom: string; prenom: string; email: string; role: string }

// ── Modal d'ajout de membre (président) ───────────────────────────────────────
function AddMembreModal({ typeCommission, onClose, onDone }: {
  typeCommission: string; onClose: () => void; onDone: () => void;
}) {
  const [mode, setMode] = useState<"existant" | "compte">("existant");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserLite | null>(null);
  const [role, setRole] = useState<string>("RAPPORTEUR_2");
  const [compte, setCompte] = useState({ nom: "", prenom: "", email: "", telephone: "", password: "" });
  const [cred, setCred] = useState<{ email: string; motDePasse: string } | null>(null);
  const { mutate, loading } = useMutation("/api/membreCommission/membres", "POST");

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
                <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50/50 rounded-lg px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {selected.prenom[0]}{selected.nom[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{selected.prenom} {selected.nom}</p>
                    <p className="text-xs text-slate-400 truncate">{selected.email}</p>
                  </div>
                  <button type="button" onClick={() => { setSelected(null); setSearch(""); }}
                    className="text-xs text-emerald-600 hover:underline shrink-0">Changer</button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
                  <input value={compte.nom} onChange={e => setCompte(c => ({ ...c, nom: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email (identifiant) *</label>
                <input type="email" value={compte.email} onChange={e => setCompte(c => ({ ...c, email: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="membre@exemple.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Téléphone</label>
                  <input value={compte.telephone} onChange={e => setCompte(c => ({ ...c, telephone: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe</label>
                  <input type="text" value={compte.password} onChange={e => setCompte(c => ({ ...c, password: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
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
              className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {loading ? "Enregistrement..." : mode === "compte" ? "Créer le compte" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MaCommissionDetailPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = use(params);
  const enumType = slugToEnum(type);
  const [refresh, setRefresh] = useState(0);
  const [showAddMembre, setShowAddMembre] = useState(false);
  const { data, loading } = useApi<Data>(
    enumType ? `/api/membreCommission/commissions/${enumType}?_r=${refresh}` : null
  );

  const isPresident = data?.monRole === "PRESIDENT";

  function done() {
    setShowAddMembre(false);
    setRefresh(r => r + 1);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <Link href="/dashboard/user/gouvernance"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Mes commissions
        </Link>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-600" />
          {enumType ? commissionLabel(enumType) : "Commission inconnue"}
        </h1>
        {data?.monRole && (
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(data.monRole)}`}>
            Mon rôle : {roleLabel(data.monRole)}
          </span>
        )}
      </div>

      {!enumType ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Commission introuvable</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Accès refusé — vous n&apos;êtes pas membre de cette commission</p>
        </div>
      ) : (
        <>
          {/* Membres */}
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4" /> Membres ({data.membres.length})
              </h2>
              {isPresident && (
                <button onClick={() => setShowAddMembre(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.membres.map(m => (
                <MembreRow key={m.id} m={m} editable={!!isPresident} onDone={done} />
              ))}
              {data.membres.length === 0 && (
                <p className="text-center py-6 text-sm text-slate-400 sm:col-span-2">Aucun membre</p>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Réunions */}
            <section className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Réunions récentes
              </h2>
              {data.reunions.length === 0 ? <p className="text-xs text-slate-400">Aucune réunion</p> : (
                <div className="space-y-2">
                  {data.reunions.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs border border-slate-100 rounded-lg px-3 py-2">
                      <span className="font-medium text-slate-700 truncate">{r.titre}</span>
                      <span className="text-slate-400 shrink-0 ml-2">{new Date(r.dateHeure).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Résolutions */}
            <section className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Gavel className="w-4 h-4" /> Résolutions récentes
              </h2>
              {data.resolutions.length === 0 ? <p className="text-xs text-slate-400">Aucune résolution</p> : (
                <div className="space-y-2">
                  {data.resolutions.map(r => (
                    <div key={r.id} className="text-xs border border-slate-100 rounded-lg px-3 py-2">
                      <span className="font-mono text-slate-400">{r.numero}</span>
                      <span className="text-slate-700 ml-2">{r.titre}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Plans d'action */}
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <ListChecks className="w-4 h-4" /> Plans d&apos;action
            </h2>
            {data.plansAction.length === 0 ? <p className="text-xs text-slate-400">Aucun plan d&apos;action</p> : (
              <div className="space-y-2">
                {data.plansAction.map(p => (
                  <div key={p.id} className="flex items-center gap-3 text-xs border border-slate-100 rounded-lg px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full ${STATUT_PLAN[p.statut] || "bg-slate-100 text-slate-600"}`}>{p.statut}</span>
                    <span className="text-slate-700 flex-1 truncate">{p.titre}</span>
                    {p.responsable && <span className="text-slate-400 shrink-0">{p.responsable.prenom} {p.responsable.nom}</span>}
                    <span className="text-slate-500 shrink-0 w-10 text-right">{p.progression}%</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Observations */}
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Collaboration récente
            </h2>
            {data.observations.length === 0 ? <p className="text-xs text-slate-400">Aucune observation</p> : (
              <div className="space-y-2">
                {data.observations.map(o => (
                  <div key={o.id} className={`text-xs rounded-lg px-3 py-2 border ${o.epingle ? "border-amber-200 bg-amber-50/40" : "border-slate-100"}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      {o.epingle && <Pin className="w-3 h-3 text-amber-500" />}
                      <span className="font-medium text-slate-500">{o.type}</span>
                      <span className="text-slate-400">· {o.auteur.prenom} {o.auteur.nom}</span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-line">{o.contenu}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {showAddMembre && enumType && (
        <AddMembreModal typeCommission={enumType} onClose={() => setShowAddMembre(false)} onDone={done} />
      )}
    </div>
  );
}
