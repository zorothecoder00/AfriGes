"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TagModalProvider } from "@/contexts/TagModalContext";
import TagClientsModal from "@/components/admin/TagClientsModal";
import AccountMenuButton from "@/components/AccountMenuButton";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Le tableau de bord principal intègre déjà sa propre carte de profil
  // dans l'en-tête (à côté de la cloche de notification) — pas de doublon flottant.
  const isMainDashboard = pathname === "/dashboard/admin";

  return (
    <TagModalProvider>
      {children}
      {!isMainDashboard && <AccountMenuButton settingsHref="/dashboard/admin/parametres" />}
      <TagClientsModal />
    </TagModalProvider>
  );
}
