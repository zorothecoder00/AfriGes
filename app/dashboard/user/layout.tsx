"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import PointageWidget from "@/components/PointageWidget";
import RiaAccessShortcuts from "@/components/RiaAccessShortcuts";
import AccountMenuButton from "@/components/AccountMenuButton";

// Sections dashboard/user qui affichent déjà "Mon compte" dans leur propre
// topbar (à côté des notifications) — le bouton flottant global ferait
// doublon et se superpose visuellement à la cloche de notifications.
const OWN_TOPBAR_PREFIXES = [
  "/dashboard/user/actionnaires",
  "/dashboard/user/agentsTerrain",
  "/dashboard/user/auditeursInterne",
  "/dashboard/user/caissiers",
  "/dashboard/user/chefAgence",
  "/dashboard/user/comptables",
  "/dashboard/user/directeurCommercial",
  "/dashboard/user/investisseurs",
  "/dashboard/user/logistiquesApprovisionnements",
  "/dashboard/user/magasiniers",
  "/dashboard/user/responsablesPointDeVente",
  "/dashboard/user/responsablesVenteCredit",
  "/dashboard/user/revendeurs",
];

export default function UserDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hasOwnTopbar = OWN_TOPBAR_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <>
      {children}
      {!hasOwnTopbar && (
        <AccountMenuButton settingsHref="/dashboard/user/parametres" catalogueHref="/dashboard/user/catalogue" />
      )}
      <PointageWidget />
      <RiaAccessShortcuts />
    </>
  );
}
