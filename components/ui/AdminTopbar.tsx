"use client";

import { Menu } from "lucide-react";
import AfriSimeLogo from "@/components/AfriSimeLogo";
import UserPdvBadge from "@/components/UserPdvBadge";
import NotificationBell from "@/components/NotificationBell";
import AccountMenuButton from "@/components/AccountMenuButton";

/**
 * `avecSidebar` : la sidebar (qui porte le logo) occupe la gauche de l'écran ; la barre du haut
 * s'étend alors sur le reste de la largeur et n'affiche plus le logo (sauf sur mobile).
 */
export default function AdminTopbar({ onMenuClick, avecSidebar = false }: { onMenuClick?: () => void; avecSidebar?: boolean }) {
  return (
    <header className="bg-brand-700 border-b border-brand-800 shadow-sm sticky top-0 z-50 dark:bg-slate-900/90 dark:border-slate-700">
      <div className={`px-4 sm:px-5 md:px-8 py-3 flex items-center gap-3 sm:gap-4 ${avecSidebar ? "" : "max-w-[1800px] mx-auto"}`}>
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden text-white/80 hover:text-white"
            aria-label="Ouvrir le menu"
          >
            <Menu size={22} />
          </button>
        )}
        {/* Logo sur pastille blanche : lisible sur le vert de la barre */}
        <span className={`shrink-0 rounded-xl bg-white px-2 py-1 ${avecSidebar ? "md:hidden" : ""}`}>
          <AfriSimeLogo className="h-8 w-auto" priority />
        </span>

        {/* La cloche est gris foncé par défaut (composant partagé) : forcée en blanc sur la barre verte */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto min-w-0 [&>a]:text-white [&>a:hover]:bg-white/15">
          <UserPdvBadge />
          <NotificationBell href="/dashboard/admin/notifications" />
          <AccountMenuButton settingsHref="/dashboard/admin/parametres" inline />
        </div>
      </div>
    </header>
  );
}
