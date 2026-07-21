import type { ReactNode } from "react";
import PointageWidget from "@/components/PointageWidget";
import RiaAccessShortcuts from "@/components/RiaAccessShortcuts";
import AccountMenuButton from "@/components/AccountMenuButton";

export default function UserDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AccountMenuButton settingsHref="/dashboard/user/parametres" catalogueHref="/dashboard/user/catalogue" />
      <PointageWidget />
      <RiaAccessShortcuts />
    </>
  );
}
