"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  TrendingUp, Users, MessageSquare, Layers, ShoppingCart, Package, Store, Truck,
  ClipboardCheck, BarChart2, UserCog, Network, Target, Shield, Lock, Megaphone,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { useT } from "@/contexts/AppSettingsContext";
import { useApi } from "@/hooks/useApi";

const COLLAPSE_STORAGE_KEY = "admin-sidebar-collapsed";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: number;
};

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export default function AdminSidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const t = useT();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  // Repli/dépli de la sidebar desktop — préférence mémorisée localement.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // Lecture localStorage impossible pendant le rendu serveur (SSR) — lazy
    // useState provoquerait un mismatch d'hydratation ; l'effet est le seul
    // point sûr pour synchroniser depuis cette source externe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1") setCollapsed(true);
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const { data: messagesNonLusRes } = useApi<{ nonLus: number }>(
    "/api/messages/unread-count", undefined, { refreshInterval: 30_000 }
  );
  const messagesNonLus = messagesNonLusRes?.nonLus ?? 0;

  const sections: { title: string; items: NavItem[] }[] = [
    {
      title: t("main"),
      items: [
        { href: "/dashboard/admin", label: t("nav_dashboard"), icon: <TrendingUp size={19} />, exact: true },
        { href: "/dashboard/admin/membres", label: t("nav_membres"), icon: <Users size={19} /> },
        { href: "/dashboard/admin/gestionnaires", label: t("nav_gestionnaires"), icon: <Users size={19} /> },
        { href: "/dashboard/admin/messages", label: t("nav_messages"), icon: <MessageSquare size={19} />, badge: messagesNonLus },
      ],
    },
    {
      title: t("nav_section_clientele"),
      items: [
        { href: "/dashboard/admin/clients", label: t("nav_clients"), icon: <Users size={19} /> },
      ],
    },
    {
      title: t("packs_sales"),
      items: [
        { href: "/dashboard/admin/packs", label: t("nav_packs"), icon: <Layers size={19} /> },
      ],
    },
    {
      title: t("commerce"),
      items: [
        { href: "/dashboard/admin/ventes", label: t("nav_ventes"), icon: <ShoppingCart size={19} /> },
        { href: "/dashboard/admin/catalogue/produits", label: t("nav_catalogue_produits"), icon: <Layers size={19} /> },
        { href: "/dashboard/admin/stock", label: t("nav_stock"), icon: <Package size={19} /> },
        { href: "/dashboard/admin/pdv", label: t("nav_pdv"), icon: <Store size={19} /> },
        { href: "/dashboard/admin/approvisionnements", label: t("nav_approvisionnements"), icon: <Truck size={19} /> },
        { href: "/dashboard/admin/stock/ajustements", label: t("nav_ajustements_stock"), icon: <ClipboardCheck size={19} /> },
        { href: "/dashboard/gestionnaire/logistique", label: t("nav_dashboard_logistique"), icon: <BarChart2 size={19} /> },
      ],
    },
    {
      title: t("nav_section_rh"),
      items: [
        { href: "/dashboard/admin/rh", label: t("nav_dashboard_rh"), icon: <UserCog size={18} /> },
      ],
    },
    {
      title: t("nav_section_ria"),
      items: [
        { href: "/dashboard/admin/ria", label: t("nav_dashboard_ria"), icon: <Network size={18} /> },
      ],
    },
    {
      title: t("nav_section_popc"),
      items: [
        { href: "/dashboard/admin/popc", label: t("nav_popc_objectifs"), icon: <Target size={18} /> },
      ],
    },
    {
      title: t("nav_section_marketing"),
      items: [
        { href: "/dashboard/admin/marketing", label: t("nav_marketing"), icon: <Megaphone size={18} /> },
      ],
    },
    {
      title: isSuperAdmin ? t("nav_superadmin_short") : t("nav_admin_section"),
      items: [
        { href: "/dashboard/admin/superadmin", label: t("nav_superadmin"), icon: <Shield size={19} /> },
        { href: "/dashboard/admin/droits-acces", label: t("nav_droits_acces"), icon: <Lock size={16} /> },
      ],
    },
  ];

  const renderNav = (collapsedMode: boolean) => (
    <>
      {sections.map((section) => (
        <div key={section.title} className="p-3.5 border-b border-brand-700/50 last:border-b-0">
          {!collapsedMode && (
            <h3 className="text-xs font-semibold text-brand-200/70 uppercase tracking-wider mb-2 px-1">
              {section.title}
            </h3>
          )}
          <nav className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  title={collapsedMode ? item.label : undefined}
                  className={`flex items-center rounded-xl text-sm font-medium transition-colors ${
                    collapsedMode ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                  } ${
                    active
                      ? "bg-white text-brand-800 shadow-sm"
                      : "text-brand-50/90 hover:bg-brand-600/60 hover:text-white"
                  }`}
                >
                  <span className="relative shrink-0">
                    {item.icon}
                    {collapsedMode && !!item.badge && (
                      <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                  </span>
                  {!collapsedMode && <span className="flex-1">{item.label}</span>}
                  {!collapsedMode && !!item.badge && (
                    <span className="relative flex items-center justify-center">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </>
  );

  return (
    <>
      {/* Desktop/tablette — sidebar statique, repliable */}
      <aside className={`shrink-0 hidden md:block transition-[width] duration-200 ${collapsed ? "w-[68px]" : "w-64"}`}>
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto overflow-x-hidden rounded-2xl bg-brand-700 border border-brand-800 shadow-sm">
          <div className={`flex items-center border-b border-brand-700/50 p-2 ${collapsed ? "justify-center" : "justify-end"}`}>
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Déplier la sidebar" : "Replier la sidebar"}
              className="p-1.5 rounded-lg text-brand-100/80 hover:bg-brand-600/60 hover:text-white transition-colors"
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
          </div>
          {renderNav(collapsed)}
        </div>
      </aside>

      {/* Mobile — tiroir coulissant (toujours déplié) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[110] md:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onMobileClose} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-brand-700 shadow-xl overflow-y-auto animate-[popIn_0.18s_ease-out]">
            {renderNav(false)}
          </div>
        </div>
      )}
    </>
  );
}
