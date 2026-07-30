"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TagModalProvider } from "@/contexts/TagModalContext";
import TagClientsModal from "@/components/admin/TagClientsModal";
import AdminTopbar from "@/components/ui/AdminTopbar";
import AdminSidebar from "@/components/ui/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  // La sidebar niveau 1 (navigation entre modules) n'a d'intérêt que sur
  // l'accueil admin — une fois dans un module, elle ferait doublon avec la
  // navigation propre du module (ou, pour les pages sans navigation propre,
  // priverait inutilement le contenu d'espace) : on la masque partout ailleurs.
  const showSidebar = pathname === "/dashboard/admin";

  return (
    <TagModalProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <AdminTopbar onMenuClick={showSidebar ? () => setMobileNavOpen(true) : undefined} />
        <div className="max-w-[1800px] mx-auto px-5 md:px-8 py-6 flex gap-6">
          {showSidebar && (
            <AdminSidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
          )}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
      <TagClientsModal />
    </TagModalProvider>
  );
}
