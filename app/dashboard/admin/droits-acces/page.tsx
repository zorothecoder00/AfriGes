"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Shield, Users, RefreshCw, CheckCircle2, XCircle, Eye,
  Lock, Unlock, ChevronDown, ChevronUp, Info, Save,
  Crown, FileText, Gavel, UserCheck,
  ClipboardList, Search, ShieldCheck,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RoleData {
  [section: string]: boolean;
}
interface AccessData {
  [role: string]: RoleData;
}
interface ApiResponse {
  success: boolean;
  data: AccessData;
  activeModules: string[];
}

// ─── Matrice des droits Gouvernance RIA ─────────────────────────────────────
const COMMISSION_MATRIX = [
  {
    role: "Direction Générale",
    roleKey: "ADMIN",
    color: "bg-violet-100 text-violet-700",
    icon: Shield,
    capabilities: [
      { label: "Toutes commissions",        allowed: true },
      { label: "Tous rapports",             allowed: true },
      { label: "Toutes données",            allowed: true },
      { label: "Créer réunions",            allowed: true },
      { label: "Valider rapports",          allowed: true },
      { label: "Créer résolutions",         allowed: true },
      { label: "Affecter tâches",           allowed: true },
      { label: "Gérer membres",             allowed: true },
    ],
  },
  {
    role: "Président de Commission",
    roleKey: "PRESIDENT_COMMISSION_RIA",
    color: "bg-amber-100 text-amber-700",
    icon: Crown,
    capabilities: [
      { label: "Accès complet à sa commission", allowed: true },
      { label: "Créer réunions",            allowed: true },
      { label: "Valider rapports",          allowed: true },
      { label: "Créer résolutions",         allowed: true },
      { label: "Affecter tâches",           allowed: true },
      { label: "Gérer membres commission",  allowed: true },
      { label: "Accès autres commissions",  allowed: false },
    ],
  },
  {
    role: "Rapporteur 1",
    roleKey: "RAPPORTEUR_1",
    color: "bg-blue-100 text-blue-700",
    icon: FileText,
    capabilities: [
      { label: "Consulter données commission", allowed: true },
      { label: "Préparer analyses",         allowed: true },
      { label: "Créer brouillons",          allowed: true },
      { label: "Générer rapports",          allowed: true },
      { label: "Rédiger comptes rendus",    allowed: true },
      { label: "Valider définitivement",    allowed: false },
      { label: "Créer résolutions",         allowed: false },
    ],
  },
  {
    role: "Rapporteur 2",
    roleKey: "RAPPORTEUR_2",
    color: "bg-cyan-100 text-cyan-700",
    icon: ClipboardList,
    capabilities: [
      { label: "Vérifier dossiers",         allowed: true },
      { label: "Modifier analyses",         allowed: true },
      { label: "Produire observations",     allowed: true },
      { label: "Générer rapports",          allowed: true },
      { label: "Valider définitivement",    allowed: false },
      { label: "Créer résolutions",         allowed: false },
      { label: "Affecter tâches",           allowed: false },
    ],
  },
  {
    role: "Chef d'Agence",
    roleKey: "CHEF_AGENCE",
    color: "bg-indigo-100 text-indigo-700",
    icon: UserCheck,
    capabilities: [
      { label: "Consultation données agence", allowed: true },
      { label: "Vue PDVs de l'agence",      allowed: true },
      { label: "Supervision ventes",        allowed: true },
      { label: "Supervision caisse",        allowed: true },
      { label: "Affecter agents",           allowed: true },
      { label: "Valider opérations",        allowed: false },
    ],
  },
  {
    role: "Responsable Point de Vente (RPV)",
    roleKey: "RESPONSABLE_POINT_DE_VENTE",
    color: "bg-sky-100 text-sky-700",
    icon: Users,
    capabilities: [
      { label: "Consultation données PDV",  allowed: true },
      { label: "Supervision ventes",        allowed: true },
      { label: "Supervision caisse",        allowed: true },
      { label: "Supervision stock",         allowed: true },
      { label: "Gérer son équipe",          allowed: true },
      { label: "Valider opérations",        allowed: false },
    ],
  },
];

// ─── Labels rôles ────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  RESPONSABLE_POINT_DE_VENTE:         { label: "Responsable PDV (RPV)",        color: "bg-blue-50 text-blue-700 border-blue-200" },
  CHEF_AGENCE:                         { label: "Chef d'agence",                color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  CAISSIER:                            { label: "Caissier",                      color: "bg-green-50 text-green-700 border-green-200" },
  MAGAZINIER:                          { label: "Magasinier",                    color: "bg-amber-50 text-amber-700 border-amber-200" },
  AGENT_LOGISTIQUE_APPROVISIONNEMENT:  { label: "Agent Logistique",              color: "bg-orange-50 text-orange-700 border-orange-200" },
  COMPTABLE:                           { label: "Comptable",                     color: "bg-teal-50 text-teal-700 border-teal-200" },
  AGENT_TERRAIN:                       { label: "Agent Terrain",                 color: "bg-lime-50 text-lime-700 border-lime-200" },
  RESPONSABLE_RH:                      { label: "Responsable RH",               color: "bg-rose-50 text-rose-700 border-rose-200" },
  PRESIDENT_COMMISSION_RIA:            { label: "Président Commission RIA",      color: "bg-amber-50 text-amber-700 border-amber-200" },
  RAPPORTEUR_COMMISSION_RIA:           { label: "Rapporteur Commission RIA",     color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
};

// ─── Composant toggle ────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-emerald-500" : "bg-slate-200"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

// ─── Tab: Configuration des rôles opérationnels ──────────────────────────────
function ConfigTab({ data, refresh }: { data: ApiResponse; refresh: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, Record<string, boolean>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { mutate } = useMutation("/api/admin/acces-roles", "PUT");

  const roles = Object.keys(data.data);
  const merged = (role: string, section: string) =>
    pending[role]?.[section] !== undefined ? pending[role][section] : data.data[role][section];

  function toggle(role: string, section: string, val: boolean) {
    setPending(p => ({ ...p, [role]: { ...(p[role] || {}), [section]: val } }));
  }

  async function save(role: string) {
    setSaving(role);
    const sections = Object.entries(data.data[role]).map(([key]) => ({
      key, allowed: merged(role, key),
    }));
    const res = await mutate({ role, sections }) as { success?: boolean } | null;
    if (res?.success) {
      toast.success(`Droits sauvegardés pour ${ROLE_LABELS[role]?.label ?? role}`);
      setPending(p => { const n = { ...p }; delete n[role]; return n; });
      refresh();
    } else {
      toast.error("Erreur lors de la sauvegarde");
    }
    setSaving(null);
  }

  return (
    <div className="space-y-3">
      {roles.map(role => {
        const meta = ROLE_LABELS[role] || { label: role, color: "bg-slate-50 text-slate-700 border-slate-200" };
        const sections = data.data[role];
        const isDirty = !!pending[role] && Object.keys(pending[role]).length > 0;
        const isExpanded = expanded === role;

        return (
          <div key={role} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(isExpanded ? null : role)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${meta.color}`}>{meta.label}</span>
                <span className="text-xs text-slate-400">{Object.keys(sections).length} sections</span>
                {isDirty && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Modifié</span>}
              </div>
              <div className="flex items-center gap-3">
                {isDirty && (
                  <button
                    onClick={e => { e.stopPropagation(); save(role); }}
                    disabled={saving === role}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving === role ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                )}
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 px-5 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(sections).map(([key]) => {
                    const val = merged(role, key);
                    return (
                      <div key={key} className={`flex items-center justify-between p-3 rounded-lg border ${val ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50/30"}`}>
                        <span className="text-sm text-slate-700">{key.replace(/_/g, " ")}</span>
                        <Toggle
                          checked={val}
                          onChange={v => toggle(role, key, v)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Gouvernance RIA ────────────────────────────────────────────────────
function GouvernanceTab() {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">Droits au niveau de la commission</p>
          <p>Ces droits sont appliqués selon le rôle de chaque membre <strong>au sein de sa commission</strong> (PRESIDENT, RAPPORTEUR_1, RAPPORTEUR_2). Ils sont définis au niveau applicatif et ne peuvent pas être modifiés par rôle global.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {COMMISSION_MATRIX.map(({ role, color, icon: Icon, capabilities }) => (
          <div key={role} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className={`px-4 py-3 flex items-center gap-2 ${color}`}>
              <Icon className="w-4 h-4" />
              <h3 className="text-sm font-semibold">{role}</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {capabilities.map(({ label, allowed }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-slate-600">{label}</span>
                  {allowed
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <XCircle className="w-4 h-4 text-rose-400" />
                  }
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Vue d'ensemble ─────────────────────────────────────────────────────
function OverviewTab({ data }: { data: ApiResponse }) {
  const [search, setSearch] = useState("");
  const roles = Object.entries(data.data).filter(([role]) =>
    !search || (ROLE_LABELS[role]?.label ?? role).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un rôle..."
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Direction générale */}
        <div className="bg-white border border-violet-200 rounded-xl overflow-hidden">
          <div className="bg-violet-50 px-4 py-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-600" />
            <h3 className="text-sm font-semibold text-violet-700">Direction Générale (Admin)</h3>
          </div>
          <div className="p-4 space-y-1.5">
            {["Toutes commissions", "Tous rapports", "Toutes données", "Configuration système", "Gestion utilisateurs"].map(cap => (
              <div key={cap} className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                {cap}
              </div>
            ))}
          </div>
        </div>

        {roles.map(([role, sections]) => {
          const meta = ROLE_LABELS[role] || { label: role, color: "bg-slate-50 text-slate-700 border-slate-200" };
          const allowed = Object.values(sections).filter(Boolean).length;
          const total   = Object.values(sections).length;
          const pct = total > 0 ? Math.round((allowed / total) * 100) : 0;

          return (
            <div key={role} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className={`px-4 py-3 flex items-center justify-between ${meta.color.replace("border-", "border-l-4 border-l-")}`}>
                <span className="text-sm font-semibold">{meta.label}</span>
                <span className="text-xs opacity-70">{allowed}/{total} sections actives</span>
              </div>
              <div className="px-4 py-3">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="space-y-1">
                  {Object.entries(sections).slice(0, 5).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs text-slate-500">
                      {val
                        ? <Unlock className="w-3 h-3 text-emerald-500" />
                        : <Lock className="w-3 h-3 text-rose-400" />
                      }
                      {key.replace(/_/g, " ")}
                    </div>
                  ))}
                  {Object.keys(sections).length > 5 && (
                    <p className="text-xs text-slate-400 pl-5">+ {Object.keys(sections).length - 5} autres…</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────
const TABS = [
  { key: "overview",      label: "Vue d'ensemble",    icon: Eye },
  { key: "config",        label: "Configuration",      icon: Shield },
  { key: "gouvernance",   label: "Gouvernance RIA",   icon: Gavel },
] as const;
type Tab = typeof TABS[number]["key"];

export default function DroitsAccesPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<ApiResponse>(`/api/admin/acces-roles?_r=${refresh}`);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-600" /> Système de Droits d&apos;Accès
          </h1>
          <p className="text-sm text-slate-500">Contrôle des permissions par rôle et par utilisateur</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/admin/permissions"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
            <ShieldCheck className="w-4 h-4" /> Permissions granulaires
          </Link>
          <button onClick={() => setRefresh(r => r + 1)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{Object.keys(data.data).length + 1}</p>
            <p className="text-xs text-slate-500 mt-1">Rôles configurés</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{data.activeModules.length}</p>
            <p className="text-xs text-slate-500 mt-1">Modules actifs</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {Object.values(data.data).reduce((acc, sections) =>
                acc + Object.values(sections).filter(Boolean).length, 0)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Sections autorisées</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === key ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data ? (
            <p className="text-center text-sm text-slate-400 py-12">Erreur de chargement</p>
          ) : (
            <>
              {tab === "overview"    && <OverviewTab data={data} />}
              {tab === "config"      && <ConfigTab data={data} refresh={() => setRefresh(r => r + 1)} />}
              {tab === "gouvernance" && <GouvernanceTab />}
            </>
          )}
        </div>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-6 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Accès autorisé</span>
        <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-rose-400" /> Accès refusé</span>
        <span className="flex items-center gap-1.5"><Unlock className="w-3.5 h-3.5 text-emerald-500" /> Section active</span>
        <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-rose-400" /> Section bloquée</span>
        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400" /> Les droits des modules inactifs sont automatiquement bloqués</span>
      </div>
    </div>
  );
}
