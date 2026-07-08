"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft, Save, Loader2, RotateCcw, Check, X, Minus, Search, Users } from "lucide-react";
import { useApi } from "@/hooks/useApi";

type Matrix = Record<string, Record<string, Record<string, boolean>>>; // role → module → action → bool
interface PermsResponse {
  data: Matrix;
  roles: string[];
  modules: { key: string; label: string }[];
  actions: { key: string; label: string }[];
}

const ROLE_LABEL: Record<string, string> = {
  CHEF_AGENCE: "Chef d'agence", RESPONSABLE_ECONOMIQUE: "Responsable économique", CAISSIER: "Caissier",
  RESPONSABLE_VENTE_CREDIT: "Responsable vente crédit", AGENT_TERRAIN: "Agent terrain", COMPTABLE: "Comptable",
  MAGAZINIER: "Magasinier", AGENT_LOGISTIQUE_APPROVISIONNEMENT: "Agent logistique",
  RESPONSABLE_POINT_DE_VENTE: "Responsable PDV", RESPONSABLE_RH: "Responsable RH", AUDITEUR_INTERNE: "Auditeur interne",
};
const roleLabel = (r: string) => ROLE_LABEL[r] ?? r.replace(/_/g, " ");

export default function PermissionsPage() {
  const { data: res, loading } = useApi<PermsResponse>("/api/admin/permissions");
  const [tab, setTab] = useState<"role" | "user">("role");

  const modules = res?.modules ?? [];
  const actions = res?.actions ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard/admin/droits-acces" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Droits d&apos;accès
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mt-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" /> Rôles &amp; permissions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestion granulaire des 6 actions (Lecture, Création, Modification, Validation, Export, Suppression logique) par rôle et par utilisateur.
          </p>
        </div>

        <div className="flex gap-1 border-b border-gray-200">
          {([["role", "Par rôle"], ["user", "Par utilisateur"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
              {label}
            </button>
          ))}
        </div>

        {loading && !res ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…</div>
        ) : tab === "role" ? (
          <RoleMatrix res={res!} modules={modules} actions={actions} />
        ) : (
          <UserOverrides modules={modules} actions={actions} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Onglet « Par rôle » ─────────────────────────── */
function RoleMatrix({ res, modules, actions }: {
  res: PermsResponse; modules: { key: string; label: string }[]; actions: { key: string; label: string }[];
}) {
  const [role, setRole] = useState<string>(res.roles[0] ?? "");
  const [draft, setDraft] = useState<Matrix>(() => structuredClone(res.data));
  const [saving, setSaving] = useState(false);
  const original = res.data;

  const dirty = useMemo(() => {
    if (!role || !draft[role]) return [];
    const out: { module: string; action: string; allowed: boolean }[] = [];
    for (const m of modules) for (const a of actions) {
      const now = draft[role]?.[m.key]?.[a.key];
      if (now !== original[role]?.[m.key]?.[a.key]) out.push({ module: m.key, action: a.key, allowed: !!now });
    }
    return out;
  }, [draft, original, role, modules, actions]);

  const toggle = (m: string, a: string) => setDraft((p) => { const n = structuredClone(p); n[role][m][a] = !n[role][m][a]; return n; });
  const toggleRow = (m: string, v: boolean) => setDraft((p) => { const n = structuredClone(p); for (const a of actions) n[role][m][a.key] = v; return n; });
  const reset = () => setDraft((p) => ({ ...p, [role]: structuredClone(original[role]) }));

  const save = async () => {
    if (!dirty.length) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/permissions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, entries: dirty }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Permissions enregistrées ✓");
      for (const e of dirty) original[role][e.module][e.action] = e.allowed;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {res.roles.map((r) => (
          <button key={r} onClick={() => setRole(r)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${role === r ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            {roleLabel(r)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Module</th>
                {actions.map((a) => <th key={a.key} className="px-3 py-3 font-semibold text-gray-500 uppercase text-[10px] tracking-wide text-center whitespace-nowrap">{a.label}</th>)}
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {modules.map((m) => {
                const rowAllOn = actions.every((a) => draft[role]?.[m.key]?.[a.key]);
                return (
                  <tr key={m.key} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-800">{m.label}</td>
                    {actions.map((a) => {
                      const on = !!draft[role]?.[m.key]?.[a.key];
                      return (
                        <td key={a.key} className="px-3 py-3 text-center">
                          <button onClick={() => toggle(m.key, a.key)} aria-pressed={on}
                            className={`w-6 h-6 rounded-md border inline-flex items-center justify-center transition-colors ${on ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-300 hover:border-indigo-400"}`}>
                            {on && <Check className="w-4 h-4" />}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => toggleRow(m.key, !rowAllOn)} className="text-[11px] text-indigo-600 hover:underline whitespace-nowrap">
                        {rowAllOn ? "Tout retirer" : "Tout cocher"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-400">
          {dirty.length ? `${dirty.length} modification(s) non enregistrée(s)` : "Aucune modification"} · Admin/Super-admin ont toutes les permissions.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={reset} disabled={!dirty.length} className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40">
            <RotateCcw className="w-4 h-4" /> Annuler
          </button>
          <button onClick={save} disabled={saving || !dirty.length} className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
          </button>
        </div>
      </div>
    </>
  );
}

/* ────────────────────────── Onglet « Par utilisateur » ────────────────────── */
type Tri = "inherit" | "allow" | "deny";
interface Gestionnaire { id: number; role: string; member: { id: number; nom: string; prenom: string; email: string | null } }
interface UserPermsResponse { data: Record<string, Record<string, { effective: boolean; overridden: boolean }>>; role: string | null }

function UserOverrides({ modules, actions }: { modules: { key: string; label: string }[]; actions: { key: string; label: string }[] }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Gestionnaire[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{ userId: number; name: string; role: string | null } | null>(null);
  const [base, setBase] = useState<UserPermsResponse["data"]>({});
  const [draft, setDraft] = useState<Record<string, Record<string, Tri>>>({});
  const [loadingUser, setLoadingUser] = useState(false);
  const [saving, setSaving] = useState(false);

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/admin/gestionnaires?search=${encodeURIComponent(search.trim())}&limit=8`);
      const j = await r.json();
      setResults(j.data ?? []);
    } catch { toast.error("Recherche impossible"); }
    finally { setSearching(false); }
  };

  const pick = async (g: Gestionnaire) => {
    setSelected({ userId: g.member.id, name: `${g.member.prenom} ${g.member.nom}`, role: g.role });
    setResults([]); setSearch("");
    setLoadingUser(true);
    try {
      const r = await fetch(`/api/admin/permissions/user/${g.member.id}`);
      const j = (await r.json()) as UserPermsResponse;
      setBase(j.data);
      const d: Record<string, Record<string, Tri>> = {};
      for (const m of modules) { d[m.key] = {}; for (const a of actions) {
        const cell = j.data[m.key]?.[a.key];
        d[m.key][a.key] = cell?.overridden ? (cell.effective ? "allow" : "deny") : "inherit";
      } }
      setDraft(d);
    } catch { toast.error("Chargement impossible"); }
    finally { setLoadingUser(false); }
  };

  const cycle = (m: string, a: string) => setDraft((p) => {
    const cur = p[m][a]; const next: Tri = cur === "inherit" ? "allow" : cur === "allow" ? "deny" : "inherit";
    return { ...p, [m]: { ...p[m], [a]: next } };
  });

  const initialTri = (m: string, a: string): Tri => {
    const cell = base[m]?.[a];
    return cell?.overridden ? (cell.effective ? "allow" : "deny") : "inherit";
  };
  const dirty = useMemo(() => {
    const out: { module: string; action: string; granted: boolean | null }[] = [];
    for (const m of modules) for (const a of actions) {
      const now = draft[m.key]?.[a.key]; if (!now) continue;
      if (now !== initialTri(m.key, a.key)) out.push({ module: m.key, action: a.key, granted: now === "allow" ? true : now === "deny" ? false : null });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, base, modules, actions]);

  const save = async () => {
    if (!selected || !dirty.length) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/permissions/user/${selected.userId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: dirty }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Overrides enregistrés ✓");
      // Recharge l'état de référence.
      pick({ id: 0, role: selected.role ?? "", member: { id: selected.userId, nom: "", prenom: selected.name, email: null } } as Gestionnaire);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <>
      {/* Recherche utilisateur */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
              placeholder="Rechercher un utilisateur (nom, prénom, email)…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button onClick={doSearch} disabled={searching} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Chercher"}
          </button>
        </div>
        {results.length > 0 && (
          <div className="mt-3 divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {results.map((g) => (
              <button key={g.id} onClick={() => pick(g)} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2">
                <span className="text-sm text-gray-800">{g.member.prenom} {g.member.nom} <span className="text-xs text-gray-400">· {g.member.email ?? "—"}</span></span>
                <span className="text-[11px] text-indigo-600">{roleLabel(g.role)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <>
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-indigo-500" />
            <span className="font-semibold text-gray-800">{selected.name}</span>
            {selected.role && <span className="text-xs text-gray-400">· rôle : {roleLabel(selected.role)}</span>}
          </div>

          {loadingUser ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Module</th>
                        {actions.map((a) => <th key={a.key} className="px-3 py-3 font-semibold text-gray-500 uppercase text-[10px] tracking-wide text-center whitespace-nowrap">{a.label}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {modules.map((m) => (
                        <tr key={m.key} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3 font-medium text-gray-800">{m.label}</td>
                          {actions.map((a) => {
                            const tri = draft[m.key]?.[a.key] ?? "inherit";
                            const inheritedOn = base[m.key]?.[a.key]?.effective;
                            const cls = tri === "allow" ? "bg-emerald-600 border-emerald-600 text-white"
                              : tri === "deny" ? "bg-red-600 border-red-600 text-white"
                                : "bg-white border-dashed border-gray-300 text-gray-400";
                            return (
                              <td key={a.key} className="px-3 py-3 text-center">
                                <button onClick={() => cycle(m.key, a.key)} title={tri === "inherit" ? `Hérité (${inheritedOn ? "autorisé" : "refusé"})` : tri === "allow" ? "Forcé autorisé" : "Forcé refusé"}
                                  className={`w-6 h-6 rounded-md border inline-flex items-center justify-center transition-colors ${cls}`}>
                                  {tri === "allow" ? <Check className="w-4 h-4" /> : tri === "deny" ? <X className="w-4 h-4" /> : <Minus className="w-3.5 h-3.5" />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1"><Minus className="w-3 h-3" /> hérité du rôle</span>
                  {" · "}<span className="inline-flex items-center gap-1"><Check className="w-3 h-3 text-emerald-600" /> forcé autorisé</span>
                  {" · "}<span className="inline-flex items-center gap-1"><X className="w-3 h-3 text-red-600" /> forcé refusé</span>
                </p>
                <button onClick={save} disabled={saving || !dirty.length} className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer{dirty.length ? ` (${dirty.length})` : ""}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
