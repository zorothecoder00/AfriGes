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
  "/dashboard/user/responsablesMarketing",
  "/dashboard/user/responsablesPointDeVente",
  "/dashboard/user/responsablesVenteCredit",
  "/dashboard/user/revendeurs",
];

// Sous-ensemble ci-dessus dont le bloc profil (UserPdvBadge) est déjà présent
// dans la page — ce badge embarque désormais lui-même le déclencheur de
// pointage, donc le bouton flottant y ferait doublon et doit être masqué.
// Les autres portails "own topbar" (actionnaires, directeurCommercial,
// investisseurs, responsablesVenteCredit, revendeurs) n'ont pas ce badge et
// gardent le bouton flottant comme seul point d'accès au pointage.
const HAS_PDV_BADGE_PREFIXES = [
  "/dashboard/user/agentsTerrain",
  "/dashboard/user/auditeursInterne",
  "/dashboard/user/caissiers",
  "/dashboard/user/chefAgence",
  "/dashboard/user/comptables",
  "/dashboard/user/logistiquesApprovisionnements",
  "/dashboard/user/magasiniers",
  "/dashboard/user/responsablesMarketing",
  "/dashboard/user/responsablesPointDeVente",
];

export default function UserDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hasOwnTopbar = OWN_TOPBAR_PREFIXES.some((p) => pathname.startsWith(p));
  const hasPdvBadge  = HAS_PDV_BADGE_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <>
      {children}
      {!hasOwnTopbar && (
        <AccountMenuButton settingsHref="/dashboard/user/parametres" catalogueHref="/dashboard/user/catalogue" />
      )}
      {!hasPdvBadge && <PointageWidget />}
      <RiaAccessShortcuts />
    </>
  );
}
