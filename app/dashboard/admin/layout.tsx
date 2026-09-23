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
      {showSidebar ? (
        // Accueil admin : sidebar pleine hauteur collée à gauche (logo inclus), barre du haut et
        // contenu occupent tout le reste de la largeur (plus de marge vide à gauche).
        <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900">
          <AdminSidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
          <div className="flex-1 min-w-0 flex flex-col">
            <AdminTopbar avecSidebar onMenuClick={() => setMobileNavOpen(true)} />
            <div className="px-4 sm:px-5 md:px-8 py-4 sm:py-6 flex-1 min-w-0 overflow-x-clip">{children}</div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
          <AdminTopbar />
          <div className="max-w-[1800px] mx-auto px-4 sm:px-5 md:px-8 py-4 sm:py-6">
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      )}
      <TagClientsModal />
    </TagModalProvider>
  );
}
