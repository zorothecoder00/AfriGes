"use client";

import React, { useState, useCallback } from "react";
import {
  Shield, Users, Settings, Layers, FileText, Activity,
  HardDrive, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Search, Download, Eye, Lock, Unlock, LogOut,
  Key, ToggleLeft, ToggleRight, Save, ArrowLeft, Bell,
  TrendingUp, Package, Banknote,
  ChevronRight, UserX, UserCheck, Zap, X, Info,
  ShieldAlert, ShieldCheck, Terminal, Globe, Palette,
  Hash, BarChart3, Wrench,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useApi, useMutation } from "@/hooks/useApi";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import NotificationBell from "@/components/NotificationBell";
import { PAGES_REGISTRY } from "@/lib/pagesRegistry";
import { exportRowsToXlsx } from "@/lib/exportXlsx";
import SideTabs from "@/components/ui/SideTabs";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "systeme" | "utilisateurs" | "parametres" | "modules" | "logs" | "acces";
type ParamSection = "platform" | "numbering" | "security" | "accounting" | "financial" | "stock" | "backup";
type LogType = "audit" | "security";

interface StatsData {
  utilisateurs: { total: number; actifs: number; suspendus: number; inactifs: number };
  operations:   { clients: number; pdvActifs: number; souscriptionsActives: number; ventes24h: number; ventesCA: number };
  stock:        { rupture: number; faible: number };
  systeme:      { caissesOuvertes: number; notificationsNonLues: number; securityLogs24h: number };
  alertes:      { type: string; message: string; priorite: string; produits?: { id: number; nom: string }[] }[];
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
  userEmail?: string; details?: string | Record<string, unknown> | null; ipAddress?: string | null;
  createdAt: string;
  user: { nom: string; prenom: string; email?: string; role: string | null } | null;
}
interface LogsResponse { data: LogItem[]; meta: { total: number; page: number; totalPages: number; limit: number } }
interface AccesRoleResponse { success: boolean; data: Record<string, Record<string, boolean>>; activeModules: string[]; }
interface UserSectionItem { key: string; label: string; roleDefault: boolean; userOverride: boolean | null; effective: boolean; moduleBlocked: boolean; }
interface UserAccesResponse { success: boolean; role: string; data: UserSectionItem[]; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Classes Tailwind écrites en toutes lettres (le JIT ne détecte pas les
// template strings interpolées type `from-${hue}-50`) — table statique par
// teinte, couvrant les couleurs utilisées par les appels KpiCard ci-dessous.
const HUE_CLASSES: Record<string, { wrap: string; bar: string; label: string; value: string }> = {
  violet:  { wrap: "from-violet-50 border-violet-100 hover:shadow-violet-200/60 hover:border-violet-300",   bar: "bg-violet-500",  label: "text-violet-700/80",  value: "text-violet-700" },
  emerald: { wrap: "from-emerald-50 border-emerald-100 hover:shadow-emerald-200/60 hover:border-emerald-300", bar: "bg-emerald-500", label: "text-emerald-700/80", value: "text-emerald-700" },
  red:     { wrap: "from-red-50 border-red-100 hover:shadow-red-200/60 hover:border-red-300",               bar: "bg-red-500",     label: "text-red-700/80",     value: "text-red-700" },
  blue:    { wrap: "from-blue-50 border-blue-100 hover:shadow-blue-200/60 hover:border-blue-300",           bar: "bg-blue-500",    label: "text-blue-700/80",    value: "text-blue-700" },
  orange:  { wrap: "from-orange-50 border-orange-100 hover:shadow-orange-200/60 hover:border-orange-300",   bar: "bg-orange-500",  label: "text-orange-700/80",  value: "text-orange-700" },
  teal:    { wrap: "from-teal-50 border-teal-100 hover:shadow-teal-200/60 hover:border-teal-300",           bar: "bg-teal-500",    label: "text-teal-700/80",    value: "text-teal-700" },
  amber:   { wrap: "from-amber-50 border-amber-100 hover:shadow-amber-200/60 hover:border-amber-300",       bar: "bg-amber-500",   label: "text-amber-700/80",   value: "text-amber-700" },
  slate:   { wrap: "from-slate-50 border-slate-200 hover:shadow-slate-200/60 hover:border-slate-300",       bar: "bg-slate-400",   label: "text-slate-600/90",   value: "text-slate-700" },
};

function KpiCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; bg: string;
}) {
  const hue = color.match(/text-([a-z]+)-\d+/)?.[1] ?? "slate";
  const h = HUE_CLASSES[hue] ?? HUE_CLASSES.slate;
  return (
    <div className={`group relative overflow-hidden bg-gradient-to-br ${h.wrap} to-white rounded-2xl p-5 shadow-sm border transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${h.bar}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`${bg} p-2.5 rounded-xl transition-transform duration-300 ease-out group-hover:scale-110`}><Icon className={`${color} w-5 h-5`} /></div>
      </div>
      <p className={`text-xs font-semibold mb-0.5 ${h.label}`}>{label}</p>
      <p className={`text-2xl font-bold transition-transform duration-300 group-hover:scale-105 origin-left ${h.value}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const prioriteStyle: Record<string, string> = {
  CRITIQUE: "bg-red-100 text-red-700 border-red-200",
  HAUTE:    "bg-amber-100 text-amber-700 border-amber-200",
  NORMALE:  "bg-blue-100 text-blue-700 border-blue-200",
};

const etatStyle: Record<string, { bg: string; text: string; labelKey: "status_actif" | "status_suspendu" | "status_inactif" }> = {
  ACTIF:     { bg: "bg-emerald-100", text: "text-emerald-700", labelKey: "status_actif" },
  SUSPENDU:  { bg: "bg-red-100",     text: "text-red-700",     labelKey: "status_suspendu" },
  INACTIF:   { bg: "bg-slate-100",   text: "text-slate-600",   labelKey: "status_inactif" },
};

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const { data: session, status } = useSession();
  const { applyAndPersist, t } = useAppSettings();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const isAdmin      = session?.user?.role === "ADMIN"; // admin simple (droits restreints)

  const [activeTab, setActiveTab] = useState<TabKey>("systeme");

  // ── États utilisateurs
  const [userSearch,          setUserSearch]          = useState("");
  const [userEtat,            setUserEtat]            = useState("");
  const [userGestionnaireRole,setUserGestionnaireRole]= useState("");
  const [userPage,            setUserPage]            = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserSA | null>(null);
  const [modalUser, setModalUser]     = useState<"detail" | "reset" | "permission" | "confirm_delete" | null>(null);
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

  // ── États accès sections
  const [accesSelectedRole, setAccesSelectedRole] = useState("RESPONSABLE_POINT_DE_VENTE");
  const [accesRoleLocal, setAccesRoleLocal] = useState<Record<string, Record<string, boolean>>>({});
  const [accesRoleDirty, setAccesRoleDirty] = useState(false);
  const [accesUserSearch, setAccesUserSearch] = useState("");
  const [accesSelectedUserId, setAccesSelectedUserId] = useState<number | null>(null);
  const [accesUserData, setAccesUserData] = useState<UserSectionItem[] | null>(null);
  const [accesUserRole, setAccesUserRole] = useState<string>("");
  const [accesUserOverridesLocal, setAccesUserOverridesLocal] = useState<Record<string, boolean | null>>({});
  const [accesUserDirty, setAccesUserDirty] = useState(false);
  const [loadingUserAcces, setLoadingUserAcces] = useState(false);

  // ── Fetches
  const { data: statsRes, refetch: refetchStats } = useApi<StatsData>("/api/superadmin/stats");
  const usersParams = new URLSearchParams({ page: String(userPage), limit: "20", ...(userSearch ? { search: userSearch } : {}), ...(userEtat ? { etat: userEtat } : {}) }).toString();
  const { data: usersRes, refetch: refetchUsers } = useApi<UsersResponse>(activeTab === "utilisateurs" ? `/api/superadmin/users?${usersParams}` : null);
  const { data: settingsRes } = useApi<SettingsData>(activeTab === "parametres" ? "/api/superadmin/settings" : null);
  const { data: modulesRes, refetch: refetchModules } = useApi<ModulesResponse>(activeTab === "modules" ? "/api/superadmin/modules" : null);
  const logsParams = new URLSearchParams({ page: String(logPage), limit: "30", type: logType, ...(logSearch ? { search: logSearch } : {}) }).toString();
  const { data: logsRes, refetch: refetchLogs } = useApi<LogsResponse>(activeTab === "logs" ? `/api/superadmin/audit-logs?${logsParams}` : null);
  const { data: accesRoleRes, refetch: refetchAccesRole } = useApi<AccesRoleResponse>(activeTab === "acces" ? "/api/admin/acces-roles" : null);
  const { data: accesUsersRes } = useApi<UsersResponse>(activeTab === "acces" ? "/api/superadmin/users?page=1&limit=200" : null);

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

  // Sync accès rôles depuis API → état local
  React.useEffect(() => {
    if (accesRoleRes?.data && !accesRoleDirty) {
      setAccesRoleLocal(accesRoleRes.data);
    }
  }, [accesRoleRes, accesRoleDirty]);

  // Sync selectedUser depuis la liste fraîche après chaque refetch
  React.useEffect(() => {
    if (selectedUser && usersRes?.data) {
      const updated = usersRes.data.find((u) => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersRes?.data]);

  // ── Mutations
  const actionUserIdRef = React.useRef<number | null>(null);
  const { mutate: doUserAction, loading: doingAction } = useMutation<{ success: boolean; tempPassword?: string; message: string }, unknown>(
    () => actionUserIdRef.current ? `/api/superadmin/users/${actionUserIdRef.current}/action` : "",
    "POST", { successMessage: "" }
  );
  const { mutate: saveSettings, loading: savingSettings } = useMutation<{ success: boolean }, unknown>("/api/superadmin/settings", "PATCH", { successMessage: "Paramètres sauvegardés ✓" });
  const moduleKeyRef = React.useRef("");
  const { mutate: toggleModule, loading: togglingModule } = useMutation<{ success: boolean }, unknown>("/api/superadmin/modules", "PATCH", { successMessage: "" });
  const { mutate: saveRoleAccess, loading: savingRoleAccess } = useMutation<{ success: boolean }, unknown>("/api/admin/acces-roles", "PUT", { successMessage: "Accès par rôle sauvegardés ✓" });
  const accesUserIdRef = React.useRef<number | null>(null);
  const { mutate: saveUserAccess, loading: savingUserAccess } = useMutation<{ success: boolean }, unknown>(
    () => accesUserIdRef.current ? `/api/admin/acces-roles/${accesUserIdRef.current}` : "",
    "PUT", { successMessage: "Accès utilisateur sauvegardés ✓" }
  );

  // ── Handlers
  const handleUserAction = useCallback(async (user: UserSA, action: string, extra?: Record<string, unknown>) => {
    actionUserIdRef.current = user.id;
    setProcessingUserId(user.id);
    const res = await doUserAction({ action, motif: motifAction || undefined, ...extra });
    setProcessingUserId(null);
    if (!res) return;
    if (action === "reset_password" && (res as { tempPassword?: string }).tempPassword) {
      setTempPwd((res as { tempPassword: string }).tempPassword);
    } else if (action === "remove_permission") {
      // Rester dans le modal détail après suppression d'une permission
      toast.success((res as { message: string }).message);
      refetchUsers();
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
        l.entite ?? (typeof l.details === "string" ? l.details : l.details ? JSON.stringify(l.details) : "") ?? "",
        l.user ? `${l.user.prenom} ${l.user.nom}` : l.userEmail ?? "—",
        l.user?.role ?? "—",
      ]),
    ];
    void exportRowsToXlsx(
      rows,
      `logs-${logType}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      { sheetName: "Logs" },
    );
  };

  const loadUserAcces = React.useCallback(async (userId: number) => {
    setLoadingUserAcces(true);
    try {
      const res = await fetch(`/api/admin/acces-roles/${userId}`);
      const data = await res.json() as UserAccesResponse;
      if (data.success) {
        setAccesUserData(data.data);
        setAccesUserRole(data.role);
        const overrides: Record<string, boolean | null> = {};
        for (const s of data.data) overrides[s.key] = s.userOverride;
        setAccesUserOverridesLocal(overrides);
        setAccesUserDirty(false);
      }
    } finally {
      setLoadingUserAcces(false);
    }
  }, []);

  const handleSaveRoleAccess = useCallback(async () => {
    const roleData = accesRoleLocal[accesSelectedRole] ?? {};
    const sections = Object.entries(roleData).map(([key, allowed]) => ({ key, allowed }));
    const res = await saveRoleAccess({ role: accesSelectedRole, sections });
    if (res) { setAccesRoleDirty(false); refetchAccesRole(); }
  }, [accesRoleLocal, accesSelectedRole, saveRoleAccess, refetchAccesRole]);

  const handleSaveUserAccess = useCallback(async () => {
    if (!accesSelectedUserId) return;
    accesUserIdRef.current = accesSelectedUserId;
    const overrides = Object.entries(accesUserOverridesLocal).map(([key, granted]) => ({ key, granted }));
    const res = await saveUserAccess({ overrides });
    if (res) { setAccesUserDirty(false); accesUserIdRef.current = null; }
  }, [accesSelectedUserId, accesUserOverridesLocal, saveUserAccess]);

  // ── Évite le "flash" d'erreur pendant l'hydratation de la session
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/70 text-center">
          <RefreshCw size={22} className="text-slate-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-slate-500">Vérification des autorisations…</p>
        </div>
      </div>
    );
  }

  // ── Guard rôle — ni ADMIN ni SUPER_ADMIN → accès refusé
  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl p-10 shadow text-center max-w-md">
          <ShieldAlert size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">{t('sa_acces_refuse')}</h2>
          <p className="text-slate-500 mb-6">Cette section est réservée aux administrateurs.</p>
          <Link href="/dashboard/admin" className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700">{t('sa_retour_dashboard')}</Link>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: "systeme",      label: t('sa_tab_systeme'),      icon: Activity,  badge: statsRes?.alertes.length },
    { key: "utilisateurs", label: t('sa_tab_utilisateurs'), icon: Users,     badge: statsRes?.utilisateurs.suspendus },
    { key: "parametres",   label: t('sa_tab_parametres'),   icon: Settings },
    { key: "modules",      label: t('sa_tab_modules'),      icon: Layers },
    { key: "logs",         label: t('sa_tab_logs'),         icon: FileText },
    { key: "acces",        label: t('sa_tab_acces'),        icon: Eye },
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
                      </div>
        </div>
      </header>

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

        {/* Tabs */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <SideTabs
            accent="violet"
            items={tabs.map((tab) => {
              const Icon = tab.icon;
              return {
                key: tab.key,
                label: tab.label,
                icon: (
                  <span className="flex items-center gap-2">
                    <Icon size={16} />
                    {!!tab.badge && tab.badge > 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{tab.badge}</span>
                    )}
                  </span>
                ),
                active: activeTab === tab.key,
                onClick: () => setActiveTab(tab.key),
              };
            })}
          />
          <div className="flex-1 min-w-0 space-y-6">

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
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold">[{a.priorite}]</span> {a.message}
                        {a.produits && a.produits.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {a.produits.map((p) => (
                              <Link
                                key={p.id}
                                href={`/dashboard/admin/catalogue/produits/${p.id}?tab=dispo`}
                                className="px-2 py-0.5 rounded-lg bg-white/70 border border-white/60 text-xs font-medium hover:underline"
                              >
                                {p.nom}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Module RH — accès rapide */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wrench className="text-indigo-500 w-5 h-5" />
                  <h2 className="font-bold text-slate-800">Module RH</h2>
                </div>
                <Link href="/dashboard/admin/rh" className="text-xs text-violet-600 font-semibold hover:underline flex items-center gap-1">
                  Ouvrir <ChevronRight size={12} />
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { href: "/dashboard/admin/rh",              label: t('nav_dashboard_rh'),     color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
                  { href: "/dashboard/admin/rh/collaborateurs",label: t('sa_rh_collaborateurs'), color: "text-blue-600 bg-blue-50 border-blue-200" },
                  { href: "/dashboard/admin/rh/conges",        label: t('sa_rh_conges'),         color: "text-amber-600 bg-amber-50 border-amber-200" },
                  { href: "/dashboard/admin/rh/recrutement",   label: t('sa_rh_recrutement'),    color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                  { href: "/dashboard/admin/rh/formations",    label: t('sa_rh_formations'),     color: "text-violet-600 bg-violet-50 border-violet-200" },
                  { href: "/dashboard/admin/rh/evaluations",   label: t('sa_rh_evaluations'),    color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
                  { href: "/dashboard/admin/rh/paie",          label: t('sa_rh_paie'),           color: "text-teal-600 bg-teal-50 border-teal-200" },
                  { href: "/dashboard/admin/rh/audit",         label: t('sa_rh_audit'),          color: "text-rose-600 bg-rose-50 border-rose-200" },
                ].map(({ href, label, color }) => (
                  <Link key={href} href={href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${color} hover:opacity-80 transition-opacity`}>
                    <ChevronRight size={11} /> {label}
                  </Link>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                <Zap size={11} /> Rôle gestionnaire concerné : <span className="font-mono font-medium text-slate-500">RESPONSABLE_RH</span>
              </p>
            </div>

            {/* Logs récents */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Terminal className="text-slate-500 w-5 h-5" />
                  <h2 className="font-bold text-slate-800">{t('sa_activite_recente')}</h2>
                </div>
                <button onClick={() => setActiveTab("logs")} className="text-xs text-violet-600 font-semibold hover:underline flex items-center gap-1">{t('sa_voir_tout')} <ChevronRight size={12} /></button>
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
                {(statsRes?.logsRecents.length ?? 0) === 0 && <p className="text-sm text-slate-400 text-center py-4">{t('sa_aucune_activite')}</p>}
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
                  placeholder={t('sa_search_ph_users')} className="flex-1 bg-transparent text-sm outline-none" />
              </div>
              <select value={userEtat} onChange={(e) => { setUserEtat(e.target.value); setUserPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">{t('sa_tous_statuts')}</option>
                <option value="ACTIF">{t('status_actif')}</option>
                <option value="SUSPENDU">{t('status_suspendu')}</option>
                <option value="INACTIF">{t('status_inactif')}</option>
              </select>
              <select value={userGestionnaireRole} onChange={(e) => { setUserGestionnaireRole(e.target.value); setUserPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">{t('sa_tous_roles')}</option>
                <option value="RESPONSABLE_RH">Responsable RH</option>
                <option value="RESPONSABLE_POINT_DE_VENTE">Resp. PDV</option>
                <option value="CHEF_AGENCE">Chef d&apos;agence</option>
                <option value="CAISSIER">{t('role_caissier')}</option>
                <option value="MAGAZINIER">{t('role_magasinier')}</option>
                <option value="COMPTABLE">{t('role_comptable')}</option>
                <option value="AGENT_LOGISTIQUE_APPROVISIONNEMENT">{t('role_agent_logistique')}</option>
                <option value="AGENT_TERRAIN">{t('role_agent_terrain')}</option>
              </select>
              <button onClick={refetchUsers} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"><RefreshCw size={15} /></button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">{t('col_utilisateur')}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">{t('col_role')}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">{t('col_status')}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">{t('col_derniere_activite')}</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs">{t('col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(usersRes?.data ?? [])
                      .filter((u) => !userGestionnaireRole || u.gestionnaire?.role === userGestionnaireRole)
                      .map((u) => {
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
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${es.bg} ${es.text}`}>{t(es.labelKey)}</span>
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
                                <span className="text-[10px] text-slate-400 italic px-2">{t('sa_acces_restreint')}</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button title={t('sa_title_detail_permissions')}
                                  onClick={() => { setSelectedUser(u); setModalUser("detail"); }}
                                  className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                                  <Eye size={14} />
                                </button>
                                <button title={t('sa_title_reset_pwd')}
                                  onClick={() => { setSelectedUser(u); setTempPwd(""); setMotifAction(""); setModalUser("reset"); }}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                                  <Key size={14} />
                                </button>
                                {u.etat === "SUSPENDU" ? (
                                  <button title={t('sa_title_reactiver')} disabled={busy}
                                    onClick={() => handleUserAction(u, "unsuspend")}
                                    className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40">
                                    <Unlock size={14} />
                                  </button>
                                ) : (
                                  <button title={t('sa_title_suspendre')} disabled={busy || u.id === parseInt(session!.user.id)}
                                    onClick={() => handleUserAction(u, "suspend")}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                                    <Lock size={14} />
                                  </button>
                                )}
                                <button title={t('sa_title_forcer_deco')} disabled={busy || u.id === parseInt(session!.user.id)}
                                  onClick={() => handleUserAction(u, "force_disconnect")}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                                  <LogOut size={14} />
                                </button>
                                {/* Suppression définitive — SUPER_ADMIN uniquement */}
                                {isSuperAdmin && (
                                  <button title={t('sa_title_supprimer_def')} disabled={busy}
                                    onClick={() => { setSelectedUser(u); setModalUser("confirm_delete"); }}
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
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">{t('sa_aucun_utilisateur')}</td></tr>
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
                { key: "platform",   label: t('sa_param_platform'),  icon: Globe },
                { key: "numbering",  label: t('sa_param_numbering'), icon: Hash },
                { key: "security",   label: t('sa_param_security'),  icon: ShieldCheck },
                { key: "accounting", label: t('sa_param_accounting'),icon: BarChart3 },
                { key: "financial",  label: t('sa_param_financial'), icon: Banknote },
                { key: "stock",      label: t('sa_param_stock'),     icon: Package },
                { key: "backup",     label: t('sa_param_backup'),    icon: HardDrive },
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
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Palette size={18} className="text-violet-500" />{t('sa_platform_settings_title')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: "platform.nom",    label: t('sa_nom_plateforme'), type: "text" },
                      { key: "platform.devise", label: t('sa_devise'),         type: "text" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                        <input type={f.type} value={settings[f.key] ?? ""} onChange={(e) => setSetting(f.key, e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                      </div>  
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t('sa_langue')}</label>
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
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t('sa_theme')}</label>
                      <select value={settings["platform.theme"] ?? "light"} onChange={(e) => setSetting("platform.theme", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50">
                        <option value="light">{t('sa_theme_clair')}</option>
                        <option value="dark">{t('sa_theme_sombre')}</option>
                        <option value="system">{t('sa_theme_systeme')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Numérotation */}
              {paramSection === "numbering" && (
                <div className="space-y-5">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Hash size={18} className="text-violet-500" />{t('sa_numbering_title')}</h3>
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">Variables : <code className="font-mono">{"{YYYY}"}</code> = année, <code className="font-mono">{"{MM}"}</code> = mois, <code className="font-mono">{"{SEQ}"}</code> = séquence auto</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: "numbering.facture",  label: t('sa_format_facture') },
                      { key: "numbering.vente",    label: t('sa_format_vente') },
                      { key: "numbering.mouvement",label: t('sa_format_mouvement') },
                      { key: "numbering.reception",label: t('sa_format_reception') },
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
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldCheck size={18} className="text-violet-500" />{t('sa_security_title')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t('sa_pwd_min_length')}</label>
                      <input type="number" min={6} max={32} value={settings["security.pwd_min_length"] ?? "8"} onChange={(e) => setSetting("security.pwd_min_length", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Durée session (secondes)</label>
                      <input type="number" min={300} value={settings["security.session_duration"] ?? "3600"} onChange={(e) => setSetting("security.session_duration", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t('sa_pwd_max_attempts')}</label>
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
                      { key: "security.pwd_require_upper",   label: t('sa_pwd_require_upper') },
                      { key: "security.pwd_require_digit",   label: t('sa_pwd_require_digit') },
                      { key: "security.pwd_require_special", label: t('sa_pwd_require_special') },
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
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart3 size={18} className="text-violet-500" />{t('sa_accounting_title')}</h3>
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
                        <option value="lineaire">{t('sa_amort_lineaire')}</option>
                        <option value="degressif">{t('sa_amort_degressif')}</option>
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
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Banknote size={18} className="text-violet-500" />{t('sa_financial_title')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: "financial.plafond_caisse",     label: t('sa_plafond_caisse') },
                      { key: "financial.seuil_alerte_caisse",label: t('sa_seuil_alerte_caisse') },
                      { key: "financial.devise_secondaire",  label: t('sa_devise_secondaire') },
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
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Package size={18} className="text-violet-500" />{t('sa_stock_title')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t('sa_methode_valorisation')}</label>
                      <select value={settings["stock.methode_valorisation"] ?? "FIFO"} onChange={(e) => setSetting("stock.methode_valorisation", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50">
                        <option value="FIFO">FIFO (Premier entré, premier sorti)</option>
                        <option value="LIFO">LIFO (Dernier entré, premier sorti)</option>
                        <option value="CMUP">CMUP (Coût moyen pondéré)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t('sa_seuil_alerte_global')}</label>
                      <input type="number" min={0} value={settings["stock.seuil_alerte_global"] ?? "10"} onChange={(e) => setSetting("stock.seuil_alerte_global", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                  </div>
                  <label className="flex items-center justify-between cursor-pointer bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                    <span className="text-sm text-slate-700">{t('sa_inventaire_auto')}</span>
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
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><HardDrive size={18} className="text-violet-500" />{t('sa_backup_title')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t('sa_backup_frequence')}</label>
                      <select value={settings["backup.frequence"] ?? "quotidien"} onChange={(e) => setSetting("backup.frequence", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50">
                        <option value="quotidien">{t('sa_backup_quotidien')}</option>
                        <option value="hebdomadaire">{t('sa_backup_hebdo')}</option>
                        <option value="mensuel">{t('sa_backup_mensuel')}</option>
                        <option value="manuel">{t('sa_backup_manuel')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Rétention (jours)</label>
                      <input type="number" min={1} max={365} value={settings["backup.retention"] ?? "30"} onChange={(e) => setSetting("backup.retention", e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t('sa_backup_heure')}</label>
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
                    {savingSettings ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('sa_sauvegarde_en_cours')}</> : <><Save size={16} />{t('action_save')}</>}
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
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3 flex items-start gap-3">
              <Info size={15} className="text-indigo-500 mt-0.5 shrink-0" />
              <p className="text-xs text-indigo-700">
                Le module <span className="font-mono font-semibold">rh</span> pilote l&apos;accès du rôle <span className="font-mono font-semibold">RESPONSABLE_RH</span> ainsi que toutes les sections RH définies dans <em>Accès sections</em>. Le désactiver bloque l&apos;intégralité du tableau de bord RH gestionnaire.
              </p>
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
                  <div className="flex items-center gap-1.5"><ShieldAlert size={14} />{t('sa_logs_securite')}</div>
                </button>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-48 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                <Search size={15} className="text-slate-400" />
                <input value={logSearch} onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }}
                  placeholder={t('sa_search_logs_ph')} className="flex-1 bg-transparent text-sm outline-none" />
                {logSearch && <button onClick={() => setLogSearch("")}><X size={14} className="text-slate-400 hover:text-slate-600" /></button>}
              </div>
              <button onClick={refetchLogs} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50"><RefreshCw size={15} /></button>
              <Link href="/dashboard/admin/rh/audit"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm rounded-xl font-medium hover:bg-indigo-100 transition-colors">
                <ShieldCheck size={14} />Journal RH
              </Link>
              <button onClick={handleExportLogs} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl font-medium hover:bg-violet-700 transition-colors">
                <Download size={14} />Export Excel
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">{t('col_date')}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">{t('col_action_log')}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">{logType === "audit" ? "Entité" : "Détails"}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">{t('col_utilisateur')}</th>
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
                          {logType === "audit"
                            ? `${l.entite ?? ""}${l.entiteId ? ` #${l.entiteId}` : ""}`
                            : (typeof l.details === "string" ? l.details : l.details ? JSON.stringify(l.details) : "—")}
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
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">{t('sa_aucun_log')}</td></tr>
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
        {/* ═══ TAB ACCÈS ═════════════════════════════════════════════════════ */}
        {activeTab === "acces" && (
          <div className="grid grid-cols-2 gap-6">

            {/* ── Panneau gauche : Config par rôle ───────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-violet-50 p-2 rounded-xl"><Shield className="text-violet-600 w-4 h-4" /></div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">{t('sa_config_par_role')}</h2>
                  <p className="text-xs text-slate-400">{t('sa_sections_accessibles')}</p>
                </div>
              </div>

              {/* Sélecteur de rôle */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {PAGES_REGISTRY.map((r) => (
                  <button key={r.role} onClick={() => setAccesSelectedRole(r.role)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${accesSelectedRole === r.role ? "bg-violet-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Liste des sections */}
              {(() => {
                const reg = PAGES_REGISTRY.find((r) => r.role === accesSelectedRole);
                if (!reg) return null;
                const activeModuleSet = new Set(accesRoleRes?.activeModules ?? []);
                return (
                  <div className="space-y-2">
                    {reg.sections.map((s) => {
                      const allowed = accesRoleLocal[accesSelectedRole]?.[s.key] ?? s.defaultAllowed;
                      const moduleBlocked = s.module !== null && accesRoleRes != null && !activeModuleSet.has(s.module);
                      return (
                        <div key={s.key} className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${moduleBlocked ? "bg-orange-50 opacity-70" : "bg-slate-50"}`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-700">{s.label}</p>
                              {moduleBlocked && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-100 text-orange-600 uppercase tracking-wide">
                                  module désactivé
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono">{s.key}</p>
                          </div>
                          <button
                            disabled={moduleBlocked}
                            onClick={() => {
                              setAccesRoleLocal((prev) => ({
                                ...prev,
                                [accesSelectedRole]: { ...(prev[accesSelectedRole] ?? {}), [s.key]: !allowed },
                              }));
                              setAccesRoleDirty(true);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${allowed ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                          >
                            {allowed ? <><CheckCircle size={12} /> Autorisé</> : <><XCircle size={12} /> Bloqué</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">{accesRoleDirty ? "Modifications non sauvegardées" : "Configuration à jour"}</p>
                <button onClick={handleSaveRoleAccess} disabled={!accesRoleDirty || savingRoleAccess}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl font-medium hover:bg-violet-700 transition-colors disabled:opacity-40">
                  <Save size={14} />{savingRoleAccess ? "Sauvegarde…" : "Sauvegarder"}
                </button>
              </div>
            </div>

            {/* ── Panneau droit : Override par utilisateur ───────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-blue-50 p-2 rounded-xl"><UserCheck className="text-blue-600 w-4 h-4" /></div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">{t('sa_override_utilisateur')}</h2>
                  <p className="text-xs text-slate-400">Personnaliser l&apos;accès d&apos;un gestionnaire individuel</p>
                </div>
              </div>

              {/* Recherche utilisateur */}
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 mb-3">
                <Search size={14} className="text-slate-400" />
                <input value={accesUserSearch} onChange={(e) => setAccesUserSearch(e.target.value)}
                  placeholder={t('sa_search_gestionnaire_ph')} className="flex-1 bg-transparent text-sm outline-none" />
                {accesUserSearch && (
                  <button onClick={() => setAccesUserSearch("")}><X size={13} className="text-slate-400 hover:text-slate-600" /></button>
                )}
              </div>

              {/* Liste gestionnaires */}
              <div className="space-y-1 max-h-44 overflow-y-auto mb-4 border border-slate-100 rounded-xl p-1">
                {!accesUsersRes && (
                  <p className="text-xs text-slate-400 text-center py-4">Chargement…</p>
                )}
                {(accesUsersRes?.data ?? [])
                  .filter((u) => u.gestionnaire !== null)
                  .filter((u) => !accesUserSearch || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(accesUserSearch.toLowerCase()))
                  .slice(0, 20)
                  .map((u) => (
                    <button key={u.id}
                      onClick={() => { setAccesSelectedUserId(u.id); loadUserAcces(u.id); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${accesSelectedUserId === u.id ? "bg-blue-600 text-white" : "hover:bg-slate-50 text-slate-700"}`}>
                      <div className="text-left">
                        <p className="font-medium">{u.prenom} {u.nom}</p>
                        <p className={`text-xs ${accesSelectedUserId === u.id ? "text-blue-200" : "text-slate-400"}`}>
                          {u.gestionnaire?.role}
                        </p>
                      </div>
                      <ChevronRight size={14} className="flex-shrink-0" />
                    </button>
                  ))}
                {accesUsersRes && (accesUsersRes.data ?? []).filter((u) => u.gestionnaire !== null).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">{t('sa_aucun_gestionnaire')}</p>
                )}
              </div>

              {/* Sections de l'utilisateur sélectionné */}
              {accesSelectedUserId ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-600">
                      Sections — <span className="text-blue-600">{PAGES_REGISTRY.find((r) => r.role === accesUserRole)?.label ?? accesUserRole}</span>
                    </p>
                    <button onClick={() => { setAccesSelectedUserId(null); setAccesUserData(null); }}
                      className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                      <X size={12} /> Désélectionner
                    </button>
                  </div>

                  {loadingUserAcces ? (
                    <div className="flex justify-center py-6">
                      <RefreshCw size={18} className="animate-spin text-slate-400" />
                    </div>
                  ) : accesUserData ? (
                    <>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {accesUserData.map((s) => {
                          const override = accesUserOverridesLocal[s.key] ?? null;
                          return (
                            <div key={s.key} className={`flex items-center justify-between py-2 px-3 rounded-xl ${s.moduleBlocked ? "bg-orange-50 opacity-70" : "bg-slate-50"}`}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-slate-700">{s.label}</p>
                                  {s.moduleBlocked && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-100 text-orange-600 uppercase tracking-wide">
                                      module désactivé
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  Rôle par défaut : {s.roleDefault ? "Autorisé" : "Bloqué"}
                                </p>
                              </div>
                              <div className={`flex gap-1 ${s.moduleBlocked ? "pointer-events-none opacity-40" : ""}`}>
                                {([
                                  { label: t('sa_defaut'), value: null,  cls: "bg-slate-100 text-slate-600 hover:bg-slate-200" },
                                  { label: t('sa_autoriser'), value: true,  cls: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" },
                                  { label: t('sa_bloquer'),  value: false, cls: "bg-red-100 text-red-700 hover:bg-red-200" },
                                ] as { label: string; value: boolean | null; cls: string }[]).map((opt) => (
                                  <button key={String(opt.value)}
                                    onClick={() => { setAccesUserOverridesLocal((prev) => ({ ...prev, [s.key]: opt.value })); setAccesUserDirty(true); }}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${override === opt.value ? "ring-2 ring-offset-1 ring-violet-400 " + opt.cls : opt.cls + " opacity-60"}`}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-400">{accesUserDirty ? "Modifications non sauvegardées" : "À jour"}</p>
                        <button onClick={handleSaveUserAccess} disabled={!accesUserDirty || savingUserAccess}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-40">
                          <Save size={14} />{savingUserAccess ? "Sauvegarde…" : "Sauvegarder"}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <UserCheck size={28} className="text-slate-300" />
                  <p className="text-sm text-slate-400">{t('sa_select_gestionnaire_hint')}</p>
                </div>
              )}
            </div>

          </div>
        )}

          </div>
        </div>

      </div>

      {/* ═══ MODALS ══════════════════════════════════════════════════════════ */}

      {/* Modal détail utilisateur */}
      {modalUser === "detail" && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
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
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.granted ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {p.granted ? "Accordé" : "Refusé"}
                          </span>
                          <button
                            title={t('sa_supprimer_permission_title')}
                            disabled={processingUserId === selectedUser.id}
                            onClick={async () => {
                              await handleUserAction(selectedUser, "remove_permission", { module: p.module, permission: p.permission });
                              refetchUsers();
                            }}
                            className="p-1 text-slate-300 hover:text-red-600 rounded-lg transition-colors disabled:opacity-40">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-slate-400 italic">{t('sa_aucune_permission_perso')}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal reset password */}
      {modalUser === "reset" && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Key size={18} className="text-amber-500" />{t('sa_title_reset_pwd')}</h2>
              <button onClick={() => { setModalUser(null); setTempPwd(""); setMotifAction(""); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {!tempPwd ? (
                <>
                  <p className="text-sm text-slate-600">{t('sa_reset_pwd_confirm_prefix')} <strong>{selectedUser.prenom} {selectedUser.nom}</strong> ?</p>
                  <p className="text-xs text-slate-400">{t('sa_reset_pwd_hint')}</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t('sa_motif_optionnel')}</label>
                    <input type="text" value={motifAction} onChange={(e) => setMotifAction(e.target.value)}
                      placeholder={t('sa_motif_ph')}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setModalUser(null); setMotifAction(""); }} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm hover:bg-slate-50">{t('action_cancel')}</button>
                    <button onClick={() => handleUserAction(selectedUser, "reset_password")} disabled={doingAction}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                      {doingAction ? t('sa_generation_en_cours') : t('sa_generer')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <p className="text-xs text-amber-600 mb-2">{t('sa_pwd_temp_genere')}</p>
                    <p className="text-xl font-mono font-bold text-amber-800 tracking-wider">{tempPwd}</p>
                    <p className="text-xs text-amber-500 mt-2">{t('sa_communiquer_securise')}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(tempPwd); toast.success(t('sa_copie_toast')); }} className="w-full py-2.5 border border-amber-200 rounded-xl text-amber-700 text-sm font-medium hover:bg-amber-50">
                    {t('sa_copier_presse_papiers')}
                  </button>
                  <button onClick={() => { setModalUser(null); setTempPwd(""); refetchUsers(); }} className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900">
                    {t('action_close')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression définitive */}
      {modalUser === "confirm_delete" && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-bold text-red-700 flex items-center gap-2"><UserX size={18} />{t('sa_suppression_def_title')}</h2>
              <button onClick={() => setModalUser(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-800 mb-1">{t('msg_irreversible')}</p>
                <p className="text-xs text-red-600">
                  {t('col_utilisateur')} <strong>{selectedUser.prenom} {selectedUser.nom}</strong> ({selectedUser.email}) {t('sa_suppression_desc')}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('sa_motif_optionnel')}</label>
                <input type="text" value={motifAction} onChange={(e) => setMotifAction(e.target.value)}
                  placeholder={t('sa_motif_ph')}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setModalUser(null); setMotifAction(""); }}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm hover:bg-slate-50">
                  {t('action_cancel')}
                </button>
                <button
                  disabled={doingAction}
                  onClick={() => handleUserAction(selectedUser, "delete_permanent")}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  <UserX size={14} />{doingAction ? t('sa_suppression_en_cours') : t('sa_title_supprimer_def')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal gestion permissions */}
      {modalUser === "permission" && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Shield size={18} className="text-violet-500" />{t('sa_permissions_prefix')} — {selectedUser.prenom} {selectedUser.nom}</h2>
              <button onClick={() => setModalUser("detail")} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Blocage ADMIN sur SUPER_ADMIN */}
              {isAdmin && selectedUser.role === "SUPER_ADMIN" && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <ShieldAlert size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">{t('sa_no_edit_superadmin')}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('xlsx_module')}</label>
                  <select value={permModule} onChange={(e) => setPermModule(e.target.value)}
                    disabled={isAdmin && selectedUser.role === "SUPER_ADMIN"}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50 disabled:opacity-50">
                    <option value="">{t('sa_choisir_placeholder')}</option>
                    {["caisse","stock","packs","ventes","logistique","comptabilite","rapports","assemblees","admin","superadmin"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('sa_permission_label')}</label>
                  <select value={permPerm} onChange={(e) => setPermPerm(e.target.value)}
                    disabled={isAdmin && selectedUser.role === "SUPER_ADMIN"}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50 disabled:opacity-50">
                    <option value="">{t('sa_choisir_placeholder')}</option>
                    {["read","write","delete","export","admin","override"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className={`flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 ${isAdmin && selectedUser.role === "SUPER_ADMIN" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                <span className="text-sm text-slate-700">{t('sa_accordee_sinon_refusee')}</span>
                <button type="button" disabled={isAdmin && selectedUser.role === "SUPER_ADMIN"} onClick={() => setPermGranted(!permGranted)}>
                  {permGranted ? <ToggleRight size={28} className="text-violet-600" /> : <ToggleLeft size={28} className="text-slate-300" />}
                </button>
              </label>
              <div className="flex gap-3">
                <button onClick={() => setModalUser("detail")} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm hover:bg-slate-50">{t('sa_retour')}</button>
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
