"use client";

import { Search, Menu } from "lucide-react";
import AfriSimeLogo from "@/components/AfriSimeLogo";
import UserPdvBadge from "@/components/UserPdvBadge";
import NotificationBell from "@/components/NotificationBell";
import AccountMenuButton from "@/components/AccountMenuButton";

export default function AdminTopbar({ onMenuClick }: { onMenuClick?: () => void }) {
  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 dark:bg-slate-900/90 dark:border-slate-700">
      <div className="max-w-[1800px] mx-auto px-5 md:px-8 py-3 flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden text-slate-500 hover:text-slate-700 dark:text-slate-300"
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} />
        </button>
        <AfriSimeLogo className="h-10 w-auto shrink-0" priority />

        <div className="flex-1 max-w-md hidden lg:block">
          <div className="relative">
            <Search className="absolute inset-y-0 left-3 my-auto text-slate-400" size={16} />
            <input
              type="search"
              placeholder="Rechercher..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-700
                placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <UserPdvBadge />
          <NotificationBell href="/dashboard/admin/notifications" />
          <AccountMenuButton settingsHref="/dashboard/admin/parametres" inline />
        </div>
      </div>
    </header>
  );
}
