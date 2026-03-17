"use client";

import React, { useState, useCallback } from "react";
import {
  Shield, Users, Settings, Layers, FileText, Activity,
  HardDrive, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Search, Download, Eye, EyeOff, Lock, Unlock, LogOut,
  Key, ToggleLeft, ToggleRight, Save, ArrowLeft, Bell,
  Database, Server, Clock, TrendingUp, Package, Banknote,
  ChevronRight, UserX, UserCheck, Zap, Filter, X, Info,
  ShieldAlert, ShieldCheck, Terminal, Globe, Palette,
  Hash, BarChart3, Wrench,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useApi, useMutation } from "@/hooks/useApi";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "systeme" | "utilisateurs" | "parametres" | "modules" | "logs";
type ParamSection = "platform" | "numbering" | "security" | "accounting" | "financial" | "stock" | "backup";
type LogType = "audit" | "security";

interface StatsData {
  utilisateurs: { total: number; actifs: number; suspendus: number; inactifs: number };
  operations:   { clients: number; pdvActifs: number; souscriptionsActives: number; ventes24h: number; ventesCA: number };
  stock:        { rupture: number; faible: number };
  systeme:      { caissesOuvertes: number; notificationsNonLues: number; securityLogs24h: number };
  alertes:      { type: string; message: string; priorite: string }[];
  logsRecents:  { id: number; action: string; entite: string; entiteId: number | null; date: string; user: string; role: string | null }[];
}

interface UserSA {
  id: number; nom: string; prenom: string; email: string;
  telephone: string | null; role: string | null; etat: string;
  dateAdhesion: string; createdAt: string;
  gestionnaire: { role: string; actif: boolean } | null;
  userPermissions: { module: string; permission: string; granted: boolean }[];
  _count: { auditLogs: number };
  derniereActivite: { action: string; createdAt: string } | null;
}

interface UsersResponse {
  data: UserSA[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface SettingsData { success: boolean; data: Record<string, string> }
interface ModuleItem { id: number; key: string; nom: string; description: string | null; actif: boolean }
interface ModulesResponse { success: boolean; data: ModuleItem[] }
interface LogItem {
  id: number; action: string; entite?: string; entiteId?: number | null;
  userEmail?: string; details?: string | null; ipAddress?: string | null;
  createdAt: string;
  user: { nom: string; prenom: string; email?: string; role: string | null } | null;
}
interface LogsResponse { data: LogItem[]; meta: { total: number; page: number; totalPages: number; limit: number } }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`${bg} p-2.5 rounded-xl`}><Icon className={`${color} w-5 h-5`} /></div>
      </div>
      <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const prioriteStyle: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-700 border-red-200",
  HAUTE:    "bg-amber-100 text-amber-700 border-amber-200",
  NORMALE:  "bg-blue-100 text-blue-700 border-blue-200",
};

const etatStyle: Record<string, { bg: string; text: string; label: string }> = {
  ACTIF:     { bg: "bg-emerald-100", text: "text-emerald-700", label: "Actif" },
  SUSPENDU:  { bg: "bg-red-100",     text: "text-red-700",     label: "Suspendu" },
  INACTIF:   { bg: "bg-slate-100",   text: "text-slate-600",   label: "Inactif" },
};

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const { data: session } = useSession();
  const { applyAndPersist } = useAppSettings();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const isAdmin      = session?.user?.role === "ADMIN"; // admin simple (droits restreints)

  const [activeTab, setActiveTab] = useState<TabKey>("systeme");

  // ── États utilisateurs
  const [userSearch, setUserSearch]   = useState("");
  const [userEtat,   setUserEtat]     = useState("");
  const [userPage,   setUserPage]     = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserSA | null>(null);
  const [modalUser, setModalUser]     = useState<"detail" | "reset" | "permission" | null>(null);
  const [motifAction, setMotifAction] = useState("");
  const [tempPwd,    setTempPwd]      = useState("");
  const [permModule,  setPermModule]  = useState("");
  const [permPerm,    setPermPerm]    = useState("");
  const [permGranted, setPermGranted] = useState(true);
  const [processingUserId, setProcessingUserId] = useState<number | null>(null);

  // ── États paramètres
  const [paramSection, setParamSection] = useState<ParamSection>("platform");
  const [settings, setSettings]  = useState<Record<string, string>>({});
  const [settingsDirty, setSettingsDirty] = useState(false);

  // ── États logs
  const [logType,  setLogType]   = useState<LogType>("audit");
  const [logSearch, setLogSearch] = useState("");
  const [logPage,  setLogPage]   = useState(1);

  // ── Fetches
  const { data: statsRes, refetch: refetchStats } = useApi<StatsData>("/api/superadmin/stats");
  const usersParams = new URLSearchParams({ page: String(userPage), limit: "20", ...(userSearch ? { search: userSearch } : {}), ...(userEtat ? { etat: userEtat } : {}) }).toString();
  const { data: usersRes, refetch: refetchUsers } = useApi<UsersResponse>(activeTab === "utilisateurs" ? `/api/superadmin/users?${usersParams}` : null);
  const { data: settingsRes } = useApi<SettingsData>(activeTab === "parametres" ? "/api/superadmin/settings" : null);
  const { data: modulesRes, refetch: refetchModules } = useApi<ModulesResponse>(activeTab === "modules" ? "/api/superadmin/modules" : null);
  const logsParams = new URLSearchParams({ page: String(logPage), limit: "30", type: logType, ...(logSearch ? { search: logSearch } : {}) }).toString();
  const { data: logsRes, refetch: refetchLogs } = useApi<LogsResponse>(activeTab === "logs" ? `/api/superadmin/audit-logs?${logsParams}` : null);

  // Sync settings depuis API → état local uniquement (pas de re-apply DOM ici,
  // sinon settingsDirty=false après save déclencherait un revert avec l'ancienne valeur cachée)
  React.useEffect(() => {
    if (settingsRes?.data && !settingsDirty) {
      setSettings(settingsRes.data);
      // Mettre à jour le localStorage (source de vérité côté client) sans toucher au DOM
      if (typeof window !== "undefined") {
        localStorage.setItem("afriges_app_settings", JSON.stringify(settingsRes.data));
      }
    }
  }, [settingsRes, settingsDirty]);

  // ── Mutations
  const actionUserIdRef = React.useRef<number | null>(null);
  const { mutate: doUserAction, loading: doingAction } = useMutation<{ success: boolean; tempPassword?: string; message: string }, unknown>(
    () => actionUserIdRef.current ? `/api/superadmin/users/${actionUserIdRef.current}/action` : "",
    "POST", { successMessage: "" }
  );
  const { mutate: saveSettings, loading: savingSettings } = useMutation<{ success: boolean }, unknown>("/api/superadmin/settings", "PATCH", { successMessage: "Paramètres sauvegardés ✓" });
  const moduleKeyRef = React.useRef("");
  const { mutate: toggleModule, loading: togglingModule } = useMutation<{ success: boolean }, unknown>("/api/superadmin/modules", "PATCH", { successMessage: "" });

  // ── Handlers
  const handleUserAction = useCallback(async (user: UserSA, action: string, extra?: Record<string, unknown>) => {
    actionUserIdRef.current = user.id;
    setProcessingUserId(user.id);
    const res = await doUserAction({ action, motif: motifAction || undefined, ...extra });
    setProcessingUserId(null);
    if (!res) return;
    if (action === "reset_password" && (res as { tempPassword?: string }).tempPassword) {
      setTempPwd((res as { tempPassword: string }).tempPassword);
    } else {
      toast.success((res as { message: string }).message);
      setModalUser(null); setMotifAction("");
      refetchUsers();
    }
    actionUserIdRef.current = null;
  }, [doUserAction, motifAction, refetchUsers]);

  const handleSaveSettings = useCallback(async () => {
    const res = await saveSettings(settings);
    if (res) {
      // Persiste dans localStorage + re-applique tout le jeu de settings au DOM
      applyAndPersist(settings);
      setSettingsDirty(false);
    }
  }, [saveSettings, settings, applyAndPersist]);

  // Clés dont le changement a un effet visuel immédiat (preview live)
  const VISUAL_KEYS = new Set(["platform.theme", "platform.langue", "platform.nom"]);

  const setSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
    // Applique immédiatement au DOM + met à jour le state React du contexte (re-render i18n)
    if (VISUAL_KEYS.has(key)) {
      applyAndPersist({ [key]: value });
    }
  };

  const handleToggleModule = useCallback(async (m: ModuleItem) => {
    moduleKeyRef.current = m.key;
    const res = await toggleModule({ key: m.key, actif: !m.actif });
    if (res) { toast.success(`Module "${m.nom}" ${!m.actif ? "activé" : "désactivé"}`); refetchModules(); }
  }, [toggleModule, refetchModules]);

  const handleExportLogs = () => {
    if (!logsRes?.data) return;
    const rows = [
      ["Date", "Action", "Entité", "Utilisateur", "Rôle"],
      ...logsRes.data.map((l) => [
        new Date(l.createdAt).toLocaleString("fr-FR"),
        l.action,
        l.entite ?? l.details ?? "",
        l.user ? `${l.user.prenom} ${l.user.nom}` : l.userEmail ?? "—",
        l.user?.role ?? "—",
      ]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `logs-${logType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // ── Guard rôle — ni ADMIN ni SUPER_ADMIN → accès refusé
  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl p-10 shadow text-center max-w-md">
          <ShieldAlert size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Accès refusé</h2>
          <p className="text-slate-500 mb-6">Cette section est réservée aux administrateurs.</p>
          <Link href="/dashboard/admin" className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700">Retour au tableau de bord</Link>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: "systeme",      label: "Vue système",     icon: Activity,  badge: statsRes?.alertes.length },
    { key: "utilisateurs", label: "Utilisateurs",    icon: Users,     badge: statsRes?.utilisateurs.suspendus },
    { key: "parametres",   label: "Paramètres",      icon: Settings },
    { key: "modules",      label: "Modules & Accès", icon: Layers },
    { key: "logs",         label: "Logs & Audit",    icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <div className={`${isSuperAdmin ? "bg-violet-600" : "bg-blue-600"} p-2 rounded-xl`}>
                <Shield className="text-white w-4 h-4" />
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-sm leading-none">
                  {isSuperAdmin ? "Super Administration" : "Administration système"}
                </h1>
                <p className={`text-xs font-medium ${isSuperAdmin ? "text-violet-500" : "text-blue-500"}`}>
                  {isSuperAdmin ? "Accès complet" : "Accès administrateur"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={refetchStats} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw size={16} />
            </button>
            <NotificationBell href="/dashboard/admin/notifications" />
            <span className="text-sm font-medium text-slate-600">{session?.user?.prenom} {session?.user?.nom}</span>
            <SignOutButton redirectTo="/auth/login?logout=success" className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-[57px] z-40">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto py-1 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all relative ${active ? "bg-violet-600 text-white shadow-md shadow-violet-200" : "text-slate-600 hover:bg-slate-100"}`}>
                  <Icon size={16} />
                  {tab.label}
                  {!!tab.badge && tab.badge > 0 && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">

        {/* ── Bandeau restrictions ADMIN simple ──────────────────────────── */}
        {isAdmin && (
          <div className="mb-5 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5">
            <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Accès Administrateur</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Vous avez accès à toutes les fonctionnalités d&apos;administration, à l&apos;exception de :
                la suppression définitive d&apos;utilisateurs, la gestion des comptes Super Administrateur,
                et la modification des permissions sur les rôles critiques.
              </p>
            </div>
          </div>
        )}

        {/* ═══ TAB SYSTEME ═══════════════════════════════════════════════════ */}
        {activeTab === "systeme" && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <KpiCard label="Utilisateurs total"  value={statsRes?.utilisateurs.total ?? "—"}     icon={Users}      color="text-violet-600" bg="bg-violet-50" />
              <KpiCard label="Actifs"              value={statsRes?.utilisateurs.actifs ?? "—"}    icon={UserCheck}  color="text-emerald-600" bg="bg-emerald-50" />
              <KpiCard label="Suspendus"           value={statsRes?.utilisateurs.suspendus ?? "—"} icon={UserX}      color="text-red-600" bg="bg-red-50" />
              <KpiCard label="PDV actifs"          value={statsRes?.operations.pdvActifs ?? "—"}   icon={Globe}      color="text-blue-600" bg="bg-blue-50" />
              <KpiCard label="Ventes 24h"          value={statsRes?.operations.ventes24h ?? "—"}   icon={TrendingUp} color="text-orange-600" bg="bg-orange-50" />
              <KpiCard label="CA confirmé"         value={formatCurrency(statsRes?.operations.ventesCA ?? 0)} icon={Banknote} color="text-teal-600" bg="bg-teal-50" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <KpiCard label="En rupture stock"      value={statsRes?.stock.rupture ?? "—"}            icon={Package}   color="text-red-500"    bg="bg-red-50" />
              <KpiCard label="Caisses ouvertes"      value={statsRes?.systeme.caissesOuvertes ?? "—"}  icon={Banknote}  color="text-amber-600"  bg="bg-amber-50" />
              <KpiCard label="Notifs non lues"       value={statsRes?.systeme.notificationsNonLues ?? "—"} icon={Bell} color="text-violet-600" bg="bg-violet-50" />
            </div>

            {/* Alertes critiques */}
            {(statsRes?.alertes.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="text-red-500 w-5 h-5" />
                  <h2 className="font-bold text-slate-800">Alertes système ({statsRes!.alertes.length})</h2>
                </div>
                <div className="space-y-2">
                  {statsRes!.alertes.map((a, i) => (
                    <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${prioriteStyle[a.priorite] ?? "bg-slate-50 border-slate-200 text-slate-700"}`}>
                      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold">[{a.priorite}]</span> {a.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Logs récents */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Terminal className="text-slate-500 w-5 h-5" />
                  <h2 className="font-bold text-slate-800">Activité récente</h2>
                </div>
                <button onClick={() => setActiveTab("logs")} className="text-xs text-violet-600 font-semibold hover:underline flex items-center gap-1">Voir tout <ChevronRight size={12} /></button>
              </div>
              <div className="space-y-1.5">
                {(statsRes?.logsRecents ?? []).slice(0, 12).map((l) => (
                  <div key={l.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0 gap-4">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-slate-600 truncate">{l.action}</p>
                        <p className="text-xs text-slate-400">{l.user} {l.role ? `(${l.role})` : ""}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">{formatDateTime(l.date)}</span>
                  </div>
                ))}
                {(statsRes?.logsRecents.length ?? 0) === 0 && <p className="text-sm text-slate-400 text-center py-4">Aucune activité récente</p>}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB UTILISATEURS ══════════════════════════════════════════════ */}
        {activeTab === "utilisateurs" && (
          <div className="space-y-5">
            {/* Filtres */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-48 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                <Search size={15} className="text-slate-400" />
                <input value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                  placeholder="Nom, prénom, email…" className="flex-1 bg-transparent text-sm outline-none" />
              </div>
              <select value={userEtat} onChange={(e) => { setUserEtat(e.target.value); setUserPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Tous statuts</option>
                <option value="ACTIF">Actif</option>
                <option value="SUSPENDU">Suspendu</option>
                <option value="INACTIF">Inactif</option>
              </select>
              <button onClick={refetchUsers} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"><RefreshCw size={15} /></button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Utilisateur</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Rôle</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Statut</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Dernière activité</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(usersRes?.data ?? []).map((u) => {
                      const es = etatStyle[u.etat] ?? etatStyle.INACTIF;
                      const busy = processingUserId === u.id;
                      return (
                        <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-800">{u.prenom} {u.nom}</p>
                              <p className="text-xs text-slate-400">{u.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-violet-50 text-violet-700 font-medium px-2 py-0.5 rounded-full">{u.role ?? "USER"}</span>
                            {u.gestionnaire && (
                              <p className="text-xs text-slate-400 mt-0.5">{u.gestionnaire.role}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${es.bg} ${es.text}`}>{es.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            {u.derniereActivite ? (
                              <div>
                                <p className="text-xs text-slate-600 font-mono truncate max-w-[180px]">{u.derniereActivite.action}</p>
                                <p className="text-xs text-slate-400">{formatDate(u.derniereActivite.createdAt)}</p>
                              </div>
                            ) : <span className="text-xs text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {/* ADMIN ne peut pas agir sur un SUPER_ADMIN */}
                            {isAdmin && u.role === "SUPER_ADMIN" ? (
                              <div className="flex justify-end">
                                <span className="text-[10px] text-slate-400 italic px-2">Accès restreint</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button title="Détail & permissions"
                                  onClick={() => { setSelectedUser(u); setModalUser("detail"); }}
                                  className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                                  <Eye size={14} />
                                </button>
                                <button title="Réinitialiser le mot de passe"
                                  onClick={() => { setSelectedUser(u); setTempPwd(""); setMotifAction(""); setModalUser("reset"); }}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                                  <Key size={14} />
                                </button>
                                {u.etat === "SUSPENDU" ? (
                                  <button title="Réactiver le compte" disabled={busy}
                                    onClick={() => handleUserAction(u, "unsuspend")}
                                    className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40">
                                    <Unlock size={14} />
                                  </button>
                                ) : (
                                  <button title="Suspendre le compte" disabled={busy || u.id === parseInt(session!.user.id)}
                                    onClick={() => handleUserAction(u, "suspend")}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                                    <Lock size={14} />
                                  </button>
                                )}
                                <button title="Forcer la déconnexion" disabled={busy || u.id === parseInt(session!.user.id)}
                                  onClick={() => handleUserAction(u, "force_disconnect")}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                                  <LogOut size={14} />
                                </button>
                                {/* Suppression définitive — SUPER_ADMIN uniquement */}
                                {isSuperAdmin && (
                                  <button title="Supprimer définitivement" disabled={busy}
                                    onClick={() => handleUserAction(u, "delete_permanent")}
                                    className="p-1.5 text-slate-300 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                                    <UserX size={14} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(usersRes?.data.length ?? 0) === 0 && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">Aucun utilisateur trouvé</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {usersRes && usersRes.meta.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">{usersRes.meta.total} utilisateurs</p>
                  <div className="flex gap-2">
                    <button disabled={userPage <= 1} onClick={() => setUserPage((p) => p - 1)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Préc.</button>
                    <span className="px-3 py-1.5 text-xs text-slate-600">{userPage} / {usersRes.meta.totalPages}</span>
                    <button disabled={userPage >= usersRes.meta.totalPages} onClick={() => setUserPage((p) => p + 1)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Suiv.</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TAB PARAMÈTRES ════════════════════════════════════════════════ */}
        {activeTab === "parametres" && (
          <div className="space-y-5">
            {/* Pills sections */}
            <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm flex flex-wrap gap-1">
              {([
                { key: "platform",   label: "Plateforme",  icon: Globe },
                { key: "numbering",  label: "Numérotation",icon: Hash },
                { key: "security",   label: "Sécurité",    icon: ShieldCheck },
                { key: "accounting", label: "Comptabilité",icon: BarChart3 },
                { key: "financial",  label: "Financier",   icon: Banknote },
                { key: "stock",      label: "Stock",        icon: Package },
                { key: "backup",     label: "Sauvegarde",  icon: HardDrive },
              ] as { key: ParamSection; label: string; icon: React.ElementType }[]).map((s) => {
                const Icon = s.icon;
                return (
                  <button key={s.key} onClick={() => setParamSection(s.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${paramSection === s.key ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                    <Icon size={14} />{s.label}
                  </button>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              {/* Plateforme */}
              {paramSection === "platform" && (
                <div className="space-y-5">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Palette size={18} className="text-violet-500" />Paramètres plateforme</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: "platform.nom",    label: "Nom de la plateforme", type: "text" },
                      { key: "platform.devise", label: "Devise",               type: "text" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                        <input type={f.type} value={settings[f.key] ?? ""} onChange={(e) => setSetting(f.key, e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                      </div>  
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Langue</label>
                      <select value={settings["platform.langue"] ?? "fr"} onChange={(e) => setSetting("platform.langue", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50">
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                        <option value="ar">العربية</option>
                        <option value="es">Español</option>
                        <option value="pt">Português</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Thème</label>
                      <select value={settings["platform.theme"] ?? "light"} onChange={(e) => setSetting("platform.theme", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50">
                        <option value="light">Clair</option>
                        <option value="dark">Sombre</option>
                        <option value="system">Système</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Numérotation */}
              {paramSection === "numbering" && (
                <div className="space-y-5">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Hash size={18} className="text-violet-500" />Numérotation automatique</h3>
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">Variables : <code className="font-mono">{"{YYYY}"}</code> = année, <code className="font-mono">{"{MM}"}</code> = mois, <code className="font-mono">{"{SEQ}"}</code> = séquence auto</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: "numbering.facture",  label: "Format facture" },
                      { key: "numbering.vente",    label: "Format vente directe" },
                      { key: "numbering.mouvement",label: "Format mouvement stock" },
                      { key: "numbering.reception",label: "Format réception" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                        <input type="text" value={settings[f.key] ?? ""} onChange={(e) => setSetting(f.key, e.target.value)}
                          placeholder="Ex: FAC-{YYYY}-{SEQ}"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sécurité */}
              {paramSection === "security" && (
                <div className="space-y-5">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldCheck size={18} className="text-violet-500" />Politique de sécurité</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Longueur minimale mot de passe</label>
                      <input type="number" min={6} max={32} value={settings["security.pwd_min_length"] ?? "8"} onChange={(e) => setSetting("security.pwd_min_length", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Durée session (secondes)</label>
                      <input type="number" min={300} value={settings["security.session_duration"] ?? "3600"} onChange={(e) => setSetting("security.session_duration", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Tentatives échouées avant blocage</label>
                      <input type="number" min={3} max={20} value={settings["security.max_failed_attempts"] ?? "5"} onChange={(e) => setSetting("security.max_failed_attempts", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Durée blocage compte (secondes)</label>
                      <input type="number" min={60} value={settings["security.lockout_duration"] ?? "900"} onChange={(e) => setSetting("security.lockout_duration", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { key: "security.pwd_require_upper",   label: "Majuscule obligatoire" },
                      { key: "security.pwd_require_digit",   label: "Chiffre obligatoire" },
                      { key: "security.pwd_require_special", label: "Caractère spécial obligatoire" },
                    ].map((f) => (
                      <label key={f.key} className="flex items-center justify-between cursor-pointer bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                        <span className="text-sm text-slate-700">{f.label}</span>
                        <button type="button" onClick={() => setSetting(f.key, settings[f.key] === "true" ? "false" : "true")}>
                          {settings[f.key] === "true"
                            ? <ToggleRight size={28} className="text-violet-600" />
                            : <ToggleLeft size={28} className="text-slate-300" />
                          }
                        </button>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Comptabilité */}
              {paramSection === "accounting" && (
                <div className="space-y-5">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart3 size={18} className="text-violet-500" />Paramètres comptables</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Début exercice comptable (JJ-MM)</label>
                      <input type="text" placeholder="01-01" value={settings["accounting.exercice_debut"] ?? ""} onChange={(e) => setSetting("accounting.exercice_debut", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Taux TVA (%)</label>
                      <input type="number" min={0} max={100} step={0.5} value={settings["accounting.tva_taux"] ?? "18"} onChange={(e) => setSetting("accounting.tva_taux", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Méthode d&apos;amortissement</label>
                      <select value={settings["accounting.methode_amortissement"] ?? "lineaire"} onChange={(e) => setSetting("accounting.methode_amortissement", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50">
                        <option value="lineaire">Linéaire</option>
                        <option value="degressif">Dégressif</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center justify-between cursor-pointer bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                    <span className="text-sm text-slate-700">TVA active</span>
                    <button type="button" onClick={() => setSetting("accounting.tva_actif", settings["accounting.tva_actif"] === "true" ? "false" : "true")}>
                      {settings["accounting.tva_actif"] === "true"
                        ? <ToggleRight size={28} className="text-violet-600" />
                        : <ToggleLeft size={28} className="text-slate-300" />
                      }
                    </button>
                  </label>
                </div>
              )}

              {/* Financier */}
              {paramSection === "financial" && (
                <div className="space-y-5">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Banknote size={18} className="text-violet-500" />Paramètres financiers</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: "financial.plafond_caisse",     label: "Plafond caisse (FCFA)" },
                      { key: "financial.seuil_alerte_caisse",label: "Seuil alerte caisse (FCFA)" },
                      { key: "financial.devise_secondaire",  label: "Devise secondaire (optionnel)" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                        <input type="text" value={settings[f.key] ?? ""} onChange={(e) => setSetting(f.key, e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock */}
              {paramSection === "stock" && (
                <div className="space-y-5">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Package size={18} className="text-violet-500" />Paramètres stock</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Méthode de valorisation</label>
                      <select value={settings["stock.methode_valorisation"] ?? "FIFO"} onChange={(e) => setSetting("stock.methode_valorisation", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50">
                        <option value="FIFO">FIFO (Premier entré, premier sorti)</option>
                        <option value="LIFO">LIFO (Dernier entré, premier sorti)</option>
                        <option value="CMUP">CMUP (Coût moyen pondéré)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Seuil alerte global par défaut</label>
                      <input type="number" min={0} value={settings["stock.seuil_alerte_global"] ?? "10"} onChange={(e) => setSetting("stock.seuil_alerte_global", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                  </div>
                  <label className="flex items-center justify-between cursor-pointer bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                    <span className="text-sm text-slate-700">Inventaire automatique activé</span>
                    <button type="button" onClick={() => setSetting("stock.inventaire_auto", settings["stock.inventaire_auto"] === "true" ? "false" : "true")}>
                      {settings["stock.inventaire_auto"] === "true"
                        ? <ToggleRight size={28} className="text-violet-600" />
                        : <ToggleLeft size={28} className="text-slate-300" />
                      }
                    </button>
                  </label>
                </div>
              )}

              {/* Sauvegarde */}
              {paramSection === "backup" && (
                <div className="space-y-5">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><HardDrive size={18} className="text-violet-500" />Politique de sauvegarde</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence</label>
                      <select value={settings["backup.frequence"] ?? "quotidien"} onChange={(e) => setSetting("backup.frequence", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50">
                        <option value="quotidien">Quotidien</option>
                        <option value="hebdomadaire">Hebdomadaire</option>
                        <option value="mensuel">Mensuel</option>
                        <option value="manuel">Manuel uniquement</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Rétention (jours)</label>
                      <input type="number" min={1} max={365} value={settings["backup.retention"] ?? "30"} onChange={(e) => setSetting("backup.retention", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Heure de sauvegarde</label>
                      <input type="time" value={settings["backup.heure"] ?? "02:00"} onChange={(e) => setSetting("backup.heure", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">Les sauvegardes effectives dépendent de la configuration serveur (cron, pg_dump). Ces paramètres sont enregistrés en base et peuvent être lus par vos scripts d&apos;infrastructure.</p>
                  </div>
                </div>
              )}

              {/* Bouton Save */}
              {settingsDirty && (
                <div className="mt-6 flex justify-end">
                  <button onClick={handleSaveSettings} disabled={savingSettings}
                    className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-colors shadow-lg shadow-violet-200">
                    {savingSettings ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sauvegarde…</> : <><Save size={16} />Sauvegarder</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TAB MODULES ═══════════════════════════════════════════════════ */}
        {activeTab === "modules" && (
          <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">La désactivation d&apos;un module rend ses fonctionnalités inaccessibles à tous les utilisateurs. Agissez avec précaution.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(modulesRes?.data ?? []).map((m) => (
                <div key={m.id} className={`bg-white rounded-2xl border p-5 shadow-sm flex items-start justify-between gap-4 transition-all ${m.actif ? "border-slate-200" : "border-red-200 bg-red-50/30"}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.actif ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {m.actif ? "Actif" : "Désactivé"}
                      </span>
                      <p className="font-semibold text-slate-800 text-sm">{m.nom}</p>
                    </div>
                    {m.description && <p className="text-xs text-slate-400">{m.description}</p>}
                    <p className="text-xs text-slate-400 font-mono mt-1">clé : {m.key}</p>
                  </div>
                  <button onClick={() => handleToggleModule(m)} disabled={togglingModule}
                    className="shrink-0 transition-colors disabled:opacity-50">
                    {m.actif
                      ? <ToggleRight size={34} className="text-emerald-500 hover:text-emerald-600" />
                      : <ToggleLeft  size={34} className="text-slate-300 hover:text-slate-400" />
                    }
                  </button>
                </div>
              ))}
              {(modulesRes?.data.length ?? 0) === 0 && (
                <div className="col-span-2 text-center py-12 text-slate-400">
                  <Layers size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Chargement des modules…</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TAB LOGS ══════════════════════════════════════════════════════ */}
        {activeTab === "logs" && (
          <div className="space-y-5">
            {/* Switcher audit / sécurité */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap gap-3">
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                <button onClick={() => { setLogType("audit"); setLogPage(1); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${logType === "audit" ? "bg-white text-violet-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
                  <div className="flex items-center gap-1.5"><FileText size={14} />Journal d&apos;audit</div>
                </button>
                <button onClick={() => { setLogType("security"); setLogPage(1); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${logType === "security" ? "bg-white text-violet-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
                  <div className="flex items-center gap-1.5"><ShieldAlert size={14} />Logs sécurité</div>
                </button>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-48 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                <Search size={15} className="text-slate-400" />
                <input value={logSearch} onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }}
                  placeholder="Rechercher dans les logs…" className="flex-1 bg-transparent text-sm outline-none" />
                {logSearch && <button onClick={() => setLogSearch("")}><X size={14} className="text-slate-400 hover:text-slate-600" /></button>}
              </div>
              <button onClick={refetchLogs} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50"><RefreshCw size={15} /></button>
              <button onClick={handleExportLogs} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl font-medium hover:bg-violet-700 transition-colors">
                <Download size={14} />Export CSV
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Action</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">{logType === "audit" ? "Entité" : "Détails"}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Utilisateur</th>
                      {logType === "security" && <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">IP</th>}
                    </tr>
                  </thead>  
                  <tbody>
                    {(logsRes?.data ?? []).map((l) => (
                      <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-md ${
                            l.action.includes("FAILED") || l.action.includes("LOCKED") || l.action.includes("SUSPEND")
                              ? "bg-red-50 text-red-700"
                              : l.action.includes("UNLOCK") || l.action.includes("SUCCESS")
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}>{l.action}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          {logType === "audit" ? `${l.entite ?? ""}${l.entiteId ? ` #${l.entiteId}` : ""}` : (l.details ?? "—")}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {l.user ? (
                            <div>
                              <p className="font-medium text-slate-700">{l.user.prenom} {l.user.nom}</p>
                              <p className="text-slate-400">{l.user.role ?? l.userEmail ?? ""}</p>
                            </div>
                          ) : <span className="text-slate-400">{l.userEmail ?? "Système"}</span>}
                        </td>
                        {logType === "security" && <td className="px-4 py-2.5 text-xs font-mono text-slate-400">{l.ipAddress ?? "—"}</td>}
                      </tr>
                    ))}
                    {(logsRes?.data.length ?? 0) === 0 && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Aucun log trouvé</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {logsRes && logsRes.meta.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">{logsRes.meta.total} entrées</p>
                  <div className="flex gap-2">
                    <button disabled={logPage <= 1} onClick={() => setLogPage((p) => p - 1)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Préc.</button>
                    <span className="px-3 py-1.5 text-xs text-slate-600">{logPage} / {logsRes.meta.totalPages}</span>
                    <button disabled={logPage >= logsRes.meta.totalPages} onClick={() => setLogPage((p) => p + 1)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Suiv.</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ MODALS ══════════════════════════════════════════════════════════ */}

      {/* Modal détail utilisateur */}
      {modalUser === "detail" && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="font-bold text-slate-800">Détail — {selectedUser.prenom} {selectedUser.nom}</h2>
              <button onClick={() => setModalUser(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { l: "Email",         v: selectedUser.email },
                  { l: "Téléphone",     v: selectedUser.telephone ?? "—" },
                  { l: "Rôle système",  v: selectedUser.role ?? "USER" },
                  { l: "Rôle opérat.", v: selectedUser.gestionnaire?.role ?? "—" },
                  { l: "Statut",        v: selectedUser.etat },
                  { l: "Adhésion",      v: formatDate(selectedUser.dateAdhesion) },
                  { l: "Logs audit",    v: String(selectedUser._count.auditLogs) },
                ].map((r) => (
                  <div key={r.l} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400">{r.l}</p>
                    <p className="font-medium text-slate-800 text-sm">{r.v}</p>
                  </div>
                ))}
              </div>

              {/* Permissions personnalisées */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-600">Permissions personnalisées ({selectedUser.userPermissions.length})</p>
                  <button onClick={() => setModalUser("permission")} className="text-xs text-violet-600 hover:underline font-medium flex items-center gap-1">
                    <Wrench size={12} /> Gérer
                  </button>
                </div>
                {selectedUser.userPermissions.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedUser.userPermissions.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                        <span className="text-xs font-mono text-slate-600">{p.module} → {p.permission}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.granted ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {p.granted ? "Accordé" : "Refusé"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-slate-400 italic">Aucune permission personnalisée</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal reset password */}
      {modalUser === "reset" && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Key size={18} className="text-amber-500" />Réinitialiser le mot de passe</h2>
              <button onClick={() => { setModalUser(null); setTempPwd(""); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {!tempPwd ? (
                <>
                  <p className="text-sm text-slate-600">Réinitialiser le mot de passe de <strong>{selectedUser.prenom} {selectedUser.nom}</strong> ?</p>
                  <p className="text-xs text-slate-400">Un mot de passe temporaire sécurisé sera généré. L&apos;utilisateur devra le changer à sa prochaine connexion.</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Motif (optionnel)</label>
                    <input type="text" value={motifAction} onChange={(e) => setMotifAction(e.target.value)}
                      placeholder="Ex: Demande de l'utilisateur"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setModalUser(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm hover:bg-slate-50">Annuler</button>
                    <button onClick={() => handleUserAction(selectedUser, "reset_password")} disabled={doingAction}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                      {doingAction ? "Génération…" : "Générer"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <p className="text-xs text-amber-600 mb-2">Mot de passe temporaire généré</p>
                    <p className="text-xl font-mono font-bold text-amber-800 tracking-wider">{tempPwd}</p>
                    <p className="text-xs text-amber-500 mt-2">Communiquez-le à l&apos;utilisateur de façon sécurisée. Il ne sera plus affiché après fermeture.</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(tempPwd); toast.success("Copié !"); }} className="w-full py-2.5 border border-amber-200 rounded-xl text-amber-700 text-sm font-medium hover:bg-amber-50">
                    Copier dans le presse-papiers
                  </button>
                  <button onClick={() => { setModalUser(null); setTempPwd(""); refetchUsers(); }} className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900">
                    Fermer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal gestion permissions */}
      {modalUser === "permission" && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Shield size={18} className="text-violet-500" />Permissions — {selectedUser.prenom} {selectedUser.nom}</h2>
              <button onClick={() => setModalUser("detail")} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Blocage ADMIN sur SUPER_ADMIN */}
              {isAdmin && selectedUser.role === "SUPER_ADMIN" && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <ShieldAlert size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">Vous ne pouvez pas modifier les permissions d&apos;un Super Administrateur.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Module</label>
                  <select value={permModule} onChange={(e) => setPermModule(e.target.value)}
                    disabled={isAdmin && selectedUser.role === "SUPER_ADMIN"}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50 disabled:opacity-50">
                    <option value="">-- Choisir --</option>
                    {["caisse","stock","packs","ventes","logistique","comptabilite","rapports","assemblees","admin","superadmin"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Permission</label>
                  <select value={permPerm} onChange={(e) => setPermPerm(e.target.value)}
                    disabled={isAdmin && selectedUser.role === "SUPER_ADMIN"}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50 disabled:opacity-50">
                    <option value="">-- Choisir --</option>
                    {["read","write","delete","export","admin","override"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className={`flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 ${isAdmin && selectedUser.role === "SUPER_ADMIN" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                <span className="text-sm text-slate-700">Accordée (sinon refusée)</span>
                <button type="button" disabled={isAdmin && selectedUser.role === "SUPER_ADMIN"} onClick={() => setPermGranted(!permGranted)}>
                  {permGranted ? <ToggleRight size={28} className="text-violet-600" /> : <ToggleLeft size={28} className="text-slate-300" />}
                </button>
              </label>
              <div className="flex gap-3">
                <button onClick={() => setModalUser("detail")} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm hover:bg-slate-50">Retour</button>
                <button
                  disabled={!permModule || !permPerm || doingAction || (isAdmin && selectedUser.role === "SUPER_ADMIN")}
                  onClick={async () => {
                    await handleUserAction(selectedUser, "set_permission", { module: permModule, permission: permPerm, granted: permGranted });
                    setPermModule(""); setPermPerm(""); setPermGranted(true);
                    refetchUsers();
                    setModalUser("detail");
                  }}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                  {doingAction ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
