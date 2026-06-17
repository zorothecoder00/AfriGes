import type { ReactNode } from "react";
import PointageWidget from "@/components/PointageWidget";
import CommissionPortalShortcut from "@/components/CommissionPortalShortcut";

export default function UserDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PointageWidget />
      <CommissionPortalShortcut />
    </>
  );
}
